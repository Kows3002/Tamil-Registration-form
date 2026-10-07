import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from './api'
import LocationFields from './LocationFields'
import './CommunityCollection.css'

const SUPPORT = ['Education', 'Healthcare', 'Employment', 'Food & essentials', 'Housing', 'Elder care', 'Disability support', 'Other']
const CONTRIBUTIONS = ['Volunteer time', 'Teaching & mentoring', 'Professional skills', 'Job opportunities', 'Food & supplies', 'Financial support', 'Other']
const blankValues = () => ({ members: [{ name: '', relationship: 'Self', age: '', gender: '', education: '', occupation: '', phoneNumber: '', skills: '' }], support: { needed: false, categories: [], details: '', priority: 'Routine' }, contribution: { willing: false, categories: [], skills: '', availability: '', details: '' }, consent: false })
const visibleFields = section => section.fields.filter(field => field.visible !== false).sort((a, b) => a.order - b.order)

function Input({ label, required, type = 'text', options = [], value, onChange, placeholder, helpText, id }) {
  return <label className={`collection-field ${type === 'textarea' ? 'wide-field' : ''}`} htmlFor={id}><span className="collection-label">{label}{required && <b> *</b>}</span>
    {type === 'select' ? <select id={id} value={value || ''} onChange={event => onChange(event.target.value)} required={required}><option value="">Select an option</option>{options.map(option => <option key={option}>{option}</option>)}</select>
      : type === 'checkbox' ? <span className="collection-check"><input id={id} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} required={required} />{helpText || 'Yes'}</span>
        : type === 'textarea' ? <textarea id={id} rows="3" value={value || ''} onChange={event => onChange(event.target.value)} required={required} maxLength={1000} placeholder={placeholder} />
          : <input id={id} type={type === 'phone' ? 'tel' : type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={event => onChange(event.target.value)} required={required} min={type === 'number' ? 0 : undefined} max={id?.endsWith('-age') ? 120 : undefined} maxLength={type === 'phone' ? 16 : 160} placeholder={placeholder} />}
    {helpText && type !== 'checkbox' && <small>{helpText}</small>}
  </label>
}

function Members({ members, change }) {
  const update = (index, key, value) => change(members.map((member, i) => i === index ? { ...member, [key]: value } : member))
  return <div className="member-list">{members.map((member, index) => <article className="member-entry" key={index}>
    <header><span className="member-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{member.name || `Family member ${index + 1}`}</h3><p>{index === 0 ? 'Include the primary contact here too.' : 'Add this person’s details below.'}</p></div>{members.length > 1 && <button type="button" className="quiet-button" onClick={() => change(members.filter((_, i) => i !== index))} aria-label={`Remove member ${index + 1}`}>Remove</button>}</header>
    <div className="collection-grid">
      <Input id={`member-${index}-name`} label="Full name" required value={member.name || member.nameAddress} onChange={value => update(index, 'name', value)} />
      <Input id={`member-${index}-relationship`} label="Relationship to family head" type="select" options={['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Sibling', 'Grandparent', 'Other']} value={member.relationship} onChange={value => update(index, 'relationship', value)} />
      <Input id={`member-${index}-age`} label="Age" type="number" value={member.age} onChange={value => update(index, 'age', value)} />
      <Input id={`member-${index}-gender`} label="Gender" type="select" options={['Female', 'Male', 'Other', 'Prefer not to say']} value={member.gender} onChange={value => update(index, 'gender', value)} />
      <Input id={`member-${index}-marital`} label="Marital status" type="select" options={['Single', 'Married', 'Widowed', 'Separated', 'Prefer not to say']} value={member.maritalStatus} onChange={value => update(index, 'maritalStatus', value)} />
      <Input id={`member-${index}-education`} label="Education / current study" value={member.education} onChange={value => update(index, 'education', value)} />
      <Input id={`member-${index}-occupation`} label="Occupation" value={member.occupation} onChange={value => update(index, 'occupation', value)} />
      <Input id={`member-${index}-phone`} label="Mobile number (optional)" type="phone" value={member.phoneNumber} onChange={value => update(index, 'phoneNumber', value)} />
      <Input id={`member-${index}-skills`} label="Skills and interests" value={member.skills} onChange={value => update(index, 'skills', value)} />
    </div>
  </article>)}<button type="button" className="add-member" disabled={members.length >= 100} onClick={() => change([...members, { name: '', relationship: '', age: '' }])}><span>+</span> Add another family member <small>{members.length} added</small></button></div>
}

