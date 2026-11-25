import { auth } from '$lib/firebase'
import { apiUrl } from '$lib/api-url'
export async function netlifyCall<T>(operation: string, data: unknown): Promise<T> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign-in is required.')
  const token = await user.getIdToken()
  const response = await fetch(apiUrl('/api'), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ operation, data }) })
  const body = await response.json() as { data?: T; error?: string }
  if (!response.ok) throw new Error(body.error ?? 'Request failed')
  return body.data as T
}
