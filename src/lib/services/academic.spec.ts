import { describe, expect, it, vi, beforeEach } from 'vitest'
import { validateAcademicPlan, getAcademicTerms, saveAcademicTerm, deleteAcademicTerm } from './academic'
import { getDocs, setDoc, deleteDoc } from 'firebase/firestore'

vi.mock('firebase/firestore', () => ({ collection: vi.fn((...args) => args), doc: vi.fn((...args) => ({ id: args.length > 2 ? args[2] : 'generated-term' })), getDocs: vi.fn(), orderBy: vi.fn(), query: vi.fn(), setDoc: vi.fn(), deleteDoc: vi.fn() }))
vi.mock('$lib/firebase', () => ({ db: {} }))
vi.mock('./mongo-provider', () => ({ mongoProvider: { enabled: () => false } }))

describe('academic validation', () => {
  it('rejects duplicate modules, reversed dates, unknown resources, and late deadlines', () => {
    const errors = validateAcademicPlan([
      { id: 'a', number: 1, title: 'A', startDate: '2026-09-10', endDate: '2026-09-01', objectives: [], resources: [{ id: 'r', title: 'x', type: 'lesson', lessonId: 'missing', order: 1 }] },
      { id: 'b', number: 1, title: 'B', startDate: '2026-09-02', endDate: '2026-09-03', objectives: [], resources: [] }
    ], [{ id: 'q', type: 'quiz', title: 'Q', date: '2026-09-10', dueAt: '2026-09-09' }], ['known'])
    expect(errors).toHaveLength(4)
  })
})

describe('term CRUD', () => {
  beforeEach(() => vi.clearAllMocks())
  it('creates, lists, and deletes terms', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [{ id: 't1', data: () => ({ name: 'Fall', startDate: '2026-09-01', endDate: '2026-12-15', status: 'planned' }) }] } as never)
    await expect(saveAcademicTerm({ name: 'Fall', startDate: '2026-09-01', endDate: '2026-12-15', status: 'planned' })).resolves.toBe('generated-term')
    await expect(getAcademicTerms()).resolves.toHaveLength(1)
    await expect(deleteAcademicTerm('t1')).resolves.toBeUndefined()
    expect(setDoc).toHaveBeenCalled(); expect(deleteDoc).toHaveBeenCalled()
  })
})