function Engagement({ kind, value, change }) {
  const support = kind === 'support'
  const flag = support ? 'needed' : 'willing'
  const update = patch => change({ ...value, ...patch })
  const choices = support ? SUPPORT : CONTRIBUTIONS
  return <div className={`engagement ${support ? 'support-block' : 'give-block'}`}>
    <div className="engagement-intro"><span className="engagement-symbol" aria-hidden="true">{support ? '↗' : '＋'}</span><div><h3>{support ? 'Would your family like support?' : 'Would you like to contribute?'}</h3><p>{support ? 'A little support can make a meaningful difference.' : 'Every skill, hour and helping hand matters.'}</p></div></div>
    <div className="choice-row" role="group" aria-label={support ? 'Request community help' : 'Contribute to the community'}>{[true, false].map(yes => <button type="button" key={String(yes)} aria-pressed={value[flag] === yes} className={value[flag] === yes ? 'chosen' : ''} onClick={() => change(yes ? { ...value, [flag]: true } : { [flag]: false, categories: [], details: '', priority: 'Routine' })}>{yes ? (support ? 'Yes, we would like help' : 'Yes, I would like to help') : 'Not at the moment'}</button>)}</div>
    {value[flag] && <div className="engagement-details"><span className="collection-label">{support ? 'What kind of help?' : 'How would you like to help?'} <b>*</b></span><div className="category-options">{choices.map(category => <label key={category}><input type="checkbox" checked={(value.categories || []).includes(category)} onChange={event => update({ categories: event.target.checked ? [...(value.categories || []), category] : value.categories.filter(item => item !== category) })} /><span>{category}</span></label>)}</div>
      <div className="collection-grid">{support ? <Input id="support-priority" label="When do you need help?" type="select" options={['Routine', 'Soon', 'Urgent']} value={value.priority || 'Routine'} onChange={priority => update({ priority })} /> : <><Input id="contribution-skills" label="Skills / resources you can share" value={value.skills} onChange={skills => update({ skills })} /><Input id="contribution-availability" label="When are you available?" placeholder="e.g. Sunday mornings" value={value.availability} onChange={availability => update({ availability })} /></>}
        <Input id={`${kind}-details`} label={support ? 'Tell us a little more about your needs' : 'Tell us about your contribution'} type="textarea" required value={value.details} onChange={details => update({ details })} /></div>
      {!support && <p className="inline-note">This records your interest. No payment is collected here.</p>}
    </div>}
  </div>
}

