import { useEffect, useRef, useState } from 'react'
import { api } from './api'

export function PlaceSelect({ label, endpoint, params = {}, disabled, value, onSelect, required, id, choices = [], allowUnlisted = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const searchRef = useRef(null)
  const container = useRef(null)
  const trigger = useRef(null)
  const parentQuery = new URLSearchParams(Object.entries(params).filter(([, item]) => Boolean(item))).toString()
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const closeOutside = event => { if (!container.current?.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', closeOutside)
    return () => document.removeEventListener('mousedown', closeOutside)
  }, [open])
  useEffect(() => {
    if (!open || disabled || !endpoint) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      api(`/master/${endpoint}?limit=100&page=${page}&search=${encodeURIComponent(search)}&${parentQuery}`, { signal: controller.signal })
        .then(data => { setItems(previous => page === 1 ? data.items : [...previous, ...data.items]); setPages(data.pagination.pages) })
        .catch(err => { if (err.name !== 'AbortError') { setError(err.message); if (page === 1) setItems([]) } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, search ? 220 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, endpoint, parentQuery, disabled, search, page, retry])
  const select = item => { onSelect(item); setOpen(false); trigger.current?.focus() }
  const name = item => item.displayName || item.nameEnglish || item.name || item.code
  const available = [...choices.filter(item => name(item).toLowerCase().includes(search.toLowerCase())), ...items]
  return <div className="collection-field place-field" ref={container} onKeyDown={event => { if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() } }}>
    <label className="collection-label" htmlFor={id}>{label}{required && <b> *</b>}</label>
    <button ref={trigger} id={id} className={`place-trigger ${value ? 'has-value' : ''}`} type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-label={`Choose ${label}`} onClick={() => { setOpen(!open); setSearch(''); setPage(1); setItems([]); setError(''); setLoading(Boolean(endpoint)) }}><span>{value || (disabled ? 'Select the parent location first' : 'Select an option')}</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="place-popover"><input ref={searchRef} aria-label={`Search ${label}`} placeholder={`Search ${label.toLowerCase()}`} value={search} onChange={event => { setSearch(event.target.value); setPage(1); setItems([]); setLoading(Boolean(endpoint)) }} />
      <div className="place-options" role="listbox" aria-label={label}>{available.map(item => <button key={item._id} type="button" role="option" aria-selected={name(item) === value} onClick={() => select(item)}>{name(item)}</button>)}</div>
      {loading && <p role="status"><span className="spinner" /> Loading options...</p>}
      {!loading && !error && !available.length && <p>No locations configured for this selection.</p>}
      {error && <div className="place-error" role="alert">{error}<button type="button" onClick={() => setRetry(retry + 1)}>Try again</button></div>}
      {!loading && !error && page < pages && <button type="button" className="load-places" onClick={() => setPage(page + 1)}>Load more options</button>}
      {allowUnlisted && <button className="unlisted-choice" type="button" onClick={() => select({ _id: '', nameEnglish: 'Not listed' })}>My location is not listed</button>}
    </div>}
  </div>
}

export default function LocationFields({ values, change, communitySlug }) {
  const children = ['districtId', 'district', 'talukChoiceId', 'taluk', 'blockId', 'block', 'villagePanchayatId', 'villagePanchayat', 'villagePanchayatNameTamil', 'villageChoiceId', 'villageName', 'villageSameAsPanchayat', 'habitationId', 'habitation', 'wardNumber', 'wardChoiceId', 'streetChoiceId', 'streetArea', 'postalCode', 'pincodeId', 'postOfficeId', 'postOffice']
  const reset = keys => Object.fromEntries(keys.map(key => [key, key === 'villageSameAsPanchayat' ? false : '']))
  const localParams = kind => ({ kind, communitySlug, districtId: values.districtId, blockId: kind === 'taluk' ? undefined : values.blockId, villagePanchayatId: kind === 'taluk' ? undefined : values.villagePanchayatId, habitationId: kind === 'street' ? values.habitationId : undefined })
  const rural = values.settlementType !== 'Urban'
  const choose = (id, key, item, clear = []) => change({ [id]: item._id, [key]: item.nameEnglish || item.displayName || item.name || item.code, ...reset(clear), ...(clear.length ? { locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk' && !clear.includes('taluk')) } : {}) })
  const missing = (kind, item) => change({ locationMissing: [...new Set([...(values.locationMissing || []).filter(key => key !== kind), ...(item._id ? [] : [kind])])] })
  return <div className="place-grid">
    <PlaceSelect id="place-state" label="State" endpoint="states" required value={values.state} onSelect={item => change({ ...reset(children), stateCode: item.code, state: item.nameEnglish, locationMissing: [] })} />
    <label className="collection-field"><span className="collection-label">Rural / Urban <b>*</b></span><select id="settlementType" value={values.settlementType || 'Rural'} onChange={event => change({ ...reset(children.slice(4)), settlementType: event.target.value, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })}><option>Rural</option><option>Urban</option></select></label>
    <PlaceSelect id="place-district" label="District" endpoint="districts" params={{ stateCode: values.stateCode }} disabled={!values.stateCode} required value={values.district} onSelect={item => choose('districtId', 'district', item, children.slice(2))} />
    <PlaceSelect id="place-taluk" label="Taluk / Tehsil / Mandal" endpoint="location-choices" params={localParams('taluk')} disabled={!values.districtId} value={values.taluk} allowUnlisted onSelect={item => { choose('talukChoiceId', 'taluk', item); missing('taluk', item) }} />
    <PlaceSelect id="place-block" label="Block" endpoint="blocks" params={{ districtId: values.districtId }} disabled={!values.districtId} required={rural} value={values.block} onSelect={item => choose('blockId', 'block', item, children.slice(6))} />
    {rural ? <PlaceSelect id="place-panchayat" label="Gram Panchayat / Village Panchayat" endpoint="village-panchayats" params={{ blockId: values.blockId }} disabled={!values.blockId} required value={values.villagePanchayat} onSelect={item => change({ ...reset(children.slice(9)), villagePanchayatId: item._id, villagePanchayat: item.nameEnglish, villagePanchayatNameTamil: item.nameEnglish, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })} /> : <label className="collection-field"><span className="collection-label">Gram Panchayat / Village Panchayat</span><select disabled value="Not applicable"><option value="Not applicable">Not applicable for urban residence</option></select></label>}
    <PlaceSelect id="place-village" label="Village / Town" endpoint="location-choices" params={localParams('village')} disabled={rural ? !values.villagePanchayatId : !values.districtId} required value={values.villageName} choices={rural && values.villagePanchayat ? [{ _id: 'same-as-panchayat', nameEnglish: `${values.villagePanchayat} (same as panchayat)` }] : []} onSelect={item => change({ ...reset(['habitationId', 'habitation', 'streetChoiceId', 'streetArea', 'wardNumber', 'wardChoiceId']), villageChoiceId: item._id === 'same-as-panchayat' ? '' : item._id, villageSameAsPanchayat: item._id === 'same-as-panchayat', villageName: item._id === 'same-as-panchayat' ? values.villagePanchayat : item.nameEnglish, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })} />
    <PlaceSelect id="place-habitation" label="Habitation / Hamlet" endpoint="habitations" params={{ villagePanchayatId: values.villagePanchayatId }} disabled={!values.villagePanchayatId || !values.villageName} required={rural} value={values.habitation} onSelect={item => choose('habitationId', 'habitation', item, ['streetChoiceId', 'streetArea', 'wardChoiceId', 'wardNumber'])} />
    <PlaceSelect id="place-ward" label="Ward No." endpoint="location-choices" params={localParams('ward')} disabled={!values.districtId} value={values.wardNumber} choices={[{ _id: 'na', nameEnglish: 'Not applicable' }, ...Array.from({ length: 200 }, (_, index) => ({ _id: `number-${index + 1}`, nameEnglish: String(index + 1) }))]} onSelect={item => change({ wardChoiceId: /^number-|^na$/.test(item._id) ? '' : item._id, wardNumber: item.nameEnglish })} />
    <PlaceSelect id="place-street" label="Street / Area" endpoint="location-choices" params={localParams('street')} disabled={!values.villageName} value={values.streetArea} allowUnlisted onSelect={item => { choose('streetChoiceId', 'streetArea', item); missing('street', item) }} />
    <PlaceSelect id="place-pincode" label="PIN Code" endpoint="pincodes" required value={values.postalCode} onSelect={item => choose('pincodeId', 'postalCode', item, ['postOfficeId', 'postOffice'])} />
    <PlaceSelect id="place-postoffice" label="Post Office" endpoint="post-offices" params={{ pincodeId: values.pincodeId }} disabled={!values.pincodeId} value={values.postOffice} onSelect={item => choose('postOfficeId', 'postOffice', item)} />
    <div className="location-hint wide-field">If a taluk or street is missing, choose “My location is not listed”. Your community administrator can add it to the directory.</div>
  </div>
}
