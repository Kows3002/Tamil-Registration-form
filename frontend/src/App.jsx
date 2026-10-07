import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Registration from './FamilyRegistration'
import CommunityRecords from './CommunityRecords'
import LocationDirectory from './LocationDirectory'
import './App.css'
import './CommunityAdmin.css'

const SESSION_MS = 60 * 60 * 1000
const DEFAULT_SLUG = 'krishnan-community'
const blankSession = () => ({ token: '', expiresAt: 0, admin: null })
function clearStoredSession() { localStorage.removeItem('sangam.adminSession'); localStorage.removeItem('adminToken'); localStorage.removeItem('adminLoginAt'); localStorage.removeItem('adminExpiresAt') }
function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem('sangam.adminSession') || 'null')
    localStorage.removeItem('adminToken'); localStorage.removeItem('adminLoginAt'); localStorage.removeItem('adminExpiresAt')
    if (!value?.token || !value?.expiresAt || value.expiresAt <= Date.now()) { clearStoredSession(); return blankSession() }
    return value
  } catch { clearStoredSession(); return blankSession() }
}
function getTokenExpiry(token) {
  try { const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'); return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).exp * 1000 }
  catch { return Date.now() + SESSION_MS }
}
const slugFromPath = path => path.match(/^\/(?:register|preview)\/([^/]+)/)?.[1] || DEFAULT_SLUG
const routeInfo = path => ({ path, slug: slugFromPath(path), isAdmin: path.startsWith('/admin'), section: path.split('/')[2] || 'dashboard' })
const makeKey = label => String(label || 'field').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48) || `field_${Date.now()}`

function Brand({ name = 'Sangam', compact = false }) {
  return <div className={`brand-mark ${compact ? 'compact' : ''}`}><span className="brand-icon">S</span><span><strong>{name}</strong>{!compact && <small>COMMUNITY RECORDS</small>}</span></div>
}
function Toast({ toast, close }) {
  useEffect(() => { if (!toast) return; const timer = setTimeout(close, 4400); return () => clearTimeout(timer) }, [toast, close])
  return toast ? <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><span className="toast-icon">{toast.type === 'error' ? '!' : '✓'}</span><span>{toast.message}</span><button onClick={close} aria-label="Dismiss notification">×</button></div> : null
}
function Login({ onLogin, onToast, loading }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const submit = async event => { event.preventDefault(); setSubmitting(true); try { await onLogin(username, password) } catch (error) { onToast(error.message, 'error') } finally { setSubmitting(false) } }
  return <main className="login-page"><header className="login-header"><a href="/"><Brand /></a><a className="back-link" href="/">Back to family registration</a></header><section className="login-main"><div className="login-box"><span className="overline">ADMINISTRATION</span><h1>Sign in to Sangam</h1><p>Use your administrator account to open the community workspace.</p><form onSubmit={submit}><label>Email or username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /></label><button className="button primary wide" disabled={submitting || loading}>{submitting ? <><span className="spinner light" /> Signing in...</> : 'Sign in'}</button></form><div className="login-security">Your session lasts for one hour.</div></div><footer className="login-footer">For account access, contact your community administrator.</footer></section><footer className="login-bottom">Sangam / Community records</footer></main>
}

