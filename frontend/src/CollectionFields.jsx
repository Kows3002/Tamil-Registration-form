
import { useState } from 'react'

const MOBILE_PATTERN = '(?:\\+?91(?: |-)?)?[6-9][0-9]{9}'
const WORKING_OCCUPATIONS = ['Government employee', 'Private employee', 'Salaried employee', 'Self-employed', 'Farmer', 'Business owner', 'Daily wage worker']
export function Input({ label, required, type = 'text', options = [], value, onChange, placeholder, helpText, id }) {
  const [touched, setTouched] = useState(false)
  const invalidPhone = type === 'phone' && touched && Boolean(value) && !new RegExp(`^${MOBILE_PATTERN}$`).test(String(value).trim())
  if (type === 'checkbox-group') {
    const selected = Array.isArray(value) ? value : value ? String(value).split(', ') : []
    return <fieldset className="benefit-options wide-field"><legend className="collection-label">{label}{required && <b> *</b>}</legend><p>Select all that apply.</p><div>{options.map(option => <label key={option}><input type="checkbox" checked={selected.includes(option)} onChange={event => onChange(event.target.checked ? option === 'None' ? ['None'] : [...selected.filter(item => item !== 'None'), option] : selected.filter(item => item !== option))} />{option}</label>)}</div></fieldset>
  }
  return <label className={`collection-field ${type === 'textarea' ? 'wide-field' : ''}`} htmlFor={id}><span className="collection-label">{label}{required && <b> *</b>}</span>
    {type === 'select' ? <select id={id} value={value || ''} onChange={event => onChange(event.target.value)} required={required}><option value="">Select an option</option>{options.map(option => <option key={option}>{option}</option>)}</select>
      : type === 'checkbox' ? <span className="collection-check"><input id={id} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} required={required} />{helpText || 'Yes'}</span>
        : type === 'textarea' ? <textarea id={id} rows="3" value={value || ''} onChange={event => onChange(event.target.value)} required={required} maxLength={1000} placeholder={placeholder} />
          : <input id={id} type={type === 'phone' ? 'tel' : type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={event => onChange(event.target.value)} onBlur={() => { setTouched(true); if (type === 'phone') onChange(String(value || '').trim()) }} required={required} min={type === 'number' ? 0 : undefined} max={id?.endsWith('-age') ? 120 : undefined} step={type === 'number' ? 1 : undefined} inputMode={type === 'phone' ? 'tel' : type === 'number' ? 'numeric' : undefined} pattern={type === 'phone' ? MOBILE_PATTERN : undefined} title={type === 'phone' ? 'Enter a 10-digit Indian mobile number beginning with 6, 7, 8 or 9. +91 is optional.' : undefined} aria-invalid={invalidPhone || undefined} aria-describedby={type === 'phone' ? `${id}-help` : undefined} maxLength={type === 'phone' ? 16 : 160} placeholder={placeholder || (type === 'phone' ? '10-digit mobile number' : undefined)} />}
    {type === 'phone' && <small id={`${id}-help`} className={invalidPhone ? 'field-error' : undefined}>{invalidPhone ? 'Enter a valid 10-digit mobile number. +91 is optional.' : '10 digits,  +91 is optional.'}</small>}
    {helpText && type !== 'checkbox' && <small>{helpText}</small>}
  </label>
}

export function Members({ members, change }) {
  const update = (index, key, value) => change(members.map((member, i) => i === index ? { ...member, [key]: value } : member))
  return <div className="member-list">{members.map((member, index) => <article className="member-entry" key={index}>
    <header><span className="member-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{member.name || `Family member ${index + 1}`}</h3><p>{index === 0 ? 'Include the primary contact here too.' : 'Add this person’s details below.'}</p></div>{members.length > 1 && <button type="button" className="quiet-button" onClick={() => change(members.filter((_, i) => i !== index))} aria-label={`Remove member ${index + 1}`}>Remove</button>}</header>
    <div className="collection-grid">
      <Input id={`member-${index}-name`} label="Full name" required value={member.name || member.nameAddress} onChange={value => update(index, 'name', value)} />
      <Input id={`member-${index}-relationship`} label="Relationship to family head" type="select" options={['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Grandparent', 'Other']} value={member.relationship} onChange={value => update(index, 'relationship', value)} />
      <Input id={`member-${index}-age`} label="Age (years)" type="number" placeholder="Enter age" helpText="Enter a whole number from 0 to 120." value={member.age} onChange={value => update(index, 'age', value)} />
      <Input id={`member-${index}-gender`} label="Gender" type="select" options={['Female', 'Male', 'Other', 'Prefer not to say']} value={member.gender} onChange={value => update(index, 'gender', value)} />
      <Input id={`member-${index}-marital`} label="Marital status" type="select" options={['Single', 'Married', 'Widowed', 'Separated', 'Prefer not to say']} value={member.maritalStatus} onChange={value => update(index, 'maritalStatus', value)} />
      <Input id={`member-${index}-education`} label="Education / current study" type="select" options={['Not applicable', 'No formal education', 'Primary school', 'Secondary school', 'Higher secondary', 'Diploma', 'Undergraduate', 'Postgraduate', 'Doctorate', 'Other']} value={member.education} onChange={value => update(index, 'education', value)} />
      <Input id={`member-${index}-occupation`} label="Occupation" type="select" options={['Student', 'Government employee', 'Private employee', 'Salaried employee', 'Self-employed', 'Business owner', 'Daily wage worker', 'Farmer', 'Homemaker', 'Retired', 'Seeking work', 'Not employed', 'Other']} value={member.occupation} onChange={value => change(members.map((item, i) => i === index ? { ...item, occupation: value, workLocation: WORKING_OCCUPATIONS.includes(value) ? item.workLocation || '' : '' } : item))} />
      {WORKING_OCCUPATIONS.includes(member.occupation) && <Input id={`member-${index}-work-location`} label="Place of work / work location" required placeholder="Employer / workplace, town or city" value={member.workLocation} onChange={value => update(index, 'workLocation', value)} />}
      <Input id={`member-${index}-phone`} label="Mobile number (optional)" type="phone" value={member.phoneNumber} onChange={value => update(index, 'phoneNumber', value)} />
      <Input id={`member-${index}-skills`} label="Skills and interests" type="select" options={['Not specified', 'Teaching', 'Technical work', 'Healthcare', 'Business', 'Skilled trades', 'Driving', 'Agriculture', 'Arts and crafts', 'Sports', 'Other']} value={member.skills} onChange={value => update(index, 'skills', value)} />
    </div>
  </article>)}<button type="button" className="add-member" disabled={members.length >= 100} onClick={() => change([...members, { name: '', relationship: '', age: '' }])}><span>+</span> Add another family member <small>{members.length} added</small></button></div>
}

