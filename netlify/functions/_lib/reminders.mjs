// @ts-nocheck -- shared Netlify runtime helper
const DAY = 24 * 60 * 60 * 1000

export function reminderKinds(deadline, now = new Date(), completed = false) {
  if (completed) return []
  const due = new Date(deadline).getTime()
  if (!Number.isFinite(due)) return []
  const days = Math.round((due - now.getTime()) / DAY)
  if (days === 3) return ['assignment-3d']
  if (days === 1) return ['deadline-1d']
  if (days === -1) return ['overdue-1d']
  return []
}

export function reminderKey(userId, itemType, itemId, kind, deadline) {
  return `${userId}:${itemType}:${itemId}:${kind}:${new Date(deadline).toISOString()}`
}

export function formatDeadline(deadline, timezone = 'UTC') {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(deadline))
}

export async function sendBrevoEmail({ apiKey, to, subject, html }) {
  if (!apiKey) throw new Error('BRAVO_API is required for reminders')
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { accept: 'application/json', 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ sender: { name: process.env.BREVO_SENDER_NAME ?? 'Open-EDU', email: process.env.BREVO_SENDER_EMAIL ?? 'no-reply@open-edu.app' }, to: [{ email: to }], subject, htmlContent: html })
  })
  if (!response.ok) throw new Error(`Brevo request failed (${response.status})`)
  return response.json()
}
