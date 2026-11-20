import { beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, getIdToken, fetchMock, onAuthStateChanged } = vi.hoisted(() => ({
  auth: { currentUser: null as any },
  getIdToken: vi.fn().mockResolvedValue('firebase-id-token'),
  fetchMock: vi.fn(),
  onAuthStateChanged: vi.fn()
}))

vi.mock('$lib/firebase', () => ({
  auth
}))

vi.mock('firebase/auth', () => ({ onAuthStateChanged }))

vi.mock('$env/static/public', () => ({
  PUBLIC_DATA_PROVIDER: 'mongodb',
  PUBLIC_API_BASE_URL: 'https://open-edu-9hgu.vercel.app/'
}))

vi.stubGlobal('fetch', fetchMock)

const { mongoProvider } = await import('./mongo-provider')

describe('MongoDB provider', () => {
  beforeEach(() => {
    auth.currentUser = { getIdToken }
    getIdToken.mockClear().mockResolvedValue('firebase-id-token')
    fetchMock.mockReset()
    onAuthStateChanged.mockReset()
  })

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

  it('waits for Firebase authentication before sending the initial course request', async () => {
    auth.currentUser = null
    onAuthStateChanged.mockImplementationOnce((_auth, callback) => {
      callback({ getIdToken })
      return vi.fn()
    })
    fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ data: [] }) })

    await expect(mongoProvider.getCourses()).resolves.toEqual([])
    expect(onAuthStateChanged).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://open-edu-9hgu.vercel.app/api/mongo',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer firebase-id-token' }) })
    )
  })
})
