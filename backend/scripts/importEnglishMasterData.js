const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')
const root = path.resolve(__dirname, '..')
require('dotenv').config({ path: path.join(root, '.env') })
const mongoose = require('mongoose')
const { Block, VillagePanchayat, Habitation } = require('../src/models/MasterData')
const { englishText } = require('../src/utils/english')

async function main() {
  const localPython = path.join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python')
  const extracted = spawnSync(process.env.PYTHON || (fs.existsSync(localPython) ? localPython : process.platform === 'win32' ? 'python' : 'python3'), [path.join(__dirname, 'extractEnglishMasterData.py')], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 4 * 1024 * 1024 })
  if (extracted.status !== 0) throw new Error(extracted.stderr || 'English master extraction failed.')
  console.log(extracted.stdout.trim())
  const data = JSON.parse(fs.readFileSync(path.join(root, 'data/generated/english-master-data.json'), 'utf8'))
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 })
  for (const [model, names, key] of [[Block, data.blocks, 'code'], [VillagePanchayat, data.villages, 'code'], [Habitation, data.habitations, 'sourceKey']]) {
    let official = 0, romanised = 0, operations = []
    const cursor = model.find({}).select('_id code sourceKey nameTamil nameEnglish englishSource').lean().cursor()
    for await (const record of cursor) {
      const matched = names[record[key]]
      const existingVerified = record.nameEnglish && record.englishSource === 'government'
      const nameEnglish = matched || (existingVerified ? record.nameEnglish : englishText(record.nameTamil))
      const englishSource = matched || existingVerified ? 'government' : 'romanised-original'
      if (englishSource === 'government') official++; else romanised++
      operations.push({ updateOne: { filter: { _id: record._id }, update: { $set: { nameEnglish, nameSearchEnglish: nameEnglish.toLowerCase(), englishSource } } } })
      if (operations.length === 1000) { await model.bulkWrite(operations); operations = [] }
    }
    if (operations.length) await model.bulkWrite(operations)
    console.log(`${model.collection.collectionName}: ${official} official English names; ${romanised} deterministic romanisations; original records retained.`)
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
