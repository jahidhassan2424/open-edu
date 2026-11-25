import reminders from '../netlify/functions/reminders.mjs'

export default async function handler(request, response) {
  const result = await reminders({ httpMethod: request.method, headers: request.headers, body: '' })
  return response.status(result.statusCode ?? 500).send(result.body ?? '')
}
