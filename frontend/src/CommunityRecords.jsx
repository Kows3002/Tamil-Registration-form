import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'

const titleOf = key => key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').replace(/^./, letter => letter.toUpperCase())
function Details({ title, entries }) {
  const visible = entries.filter(([, value]) => value !== undefined && value !== null && value !== '' && typeof value !== 'object')
  return <section className="record-detail-section"><h2>{title}</h2><dl>{visible.length ? visible.map(([key, value]) => <div key={key}><dt>{titleOf(key)}</dt><dd>{typeof value === 'boolean' ? value ? 'Yes' : 'No' : String(value)}</dd></div>) : <p>No details provided.</p>}</dl></section>
}

export default function CommunityRecords({ community, token, go, onToast, adminRole, mode = 'families', recordId }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState('')
  const communityId = community?._id
  const load = useCallback(async (signal, silent = false) => {
    if (!communityId) return
    if (!silent) setLoading(true)
    try { const data = await api(`/families?communityId=${communityId}`, { token, communityId, signal }); setRecords(data); setError('') }
    catch (err) { if (err.name !== 'AbortError') setError(err.message) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [communityId, token])
  useEffect(() => {
    const controller = new AbortController()
    setRecords([]); setQuery(''); load(controller.signal)
    const timer = setInterval(() => { if (!document.hidden) load(controller.signal, true) }, 10000)
    return () => { clearInterval(timer); controller.abort() }
  }, [load])
  const filtered = useMemo(() => records.filter(record => (mode !== 'requests' || record.support?.needed) && (mode !== 'contributions' || record.contribution?.willing) && [record.familyHeadName, record.phoneNumber, record.district, record.block, record.villageName, record.habitation, ...(record.members || []).map(member => member.name || member.nameAddress)].join(' ').toLowerCase().includes(query.toLowerCase())), [records, mode, query])
  const canVerify = ['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'VERIFIER'].includes(adminRole)
  const verify = async record => {
    setBusyId(record._id)
    try { await api(`/families/${record._id}/verification`, { token, communityId: community._id, method: 'PATCH', body: JSON.stringify({ status: 'VERIFIED' }) }); await load(undefined, true); onToast('Family registration verified.', 'success') }
    catch (err) { onToast(err.message, 'error') }
    finally { setBusyId('') }
  }
  const titles = { families: 'Family register', overview: 'Community overview', members: 'Community members', requests: 'Families asking for help', contributions: 'People ready to contribute' }
  const selected = records.find(record => record._id === recordId)
  return <>
    <div className="page-header"><div><span className="overline">{community?.name} / COMMUNITY REGISTER</span><h1>{recordId ? selected?.familyHeadName || 'Family information' : titles[mode]}</h1><p>{recordId ? 'Family details, places and community connections in one record.' : 'Real family information collected from your community.'}</p></div><div className="page-actions">{recordId && <button className="button secondary" onClick={() => go('/admin/families')}>Back to register</button>}<a className="button primary" href={`/register/${community.slug}`}>+ Register a family</a><button className="button secondary" onClick={() => load()} disabled={loading}>↻ Refresh</button></div></div>
    {error && <div className="records-error" role="alert">{error}<button onClick={() => load()}>Try again</button></div>}
    {loading ? <div className="loading-row" role="status"><span className="spinner" /> Loading community records…</div>
      : recordId ? selected ? <div className="record-details"><div className="record-banner"><span className={`badge ${selected.status?.toLowerCase()}`}>{selected.status}</span><span>Reference: {selected._id}</span>{canVerify && selected.status === 'PENDING' && <button className="button secondary" disabled={busyId === selected._id} onClick={() => verify(selected)}>{busyId ? 'Verifying…' : 'Verify family'}</button>}</div>
        <Details title="Primary information" entries={['familyHeadName', 'phoneNumber', 'alternatePhone', 'email', 'familyType', 'preferredContact'].map(key => [key, selected[key]])} />
        <Details title="Places & address" entries={['state', 'settlementType', 'district', 'taluk', 'block', 'villagePanchayat', 'habitation', 'villageName', 'wardNumber', 'streetArea', 'address', 'postOffice', 'postalCode'].map(key => [key, key === 'villagePanchayat' ? selected.villagePanchayat || selected.villagePanchayatNameTamil : selected[key]])} />
        <section className="record-detail-section"><h2>Family members <span>({selected.members.length})</span></h2>{selected.members.map((member, index) => <Details key={member._id || index} title={`${index + 1}. ${member.name || member.nameAddress}`} entries={Object.entries(member).filter(([key]) => !['_id', 'communityId', 'serialNumber', 'name', 'nameAddress'].includes(key))} />)}</section>
        <Details title="Household & livelihood" entries={['housingType', 'familyAnnualIncome', 'mainOccupation', 'governmentSchemes', 'accessibilityNeeds', 'householdNotes'].map(key => [key, selected[key]])} />
        <Details title="Help requested" entries={[['needsSupport', Boolean(selected.support?.needed)], ['categories', selected.support?.categories?.join(', ')], ['priority', selected.support?.needed ? selected.support.priority : ''], ['description', selected.support?.details]]} />
        <Details title="Contribution offered" entries={[['willingToContribute', Boolean(selected.contribution?.willing)], ['categories', selected.contribution?.categories?.join(', ')], ['skills', selected.contribution?.skills], ['availability', selected.contribution?.availability], ['description', selected.contribution?.details]]} />
        {selected.customData && <Details title="Additional community questions" entries={Object.entries(selected.customData).map(([key, value]) => [key, typeof value === 'object' ? JSON.stringify(value) : value])} />}
        <Details title="Registration information" entries={[['consentGiven', selected.consent], ['consentRecordedAt', selected.consentAt ? new Date(selected.consentAt).toLocaleString('en-IN') : ''], ['formVersion', selected.formVersion], ['registeredOn', new Date(selected.createdAt).toLocaleString('en-IN')]]} />
      </div> : <div className="empty-table"><strong>Family record not found in this community.</strong><p>Choose a record from the family register.</p></div>
        : <>
          {mode === 'overview' && <><div className="register-stats">{[['Families registered', records.length, 'families'], ['Family members', records.reduce((total, item) => total + item.members.length, 0), 'members'], ['Help requested', records.filter(item => item.support?.needed).length, 'requests'], ['Ready to contribute', records.filter(item => item.contribution?.willing).length, 'contributions']].map(([label, count, route]) => <button key={route} onClick={() => go(`/admin/${route}`)}><span>{label}</span><strong>{count}</strong><small>View records ↗</small></button>)}</div><div className="community-register-link"><div><h2>Your community’s registration link</h2><p>Share this link with families to collect their information.</p><a href={`/register/${community.slug}`}>{location.origin}/register/{community.slug}</a></div><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(`${location.origin}/register/${community.slug}`); onToast('Registration link copied.') } catch { onToast('Could not copy the link. Select and copy the displayed URL.', 'error') } }}>Copy link</button></div></>}
          <section className="content-panel"><div className="record-list-head"><div><h2>{mode === 'overview' ? 'Recent family records' : titles[mode]}</h2><p>{mode === 'members' ? filtered.reduce((total, item) => total + item.members.length, 0) : filtered.length} {mode === 'members' ? 'members' : 'family records'} · refreshes every 10 seconds</p></div><input aria-label="Search family records" type="search" placeholder="Search name, phone or place" value={query} onChange={event => setQuery(event.target.value)} /></div>
            {filtered.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>{mode === 'members' ? 'Member / family' : 'Family'}</th><th>Location</th><th>Contact</th><th>{['requests', 'contributions'].includes(mode) ? 'Community connection' : mode === 'members' ? 'Education / occupation' : 'Members'}</th><th>Status</th><th>View</th></tr></thead><tbody>{(mode === 'overview' ? filtered.slice(0, 8) : filtered).flatMap(record => (mode === 'members' ? record.members : [null]).map((member, index) => <tr key={`${record._id}-${index}`}><td><strong>{member ? member.name || member.nameAddress : record.familyHeadName}</strong><small>{member ? `${record.familyHeadName} · ${member.relationship || 'Family member'}` : `Registered ${new Date(record.createdAt).toLocaleDateString('en-IN')}`}</small></td><td>{record.villageName}<small>{[record.block, record.district].filter(Boolean).join(', ')}</small></td><td>{member?.phoneNumber || record.phoneNumber || '—'}</td><td>{mode === 'requests' ? <>{record.support.categories.join(', ')}<small>{record.support.priority} · {record.support.details}</small></> : mode === 'contributions' ? <>{record.contribution.categories.join(', ')}<small>{record.contribution.availability || record.contribution.details}</small></> : member ? <>{member.education || '—'}<small>{member.occupation}</small></> : record.members.length}</td><td><span className={`badge ${record.status?.toLowerCase()}`}>{record.status}</span></td><td><button className="record-open" onClick={() => go(`/admin/families/${record._id}`)}>Open ↗</button></td></tr>))}</tbody></table></div> : <div className="empty-table"><strong>{query ? 'No records match your search.' : mode === 'requests' ? 'No families have requested help yet.' : mode === 'contributions' ? 'No contributions have been offered yet.' : 'No family registrations yet.'}</strong><p>Submissions for the selected community will appear here.</p></div>}
          </section>
        </>}
  </>
}
