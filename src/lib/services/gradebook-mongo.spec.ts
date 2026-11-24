import { describe, expect, it, vi } from 'vitest'
const provider = vi.hoisted(() => ({ enabled: vi.fn(() => true), getGradeConfig: vi.fn().mockResolvedValue(null), saveGradeConfig: vi.fn(), getFinalResult: vi.fn().mockResolvedValue(null), finalizeGradebook: vi.fn().mockResolvedValue({ result: {} }) }))
vi.mock('$lib/firebase', () => ({ db: {}, functions: {} }))
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }))
vi.mock('firebase/functions', () => ({ httpsCallable: vi.fn() }))
vi.mock('./mongo-provider', () => ({ mongoProvider: provider, getMongoGradebook: vi.fn() }))
const gradebook = await import('./gradebook-data')
describe('gradebook MongoDB routing', () => { it('routes config, final result, and finalize operations', async () => { await gradebook.getGradeConfig('c1'); await gradebook.saveGradeConfig({ courseId: 'c1', weights: [], letterScale: [] }); await gradebook.getFinalResult('c1', 'u1'); await gradebook.finalizeLearnerGradebook({ courseId: 'c1', userId: 'u1' }); expect(provider.getGradeConfig).toHaveBeenCalledWith('c1'); expect(provider.saveGradeConfig).toHaveBeenCalled(); expect(provider.getFinalResult).toHaveBeenCalledWith('c1', 'u1'); expect(provider.finalizeGradebook).toHaveBeenCalledWith('c1', 'u1') }) })
