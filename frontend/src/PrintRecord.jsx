import './ReferenceForm.css'
import './ReferenceFormOverrides.css'

const groups = [
  [['pitagaiName', 'பிடாகையின் பெயர் :'], ['localBody', 'ஊராட்சி / பேரூராட்சி /'], ['municipality', 'நகராட்சி/'], ['townPanchayat', 'ஊராட்சி ஒன்றியம்:']],
  [['corporation', 'மாநகராட்சி:'], ['wardNumber', 'வார்டு எண்:'], ['postOffice', 'தபால் நிலையம்:'], ['postalCode', 'அஞ்சலக எண் :']],
  [['revenueVillage', 'வருவாய் கிராமம்:'], ['division', 'வட்டம் :'], ['circle', 'கோட்டம் :'], ['district', 'மாவட்டம்:']],
  [['assemblyConstituency', 'சட்டமன்ற தொகுதி'], ['parliamentConstituency', 'பாராளுமன்ற தொகுதி'], ['villageName', 'ஊர் பெயர் :'], ['wardSerial', 'வ எண்.']],
]
const columns = [
  ['nameAddress', 'குடும்ப தலைவர் மற்றும் அங்கத்தினர்களின் பெயர், விலாசம் (கதவு எண், தொலைபேசி எண் குறிப்பிடவும்)'],
  ['gender', 'ஆண்/பெண்'], ['age', 'வயது'], ['maritalStatus', 'திருமண மானவரா ஆம்/இல்லை'], ['education', 'கல்வி'], ['workDetails', 'பணியின் விபரம்'],
  ['centralGovernment', 'மத்திய அரசு'], ['stateGovernment', 'மாநில அரசு'], ['private', 'தனியார்'], ['villageName', 'ஊர் பெயர்'], ['name', 'பெயர்'],
  ['temples', 'ஆலயங்கள்'], ['templeBoard', 'ஊர் கோவில்/தேவஸ்வம் போர்டு'],
  ['temporaryAddress', 'தற்காலிக முகவரி (வெளி ஊர் / வெளி மாநிலம் /வெளிநாடுகளில் வசித்து வந்தால் ஊர் பெயர் மற்றும் விலாசம்)'],
  ['taxPayingVillage', 'எந்த ஊரில் வரி செலுத்துகிறார்'], ['familyAnnualIncome', 'குடும்ப ஆண்டு வருமானம்'],
]
const getValue = (member, key) => typeof member[key] === 'boolean' ? (member[key] ? '✓' : '') : member[key] || ''

export default function PrintRecord({ record }) {
  return <main className="reference-page print-record"><div className="reference-scroll"><article className="reference-sheet">
    <header className="reference-title"><h1>கிருஷ்ணன் வக சமுதாய பிடாகைகளின் மக்கள் தொகை கணக்கு - (ஒரு குடும்பத்திற்கு ஒரு படிவம்)</h1></header>
    <section className="reference-meta">{groups.map((group, groupIndex) => <div className="reference-info-block" key={groupIndex}>{group.map(([key, label]) => <div className={`reference-field field-${key}`} key={key}><span>{label}</span><strong>{record[key] || ''}</strong></div>)}</div>)}</section>
    <div className="reference-table-scroll"><table className="reference-table member-reference-table"><colgroup><col className="col-number" />{columns.map(([key]) => <col key={key} className={`col-${key}`} />)}</colgroup>
      <thead><tr><th>எண்</th>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
      <tbody>{(record.members || []).map((member, index) => <tr key={member._id || index}><td className="row-number">{index + 1}</td>{columns.map(([key]) => <td key={key}>{key === 'nameAddress' ? <>{member[key] || ''}<br />{member.phoneNumber || ''}</> : getValue(member, key)}</td>)}</tr>)}</tbody>
    </table></div>
    <div className="reference-paper-note">மக்கள் கணக்கெடுப்பு பயன்பாட்டிற்கு மட்டும்</div>
  </article></div></main>
}



