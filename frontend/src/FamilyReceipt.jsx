import { useState } from 'react'
import { downloadFile } from './api'

const display = value => value === undefined || value === null || value === '' ? 'Not provided' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : Array.isArray(value) ? value.join(', ') || 'None' : String(value)
function Section({ title, fields, record }) {
  return <section className="receipt-section"><h2>{title}</h2><dl>{fields.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{display(record[key])}</dd></div>)}</dl></section>
}
export default function FamilyReceipt({ record, community, onToast, onNew }) {
  const [downloading, setDownloading] = useState(false)
  const download = async () => {
    setDownloading(true)
    try { await downloadFile(`/families/${record._id}/receipt`, { receiptToken: record.receiptToken, filename: `${community.name}-${record.familyHeadName}.pdf` }) }
    catch (error) { onToast(error.message, 'error') }
    finally { setDownloading(false) }
  }
  return <section className="submitted-record">
    <header className="submitted-header"><div><span className="receipt-state">SUBMITTED</span><h1>{record.familyHeadName}</h1><p>{community.name} · Family registration</p><small>Reference: {record._id}</small></div><button className="workspace-primary" disabled={downloading} onClick={download}>{downloading ? 'Preparing PDF…' : 'Download PDF'}</button></header>
    <p className="receipt-note">Your family record has been received. Download your copy before leaving this page. This download is available for 24 hours; your community administrator can provide a copy later.</p>
    <Section title="Primary information" record={record} fields={[[ 'familyHeadName', 'Family head / primary contact' ], ['phoneNumber', 'Mobile number'], ['alternatePhone', 'Alternate mobile'], ['email', 'Email'], ['familyType', 'Family type'], ['preferredContact', 'Preferred contact']]} />
    <Section title="Residential information" record={record} fields={[[ 'address', 'Address' ], ['state', 'State'], ['district', 'District'], ['settlementType', 'Area type'], ['taluk', 'Taluk'], ['block', 'Block'], ['villagePanchayat', 'Village panchayat'], ['villageName', 'Village / town'], ['habitation', 'Habitation / hamlet'], ['wardNumber', 'Ward number'], ['streetArea', 'Street / area'], ['postalCode', 'PIN code'], ['postOffice', 'Post office']]} />
    <section className="receipt-section"><h2>Family members ({record.members?.length || 0})</h2>{(record.members || []).map((member, index) => <Section key={member._id || index} title={`${index + 1}. ${member.name || member.nameAddress}`} record={member} fields={[[ 'relationship', 'Relationship' ], ['age', 'Age (years)'], ['gender', 'Gender'], ['maritalStatus', 'Marital status'], ['education', 'Education'], ['occupation', 'Occupation'], ['workLocation', 'Work location'], ['phoneNumber', 'Mobile number'], ['skills', 'Skills']]} />)}</section>
    <Section title="Household information" record={record} fields={[[ 'housingType', 'Housing situation' ], ['familyAnnualIncome', 'Annual household income'], ['governmentSchemes', 'Government benefits'], ['householdNotes', 'Additional information']]} />
    <Section title="Community support" record={record.support || {}} fields={[[ 'needed', 'Help requested' ], ['categories', 'Categories'], ['priority', 'Priority'], ['details', 'Request details']]} />
    <Section title="Community contribution" record={record.contribution || {}} fields={[[ 'willing', 'Willing to contribute' ], ['categories', 'Categories'], ['skills', 'Skills / resource'], ['availability', 'Availability'], ['details', 'Contribution details']]} />
    {record.customData && <Section title="Additional community information" record={Object.fromEntries(Object.entries(record.customData).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value]))} fields={Object.keys(record.customData).map(key => [key, key.replace(/([a-z])([A-Z])/g, '$1 $2')])} />}
    <footer className="receipt-actions"><button className="workspace-secondary" onClick={onNew}>Register another family</button><button className="workspace-primary" disabled={downloading} onClick={download}>Download PDF</button></footer>
  </section>
}
