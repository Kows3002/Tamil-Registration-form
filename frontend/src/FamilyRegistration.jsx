import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import { Input, Members } from './CollectionFields'
import LocationFields from './LocationPicker'
import './RegistrationWorkspace.css'
import CommunitySelector from './CommunitySelector'
import './RegistrationPortal.css'
import RegistrationReview from './RegistrationReview'
import FamilyReceipt from './FamilyReceipt'

const SUPPORT = ['Education', 'Healthcare', 'Employment', 'Marriage arrangement', 'Food & essentials', 'Housing', 'Elder care', 'Disability support', 'Other']
const CONTRIBUTIONS = ['Volunteer time', 'Teaching & mentoring', 'Professional skills', 'Job opportunities', 'Marriage arrangement', 'Food & supplies', 'Financial support', 'Other']
const blank = () => ({ state: 'Tamil Nadu', stateCode: 'TN', settlementType: 'Rural', members: [{ name: '', relationship: 'Self', age: '' }], support: { needed: false, categories: [], priority: 'Routine', details: '' }, contribution: { willing: false, categories: [], details: '' }, consent: false })
const fieldsOf = section => section.fields.filter(field => field.visible !== false).sort((a, b) => a.order - b.order)

function CategoryDropdown({ label, choices, value, onChange }) {
  const [open, setOpen] = useState(false)
  return <div className="collection-field answer-dropdown"><span className="collection-label">{label} <b>*</b></span><button type="button" className="place-trigger" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}><span>{value.length ? value.join(', ') : 'Select one or more options'}</span><span>⌄</span></button>{open && <div className="answer-menu"><div role="listbox" aria-label={label} aria-multiselectable="true">{choices.map(choice => <button type="button" role="option" aria-selected={value.includes(choice)} key={choice} onClick={() => onChange(value.includes(choice) ? value.filter(item => item !== choice) : [...value, choice])}><span className="option-checkbox">{value.includes(choice) ? '✓' : ''}</span>{choice}</button>)}</div><button type="button" className="answer-done" onClick={() => setOpen(false)}>Done</button></div>}</div>
}
function Engagement({ kind, value, change }) {
  const support = kind === 'support', flag = support ? 'needed' : 'willing'
  const update = patch => change({ ...value, ...patch })
  return <div className="collection-grid">
    <Input id={`${kind}-decision`} label={support ? 'Does your family need community support?' : 'Would you like to contribute to the community?'} type="select" options={['Yes', 'No']} value={value[flag] ? 'Yes' : 'No'} onChange={answer => change(answer === 'Yes' ? { ...value, [flag]: true } : { [flag]: false, categories: [], details: '', priority: 'Routine' })} />
    {value[flag] && <><CategoryDropdown label={support ? 'Support categories' : 'Contribution categories'} choices={support ? SUPPORT : CONTRIBUTIONS} value={value.categories || []} onChange={categories => update({ categories })} />
      {support ? <Input id="support-priority" label="Priority" type="select" options={['Routine', 'Soon', 'Urgent']} value={value.priority || 'Routine'} onChange={priority => update({ priority })} /> : <><Input id="contribution-skills" label="Skill / resource" type="select" options={['Teaching', 'Healthcare', 'Technical work', 'Business guidance', 'Skilled trades', 'Driving', 'Food and supplies', 'Financial support', 'Other']} value={value.skills} onChange={skills => update({ skills })} /><Input id="contribution-availability" label="Availability" type="select" options={['Weekdays', 'Weekends', 'Evenings', 'Once a month', 'On request']} value={value.availability} onChange={availability => update({ availability })} /></>}
      <Input id={`${kind}-details`} label={support ? 'Request details' : 'Contribution details'} type="textarea" required value={value.details} onChange={details => update({ details })} />
    </>}
    <p className="form-note wide-field">{support ? 'Requests are reviewed by your community team. Providing details helps them follow up.' : 'This records your interest in contributing. No payment is taken through this form.'}</p>
  </div>
}

