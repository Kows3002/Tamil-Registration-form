import { englishRecord } from './english'
const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')

export async function api(path, { token, communityId, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(communityId ? { 'X-Community-Id': communityId } : {}), ...options.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.success === false) throw new Error(/[\u0B80-\u0BFF]/.test(result.message || '') ? `The request could not be completed (${response.status}). Please try again.` : result.message || `Request failed (${response.status})`)
  return englishRecord(result.data)
}
