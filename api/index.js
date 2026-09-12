import 'dotenv/config'
import dns from 'dns'
import cors from 'cors'
import express from 'express'
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'crypto'
import { MongoClient, ObjectId } from 'mongodb'

// Windows/router DNS often fails Node's SRV lookup for mongodb+srv://
dns.setServers(['8.8.8.8', '1.1.1.1'])

const PORT = Number(process.env.PORT) || 3001
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'office-visit-calendar'
const ATTENDANCE_COLLECTION = 'attendance'
const USERS_COLLECTION = 'users'
const LEGACY_DOC_ID = 'default'
const isVercel = Boolean(process.env.VERCEL)
const AUTH_SECRET =
  process.env.AUTH_SECRET || 'dev-only-change-me-officeil-poyo'
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30 days

const emptySettings = {
  profile: {
    name: '',
    email: '',
    role: '',
    goDaily: false,
    officeDaysGoal: 12,
  },
  leaves: [],
  holidays: [],
  rewards: [],
  activity: { lastActiveDate: null, streak: 0, behindMonths: [] },
}

const emptyAppData = () => ({
  attendance: {},
  settings: {
    ...emptySettings,
    leaves: [],
    holidays: [],
    rewards: [],
    activity: { lastActiveDate: null, streak: 0, behindMonths: [] },
  },
  finance: {
    currency: 'INR',
    transactions: [],
    salaries: [],
    emis: [],
    investments: [],
    recurringExpenses: [],
    customCategories: { income: [], expense: [] },
  },
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

function getMongoClient() {
  if (!MONGODB_URI || MONGODB_URI.includes('REPLACE_ME')) {
    throw new Error(
      'Missing MONGODB_URI. Set it in Vercel Project Settings → Environment Variables (and in .env locally).',
    )
  }

  if (!globalThis.__officeilMongoClient) {
    globalThis.__officeilMongoClient = new MongoClient(MONGODB_URI, {
      serverSelectionTimeoutMS: 12000,
      connectTimeoutMS: 12000,
    })
    globalThis.__officeilMongoReady = false
  }
  return globalThis.__officeilMongoClient
}

function describeDbError(err) {
  const message = String(err?.message || err)
  if (/Missing MONGODB_URI/i.test(message)) {
    return {
      error: 'MongoDB is not configured',
      hint: 'Add MONGODB_URI (and optional MONGODB_DB) in Vercel → Settings → Environment Variables, then redeploy.',
      detail: message,
    }
  }
  if (
    /SSL|TLS|ECONNREFUSED|ENOTFOUND|server selection|ReplicaSetNoPrimary|timed out/i.test(
      message,
    )
  ) {
    return {
      error: 'MongoDB Atlas is unreachable',
      hint: 'In Atlas → Network Access, allow 0.0.0.0/0 (required for Vercel) or your current IP, then retry.',
      detail: message,
    }
  }
  return { error: 'Database error', detail: message }
}

async function ensureDb() {
  const client = getMongoClient()
  if (!globalThis.__officeilMongoReady) {
    await client.connect()
    globalThis.__officeilMongoReady = true
  }
  await client.db(DB_NAME).command({ ping: 1 })
  return client.db(DB_NAME)
}

async function withDb(res, work) {
  try {
    const db = await ensureDb()
    return await work(db)
  } catch (err) {
    globalThis.__officeilMongoReady = false
    try {
      const client = globalThis.__officeilMongoClient
      if (client) await client.close()
    } catch {
      // ignore close errors while recovering
    }
    globalThis.__officeilMongoClient = undefined
    console.error(err)
    const payload = describeDbError(err)
    if (!res.headersSent) {
      res.status(503).json(payload)
    }
    return null
  }
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 64).toString('hex')
  return { salt, hash }
}

function verifyPassword(password, salt, hash) {
  const next = scryptSync(password, salt, 64)
  const prev = Buffer.from(hash, 'hex')
  if (next.length !== prev.length) return false
  return timingSafeEqual(next, prev)
}

function signToken(userId) {
  const exp = Date.now() + TOKEN_TTL_MS
  const payload = `${userId}.${exp}`
  const sig = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex')
  return `${payload}.${sig}`
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expStr, sig] = parts
  const exp = Number(expStr)
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null
  const payload = `${userId}.${expStr}`
  const expected = createHmac('sha256', AUTH_SECRET).update(payload).digest('hex')
  try {
    const a = Buffer.from(sig, 'hex')
    const b = Buffer.from(expected, 'hex')
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  return userId
}

function getBearerToken(req) {
  const header = req.headers.authorization
  if (!header || typeof header !== 'string') return null
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match ? match[1].trim() : null
}

async function requireUser(req, res, db) {
  const token = getBearerToken(req)
  const userId = verifyToken(token)
  if (!userId) {
    res.status(401).json({ error: 'Sign in required' })
    return null
  }
  let objectId
  try {
    objectId = new ObjectId(userId)
  } catch {
    res.status(401).json({ error: 'Invalid session' })
    return null
  }
  const user = await db.collection(USERS_COLLECTION).findOne({ _id: objectId })
  if (!user) {
    res.status(401).json({ error: 'Account not found' })
    return null
  }
  return user
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase()
}

function publicUser(user) {
  return {
    id: String(user._id),
    email: user.email,
    name: user.name || '',
  }
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  if (!('attendance' in body) && !('settings' in body) && !('finance' in body)) {
    return {
      attendance: body,
      settings: emptySettings,
      finance: emptyAppData().finance,
    }
  }

  return {
    attendance:
      body.attendance && typeof body.attendance === 'object'
        ? body.attendance
        : {},
    settings:
      body.settings && typeof body.settings === 'object'
        ? body.settings
        : emptySettings,
    finance:
      body.finance && typeof body.finance === 'object'
        ? body.finance
        : emptyAppData().finance,
  }
}

function unwrapAttendanceDoc(doc) {
  const data = doc?.data
  if (
    data &&
    typeof data === 'object' &&
    !('attendance' in data) &&
    !('settings' in data) &&
    !('finance' in data)
  ) {
    return {
      attendance: data,
      settings: doc?.settings ?? emptySettings,
      finance: emptyAppData().finance,
    }
  }
  const unwrapped = data ?? emptyAppData()
  if (!unwrapped.finance || typeof unwrapped.finance !== 'object') {
    return { ...unwrapped, finance: emptyAppData().finance }
  }
  return unwrapped
}

app.get('/api/health', async (_req, res) => {
  await withDb(res, async () => {
    res.json({ ok: true })
  })
})

app.post('/api/auth/register', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')
  const name = String(req.body?.name || '').trim().slice(0, 80)

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  await withDb(res, async (db) => {
    const users = db.collection(USERS_COLLECTION)
    const existing = await users.findOne({ email })
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const { salt, hash } = hashPassword(password)
    const insert = await users.insertOne({
      email,
      name,
      salt,
      passwordHash: hash,
      createdAt: new Date(),
    })

    const userId = insert.insertedId
    const attendance = db.collection(ATTENDANCE_COLLECTION)

    // First account inherits legacy shared document if present
    const userCount = await users.countDocuments()
    let starter = emptyAppData()
    if (userCount === 1) {
      const legacy = await attendance.findOne({ _id: LEGACY_DOC_ID })
      if (legacy) {
        starter = unwrapAttendanceDoc(legacy)
        await attendance.deleteOne({ _id: LEGACY_DOC_ID })
      }
    }

    if (!starter.settings) starter.settings = emptySettings
    starter.settings.profile = {
      ...emptySettings.profile,
      ...(starter.settings.profile || {}),
      email,
      name: name || starter.settings.profile?.name || '',
    }

    await attendance.updateOne(
      { _id: String(userId) },
      { $set: { data: starter, updatedAt: new Date() } },
      { upsert: true },
    )

    const token = signToken(String(userId))
    res.status(201).json({
      token,
      user: publicUser({ _id: userId, email, name }),
    })
  })
})

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email)
  const password = String(req.body?.password || '')

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' })
  }

  await withDb(res, async (db) => {
    const user = await db.collection(USERS_COLLECTION).findOne({ email })
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const token = signToken(String(user._id))
    res.json({ token, user: publicUser(user) })
  })
})

