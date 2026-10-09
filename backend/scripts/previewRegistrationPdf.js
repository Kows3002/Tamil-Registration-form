const fs = require('node:fs')
const {createRegistrationPdf}=require('../src/utils/registrationPdf')
const family={_id:'aaaaaaaaaaaaaaaaaaaaaaaa',familyHeadName:'Ravi / ரவி',status:'VERIFIED',createdAt:new Date('2026-10-09T05:00:00Z'),address:'12, Main Road, Residential Colony',state:'Tamil Nadu',district:'Erode',settlementType:'Rural',block:'Erode',villagePanchayat:'Village panchayat',villageName:'கிராமம் / Sample village',postalCode:'638001',phoneNumber:'9876543210',alternatePhone:'9876543211',familyType:'Joint family',preferredContact:'Phone call',housingType:'Leased house',familyAnnualIncome:'₹1–3 lakh',governmentSchemes:'Ration card, Health insurance',members:[{name:'Ravi ரவி',relationship:'Self',age:35,gender:'Male',maritalStatus:'Married',education:'Graduate',occupation:'Government employee',workLocation:'District office, Erode',phoneNumber:'9876543210',skills:'Teaching'}],support:{needed:true,categories:['Marriage arrangement'],details:'Request for marriage arrangement assistance',priority:'Soon'},contribution:{willing:false},consent:true,consentAt:new Date('2026-10-09T05:00:00Z')}
const stress = process.argv.includes('--stress')
if (stress) {
  family.address = 'Long address கிராமம் / Sample village. '.repeat(120)
  family.members = Array.from({ length: 12 }, (_, index) => ({ ...family.members[0], name: `Member ${index + 1} ரவி`, skills: 'Teaching and community assistance. '.repeat(30) }))
}
const target=require('node:path').resolve(__dirname,`../../artifacts/community-checks/registration-${stress ? 'stress' : 'preview'}.pdf`)
const pdf=createRegistrationPdf(family,{name:'Naidu Community / நாயுடு'})
pdf.pipe(fs.createWriteStream(target));pdf.end()
