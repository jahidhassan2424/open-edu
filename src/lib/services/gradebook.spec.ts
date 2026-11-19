import { describe, expect, it } from 'vitest'
import { calculateWeightedGrade, letterFor, validateWeights } from './gradebook'
describe('weighted gradebook', () => {
 it('normalizes weights and ignores pending or unreleased work', () => { expect(validateWeights([{ category: 'quizzes', weight: 50 }, { category: 'final', weight: 50 }])).toBe(true); expect(calculateWeightedGrade([{ id: 'q', category: 'quizzes', title: 'Q', pointsEarned: 8, pointsPossible: 10, status: 'graded', released: true }, { id: 'f', category: 'final', title: 'F', pointsPossible: 10, status: 'pending', released: false }], [{ category: 'quizzes', weight: 50 }, { category: 'final', weight: 50 }])).toBe(80) })
 it('maps configurable letter scales', () => { expect(letterFor(87, [{ min: 90, letter: 'A' }, { min: 80, letter: 'B' }])).toBe('B') })
})
