import { useEffect, useRef, useState } from 'react'
import { api } from './api'
import { Input } from './CollectionFields'

function PlaceSelectInput({ label, endpoint, params = {}, disabled, value, onSelect, required, id, choices = [], allowUnlisted = false }) {
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
        .then(data => { if (controller.signal.aborted) return; setItems(previous => page === 1 ? data.items : [...previous, ...data.items]); setPages(data.pagination.pages) })
        .catch(err => { if (!controller.signal.aborted && err.name !== 'AbortError') { setError(err.message); if (page === 1) setItems([]) } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, search ? 220 : 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, endpoint, parentQuery, disabled, search, page, retry])
  const select = item => { onSelect(item); setOpen(false); trigger.current?.focus() }
  const name = item => item.displayName || item.nameEnglish || item.name || item.code || ''
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

// Changing the request scope discards pagination, search and old results for
// every dependent list, including the administrator's directory controls.
export function PlaceSelect(props) {
  const scope = JSON.stringify([props.endpoint, Boolean(props.disabled), Object.entries(props.params || {}).sort(([a], [b]) => a.localeCompare(b))])
  return <PlaceSelectInput key={scope} {...props} />
}

export default function LocationFields({ values, change, communitySlug }) {
  const postalCode = values.postalCode || ''
  useEffect(() => {
    if (!/^[1-9]\d{5}$/.test(postalCode)) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      api(`/master/pincodes?search=${encodeURIComponent(postalCode)}&limit=100`, { signal: controller.signal }).then(data => {
        if (controller.signal.aborted) return
        const entry = data.items.find(item => item.code === postalCode)
        if (entry) change({ pincodeId: entry._id })
      }).catch(() => {})
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [postalCode, change])
  const children = ['districtId', 'district', 'talukChoiceId', 'talukCode', 'taluk', 'blockId', 'block', 'villagePanchayatId', 'villagePanchayat', 'villagePanchayatNameTamil', 'villageChoiceId', 'villageName', 'villageSameAsPanchayat', 'habitationId', 'habitation', 'wardNumber', 'wardChoiceId', 'streetChoiceId', 'streetArea', 'postalCode', 'pincodeId', 'postOfficeId', 'postOffice', 'villageSameAsHabitation', 'villageManual']
  const reset = keys => Object.fromEntries(keys.map(key => [key, ['villageSameAsPanchayat', 'villageSameAsHabitation', 'villageManual'].includes(key) ? false : '']))
  const localParams = kind => ({ kind, communitySlug, districtId: values.districtId, blockId: kind === 'taluk' ? undefined : values.blockId, villagePanchayatId: kind === 'taluk' ? undefined : values.villagePanchayatId, habitationId: kind === 'street' ? values.habitationId : undefined })
  const rural = values.settlementType !== 'Urban'
  const choose = (id, key, item, clear = []) => change({ [id]: item._id, [key]: item.nameEnglish || item.displayName || item.name || item.code, ...reset(clear), ...(clear.length ? { locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk' && !clear.includes('taluk')) } : {}) })
  const missing = (kind, item) => change({ locationMissing: [...new Set([...(values.locationMissing || []).filter(key => key !== kind), ...(item._id ? [] : [kind])])] })
  return <div className="place-grid">
    <PlaceSelect id="place-state" label="State" endpoint="states" required value={values.state} onSelect={item => change({ ...reset(children), stateCode: item.code, state: item.nameEnglish, locationMissing: [] })} />
    <PlaceSelect id="place-district" label="District" endpoint="districts" params={{ stateCode: values.stateCode }} disabled={!values.stateCode} required value={values.district} onSelect={item => choose('districtId', 'district', item, children.slice(2))} />
    <label className="collection-field" htmlFor="settlementType"><span className="collection-label">Area type <b>*</b></span><select id="settlementType" value={values.settlementType || 'Rural'} onChange={event => change({ ...reset(children.slice(5)), settlementType: event.target.value, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })}><option value="Rural">Rural / Village</option><option value="Urban">Urban / Town or city</option></select></label>
    <PlaceSelect key={`taluk-${values.districtId || 'none'}`} id="place-taluk" label="Taluk / Tehsil / Mandal" endpoint="location-choices" params={localParams('taluk')} disabled={!values.districtId} value={values.taluk} allowUnlisted onSelect={item => { change({ talukChoiceId: item.talukCode ? '' : item._id, talukCode: item.talukCode || '', taluk: item.nameEnglish }); missing('taluk', item) }} />
    {rural && <PlaceSelect id="place-block" label="Block" endpoint="blocks" params={{ districtId: values.districtId }} disabled={!values.districtId} required value={values.block} onSelect={item => choose('blockId', 'block', item, children.slice(7))} />}
    {rural && <PlaceSelect id="place-panchayat" label="Gram Panchayat / Village Panchayat" endpoint="village-panchayats" params={{ blockId: values.blockId }} disabled={!values.blockId} required value={values.villagePanchayat} onSelect={item => change({ ...reset(children.slice(10)), villagePanchayatId: item._id, villagePanchayat: item.nameEnglish, villagePanchayatNameTamil: item.nameEnglish, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })} />}
    {rural ? <PlaceSelect id="place-village" label={rural ? "Village / Hamlet" : "Village / Town"} endpoint="location-choices" params={localParams('village')} disabled={rural ? !values.villagePanchayatId : !values.districtId} required value={values.villageName} choices={rural && values.villagePanchayat ? [{ _id: 'same-as-panchayat', nameEnglish: `${values.villagePanchayat} (same as panchayat)` }] : []} onSelect={item => change({ ...reset(['habitationId', 'habitation', 'streetChoiceId', 'streetArea', 'wardNumber', 'wardChoiceId', 'postalCode', 'pincodeId', 'postOfficeId', 'postOffice']), habitationId: item.masterHabitationId || '', habitation: item.masterHabitationId ? item.nameEnglish : '', villageSameAsHabitation: Boolean(item.masterHabitationId), villageChoiceId: item.masterHabitationId || item._id === 'same-as-panchayat' ? '' : item._id, villageSameAsPanchayat: item._id === 'same-as-panchayat', villageName: item._id === 'same-as-panchayat' ? values.villagePanchayat : item.nameEnglish, locationMissing: (values.locationMissing || []).filter(kind => kind === 'taluk') })} /> : <Input id="place-urban-town" label="Town / city" required placeholder="Enter your town or city" helpText="Enter the town or city within your selected district." value={values.villageName} onChange={value => change({ villageName: value, villageManual: true, villageChoiceId: "", villageSameAsPanchayat: false, villageSameAsHabitation: false })} />}
    {rural && <PlaceSelect id="place-habitation" label="Habitation / Hamlet" endpoint="habitations" params={{ villagePanchayatId: values.villagePanchayatId }} disabled={!values.villagePanchayatId || !values.villageName} required={rural} value={values.habitation} onSelect={item => { choose('habitationId', 'habitation', item, ['streetChoiceId', 'streetArea', 'wardChoiceId', 'wardNumber', 'postalCode', 'pincodeId', 'postOfficeId', 'postOffice']); if (values.villageSameAsHabitation) change({ villageName: item.nameEnglish }) }} />}
    <PlaceSelect id="place-ward" label="Ward No." endpoint="location-choices" params={localParams('ward')} disabled={!values.districtId} value={values.wardNumber} choices={[{ _id: 'na', nameEnglish: 'Not applicable' }]} allowUnlisted onSelect={item => change({ wardChoiceId: item._id === 'na' ? '' : item._id, wardNumber: item.nameEnglish })} />
    <PlaceSelect id="place-street" label="Street / Area" endpoint="location-choices" params={localParams('street')} disabled={!values.villageName} value={values.streetArea} allowUnlisted onSelect={item => { choose('streetChoiceId', 'streetArea', item); missing('street', item) }} />
    <label className="collection-field" htmlFor="place-pincode"><span className="collection-label">PIN code <b>*</b></span><input id="place-pincode" type="text" inputMode="numeric" autoComplete="postal-code" maxLength={6} pattern="[1-9][0-9]{5}" title="Enter a valid 6-digit PIN code." required placeholder="Enter 6-digit PIN code" value={postalCode} onChange={event => change({ postalCode: event.target.value.replace(/\D/g, '').slice(0, 6), pincodeId: '', postOfficeId: '', postOffice: '' })} /><small>Enter the PIN code for your village or town.</small></label>
    <PlaceSelect id="place-postoffice" label="Post Office" endpoint="post-offices" params={{ pincodeId: values.pincodeId }} disabled={!values.pincodeId} value={values.postOffice} onSelect={item => choose('postOfficeId', 'postOffice', item)} />
    <div className="location-hint wide-field">Select your district and village or town, then enter your PIN code. Post office options are available when the PIN code is found in the directory.</div>
  </div>
}