export default function CommunityCollection({ slug, preview = false, onToast }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [retry, setRetry] = useState(0)
  const [values, setValues] = useState(blankValues)
  const [submitting, setSubmitting] = useState(false)
  const [receipt, setReceipt] = useState(null)
  const formRef = useRef(null)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setData(null); setValues(blankValues()); setReceipt(null)
    api(`/communities/public/${encodeURIComponent(slug)}`, { signal: controller.signal }).then(setData).catch(err => { if (err.name !== 'AbortError') setError(err.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [slug, retry])
  const sections = useMemo(() => (data?.form?.sections || []).filter(section => section.enabled !== false).sort((a, b) => a.order - b.order), [data])
  const change = patch => setValues(current => ({ ...current, ...patch }))
  const required = sections.flatMap(visibleFields).filter(field => field.required)
  const done = field => field.key === 'members' ? values.members.every(member => (member.name || member.nameAddress)?.trim()) : field.type === 'location' ? ['districtId', 'blockId', 'villagePanchayatId', 'habitationId'].every(key => values[key]) : field.type === 'checkbox' ? values[field.key] === true : Boolean(String(values[field.key] || '').trim())
  const completion = required.length ? Math.round(required.filter(done).length / required.length * 100) : 0
  const submit = async event => {
    event.preventDefault()
    if (!formRef.current.reportValidity()) return
    const missing = required.find(field => !done(field))
    if (missing) { onToast(`Please complete ${missing.label.toLowerCase()}.`, 'error'); document.getElementById(`section-${sections.find(section => section.fields.some(field => field.key === missing.key))?.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return }
    for (const kind of ['support', 'contribution']) {
      const value = values[kind]
      if (value[kind === 'support' ? 'needed' : 'willing'] && !value.categories.length) { onToast(`Choose at least one ${kind} category.`, 'error'); document.getElementById(`section-${kind}`)?.scrollIntoView({ behavior: 'smooth' }); return }
    }
    if (!values.consent) { onToast('Please confirm your consent before submitting.', 'error'); return }
    if (preview) { onToast('This is a preview. No information has been saved.', 'info'); return }
    setSubmitting(true)
    try {
      const record = await api('/families', { method: 'POST', body: JSON.stringify({ ...values, communitySlug: slug, communityId: data.community._id }) })
      setReceipt({ id: record._id, name: record.familyHeadName }); onToast('Your family information has been submitted successfully.', 'success'); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) { onToast(err.message || 'Could not submit your details. Please try again.', 'error') }
    finally { setSubmitting(false) }
  }
  const community = data?.community
  return <main className="collection-page">
    <header className="collection-top"><a className="collection-brand" href="/"><span className="collection-emblem" aria-hidden="true">s</span><span>Sangam<small>THE COMMUNITY REGISTER</small></span></a><a className="collection-admin" href="/admin/login">Administrator sign in <span>↗</span></a></header>
    {loading ? <div className="collection-state" role="status"><span className="spinner" /><h1>Opening your community register</h1><p>Getting your family form ready…</p></div>
      : error || !sections.length ? <div className="collection-state" role="alert"><h1>We couldn’t open this form</h1><p>{error || 'This community has not published a family form yet.'}</p><button className="collection-submit" onClick={() => setRetry(retry + 1)}>Try again</button></div>
        : receipt ? <div className="collection-receipt"><span className="receipt-mark">✓</span><span className="collection-kicker">REGISTRATION RECEIVED</span><h1>Thank you, {receipt.name}.</h1><p>Your family details have been saved for {community.name}. The community team can now review your information, help requests and offers to contribute.</p><div className="receipt-reference"><small>YOUR REFERENCE</small><strong>{receipt.id}</strong><span>Keep this reference for any follow-up with your community.</span></div><button className="collection-submit" onClick={() => { setValues(blankValues()); setReceipt(null) }}>Register another family</button></div>
          : <><section className="collection-hero"><div><span className="collection-kicker">{community.name} · FAMILY REGISTRATION</span><h1>A stronger community<br /><em>starts with your family.</em></h1><p>Tell us who you are, where you live and how we can help each other. One family record brings your people, needs and contributions together.</p></div><aside className="hero-note"><span>01 / FAMILY REGISTER</span><div className="linked-circles" aria-hidden="true"><i /><i /><i /></div><strong>Every family belongs.</strong><p>Your information is shared with authorised community administrators, not a public directory.</p></aside></section>
            <div className="collection-layout"><aside className="collection-index"><span className="collection-kicker">IN THIS FORM</span><nav aria-label="Form sections">{sections.map((section, index) => <a key={section.key} href={`#section-${section.key}`}><span>{String(index + 1).padStart(2, '0')}</span>{section.title}<i>{visibleFields(section).some(field => field.required) && visibleFields(section).filter(field => field.required).every(done) ? '✓' : ''}</i></a>)}<a href="#section-review"><span>{String(sections.length + 1).padStart(2, '0')}</span>Review & submit</a></nav><div className="collection-progress"><span>Required details <b>{completion}%</b></span><div><i style={{ width: `${completion}%` }} /></div><small>You can leave optional fields blank.</small></div><p className="index-note">Fill this form once for your household. Add each family member individually.</p></aside>
              <form ref={formRef} onSubmit={submit} className="collection-form" noValidate><fieldset disabled={submitting}>
                {preview && <div className="preview-banner">Form preview — submissions are disabled.</div>}
                {sections.map((section, index) => <section className="collection-section" id={`section-${section.key}`} key={section.key}><header className="collection-section-heading"><span>{String(index + 1).padStart(2, '0')}</span><div><h2>{section.title}</h2><p>{section.description}</p></div></header><div className="collection-grid">{visibleFields(section).map(field => <div key={field.key} className={['location', 'members', 'support', 'contribution', 'textarea'].includes(field.type) || field.key === 'members' ? 'wide-field' : ''}>
                  {field.key === 'members' ? <Members members={values.members} change={members => change({ members })} />
                    : field.type === 'location' ? <LocationFields values={values} change={change} />
                      : ['support', 'contribution'].includes(field.type) ? <Engagement kind={field.type} value={values[field.key] || blankValues()[field.type]} change={value => change({ [field.key]: value })} />
                        : <Input {...field} id={field.key} value={values[field.key]} onChange={value => change({ [field.key]: value })} />}
                </div>)}</div></section>)}
                <section className="collection-section review-section" id="section-review"><header className="collection-section-heading"><span>{String(sections.length + 1).padStart(2, '0')}</span><div><h2>A final look, then you’re all set.</h2><p>Check the details above before sending your family record to the community.</p></div></header><div className="review-summary"><div><small>YOUR FAMILY</small><strong>{values.familyHeadName || 'Primary contact not added yet'}</strong><span>{values.members.length} family {values.members.length === 1 ? 'member' : 'members'}</span></div><div><small>YOUR LOCATION</small><strong>{values.villageName || 'Location not selected yet'}</strong><span>{[values.block, values.district].filter(Boolean).join(', ')}</span></div><div><small>COMMUNITY CONNECTION</small><strong>{values.support.needed ? 'Help requested' : 'No help requested'}</strong><span>{values.contribution.willing ? 'Interested in contributing' : 'No contribution selected'}</span></div></div>
                  <label className="collection-consent"><input type="checkbox" required checked={values.consent} onChange={event => change({ consent: event.target.checked })} /><span>I confirm that these details are accurate and agree to share them with {community.name} for family registration, community support and contribution follow-up. <b>*</b></span></label>
                  <div className="collection-submit-row"><p><span aria-hidden="true">↳</span> Your details are saved only when you submit.</p><button className="collection-submit" type="submit" disabled={submitting}>{submitting ? <><span className="spinner light" /> Saving your family…</> : <>Submit family information <span>↗</span></>}</button></div>
                </section>
              </fieldset></form></div><footer className="collection-footer"><span>Sangam / {community.name}</span><span>People. Places. A community that cares.</span></footer></>}
  </main>
}
