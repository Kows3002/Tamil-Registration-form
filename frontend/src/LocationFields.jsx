import { useEffect, useRef, useState } from 'react'
import { api } from './api'

const placeName = item => item?.nameEnglish || item?.name || item?.nameTamil || item?.code || ''

function PlaceSelect({ label, endpoint, parent, disabled, value, onSelect, required }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState([])
  const [pages, setPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const searchRef = useRef(null)
  useEffect(() => { if (open) searchRef.current?.focus() }, [open])
  useEffect(() => {
    if (!open || disabled) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true); setError('')
      api(`/master/${endpoint}?limit=100&page=${page}&search=${encodeURIComponent(search)}${parent ? `&${parent}` : ''}`, { signal: controller.signal })
        .then(data => { setItems(previous => page === 1 ? data.items : [...previous, ...data.items]); setPages(data.pagination.pages) })
        .catch(err => { if (err.name !== 'AbortError') { setError(err.message); if (page === 1) setItems([]) } })
        .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 220)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, endpoint, parent, disabled, search, page, retry])
  return <div className="collection-field place-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }}>
    <span className="collection-label">{label}{required && <b> *</b>}</span>
    <button className="place-trigger" type="button" disabled={disabled} aria-expanded={open} aria-haspopup="listbox" aria-label={`Choose ${label}`} onClick={() => { setOpen(!open); setSearch(''); setPage(1); setItems([]) }}><span>{value || (disabled ? 'Choose the location above first' : `Select ${label.toLowerCase()}`)}</span><span aria-hidden="true">⌄</span></button>
    {open && <div className="place-popover"><input ref={searchRef} aria-label={`Search ${label}`} placeholder="Search names…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); setItems([]) }} />
      <div className="place-options" role="listbox" aria-label={label}>{items.map(item => <button key={item._id} type="button" role="option" aria-selected={placeName(item) === value} onClick={() => { onSelect(item); setOpen(false) }}><span>{placeName(item)}</span>{item.nameEnglish && item.nameTamil && <small>{item.nameTamil}</small>}</button>)}</div>
      {loading && <p role="status"><span className="spinner" /> Loading places…</p>}
      {!loading && !error && !items.length && <p>No matching places. Try a different search.</p>}
      {error && <div className="place-error" role="alert">{error}<button type="button" onClick={() => setRetry(retry + 1)}>Try again</button></div>}
      {!loading && !error && page < pages && <button type="button" className="load-places" onClick={() => setPage(page + 1)}>Show more names</button>}
    </div>}
  </div>
}

export default function LocationFields({ values, change }) {
  const clear = keys => Object.fromEntries(keys.flatMap(([id, name]) => [[id, ''], [name, '']]))
  const select = (item, id, name, downstream = []) => change({ [id]: item._id, [name]: placeName(item), ...clear(downstream) })
  return <div className="place-grid">
    <PlaceSelect label="District" endpoint="districts" required value={values.district} onSelect={item => select(item, 'districtId', 'district', [['blockId', 'block'], ['villagePanchayatId', 'villagePanchayatNameTamil'], ['habitationId', 'habitation']])} />
    <PlaceSelect label="Block" endpoint="blocks" required parent={`districtId=${values.districtId || ''}`} disabled={!values.districtId} value={values.block} onSelect={item => select(item, 'blockId', 'block', [['villagePanchayatId', 'villagePanchayatNameTamil'], ['habitationId', 'habitation']])} />
    <PlaceSelect label="Village panchayat" endpoint="village-panchayats" required parent={`blockId=${values.blockId || ''}`} disabled={!values.blockId} value={values.villagePanchayatNameTamil} onSelect={item => { select(item, 'villagePanchayatId', 'villagePanchayatNameTamil', [['habitationId', 'habitation']]); change({ villageName: placeName(item) }) }} />
    <PlaceSelect label="Habitation" endpoint="habitations" required parent={`villagePanchayatId=${values.villagePanchayatId || ''}`} disabled={!values.villagePanchayatId} value={values.habitation} onSelect={item => select(item, 'habitationId', 'habitation')} />
    <PlaceSelect label="Assembly constituency" endpoint="assembly-constituencies" value={values.assemblyConstituency} onSelect={item => select(item, 'assemblyConstituencyId', 'assemblyConstituency')} />
    <PlaceSelect label="PIN code" endpoint="pincodes" value={values.postalCode} onSelect={item => select(item, 'pincodeId', 'postalCode', [['postOfficeId', 'postOffice']])} />
    <PlaceSelect label="Post office" endpoint="post-offices" parent={`pincodeId=${values.pincodeId || ''}`} disabled={!values.pincodeId} value={values.postOffice} onSelect={item => select(item, 'postOfficeId', 'postOffice')} />
    <div className="place-note"><span aria-hidden="true">↳</span><p>Place names come from the community’s official location directory. Search or browse the names in each list.</p></div>
  </div>
}
