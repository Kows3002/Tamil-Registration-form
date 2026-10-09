const locationFields = { state: 'State', district: 'District', settlementType: 'Area type', taluk: 'Taluk', block: 'Block', villagePanchayat: 'Village panchayat', villageName: 'Village / town', habitation: 'Habitation / hamlet', wardNumber: 'Ward number', streetArea: 'Street / area', postalCode: 'PIN code', postOffice: 'Post office' }
const display = value => Array.isArray(value) ? value.join(', ') || 'Not selected' : typeof value === 'boolean' ? value ? 'Yes' : 'No' : value === '' || value === undefined || value === null ? 'Not provided' : String(value)

export default function RegistrationReview({ section, title, values, onEdit }) {
  const fields = section.fields.filter(field => field.visible !== false).sort((a, b) => a.order - b.order)
  const hasLocation = fields.some(field => field.type === 'location')
  return <section><header><h2>{title}</h2><button type="button" onClick={onEdit}>Edit</button></header><dl>
    {fields.flatMap(field => {
      if (hasLocation && ['villageName', 'taluk', 'wardNumber'].includes(field.key)) return []
      if (field.type === 'location') return Object.entries(locationFields).map(([key, label]) => <div key={`location-${key}`}><dt>{label}</dt><dd>{display(values[key])}</dd></div>)
      if (field.key === 'members') return values.members.map((member, index) => <div key={`member-${index}`} className="review-member"><dt>Member {index + 1}</dt><dd><strong>{member.name || member.nameAddress}</strong>{[['Relationship', member.relationship], ['Age', member.age], ['Gender', member.gender], ['Marital status', member.maritalStatus], ['Education', member.education], ['Occupation', member.occupation], ['Work location', member.workLocation], ['Mobile number', member.phoneNumber], ['Skills', member.skills]].filter(([, value]) => value !== '' && value !== undefined && value !== null).map(([label, value]) => <span key={label}>{label}: {display(value)}</span>)}</dd></div>)
      const value = values[field.key]
      return [<div key={field.key}><dt>{field.label}</dt><dd>{['support', 'contribution'].includes(field.type) ? value?.[field.type === 'support' ? 'needed' : 'willing'] ? `${value.categories.join(', ')} — ${value.details}` : 'Not requested' : display(value)}</dd></div>]
    })}
  </dl></section>
}