function AdminShell({ admin, community, setCommunity, communities, onLogout, path, go, children }) {
  const isSuper = admin?.role === 'SUPER_ADMIN'
  const nav = [
    { title: 'Community', items: [['dashboard', 'Overview', '01'], ['families', 'Family register', '02'], ['members', 'Members', '03'], ['requests', 'Help requests', '04'], ['contributions', 'Contributions', '05']] },
    { title: 'Configure', items: [['locations', 'Location directory', '06'], ['form-builder', 'Registration form', '07'], ['settings', 'Community profile', '08'], ...(isSuper ? [['users', 'Users & roles', '09']] : [])] },
  ]
  return <div className="admin-layout"><aside className="sidebar"><a href="/admin"><Brand /></a><div className="workspace-label">WORKSPACE</div><label className="community-select-label">ACTIVE COMMUNITY<select value={community?._id || ''} onChange={event => setCommunity(communities.find(item => item._id === event.target.value) || null)} aria-label="Select community">{communities.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><nav className="side-nav">{nav.map(group => <div className="nav-group" key={group.title}><span>{group.title}</span>{group.items.map(([key, label, icon]) => <button key={key} className={(path.includes(key) || (key === 'dashboard' && path === '/admin')) ? 'selected' : ''} onClick={() => go(key === 'dashboard' ? '/admin' : `/admin/${key}`)}><i>{icon}</i>{label}</button>)}</div>)}{isSuper && <div className="nav-group"><span>Platform</span><button className={path.includes('communities') ? 'selected' : ''} onClick={() => go('/admin/communities')}><i>◫</i>Communities</button></div>}</nav><div className="sidebar-bottom"><div className="help-card"><span>Need a hand?</span><small>Visit the help center for setup guidance.</small><button onClick={() => go('/admin/help')}>Open help center ↗</button></div><div className="profile-button"><span className="avatar">{(admin?.username || 'A').slice(0, 1).toUpperCase()}</span><span><strong>{admin?.username}</strong><small>{(admin?.role || '').replaceAll('_', ' ').toLowerCase()}</small></span><button onClick={onLogout} aria-label="Log out" title="Log out">↗</button></div></div></aside><div className="admin-main"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{path === '/admin' ? 'Overview' : (/^[a-f0-9]{24}$/.test(path.split('/').pop()) ? 'Family information' : path.split('/').pop().replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase()))}</strong></div><div className="top-actions"><select className="mobile-community-switcher" value={community?._id || ''} onChange={event => setCommunity(communities.find(item => item._id === event.target.value) || null)} aria-label="Select community">{communities.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select><button className="icon-button" aria-label="Notifications">♧<i /></button><button className="button secondary top-logout" onClick={onLogout}>Log out</button><span className="top-divider" /><button className="avatar top-avatar">{(admin?.username || 'A').slice(0, 1).toUpperCase()}</button></div></header><main className="admin-content">{children}</main></div></div>
}

function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function EmptyTable({ message = 'Nothing here yet.' }) { return <div className="empty-table"><span>⌕</span><strong>{message}</strong><small>When new records are available, they will appear here.</small></div> }

function Communities({ token, communities, refresh, onToast, setCommunity, go }) {
  const [form, setForm] = useState({ name: '', code: '', description: '', primaryColor: '#2457c5' })
  const [saving, setSaving] = useState(false)
  const submit = async event => { event.preventDefault(); setSaving(true); try { const community = await api('/communities', { token, method: 'POST', body: JSON.stringify(form) }); await refresh(); setCommunity(community); setForm({ name: '', code: '', description: '', primaryColor: '#2457c5' }); onToast(`${community.name} is ready. Its registration form was created.`, 'success') } catch (error) { onToast(error.message, 'error') } finally { setSaving(false) } }
  return <><PageHeader eyebrow="PLATFORM MANAGEMENT" title="Communities" description="Create and manage independent community workspaces." /><div className="community-layout"><section className="content-panel"><div className="panel-title"><div><h2>All communities</h2><p>{communities.length} workspaces</p></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>COMMUNITY</th><th>CODE</th><th>PUBLIC REGISTRATION</th><th>STATUS</th><th /></tr></thead><tbody>{communities.map(item => <tr key={item._id}><td><div className="community-row"><span className="community-avatar small-avatar" style={{ background: item.branding?.secondaryColor }}>{item.name.slice(0, 1)}</span><span><strong>{item.name}</strong><small>/{item.slug}</small></span></div></td><td><span className="badge count">{item.code}</span></td><td><a href={`/register/${item.slug}`} target="_blank" rel="noreferrer">Open form ↗</a></td><td><span className={`badge ${item.status === 'ACTIVE' ? 'verified' : 'pending'}`}>{item.status}</span></td><td><button className="button text small" onClick={() => { setCommunity(item); go('/admin/dashboard') }}>Open workspace →</button></td></tr>)}</tbody></table></div></section><section className="content-panel create-community"><div className="panel-title"><div><h2>Create a community</h2><p>Each community gets its own workspace and starter form.</p></div></div><form onSubmit={submit}><label>Community name<input value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="e.g. Salem Community" required /></label><label>Community code<input value={form.code} onChange={event => setForm({ ...form, code: event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') })} placeholder="SALEM-01" minLength="2" maxLength="24" required /></label><label>Description<textarea rows="3" value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} placeholder="A short introduction" /></label><label>Primary color<input type="color" value={form.primaryColor} onChange={event => setForm({ ...form, primaryColor: event.target.value })} /></label><button className="button primary wide" disabled={saving}>{saving ? 'Creating…' : 'Create community'}</button></form></section></div></>
}

const COMMUNITY_ROLES = ['COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'DATA_ENTRY_OPERATOR', 'VERIFIER', 'VIEWER']
function UsersRoles({ token, communities, onToast }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', role: 'COMMUNITY_ADMIN', communityIds: [] })
  const load = useCallback(() => { setLoading(true); api('/admin/users', { token }).then(setUsers).catch(error => onToast(error.message, 'error')).finally(() => setLoading(false)) }, [token, onToast])
  useEffect(() => { load() }, [load])
  const submit = async event => { event.preventDefault(); setSaving(true); try { await api('/admin/users', { token, method: 'POST', body: JSON.stringify(form) }); setForm({ username: '', password: '', role: 'COMMUNITY_ADMIN', communityIds: [] }); await load(); onToast('Community user created.', 'success') } catch (error) { onToast(error.message, 'error') } finally { setSaving(false) } }
  const updateUser = async (user, changes) => { try { await api(`/admin/users/${user._id}`, { token, method: 'PATCH', body: JSON.stringify(changes) }); await load(); onToast('User permissions updated.', 'success') } catch (error) { onToast(error.message, 'error') } }
  const toggleCommunity = id => setForm(current => ({ ...current, communityIds: current.communityIds.includes(id) ? current.communityIds.filter(value => value !== id) : [...current.communityIds, id] }))
  return <><PageHeader eyebrow="ACCESS CONTROL" title="Users & roles" description="Give each team member access to only the communities and tools they need." /><div className="user-admin-layout"><section className="content-panel"><div className="panel-title"><div><h2>Admin accounts</h2><p>{users.length} team members</p></div><button className="button secondary small" onClick={load}>↻ Refresh</button></div>{loading ? <div className="loading-row"><span className="spinner" /> Loading users…</div> : users.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>USER</th><th>ROLE</th><th>COMMUNITIES</th><th>STATUS</th><th>ADDED</th></tr></thead><tbody>{users.map(user => <tr key={user._id}><td><strong>{user.username}</strong><small>{user._id.slice(-8).toUpperCase()}</small></td><td><select className="role-select" value={user.role} onChange={event => updateUser(user, { role: event.target.value })}>{COMMUNITY_ROLES.map(role => <option key={role}>{role}</option>)}</select></td><td>{(user.communityIds || []).map(id => communities.find(item => item._id === id)?.name).filter(Boolean).join(', ') || '—'}</td><td><button className={`badge ${user.status === 'ACTIVE' ? 'verified' : 'pending'} status-button`} onClick={() => updateUser(user, { status: user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' })}>{user.status}</button></td><td>{new Date(user.createdAt).toLocaleDateString('en-IN')}</td></tr>)}</tbody></table></div> : <EmptyTable message="No admin accounts found" />}</section><section className="content-panel create-community"><div className="panel-title"><div><h2>Invite a teammate</h2><p>Create an account and assign access.</p></div></div><form onSubmit={submit}><label>Username<input autoComplete="off" value={form.username} onChange={event => setForm({ ...form, username: event.target.value })} placeholder="name@community.org" required /></label><label>Temporary password<input autoComplete="new-password" type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} minLength="12" placeholder="At least 12 characters" required /></label><label>Role<select value={form.role} onChange={event => setForm({ ...form, role: event.target.value })}>{COMMUNITY_ROLES.map(role => <option key={role} value={role}>{role.replaceAll('_', ' ')}</option>)}</select></label><fieldset className="community-checkboxes"><legend>Community access</legend>{communities.map(item => <label key={item._id}><input type="checkbox" checked={form.communityIds.includes(item._id)} onChange={() => toggleCommunity(item._id)} />{item.name}</label>)}</fieldset><button className="button primary wide" disabled={saving}>{saving ? 'Creating…' : 'Create account'}</button></form></section></div></>
}

function CommunityProfile({ community, token, updateCommunity, onToast }) {
  const [profile, setProfile] = useState({ name: community.name || '', description: community.description || '', branding: { primaryColor: community.branding?.primaryColor || '#2457c5', secondaryColor: community.branding?.secondaryColor || '#e9efff' }, contact: { ...(community.contact || {}) } })
  const [saving, setSaving] = useState(false)
  useEffect(() => { setProfile({ name: community.name || '', description: community.description || '', branding: { primaryColor: community.branding?.primaryColor || '#2457c5', secondaryColor: community.branding?.secondaryColor || '#e9efff' }, contact: { ...(community.contact || {}) } }) }, [community])
  const submit = async event => { event.preventDefault(); setSaving(true); try { const value = await api(`/communities/${community._id}/profile`, { token, communityId: community._id, method: 'PATCH', body: JSON.stringify(profile) }); updateCommunity(value); onToast('Community profile saved.', 'success') } catch (error) { onToast(error.message, 'error') } finally { setSaving(false) } }
  return <><PageHeader eyebrow="COMMUNITY SETTINGS" title="Community profile" description="Manage the identity and public details shown to your members." /><form className="content-panel profile-form" onSubmit={submit}><div className="panel-title"><div><h2>Public identity</h2><p>Your registration experience reflects these details.</p></div><span className="badge verified">{community.status}</span></div><div className="profile-fields"><label>Community name<input value={profile.name} onChange={event => setProfile({ ...profile, name: event.target.value })} required /></label><label>Community code<input value={community.code} disabled /></label><label className="profile-description">Description<textarea rows="3" value={profile.description} onChange={event => setProfile({ ...profile, description: event.target.value })} placeholder="Introduce your community" /></label><label>Primary color<input type="color" value={profile.branding.primaryColor} onChange={event => setProfile({ ...profile, branding: { ...profile.branding, primaryColor: event.target.value } })} /></label><label>Secondary color<input type="color" value={profile.branding.secondaryColor} onChange={event => setProfile({ ...profile, branding: { ...profile.branding, secondaryColor: event.target.value } })} /></label><label>Contact name<input value={profile.contact.name || ''} onChange={event => setProfile({ ...profile, contact: { ...profile.contact, name: event.target.value } })} /></label><label>Contact phone<input type="tel" value={profile.contact.phone || ''} onChange={event => setProfile({ ...profile, contact: { ...profile.contact, phone: event.target.value } })} /></label><label>Contact email<input type="email" value={profile.contact.email || ''} onChange={event => setProfile({ ...profile, contact: { ...profile.contact, email: event.target.value } })} /></label></div><div className="profile-actions"><span className="profile-link">Public form: <a href={`/register/${community.slug}`} target="_blank" rel="noreferrer">/register/{community.slug} ↗</a></span><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div></form></>
}

const FIELD_TYPES = ['text', 'textarea', 'number', 'phone', 'email', 'date', 'select', 'checkbox', 'location', 'members', 'support', 'contribution']
function FormBuilder({ community, token, onToast }) {
  const [config, setConfig] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(null)
  const load = useCallback(() => { if (!community?._id) return; setLoading(true); api(`/communities/${community._id}/forms`, { token, communityId: community._id }).then(data => { setConfig(data); const editing = [...data.versions].filter(version => version.status === 'DRAFT').sort((a, b) => b.version - a.version)[0] || data.versions.find(version => version.version === data.activeVersion); setSections(JSON.parse(JSON.stringify(editing?.sections || []))) }).catch(error => onToast(error.message, 'error')).finally(() => setLoading(false)) }, [community, token, onToast])
  useEffect(() => { load() }, [load])
  const setField = (sectionIndex, fieldIndex, key, value) => setSections(current => current.map((section, i) => i !== sectionIndex ? section : { ...section, fields: section.fields.map((field, j) => j !== fieldIndex ? field : { ...field, [key]: value }) }))
  const addSection = () => setSections(current => [...current, { key: `section_${Date.now()}`, title: 'New section', description: '', order: current.length + 1, enabled: true, fields: [] }])
  const addField = sectionIndex => setSections(current => current.map((section, i) => i !== sectionIndex ? section : { ...section, fields: [...section.fields, { key: `custom_${Date.now()}`, label: 'New question', type: 'text', required: false, visible: true, order: section.fields.length + 1 }] }))
  const saveDraft = async () => { setSaving(true); try { const next = await api(`/communities/${community._id}/forms/drafts`, { token, communityId: community._id, method: 'POST', body: JSON.stringify({ sections }) }); setConfig(next); onToast('Draft saved. Published registrations keep using their current version.', 'success') } catch (error) { onToast(error.message, 'error') } finally { setSaving(false) } }
  const publish = async () => {
    setSaving(true)
    try {
      const saved = await api(`/communities/${community._id}/forms/drafts`, { token, communityId: community._id, method: 'POST', body: JSON.stringify({ sections }) })
      setConfig(saved)
      const draft = [...saved.versions].filter(version => version.status === 'DRAFT').sort((a, b) => b.version - a.version)[0]
      const next = await api(`/communities/${community._id}/forms/${draft._id}/publish`, { token, communityId: community._id, method: 'POST' })
      setConfig(next); onToast('Registration form published.', 'success'); load()
    } catch (error) { onToast(error.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading-row"><span className="spinner" /> Loading form builder…</div>
  const active = config?.versions?.find(version => version.version === config?.activeVersion)
  return <><PageHeader eyebrow="FORM CONFIGURATION" title="Registration form" description={`${community?.name || 'Community'} · Version ${active?.version || 1} is live`} action={<div className="page-actions"><span className="badge draft">{config?.versions?.some(version => version.status === 'DRAFT') ? 'DRAFT' : 'PUBLISHED'}</span><a className="button secondary" href={`/preview/${community.slug}`} target="_blank" rel="noreferrer">Preview form ↗</a><button className="button secondary" onClick={saveDraft} disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button><button className="button primary" onClick={publish} disabled={saving}>Publish form</button></div>} /><div className="builder-layout"><aside className="builder-sections"><div className="builder-panel-heading"><span>FORM SECTIONS</span><button className="icon-button" onClick={addSection} aria-label="Add section">＋</button></div>{sections.map((section, index) => <button key={section._id || section.key} className={`builder-section ${selected?.section === index ? 'active' : ''}`} onClick={() => setSelected({ section: index })}><span className="builder-section-number">{String(index + 1).padStart(2, '0')}</span><span><strong>{section.title}</strong><small>{section.fields.length} fields</small></span><i>⌄</i></button>)}<button className="add-section" onClick={addSection}>＋ Add section</button></aside><section className="builder-canvas">{sections.length ? sections.map((section, sectionIndex) => <article className="builder-section-card" key={section._id || section.key}><div className="builder-card-head"><div><span className="overline">SECTION {String(sectionIndex + 1).padStart(2, '0')}</span><input className="builder-title-input" value={section.title} onChange={event => setSections(current => current.map((item, index) => index === sectionIndex ? { ...item, title: event.target.value, key: item.key || makeKey(event.target.value) } : item))} /><input className="builder-desc-input" value={section.description || ''} onChange={event => setSections(current => current.map((item, index) => index === sectionIndex ? { ...item, description: event.target.value } : item))} placeholder="Add a short description" /></div><button className="icon-button danger" onClick={() => setSections(current => current.filter((_, index) => index !== sectionIndex))} title="Remove section">×</button></div><div className="builder-fields">{section.fields.map((field, fieldIndex) => <div className={`builder-field ${selected?.section === sectionIndex && selected?.field === fieldIndex ? 'selected' : ''}`} key={field._id || field.key} onClick={() => setSelected({ section: sectionIndex, field: fieldIndex })}><span className="drag-handle">⠿</span><div className="builder-field-main"><input value={field.label} onChange={event => setField(sectionIndex, fieldIndex, 'label', event.target.value)} aria-label="Field label" /><small>{field.key}</small></div><select value={field.type} onChange={event => setField(sectionIndex, fieldIndex, 'type', event.target.value)} aria-label="Field type">{FIELD_TYPES.map(type => <option key={type} value={type}>{type.replace(/^./, first => first.toUpperCase())}</option>)}</select>{field.type === 'select' && <input className="builder-options" value={(field.options || []).join(', ')} onChange={event => setField(sectionIndex, fieldIndex, 'options', event.target.value.split(',').map(option => option.trim()).filter(Boolean))} aria-label="Choice options" placeholder="Choices, comma separated" />}<label className="required-toggle"><input type="checkbox" checked={field.required} onChange={event => setField(sectionIndex, fieldIndex, 'required', event.target.checked)} /> Required</label><button className="icon-button danger" onClick={event => { event.stopPropagation(); setSections(current => current.map((item, index) => index === sectionIndex ? { ...item, fields: item.fields.filter((_, fi) => fi !== fieldIndex) } : item)) }} aria-label="Remove field">×</button></div>)}</div><button className="add-field" onClick={() => addField(sectionIndex)}>＋ Add question</button></article>) : <EmptyTable message="Your form does not have any sections" />}</section><aside className="builder-settings"><span className="overline">FORM DETAILS</span><h3>Registration form</h3><p>Changes are saved as a new version. The form families currently use stays unchanged until you publish.</p><div className="setting-divider" /><span className="setting-label">PUBLISHED VERSION</span><strong>Version {active?.version || '—'}</strong><div className="setting-divider" /><span className="setting-label">PUBLIC FORM URL</span><a className="public-url" href={`/register/${community.slug}`} target="_blank" rel="noreferrer">/register/{community.slug} ↗</a><button className="button secondary wide" onClick={() => navigator.clipboard?.writeText(`${location.origin}/register/${community.slug}`).then(() => onToast('Registration URL copied.', 'success'))}>Copy registration link</button></aside></div></>
}

export default function App() {
  const [path, setPath] = useState(location.pathname)
  const [session, setSession] = useState(readSession)
  const [admin, setAdmin] = useState(session.admin)
  const [communities, setCommunities] = useState([])
  const [community, setCommunity] = useState(null)
  const [toast, setToast] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(session.token))
  const sessionToken = session.token
  const sessionExpiresAt = session.expiresAt
  const adminId = admin?._id
  const route = routeInfo(path)
  const notify = useCallback((message, type = 'success') => setToast({ message, type }), [])
  const closeToast = useCallback(() => setToast(null), [])
  const go = useCallback(url => { history.pushState({}, '', url); setPath(location.pathname) }, [])
  useEffect(() => { const onPop = () => setPath(location.pathname); addEventListener('popstate', onPop); return () => removeEventListener('popstate', onPop) }, [])
  const expire = useCallback(() => { clearStoredSession(); setSession(blankSession()); setAdmin(null); setCommunities([]); setCommunity(null); if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') { history.replaceState({}, '', '/admin/login'); setPath('/admin/login') } }, [])
  useEffect(() => {
    if (!sessionToken) { setAuthLoading(false); return }
    const delay = sessionExpiresAt - Date.now()
    if (delay <= 0) { expire(); return }
    let alive = true
    const timer = setTimeout(expire, delay)
    api('/admin/me', { token: sessionToken }).then(value => { if (alive) { setAdmin(value); setSession(current => ({ ...current, admin: value })); localStorage.setItem('sangam.adminSession', JSON.stringify({ token: sessionToken, expiresAt: sessionExpiresAt, admin: value })) } }).catch(() => { if (alive) expire() }).finally(() => { if (alive) setAuthLoading(false) })
    return () => { alive = false; clearTimeout(timer) }
  }, [sessionToken, sessionExpiresAt, expire])
  const refreshCommunities = useCallback(async () => { const values = await api('/communities', { token: sessionToken }); setCommunities(values); setCommunity(current => values.find(item => item._id === current?._id) || values[0] || null); return values }, [sessionToken])
  useEffect(() => { if (sessionToken && adminId) refreshCommunities().catch(error => notify(error.message, 'error')) }, [sessionToken, adminId, refreshCommunities, notify])
  const login = async (username, password) => { const result = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); const value = { token: result.token, expiresAt: Math.min(Date.now() + SESSION_MS, getTokenExpiry(result.token)), admin: result.admin }; localStorage.setItem('sangam.adminSession', JSON.stringify(value)); setSession(value); setAdmin(value.admin); setAuthLoading(true); go('/admin/dashboard') }
  const logout = () => { clearStoredSession(); setSession(blankSession()); setAdmin(null); setCommunity(null); setCommunities([]); go('/admin/login') }
  if (route.isAdmin && route.path !== '/admin/login' && (!session.token || !admin || !community || authLoading)) {
    if (route.path !== '/admin/login' && !session.token) { history.replaceState({}, '', '/admin/login'); if (path !== '/admin/login') setPath('/admin/login') }
    return <><div className="auth-loading"><span className="spinner" /> Preparing your workspace…</div><Toast toast={toast} close={closeToast} /></>
  }
  if (route.path === '/admin/login') {
    if (session.token && admin) { history.replaceState({}, '', '/admin/dashboard'); if (path !== '/admin/dashboard') setPath('/admin/dashboard'); return <div className="auth-loading"><span className="spinner" /> Opening your workspace…</div> }
    return <><Login onLogin={login} onToast={notify} loading={authLoading} /><Toast toast={toast} close={closeToast} /></>
  }
  if (route.isAdmin) {
    let page
    if (route.path === '/admin' || route.path === '/admin/dashboard') page = <CommunityRecords mode="overview" community={community} token={session.token} go={go} onToast={notify} adminRole={admin.role} />
    else if (route.path === '/admin/communities') page = admin.role === 'SUPER_ADMIN' ? <Communities token={session.token} communities={communities} refresh={refreshCommunities} onToast={notify} setCommunity={setCommunity} go={go} /> : <AccessDenied />
    else if (route.path === '/admin/form-builder') page = <FormBuilder community={community} token={session.token} onToast={notify} />
    else if (route.path === '/admin/locations') page = <LocationDirectory key={community._id} community={community} token={session.token} onToast={notify} adminRole={admin.role} />
    else if (route.path === '/admin/families') page = <CommunityRecords community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (['/admin/members', '/admin/requests', '/admin/contributions'].includes(route.path)) page = <CommunityRecords mode={route.section} community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (/^\/admin\/families\/[a-f0-9]{24}$/.test(route.path)) page = <CommunityRecords recordId={route.path.split('/').pop()} community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (route.path === '/admin/users') page = admin.role === 'SUPER_ADMIN' ? <UsersRoles token={session.token} communities={communities} onToast={notify} /> : <AccessDenied />
    else if (route.path === '/admin/settings') page = <CommunityProfile community={community} token={session.token} updateCommunity={value => { setCommunity(value); setCommunities(current => current.map(item => item._id === value._id ? value : item)) }} onToast={notify} />
    else if (route.path === '/admin/preview') page = <Registration key={community.slug} slug={community.slug} preview onToast={notify} />
    else page = <ComingSoon path={route.path} />
    return <><AdminShell admin={admin} community={community} setCommunity={setCommunity} communities={communities} onLogout={logout} path={route.path} go={go}>{page}</AdminShell><Toast toast={toast} close={closeToast} /></>
  }
  if (route.path.startsWith('/preview/')) return <><Registration key={route.slug} slug={route.slug} preview onToast={notify} /><Toast toast={toast} close={closeToast} /></>
  if (route.path === '/') return <><Registration key={DEFAULT_SLUG} slug={DEFAULT_SLUG} onToast={notify} /><Toast toast={toast} close={closeToast} /></>
  return <><Registration key={route.slug} slug={route.slug} onToast={notify} /><Toast toast={toast} close={closeToast} /></>
}

function AccessDenied() { return <section className="content-panel access-denied"><span>403</span><h2>Platform access required</h2><p>Only a platform administrator can manage communities.</p></section> }
function ComingSoon({ path }) { const title = path.split('/').pop().replaceAll('-', ' '); return <><PageHeader eyebrow="COMMUNITY WORKSPACE" title={title.replace(/\b\w/g, letter => letter.toUpperCase())} description="This workspace is ready for the next platform module." /><section className="content-panel module-placeholder"><span className="module-icon">✳</span><h2>Your workspace is ready to grow</h2><p>This area will use the selected community's permissions and data scope.</p><span className="badge draft">FOUNDATION READY</span></section></> }
