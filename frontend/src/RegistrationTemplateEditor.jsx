import { useState } from 'react'
import { RegistrationField } from './FamilyRegistration'

const TYPES = ['text', 'textarea', 'number', 'phone', 'email', 'date', 'select', 'checkbox', 'checkbox-group', 'location', 'members', 'support', 'contribution']
const TYPE_LABELS = { text: 'Short answer', textarea: 'Long answer', number: 'Number', phone: 'Mobile number', email: 'Email address', date: 'Date', select: 'Dropdown', checkbox: 'Single checkbox', 'checkbox-group': 'Multiple checkboxes' }
export default function RegistrationTemplateEditor({ community, sections, setSections }) {
  const [step, setStep] = useState(0)
  const [editing, setEditing] = useState(true)
  const [question, setQuestion] = useState(null)
  const [editHeading, setEditHeading] = useState(false)
  const [values, setValues] = useState({ state: 'Tamil Nadu', stateCode: 'TN', settlementType: 'Rural', members: [{ name: '', relationship: 'Self', age: '' }], support: { needed: false, categories: [], priority: 'Routine', details: '' }, contribution: { willing: false, categories: [], details: '' } })
  const section = sections[step]
  const systemKeys = ['familyHeadName', 'district', 'villageName', 'members']
  const change = patch => setValues(current => ({ ...current, ...patch }))
  const updateSection = patch => setSections(current => current.map((item, index) => index === step ? { ...item, ...patch } : item))
  const updateField = (index, patch) => updateSection({ fields: section.fields.map((field, i) => i === index ? { ...field, ...patch } : field) })
  const chooseSection = index => { setStep(index); setQuestion(null); setEditHeading(false) }
  const addField = () => {
    const index = section.fields.length
    updateSection({ fields: [...section.fields, { key: `custom_${Date.now()}`, label: 'New question', type: 'text', required: false, visible: true, order: Math.max(0, ...section.fields.map(field => field.order || 0)) + 1 }] })
    setQuestion(index)
  }
  return <section className="registration-workspace template-workspace">
    <div className="template-toolbar"><div><strong>{community.name} — Registration form</strong><p>{editing ? 'Choose a section. Edit existing questions, tick Required or add a question. Use Save & publish to update the public form.' : 'Preview your form changes. Answers entered here are for preview only.'}</p></div><button className={`button ${editing ? 'secondary' : 'primary'}`} onClick={() => { setEditing(!editing); setQuestion(null); setEditHeading(false) }}>{editing ? 'Preview changes' : 'Return to editing'}</button></div>
    <div className="register-body">
      <aside className="register-rail"><div className="register-community"><small>COMMUNITY</small><strong>{community.name}</strong><span>Family information register</span></div><nav aria-label="Registration template sections">{sections.map((item, index) => <button type="button" key={item.key} className={index === step ? 'current' : ''} aria-current={index === step ? 'step' : undefined} onClick={() => chooseSection(index)}><span className="rail-number">{String(index + 1).padStart(2, '0')}</span><span>{item.title}{item.enabled === false ? ' (hidden)' : ''}</span></button>)}</nav>{editing && <button className="button secondary" onClick={() => { const index = sections.length; setSections(current => [...current, { key: `section_${Date.now()}`, title: 'Additional information', description: '', order: index + 1, enabled: true, fields: [] }]); chooseSection(index); setEditHeading(true) }}>Add section</button>}</aside>
      <div className="register-content">{section ? <>
        <header className="workspace-heading"><div><span>SECTION {String(step + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span><h1>{section.title}</h1><p>{section.description}</p></div>{editing && <button className="button secondary" onClick={() => setEditHeading(!editHeading)}>Edit section</button>}</header>
        {editing && editHeading && <div className="template-settings"><label>Section title<input maxLength="120" value={section.title} onChange={event => updateSection({ title: event.target.value })} /></label><label>Description<textarea maxLength="300" value={section.description || ''} onChange={event => updateSection({ description: event.target.value })} /></label><label className="template-check"><input type="checkbox" checked={section.enabled !== false} disabled={section.fields.some(field => systemKeys.includes(field.key))} onChange={event => updateSection({ enabled: event.target.checked })} />Show this section</label></div>}
        <div className="workspace-panel"><div className="collection-grid">{section.fields.map((field, index) => {
          const companion = section.fields.some(item => item.type === 'location' && item.visible !== false) && ['villageName', 'taluk', 'wardNumber'].includes(field.key)
          if ((!editing && field.visible === false) || companion) return null
          const wide = ['members', 'location', 'support', 'contribution', 'textarea', 'checkbox-group'].includes(field.type) || field.key === 'members'
          return <div key={field.key} className={`template-field${wide ? ' wide-field' : ''}${field.visible === false ? ' template-field-hidden' : ''}`}>
            <RegistrationField field={field} values={values} change={change} slug={community.slug} />
            {editing && <div className="template-question-actions"><button className="template-edit-question" onClick={() => setQuestion(question === index ? null : index)}>{question === index ? 'Close settings' : 'Edit question'}{field.visible === false ? ' (hidden)' : ''}</button><label className="template-required"><input type="checkbox" checked={Boolean(field.required)} disabled={systemKeys.includes(field.key)} onChange={event => updateField(index, { required: event.target.checked })} />Required</label>{systemKeys.includes(field.key) && <small>Essential field</small>}</div>}
            {editing && question === index && <div className="template-settings"><label>Question label<input maxLength="120" autoFocus value={field.label} onChange={event => updateField(index, { label: event.target.value })} /></label>{!['members', 'location', 'support', 'contribution'].includes(field.type) && <label>Answer format<select value={field.type} onChange={event => updateField(index, { type: event.target.value })}>{TYPES.filter(type => !['members', 'location', 'support', 'contribution'].includes(type)).map(type => <option key={type} value={type}>{TYPE_LABELS[type]}</option>)}</select></label>}{['select', 'checkbox-group'].includes(field.type) && <label>Choices (one per line)<textarea rows="5" value={(field.options || []).join('\n')} onChange={event => updateField(index, { options: event.target.value.split('\n') })} onBlur={() => updateField(index, { options: [...new Set((field.options || []).map(value => value.trim()).filter(Boolean))] })} /></label>}<label className="template-check"><input type="checkbox" checked={field.visible !== false} disabled={systemKeys.includes(field.key)} onChange={event => updateField(index, { visible: event.target.checked })} />Show this question</label><label>Help text (optional)<input maxLength="300" value={field.helpText || ''} onChange={event => updateField(index, { helpText: event.target.value })} /></label><button className="button secondary" disabled={systemKeys.includes(field.key)} onClick={() => { updateSection({ fields: section.fields.filter((_, i) => i !== index) }); setQuestion(null) }}>Remove question</button></div>}
          </div>
        })}</div>{editing && <button className="add-field" onClick={addField}>+ Add question</button>}</div>
        <footer className="workspace-actions"><button className="workspace-secondary" disabled={step === 0} onClick={() => chooseSection(step - 1)}>Previous section</button><span>Template preview — registrations are disabled here.</span><button className="workspace-secondary" disabled={step === sections.length - 1} onClick={() => chooseSection(step + 1)}>Next section</button></footer>
      </> : <p>No sections are available.</p>}</div>
    </div>
  </section>
}
