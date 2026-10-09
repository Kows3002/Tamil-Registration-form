import { useEffect, useState } from 'react'
import { api, downloadFile } from './api'

const emptyFilters = { district: '', communityId: '', status: '', from: '', to: '', search: '' }
const queryOf = filters => new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString()
export default function RegistrationReports({ token, onToast, onOpenFamily }) {
  const [filters, setFilters] = useState(emptyFilters)
  const [applied, setApplied] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [exporting, setExporting] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    api(`/admin/reports?${queryOf(applied)}&page=${page}`, { token, signal: controller.signal }).then(value => { if (!controller.signal.aborted) { setData(value); setError('') } }).catch(err => { if (err.name !== 'AbortError') setError(err.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, applied, page, retry])
  const update = (key, value) => setFilters(current => ({ ...current, [key]: value }))
  const apply = event => { event.preventDefault(); setLoading(true); setPage(1); setApplied({ ...filters }) }
  const reset = () => { setLoading(true); setFilters(emptyFilters); setApplied({ ...emptyFilters }); setPage(1) }
  const download = async kind => {
    setExporting(kind)
    try { await downloadFile(`/admin/reports/export?${queryOf(applied)}&kind=${kind}`, { token, filename: `Sangam-${applied.district || 'all-districts'}-${kind}.csv` }) }
    catch (err) { onToast(err.message, 'error') }
    finally { setExporting('') }
  }
  return <>
    <div className="page-header"><div><span className="overline">REGISTRATION REPORTS</span><h1>District & community reports</h1><p>View families and members by district and community.</p></div><button className="button secondary" onClick={() => { setLoading(true); setRetry(value => value + 1) }}>Refresh</button></div>
    <form className="report-filters content-panel" onSubmit={apply}>
      <label>District<select value={filters.district} onChange={event => update('district', event.target.value)}><option value="">All districts</option>{(data?.districts || []).map(district => <option key={district}>{district}</option>)}</select></label>
      <label>Community<select value={filters.communityId} onChange={event => update('communityId', event.target.value)}><option value="">All accessible communities</option>{(data?.communities || []).map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
      <label>Status<select value={filters.status} onChange={event => update('status', event.target.value)}><option value="">All statuses</option>{['PENDING', 'VERIFIED', 'REJECTED', 'ACTIVE'].map(status => <option key={status}>{status}</option>)}</select></label>
      <label>From date<input type="date" value={filters.from} onChange={event => update('from', event.target.value)} /></label>
      <label>To date<input type="date" min={filters.from || undefined} value={filters.to} onChange={event => update('to', event.target.value)} /></label>
      <label>Name / phone / village<input type="search" placeholder="Search registrations" value={filters.search} onChange={event => update('search', event.target.value)} /></label>
      <div className="report-filter-actions"><button className="button primary" disabled={loading}>Apply filters</button><button type="button" className="button secondary" onClick={reset}>Clear filters</button></div>
    </form>
    {error && <p className="records-error" role="alert">{error}</p>}
    {loading ? <div className="loading-row" role="status"><span className="spinner" /> Loading reports…</div> : !error && data && <>
      <div className="report-totals">{[['Districts', data.totals.districts], ['Communities', data.totals.communities], ['Families registered', data.totals.families], ['Family members', data.totals.members]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <section className="content-panel report-summary"><div className="report-panel-head"><div><h2>District and community totals</h2><p>Each family counts as one registration. Member counts include everyone listed in those families.</p></div><button className="button secondary" disabled={Boolean(exporting)} onClick={() => download('summary')}>{exporting === 'summary' ? 'Downloading…' : 'Download summary CSV'}</button></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>District</th><th>Community</th><th>Families registered</th><th>Family members</th></tr></thead><tbody>{data.summary.map(row => <tr key={`${row.district}-${row.communityId}`}><td>{row.district}</td><td>{row.community}</td><td>{row.families}</td><td>{row.members}</td></tr>)}</tbody></table></div>{!data.summary.length && <p className="report-empty">No registrations match these filters.</p>}
      </section>
      <section className="content-panel"><div className="report-panel-head"><div><h2>Registered families</h2><p>{data.pagination.total} family records match the applied filters.</p></div><div className="page-actions"><button className="button secondary" disabled={Boolean(exporting)} onClick={() => download('families')}>Download families CSV</button><button className="button secondary" disabled={Boolean(exporting)} onClick={() => download('members')}>Download members CSV</button></div></div>
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Family / contact</th><th>Community</th><th>District / village</th><th>Members</th><th>Status</th><th>View</th></tr></thead><tbody>{data.records.map(record => <tr key={record._id}><td><strong>{record.familyHeadName}</strong><small>{record.phoneNumber}</small></td><td>{record.community}</td><td>{record.district}<small>{record.villageName}</small></td><td>{record.memberCount}</td><td><span className={`badge ${record.status.toLowerCase()}`}>{record.status}</span></td><td><button className="record-open" onClick={() => onOpenFamily(record)}>Open record</button></td></tr>)}</tbody></table></div>
        <div className="report-pagination"><button className="button secondary" disabled={page <= 1} onClick={() => { setLoading(true); setPage(value => value - 1) }}>Previous</button><span>Page {page} of {Math.max(1, data.pagination.pages)}</span><button className="button secondary" disabled={page >= data.pagination.pages} onClick={() => { setLoading(true); setPage(value => value + 1) }}>Next</button></div>
      </section>
    </>}
  </>
}
