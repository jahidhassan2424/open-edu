import { describe, expect, it, vi } from 'vitest'

const provider = vi.hoisted(() => ({
  enabled: vi.fn(() => true),
  getUserEnrollments: vi.fn().mockResolvedValue([]),
  getCourseEnrollments: vi.fn().mockResolvedValue([]),
  getEnrollmentStats: vi.fn().mockResolvedValue({ totalEnrollments: 0, activeEnrollments: 0, completedEnrollments: 0, dropRate: 0, completionRate: 0 }),
  unenroll: vi.fn().mockResolvedValue(undefined),
  completeCourse: vi.fn().mockResolvedValue(undefined),
  issueCertificate: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('$lib/firebase', () => ({ db: {} }))
vi.mock('firebase/firestore', () => ({ collection: vi.fn(), query: vi.fn(), where: vi.fn(), getDocs: vi.fn() }))
vi.mock('./mongo-provider', () => ({ mongoProvider: provider }))

const { EnrollmentService } = await import('./enrollment')

describe('EnrollmentService MongoDB routing', () => {
  it('keeps dashboard enrollment reads and lifecycle updates out of Firestore', async () => {
    await EnrollmentService.getUserEnrollments('ignored-user-id')
    await EnrollmentService.getCourseEnrollments('course-1')
    await EnrollmentService.getEnrollmentStats('course-1')
    await EnrollmentService.unenrollUser('ignored-user-id', 'course-1')
    await EnrollmentService.completeCourse('ignored-user-id', 'course-1')
    await EnrollmentService.issueCertificate('ignored-user-id', 'course-1', 'https://example.test/certificate')

    expect(provider.getUserEnrollments).toHaveBeenCalledOnce()
    expect(provider.getCourseEnrollments).toHaveBeenCalledWith('course-1')
    expect(provider.getEnrollmentStats).toHaveBeenCalledWith('course-1')
    expect(provider.unenroll).toHaveBeenCalledWith('course-1')
    expect(provider.completeCourse).toHaveBeenCalledWith('course-1')
    expect(provider.issueCertificate).toHaveBeenCalledWith('course-1', 'https://example.test/certificate')
  })
})