app.get('/api/auth/me', async (req, res) => {
  await withDb(res, async (db) => {
    const user = await requireUser(req, res, db)
    if (!user) return
    res.json({ user: publicUser(user) })
  })
})

function isFinanceEmpty(finance) {
  if (!finance || typeof finance !== 'object') return true
  const tx = Array.isArray(finance.transactions) ? finance.transactions : []
  const salaries = Array.isArray(finance.salaries) ? finance.salaries : []
  const emis = Array.isArray(finance.emis) ? finance.emis : []
  const investments = Array.isArray(finance.investments)
    ? finance.investments
    : []
  const recurring = Array.isArray(finance.recurringExpenses)
    ? finance.recurringExpenses
    : []
  const incomeCats = Array.isArray(finance.customCategories?.income)
    ? finance.customCategories.income
    : []
  const expenseCats = Array.isArray(finance.customCategories?.expense)
    ? finance.customCategories.expense
    : []
  return (
    tx.length === 0 &&
    salaries.length === 0 &&
    emis.length === 0 &&
    investments.length === 0 &&
    recurring.length === 0 &&
    incomeCats.length === 0 &&
    expenseCats.length === 0
  )
}

app.get('/api/attendance', async (req, res) => {
  await withDb(res, async (db) => {
    const user = await requireUser(req, res, db)
    if (!user) return

    const doc = await db
      .collection(ATTENDANCE_COLLECTION)
      .findOne({ _id: String(user._id) })
    res.json(unwrapAttendanceDoc(doc))
  })
})

