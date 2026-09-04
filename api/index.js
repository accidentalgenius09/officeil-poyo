import 'dotenv/config'
import dns from 'dns'
import cors from 'cors'
import express from 'express'
import { MongoClient } from 'mongodb'

// Windows/router DNS often fails Node's SRV lookup for mongodb+srv://
dns.setServers(['8.8.8.8', '1.1.1.1'])

const PORT = Number(process.env.PORT) || 3001
const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB || 'office-visit-calendar'
const COLLECTION = 'attendance'
const DOC_ID = 'default'
const isVercel = Boolean(process.env.VERCEL)

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
}

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
  return client.db(DB_NAME).collection(COLLECTION)
}

async function withDb(res, work) {
  try {
    const col = await ensureDb()
    return await work(col)
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

app.get('/api/health', async (_req, res) => {
  await withDb(res, async () => {
    res.json({ ok: true })
  })
})

app.get('/api/attendance', async (_req, res) => {
  await withDb(res, async (col) => {
    const doc = await col.findOne({ _id: DOC_ID })
    const data = doc?.data

    // Legacy: data was the attendance map directly
    if (
      data &&
      typeof data === 'object' &&
      !('attendance' in data) &&
      !('settings' in data)
    ) {
      return res.json({
        attendance: data,
        settings: doc?.settings ?? emptySettings,
      })
    }

    res.json(
      data ?? {
        attendance: {},
        settings: emptySettings,
      },
    )
  })
})

app.put('/api/attendance', async (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected app data object' })
  }

  let payload = body
  if (!('attendance' in body) && !('settings' in body)) {
    payload = {
      attendance: body,
      settings: emptySettings,
    }
  } else {
    payload = {
      attendance:
        body.attendance && typeof body.attendance === 'object'
          ? body.attendance
          : {},
      settings:
        body.settings && typeof body.settings === 'object'
          ? body.settings
          : emptySettings,
    }
  }

  await withDb(res, async (col) => {
    await col.updateOne(
      { _id: DOC_ID },
      { $set: { data: payload, updatedAt: new Date() }, $unset: { settings: '' } },
      { upsert: true },
    )
    res.json({ ok: true })
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
