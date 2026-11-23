import { describe, expect, it, vi } from 'vitest'

const provider = vi.hoisted(() => ({
  enabled: vi.fn(() => true), getManagedQuiz: vi.fn().mockResolvedValue(null), getManagedQuizzes: vi.fn().mockResolvedValue([]),
  createQuiz: vi.fn().mockResolvedValue({ id: 'quiz-1' }), updateQuiz: vi.fn().mockResolvedValue(undefined), deleteQuiz: vi.fn().mockResolvedValue(undefined), publishQuiz: vi.fn().mockResolvedValue(undefined), batchUpdateQuizzes: vi.fn().mockResolvedValue(undefined),
  getMyQuizAttempts: vi.fn().mockResolvedValue([]), getQuizAttempt: vi.fn().mockResolvedValue(null), getCourseQuizAttempts: vi.fn().mockResolvedValue([]), getQuizStatistics: vi.fn().mockResolvedValue({ quizId: 'quiz-1' }), getQuizzesByLesson: vi.fn().mockResolvedValue([])
}))

vi.mock('$lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), addDoc: vi.fn(), updateDoc: vi.fn(), deleteDoc: vi.fn(), query: vi.fn(), where: vi.fn(), orderBy: vi.fn(), serverTimestamp: vi.fn(), arrayUnion: vi.fn(), increment: vi.fn(), writeBatch: vi.fn() }))
vi.mock('./mongo-provider', () => ({ mongoProvider: provider }))

const quiz = await import('./quiz')

describe('Quiz service MongoDB routing', () => {
  it('routes admin CRUD, reports, and learner-owned attempt history without Firestore access', async () => {
    await quiz.getQuizzesByCourse('course-1')
    await quiz.createQuiz({ courseId: 'course-1' } as any)
    await quiz.updateQuiz('quiz-1', { title: 'Updated' })
    await quiz.deleteQuiz('quiz-1')
    await quiz.publishQuiz('quiz-1', true)
    await quiz.getUserQuizAttempts('ignored-user-id', 'quiz-1')
    await quiz.getQuizAttempt('attempt-1')
    await quiz.getCourseQuizAttempts('course-1')
    await quiz.getQuizStatistics('quiz-1')

    expect(provider.getManagedQuizzes).toHaveBeenCalledWith('course-1')
    expect(provider.getMyQuizAttempts).toHaveBeenCalledWith('quiz-1')
    expect(provider.getCourseQuizAttempts).toHaveBeenCalledWith('course-1')
    expect(provider.getQuizStatistics).toHaveBeenCalledWith('quiz-1')
  })
})
