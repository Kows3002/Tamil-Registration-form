import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { PlaceSelect } from './LocationPicker'
import './RegistrationWorkspace.css'

const empty = () => ({ kind: 'taluk', nameEnglish: '', districtId: '', district: '', blockId: '', block: '', villagePanchayatId: '', panchayat: '', habitationId: '', habitation: '' })
const kinds = { taluk: 'Taluk / Tehsil / Mandal', village: 'Village / Town', ward: 'Ward', street: 'Street / Area' }
export default function LocationDirectory({ community, token, onToast, adminRole }) {
  const [items, setItems] = useState([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [form, setForm] = useState(empty), [search, setSearch] = useState(''), [error, setError] = useState('')
  const canEdit = ['SUPER_ADMIN', 'COMMUNITY_ADMIN'].includes(adminRole)
  const communityId = community._id
  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await api('/master/managed-locations', { token, communityId })); setError('') }
    catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }, [token, communityId])
  useEffect(() => {
    const controller = new AbortController()
    api('/master/managed-locations', { token, communityId, signal: controller.signal }).then(setItems).catch(err => { if (err.name !== 'AbortError') setError(err.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, communityId])
  const visible = useMemo(() => items.filter(item => `${item.nameEnglish} ${kinds[item.kind]}`.toLowerCase().includes(search.toLowerCase())), [items, search])
  const save = async event => {
    event.preventDefault()
    if (!form.districtId) { onToast('Choose a district first.', 'error'); return }
    setSaving(true)
    try {
      await api('/master/managed-locations', { token, communityId, method: 'POST', body: JSON.stringify({ ...form, blockId: form.blockId || undefined, villagePanchayatId: form.villagePanchayatId || undefined, habitationId: form.habitationId || undefined }) })
      setForm(current => ({ ...current, nameEnglish: '' })); await load(); onToast('Location added to the registration dropdown.')
    } catch (err) { onToast(err.message, 'error') }
    finally { setSaving(false) }
  }
  const toggle = async item => {
    setSaving(true)
    try { await api(`/master/managed-locations/${item._id}`, { token, communityId, method: 'PATCH', body: JSON.stringify({ status: item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) }); await load(); onToast('Location availability updated.') }
    catch (err) { onToast(err.message, 'error') }
    finally { setSaving(false) }
  }
  return <>
    <div className="page-header"><div><span className="overline">{community.name} / DIRECTORY</span><h1>Location directory</h1><p>Maintain verified local places for your community's registration dropdowns.</p></div><button className="button secondary" onClick={load} disabled={loading}>Refresh</button></div>
    <div className="directory-notice">Districts, blocks, panchayats, habitations and PIN codes come from the master directory. Add missing taluks, villages, wards and streets here. Use English names and choose the correct parent locations.</div>
    {error && <div className="records-error" role="alert">{error}<button onClick={load}>Try again</button></div>}
    <div className="directory-layout">
      <section className="content-panel"><div className="record-list-head"><div><h2>Community locations</h2><p>{visible.length} locations</p></div><input aria-label="Search managed locations" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name or type" /></div>{loading ? <div className="loading-row"><span className="spinner" /> Loading locations...</div> : visible.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Type</th><th>Scope</th><th>Status</th>{canEdit && <th>Action</th>}</tr></thead><tbody>{visible.map(item => <tr key={item._id}><td><strong>{item.nameEnglish}</strong></td><td>{kinds[item.kind]}</td><td>{item.habitationId ? 'Habitation' : item.villagePanchayatId ? 'Panchayat' : item.blockId ? 'Block' : 'District'}</td><td><span className={`badge ${item.status === 'ACTIVE' ? 'verified' : 'pending'}`}>{item.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span></td>{canEdit && <td><button className="record-open" disabled={saving} onClick={() => toggle(item)}>{item.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button></td>}</tr>)}</tbody></table></div> : <div className="empty-table"><strong>No local places added yet.</strong><small>Add verified names to make them available to families.</small></div>}</section>
      {canEdit && <section className="content-panel directory-editor"><div className="panel-title"><div><h2>Add a location</h2><p>Parent filters are optional below the district.</p></div></div><form className="registration-workspace location-directory" onSubmit={save}><fieldset disabled={saving}><label className="collection-field"><span className="collection-label">Location type</span><select value={form.kind} onChange={event => setForm({ ...empty(), kind: event.target.value })}>{Object.entries(kinds).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="collection-field"><span className="collection-label">English name <b>*</b></span><input required maxLength="160" pattern="[ -~]+" value={form.nameEnglish} onChange={event => setForm({ ...form, nameEnglish: event.target.value })} /></label>
        <PlaceSelect label="District" id="directory-district" endpoint="districts" required value={form.district} onSelect={item => setForm({ ...empty(), kind: form.kind, nameEnglish: form.nameEnglish, districtId: item._id, district: item.nameEnglish })} />
        {form.kind !== 'taluk' && <><PlaceSelect label="Block" id="directory-block" endpoint="blocks" params={{ districtId: form.districtId }} disabled={!form.districtId} value={form.block} onSelect={item => setForm({ ...form, blockId: item._id, block: item.nameEnglish, villagePanchayatId: '', panchayat: '', habitationId: '', habitation: '' })} />
        <PlaceSelect label="Village Panchayat" id="directory-panchayat" endpoint="village-panchayats" params={{ blockId: form.blockId }} disabled={!form.blockId} value={form.panchayat} onSelect={item => setForm({ ...form, villagePanchayatId: item._id, panchayat: item.nameEnglish, habitationId: '', habitation: '' })} />
        {form.kind !== 'village' && <PlaceSelect label="Habitation" id="directory-habitation" endpoint="habitations" params={{ villagePanchayatId: form.villagePanchayatId }} disabled={!form.villagePanchayatId} value={form.habitation} onSelect={item => setForm({ ...form, habitationId: item._id, habitation: item.nameEnglish })} />}
        <button type="button" className="directory-reset" onClick={() => setForm({ ...form, blockId: '', block: '', villagePanchayatId: '', panchayat: '', habitationId: '', habitation: '' })}>Clear optional parent filters</button></>}
        <button className="workspace-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add to directory'}</button>
      </fieldset></form></section>}
    </div>
  </>
}
