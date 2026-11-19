import { describe, expect, it } from 'vitest'
import { gradeQuiz } from './grading'

describe('server grading', () => {
  const questions = [
    { id: 'low', type: 'multiple_choice' as const, correctAnswer: 'a', points: 1 },
    { id: 'high', type: 'multiple_choice' as const, correctAnswer: 'b', points: 9 }
  ]

  it('uses point weights rather than correct-question count', () => {
    const result = gradeQuiz(questions, [{ questionId: 'high', answer: 'b' }, { questionId: 'low', answer: 'x' }])
    expect(result.pointsEarned).toBe(9)
    expect(result.score).toBe(90)
  })

  it('never trusts caller supplied correctness or points', () => {
    const result = gradeQuiz(questions, [{ questionId: 'low', answer: 'x', isCorrect: true, pointsEarned: 999 } as never])
    expect(result.answers[0]).toMatchObject({ isCorrect: false, pointsEarned: 0 })
  })
})
