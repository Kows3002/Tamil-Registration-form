// Revenue taluks are separate from rural development blocks. The bundled
// snapshot is keyed by the same district codes as the uploaded rural masters.
const directory = require('./taluks.json')
const normalizeName = name => String(name || '').normalize('NFKC').trim().toLowerCase()
const taluksForDistrict = district => {
  if (!district || (district.stateCode || 'TN') !== 'TN') return []
  const entry = directory.districts[String(district.code)]
  return (entry?.taluks || []).map(nameEnglish => {
    // Application key, not an official LGD taluk code or MongoDB ObjectId.
    const talukCode = `TN:${district.code}:${nameEnglish.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    return { _id: talukCode, talukCode, nameEnglish, districtId: district._id, sourceUrl: entry.sourceUrl }
  })
}
const mergeTaluks = (district, choices) => {
  const overrides = new Set(choices.map(item => normalizeName(item.nameEnglish)))
  return [...taluksForDistrict(district).filter(item => !overrides.has(normalizeName(item.nameEnglish))), ...choices.filter(item => item.status === 'ACTIVE')]
    .sort((a, b) => a.nameEnglish.localeCompare(b.nameEnglish, 'en'))
}
module.exports = { taluksForDistrict, mergeTaluks, normalizeName }
