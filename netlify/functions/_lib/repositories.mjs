// @ts-nocheck -- Runtime JavaScript repositories are exercised by focused tests.
import { getMongoDb } from './mongo.mjs'
export function courseRepository(db) { const c = db.collection('courses'); return { list: (filter = {}) => c.find(filter).sort({ createdAt: -1 }).toArray(), get: id => c.findOne({ id }), save: value => c.replaceOne({ id: value.id }, value, { upsert: true }), remove: id => c.deleteOne({ id }) } }
export function termRepository(db) { const c = db.collection('academicTerms'); return { list: () => c.find({}).sort({ startDate: 1 }).toArray(), save: value => c.replaceOne({ id: value.id }, value, { upsert: true }), remove: id => c.deleteOne({ id }) } }
export function lessonRepository(db) { const c = db.collection('lessons'); return { list: courseId => c.find({ courseId }).sort({ order: 1 }).toArray(), save: value => c.replaceOne({ id: value.id }, value, { upsert: true }) } }
export function enrollmentRepository(db) { const c = db.collection('enrollments'); return { get: (userId, courseId) => c.findOne({ userId, courseId, status: { $in: ['enrolled', 'active', 'completed'] } }), getAny: (userId, courseId) => c.findOne({ userId, courseId }), listForUser: userId => c.find({ userId, status: { $in: ['enrolled', 'active', 'completed'] } }).sort({ enrolledAt: -1 }).toArray(), listForCourse: courseId => c.find({ courseId, status: { $in: ['enrolled', 'active', 'completed'] } }).sort({ enrolledAt: -1 }).toArray(), stats: courseId => c.find({ courseId }).toArray(), enroll: value => c.insertOne(value), save: value => c.replaceOne({ id: value.id }, value, { upsert: true }) } }
export function progressRepository(db) { const c = db.collection('courseProgress'); return { get: (userId, courseId) => c.findOne({ userId, courseId }), save: value => c.replaceOne({ id: value.id }, value, { upsert: true }) } }
export function assignmentRepository(db) { const assignments = db.collection('assignments'); const submissions = db.collection('assignmentSubmissions'); return { list: courseId => assignments.find({ courseId }).sort({ dueAt: 1 }).toArray(), get: id => assignments.findOne({ id }), submission: (assignmentId, userId) => submissions.findOne({ assignmentId, userId }), submissionsForCourse: courseId => submissions.find({ courseId }).sort({ submittedAt: -1 }).toArray(), saveSubmission: value => submissions.replaceOne({ id: value.id }, value, { upsert: true }) } }
export async function importCourse(db, payload) {
  const weights = payload.gradeConfig?.weights ?? []
  if (weights.length && Math.abs(weights.reduce((sum, item) => sum + item.weight, 0) - 100) > 0.001) {
    throw Object.assign(new Error('Grading category weights must total 100.'), { statusCode: 400 })
  }

  const courses = courseRepository(db)
  await courses.save(payload.course)
  for (const lesson of payload.lessons ?? []) await lessonRepository(db).save(lesson)
  for (const quiz of payload.quizzes ?? []) await db.collection('quizzes').replaceOne({ id: quiz.id }, quiz, { upsert: true })
  for (const assignment of payload.assignments ?? []) await db.collection('assignments').replaceOne({ id: assignment.id }, assignment, { upsert: true })
  if (payload.term) await termRepository(db).save(payload.term)
  if (payload.gradeConfig) await db.collection('gradeConfigs').replaceOne({ courseId: payload.course.id }, payload.gradeConfig, { upsert: true })
  return payload.course.id
}
export { getMongoDb }