app.put('/api/attendance', async (req, res) => {
  const payload = normalizePayload(req.body)
  if (!payload) {
    return res.status(400).json({ error: 'Expected app data object' })
  }

  await withDb(res, async (db) => {
    const user = await requireUser(req, res, db)
    if (!user) return

    const collection = db.collection(ATTENDANCE_COLLECTION)
    const existing = await collection.findOne({ _id: String(user._id) })
    const existingData = unwrapAttendanceDoc(existing)

    // Never let an empty finance payload wipe a populated MongoDB finance doc
    // (e.g. calendar tab saving before finance finished syncing).
    if (
      isFinanceEmpty(payload.finance) &&
      !isFinanceEmpty(existingData.finance)
    ) {
      payload.finance = existingData.finance
    }

    await collection.updateOne(
      { _id: String(user._id) },
      {
        $set: { data: payload, updatedAt: new Date() },
        $unset: { settings: '' },
      },
      { upsert: true },
    )
    res.json({ ok: true, financeSaved: !isFinanceEmpty(payload.finance) })
  })
})

const MAX_WORK_NOTE_CHARS = 500
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b'

app.post('/api/work-status/elaborate', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey || apiKey.includes('YOUR_') || apiKey === 'change-me') {
    return res.status(503).json({
      error: 'Groq is not configured',
      hint: 'Set GROQ_API_KEY in .env (or Vercel env vars), then restart the API.',
    })
  }

  const note =
    typeof req.body?.note === 'string' ? req.body.note.trim() : ''

  if (!note) {
    return res.status(400).json({ error: 'Note is required' })
  }
  if (note.length > MAX_WORK_NOTE_CHARS) {
    return res.status(400).json({
      error: `Note must be at most ${MAX_WORK_NOTE_CHARS} characters`,
    })
  }

  await withDb(res, async (db) => {
    const user = await requireUser(req, res, db)
    if (!user) return

    const prompt = [
      'Rewrite the short work note into a professional daily status using EXACTLY this structure and labels:',
      '',
      'Task: <short task title derived from the note>',
      '',
      'Task Status: <In Progress | Completed | Blocked>',
      '',
      '<4–6 plain sentences describing what was done. No markdown, bullets, or extra headings.>',
      '',
      'Rules:',
      '- Output only those three parts in that order, with a blank line between them.',
      '- Infer Task and Task Status only from the note; default Task Status to In Progress if unclear.',
      '- Do not include a Reason, parenthetical explanation, or any text after Task Status.',
      '- Do not invent tools, people, tickets, or outcomes not implied by the note.',
      '- Do not mention date, office, or WFH unless the note itself says so.',
      '',
      `Note: ${note}`,
    ].join('\n')

    try {
      const groqRes = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            temperature: 0.4,
            messages: [
              {
                role: 'system',
                content:
                  'You write professional daily work status updates in a fixed Task / Task Status / description format.',
              },
              { role: 'user', content: prompt },
            ],
          }),
        },
      )

      const groqBody = await groqRes.json().catch(() => null)
      if (!groqRes.ok) {
        const detail =
          groqBody?.error?.message ||
          `Groq request failed (${groqRes.status})`
        return res.status(502).json({ error: detail })
      }

      const summary = String(
        groqBody?.choices?.[0]?.message?.content?.trim() || '',
      )

      if (!summary) {
        return res.status(502).json({
          error: 'Groq returned an empty summary',
        })
      }

      res.json({ note, summary })
    } catch (err) {
      res.status(502).json({
        error: 'Failed to reach Groq',
        detail: String(err?.message || err),
      })
    }
  })
})

// Local development only — Vercel uses the default export as a serverless function
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`)
    ensureDb()
      .then(() => console.log('MongoDB connected'))
      .catch((err) => {
        globalThis.__officeilMongoReady = false
        console.error('MongoDB not reachable yet:', describeDbError(err))
      })
  })
}

export default app
