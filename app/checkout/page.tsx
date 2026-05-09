'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

const T = {
  bg:'#080818',bg2:'#0f0f1f',surface:'#1a1a2e',
  gold:'#d4af37',goldDim:'rgba(212,175,55,0.15)',borderGold:'rgba(212,175,55,0.3)',
  text:'#f5f0e8',textMid:'rgba(245,240,232,0.6)',textDim:'rgba(245,240,232,0.35)',
  border:'rgba(255,255,255,0.08)',green:'#4ade80',red:'#f87171',
}
function fmt(n){return `R ${Math.round(n).toLocaleString()}`}

// Interest rate assumption 7.5% pa for float saving calculation
const INTEREST_RATE=0.075

function calcFloatSaving(extra,travelDate){
  if(!travelDate||extra<=0)return 0
  const daysToTravel=Math.max(0,Math.ceil((new Date(travelDate).getTime()-Date.now())/(1000*60*60*24)))
  const balanceDays=Math.max(0,daysToTravel-30) // balance normally due 30 days before
  return Math.round(extra*(INTEREST_RATE/365)*balanceDays)
}

function formatDate(dateStr){
  if(!dateStr)return ''
  return new Date(dateStr).toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})
}

function balanceDueDate(travelDate,depositPct){
  if(!travelDate)return '30 days before travel'
  if(depositPct>=100)return 'Paid in full — no balance due'
  const d=new Date(travelDate)
  d.setDate(d.getDate()-30)
  return `Due by ${formatDate(d.toISOString())}`
}

const NATIONALITIES=['Afghan','Albanian','Algerian','American','Andorran','Angolan','Argentine','Armenian','Australian','Austrian','Azerbaijani','Bahraini','Bangladeshi','Belarusian','Belgian','Belizean','Beninese','Bhutanese','Bolivian','Bosnian','Botswanan','Brazilian','British','Bruneian','Bulgarian','Burkinabe','Burundian','Cambodian','Cameroonian','Canadian','Cape Verdean','Central African','Chadian','Chilean','Chinese','Colombian','Congolese','Costa Rican','Croatian','Cuban','Cypriot','Czech','Danish','Djiboutian','Dominican','Dutch','Ecuadorian','Egyptian','Emirati','Eritrean','Estonian','Ethiopian','Fijian','Finnish','French','Gabonese','Gambian','Georgian','German','Ghanaian','Greek','Guatemalan','Guinean','Haitian','Honduran','Hungarian','Icelandic','Indian','Indonesian','Iranian','Iraqi','Irish','Israeli','Italian','Ivorian','Jamaican','Japanese','Jordanian','Kazakh','Kenyan','Korean','Kuwaiti','Kyrgyz','Laotian','Latvian','Lebanese','Liberian','Libyan','Lithuanian','Luxembourgish','Macedonian','Malagasy','Malawian','Malaysian','Maldivian','Malian','Maltese','Mauritanian','Mauritian','Mexican','Moldovan','Mongolian','Montenegrin','Moroccan','Mozambican','Namibian','Nepalese','New Zealander','Nicaraguan','Nigerian','Norwegian','Omani','Pakistani','Panamanian','Paraguayan','Peruvian','Filipino','Polish','Portuguese','Qatari','Romanian','Russian','Rwandan','Saudi','Senegalese','Serbian','Sierra Leonean','Singaporean','Slovak','Slovenian','Somali','South African','South Korean','Spanish','Sri Lankan','Sudanese','Swazi','Swedish','Swiss','Syrian','Taiwanese','Tajik','Tanzanian','Thai','Togolese','Trinidadian','Tunisian','Turkish','Ugandan','Ukrainian','Uruguayan','Uzbek','Venezuelan','Vietnamese','Yemeni','Zambian','Zimbabwean']

