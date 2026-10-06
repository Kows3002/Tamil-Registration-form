const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const backendDir = path.resolve(__dirname, '..')
require('dotenv').config({ path: path.join(backendDir, '.env') })
const mongoose = require('mongoose')
const connectDB = require('../src/config/db')
const { District, Block, VillagePanchayat, Habitation, AssemblyConstituency, PostOffice, Pincode } = require('../src/models/MasterData')

const BATCH_SIZE = 1000
const generated = path.join(backendDir, 'data', 'generated', 'master-data.json')
const sourceDir = path.resolve(process.env.MASTER_DATA_DIR || path.join(backendDir, 'data', 'master-source'))
const sourceFiles = [
  'block_tamil.xls', 'district_abstract_tamil.xls', 'districts.pdf', 'village_tamil.xls',
  'dist_blk_vill_hab_tamil_new.xlsx', 'Assembly_Constituency_Name.pdf', 'post and pincode list.pdf',
]
const models = [District, Block, VillagePanchayat, Habitation, AssemblyConstituency, PostOffice, Pincode]
const normalizeName = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en')
const index = (keys, unique = false) => ({ keys, unique })
const requiredIndexes = new Map([
  [District, [index({ code: 1 }, true), index({ nameSearchTamil: 1 }), index({ nameSearchEnglish: 1 }), index({ sourceKey: 1 }, true)]],
  [Block, [index({ code: 1 }, true), index({ districtCode: 1 }), index({ nameSearch: 1 }), index({ sourceKey: 1 }, true), index({ districtId: 1, code: 1 })]],
  [VillagePanchayat, [index({ code: 1 }, true), index({ districtId: 1 }), index({ districtCode: 1 }), index({ blockCode: 1 }), index({ nameSearch: 1 }), index({ sourceKey: 1 }, true), index({ blockId: 1, code: 1 })]],
  [Habitation, [index({ sourceKey: 1 }, true), index({ districtCode: 1 }), index({ blockCode: 1 }), index({ nameSearch: 1 }), index({ villagePanchayatId: 1, code: 1 }, true)]],
  [AssemblyConstituency, [index({ sourceKey: 1 }, true), index({ nameSearch: 1 })]],
  [PostOffice, [index({ sourceKey: 1 }, true), index({ nameSearch: 1 }), index({ pincodeId: 1 }), index({ pincode: 1 })]],
  [Pincode, [index({ code: 1 }, true)]],
])

function checkSourceFiles() {
  const missing = sourceFiles.filter(file => !fs.existsSync(path.join(sourceDir, file)))
  if (missing.length) throw new Error(`Missing master source file(s) under ${sourceDir}: ${missing.join(', ')}`)
  console.log(`Checked ${sourceFiles.length} source files under ${sourceDir}: ${sourceFiles.join(', ')}`)
}

function extract() {
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
  console.log(`Reading and validating master source files with ${python}...`)
  const result = spawnSync(python, [path.join(__dirname, 'extractMasterData.py'), '--source-dir', sourceDir, '--output', generated], {
    encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }, maxBuffer: 20 * 1024 * 1024,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || `Master-data extraction exited with status ${result.status}`)
  return JSON.parse(fs.readFileSync(generated, 'utf8'))
}

function reportDiscovered(data) {
  console.log('\nSource records discovered before database insertion:')
  for (const [dataset, records] of Object.entries(data.records)) console.log(`- ${dataset}: ${records.length}`)
  console.log('Expected abstract totals:', JSON.stringify(data.expectedTotals))
  console.log('Source validation metrics:', JSON.stringify(data.metrics))
}

async function upsert(model, records, key, label, skipped = 0) {
  let inserted = 0
  let updated = 0
  let unchanged = 0
  for (let start = 0; start < records.length; start += BATCH_SIZE) {
    const batch = records.slice(start, start + BATCH_SIZE)
    const operations = batch.map(record => ({ updateOne: {
      filter: { [key]: record[key] }, update: { $set: record }, upsert: true,
    } }))
    const result = await model.bulkWrite(operations, { ordered: false })
    inserted += result.upsertedCount || 0
    updated += result.modifiedCount || 0
    unchanged += (result.matchedCount || 0) - (result.modifiedCount || 0)
  }
  console.log(`${label} [${model.collection.collectionName}]: source ${records.length + skipped}, imported ${records.length}, inserted ${inserted}, updated ${updated}, unchanged ${unchanged}, skipped ${skipped}`)
}

async function mapBy(model, key) {
  const records = await model.find({}, { _id: 1, [key]: 1 }).lean().exec()
  return new Map(records.map(record => [record[key], record._id]))
}

