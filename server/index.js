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

if (!MONGODB_URI || MONGODB_URI.includes('REPLACE_ME')) {
  console.error(
    'Missing MONGODB_URI. Set it in .env to your Atlas connection string (Drivers → Node.js).',
  )
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const client = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: 12000,
  connectTimeoutMS: 12000,
})

let ready = false

function describeDbError(err) {
  const message = String(err?.message || err)
  if (
    /SSL|TLS|ECONNREFUSED|ENOTFOUND|server selection|ReplicaSetNoPrimary|timed out/i.test(
      message,
    )
  ) {
    return {
      error: 'MongoDB Atlas is unreachable',
      hint: 'In Atlas → Network Access, add your current IP (or 0.0.0.0/0 for development), then retry.',
      detail: message,
    }
  }
  return { error: 'Database error', detail: message }
}

async function ensureDb() {
  if (!ready) {
    await client.connect()
    ready = true
  }
  await client.db(DB_NAME).command({ ping: 1 })
  return client.db(DB_NAME).collection(COLLECTION)
}

async function withDb(res, work) {
  try {
    const col = await ensureDb()
    return await work(col)
  } catch (err) {
    ready = false
    try {
      await client.close()
    } catch {
      // ignore close errors while recovering
    }
    console.error(err)
    const payload = describeDbError(err)
    res.status(503).json(payload)
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
        settings: doc?.settings ?? {
          profile: {
            name: '',
            email: '',
            role: '',
            goDaily: false,
            officeDaysGoal: 12,
          },
          leaves: [],
          holidays: [],
        },
      })
    }

    res.json(
      data ?? {
        attendance: {},
        settings: {
          profile: {
            name: '',
            email: '',
            role: '',
            goDaily: false,
            officeDaysGoal: 12,
          },
          leaves: [],
          holidays: [],
        },
      },
    )
  })
})

app.put('/api/attendance', async (req, res) => {
  const body = req.body
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ error: 'Expected app data object' })
  }

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

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
  ensureDb()
    .then(() => console.log('MongoDB connected'))
    .catch((err) => {
      ready = false
      console.error('MongoDB not reachable yet:', describeDbError(err))
    })
})
