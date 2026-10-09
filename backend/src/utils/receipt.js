const crypto = require('node:crypto')
const hashReceiptToken = token => crypto.createHash('sha256').update(token).digest('hex')
function issueReceipt() {
  const token = crypto.randomBytes(32).toString('hex')
  return { token, hash: hashReceiptToken(token), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
}
module.exports = { issueReceipt, hashReceiptToken }
