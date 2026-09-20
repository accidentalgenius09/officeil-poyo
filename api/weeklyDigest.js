const DEFAULT_GOAL = 12
const DEFAULT_TIMEZONE = 'Asia/Kolkata'

function pad(n) {
  return String(n).padStart(2, '0')
}

function toDateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

function isWeekday(year, month, day) {
  const dow = new Date(Date.UTC(year, month, day)).getUTCDay()
  return dow !== 0 && dow !== 6
}

function parseDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(key || ''))
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (day < 1 || day > daysInMonth(year, month)) return null
  return { year, month, day }
}

function eachDateKeyInRange(start, end) {
  const from = parseDateKey(start)
  const to = parseDateKey(end)
  if (!from || !to) return []
  const startUtc = Date.UTC(from.year, from.month, from.day)
  const endUtc = Date.UTC(to.year, to.month, to.day)
  if (startUtc > endUtc) return []
  const keys = []
  for (let cursor = startUtc; cursor <= endUtc; cursor += 86400000) {
    const date = new Date(cursor)
    keys.push(
      toDateKey(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    )
  }
  return keys
}

function holidayKeyForYear(holiday, year) {
  if (!holiday?.date) return ''
  if (!holiday.recurring) return holiday.date
  return `${year}-${String(holiday.date).slice(5)}`
}

function blockedDateKeys(settings, year) {
  const blocked = new Set()
  const holidays = Array.isArray(settings?.holidays) ? settings.holidays : []
  for (const holiday of holidays) {
    const key = holidayKeyForYear(holiday, year)
    if (key) blocked.add(key)
  }
  const leaves = Array.isArray(settings?.leaves) ? settings.leaves : []
  for (const leave of leaves) {
    if (leave?.portion !== 'full') continue
    for (const key of eachDateKeyInRange(leave.start, leave.end)) {
      blocked.add(key)
    }
  }
  return blocked
}

function monthStorageKey(year, month) {
  return `${year}-${pad(month + 1)}`
}

function getDayStatus(days, key) {
  const value = days?.[key]
  if (value == null) return null
  if (value === 'office' || value === 'wfh') return value
  if (typeof value === 'object') {
    return value.status === 'office' || value.status === 'wfh'
      ? value.status
      : null
  }
  return null
}

function countWorkingDays(year, month, settings, startDay, endDay) {
  const blocked = blockedDateKeys(settings, year)
  let count = 0
  for (let day = startDay; day <= endDay; day++) {
    if (!isWeekday(year, month, day)) continue
    if (blocked.has(toDateKey(year, month, day))) continue
    count += 1
  }
  return count
}

function plural(count, singular) {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

/** Same wording as the in-app Monday toast. */
export function buildWeeklyDigestMessage(daysLeft, remaining, canHitGoal) {
  const working =
    remaining === 0
      ? 'no working days remaining'
      : `${plural(remaining, 'working day')} remaining`

  if (daysLeft === 0) {
    return `This week: goal met — ${working}.`
  }
  const office = `${plural(daysLeft, 'office day')} left`
  if (!canHitGoal) {
    return `This week: ${office}, ${working} — goal is out of reach.`
  }
  if (daysLeft === remaining) {
    return `This week: ${office}, ${working}. Office every remaining day.`
  }
  return `This week: ${office}, ${working}.`
}

export function digestTimezone() {
  return process.env.DIGEST_TIMEZONE || DEFAULT_TIMEZONE
}

export function zonedToday(now = new Date(), timeZone = digestTimezone()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((part) => [part.type, part.value]),
  )
  const year = Number(parts.year)
  const month = Number(parts.month) - 1
  const day = Number(parts.day)
  const weekday = parts.weekday
  const weekdayIndex = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday)
  const mondayDelta = weekday === 'Sun' ? 6 : Math.max(0, weekdayIndex)
  const mondayUtc = Date.UTC(year, month, day) - mondayDelta * 86400000
  const monday = new Date(mondayUtc)
  return {
    year,
    month,
    day,
    weekday,
    isMonday: weekday === 'Mon',
    weekKey: toDateKey(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
    ),
    dateKey: toDateKey(year, month, day),
  }
}

