import { describe, expect, it, vi } from 'vitest'
const provider = vi.hoisted(() => ({ enabled: vi.fn(() => true) }))
const getMongoAnalytics = vi.hoisted(() => vi.fn().mockResolvedValue({ courseId: 'c1' }))
vi.mock('$lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), doc: vi.fn(), getDoc: vi.fn(), getDocs: vi.fn(), query: vi.fn(), where: vi.fn() }))
vi.mock('$lib/services/lessons', () => ({ LessonService: {} }))
vi.mock('$lib/services/mongo-provider', () => ({ mongoProvider: provider, getMongoAnalytics }))
const { AnalyticsService } = await import('./analytics')
describe('analytics MongoDB routing', () => { it('routes lesson, course, and student analytics without Firestore', async () => { await AnalyticsService.getLessonAnalytics('c1', 'l1'); await AnalyticsService.getCourseAnalytics('c1'); await AnalyticsService.getStudentEngagement('c1'); expect(getMongoAnalytics).toHaveBeenNthCalledWith(1, 'c1', 'l1', undefined); expect(getMongoAnalytics).toHaveBeenNthCalledWith(2, 'c1', undefined, undefined); expect(getMongoAnalytics).toHaveBeenNthCalledWith(3, 'c1', 'students', undefined) }) })
