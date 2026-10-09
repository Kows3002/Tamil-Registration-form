import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import Registration from './FamilyRegistration'
import CommunityRecords from './CommunityRecords'
import AdminLogin from './AdminLogin'
import RegistrationReports from './RegistrationReports'
import RegistrationTemplateEditor from './RegistrationTemplateEditor'
import './App.css'
import './CommunityAdmin.css'
import './PortalEnhancements.css'

const SESSION_MS = 60 * 60 * 1000
const DEFAULT_SLUG = 'krishnan-community'
const ALL_COMMUNITIES = { _id: '', name: 'All communities', slug: '' }
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

function Brand({ name = 'Sangam', compact = false }) {
  return <div className={`brand-mark ${compact ? 'compact' : ''}`}><span className="brand-icon">S</span><span><strong>{name}</strong>{!compact && <small>COMMUNITY RECORDS</small>}</span></div>
}
function Toast({ toast, close }) {
  useEffect(() => { if (!toast) return; const timer = setTimeout(close, 4400); return () => clearTimeout(timer) }, [toast, close])
  return toast ? <div className={`toast ${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><span className="toast-icon">{toast.type === 'error' ? '!' : '✓'}</span><span>{toast.message}</span><button onClick={close} aria-label="Dismiss notification">×</button></div> : null
}
function AdminShell({ admin, community, setCommunity, communities, onLogout, path, go, children }) {
  const canReport = ['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'VIEWER'].includes(admin?.role)
  const nav = [
    { title: 'Records', items: [['dashboard', 'Overview', '01'], ['families', 'Family register', '02'], ['requests', 'Help requests', '03'], ['contributions', 'Contributions', '04'], ...(canReport ? [['reports', 'District & community reports', '05']] : [])] },
    ...(['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER'].includes(admin?.role) ? [{ title: 'Configure', items: [['form-builder', 'Registration form', '06']] }] : []),
  ]
  return <div className="admin-layout"><aside className="sidebar"><a href="/admin"><Brand /></a><div className="workspace-label">WORKSPACE</div><label className="community-select-label">COMMUNITY FILTER<select value={community?._id || ''} onChange={event => setCommunity(communities.find(item => item._id === event.target.value) || ALL_COMMUNITIES)} aria-label="Select community"><option value="">All communities</option>{communities.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label><nav className="side-nav">{nav.map(group => <div className="nav-group" key={group.title}><span>{group.title}</span>{group.items.map(([key, label, icon]) => <button key={key} className={(path.includes(key) || (key === 'dashboard' && path === '/admin')) ? 'selected' : ''} onClick={() => go(key === 'dashboard' ? '/admin' : `/admin/${key}`)}><i>{icon}</i>{label}</button>)}</div>)}</nav><div className="sidebar-bottom"><div className="help-card"><span>Need a hand?</span><small>Visit the help center for setup guidance.</small><button onClick={() => go('/admin/help')}>Open help center ↗</button></div><div className="profile-button"><span className="avatar">{(admin?.username || 'A').slice(0, 1).toUpperCase()}</span><span><strong>{admin?.username}</strong><small>{(admin?.role || '').replaceAll('_', ' ').toLowerCase()}</small></span><button onClick={onLogout} aria-label="Log out" title="Log out">↗</button></div></div></aside><div className="admin-main"><header className="topbar"><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{path === '/admin' ? 'Overview' : (/^[a-f0-9]{24}$/.test(path.split('/').pop()) ? 'Family information' : path.endsWith('/form-builder') ? 'Registration form' : path.split('/').pop().replaceAll('-', ' ').replace(/\b\w/g, char => char.toUpperCase()))}</strong></div><div className="top-actions"><select className="mobile-community-switcher" value={community?._id || ''} onChange={event => setCommunity(communities.find(item => item._id === event.target.value) || ALL_COMMUNITIES)} aria-label="Select community"><option value="">All communities</option>{communities.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select><button className="icon-button" aria-label="Notifications">♧<i /></button><button className="button secondary top-logout" onClick={onLogout}>Log out</button><span className="top-divider" /><button className="avatar top-avatar">{(admin?.username || 'A').slice(0, 1).toUpperCase()}</button></div></header><main className="admin-content">{children}</main></div></div>
}

function PageHeader({ eyebrow, title, description, action }) { return <div className="page-header"><div><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div> }
function RegistrationFormWorkspace({ community, communities, setCommunity, token, onToast }) {
  if (community?._id) return <FormBuilder key={community._id} community={community} token={token} onToast={onToast} />
  return <><PageHeader eyebrow="FORM CONFIGURATION" title="Registration form" description="Choose a community to edit its registration form, publish changes and get its registration link." /><section className="content-panel profile-form"><div className="panel-title"><div><h2>Select community</h2><p>Each community has its own form and registration link.</p></div></div><div className="profile-fields"><label>Community<select value="" onChange={event => { const selected = communities.find(item => item._id === event.target.value); if (selected) setCommunity(selected) }}><option value="" disabled>Select a community</option>{communities.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></div></section></>
}
function FormBuilder({ community, token, onToast }) {
  const [config, setConfig] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [dirty, setDirty] = useState(false)
  const editSections = update => { setSections(update); setDirty(true) }
  const load = useCallback(() => { if (!community?._id) return; setLoading(true); setLoadError(''); api(`/communities/${community._id}/forms`, { token, communityId: community._id }).then(data => { if (!data?.versions?.length) throw new Error('No registration template was returned. Restart the backend and try again.'); setConfig(data); const editing = [...data.versions].filter(version => version.status === 'DRAFT' && version.version > data.activeVersion).sort((a, b) => b.version - a.version)[0] || data.versions.find(version => version.version === data.activeVersion); if (!editing?.sections?.length) throw new Error('The registration template has no sections.'); setSections(JSON.parse(JSON.stringify(editing.sections))); setDirty(false) }).catch(error => setLoadError(error.message)).finally(() => setLoading(false)) }, [community, token])
  useEffect(() => { load() }, [load])
  const saveDraft = async () => { setSaving(true); try { const next = await api(`/communities/${community._id}/forms/drafts`, { token, communityId: community._id, method: 'POST', body: JSON.stringify({ sections }) }); setConfig(next); setDirty(false); onToast('Draft saved. Published registrations keep using their current version.', 'success') } catch (error) { onToast(error.message, 'error') } finally { setSaving(false) } }
  const copyRegistrationLink = async () => {
    try { await navigator.clipboard.writeText(`${location.origin}/register/${community.slug}`); onToast('Registration URL copied.', 'success') }
    catch { onToast('Could not copy the link. Select and copy the displayed public form URL.', 'error') }
  }
  const publish = async () => {
    setSaving(true)
    try {
      const saved = await api(`/communities/${community._id}/forms/drafts`, { token, communityId: community._id, method: 'POST', body: JSON.stringify({ sections }) })
      setConfig(saved)
      const draft = [...saved.versions].filter(version => version.status === 'DRAFT').sort((a, b) => b.version - a.version)[0]
      const next = await api(`/communities/${community._id}/forms/${draft._id}/publish`, { token, communityId: community._id, method: 'POST' })
      setConfig(next); onToast('Changes published. The public registration link now shows the updated form.', 'success'); load()
    } catch (error) { onToast(error.message, 'error') }
    finally { setSaving(false) }
  }

  if (loading) return <div className="loading-row"><span className="spinner" /> Loading form builder…</div>
  if (loadError || !config) return <section className="content-panel"><div className="panel-title"><div><h2>Registration form could not be loaded</h2><p role="alert">{loadError || 'The existing form configuration is unavailable.'}</p></div><button className="button secondary" onClick={load}>Try again</button></div></section>
  const active = config.versions.find(version => version.version === config.activeVersion)
  const draft = config.versions.some(version => version.status === 'DRAFT' && version.version > config.activeVersion)
  return <><PageHeader eyebrow="FORM CONFIGURATION" title="Registration form" description={`${community.name} - Published version ${active?.version || 1}`} action={<div className="page-actions"><span className="badge draft">{dirty ? 'UNSAVED CHANGES' : draft ? 'DRAFT SAVED' : 'PUBLISHED'}</span><a className="button secondary" href={`/preview/${community.slug}`} target="_blank" rel="noreferrer">Preview published form</a><button className="button secondary" onClick={copyRegistrationLink}>Copy registration link</button><button className="button secondary" onClick={saveDraft} disabled={saving || !dirty}>{saving ? 'Saving...' : 'Save draft'}</button><button className="button primary" onClick={publish} disabled={saving || (!dirty && !draft)}>Save & publish</button></div>} /><fieldset className="template-editor-container" disabled={saving}><RegistrationTemplateEditor community={community} sections={sections} setSections={editSections} /></fieldset><div className="community-register-link"><div><h2>Published registration link</h2><p>Share this link with families after publishing your changes.</p><a href={`/register/${community.slug}`} target="_blank" rel="noreferrer">{location.origin}/register/{community.slug}</a></div><button className="button secondary" onClick={copyRegistrationLink}>Copy link</button></div></>
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
  const refreshCommunities = useCallback(async () => { const values = await api('/communities', { token: sessionToken }); setCommunities(values); setCommunity(current => values.find(item => item._id === current?._id) || ALL_COMMUNITIES); return values }, [sessionToken])
  useEffect(() => { if (sessionToken && adminId) refreshCommunities().catch(error => notify(error.message, 'error')) }, [sessionToken, adminId, refreshCommunities, notify])
  const login = async (username, password) => { const result = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); const value = { token: result.token, expiresAt: Math.min(Date.now() + SESSION_MS, getTokenExpiry(result.token)), admin: result.admin }; localStorage.setItem('sangam.adminSession', JSON.stringify(value)); setSession(value); setAdmin(value.admin); setAuthLoading(true); go('/admin/dashboard') }
  const logout = () => { clearStoredSession(); setSession(blankSession()); setAdmin(null); setCommunity(null); setCommunities([]); go('/admin/login') }
  if (route.isAdmin && route.path !== '/admin/login' && (!session.token || !admin || !community || authLoading)) {
    if (route.path !== '/admin/login' && !session.token) { history.replaceState({}, '', '/admin/login'); if (path !== '/admin/login') setPath('/admin/login') }
    return <><div className="auth-loading"><span className="spinner" /> Preparing your workspace…</div><Toast toast={toast} close={closeToast} /></>
  }
  if (route.path === '/admin/login') {
    if (session.token && admin) { history.replaceState({}, '', '/admin/dashboard'); if (path !== '/admin/dashboard') setPath('/admin/dashboard'); return <div className="auth-loading"><span className="spinner" /> Opening your workspace…</div> }
    return <><AdminLogin onLogin={login} onToast={notify} loading={authLoading} /><Toast toast={toast} close={closeToast} /></>
  }
  if (route.isAdmin) {
    let page
    if (route.path === '/admin' || route.path === '/admin/dashboard') page = <CommunityRecords mode="overview" community={community} token={session.token} go={go} onToast={notify} adminRole={admin.role} />
    else if (route.path === '/admin/reports') page = ['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER', 'VIEWER'].includes(admin.role) ? <RegistrationReports token={session.token} onToast={notify} onOpenFamily={record => { const target = communities.find(item => item._id === record.communityId); if (!target) { notify('This community is inactive or unavailable.', 'error'); return } setCommunity(target); go(`/admin/families/${record._id}`) }} /> : <AccessDenied />
    else if (route.path === '/admin/form-builder') page = ['SUPER_ADMIN', 'COMMUNITY_ADMIN', 'COMMUNITY_MANAGER'].includes(admin.role) ? <RegistrationFormWorkspace community={community} communities={communities} setCommunity={setCommunity} token={session.token} onToast={notify} /> : <AccessDenied />
    else if (route.path === '/admin/families') page = <CommunityRecords community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (['/admin/requests', '/admin/contributions'].includes(route.path)) page = <CommunityRecords mode={route.section} community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (/^\/admin\/families\/[a-f0-9]{24}$/.test(route.path)) page = <CommunityRecords recordId={route.path.split('/').pop()} community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (['/admin/members', '/admin/locations', '/admin/users', '/admin/settings', '/admin/communities'].includes(route.path)) page = <CommunityRecords community={community} token={session.token} onToast={notify} go={go} adminRole={admin.role} />
    else if (route.path === '/admin/preview') page = <Registration key={community.slug} slug={community.slug} preview onToast={notify} />
    else page = <ComingSoon path={route.path} />
    return <><AdminShell admin={admin} community={community} setCommunity={setCommunity} communities={communities} onLogout={logout} path={route.path} go={go}>{page}</AdminShell><Toast toast={toast} close={closeToast} /></>
  }
  if (route.path.startsWith('/preview/')) return <><Registration key={route.slug} slug={route.slug} preview onToast={notify} /><Toast toast={toast} close={closeToast} /></>
  if (route.path === '/') return <><Registration key={DEFAULT_SLUG} slug={DEFAULT_SLUG} onToast={notify} onCommunityChange={slug => go(`/register/${slug}`)} /><Toast toast={toast} close={closeToast} /></>
  return <><Registration key={route.slug} slug={route.slug} onToast={notify} onCommunityChange={slug => go(`/register/${slug}`)} /><Toast toast={toast} close={closeToast} /></>
}

function AccessDenied() { return <section className="content-panel access-denied"><span>403</span><h2>Platform access required</h2><p>Only a platform administrator can manage communities.</p></section> }
function ComingSoon({ path }) { const title = path.split('/').pop().replaceAll('-', ' '); return <><PageHeader eyebrow="COMMUNITY WORKSPACE" title={title.replace(/\b\w/g, letter => letter.toUpperCase())} description="This workspace is ready for the next platform module." /><section className="content-panel module-placeholder"><span className="module-icon">✳</span><h2>Your workspace is ready to grow</h2><p>This area will use the selected community's permissions and data scope.</p><span className="badge draft">FOUNDATION READY</span></section></> }
