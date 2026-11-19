import mongoApi from '../netlify/functions/mongo-api.mjs'

function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

function originAllowed(origin) {
  if (!origin) return true
  return allowedOrigins().includes(origin.replace(/\/$/, ''))
}

export default async function handler(request, response) {
  const origin = request.headers.origin

  if (!originAllowed(origin)) {
    return response.status(403).json({ error: 'Origin is not allowed.' })
  }

  if (origin) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  }

  if (request.method === 'OPTIONS') return response.status(204).end()
  if (request.method !== 'POST') return response.status(405).json({ error: 'Method not allowed.' })

  const event = {
    httpMethod: request.method,
    headers: request.headers,
    body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})
  }
  const result = await mongoApi(event)

  for (const [name, value] of Object.entries(result.headers ?? {})) response.setHeader(name, value)
  return response.status(result.statusCode ?? 500).send(result.body ?? '')
}
