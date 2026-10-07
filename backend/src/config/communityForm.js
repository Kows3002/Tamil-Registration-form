const field = (key, label, type = 'text', required = false, options = []) => ({ key, label, type, required, options })
const sections = [
  { key: 'primary', title: 'Primary information', description: 'Start with the person we can contact and the basics of your family.', fields: [
    field('familyHeadName', 'Family head / primary contact', 'text', true), field('phoneNumber', 'Mobile number', 'phone', true),
    field('email', 'Email address', 'email'), field('alternatePhone', 'Alternate mobile number', 'phone'),
    field('familyType', 'Family type', 'select', false, ['Nuclear family', 'Joint family', 'Single-person household', 'Other']),
    field('preferredContact', 'Preferred way to contact you', 'select', false, ['Phone call', 'WhatsApp', 'Email']),
  ] },
  { key: 'location', title: 'Residential location', description: 'Select your location in order. Each list follows the choices above it.', fields: [
    field('district', 'Location directory', 'location', true), field('villageName', 'Village / town name', 'text', true),
    field('address', 'House / door number', 'text', true),
  ] },
  { key: 'members', title: 'Your family members', description: 'Include yourself and every person in your household. Add as many members as you need.', fields: [field('members', 'Family members', 'members', true)] },
  { key: 'household', title: 'Household & livelihood', description: 'These details help the community understand your family’s circumstances. Optional fields can be skipped.', fields: [
    field('housingType', 'Housing situation', 'select', false, ['Own home', 'Rented home', 'Living with relatives', 'Temporary accommodation', 'Other']),
    field('familyAnnualIncome', 'Annual household income', 'select', false, ['Below ₹1 lakh', '₹1–3 lakh', '₹3–5 lakh', '₹5–10 lakh', 'Above ₹10 lakh', 'Prefer not to say']),
    field('mainOccupation', 'Primary livelihood', 'select', false, ['Salaried employment', 'Self-employed', 'Agriculture', 'Daily wage work', 'Business', 'Pension', 'Not currently employed', 'Other']),
    field('governmentSchemes', 'Government benefits', 'select', false, ['None', 'Public distribution / ration card', 'Health insurance', 'Pension', 'Education scholarship', 'Housing assistance', 'Employment scheme', 'Other']),
    field('accessibilityNeeds', 'Care / accessibility needs', 'select', false, ['None', 'Mobility assistance', 'Disability support', 'Elder care', 'Chronic illness support', 'Child care', 'Other']), field('householdNotes', 'Additional information (optional)', 'textarea'),
  ] },
  { key: 'support', title: 'Support from the community', description: 'Tell us if your family would like help. The community team can contact you to discuss what is available.', fields: [field('support', 'Help your family needs', 'support')] },
  { key: 'contribution', title: 'Give back to the community', description: 'Share your time, skills or resources. You can request help and contribute at the same time.', fields: [field('contribution', 'Ways you can contribute', 'contribution')] },
]
module.exports = sections.map((section, index) => ({ ...section, order: index + 1, fields: section.fields.map((item, order) => ({ ...item, order: order + 1 })) }))
