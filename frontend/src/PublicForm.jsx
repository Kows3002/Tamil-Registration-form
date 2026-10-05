import './ReferenceForm.css'
import './ReferenceFormOverrides.css'

const groups = [
 [['pitagaiName','பிடாகையின் பெயர் :'],['localBody','ஊராட்சி / பேரூராட்சி /'],['municipality','நகராட்சி/'],['townPanchayat','ஊராட்சி ஒன்றியம்:']],
 [['corporation','மாநகராட்சி:'],['wardNumber','வார்டு எண்:'],['postOffice','தபால் நிலையம்:'],['postalCode','அஞ்சலக எண் :']],
 [['revenueVillage','வருவாய் கிராமம்:'],['division','வட்டம் :'],['circle','கோட்டம் :'],['district','மாவட்டம்:']],
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
export default function PublicForm({family,setFamily,update,updateMember,submitFamily,go,notice,error}) {
 const addRow=()=>setFamily(current=>({...current,members:[...current.members,makeMember()]}))
 const removeRow=index=>setFamily(current=>({...current,members:current.members.length>1?current.members.filter((_,i)=>i!==index):current.members}))
 return <main className="reference-page"><div className="reference-scroll"><form className="reference-sheet" onSubmit={submitFamily}>
  <header className="reference-title"><h1>கிருஷ்ணன் வக சமுதாய பிடாகைகளின் மக்கள் தொகை கணக்கு - (ஒரு குடும்பத்திற்கு ஒரு படிவம்)</h1></header>
  <section className="reference-meta" aria-label="குடும்ப விவரங்கள்">{groups.map((group,gi)=><div className="reference-info-block" key={gi}>{group.map(([key,label])=><label className={`reference-field field-${key}`} key={key}><span>{label}{['pitagaiName','villageName','district'].includes(key)&&<b> *</b>}</span><input value={family[key]||''} onChange={e=>update(key,e.target.value)} required={['pitagaiName','villageName','district'].includes(key)}/></label>)}</div>)}</section>
  <section className="reference-table-scroll" aria-label="குடும்ப உறுப்பினர் விவரங்கள்"><table className="reference-table member-reference-table"><colgroup><col className="col-number"/>{memberRows.map(([key])=><col key={key} className={`col-${key}`}/>)}<col className="col-actions no-print"/></colgroup><thead><tr><th>வ எண்.</th>{memberRows.map(([key,label])=><th key={key}>{label}</th>)}<th className="no-print">செயல்</th></tr></thead><tbody>{family.members.map((member,index)=><tr key={index}><td className="row-number" data-label="வ எண்.">{index+1}</td>{memberRows.map(([key])=><td key={key} data-label={memberRows.find(([rowKey])=>rowKey===key)?.[1]}><MemberInput field={key} member={member} index={index} updateMember={updateMember}/></td>)}<td className="no-print row-action"><button type="button" onClick={()=>removeRow(index)} aria-label="வரிசையை நீக்கு">×</button></td></tr>)}</tbody></table></section>
  {error&&<p className="reference-message error no-print">{error}</p>}{notice&&<p className="reference-message success no-print">{notice}</p>}<div className="reference-paper-note">மக்கள் கணக்கெடுப்பு பயன்பாட்டிற்கு மட்டும்</div>
  <footer className="reference-controls no-print"><button type="button" className="plain-action" onClick={addRow}>+ உறுப்பினரைச் சேர்க்க</button><button type="button" className="plain-action" onClick={()=>window.print()}>அச்சிடு</button><button type="button" className="plain-action" onClick={()=>go('/admin/login')}>நிர்வாகி உள்நுழைவு</button><button type="submit" className="save-action">படிவத்தைச் சேமி</button></footer>
 </form></div></main>
}


