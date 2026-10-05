import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import PublicForm from './PublicForm.jsx'
import PrintRecord from './PrintRecord.jsx'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const initialMemberCount = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches ? 1 : 4
const blankMember = () => ({ nameAddress: '', phoneNumber: '', gender: '', age: '', maritalStatus: '', education: '', workDetails: '', centralGovernment: false, stateGovernment: false, private: false, villageName: '', name: '', temples: '', templeBoard: '', temporaryAddress: '', taxPayingVillage: '', familyAnnualIncome: '' })
const blankFamily = () => ({ familyHeadName: '', pitagaiName: '', villageName: '', localBody: '', townPanchayat: '', municipality: '', corporation: '', district: '', wardNumber: '', postOffice: '', postalCode: '', revenueVillage: '', division: '', circle: '', assemblyConstituency: '', parliamentConstituency: '', wardSerial: '', phoneNumber: '', members: Array.from({ length: initialMemberCount() }, blankMember) })
const labels = { familyHeadName: 'குடும்பத் தலைவர் பெயர்', villageName: 'ஊர் பெயர்', localBody: 'ஊராட்சி / பேரூராட்சி', townPanchayat: 'நகராட்சி ஒன்றியம்', municipality: 'நகராட்சி', district: 'மாவட்டம்', block: 'வட்டாரம்', wardNumber: 'வார்டு எண்', taluk: 'தாலுகா', postalCode: 'அஞ்சல் எண்', revenueVillage: 'வருவாய் கிராமம்', division: 'வட்டம்', assemblyConstituency: 'சட்டமன்றத் தொகுதி', parliamentConstituency: 'பாராளுமன்றத் தொகுதி', phoneNumber: 'தொலைபேசி எண்', surveyorName: 'கணக்கெடுப்பாளர் பெயர்' }
const memberLabels = [['name','பெயர்'],['idNumber','குடும்ப அட்டை எண்'],['gender','ஆண் / பெண்'],['age','வயது'],['education','கல்வித் தகுதி'],['familyIncome','குடும்ப வருமானம்'],['religion','மதம்'],['governmentScheme','அரசுத் திட்டம்'],['residenceType','குடியிருப்பு வகை'],['birthDate','பிறந்த தேதி'],['additionalPhone','கூடுதல் தொலைபேசி'],['governmentId','அரசு அடையாள எண்'],['remarks','குறிப்புகள்']]
const request = async (path, options = {}) => { const res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...options.headers } }); const data = await res.json().catch(() => ({})); if (!res.ok || data.success === false) throw new Error(data.message || 'சேவையகப் பிழை'); return data.data }
function tamilApiError(error, operation = 'general') {
  const message = error?.message || ''
  if (!message || /failed to fetch|network|cors|load failed|fetch/i.test(message) || /^[\x00-\x7F]*$/.test(message)) return operation === 'submit' ? 'தரவைச் சமர்ப்பிக்க முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.' : 'சேவையகத்தை அணுக முடியவில்லை. இணைய இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.'
  return message
}
function Snackbar({ message, variant, onClose }) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, 5000)
    return () => window.clearTimeout(timer)
  }, [message, onClose])
  if (!message) return null
  return <div className={`api-snackbar ${variant}`} role={variant === 'failure' ? 'alert' : 'status'} aria-live={variant === 'failure' ? 'assertive' : 'polite'}><span>{message}</span><button type="button" onClick={onClose} aria-label="அறிவிப்பை மூடு">×</button></div>
}
function printWithMemberName(members = [], fallback = '') {
  const first = members.find(member => member?.name?.trim() || member?.nameAddress?.trim())
  const rawName = first?.name?.trim() || first?.nameAddress?.trim() || fallback || 'குடும்ப பதிவு'
  const filename = rawName.split(/[\r\n,،]/)[0].trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\s+/g, ' ').slice(0, 80) || 'குடும்ப பதிவு'
  const previousTitle = document.title
  document.title = filename
  window.addEventListener('afterprint', () => { document.title = previousTitle }, { once: true })
  window.print()
}function Field({ label, value, onChange, required, type = 'text' }) { return <label className="field"><span>{label}{required && <b> *</b>}</span><input type={type} value={value || ''} onChange={onChange} required={required} /></label> }
function App() {
  const [path, setPath] = useState(location.pathname)
  const [family, setFamily] = useState(blankFamily())
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '')
  const [records, setRecords] = useState([])
  const [selected, setSelected] = useState(null)
  const [login, setLogin] = useState({ username: '', password: '' })
  const [query, setQuery] = useState('')
  const [district, setDistrict] = useState('')
  const [village, setVillage] = useState('')
  const [sort, setSort] = useState('newest')
  const [page, setPage] = useState(1)
  const [loginLoading, setLoginLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [recordsLoading, setRecordsLoading] = useState(false)
  const recordsRequest = useRef(false)
  const clearAlerts = useCallback(() => { setNotice(''); setError('') }, [])
  const snackbarMessage = error || notice
  const snackbarVariant = error ? 'failure' : 'success'
  const withSnackbar = content => <>{content}<Snackbar message={snackbarMessage} variant={snackbarVariant} onClose={clearAlerts} /></>
  const go = (url) => { history.pushState({}, '', url); setPath(url); setNotice(''); setError('') }
  useEffect(() => { const onPop = () => setPath(location.pathname); addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop) }, [])
  const loadRecords = useCallback(async () => {
    if (recordsRequest.current) return
    recordsRequest.current = true
    setRecordsLoading(true)
    try {
      const data = await request('/families', { token })
      setRecords(Array.isArray(data) ? data : data.families || [])
    } catch (e) {
      setError(tamilApiError(e))
    } finally {
      recordsRequest.current = false
      setRecordsLoading(false)
    }
  }, [token])
  useEffect(() => { if (token && path.startsWith('/admin')) loadRecords() }, [token, path, loadRecords])
  useEffect(() => {
    if (!token || path !== '/admin/dashboard') return
    const timer = window.setInterval(() => loadRecords(), 10000)
    return () => window.clearInterval(timer)
  }, [token, path, loadRecords])
  const update = (key, value) => setFamily(prev => ({ ...prev, [key]: value }))
  const updateMember = (index, key, value) => setFamily(prev => ({ ...prev, members: prev.members.map((m, i) => i === index ? { ...m, [key]: value } : m) }))
  const submitFamily = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!family.members.some(m => m.nameAddress.trim())) { setError('குறைந்தது ஒரு குடும்ப உறுப்பினர் பெயரை உள்ளிடவும்.'); return }
    if (family.phoneNumber && !/^[+\d\s()-]{7,16}$/.test(family.phoneNumber)) { setError('சரியான தொலைபேசி எண்ணை உள்ளிடவும்.'); return }
    for (const m of family.members) if (m.age && (+m.age < 0 || +m.age > 120)) { setError('வயது 0 முதல் 120 வரை இருக்க வேண்டும்.'); return }
    setSubmitting(true)
    try {
      const editId = location.pathname.startsWith('/admin/edit/') ? location.pathname.split('/').pop() : null
      const firstMember = family.members.find(m => m.nameAddress.trim())
      await request(editId ? `/families/${editId}` : '/families', {
        method: editId ? 'PUT' : 'POST', token,
        body: JSON.stringify({ ...family, familyHeadName: firstMember?.nameAddress.split(/[\r\n]/)[0] || '', phoneNumber: firstMember?.phoneNumber || '', members: family.members.filter(m => m.nameAddress.trim()).map((m, i) => ({ ...m, serialNumber: i + 1 })) })
      })
      if (editId) { go('/admin/dashboard'); setNotice('குடும்பப் பதிவு வெற்றிகரமாகத் திருத்தப்பட்டது.') }
      else { setFamily(blankFamily()); setNotice('தரவு வெற்றிகரமாகச் சமர்ப்பிக்கப்பட்டது.') }
    } catch (e) {
      setError(tamilApiError(e, 'submit'))
    } finally {
      setSubmitting(false)
    }
  }
  const doLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoginLoading(true)
    try {
      const data = await request('/admin/login', { method: 'POST', body: JSON.stringify(login) })
      const t = data.token
      setToken(t)
      localStorage.setItem('adminToken', t)
      go('/admin/dashboard')
      setNotice('நிர்வாகி உள்நுழைவு வெற்றிகரமாக முடிந்தது.')
    } catch (e) {
      setError(tamilApiError(e))
    } finally {
      setLoginLoading(false)
    }
  }
  const logout = () => { localStorage.removeItem('adminToken'); setToken(''); go('/admin/login') }
  const deleteRecord = async (id) => { if (!confirm('இந்த குடும்பப் பதிவை நீக்க வேண்டுமா?')) return; try { await request(`/families/${id}`, { method: 'DELETE', token }); await loadRecords(); setNotice('பதிவு வெற்றிகரமாக நீக்கப்பட்டது.') } catch (e) { setError(tamilApiError(e)) } }
  const filtered = useMemo(() => records.filter(r => `${r.familyHeadName} ${r.villageName} ${r.district} ${r.phoneNumber}`.toLowerCase().includes(query.toLowerCase()) && (!district || r.district === district) && (!village || r.villageName === village)).sort((a,b) => sort === 'newest' ? new Date(b.createdAt)-new Date(a.createdAt) : new Date(a.createdAt)-new Date(b.createdAt)), [records, query, district, village, sort])
  const pageSize = 8, pages = Math.max(1, Math.ceil(filtered.length/pageSize)), rows = filtered.slice((page-1)*pageSize, page*pageSize)
  const totals = { members: records.reduce((n, r) => n + (r.members?.length || 0), 0), today: records.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length }
  if (path === '/admin/login') return withSnackbar(<main className="login-wrap"><form className="login-card" onSubmit={doLogin}><div className="seal">◈</div><p className="eyebrow">குடும்பப் பதிவு மேலாண்மை</p><h1>நிர்வாகி உள்நுழைவு</h1><label>பயனர் பெயர்<input autoComplete="username" value={login.username} onChange={e=>setLogin({...login,username:e.target.value})} required /></label><label>கடவுச்சொல்<input type="password" autoComplete="current-password" value={login.password} onChange={e=>setLogin({...login,password:e.target.value})} required /></label><button className="primary full" disabled={loginLoading}>{loginLoading && <span className="button-spinner" aria-hidden="true" />} {loginLoading ? "உள்நுழைகிறது..." : "உள்நுழைக"} {!loginLoading && <span>→</span>}</button><button type="button" className="text-button" onClick={()=>go('/')}>← பதிவு படிவத்திற்குத் திரும்பு</button></form></main>)
  if (path.startsWith('/admin') && !token) return withSnackbar(<main className="login-wrap"><div className="login-card"><h1>நிர்வாக அணுகல் தேவை</h1><p>இந்தப் பக்கத்தைப் பார்க்க நிர்வாகியாக உள்நுழையவும்.</p><button className="primary full" onClick={()=>go('/admin/login')}>உள்நுழைவு பக்கம்</button></div></main>)
  if (path === '/admin/dashboard' || path.startsWith('/admin/dashboard')) {
    const id = path.split('/')[3]; const record = selected || records.find(r => r._id === id)
    if (id && record) return withSnackbar(<><header className="admin-top no-print"><button className="brand" onClick={()=>go('/admin/dashboard')}><span className="mini-seal">◈</span> குடும்பப் பதிவேடு</button><div><button className="quiet" onClick={()=>printWithMemberName(record.members,record.familyHeadName)}>அச்சிடு ↗</button><button className="quiet" onClick={()=>go('/admin/dashboard')}>பதிவுகள்</button><button className="quiet" onClick={logout}>வெளியேறு</button></div></header><PrintRecord record={record} /></>)
    return withSnackbar(<div className="dashboard"><header className="admin-top"><button className="brand" onClick={()=>go('/admin/dashboard')}><span className="mini-seal">◈</span> குடும்பப் பதிவேடு <small>நிர்வாகம்</small></button><div><button className="quiet" onClick={()=>go('/')}>புதிய பதிவு +</button><button className="quiet" onClick={logout}>வெளியேறு ↗</button><button className="quiet refresh-button" onClick={loadRecords} disabled={recordsLoading}><span className={recordsLoading ? "refresh-icon spinning" : "refresh-icon"}>↻</span> புதுப்பிக்க</button></div></header><main className="dash-content"><div className="dash-heading"><div><p className="eyebrow">நிர்வாக பலகை / பதிவுகள்</p><h1>குடும்பப் பதிவுகள்</h1><p>பதிவுகளைப் பார்வையிட்டு நிர்வகிக்கவும்.</p></div><button className="primary" onClick={()=>go('/')}>+ புதிய குடும்பப் பதிவு</button></div><section className="stats"><div className="stat"><span>மொத்த குடும்பங்கள்</span><strong>{records.length}</strong><i>◫</i></div><div className="stat"><span>மொத்த உறுப்பினர்கள்</span><strong>{totals.members}</strong><i>♧</i></div><div className="stat"><span>இன்றைய பதிவுகள்</span><strong>{totals.today}</strong><i>◷</i></div></section><section className="record-panel"><div className="panel-head"><div><h2>அனைத்து பதிவுகள்</h2><p>{filtered.length} குடும்பங்கள் பட்டியலிடப்பட்டுள்ளன</p></div><span className="live-dot">● நேரடி தரவு</span></div><div className="filters"><label className="search">⌕<input placeholder="பெயர், ஊர், மாவட்டம் தேடுக" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} /></label><select value={district} onChange={e=>setDistrict(e.target.value)}><option value="">அனைத்து மாவட்டங்கள்</option>{[...new Set(records.map(r=>r.district).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select><select value={village} onChange={e=>setVillage(e.target.value)}><option value="">அனைத்து ஊர்கள்</option>{[...new Set(records.map(r=>r.villageName).filter(Boolean))].map(x=><option key={x}>{x}</option>)}</select><select value={sort} onChange={e=>setSort(e.target.value)}><option value="newest">புதியவை முதலில்</option><option value="oldest">பழையவை முதலில்</option></select></div><div className="table-scroll"><table className="admin-table"><thead><tr><th>குடும்பத் தலைவர்</th><th>ஊர்</th><th>மாவட்டம்</th><th>தொலைபேசி</th><th>உறுப்பினர்கள்</th><th>பதிவு தேதி</th><th>செயல்கள்</th></tr></thead><tbody>{rows.map(r=><tr key={r._id}><td><strong>{r.familyHeadName}</strong><small>பதிவு #{r._id?.slice(-6).toUpperCase()}</small></td><td>{r.villageName}</td><td>{r.district}</td><td>{r.phoneNumber||'—'}</td><td><span className="count-pill">{r.members?.length||0}</span></td><td>{new Date(r.createdAt).toLocaleDateString('ta-IN')}</td><td className="actions"><button title="பார்க்க" onClick={()=>{setSelected(r);go(`/admin/dashboard/${r._id}`)}}>காண்க</button><button title="திருத்த" onClick={()=>{setFamily({...r,members:[...(r.members||[])]});go(`/admin/edit/${r._id}`)}}>திருத்து</button><button className="danger-link" title="நீக்கு" onClick={()=>deleteRecord(r._id)}>நீக்கு</button></td></tr>)}</tbody></table>{rows.length===0&&<div className="empty">பதிவுகள் எதுவும் இல்லை</div>}</div><div className="pagination"><span>{filtered.length?`${(page-1)*pageSize+1}–${Math.min(page*pageSize,filtered.length)} / ${filtered.length}`:'0 பதிவுகள்'}</span><div><button disabled={page<=1} onClick={()=>setPage(page-1)}>← முந்தைய</button><span>பக்கம் {page} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(page+1)}>அடுத்து →</button></div></div></section></main></div>)
  }
  const editId = path.startsWith('/admin/edit/') ? path.split('/').pop() : null
  return withSnackbar(<PublicForm family={family} setFamily={setFamily} update={update} updateMember={updateMember} submitFamily={submitFamily} submitting={submitting} printDocument={()=>printWithMemberName(family.members,family.familyHeadName)} go={go} notice={notice} error={error} />)
}
export default App