function CheckoutForm(){
  const params=useSearchParams()
  const itineraryId=params.get('id')
  const [itinerary,setItinerary]=useState(null)
  const [loading,setLoading]=useState(true)
  const [submitting,setSubmitting]=useState(false)
  const [error,setError]=useState('')
  const [form,setForm]=useState({name:'',email:'',phone:'',nationality:''})
  const [emailError,setEmailError]=useState('')
  const [nationalitySearch,setNationalitySearch]=useState('')
  const [showDropdown,setShowDropdown]=useState(false)
  const [filteredNationalities,setFilteredNationalities]=useState([])
  const [depositPct,setDepositPct]=useState(30)

  useEffect(()=>{
    if(!itineraryId){setLoading(false);setError('No journey ID found');return}
    fetch(`/api/itinerary?id=${itineraryId}`)
      .then(r=>r.json())
      .then(d=>{if(d.success)setItinerary(d.itinerary);else setError('Journey not found')})
      .catch(()=>setError('Could not load journey'))
      .finally(()=>setLoading(false))
  },[itineraryId])

  useEffect(()=>{
    if(nationalitySearch.length>0){
      setFilteredNationalities(NATIONALITIES.filter(n=>n.toLowerCase().startsWith(nationalitySearch.toLowerCase())))
      setShowDropdown(true)
    }else{setFilteredNationalities([]);setShowDropdown(false)}
  },[nationalitySearch])

  const validateEmail=(email)=>{
    const re=/^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if(!email)return 'Email address is required'
    if(!re.test(email))return 'Please enter a valid email address (e.g. name@example.com)'
    return ''
  }

  const handleNationalitySelect=(nationality)=>{
    setForm(f=>({...f,nationality}))
    setNationalitySearch(nationality)
    setShowDropdown(false)
  }

  const handlePay=async()=>{
    const emailErr=validateEmail(form.email)
    if(!form.name){setError('Please enter your full name');return}
    if(emailErr){setEmailError(emailErr);setError('Please fix the errors above');return}
    if(!form.nationality){setError('Please select your nationality');return}
    if(!itinerary?.id){setError('Journey not loaded — please go back');return}
    setSubmitting(true);setError('')
    try{
      const res=await fetch('/api/checkout',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          itinerary_id:itinerary.id,
          traveller_email:form.email,
          traveller_name:form.name,
          deposit_pct:depositPct,
        })
      })
      const data=await res.json()
      if(data.success&&data.payfast_url){window.location.href=data.payfast_url}
      else{setError(data.error||'Could not process payment')}
    }catch(e){
      setError('Connection error — please try again')
    }finally{setSubmitting(false)}
  }

  if(loading)return <div style={{color:'#d4af37',textAlign:'center',padding:60,fontFamily:"'Playfair Display',serif",fontSize:18}}>Loading your journey…</div>

  const total=itinerary?.total_display_zar||0
  const depositAmt=Math.round(total*depositPct/100)
  const balanceAmt=total-depositAmt
  const travelDate=itinerary?.date_from
  const extraPaid=depositAmt-Math.round(total*0.30)
  const floatSaving=calcFloatSaving(extraPaid,travelDate)
  const isPayingMore=depositPct>30
  const isPayingFull=depositPct>=100

  return(
    <div style={{maxWidth:520,margin:'0 auto',padding:'24px 16px'}}>
      <div style={{textAlign:'center',marginBottom:28}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:T.gold,fontWeight:700,marginBottom:4}}>Confirm Your Journey</div>
        <div style={{fontSize:13,color:T.textMid}}>Secure your dates today</div>
      </div>

      {/* Total */}
      <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'16px 20px',marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <span style={{fontSize:13,color:T.textMid}}>Total journey value</span>
          <span style={{fontSize:15,fontWeight:700,color:T.text}}>{fmt(total)}</span>
        </div>

        {/* Deposit slider */}
        <div style={{marginBottom:12}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
            <span style={{fontSize:12,color:T.textMid}}>Pay today</span>
            <span style={{fontSize:16,fontWeight:700,color:T.gold}}>{fmt(depositAmt)}</span>
          </div>
          <input type="range" min={30} max={100} step={5} value={depositPct}
            onChange={e=>setDepositPct(Number(e.target.value))}
            style={{width:'100%',accentColor:T.gold,cursor:'pointer'}}/>
          <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
            <span style={{fontSize:10,color:T.textDim}}>Minimum 30%</span>
            <span style={{fontSize:10,color:T.textDim}}>Pay in full</span>
          </div>
        </div>

        {/* Float saving incentive */}
        {isPayingMore&&floatSaving>0&&(
          <div style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.2)',borderRadius:9,padding:'10px 12px',marginBottom:12}}>
            <div style={{fontSize:12,color:T.green,fontWeight:600,marginBottom:2}}>
              ✦ {isPayingFull?'Paying in full':'Paying more now'} — save {fmt(floatSaving)}
            </div>
            <div style={{fontSize:11,color:T.textDim,lineHeight:1.5}}>
              {isPayingFull
                ?`By paying in full today, you save ${fmt(floatSaving)} in early payment savings — passed directly to you.`
                :`By paying an extra ${fmt(extraPaid)} now, you save ${fmt(floatSaving)} — the equivalent of early payment savings passed to you.`
              }
            </div>
          </div>
        )}

        {/* Balance */}
        {!isPayingFull&&(
          <div style={{borderTop:`0.5px solid ${T.border}`,paddingTop:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div>
                <div style={{fontSize:12,color:T.textMid}}>Balance remaining</div>
                <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{balanceDueDate(travelDate,depositPct)}</div>
              </div>
              <span style={{fontSize:14,fontWeight:600,color:T.textMid}}>{fmt(balanceAmt)}</span>
            </div>
          </div>
        )}
        {isPayingFull&&(
          <div style={{borderTop:`0.5px solid ${T.border}`,paddingTop:10,textAlign:'center'}}>
            <span style={{fontSize:12,color:T.green}}>✓ Paid in full — no balance due</span>
          </div>
        )}
      </div>

      {/* Form fields */}
      <div style={{marginBottom:20}}>
        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:11,color:T.gold,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Full name</label>
          <input type="text" placeholder="As on your passport" value={form.name}
            onChange={e=>setForm(f=>({...f,name:e.target.value}))}
            style={{width:'100%',padding:'12px 14px',background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:11,color:T.gold,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Email address</label>
          <input type="email" placeholder="name@example.com" value={form.email}
            onChange={e=>{setForm(f=>({...f,email:e.target.value}));if(emailError)setEmailError(validateEmail(e.target.value))}}
            onBlur={()=>setEmailError(validateEmail(form.email))}
            style={{width:'100%',padding:'12px 14px',background:T.surface,border:`0.5px solid ${emailError?T.red:T.border}`,borderRadius:9,color:T.text,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          {emailError&&<div style={{fontSize:11,color:T.red,marginTop:4}}>{emailError}</div>}
        </div>

        <div style={{marginBottom:14}}>
          <label style={{display:'block',fontSize:11,color:T.gold,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Mobile number</label>
          <input type="tel" placeholder="+27 or international format" value={form.phone}
            onChange={e=>setForm(f=>({...f,phone:e.target.value}))}
            style={{width:'100%',padding:'12px 14px',background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        </div>

        <div style={{marginBottom:14,position:'relative'}}>
          <label style={{display:'block',fontSize:11,color:T.gold,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:5}}>Nationality</label>
          <input type="text" placeholder="Type to search (e.g. South African)" value={nationalitySearch}
            onChange={e=>{setNationalitySearch(e.target.value);setForm(f=>({...f,nationality:''}))}}
            onFocus={()=>{if(nationalitySearch.length>0)setShowDropdown(true)}}
            onBlur={()=>setTimeout(()=>setShowDropdown(false),150)}
            style={{width:'100%',padding:'12px 14px',background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:14,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          {showDropdown&&filteredNationalities.length>0&&(
            <div style={{position:'absolute',top:'100%',left:0,right:0,background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:9,zIndex:100,maxHeight:200,overflowY:'auto',marginTop:4,boxShadow:'0 8px 24px rgba(0,0,0,0.4)'}}>
              {filteredNationalities.map(n=>(
                <div key={n} onMouseDown={()=>handleNationalitySelect(n)}
                  style={{padding:'10px 14px',cursor:'pointer',fontSize:13,color:T.text,borderBottom:`0.5px solid ${T.border}`}}
                  onMouseEnter={e=>e.currentTarget.style.background='rgba(212,175,55,0.1)'}
                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                  {n}
                </div>
              ))}
            </div>
          )}
          {nationalitySearch.length>0&&filteredNationalities.length===0&&(
            <div style={{fontSize:11,color:T.textDim,marginTop:4}}>No match — try a different spelling</div>
          )}
        </div>
      </div>

      {error&&<div style={{background:'rgba(248,113,113,0.1)',border:'0.5px solid rgba(248,113,113,0.3)',borderRadius:8,padding:'10px 14px',marginBottom:16,fontSize:12,color:T.red}}>{error}</div>}

      <div style={{fontSize:11,color:T.textDim,textAlign:'center',marginBottom:18,lineHeight:1.5}}>
        🔒 Secure payment via PayFast · South African Rands
      </div>

      <button onClick={handlePay} disabled={submitting||!itinerary}
        style={{width:'100%',padding:'18px',background:(submitting||!itinerary)?'rgba(212,175,55,0.4)':`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',border:'none',borderRadius:12,fontSize:16,fontWeight:700,cursor:(submitting||!itinerary)?'not-allowed':'pointer',fontFamily:'inherit'}}>
        {submitting?'Processing…':total>0?`Pay ${isPayingFull?'in Full':'Deposit'} ${fmt(depositAmt)} →`:'Loading…'}
      </button>

      <div style={{textAlign:'center',marginTop:14,fontSize:11,color:T.textDim}}>
        You will be redirected to PayFast's secure payment page
      </div>
    </div>
  )
}

export default function CheckoutPage(){
  return(
    <div style={{minHeight:'100vh',background:'#080818',fontFamily:'Arial,sans-serif',color:'#f5f0e8'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');`}</style>
      <div style={{background:'#0f0f1f',borderBottom:'0.5px solid rgba(255,255,255,0.08)',padding:'16px 24px',textAlign:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:'#d4af37',fontWeight:700}}>✦ The Safari Edition</div>
      </div>
      <Suspense fallback={<div style={{color:'#d4af37',textAlign:'center',padding:40}}>Loading…</div>}>
        <CheckoutForm/>
      </Suspense>
    </div>
  )
}
