import './ReferenceForm.css'
import './ReferenceFormOverrides.css'
import MasterAutocomplete from './MasterAutocomplete.jsx'

const groups = [
 [['pitagaiName','பிடாகையின் பெயர் :'],['localBody','ஊராட்சி / பேரூராட்சி /'],['municipality','நகராட்சி/'],['townPanchayat','ஊராட்சி ஒன்றியம்:']],
 [['corporation','மாநகராட்சி:'],['wardNumber','வார்டு எண்:'],['postOffice','தபால் நிலையம்:'],['postalCode','அஞ்சலக எண் :']],
 [['revenueVillage','வருவாய் கிராமம்:'],['division','வட்டம் :'],['circle','கோட்டம் :'],['district','மாவட்டம்:'],['block','ஊராட்சி ஒன்றியம் / வட்டாரம்:'],['habitation','குடியிருப்பு / குக்கிராமம்:']],
 [['assemblyConstituency','சட்டமன்ற தொகுதி'],['parliamentConstituency','பாராளுமன்ற தொகுதி'],['villageName','ஊர் பெயர் :'],['wardSerial','வ எண்.']],
]
const memberRows = [
 ['nameAddress','குடும்ப தலைவர் மற்றும் அங்கத்தினர்களின் பெயர், விலாசம் (கதவு எண், தொலைபேசி எண் குறிப்பிடவும்)'],
 ['gender','ஆண்/பெண்'],['age','வயது'],['maritalStatus','திருமண மானவரா ஆம்/இல்லை'],['education','கல்வி'],['workDetails','பணியின் விபரம்'],
 ['centralGovernment','மத்திய அரசு'],['stateGovernment','மாநில அரசு'],['private','தனியார்'],['villageName','ஊர் பெயர் :'],['name','பெயர்:'],
 ['temples','ஆலயங்கள்'],['templeBoard','ஊர் கோவில்/தேவஸ்வம் போர்டு'],
 ['temporaryAddress','தற்காலிக முகவரி (வெளி ஊர் / வெளி மாநிலம் /வெளிநாடுகளில் வசித்து வந்தால் ஊர் பெயர் மற்றும் விலாசம்)'],
 ['taxPayingVillage','எந்த ஊரில் வரி செலுத்துகிறார்'],['familyAnnualIncome','குடும்ப ஆண்டு வருமானம்'],
]
const makeMember=()=>({nameAddress:'',phoneNumber:'',gender:'',age:'',maritalStatus:'',education:'',workDetails:'',centralGovernment:false,stateGovernment:false,private:false,villageName:'',name:'',temples:'',templeBoard:'',temporaryAddress:'',taxPayingVillage:'',familyAnnualIncome:''})
function MemberInput({field,member,index,updateMember}) {
 if(field==='nameAddress') return <><textarea className="cell-input member-address" aria-label={memberRows[0][1]} value={member.nameAddress||''} onChange={e=>updateMember(index,'nameAddress',e.target.value)}/><input className="cell-subinput" aria-label="தொலைபேசி எண்" placeholder="தொலைபேசி எண்" value={member.phoneNumber||''} onChange={e=>updateMember(index,'phoneNumber',e.target.value)}/></>
 if(['centralGovernment','stateGovernment','private'].includes(field)) return <input className="member-check" type="checkbox" aria-label={memberRows.find(([key])=>key===field)?.[1]} checked={Boolean(member[field])} onChange={e=>updateMember(index,field,e.target.checked)}/>
 if(field==='gender') return <select className="cell-input" aria-label="ஆண்/பெண்" value={member[field]||''} onChange={e=>updateMember(index,field,e.target.value)}><option value=""/><option>ஆண்</option><option>பெண்</option></select>
 if(field==='maritalStatus') return <select className="cell-input" aria-label="திருமண மானவரா ஆம்/இல்லை" value={member[field]||''} onChange={e=>updateMember(index,field,e.target.value)}><option value=""/><option>ஆம்</option><option>இல்லை</option></select>
 if(field==='age') return <input className="cell-input" aria-label="வயது" type="number" min="0" max="120" value={member[field]||''} onChange={e=>updateMember(index,field,e.target.value)}/>
 if(field==='temporaryAddress') return <textarea className="cell-input member-address" aria-label={memberRows.find(([key])=>key===field)?.[1]} value={member[field]||''} onChange={e=>updateMember(index,field,e.target.value)}/>
 return <input className="cell-input" aria-label={memberRows.find(([key])=>key===field)?.[1]} value={member[field]||''} onChange={e=>updateMember(index,field,e.target.value)}/>
}
export default function PublicForm({family,setFamily,update,updateMember,submitFamily,submitting,printDocument,go,notice,error}) {
 const addRow=()=>setFamily(current=>({...current,members:[...current.members,makeMember()]}))
 const removeRow=index=>setFamily(current=>({...current,members:current.members.length>1?current.members.filter((_,i)=>i!==index):current.members}))
 return <main className="reference-page"><div className="reference-scroll"><form className="reference-sheet" onSubmit={submitFamily}>
  <header className="reference-title"><h1>கிருஷ்ணன் வக சமுதாய பிடாகைகளின் மக்கள் தொகை கணக்கு - (ஒரு குடும்பத்திற்கு ஒரு படிவம்)</h1></header>
  <section className="reference-meta" aria-label="குடும்ப விவரங்கள்">{groups.map((group,gi)=><div className="reference-info-block" key={gi}>{group.map(([key,label])=>{
    const kinds={district:'district',block:'block',villageName:'village',habitation:'habitation',assemblyConstituency:'assembly',postOffice:'postOffice',postalCode:'pincode'}
    const required=['pitagaiName','villageName','district'].includes(key)
    if(kinds[key]) return <MasterAutocomplete key={key} kind={kinds[key]} label={label} value={family[key]} family={family} required={required}
      disabled={(key==='block'&&!family.districtId)||(key==='villageName'&&!family.blockId)||(key==='habitation'&&!family.villagePanchayatId)}
      onInputChange={value=>setFamily(current=>{const next={...current,[key]:value};const clear=fields=>fields.forEach(field=>{next[field]=''});if(key==='district')clear(['districtId','districtCode','districtNameTamil','block','blockId','blockCode','blockNameTamil','villageName','villagePanchayatId','villagePanchayatCode','villagePanchayatNameTamil','habitation','habitationId','habitationCode','habitationNameTamil']);if(key==='block')clear(['blockId','blockCode','blockNameTamil','villageName','villagePanchayatId','villagePanchayatCode','villagePanchayatNameTamil','habitation','habitationId','habitationCode','habitationNameTamil']);if(key==='villageName')clear(['villagePanchayatId','villagePanchayatCode','villagePanchayatNameTamil','habitation','habitationId','habitationCode','habitationNameTamil']);if(key==='habitation')clear(['habitationId','habitationCode','habitationNameTamil']);if(key==='assemblyConstituency')clear(['assemblyConstituencyId','assemblyConstituencySourceKey']);if(key==='postOffice')clear(['postOfficeId','postOfficeSourceKey','pincodeId','pincodeCode','postalCode']);if(key==='postalCode')clear(['pincodeId','pincodeCode','postOfficeId','postOfficeSourceKey','postOffice']);return next})}
      onSelect={row=>setFamily(current=>{
        const next={...current}
        if(key==='district') { next.district=row?.nameTamil||'';next.districtId=row?._id||'';next.districtCode=row?.code||'';next.districtNameTamil=row?.nameTamil||'';for(const field of ['block','blockId','blockCode','blockNameTamil','villageName','villagePanchayatId','villagePanchayatCode','villagePanchayatNameTamil','habitation','habitationId','habitationCode','habitationNameTamil'])next[field]='' }
        if(key==='block') { next.block=row?.nameTamil||'';next.blockId=row?._id||'';next.blockCode=row?.code||'';next.blockNameTamil=row?.nameTamil||'';for(const field of ['villageName','villagePanchayatId','villagePanchayatCode','villagePanchayatNameTamil','habitation','habitationId','habitationCode','habitationNameTamil'])next[field]='' }
        if(key==='villageName') { next.villageName=row?.nameTamil||'';next.villagePanchayatId=row?._id||'';next.villagePanchayatCode=row?.code||'';next.villagePanchayatNameTamil=row?.nameTamil||'';for(const field of ['habitation','habitationId','habitationCode','habitationNameTamil'])next[field]='' }
        if(key==='habitation') { next.habitation=row?.nameTamil||'';next.habitationId=row?._id||'';next.habitationCode=row?.code||'';next.habitationNameTamil=row?.nameTamil||'' }
        if(key==='assemblyConstituency') { next.assemblyConstituency=row?.name||'';next.assemblyConstituencyId=row?._id||'';next.assemblyConstituencySourceKey=row?.sourceKey||'' }
        if(key==='postOffice') { next.postOffice=row?.name||'';next.postOfficeId=row?._id||'';next.postOfficeSourceKey=row?.sourceKey||'';next.postalCode=row?.pincode||'';next.pincodeCode=row?.pincode||'';next.pincodeId=row?.pincodeId||'' }
        if(key==='postalCode') { next.postalCode=row?.code||'';next.pincodeCode=row?.code||'';next.pincodeId=row?._id||'';next.postOffice='';next.postOfficeId='';next.postOfficeSourceKey='' }
        return next
      })}/>
    return <label className={`reference-field field-${key}`} key={key}><span>{label}{required&&<b> *</b>}</span><input value={family[key]||''} onChange={e=>update(key,e.target.value)} required={required}/></label>
  })}</div>)}</section>
  <section className="reference-table-scroll" aria-label="குடும்ப உறுப்பினர் விவரங்கள்"><table className="reference-table member-reference-table"><colgroup><col className="col-number"/>{memberRows.map(([key])=><col key={key} className={`col-${key}`}/>)}<col className="col-actions no-print"/></colgroup><thead><tr><th>வ எண்.</th>{memberRows.map(([key,label])=><th key={key}>{label}</th>)}<th className="no-print">செயல்</th></tr></thead><tbody>{family.members.map((member,index)=><tr key={index}><td className="row-number" data-label="வ எண்.">{index+1}</td>{memberRows.map(([key])=><td key={key} data-label={memberRows.find(([rowKey])=>rowKey===key)?.[1]}><MemberInput field={key} member={member} index={index} updateMember={updateMember}/></td>)}<td className="no-print row-action"><button type="button" onClick={()=>removeRow(index)} aria-label="வரிசையை நீக்கு">×</button></td></tr>)}</tbody></table></section>
<div className="reference-paper-note">மக்கள் கணக்கெடுப்பு பயன்பாட்டிற்கு மட்டும்</div>
  <footer className="reference-controls no-print"><button type="button" className="plain-action" onClick={addRow}>+ உறுப்பினரைச் சேர்க்க</button><button type="button" className="plain-action" onClick={printDocument}>அச்சிடு</button><button type="button" className="plain-action" onClick={()=>go('/admin/login')}>நிர்வாகி உள்நுழைவு</button><button type="submit" className="save-action" disabled={submitting}>{submitting && <span className="button-spinner" aria-hidden="true" />} {submitting ? "சேமிக்கிறது..." : "படிவத்தைச் சேமி"}</button></footer>
 </form></div></main>
}





