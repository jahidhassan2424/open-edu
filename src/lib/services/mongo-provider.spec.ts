import { describe, expect, it, vi } from 'vitest'

const { getIdToken, fetchMock } = vi.hoisted(() => ({
  getIdToken: vi.fn().mockResolvedValue('firebase-id-token'),
  fetchMock: vi.fn()
}))

vi.mock('$lib/firebase', () => ({
  auth: { currentUser: { getIdToken } }
}))

vi.mock('$env/static/public', () => ({
  PUBLIC_DATA_PROVIDER: 'mongodb',
  PUBLIC_API_BASE_URL: 'https://open-edu-9hgu.vercel.app/'
}))

vi.stubGlobal('fetch', fetchMock)

const { mongoProvider } = await import('./mongo-provider')

describe('MongoDB provider', () => {
  it('selects MongoDB and sends authenticated requests to the configured Vercel API', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ data: [] }) })

    expect(mongoProvider.enabled()).toBe(true)
    await expect(mongoProvider.getCourses({ isPublished: true })).resolves.toEqual([])

    expect(fetchMock).toHaveBeenCalledWith(
      'https://open-edu-9hgu.vercel.app/api/mongo',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer firebase-id-token' }),
        body: JSON.stringify({ operation: 'listCourses', data: { filter: { isPublished: true } } })
      })
    )
  })
})
