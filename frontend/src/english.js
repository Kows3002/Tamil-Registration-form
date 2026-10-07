// Deterministic romanisation for legacy, user-entered Tamil text.
// Official English master names take precedence over this display fallback.
const consonants = { '\u0b95': 'k', '\u0b99': 'ng', '\u0b9a': 'ch', '\u0b9c': 'j', '\u0b9e': 'ny', '\u0b9f': 't', '\u0ba3': 'n', '\u0ba4': 'th', '\u0ba8': 'n', '\u0ba9': 'n', '\u0baa': 'p', '\u0bae': 'm', '\u0baf': 'y', '\u0bb0': 'r', '\u0bb1': 'r', '\u0bb2': 'l', '\u0bb3': 'l', '\u0bb4': 'zh', '\u0bb5': 'v', '\u0bb6': 'sh', '\u0bb7': 'sh', '\u0bb8': 's', '\u0bb9': 'h' }
const vowels = { '\u0bbe': 'aa', '\u0bbf': 'i', '\u0bc0': 'ee', '\u0bc1': 'u', '\u0bc2': 'oo', '\u0bc6': 'e', '\u0bc7': 'e', '\u0bc8': 'ai', '\u0bca': 'o', '\u0bcb': 'o', '\u0bcc': 'au', '\u0bcd': '' }
const independent = { '\u0b85': 'a', '\u0b86': 'aa', '\u0b87': 'i', '\u0b88': 'ee', '\u0b89': 'u', '\u0b8a': 'oo', '\u0b8e': 'e', '\u0b8f': 'e', '\u0b90': 'ai', '\u0b92': 'o', '\u0b93': 'o', '\u0b94': 'au', '\u0b83': 'h' }
function englishText(value) {
  const text = String(value ?? '').normalize('NFC')
  let result = ''
  for (let i = 0; i < text.length; i++) {
    const letter = text[i]
    if (consonants[letter]) { const next = text[i + 1]; result += consonants[letter] + (Object.hasOwn(vowels, next) ? vowels[text[++i]] : 'a') }
    else result += independent[letter] ?? (/^[\u0be6-\u0bef]$/.test(letter) ? String(letter.charCodeAt(0) - 0x0be6) : /[\u0b80-\u0bff]/.test(letter) ? '' : letter)
  }
  return result.replace(/\b[a-z]/g, char => char.toUpperCase())
}
function englishRecord(value) {
  if (typeof value === 'string') return /[\u0b80-\u0bff]/.test(value) ? englishText(value) : value
  if (Array.isArray(value)) return value.map(englishRecord)
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, englishRecord(item)]))
  return value
}
export { englishText, englishRecord }
