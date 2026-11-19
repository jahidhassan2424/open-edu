import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = 'demo-open-edu'
if (!getApps().length) initializeApp({ projectId })
const auth = getAuth()
const db = getFirestore()

async function user(email, role) {
  const record = await auth.createUser({ email, password: 'Password-123!', displayName: role })
  await auth.setCustomUserClaims(record.uid, { role })
  return record
}

async function token(email) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-api-key', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password-123!', returnSecureToken: true })
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Auth sign-in failed: ${JSON.stringify(body)}`)
  return body.idToken
}

async function callable(name, data, idToken) {
  const headers = { 'content-type': 'application/json' }
  if (idToken) headers.authorization = `Bearer ${idToken}`
  const response = await fetch(`http://127.0.0.1:5001/${projectId}/us-central1/${name}`, {
    method: 'POST', headers, body: JSON.stringify({ data })
  })
  const body = await response.json()
  return { response, body: body.result ?? body }
}

function assert(condition, message) { if (!condition) throw new Error(message) }
function assertError(result, code) { assert(!result.response.ok && result.body.error?.status === code, `Expected ${code}: ${JSON.stringify(result.body)}`) }

const run = Date.now()
const adminEmail = `admin-${run}@demo-open-edu.test`
const studentEmail = `student-${run}@demo-open-edu.test`
const otherEmail = `other-${run}@demo-open-edu.test`
const admin = await user(adminEmail, 'admin')
const student = await user(studentEmail, 'student')
const other = await user(otherEmail, 'student')
const studentToken = await token(studentEmail)
const otherToken = await token(otherEmail)

const courseId = 'course-e2e'
const quizId = 'quiz-e2e'
await db.collection('courses').doc(courseId).set({ id: courseId, title: 'Emulator Security Course', instructorId: admin.uid, isPublished: true })
await db.collection('enrollments').doc(`${student.uid}_${courseId}`).set({ id: `${student.uid}_${courseId}`, userId: student.uid, courseId, status: 'active' })
await db.collection('quizzes').doc(quizId).set({
  id: quizId, courseId, lessonId: 'lesson-e2e', title: 'Weighted Security Quiz', isPublished: true,
  passingScore: 50, maxAttempts: 2,
  questions: [
    { id: 'low', type: 'multiple_choice', question: 'Low weight', options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'x', text: 'X', isCorrect: false }], correctAnswer: 'a', points: 1 },
    { id: 'high', type: 'multiple_choice', question: 'High weight', options: [{ id: 'b', text: 'B', isCorrect: true }, { id: 'y', text: 'Y', isCorrect: false }], correctAnswer: 'b', points: 9 }
  ]
})

const unauthenticated = await callable('getLearnerQuiz', { courseId, lessonId: 'lesson-e2e' })
assertError(unauthenticated, 'UNAUTHENTICATED')

const safe = await callable('getLearnerQuiz', { courseId, lessonId: 'lesson-e2e' }, studentToken)
assert(safe.response.ok, `Learner quiz retrieval failed: ${JSON.stringify(safe.body)}`)
const learnerQuiz = safe.body.quiz
assert(learnerQuiz && learnerQuiz.questions.length === 2, 'Learner quiz payload missing')
assert(!('correctAnswer' in learnerQuiz.questions[0]), 'Answer key exposed in learner quiz')
assert(!('isCorrect' in learnerQuiz.questions[0].options[0]), 'Option answer flag exposed in learner quiz')

const unauthorized = await callable('getLearnerQuiz', { courseId, lessonId: 'lesson-e2e' }, otherToken)
assertError(unauthorized, 'PERMISSION_DENIED')

const attemptResult = await callable('startQuizAttempt', { quizId }, studentToken)
assert(attemptResult.response.ok, `Attempt creation failed: ${JSON.stringify(attemptResult.body)}`)
const attemptId = attemptResult.body.attempt.id

const tampered = await callable('submitQuizAttempt', {
  attemptId,
  answers: [
    { questionId: 'low', answer: 'x', isCorrect: true, pointsEarned: 999 },
    { questionId: 'high', answer: 'b', isCorrect: false, pointsEarned: 0 }
  ]
}, studentToken)
assert(tampered.response.ok, `Submission failed: ${JSON.stringify(tampered.body)}`)
const result = tampered.body.attempt
assert(result.score === 90 && result.pointsEarned === 9 && result.isPassed === true, `Weighted scoring incorrect: ${JSON.stringify(result)}`)
assert(result.answers[0].isCorrect === false && result.answers[0].pointsEarned === 0, 'Caller score tampering was trusted')

const wrongOwner = await callable('submitQuizAttempt', { attemptId, answers: [] }, otherToken)
assertError(wrongOwner, 'PERMISSION_DENIED')

const directQuizRead = await fetch(`http://127.0.0.1:8080/v1/projects/${projectId}/databases/(default)/documents/quizzes/${quizId}`, { headers: { authorization: `Bearer ${studentToken}` } })
assert(directQuizRead.status === 403, `Direct answer-key read was not denied: ${directQuizRead.status}`)

const persisted = await db.collection('quiz-attempts').doc(attemptId).get()
const stored = persisted.data()
assert(stored.score === 90 && stored.pointsEarned === 9 && stored.status === 'submitted', 'Persisted grade is incorrect')
console.log(JSON.stringify({ unauthenticated: 'PASS', safeQuiz: 'PASS', unauthorized: 'PASS', weightedScoring: 'PASS', persistedGrade: 'PASS', directAnswerKeyRead: 'PASS' }))
