const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '')

export async function api(path, { token, communityId, ...options } = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(communityId ? { 'X-Community-Id': communityId } : {}), ...options.headers },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.success === false) throw new Error(/[\u0B80-\u0BFF]/.test(result.message || '') ? `The request could not be completed (${response.status}). Please try again.` : result.message || `Request failed (${response.status})`)
  return result.data
}

export async function downloadFile(path, { token, communityId, receiptToken, filename = 'registration.pdf' } = {}) {
  const response = await fetch(`${API}${path}`, { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(communityId ? { 'X-Community-Id': communityId } : {}), ...(receiptToken ? { 'X-Receipt-Token': receiptToken } : {}) } })
  if (!response.ok) { const error = await response.json().catch(() => ({})); throw new Error(error.message || 'Could not download the file.') }
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = Array.from(filename.replace(/[<>:"/\\|?*]/g, '-')).map(char => char.charCodeAt(0) < 32 ? '-' : char).join(''); document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