export function computeWeeklyDigest(data, today = zonedToday()) {
  const settings = data?.settings || {}
  const profile = settings.profile || {}
  const attendance = data?.attendance || {}
  const monthAtt = attendance[monthStorageKey(today.year, today.month)] || {}
  const days = monthAtt.days || {}
  const total = daysInMonth(today.year, today.month)

  let daysInOffice = 0
  for (let day = 1; day <= total; day++) {
    if (getDayStatus(days, toDateKey(today.year, today.month, day)) === 'office') {
      daysInOffice += 1
    }
  }

  const workingDaysInMonth = countWorkingDays(
    today.year,
    today.month,
    settings,
    1,
    total,
  )
  const goal = profile.goDaily
    ? Math.max(1, workingDaysInMonth)
    : Number(profile.officeDaysGoal) || DEFAULT_GOAL
  const daysLeft = Math.max(0, goal - daysInOffice)
  const remaining = countWorkingDays(
    today.year,
    today.month,
    settings,
    today.day,
    total,
  )
  const canHitGoal = daysLeft <= remaining

  return {
    daysInOffice,
    goal,
    daysLeft,
    remaining,
    canHitGoal,
    message: buildWeeklyDigestMessage(daysLeft, remaining, canHitGoal),
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function appUrl() {
  const configured = String(process.env.APP_URL || '').trim()
  if (configured) return configured.replace(/\/$/, '')
  const production = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || '').trim()
  if (production) return `https://${production.replace(/^https?:\/\//, '')}`
  // Public production app (used when APP_URL is unset locally).
  return 'https://officeil-poyo.vercel.app'
}

function parseDigestFrom(raw) {
  const value = String(raw || '').trim()
  const named = /^(.+?)\s*<([^>]+)>$/.exec(value)
  if (named) {
    return {
      name: named[1].trim().replace(/^["']|["']$/g, ''),
      email: named[2].trim(),
    }
  }
  return { name: 'Officeil Poyo', email: value }
}

function mailConfigError() {
  if (!process.env.BREVO_API_KEY) {
    return 'Set BREVO_API_KEY to send digest mail'
  }
  if (!process.env.DIGEST_FROM) {
    return 'Set DIGEST_FROM (for example Officeil Poyo <you@gmail.com>)'
  }
  const from = parseDigestFrom(process.env.DIGEST_FROM)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from.email)) {
    return 'DIGEST_FROM must include a valid email address'
  }
  return null
}

function digestSubject(digest) {
  if (digest.daysLeft === 0) return 'Week check-in — goal met'
  const label = plural(digest.daysLeft, 'office day')
  return `Week check-in — ${label} left`
}

function digestBodies(name, digest, url) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const pace = `${digest.daysInOffice} office day${digest.daysInOffice === 1 ? '' : 's'} so far (goal ${digest.goal}).`
  const progress =
    digest.goal > 0
      ? Math.min(100, Math.round((digest.daysInOffice / digest.goal) * 100))
      : 0
  const statusLabel =
    digest.daysLeft === 0
      ? 'Goal met'
      : !digest.canHitGoal
        ? 'Out of reach'
        : digest.daysLeft === digest.remaining
          ? 'On the edge'
          : 'On pace'

  const text = [
    'Officeil Poyo?',
    'Monday week check-in',
    '',
    greeting,
    '',
    digest.message,
    pace,
    `Status: ${statusLabel}`,
    `Office days left: ${digest.daysLeft}`,
    `Working days remaining: ${digest.remaining}`,
    url ? `Open Officeil Poyo: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  // App light theme tokens (inline hex only — email clients ignore CSS variables / rgba).
  // --bg-top #dfe8e4 · --surface-solid #f7faf8 · --ink #142a24 · --ink-soft #4a635a
  // --brand #1b4d3e · --brand-deep #12362c · --accent #b8892d · --on-brand #f4faf7 · --muted-fill #d5e0db
  // Use border-collapse:separate so border-radius actually curves the border (collapse makes corners square).
  const roundBox =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:14px;border-radius:14px;'
  const roundCard =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:18px;border-radius:18px;'
  const roundBtn =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:12px;border-radius:12px;'
  const roundBar =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:999px;border-radius:999px;'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Week check-in</title>
</head>
<body style="margin:0;padding:0;background-color:#dfe8e4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(digest.message)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dfe8e4" style="background-color:#dfe8e4;width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;border-collapse:collapse;">
          <tr>
            <td align="left" style="padding:0 4px 16px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:700;color:#12362c;">
                Officeil Poyo?
              </p>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;font-weight:500;color:#4a635a;">
                Monday week check-in
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7faf8" style="width:100%;background-color:#f7faf8;border:1px solid #b8c9c2;${roundCard}">
                <tr>
                  <td style="padding:20px 20px 4px;font-family:Arial,Helvetica,sans-serif;color:#142a24;">
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.45;">${escapeHtml(greeting)}</p>
                    <p style="margin:0 0 16px;font-size:17px;line-height:1.45;font-weight:700;color:#12362c;">
                      ${escapeHtml(digest.message)}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 10px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef4f1" style="width:100%;background-color:#eef4f1;border:1px solid #c5d2ce;${roundBox}">
                      <tr>
                        <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;-webkit-border-radius:14px;border-radius:14px;">
                          <p style="margin:0;font-size:11px;line-height:1.3;letter-spacing:0.04em;text-transform:uppercase;color:#4a635a;">Office days left</p>
                          <p style="margin:6px 0 0;font-size:28px;line-height:1;font-weight:700;color:#1b4d3e;">${digest.daysLeft}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef4f1" style="width:100%;background-color:#eef4f1;border:1px solid #c5d2ce;${roundBox}">
                      <tr>
                        <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;-webkit-border-radius:14px;border-radius:14px;">
                          <p style="margin:0;font-size:11px;line-height:1.3;letter-spacing:0.04em;text-transform:uppercase;color:#4a635a;">Working days remaining</p>
                          <p style="margin:6px 0 0;font-size:28px;line-height:1;font-weight:700;color:#1b4d3e;">${digest.remaining}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 20px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px;font-size:14px;line-height:1.4;color:#4a635a;">${escapeHtml(pace)}</p>
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.4;color:#4a635a;">
                      Goal progress · <span style="color:#b8892d;font-weight:700;">${escapeHtml(statusLabel)}</span>
                    </p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#d5e0db" style="width:100%;background-color:#d5e0db;${roundBar}">
                      <tr>
                        <td width="${Math.max(progress, 0)}%" bgcolor="#1b4d3e" style="background-color:#1b4d3e;height:8px;font-size:0;line-height:0;">&nbsp;</td>
                        <td width="${Math.max(100 - progress, 0)}%" bgcolor="#d5e0db" style="background-color:#d5e0db;height:8px;font-size:0;line-height:0;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                ${
                  url
                    ? `<tr>
                  <td align="center" style="padding:18px 20px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1b4d3e" style="width:100%;background-color:#1b4d3e;${roundBtn}">
                      <tr>
                        <td align="center" bgcolor="#1b4d3e" style="background-color:#1b4d3e;-webkit-border-radius:12px;border-radius:12px;">
                          <a href="${escapeHtml(url)}" style="display:block;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.3;font-weight:700;color:#f4faf7;text-decoration:none;text-align:center;-webkit-border-radius:12px;border-radius:12px;">
                            Open Officeil Poyo
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#4a635a;text-align:center;">
                    <a href="${escapeHtml(url)}" style="color:#1b4d3e;word-break:break-all;">${escapeHtml(url)}</a>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:8px 20px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#4a635a;">
                    Turn off Monday email under Settings → Account → Email Monday check-in.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { text, html }
}

async function sendBrevoMail({ to, name, subject, text, html }) {
  const from = parseDigestFrom(process.env.DIGEST_FROM)
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: from.name, email: from.email },
      to: [{ email: to, ...(name ? { name } : {}) }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    const detail =
      body?.message ||
      (Array.isArray(body?.message) ? body.message.join(', ') : null) ||
      body?.error ||
      `Brevo failed (${response.status})`
    throw new Error(
      typeof detail === 'string' ? `Brevo: ${detail}` : 'Brevo request failed',
    )
  }
  return body?.messageId || null
}

