import { useEffect, useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const routes = {
  district: (q, family, page) => `/master/districts?limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  block: (q, family, page) => `/master/blocks?districtId=${encodeURIComponent(family.districtId || '')}&limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  village: (q, family, page) => `/master/village-panchayats?blockId=${encodeURIComponent(family.blockId || '')}&limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  habitation: (q, family, page) => `/master/habitations?villagePanchayatId=${encodeURIComponent(family.villagePanchayatId || '')}&limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  assembly: (q, family, page) => `/master/assembly-constituencies?limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  postOffice: (q, family, page) => `/master/post-offices?limit=100&page=${page}&search=${encodeURIComponent(q)}`,
  pincode: (q, family, page) => `/master/pincodes?limit=100&page=${page}&search=${encodeURIComponent(q)}`,
}
const display = (kind, row) => kind === 'assembly' || kind === 'postOffice' ? row.name : kind === 'pincode' ? row.code : row.nameTamil

export default function MasterAutocomplete({ kind, label, value, family, onSelect, onInputChange, required, disabled, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)

  useEffect(() => { setQuery(value || ''); setPage(1) }, [value])
  useEffect(() => {
    if (disabled || !open) { setResults([]); setPages(1); return }
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const response = await fetch(`${API}${routes[kind](query.trim(), family, page)}`)
        const result = await response.json()
        if (!response.ok || result.success === false) throw new Error('Lookup failed')
        if (active) { setResults(current => page === 1 ? (result.data?.items || []) : [...current, ...(result.data?.items || [])]); setPages(result.data?.pagination?.pages || 1) }
      } catch {
        if (active) { setFailed(true); setResults([]) }
      } finally { if (active) setLoading(false) }
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [kind, query, family.districtId, family.blockId, family.villagePanchayatId, disabled, open, page])

  return <label className={`reference-field master-field field-${kind}`}>
    <span>{label}{required && <b> *</b>}</span>
    <div className="master-input-wrap">
      <input value={query} placeholder={placeholder || 'தேடித் தேர்ந்தெடுக்கவும்'} required={required} disabled={disabled}
        autoComplete="off" aria-label={label} aria-expanded={open} aria-autocomplete="list"
        onFocus={() => { setPage(1); setOpen(true) }} onBlur={() => window.setTimeout(() => setOpen(false), 160)}
        onChange={event => { setQuery(event.target.value); setPage(1); onInputChange(event.target.value); setOpen(true) }} />
      {open && !disabled && <div className="master-options" role="listbox">
        {loading && <span className="master-state">தேடுகிறது...</span>}
        {!loading && failed && <span className="master-state">முதன்மைத் தரவு சேவை கிடைக்கவில்லை. சேவையக வெளியீட்டைச் சரிபார்க்கவும்.</span>}
        {!loading && !failed && results.length === 0 && <span className="master-state">பொருத்தமான விவரம் இல்லை.</span>}
        {!failed && results.map(row => <button type="button" key={row._id} role="option" onMouseDown={event => event.preventDefault()} onClick={() => { const selected = display(kind, row); setQuery(selected); setOpen(false); onSelect(row) }}>{kind === 'district' && row.nameEnglish ? `${row.nameTamil} / ${row.nameEnglish}` : display(kind, row)}{row.code ? ` (${row.code})` : ''}</button>)}
        {!loading && !failed && page < pages && <button type="button" className="master-more" onMouseDown={event => event.preventDefault()} onClick={() => setPage(current => current + 1)}>மேலும் பெயர்களைக் காண்க</button>}
      </div>}
    </div>
  </label>
}