function indexHasKeys(index, expected) {
  const actualEntries = Object.entries(index.key)
  return actualEntries.length === Object.keys(expected).length && actualEntries.every(([key, direction]) => expected[key] === direction)
}

async function verifyIndexes() {
  console.log('\nVerifying required collection indexes:')
  for (const model of models) {
    const indexes = await model.collection.indexes()
    const required = requiredIndexes.get(model)
    const missing = required.filter(expected => !indexes.some(found => indexHasKeys(found, expected.keys) && (!expected.unique || found.unique === true)))
    if (missing.length) throw new Error(`Missing required indexes on ${model.collection.collectionName}: ${JSON.stringify(missing)}`)
    console.log(`- ${model.collection.collectionName}: ${indexes.map(index => index.name).join(', ')}`)
  }
}

async function importRecords(data) {
  const districts = data.records.districts.map(record => ({ ...record, nameSearchTamil: normalizeName(record.nameTamil), nameSearchEnglish: normalizeName(record.nameEnglish), sourceKey: `lgd-district:${record.code}` }))
  await upsert(District, districts, 'code', 'Districts')
  const districtIds = await mapBy(District, 'code')

  const blocks = data.records.blocks.filter(record => districtIds.has(record.districtCode))
    .map(record => ({ ...record, nameSearch: normalizeName(record.nameTamil), districtId: districtIds.get(record.districtCode), sourceKey: `lgd-block:${record.code}` }))
  await upsert(Block, blocks, 'code', 'Blocks', data.records.blocks.length - blocks.length)
  const blockIds = await mapBy(Block, 'code')

  const villages = data.records.villagePanchayats.filter(record => districtIds.has(record.districtCode) && blockIds.has(record.blockCode))
    .map(record => ({ ...record, nameSearch: normalizeName(record.nameTamil), districtId: districtIds.get(record.districtCode), blockId: blockIds.get(record.blockCode), sourceKey: `lgd-village-panchayat:${record.code}` }))
  await upsert(VillagePanchayat, villages, 'code', 'Village panchayats', data.records.villagePanchayats.length - villages.length)
  const villageIds = await mapBy(VillagePanchayat, 'code')

  const habitations = data.records.habitations.filter(record => villageIds.has(record.villagePanchayatCode))
    .map(record => ({ ...record, nameSearch: normalizeName(record.nameTamil), villagePanchayatId: villageIds.get(record.villagePanchayatCode) }))
  await upsert(Habitation, habitations, 'sourceKey', 'Habitations', data.metrics.habitations.sourceRows - habitations.length)

  const assemblies = data.records.assemblyConstituencies.map(record => ({ ...record, nameSearch: normalizeName(record.name) }))
  await upsert(AssemblyConstituency, assemblies, 'sourceKey', 'Assembly constituencies')
  await upsert(Pincode, data.records.pincodes, 'code', 'PIN codes')
  const pincodeIds = await mapBy(Pincode, 'code')
  const postOffices = data.records.postOffices.filter(record => pincodeIds.has(record.pincode))
    .map(record => ({ ...record, nameSearch: normalizeName(record.name), pincodeId: pincodeIds.get(record.pincode) }))
  await upsert(PostOffice, postOffices, 'sourceKey', 'Post offices', data.metrics.postOffices.postOfficeRows - postOffices.length)
}

async function main() {
  let failed = false
  console.log('Master-data import starting.')
  try {
    checkSourceFiles()
    const data = extract()
    reportDiscovered(data)

    await connectDB()
    console.log(`Importer connected to MongoDB database: ${mongoose.connection.name}`)
    for (const model of models) await model.createIndexes()
    await importRecords(data)

    const finalCounts = Object.fromEntries(await Promise.all(models.map(async model => [
      model.collection.collectionName, await model.countDocuments().exec(),
    ])))
    console.log('\nFinal MongoDB collection document counts:')
    console.log(JSON.stringify(finalCounts, null, 2))
    await verifyIndexes()
    console.log('\nSource-data notes:')
    for (const issue of data.dataIssues) console.log(`- ${issue}`)
  } catch (error) {
    failed = true
    console.error(`Master-data import failed: ${error.stack || error.message}`)
  } finally {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect()
        console.log('MongoDB connection closed.')
      } catch (error) {
        failed = true
        console.error(`Failed to close MongoDB connection cleanly: ${error.message}`)
      }
    }
  }
  if (failed) process.exitCode = 1
}

main().catch(error => {
  console.error(`Unexpected importer failure: ${error.stack || error.message}`)
  process.exitCode = 1
})