export { mailConfigError }

/** Send a sample Monday check-in (or holiday-eve) mail to an arbitrary address. */
export async function sendSampleDemoEmail({
  to,
  name = 'Demo Guest',
  kind = 'weekly',
}) {
  const configError = mailConfigError()
  if (configError) throw new Error(configError)

  const email = String(to || '')
    .trim()
    .toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid email address')
  }

  if (kind === 'holiday-eve') {
    const today = zonedToday()
    const holidayDateKey = nextDateKey(today.dateKey)
    if (!holidayDateKey) throw new Error('Could not resolve tomorrow’s date')
    const holidays = [{ name: 'Demo holiday', dateKey: holidayDateKey }]
    const { text, html } = holidayEveBodies(
      name,
      holidays,
      holidayDateKey,
      appUrl(),
    )
    return sendBrevoMail({
      to: email,
      name,
      subject: `Holiday tomorrow — ${holidays[0].name} (demo)`,
      text,
      html,
    })
  }

  const digest = {
    daysLeft: 4,
    remaining: 8,
    canHitGoal: true,
    daysInOffice: 8,
    goal: 12,
    message: buildWeeklyDigestMessage(4, 8, true),
  }
  return sendDigestEmail({ to: email, name, digest })
}

async function sendDigestEmail({ to, name, digest }) {
  const url = appUrl()
  const { text, html } = digestBodies(name, digest, url)
  return sendBrevoMail({
    to,
    name,
    subject: digestSubject(digest),
    text,
    html,
  })
}

