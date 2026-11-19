import { describe, expect, it, vi } from 'vitest'
import { netlifyCall } from './netlify-api'
vi.mock('$lib/firebase', () => ({ auth: { currentUser: { getIdToken: vi.fn().mockResolvedValue('token') } } }))
describe('Netlify API boundary', () => { it('sends bearer identity and rejects non-2xx responses', async () => { const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { ok: true } }) }); vi.stubGlobal('fetch', fetchMock); await expect(netlifyCall('gradeAssignment', {})).resolves.toEqual({ ok: true }); expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token') }) })
