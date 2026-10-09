// Accept an Indian mobile number, optionally prefixed with +91 or 91.
const MOBILE_PATTERN = /^(?:\+91[ -]?|91[ -]?)?[6-9]\d{9}$/
const validMobile = value => value === undefined || value === null || value === '' || (typeof value === 'string' && MOBILE_PATTERN.test(value.trim()))
module.exports = { validMobile }
