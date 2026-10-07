
export function Input({ label, required, type = 'text', options = [], value, onChange, placeholder, helpText, id }) {
  return <label className={`collection-field ${type === 'textarea' ? 'wide-field' : ''}`} htmlFor={id}><span className="collection-label">{label}{required && <b> *</b>}</span>
    {type === 'select' ? <select id={id} value={value || ''} onChange={event => onChange(event.target.value)} required={required}><option value="">Select an option</option>{options.map(option => <option key={option}>{option}</option>)}</select>
      : type === 'checkbox' ? <span className="collection-check"><input id={id} type="checkbox" checked={Boolean(value)} onChange={event => onChange(event.target.checked)} required={required} />{helpText || 'Yes'}</span>
        : type === 'textarea' ? <textarea id={id} rows="3" value={value || ''} onChange={event => onChange(event.target.value)} required={required} maxLength={1000} placeholder={placeholder} />
          : <input id={id} type={type === 'phone' ? 'tel' : type === 'number' ? 'number' : type === 'email' ? 'email' : type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={event => onChange(event.target.value)} required={required} min={type === 'number' ? 0 : undefined} max={id?.endsWith('-age') ? 120 : undefined} maxLength={type === 'phone' ? 16 : 160} placeholder={placeholder} />}
    {helpText && type !== 'checkbox' && <small>{helpText}</small>}
  </label>
}

export function Members({ members, change }) {
  const update = (index, key, value) => change(members.map((member, i) => i === index ? { ...member, [key]: value } : member))
  return <div className="member-list">{members.map((member, index) => <article className="member-entry" key={index}>
    <header><span className="member-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{member.name || `Family member ${index + 1}`}</h3><p>{index === 0 ? 'Include the primary contact here too.' : 'Add this person’s details below.'}</p></div>{members.length > 1 && <button type="button" className="quiet-button" onClick={() => change(members.filter((_, i) => i !== index))} aria-label={`Remove member ${index + 1}`}>Remove</button>}</header>
    <div className="collection-grid">
      <Input id={`member-${index}-name`} label="Full name" required value={member.name || member.nameAddress} onChange={value => update(index, 'name', value)} />
      <Input id={`member-${index}-relationship`} label="Relationship to family head" type="select" options={['Self', 'Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Sibling', 'Grandparent', 'Other']} value={member.relationship} onChange={value => update(index, 'relationship', value)} />
      <Input id={`member-${index}-age`} label="Age" type="select" options={Array.from({length:121},(_,i)=>String(i))} value={member.age} onChange={value => update(index, 'age', value)} />
      <Input id={`member-${index}-gender`} label="Gender" type="select" options={['Female', 'Male', 'Other', 'Prefer not to say']} value={member.gender} onChange={value => update(index, 'gender', value)} />
      <Input id={`member-${index}-marital`} label="Marital status" type="select" options={['Single', 'Married', 'Widowed', 'Separated', 'Prefer not to say']} value={member.maritalStatus} onChange={value => update(index, 'maritalStatus', value)} />
      <Input id={`member-${index}-education`} label="Education / current study" type="select" options={['Not applicable', 'No formal education', 'Primary school', 'Secondary school', 'Higher secondary', 'Diploma', 'Undergraduate', 'Postgraduate', 'Doctorate', 'Other']} value={member.education} onChange={value => update(index, 'education', value)} />
      <Input id={`member-${index}-occupation`} label="Occupation" type="select" options={['Student', 'Salaried employee', 'Self-employed', 'Farmer', 'Homemaker', 'Retired', 'Seeking work', 'Not employed', 'Other']} value={member.occupation} onChange={value => update(index, 'occupation', value)} />
      <Input id={`member-${index}-phone`} label="Mobile number (optional)" type="phone" value={member.phoneNumber} onChange={value => update(index, 'phoneNumber', value)} />
      <Input id={`member-${index}-skills`} label="Skills and interests" type="select" options={['Not specified', 'Teaching', 'Technical work', 'Healthcare', 'Business', 'Skilled trades', 'Driving', 'Agriculture', 'Arts and crafts', 'Sports', 'Other']} value={member.skills} onChange={value => update(index, 'skills', value)} />
    </div>
  </article>)}<button type="button" className="add-member" disabled={members.length >= 100} onClick={() => change([...members, { name: '', relationship: '', age: '' }])}><span>+</span> Add another family member <small>{members.length} added</small></button></div>
}

