import { httpsCallable } from 'firebase/functions'
import { functions } from '$lib/firebase'
import type { LearnerQuiz, QuizAnswer, QuizAttempt } from '$lib/types/quiz'
import { mongoProvider } from './mongo-provider'

interface LearnerQuizResponse { quiz: LearnerQuiz | null }
interface SubmitQuizResponse { attempt: QuizAttempt }

/** Fetches a learner-safe projection. Full quiz documents are instructor-only. */
export async function getLearnerQuiz(courseId: string, lessonId: string): Promise<LearnerQuiz | null> {
	if (mongoProvider.enabled()) return mongoProvider.getQuiz(lessonId)
	const call = httpsCallable<{ courseId: string; lessonId: string }, LearnerQuizResponse>(functions, 'getLearnerQuiz')
	return (await call({ courseId, lessonId })).data.quiz
}

/** Scores, status, user IDs, and timing are server-authoritative. */
export async function startLearnerQuizAttempt(quizId: string): Promise<QuizAttempt> {
	if (mongoProvider.enabled()) return mongoProvider.startQuiz(quizId)
	const call = httpsCallable<{ quizId: string }, { attempt: QuizAttempt }>(functions, 'startQuizAttempt')
	return (await call({ quizId })).data.attempt
}

export async function submitLearnerQuiz(
	attemptId: string,
	answers: Pick<QuizAnswer, 'questionId' | 'answer'>[]
): Promise<QuizAttempt> {
	if (mongoProvider.enabled()) return mongoProvider.submitQuiz(attemptId, answers)
	const call = httpsCallable<{ attemptId: string; answers: Pick<QuizAnswer, 'questionId' | 'answer'>[] }, SubmitQuizResponse>(functions, 'submitQuizAttempt')
	return (await call({ attemptId, answers })).data.attempt
}
