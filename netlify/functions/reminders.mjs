import { getMongoDb } from './_lib/mongo.mjs'
import { formatDeadline, reminderKinds, reminderKey, sendBrevoEmail } from './_lib/reminders.mjs'

const html = (item, course, kind, timezone) => `<p>Your ${item.type} <strong>${item.title}</strong> in <strong>${course.title}</strong> is ${kind === 'overdue-1d' ? 'overdue' : 'due soon'}.</p><p>Deadline (${timezone}): ${formatDeadline(item.dueAt, timezone)}</p><p><a href="${item.link}">Open ${item.type}</a></p>`

export default async event => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed.' }) }
  const cronSecret = process.env.CRON_SECRET ?? process.env.REMINDER_CRON_SECRET
  if (!cronSecret || event.headers?.authorization !== `Bearer ${cronSecret}`) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized.' }) }
  try {
    const db = await getMongoDb(); const now = new Date(); let sent = 0
    const users = await db.collection('users').find({ email: { $type: 'string' } }).toArray()
    for (const user of users) {
      const prefs = user.preferences ?? {}; const timezone = prefs.timezone || 'UTC'; const courses = await db.collection('courses').find({ instructorId: user.id }).toArray()
      for (const course of courses) {
        const assignments = await db.collection('assignments').find({ courseId: course.id, dueAt: { $type: 'string' } }).toArray()
        const quizzes = await db.collection('quizzes').find({ courseId: course.id, dueAt: { $type: 'string' } }).toArray()
        for (const raw of [...assignments.map(x => ({ ...x, type: 'assignment', enabled: prefs.reminderAssignments !== false, link: `/courses/${course.id}/assignments/${x.id}` })), ...quizzes.map(x => ({ ...x, type: 'quiz', enabled: prefs.reminderQuizzes !== false, link: `/courses/${course.id}/learn/${x.lessonId}` }))]) {
          if (!raw.enabled) continue
          const attempts = raw.type === 'assignment' ? await db.collection('assignmentSubmissions').findOne({ assignmentId: raw.id, userId: user.id, status: { $in: ['submitted', 'returned'] } }) : await db.collection('quizAttempts').findOne({ quizId: raw.id, userId: user.id, status: { $in: ['submitted', 'graded'] } })
          for (const kind of reminderKinds(raw.dueAt, now, Boolean(attempts))) {
            if (kind === 'overdue-1d' && prefs.reminderOverdue === false) continue
            const key = reminderKey(user.id, raw.type, raw.id, kind, raw.dueAt)
            await db.collection('reminderSends').deleteOne({ key, status: 'sending', claimedAt: { $lt: new Date(now.getTime() - 30 * 60 * 1000).toISOString() } })
            try {
              await db.collection('reminderSends').insertOne({ key, userId: user.id, itemId: raw.id, itemType: raw.type, kind, deadline: raw.dueAt, status: 'sending', claimedAt: now.toISOString() })
            } catch (error) {
              if (error?.code === 11000) continue
              throw error
            }
            try {
              await sendBrevoEmail({ apiKey: process.env.BRAVO_API, to: user.email, subject: `${raw.title} reminder`, html: html(raw, course, kind, timezone) })
              await db.collection('reminderSends').updateOne({ key }, { $set: { status: 'sent', sentAt: new Date().toISOString() } })
              sent++
            } catch (error) {
              await db.collection('reminderSends').deleteOne({ key, status: 'sending' })
              throw error
            }
          }
        }
      }
    }
    return { statusCode: 200, body: JSON.stringify({ sent }) }
  } catch (error) { return { statusCode: 500, body: JSON.stringify({ error: error instanceof Error ? error.message : 'Reminder job failed' }) } }
}