function nextDateKey(dateKey) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return null
  const next = new Date(Date.UTC(parsed.year, parsed.month, parsed.day) + 86400000)
  return toDateKey(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate())
}

function formatHolidayLabel(dateKey) {
  const parsed = parseDateKey(dateKey)
  if (!parsed) return dateKey
  const utc = new Date(Date.UTC(parsed.year, parsed.month, parsed.day, 12))
  return utc.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/** Holidays that fall on `dateKey` for this user's calendar settings. */
export function holidaysOnDate(settings, dateKey) {
  const year = Number(String(dateKey || '').slice(0, 4))
  if (!Number.isFinite(year)) return []
  const holidays = Array.isArray(settings?.holidays) ? settings.holidays : []
  const matches = []
  const seen = new Set()
  for (const holiday of holidays) {
    const key = holidayKeyForYear(holiday, year)
    if (key !== dateKey) continue
    const name = String(holiday.name || 'Holiday').trim() || 'Holiday'
    const stamp = `${key}:${name.toLowerCase()}`
    if (seen.has(stamp)) continue
    seen.add(stamp)
    matches.push({
      name,
      date: key,
      recurring: Boolean(holiday.recurring),
    })
  }
  return matches
}

function holidayEveBodies(name, holidays, holidayDateKey, url) {
  const greeting = name ? `Hi ${name},` : 'Hi,'
  const label = formatHolidayLabel(holidayDateKey)
  const names = holidays.map((h) => h.name)
  const title =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
  const message = `Tomorrow is a holiday — ${title}.`
  const detail = `${label} will not count as a working day on your calendar.`

  const text = [
    'Officeil Poyo?',
    'Holiday tomorrow',
    '',
    greeting,
    '',
    message,
    detail,
    url ? `Open Officeil Poyo: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const roundBox =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:14px;border-radius:14px;'
  const roundCard =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:18px;border-radius:18px;'
  const roundBtn =
    'border-collapse:separate;border-spacing:0;overflow:hidden;-webkit-border-radius:12px;border-radius:12px;'

  const holidayRows = holidays
    .map(
      (h) => `<tr>
                  <td style="padding:0 20px 10px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#eef4f1" style="width:100%;background-color:#eef4f1;border:1px solid #c5d2ce;${roundBox}">
                      <tr>
                        <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;-webkit-border-radius:14px;border-radius:14px;">
                          <p style="margin:0;font-size:11px;line-height:1.3;letter-spacing:0.04em;text-transform:uppercase;color:#4a635a;">Holiday</p>
                          <p style="margin:6px 0 0;font-size:20px;line-height:1.25;font-weight:700;color:#1b4d3e;">${escapeHtml(h.name)}</p>
                          <p style="margin:6px 0 0;font-size:13px;line-height:1.4;color:#4a635a;">${escapeHtml(label)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>Holiday tomorrow</title>
</head>
<body style="margin:0;padding:0;background-color:#dfe8e4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(message)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#dfe8e4" style="background-color:#dfe8e4;width:100%;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:480px;border-collapse:collapse;">
          <tr>
            <td align="left" style="padding:0 4px 16px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:700;color:#12362c;">
                Officeil Poyo?
              </p>
              <p style="margin:8px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;font-weight:500;color:#4a635a;">
                Holiday tomorrow
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7faf8" style="width:100%;background-color:#f7faf8;border:1px solid #b8c9c2;${roundCard}">
                <tr>
                  <td style="padding:20px 20px 4px;font-family:Arial,Helvetica,sans-serif;color:#142a24;">
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.45;">${escapeHtml(greeting)}</p>
                    <p style="margin:0 0 16px;font-size:17px;line-height:1.45;font-weight:700;color:#12362c;">
                      ${escapeHtml(message)}
                    </p>
                    <p style="margin:0 0 8px;font-size:14px;line-height:1.45;color:#4a635a;">
                      ${escapeHtml(detail)}
                    </p>
                  </td>
                </tr>
                ${holidayRows}
                ${
                  url
                    ? `<tr>
                  <td align="center" style="padding:10px 20px 8px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#1b4d3e" style="width:100%;background-color:#1b4d3e;${roundBtn}">
                      <tr>
                        <td align="center" bgcolor="#1b4d3e" style="background-color:#1b4d3e;-webkit-border-radius:12px;border-radius:12px;">
                          <a href="${escapeHtml(url)}" style="display:block;padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.3;font-weight:700;color:#f4faf7;text-decoration:none;text-align:center;-webkit-border-radius:12px;border-radius:12px;">
                            Open Officeil Poyo
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:4px 20px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#4a635a;text-align:center;">
                    <a href="${escapeHtml(url)}" style="color:#1b4d3e;word-break:break-all;">${escapeHtml(url)}</a>
                  </td>
                </tr>`
                    : ''
                }
                <tr>
                  <td style="padding:8px 20px 18px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.4;color:#4a635a;">
                    Turn off holiday-eve email under Settings → Account → Email holiday reminder.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return {
    text,
    html,
    subject:
      names.length === 1
        ? `Holiday tomorrow — ${names[0]}`
        : `Holiday tomorrow — ${names.length} holidays`,
  }
}

/**
 * Email at ~18:00 India time when tomorrow is a holiday on the user's calendar.
 * `force` skips the already-sent guard. Optional `asOf` (YYYY-MM-DD) treats that
 * calendar day as "today" for local testing.
 */
export async function runHolidayEveReminders(db, options = {}) {
  const configError = mailConfigError()
  if (configError) {
    return { ok: false, error: configError }
  }

  const today = options.asOf
    ? (() => {
        const parsed = parseDateKey(options.asOf)
        if (!parsed) return zonedToday()
        const dateKey = toDateKey(parsed.year, parsed.month, parsed.day)
        const dow = new Date(Date.UTC(parsed.year, parsed.month, parsed.day)).getUTCDay()
        const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        return {
          year: parsed.year,
          month: parsed.month,
          day: parsed.day,
          weekday: names[dow],
          isMonday: dow === 1,
          weekKey: dateKey,
          dateKey,
        }
      })()
    : zonedToday()

  const holidayDateKey = nextDateKey(today.dateKey)
  if (!holidayDateKey) {
    return { ok: false, error: 'Could not resolve tomorrow’s date' }
  }

  const users = await db.collection('users').find({}).toArray()
  const attendance = db.collection('attendance')
  const sent = []
  const skipped = []
  const failed = []

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ email: email || String(user._id), reason: 'invalid-email' })
      continue
    }
    if (user.holidayEveEmailFor === holidayDateKey && !options.force) {
      skipped.push({ email, reason: 'already-sent' })
      continue
    }

    const doc = await attendance.findOne({ _id: String(user._id) })
    const data = options.unwrap(doc)
    if (data?.settings?.profile?.holidayEveEmail === false) {
      skipped.push({ email, reason: 'opted-out' })
      continue
    }

    const holidays = holidaysOnDate(data?.settings, holidayDateKey)
    if (holidays.length === 0) {
      skipped.push({ email, reason: 'no-holiday-tomorrow' })
      continue
    }

    const name = String(user.name || data?.settings?.profile?.name || '').trim()
    const url = appUrl()
    const mail = holidayEveBodies(name, holidays, holidayDateKey, url)
    try {
      const id = await sendBrevoMail({
        to: email,
        name,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
      })
      // Skip marking on forced tests so the real 6pm cron can still send once.
      if (!options.force) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { holidayEveEmailFor: holidayDateKey } },
        )
      }
      sent.push({
        email,
        id,
        holiday: holidayDateKey,
        names: holidays.map((h) => h.name),
      })
    } catch (err) {
      failed.push({
        email,
        error: String(err?.message || err),
      })
    }
  }

  return {
    ok: failed.length === 0,
    timezone: digestTimezone(),
    today: today.dateKey,
    holiday: holidayDateKey,
    sent: sent.length,
    skipped: skipped.length,
    failed,
    preview: Boolean(options.force),
  }
}

