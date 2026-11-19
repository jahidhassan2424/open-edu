import { initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { HttpsError, onCall } from 'firebase-functions/v2/https'
import { gradeQuiz, type PrivateQuestion, type SubmittedAnswer } from './grading.js'

initializeApp()
const db = getFirestore()

type StoredQuiz = { id: string; courseId: string; lessonId: string; title: string; description?: string; instructions?: string; questions: Array<PrivateQuestion & { question: string; explanation?: string; options?: Array<{ id: string; text: string }> }>; timeLimit?: number; passingScore: number; maxAttempts?: number; isPublished: boolean; [key: string]: unknown }

function requireUser(uid: string | undefined): string {
  if (!uid) throw new HttpsError('unauthenticated', 'Sign-in is required.')
  return uid
}

async function requireEnrollment(uid: string, courseId: string) {
  const result = await db.collection('enrollments').where('userId', '==', uid).where('courseId', '==', courseId).where('status', 'in', ['enrolled', 'active', 'completed']).limit(1).get()
  if (result.empty) throw new HttpsError('permission-denied', 'You are not enrolled in this course.')
}
async function requireInstructor(uid: string, courseId: string) {
  const snap = await db.collection('courses').doc(courseId).get()
  const role = (await db.collection('users').doc(uid).get()).data()?.role
  if (!snap.exists || (snap.data()?.instructorId !== uid && role !== 'admin')) throw new HttpsError('permission-denied', 'Instructor access required.')
}

function learnerQuiz(quiz: StoredQuiz) {
  const { questions, ...metadata } = quiz
  return { ...metadata, questions: questions.map(({ correctAnswer: _key, acceptableAnswers: _acceptable, explanation: _explanation, options, ...question }) => ({ ...question, options: options?.map(({ id, text }) => ({ id, text })) })) }
}

export const getLearnerQuiz = onCall(async request => {
  const uid = requireUser(request.auth?.uid)
  const { courseId, lessonId } = request.data ?? {}
  if (typeof courseId !== 'string' || typeof lessonId !== 'string') throw new HttpsError('invalid-argument', 'courseId and lessonId are required.')
  await requireEnrollment(uid, courseId)
  const snapshot = await db.collection('quizzes').where('courseId', '==', courseId).where('lessonId', '==', lessonId).where('isPublished', '==', true).limit(1).get()
  if (snapshot.empty) return { quiz: null }
  return { quiz: learnerQuiz({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StoredQuiz) }
})

export const startQuizAttempt = onCall(async request => {
  const uid = requireUser(request.auth?.uid)
  const { quizId } = request.data ?? {}
  if (typeof quizId !== 'string') throw new HttpsError('invalid-argument', 'quizId is required.')
  const quizSnap = await db.collection('quizzes').doc(quizId).get()
  if (!quizSnap.exists) throw new HttpsError('not-found', 'Quiz not found.')
  const quiz = { id: quizSnap.id, ...quizSnap.data() } as StoredQuiz
  if (!quiz.isPublished) throw new HttpsError('permission-denied', 'Quiz is not published.')
  await requireEnrollment(uid, quiz.courseId)
  const previous = await db.collection('quiz-attempts').where('userId', '==', uid).where('quizId', '==', quizId).get()
  if (quiz.maxAttempts && previous.size >= quiz.maxAttempts) throw new HttpsError('failed-precondition', 'Maximum attempts reached.')
  const now = Timestamp.now()
  const ref = db.collection('quiz-attempts').doc()
  const attempt = { id: ref.id, userId: uid, quizId, courseId: quiz.courseId, lessonId: quiz.lessonId, attemptNumber: previous.size + 1, status: 'in_progress', answers: [], score: 0, pointsEarned: 0, totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0), isPassed: false, startedAt: now.toDate().toISOString(), timeSpent: 0, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }
  await ref.set(attempt)
  return { attempt }
})

export const submitQuizAttempt = onCall(async request => {
  const uid = requireUser(request.auth?.uid)
  const { attemptId, answers } = request.data ?? {}
  if (typeof attemptId !== 'string' || !Array.isArray(answers)) throw new HttpsError('invalid-argument', 'attemptId and answers are required.')
  if (!answers.every((answer: unknown) => typeof answer === 'object' && answer !== null && typeof (answer as { questionId?: unknown }).questionId === 'string')) throw new HttpsError('invalid-argument', 'Answers must contain question IDs.')
  const attemptRef = db.collection('quiz-attempts').doc(attemptId)
  const attemptSnap = await attemptRef.get()
  if (!attemptSnap.exists) throw new HttpsError('not-found', 'Attempt not found.')
  const attempt = attemptSnap.data() as { userId: string; quizId: string; status: string; startedAt: string }
  if (attempt.userId !== uid) throw new HttpsError('permission-denied', 'This attempt belongs to another user.')
  if (attempt.status !== 'in_progress') throw new HttpsError('failed-precondition', 'Attempt is already submitted.')
  const quizSnap = await db.collection('quizzes').doc(attempt.quizId).get()
  if (!quizSnap.exists) throw new HttpsError('not-found', 'Quiz not found.')
  const quiz = { id: quizSnap.id, ...quizSnap.data() } as StoredQuiz
  const elapsed = Math.max(0, Math.floor((Date.now() - new Date(attempt.startedAt).getTime()) / 1000))
  const expired = !!quiz.timeLimit && elapsed > quiz.timeLimit * 60
  const graded = gradeQuiz(quiz.questions, answers as SubmittedAnswer[])
  const responseAttempt = { id: attemptSnap.id, userId: uid, quizId: quiz.id, courseId: quiz.courseId, lessonId: quiz.lessonId, attemptNumber: (attemptSnap.data()?.attemptNumber as number), ...graded, score: Math.round(graded.score * 100) / 100, isPassed: !expired && graded.score >= quiz.passingScore, status: expired ? 'abandoned' : 'submitted', submittedAt: new Date().toISOString(), timeSpent: elapsed }
  await attemptRef.update({ ...responseAttempt, updatedAt: FieldValue.serverTimestamp() })
  return { attempt: responseAttempt }
})

type StoredAssignment = { id: string; courseId: string; title: string; instructions: string; points: number; dueAt: string; rubric?: unknown[]; moduleId?: string; isPublished: boolean; createdBy: string }

export const createAssignmentSubmission = onCall(async request => {
  const uid = requireUser(request.auth?.uid)
  const { assignmentId, text } = request.data ?? {}
  if (typeof assignmentId !== 'string' || typeof text !== 'string' || text.trim().length === 0) throw new HttpsError('invalid-argument', 'assignmentId and non-empty text are required.')
  const assignmentSnap = await db.collection('assignments').doc(assignmentId).get()
  if (!assignmentSnap.exists) throw new HttpsError('not-found', 'Assignment not found.')
  const assignment = { id: assignmentSnap.id, ...assignmentSnap.data() } as StoredAssignment
  if (!assignment.isPublished) throw new HttpsError('permission-denied', 'Assignment is not published.')
  await requireEnrollment(uid, assignment.courseId)
  const existing = await db.collection('assignmentSubmissions').where('assignmentId', '==', assignmentId).where('userId', '==', uid).limit(1).get()
  if (!existing.empty && existing.docs[0].data().status === 'submitted') throw new HttpsError('failed-precondition', 'Submitted work cannot be modified.')
  const now = new Date().toISOString(); const ref = existing.empty ? db.collection('assignmentSubmissions').doc() : existing.docs[0].ref
  const submission = { id: ref.id, assignmentId, courseId: assignment.courseId, userId: uid, text, status: 'submitted', createdAt: existing.empty ? now : existing.docs[0].data().createdAt, updatedAt: now, submittedAt: now }
  if (new Date(now).getTime() > new Date(assignment.dueAt).getTime()) throw new HttpsError('deadline-exceeded', 'The assignment deadline has passed.')
  await ref.set({ ...submission, updatedAt: FieldValue.serverTimestamp(), submittedAt: FieldValue.serverTimestamp() })
  return { submission }
})

export const gradeAssignmentSubmission = onCall(async request => {
  const graderId = requireUser(request.auth?.uid)
  const { submissionId, pointsEarned, feedback, released } = request.data ?? {}
  if (typeof submissionId !== 'string' || typeof pointsEarned !== 'number' || pointsEarned < 0 || typeof released !== 'boolean') throw new HttpsError('invalid-argument', 'Invalid grade payload.')
  const ref = db.collection('assignmentSubmissions').doc(submissionId); const snap = await ref.get()
  if (!snap.exists) throw new HttpsError('not-found', 'Submission not found.')
  const submission = snap.data() as { courseId: string; assignmentId: string; userId: string; audit?: unknown[] }
  await requireInstructor(graderId, submission.courseId)
  const assignment = await db.collection('assignments').doc(submission.assignmentId).get(); const max = Number(assignment.data()?.points ?? 0)
  if (pointsEarned > max) throw new HttpsError('invalid-argument', 'Grade exceeds assignment points.')
  const rubricScores = request.data?.rubricScores
  const criteria = (assignment.data()?.rubric ?? []) as Array<{ id: string; points: number }>
  if (rubricScores !== undefined) {
    if (!Array.isArray(rubricScores) || rubricScores.some((s: any) => typeof s?.criterionId !== 'string' || typeof s?.points !== 'number')) throw new HttpsError('invalid-argument', 'Invalid rubric scores.')
    const total = rubricScores.reduce((sum: number, s: any) => sum + s.points, 0)
    if (total !== pointsEarned || rubricScores.some((s: any) => { const c = criteria.find(x => x.id === s.criterionId); return !c || s.points < 0 || s.points > c.points })) throw new HttpsError('invalid-argument', 'Rubric scores do not match criteria totals.')
  }
  const at = new Date().toISOString(); const audit = [...(submission.audit ?? []), { at, graderId, pointsEarned, feedback, rubricScores }]
  await ref.update({ pointsEarned, feedback: typeof feedback === 'string' ? feedback : '', gradeReleased: released, status: 'returned', gradedAt: at, gradedBy: graderId, audit, updatedAt: FieldValue.serverTimestamp() })
  return { submission: { id: snap.id, pointsEarned, feedback, gradeReleased: released, gradedAt: at, gradedBy: graderId, audit } }
})

export const getLearnerGradebook = onCall(async request => {
  const uid = requireUser(request.auth?.uid); const { courseId } = request.data ?? {}
  if (typeof courseId !== 'string') throw new HttpsError('invalid-argument', 'courseId is required.')
  await requireEnrollment(uid, courseId)
  const [configSnap, quizSnap, submissionSnap] = await Promise.all([
    db.collection('gradeConfigs').doc(courseId).get(),
    db.collection('quiz-attempts').where('userId', '==', uid).where('courseId', '==', courseId).where('status', '==', 'submitted').get(),
    db.collection('assignmentSubmissions').where('userId', '==', uid).where('courseId', '==', courseId).get()
  ])
  const entries = [...quizSnap.docs.map(d => ({ id: d.id, category: 'quizzes', title: d.data().quizId, pointsEarned: d.data().pointsEarned, pointsPossible: d.data().totalPoints, status: 'graded', released: true })), ...submissionSnap.docs.map(d => ({ id: d.id, category: 'readingResponses', title: d.data().assignmentId, pointsEarned: d.data().pointsEarned, pointsPossible: 1, status: d.data().pointsEarned == null ? 'pending' : 'graded', released: d.data().gradeReleased === true }))]
  const weights = (configSnap.data()?.weights ?? []) as Array<{ category: string; weight: number }>; const graded = entries.filter(e => e.status === 'graded' && e.released); const used = graded.reduce((s, e) => s + (weights.find(w => w.category === e.category)?.weight ?? 0), 0); const average = used ? graded.reduce((s, e) => s + (e.pointsEarned / e.pointsPossible) * (weights.find(w => w.category === e.category)?.weight ?? 0), 0) / used * 100 : 0
  return { entries, average, pending: entries.filter(e => e.status !== 'graded' || !e.released).length }
})

export const finalizeLearnerGradebook = onCall(async request => {
  const graderId = requireUser(request.auth?.uid); const { courseId, userId } = request.data ?? {}; if (typeof courseId !== 'string' || typeof userId !== 'string') throw new HttpsError('invalid-argument', 'courseId and userId are required.')
  await requireInstructor(graderId, courseId)
  const callable = getLearnerGradebook as any; void callable
  const config = (await db.collection('gradeConfigs').doc(courseId).get()).data() ?? {}; const submissions = await db.collection('assignmentSubmissions').where('userId', '==', userId).where('courseId', '==', courseId).get(); const quizzes = await db.collection('quiz-attempts').where('userId', '==', userId).where('courseId', '==', courseId).where('status', '==', 'submitted').get(); const all = [...submissions.docs.filter(d => d.data().gradeReleased).map(d => ({ p: d.data().pointsEarned ?? 0, m: 1, c: 'readingResponses' })), ...quizzes.docs.map(d => ({ p: d.data().pointsEarned ?? 0, m: d.data().totalPoints ?? 1, c: 'quizzes' }))]; const used = all.reduce((s, e) => s + ((config.weights ?? []).find((w: any) => w.category === e.c)?.weight ?? 0), 0); const percentage = used ? all.reduce((s, e) => s + e.p / e.m * ((config.weights ?? []).find((w: any) => w.category === e.c)?.weight ?? 0), 0) / used * 100 : 0; const letter = [...(config.letterScale ?? [])].sort((a: any, b: any) => b.min - a.min).find((s: any) => percentage >= s.min)?.letter ?? 'F'; const result = { userId, courseId, percentage, letter, status: 'completed', calculatedAt: new Date().toISOString() }; await db.collection('finalResults').doc(`${userId}_${courseId}`).set(result); return { result }
})