export function RegistrationField({ field, values, change, slug }) {
  const { key, ...inputProps } = field
  return key === 'members' ? <Members members={values.members} change={members => change({ members })} /> : field.type === 'location' ? <LocationFields values={values} change={change} communitySlug={slug} /> : ['support', 'contribution'].includes(field.type) ? <Engagement kind={field.type} value={values[key] || blank()[field.type]} change={value => change({ [key]: value })} /> : <Input {...inputProps} id={key} value={values[key]} onChange={value => change({ [key]: value })} />
}

export default function FamilyRegistration({ slug, preview = false, onToast, onCommunityChange }) {
  const [data, setData] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0), [values, setValues] = useState(blank), [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false), [receipt, setReceipt] = useState(null)
  const formRef = useRef(null), focusHeading = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    api(`/communities/public/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [slug, retry])
  const sections = useMemo(() => (data?.form?.sections || []).filter(section => section.enabled !== false).sort((a, b) => a.order - b.order), [data])
  const reload = () => { setLoading(true); setError(''); setData(null); setValues(blank()); setStep(0); setReceipt(null); setRetry(value => value + 1) }
  const section = sections[step]
  const change = useCallback(patch => setValues(current => ({ ...current, ...patch })), [])
  const done = field => field.key === 'members' ? values.members.every(member => Boolean((member.name || member.nameAddress)?.trim())) : field.type === 'location' ? Boolean(values.stateCode && values.districtId && values.villageName && /^[1-9]\d{5}$/.test(values.postalCode || '') && (values.settlementType === 'Urban' || (values.blockId && values.villagePanchayatId && values.habitationId))) : field.type === 'checkbox' ? values[field.key] === true : Boolean(String(values[field.key] ?? '').trim())
  const navigate = index => { setStep(index); window.scrollTo({ top: 0, behavior: 'smooth' }); requestAnimationFrame(() => focusHeading.current?.focus()) }
  const validate = () => {
    if (!formRef.current?.reportValidity()) return false
    if (section) {
      const missing = fieldsOf(section).find(field => field.required && !done(field))
      if (missing) { onToast(`Complete ${missing.label.toLowerCase()} before continuing.`, 'error'); return false }
      for (const field of fieldsOf(section)) if (['support', 'contribution'].includes(field.type)) {
        const item = values[field.key]
        if (item?.[field.type === 'support' ? 'needed' : 'willing'] && (!item.categories?.length || !item.details?.trim())) { onToast('Select a category and provide the details.', 'error'); return false }
      }
    }
    return true
  }
  const submit = async event => {
    event.preventDefault()
    if (!validate()) return
    if (step < sections.length) { navigate(step + 1); return }
    const missingSection = sections.findIndex(item => fieldsOf(item).some(field => (field.required && !done(field)) || (['support', 'contribution'].includes(field.type) && values[field.key]?.[field.type === 'support' ? 'needed' : 'willing'] && (!values[field.key].categories?.length || !values[field.key].details?.trim()))))
    if (missingSection >= 0) { navigate(missingSection); onToast('Complete the required details before submitting.', 'error'); return }
    if (!values.consent) { onToast('Confirm your consent before submitting.', 'error'); return }
    if (preview) { onToast('Preview only. Submissions are disabled.', 'info'); return }
    setSubmitting(true)
    try {
      const submission = { ...values, communitySlug: slug, communityId: data.community._id }
      if (!sections.some(item => fieldsOf(item).some(field => field.type === 'location'))) {
        delete submission.stateCode; delete submission.state; delete submission.settlementType
      }
      const saved = await api('/families', { method: 'POST', body: JSON.stringify(submission) })
      setReceipt(saved); onToast('Family information submitted successfully.'); window.scrollTo(0, 0)
    }
    catch (err) { onToast(err.message || 'Could not submit your details. Please try again.', 'error') }
    finally { setSubmitting(false) }
  }
  const labels = { primary: 'Primary & residential information', location: 'Residential location', members: 'Family members', household: 'Household details', support: 'Community support', contribution: 'Contributions' }
  const community = data?.community
  const completed = sections.filter(item => fieldsOf(item).filter(field => field.required).length && fieldsOf(item).filter(field => field.required).every(done)).length
  return <main className={`registration-workspace${preview ? ' registration-preview' : ''}`}>
    <header className="register-header"><a className="register-wordmark" href="/">Sangam<span>Family Registration Portal</span></a><div className="register-header-right"><span>குடும்பப் பதிவு</span><a href="/admin/login">Admin sign in <span aria-hidden="true">→</span></a></div></header>
    {!preview && <CommunitySelector slug={slug} disabled={submitting} onSelect={nextSlug => {
      if (nextSlug === slug) return
      if (JSON.stringify(values) !== JSON.stringify(blank()) && !window.confirm('Changing community will clear the family details entered in this form. Continue?')) return
      if (onCommunityChange) onCommunityChange(nextSlug)
      else window.location.assign(`/register/${nextSlug}`)
    }} />}
    {loading ? <div className="workspace-state" role="status"><span className="spinner" /><h1>Loading registration</h1><p>Retrieving your community form.</p></div> : error || !sections.length ? <div className="workspace-state" role="alert"><h1>Form unavailable</h1><p>{error || 'No published form is available.'}</p><button className="workspace-primary" onClick={reload}>Try again</button></div> : receipt ? <FamilyReceipt record={receipt} community={community} onToast={onToast} onNew={() => { setReceipt(null); setValues(blank()); setStep(0) }} />
      : <div className="register-body"><aside className="register-rail"><div className="register-community"><small>COMMUNITY</small><strong>{community.name}</strong><span>Family information register</span></div><nav aria-label="Registration sections">{[...sections, { key: 'review', title: 'Review & submit' }].map((item, index) => <button type="button" key={item.key} className={step === index ? 'current' : ''} aria-current={step === index ? 'step' : undefined} onClick={() => { if (index <= step || validate()) navigate(index) }}><span className="rail-number">{String(index + 1).padStart(2, '0')}</span><span>{item.title || labels[item.key]}</span>{index < step && <i aria-hidden="true">✓</i>}</button>)}</nav><div className="rail-foot"><strong>Before you begin</strong><p>Keep your family’s contact and location details ready.</p><p>Required fields are marked with <b>*</b>.</p><small>{completed} sections with required details completed</small></div></aside>
        <div className="register-content"><div className="registration-context"><span>{community.name} / Family registration</span><span className="context-status">{preview ? 'Preview' : 'New record'}</span></div><form ref={formRef} onSubmit={submit} noValidate><fieldset disabled={submitting}>
          <header className="workspace-heading"><div><span>SECTION {String(step + 1).padStart(2, '0')} / {String(sections.length + 1).padStart(2, '0')}</span><h1 ref={focusHeading} tabIndex="-1">{section ? section.title || labels[section.key] : 'Review & submit'}</h1><p>{section?.description || 'Check your information and confirm before submitting your family record.'}</p></div><span className="heading-detail">One registration per family</span></header>
          <div className="workspace-panel">
            {section ? <div className="collection-grid">{fieldsOf(section).filter(field => !(fieldsOf(section).some(item => item.type === 'location') && ['villageName', 'taluk', 'wardNumber'].includes(field.key))).map(field => <div key={field.key} className={['members', 'location', 'support', 'contribution', 'textarea', 'checkbox-group'].includes(field.type) || field.key === 'members' ? 'wide-field' : ''}><RegistrationField field={field} values={values} change={change} slug={slug} /></div>)}</div>
              : <div className="review-record">{sections.map((item, index) => <RegistrationReview key={item.key} section={item} title={item.title || labels[item.key]} values={values} onEdit={() => navigate(index)} />)}
                <label className="collection-consent"><input type="checkbox" required checked={values.consent} onChange={event => change({ consent: event.target.checked })} /><span>I confirm these details are accurate and agree to share them with {community.name} for registration, community support and contribution follow-up.</span></label>
              </div>}
          </div><footer className="workspace-actions"><button className="workspace-secondary" type="button" disabled={step === 0 || submitting} onClick={() => navigate(step - 1)}>← Previous</button><span>{step === sections.length ? 'Your information is saved when you submit.' : 'You can review and edit before submitting.'}</span><button className="workspace-primary" type="submit" disabled={submitting}>{submitting ? <><span className="spinner light" /> Submitting...</> : step === sections.length ? 'Submit family record' : 'Continue →'}</button></footer>
        </fieldset></form><footer className="workspace-footer"><span>Sangam · Family information register</span><span>Your information is visible to authorised community administrators.</span></footer></div>
      </div>}
  </main>
}