/**
 * Email the Monday week check-in to each account that has not opted out.
 * `force` sends even when today is not Monday, and does not mark the week sent
 * unless it really is Monday (so a test mail does not skip the real Monday).
 */
export async function runWeeklyDigest(db, options = {}) {
  const configError = mailConfigError()
  if (configError) {
    return { ok: false, error: configError }
  }

  const today = zonedToday()
  if (!today.isMonday && !options.force) {
    return {
      ok: true,
      skipped: true,
      reason: 'not-monday',
      timezone: digestTimezone(),
      date: today.dateKey,
    }
  }

  const users = await db.collection('users').find({}).toArray()
  const attendance = db.collection('attendance')
  const sent = []
  const skipped = []
  const failed = []

  for (const user of users) {
    const email = String(user.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skipped.push({ email: email || String(user._id), reason: 'invalid-email' })
      continue
    }
    if (user.digestEmailWeek === today.weekKey && !options.force) {
      skipped.push({ email, reason: 'already-sent' })
      continue
    }

    const doc = await attendance.findOne({ _id: String(user._id) })
    const data = options.unwrap(doc)
    if (data?.settings?.profile?.weeklyDigestEmail === false) {
      skipped.push({ email, reason: 'opted-out' })
      continue
    }

    const digest = computeWeeklyDigest(data, today)
    const name = String(user.name || data?.settings?.profile?.name || '').trim()
    try {
      const id = await sendDigestEmail({
        to: email,
        name,
        digest,
      })
      if (today.isMonday) {
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { digestEmailWeek: today.weekKey } },
        )
      }
      sent.push({ email, id })
    } catch (err) {
      failed.push({
        email,
        error: String(err?.message || err),
      })
    }
  }

  return {
    ok: failed.length === 0,
    timezone: digestTimezone(),
    week: today.weekKey,
    date: today.dateKey,
    sent: sent.length,
    skipped: skipped.length,
    failed,
    preview: options.force && !today.isMonday,
  }
}
