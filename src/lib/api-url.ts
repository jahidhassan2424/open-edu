import * as publicEnv from '$env/static/public'

const env = publicEnv as Record<string, string | undefined>
const withoutTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const basePath = () => {
  const value = env.PUBLIC_BASE_PATH ?? ''
  if (!value || value === '/') return ''
  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

export function apiUrl(path: string) {
  const remoteBase = withoutTrailingSlash(env.PUBLIC_API_BASE_URL ?? '')
  return `${remoteBase || basePath()}${path}`
}
