const path = require('node:path')
const PDFDocument = require('pdfkit')
const font = path.resolve(__dirname, '../../assets/fonts/NotoSansTamil-Regular.ttf')
const readable = v => v === undefined || v === null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') || 'None' : typeof v === 'boolean' ? v ? 'Yes' : 'No' : typeof v === 'object' ? JSON.stringify(v) : String(v)
const filePart = v => String(v || '').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, '-').replace(/\.+$/g, '').slice(0,90) || 'family'
const filename = (family, community) => `${filePart(community.name)}-${filePart(family.familyHeadName)}.pdf`
const runsOf = v => readable(v).split(/([\u0B80-\u0BFF\u20B9]+)/g).filter(Boolean)
function createRegistrationPdf(family, community) {
  const doc = new PDFDocument({ size: 'A4', margin: 42, bufferPages: true, info: { Title: `${community.name} - ${family.familyHeadName}`, Author: 'Sangam Family Registration Portal' } })
  doc.registerFont('Tamil', font)
  const left = 42, width = doc.page.width - 84, bottom = doc.page.height - 62
  let y = 42, sectionNumber = 0, activeSection = ''
  const chooseFont = (run, bold) => doc.font(/[\u0B80-\u0BFF\u20B9]/.test(run) ? 'Tamil' : bold ? 'Helvetica-Bold' : 'Helvetica')
  const measure = (value, size = 9, bold = false) => runsOf(value).reduce((sum, run) => { chooseFont(run, bold); return sum + doc.fontSize(size).widthOfString(run) }, 0)
  const draw = (value, x, top, size = 9, bold = false, color = '#202b36') => {
    for (const run of runsOf(value)) {
      chooseFont(run, bold); doc.fontSize(size).fillColor(color).text(run, x, top, { lineBreak: false })
      x += doc.widthOfString(run)
    }
  }
  const graphemes = new Intl.Segmenter('ta', { granularity: 'grapheme' })
  const wrap = (value, available, size = 9, bold = false) => {
    const lines = []
    for (const paragraph of readable(value).split(/\r?\n/)) {
      let line = ''
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line && measure(`${line} ${word}`, size, bold) > available) { lines.push(line); line = '' }
        if (measure(word, size, bold) <= available) { line += `${line ? ' ' : ''}${word}`; continue }
        for (const { segment } of graphemes.segment(word)) {
          if (line && measure(line + segment, size, bold) > available) { lines.push(line); line = '' }
          line += segment
        }
      }
      lines.push(line || ' ')
    }
    return lines
  }
  const rule = (top, color = '#b8c0c8') => doc.moveTo(left, top).lineTo(left + width, top).lineWidth(.5).strokeColor(color).stroke()
  const pageHeader = first => {
    doc.rect(32, 32, doc.page.width - 64, doc.page.height - 64).lineWidth(.6).strokeColor('#aeb8c2').stroke()
    draw('SANGAM', left, 43, first ? 17 : 12, true, '#213e5c')
    draw('FAMILY REGISTRATION PORTAL', left + width - 177, 47, 8, false, '#536372')
    rule(first ? 69 : 65, '#213e5c')
    y = first ? 82 : 77
    if (first) {
      const lines = wrap(community.name, width - 24, 16, true)
      for (const line of lines) { draw(line, left + (width - measure(line, 16, true)) / 2, y, 16, true); y += 23 }
      const title = 'FAMILY REGISTRATION RECORD'
      draw(title, left + (width - measure(title, 10, true)) / 2, y + 2, 10, true)
      y += 29
    } else { draw(`${activeSection || 'Family registration record'} · continued`, left, y, 9, true); y += 23 }
  }
  const nextPage = () => { doc.addPage(); pageHeader(false) }
  const ensure = height => { if (y + height > bottom) nextPage() }
  const section = title => {
    y += 12; ensure(72)
    doc.rect(left, y, width, 24).fillAndStroke('#edf1f4', '#b8c0c8')
    activeSection = `${String(++sectionNumber).padStart(2,'0')}  ${title.toUpperCase()}`
    draw(activeSection, left + 9, y + 7, 9, true)
    y += 24
  }
  // Split long cells across pages, repeating labels and preserving the footer margin.
  const row = cells => {
    const cellWidth = width / cells.length
    const pending = cells.map(([label, value]) => ({ label, lines: wrap(value, cellWidth - 18) }))
    while (pending.some(cell => cell.lines.length)) {
      ensure(42)
      const capacity = Math.max(1, Math.floor((bottom - y - 25) / 14))
      const count = Math.min(capacity, Math.max(...pending.map(cell => cell.lines.length)))
      const height = 25 + count * 14
      cells.forEach((_, index) => {
        const x = left + index * cellWidth, cell = pending[index]
        doc.rect(x, y, cellWidth, height).lineWidth(.5).strokeColor('#b8c0c8').stroke()
        draw(cell.label, x + 9, y + 7, 7.5, false, '#536372')
        cell.lines.splice(0, count).forEach((line, offset) => draw(line, x + 9, y + 21 + offset * 14))
      })
      y += height
      if (pending.some(cell => cell.lines.length)) nextPage()
    }
  }
  const fields = (object, labels) => {
    const entries = Object.entries(labels).map(([key, label]) => [label, object[key]])
    for (let index = 0; index < entries.length; index += 2) row(entries.slice(index, index + 2))
  }
  pageHeader(true)
  row([['Registration reference', String(family._id || '')], ['Registration status', family.status]])
  row([['Family head / primary contact', family.familyHeadName], ['Registered on (IST)', family.createdAt ? new Date(family.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—']])
  section('Primary and residential information')
  row([['Residential address', family.address]])
  fields(family, { phoneNumber: 'Mobile number', alternatePhone: 'Alternate mobile number', email: 'Email', familyType: 'Family type', preferredContact: 'Preferred contact', state: 'State', district: 'District', settlementType: 'Area type', taluk: 'Taluk', block: 'Block', villagePanchayat: 'Village panchayat', villageName: 'Village / town', habitation: 'Habitation / hamlet', wardNumber: 'Ward number', streetArea: 'Street / area', postalCode: 'PIN code', postOffice: 'Post office' })
  section(`Family members (${family.members?.length || 0})`)
  for (const [index, member] of (family.members || []).entries()) {
    ensure(78)
    row([['Member number', index + 1], ['Member name', member.name || member.nameAddress]])
    fields(member, { relationship: 'Relationship', age: 'Age (years)', gender: 'Gender', maritalStatus: 'Marital status', education: 'Education', occupation: 'Occupation', workLocation: 'Work location', phoneNumber: 'Mobile number', skills: 'Skills' })
    y += 8
  }
  section('Household information')
  fields(family, { housingType: 'Housing situation', familyAnnualIncome: 'Annual household income', governmentSchemes: 'Government benefits', householdNotes: 'Additional household information' })
  for (const [key, title, flag] of [['support','Help requested','needed'], ['contribution','Contribution offered','willing']]) {
    section(title); const item = family[key] || {}
    row([[key === 'support' ? 'Help needed' : 'Willing to contribute', Boolean(item[flag])]])
    if (item[flag]) {
      row([['Categories', item.categories]]); row([['Details', item.details]])
      if (key === 'support') row([['Priority', item.priority]])
      else row([['Skills / resource', item.skills], ['Availability', item.availability]])
    }
  }
  const extra = family.customData instanceof Map ? Object.fromEntries(family.customData) : family.customData
  if (extra && Object.keys(extra).length) { section('Additional community information'); for (const [key,value] of Object.entries(extra)) row([[key.replace(/([a-z])([A-Z])/g, '$1 $2'), value]]) }
  section('Declaration and consent')
  row([['Consent to collect family information', Boolean(family.consent)], ['Consent recorded on (IST)', family.consentAt ? new Date(family.consentAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—']])
  const range = doc.bufferedPageRange()
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page); rule(doc.page.height - 52)
    const margin = doc.page.margins.bottom; doc.page.margins.bottom = 0
    draw('Sangam · Family registration record', left, doc.page.height - 44, 7, false, '#536372')
    const pageText = `Page ${page + 1} of ${range.count}`
    draw(pageText, left + width - measure(pageText, 7), doc.page.height - 44, 7, false, '#536372')
    doc.page.margins.bottom = margin
  }
  return doc
}
function sendRegistrationPdf(res, family, community) {
  const doc = createRegistrationPdf(family, community)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="registration.pdf"; filename*=UTF-8''${encodeURIComponent(filename(family, community))}`)
  res.setHeader('Cache-Control', 'no-store')
  doc.on('error', () => res.destroy()); doc.pipe(res); doc.end()
}
module.exports = { createRegistrationPdf, sendRegistrationPdf, filename }
