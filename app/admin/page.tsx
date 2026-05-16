'use client'
import { useState, useEffect, useRef } from 'react'

const T = {
  bg:'#080818', bg2:'#0f0f1f', surface:'#1a1a2e',
  gold:'#d4af37', goldDim:'rgba(212,175,55,0.15)', borderGold:'rgba(212,175,55,0.3)',
  text:'#f5f0e8', textMid:'rgba(245,240,232,0.6)', textDim:'rgba(245,240,232,0.35)',
  border:'rgba(255,255,255,0.08)', green:'#4ade80', red:'#f87171', blue:'#60a5fa', amber:'#fbbf24',
}
const SUPABASE_URL='https://tkthsbxuyihoblpcfnml.supabase.co'
const SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrdGhzYnh1eWlob2JscGNmbm1sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MzkzODAsImV4cCI6MjA5MzMxNTM4MH0.vMYkuyH-5vs4zCd9ONxq9evvZZ_OTyxSPyUSU6pdUGg'


// ── BULK TEST DATA ────────────────────────────────────────────
const BULK_BOOKINGS=[
  {id:'b1',booking_reference:'TSE-PAST001',status:'confirmed',total_display_zar:186000,total_net_zar:157980,total_paid_zar:186000,booked_at:'2026-01-15',lead_traveller_snapshot:{name:'Müller Family',email:'muller@gmail.com'},itinerary_id:'it1',supplier_id:'sup-singita-001'},
  {id:'b2',booking_reference:'TSE-PAST002',status:'confirmed',total_display_zar:312000,total_net_zar:265200,total_paid_zar:312000,booked_at:'2026-02-01',lead_traveller_snapshot:{name:'Thompson & Party',email:'jthompson@outlook.com'},itinerary_id:'it2',supplier_id:'sup-singita-001'},
  {id:'b3',booking_reference:'TSE-PAST003',status:'confirmed',total_display_zar:245000,total_net_zar:208250,total_paid_zar:245000,booked_at:'2026-02-20',lead_traveller_snapshot:{name:'Davies Honeymoon',email:'s.davies@icloud.com'},itinerary_id:'it3',supplier_id:'sup-singita-001'},
  {id:'b4',booking_reference:'TSE-CURR001',status:'confirmed',total_display_zar:465000,total_net_zar:394500,total_paid_zar:465000,booked_at:'2026-03-01',lead_traveller_snapshot:{name:'Henderson Couple',email:'henderson@mac.com'},itinerary_id:'it4',supplier_id:'sup-singita-001'},
  {id:'b5',booking_reference:'TSE-CURR002',status:'confirmed',total_display_zar:224000,total_net_zar:189760,total_paid_zar:67200,booked_at:'2026-03-15',lead_traveller_snapshot:{name:'Johnson Family',email:'johnson@gmail.com'},itinerary_id:'it5',supplier_id:'sup-singita-001'},
  {id:'b6',booking_reference:'TSE-FUT001',status:'confirmed',total_display_zar:390000,total_net_zar:331500,total_paid_zar:117000,booked_at:'2026-04-01',lead_traveller_snapshot:{name:'Van der Berg Group',email:'vdberg@telkom.net'},itinerary_id:'it6',supplier_id:'sup-singita-001'},
  {id:'b7',booking_reference:'TSE-FUT002',status:'confirmed',total_display_zar:520000,total_net_zar:442000,total_paid_zar:156000,booked_at:'2026-04-10',lead_traveller_snapshot:{name:'Williams Anniversary',email:'rwilliams@bt.com'},itinerary_id:'it7',supplier_id:'sup-singita-001'},
  {id:'b8',booking_reference:'TSE-FUT003',status:'confirmed',total_display_zar:185000,total_net_zar:157250,total_paid_zar:0,booked_at:'2026-04-20',lead_traveller_snapshot:{name:'Patel Family',email:'dpatel@yahoo.com'},itinerary_id:'it8',supplier_id:'sup-singita-001'},
  {id:'b9',booking_reference:'TSE-FUT004',status:'pending_payment',total_display_zar:680000,total_net_zar:578000,total_paid_zar:204000,booked_at:'2026-04-25',lead_traveller_snapshot:{name:'Okonkwo & Party',email:'okonkwo@gmail.com'},itinerary_id:'it9',supplier_id:'sup-singita-001'},
]

const BULK_SUPPLIER_STATS: Record<string,any> = {
  'sup-singita-001': {
    trust_score:97,content_score:88,active_campaigns:2,
    net_commission_ytd:187420,bookings_ytd:8,bednights_ytd:42,
    threshold_nights:150,override_pct:3,
    peer_avg_trust:89,peer_avg_content:74,region:'Sabi Sand Game Reserve'
  }
}

async function sb(path:string,opts:any={}){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json','Prefer':'return=representation',...opts.headers},...opts
  })
  if(!res.ok)throw new Error(await res.text())
  const text=await res.text(); return text?JSON.parse(text):[]
}

function fmt(n:number){return `R ${Math.round(n).toLocaleString()}`}
function fmtDate(d:string){return d?new Date(d).toLocaleDateString('en-ZA',{day:'numeric',month:'short',year:'numeric'}):'—'}
function daysSince(d:string){return Math.floor((Date.now()-new Date(d).getTime())/(1000*60*60*24))}

// ── EXPORT ────────────────────────────────────────────────────
function exportCSV(data:any[],filename:string){
  if(!data.length)return
  const keys=Object.keys(data[0])
  const csv=[keys.join(','),...data.map(r=>keys.map(k=>`"${String(r[k]||'').replace(/"/g,'""')}"`).join(','))].join('\n')
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([csv],{type:'text/csv'})),download:`${filename}.csv`})
  a.click()
}
function exportPDF(title:string,headers:string[],rows:string[][]){
  const html=`<html><head><style>body{font-family:Arial,sans-serif;font-size:11px;padding:20px}h1{font-size:18px;color:#111}p{color:#666;font-size:10px;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#080818;color:#d4af37;padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:7px 10px;border-bottom:1px solid #eee;font-size:11px}tr:nth-child(even){background:#f9f9f9}</style></head><body><h1>${title}</h1><p>Exported ${new Date().toLocaleDateString('en-ZA',{day:'numeric',month:'long',year:'numeric'})} · The Safari Edition</p><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
  const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),500)}
}

// ── TABLE TOOLBAR ─────────────────────────────────────────────
// Best practice: search inline top-right, filter as dropdown, export in ⋯ menu
function TableToolbar({
  search, onSearch, searchPlaceholder,
  filters, activeFilter, onFilter,
  onExportCSV, onExportPDF,
  count, title, actions
}:{
  search:string, onSearch:(v:string)=>void, searchPlaceholder:string,
  filters?:{label:string,value:string}[], activeFilter?:string, onFilter?:(v:string)=>void,
  onExportCSV?:()=>void, onExportPDF?:()=>void,
  count?:number, title:string, actions?:React.ReactNode
}){
  const [showFilter,setShowFilter]=useState(false)
  const [showMore,setShowMore]=useState(false)
  const filterRef=useRef<HTMLDivElement>(null)
  const moreRef=useRef<HTMLDivElement>(null)

  useEffect(()=>{
    function handleClick(e:MouseEvent){
      if(filterRef.current&&!filterRef.current.contains(e.target as Node))setShowFilter(false)
      if(moreRef.current&&!moreRef.current.contains(e.target as Node))setShowMore(false)
    }
    document.addEventListener('mousedown',handleClick)
    return()=>document.removeEventListener('mousedown',handleClick)
  },[])

  const activeFilterLabel=filters?.find(f=>f.value===activeFilter)?.label

  return(
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16,gap:12,flexWrap:'wrap'}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{fontSize:20,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif"}}>{title}</div>
        {count!==undefined&&<div style={{fontSize:12,color:T.textDim,background:'rgba(255,255,255,0.06)',borderRadius:20,padding:'2px 9px'}}>{count}</div>}
      </div>
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
        {actions}

        {/* Inline search */}
        <div style={{position:'relative',display:'flex',alignItems:'center'}}>
          <span style={{position:'absolute',left:10,color:T.textDim,fontSize:13,pointerEvents:'none'}}>⌕</span>
          <input value={search} onChange={e=>onSearch(e.target.value)} placeholder={searchPlaceholder}
            style={{paddingLeft:28,paddingRight:10,paddingTop:7,paddingBottom:7,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',width:180}}/>
          {search&&<button onClick={()=>onSearch('')} style={{position:'absolute',right:8,background:'none',border:'none',color:T.textDim,cursor:'pointer',fontSize:14,lineHeight:1}}>×</button>}
        </div>

        {/* Filter dropdown */}
        {filters&&onFilter&&(
          <div ref={filterRef} style={{position:'relative'}}>
            <button onClick={()=>setShowFilter(s=>!s)}
              style={{padding:'7px 12px',borderRadius:8,border:`0.5px solid ${activeFilter&&activeFilter!=='all'?T.gold:T.border}`,background:activeFilter&&activeFilter!=='all'?T.goldDim:'transparent',color:activeFilter&&activeFilter!=='all'?T.gold:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
              {activeFilter&&activeFilter!=='all'?`${activeFilterLabel}`:'Filter'} ▾
            </button>
            {showFilter&&(
              <div style={{position:'absolute',top:'100%',right:0,marginTop:4,background:T.bg2,border:`0.5px solid ${T.borderGold}`,borderRadius:10,overflow:'hidden',zIndex:200,minWidth:140,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
                {filters.map(f=>(
                  <button key={f.value} onClick={()=>{onFilter(f.value);setShowFilter(false)}}
                    style={{width:'100%',padding:'9px 14px',background:activeFilter===f.value?T.goldDim:'transparent',border:'none',color:activeFilter===f.value?T.gold:T.textMid,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:8}}>
                    {activeFilter===f.value&&<span style={{color:T.gold}}>✓</span>}{f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ⋯ more menu (export) */}
        {(onExportCSV||onExportPDF)&&(
          <div ref={moreRef} style={{position:'relative'}}>
            <button onClick={()=>setShowMore(s=>!s)}
              style={{padding:'7px 10px',borderRadius:8,border:`0.5px solid ${T.border}`,background:'transparent',color:T.textDim,fontSize:14,cursor:'pointer',fontFamily:'inherit',lineHeight:1}}>
              ⋯
            </button>
            {showMore&&(
              <div style={{position:'absolute',top:'100%',right:0,marginTop:4,background:T.bg2,border:`0.5px solid ${T.border}`,borderRadius:10,overflow:'hidden',zIndex:200,minWidth:140,boxShadow:'0 8px 24px rgba(0,0,0,0.5)'}}>
                {onExportCSV&&<button onClick={()=>{onExportCSV();setShowMore(false)}} style={{width:'100%',padding:'9px 14px',background:'transparent',border:'none',color:T.textMid,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:8}}>📊 Export CSV</button>}
                {onExportPDF&&<button onClick={()=>{onExportPDF();setShowMore(false)}} style={{width:'100%',padding:'9px 14px',background:'transparent',border:'none',color:T.textMid,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left',display:'flex',alignItems:'center',gap:8}}>📄 Export PDF</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SORTABLE COLUMN HEADER ────────────────────────────────────
function ColHeader({label,field,sortField,sortDir,onSort,align='left',width}:{label:string,field?:string,sortField?:string,sortDir?:string,onSort?:(f:string)=>void,align?:string,width?:string}){
  const active=field&&sortField===field
  return(
    <div onClick={()=>field&&onSort&&onSort(field)}
      style={{cursor:field?'pointer':'default',display:'flex',alignItems:'center',gap:4,justifyContent:align==='right'?'flex-end':'flex-start',color:active?T.gold:T.textDim,fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',userSelect:'none',width}}>
      {label}
      {field&&<span style={{fontSize:9,opacity:active?1:0.3}}>{active?(sortDir==='asc'?'↑':'↓'):'↕'}</span>}
    </div>
  )
}

// ── NAV ───────────────────────────────────────────────────────
const NAV=[{id:'dashboard',label:'Dashboard',icon:'📊'},{id:'bookings',label:'Bookings',icon:'📋'},{id:'suppliers',label:'Suppliers',icon:'🏕️'},{id:'stack',label:'Stack Manager',icon:'🎯'},{id:'knowledge',label:'Knowledge Base',icon:'📚'},{id:'itineraries',label:'Itineraries',icon:'🗺️'}]

// ── LOGIN ─────────────────────────────────────────────────────
// ── UNIFIED USER DIRECTORY ───────────────────────────────────
const ALL_USERS = [
  // Edition team — land on admin dashboard
  {email:'admin@thesafariedition.com', pwd:'safari2026', name:'JD (Founder)', type:'edition', role:'edition_admin'},
  {email:'ops@thesafariedition.com',   pwd:'ops2026',    name:'Sarah Mitchell', type:'edition', role:'edition_ops'},
  {email:'finance@thesafariedition.com', pwd:'finance2026', name:'Tom van der Berg', type:'edition', role:'edition_finance'},
  {email:'content@thesafariedition.com', pwd:'content2026', name:'Priya Naidoo', type:'edition', role:'edition_content'},
  // Supplier contacts — redirect to supplier portal
  {email:'admin@singita.com',          pwd:'admin2026',  name:'Sarah Dlamini', type:'supplier', role:'supplier_admin',          supplier:'Singita Sabi Sand'},
  {email:'reservations@singita.com',   pwd:'res2026',    name:'Thabo Nkosi',   type:'supplier', role:'reservations_manager',    supplier:'Singita Sabi Sand'},
  {email:'content@singita.com',        pwd:'content2026',name:'Priya Moodley', type:'supplier', role:'content_manager',         supplier:'Singita Sabi Sand'},
  {email:'finance@singita.com',        pwd:'finance2026',name:'James Olifant', type:'supplier', role:'finance_contact',         supplier:'Singita Sabi Sand'},
  {email:'sales@singita.com',          pwd:'sales2026',  name:'Mpho Sithole',  type:'supplier', role:'sales_marketing',         supplier:'Singita Sabi Sand'},
]

function Login({onLogin}:{onLogin:(name:string)=>void}){
  const [email,setEmail]=useState('')
  const [pwd,setPwd]=useState('')
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(false)

  const handle=async()=>{
    setLoading(true); setError('')
    await new Promise(r=>setTimeout(r,400)) // simulate auth
    const user=ALL_USERS.find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.pwd===pwd)
    if(user){
      // Store session in sessionStorage — persists through navigation, clears on tab close
      sessionStorage.setItem('tse_session', JSON.stringify({
        name:user.name, email:user.email, type:user.type,
        role:user.role, supplier:user.supplier||null
      }))
      if(user.type==='supplier'){
        // Write session FIRST, then redirect — no URL params needed
        const supplierSess = JSON.stringify({name:user.name,email:user.email,type:'supplier',role:user.role,supplier:user.supplier||''})
        sessionStorage.setItem('tse_session', supplierSess)
        localStorage.setItem('tse_session', supplierSess)
        window.location.href='/supplier'
      } else {
        const sess = JSON.stringify({name:user.name,email:user.email,type:'edition',role:user.role})
        sessionStorage.setItem('tse_session', sess)
        localStorage.setItem('tse_session', sess)
        onLogin(user.name)
      }
    } else {
      setError('Incorrect email or password')
    }
    setLoading(false)
  }

  const EDITION_USERS = ALL_USERS.filter(u=>u.type==='edition')
  const SUPPLIER_USERS = ALL_USERS.filter(u=>u.type==='supplier')

  return(
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'Arial,sans-serif'}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap')`}</style>
      <div style={{width:'100%',maxWidth:760,padding:'24px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,alignItems:'start'}}>

        {/* Login form */}
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:'32px'}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:11,color:T.gold,letterSpacing:'0.2em',textTransform:'uppercase',marginBottom:6}}>The Safari Edition</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:T.text,fontWeight:700,marginBottom:4}}>Sign In</div>
          <div style={{fontSize:12,color:T.textDim,marginBottom:24}}>Edition team and supplier partners</div>

          <div style={{marginBottom:12}}>
            <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Email address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder="you@example.com"
              style={{width:'100%',padding:'11px 13px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          <div style={{marginBottom:16}}>
            <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:5}}>Password</label>
            <input type="password" value={pwd} onChange={e=>setPwd(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handle()} placeholder="••••••••"
              style={{width:'100%',padding:'11px 13px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          </div>
          {error&&<div style={{fontSize:12,color:T.red,marginBottom:12,padding:'8px 12px',background:'rgba(248,113,113,0.08)',borderRadius:7}}>{error}</div>}
          <button onClick={handle} disabled={loading}
            style={{width:'100%',padding:'12px',background:loading?'rgba(255,255,255,0.06)':`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:9,color:loading?T.textDim:'#0a0a0a',fontSize:14,fontWeight:700,cursor:loading?'wait':'pointer',fontFamily:'inherit',transition:'all 0.2s'}}>
            {loading?'Signing in…':'Sign In →'}
          </button>

          <div style={{marginTop:20,padding:'12px',background:'rgba(96,165,250,0.06)',border:'0.5px solid rgba(96,165,250,0.18)',borderRadius:9,fontSize:11,color:'#60a5fa',lineHeight:1.6}}>
            Edition team → Admin Dashboard<br/>
            Supplier contacts → Supplier Portal (automatic)
          </div>
        </div>

        {/* Demo credentials */}
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:11,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Edition Team</div>
            {EDITION_USERS.map(u=>(
              <div key={u.email} onClick={()=>{setEmail(u.email);setPwd(u.pwd)}} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',borderRadius:7,cursor:'pointer',marginBottom:4,border:`0.5px solid transparent`}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)';(e.currentTarget as HTMLElement).style.borderColor=T.border}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.borderColor='transparent'}}>
                <span style={{fontSize:12,color:T.blue}}>{u.email}</span>
                <span style={{fontSize:11,color:T.textDim}}>{u.name}</span>
              </div>
            ))}
          </div>
          <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:'18px'}}>
            <div style={{fontSize:11,color:T.gold,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Supplier Contacts <span style={{color:T.textDim,fontWeight:400}}>→ auto-routes to portal</span></div>
            {SUPPLIER_USERS.map(u=>(
              <div key={u.email} onClick={()=>{setEmail(u.email);setPwd(u.pwd)}} style={{display:'flex',justifyContent:'space-between',padding:'7px 10px',borderRadius:7,cursor:'pointer',marginBottom:4,border:`0.5px solid transparent`}}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)';(e.currentTarget as HTMLElement).style.borderColor=T.border}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.borderColor='transparent'}}>
                <span style={{fontSize:12,color:'#a78bfa'}}>{u.email}</span>
                <span style={{fontSize:11,color:T.textDim}}>{u.role.replace(/_/g,' ')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── STAT CARD ─────────────────────────────────────────────────
function StatCard({label,value,sub,color,onClick}:{label:string,value:string,sub?:string,color?:string,onClick?:()=>void}){
  return(
    <div onClick={onClick} style={{background:T.surface,border:`0.5px solid ${onClick?T.borderGold:T.border}`,borderRadius:12,padding:'16px 18px',cursor:onClick?'pointer':'default'}}
      onMouseEnter={e=>{if(onClick)(e.currentTarget as HTMLElement).style.background='rgba(212,175,55,0.04)'}}
      onMouseLeave={e=>{if(onClick)(e.currentTarget as HTMLElement).style.background=T.surface}}>
      <div style={{fontSize:11,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,color:color||T.gold}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.textDim,marginTop:4}}>{sub}</div>}
      {onClick&&<div style={{fontSize:10,color:T.gold,marginTop:6}}>View →</div>}
    </div>
  )
}

// ── NUDGE MODAL ───────────────────────────────────────────────
function NudgeModal({quote,onClose}:{quote:any,onClose:()=>void}){
  const [msg,setMsg]=useState(`Hi${quote.name?' '+quote.name.split(' ')[0]:''}, just checking in on your safari quote. Your itinerary is still available — happy to answer any questions or make changes. The Safari Edition team.`)
  const [sent,setSent]=useState(false)
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:28,width:'100%',maxWidth:480}}>
        <div style={{fontSize:16,fontWeight:700,color:T.gold,marginBottom:4}}>Nudge Traveller</div>
        <div style={{fontSize:12,color:T.textDim,marginBottom:16}}>{quote.name} · {quote.email}</div>
        <textarea value={msg} onChange={e=>setMsg(e.target.value)} rows={5}
          style={{width:'100%',padding:'10px 12px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:9,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box',resize:'vertical',marginBottom:16}}/>
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>setSent(true)} style={{flex:1,padding:'11px',background:sent?T.green:`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:9,color:sent?'white':'#0a0a0a',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{sent?'✓ Logged':'Send Nudge'}</button>
          <button onClick={onClose} style={{padding:'11px 18px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:9,color:T.textDim,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Close</button>
        </div>
        {sent&&<div style={{fontSize:11,color:T.textDim,marginTop:10,textAlign:'center'}}>Logged — email/WhatsApp sends when Operations module is connected</div>}
      </div>
    </div>
  )
}

// ── OPEN QUOTES ───────────────────────────────────────────────
function OpenQuotes({onBack}:{onBack:()=>void}){
  const [quotes,setQuotes]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [nudging,setNudging]=useState<any>(null)
  const [search,setSearch]=useState('')
  const [sortField,setSortField]=useState('created_at')
  const [sortDir,setSortDir]=useState('desc')

  useEffect(()=>{
    Promise.resolve([])
      .then(async(data:any[])=>{
        const enriched=await Promise.all(data.map(async(it:any)=>{
          try{const b=await sb(`bookings?select=lead_traveller_snapshot&itinerary_id=eq.${it.id}&limit=1`);return{...it,name:b[0]?.lead_traveller_snapshot?.name||null,email:b[0]?.lead_traveller_snapshot?.email||null}}
          catch{return it}
        }))
        setQuotes(enriched)
      }).catch(console.error).finally(()=>setLoading(false))
  },[])

  const quoteExpiry=(d:string)=>{const exp=new Date(d);exp.setDate(exp.getDate()+7);return Math.max(0,Math.floor((exp.getTime()-Date.now())/(1000*60*60*24)))}
  const handleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}

  let filtered=quotes.filter(q=>!search||(q.name||'').toLowerCase().includes(search.toLowerCase())||(q.title||'').toLowerCase().includes(search.toLowerCase()))
  filtered=[...filtered].sort((a,b)=>{
    const av=sortField==='total_display_zar'?(a[sortField]||0):new Date(a[sortField]).getTime()
    const bv=sortField==='total_display_zar'?(b[sortField]||0):new Date(b[sortField]).getTime()
    return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  const totalValue=filtered.reduce((s:number,q:any)=>s+(q.total_display_zar||0),0)
  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading…</div>

  return(
    <div>
      {nudging&&<NudgeModal quote={nudging} onClose={()=>setNudging(null)}/>}
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
        <button onClick={onBack} style={{background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:8,padding:'6px 12px',color:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>← Dashboard</button>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif"}}>Open Quotes</div>
          <div style={{fontSize:12,color:T.textDim}}>{filtered.length} quotes · Pipeline {fmt(totalValue)}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
        <StatCard label="Pipeline value" value={fmt(totalValue)} color={T.gold}/>
        <StatCard label="Open quotes" value={String(filtered.length)} color={T.amber}/>
        <StatCard label="Avg value" value={filtered.length>0?fmt(totalValue/filtered.length):'—'}/>
      </div>

      <TableToolbar title="" search={search} onSearch={setSearch} searchPlaceholder="Search by name or journey…" count={filtered.length}
        onExportCSV={()=>exportCSV(filtered.map(q=>({Name:q.name||'—',Email:q.email||'—',Journey:q.title||'—',Value:q.total_display_zar||0,Nights:q.nights||'—',Created:fmtDate(q.created_at)})),'open-quotes')}
        onExportPDF={()=>exportPDF('Open Quotes',['Name','Email','Journey','Value','Days','Expires'],filtered.map(q=>[q.name||'—',q.email||'—',q.title||'—',fmt(q.total_display_zar||0),String(daysSince(q.created_at)),`${quoteExpiry(q.created_at)}d`]))}
      />

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`,gap:8}}>
          <ColHeader label="Traveller" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Journey" />
          <ColHeader label="Value" field="total_display_zar" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right"/>
          <ColHeader label="Since / Validity" field="created_at" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Action"/>
        </div>
        {filtered.length===0?<div style={{padding:24,textAlign:'center',color:T.textDim}}>No open quotes</div>
        :filtered.map((q,i)=>{
          const days=daysSince(q.created_at)
          const expiry=quoteExpiry(q.created_at)
          return(
            <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr 120px',gap:8,padding:'12px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:T.text}}>{q.name||'Anonymous'}</div>
                {q.email&&<div style={{fontSize:11,color:T.textDim,marginTop:1}}>{q.email}</div>}
              </div>
              <div>
                <div style={{fontSize:12,color:T.textMid}}>{q.title||'Safari Journey'}</div>
                <div style={{fontSize:11,color:T.textDim}}>{q.nights||'—'}n · {q.adults||2} guests</div>
              </div>
              <div style={{textAlign:'right',fontSize:13,fontWeight:700,color:T.gold}}>{fmt(q.total_display_zar||0)}</div>
              <div>
                <div style={{fontSize:11,color:days>=3?T.amber:T.textDim}}>{days===0?'Today':days===1?'Yesterday':`${days}d ago`}</div>
                <div style={{fontSize:11,color:expiry<=1?T.red:T.textDim,marginTop:1}}>{expiry===0?'Expired':`${expiry}d left`}</div>
              </div>
              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                <button onClick={()=>setNudging(q)} style={{padding:'5px 10px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Nudge</button>
                {q.share_token&&<a href={`/journey/${q.share_token}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:T.blue,textDecoration:'none'}}>↗</a>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────
function Dashboard({setActive,userName}:{setActive:(s:string)=>void,userName?:string}){
  const [stats,setStats]=useState({bookings:0,confirmed:0,totalGBV:0,quotes:0,suppliers:0})
  const [recentBookings,setRecentBookings]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [showQuotes,setShowQuotes]=useState(false)

  useEffect(()=>{
    Promise.all([
      sb('bookings?select=id,booking_reference,status,total_display_zar,booked_at,lead_traveller_snapshot&order=created_at.desc&limit=5'),
      sb('bookings?select=status,total_display_zar'),
      sb('suppliers?select=id&is_active=eq.true'),
      Promise.resolve([]),
    ]).then(([recent,allBookings,suppliers,itineraries])=>{
      const confirmed=allBookings.filter((b:any)=>b.status==='confirmed')
      setStats({bookings:allBookings.length,confirmed:confirmed.length,totalGBV:confirmed.reduce((s:number,b:any)=>s+(b.total_display_zar||0),0),quotes:itineraries.filter((i:any)=>i.status==='quote').length,suppliers:suppliers.length})
      setRecentBookings(recent)
    }).catch(console.error).finally(()=>setLoading(false))
  },[])

  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading…</div>
  if(showQuotes)return <OpenQuotes onBack={()=>setShowQuotes(false)}/>

  return(
    <div>
      <div style={{marginBottom:24}}>
        <div style={{fontSize:22,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:4}}>Good morning ✦</div>
        <div style={{fontSize:13,color:T.textDim}}>The Safari Edition — Admin Overview</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:28}}>
        <StatCard label="Total bookings" value={String(stats.bookings)} sub="All time" onClick={()=>setActive('bookings')}/>
        <StatCard label="Confirmed" value={String(stats.confirmed)} color={T.green} onClick={()=>setActive('bookings')}/>
        <StatCard label="Total GBV" value={fmt(stats.totalGBV)} color={T.gold}/>
        <StatCard label="Open quotes" value={String(stats.quotes)} color={T.amber} sub="Click to manage" onClick={()=>setShowQuotes(true)}/>
        <StatCard label="Active suppliers" value={String(stats.suppliers)} onClick={()=>setActive('suppliers')}/>
      </div>
      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{padding:'12px 16px',borderBottom:`0.5px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:13,fontWeight:600,color:T.text}}>Recent Bookings</div>
          <button onClick={()=>setActive('bookings')} style={{fontSize:12,color:T.gold,background:'transparent',border:'none',cursor:'pointer',fontFamily:'inherit'}}>View all →</button>
        </div>
        {recentBookings.length===0?<div style={{padding:24,textAlign:'center',color:T.textDim,fontSize:13}}>No bookings yet</div>
        :recentBookings.map((b,i)=>(
          <div key={i} onClick={()=>setActive('bookings')} style={{padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.02)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:T.gold}}>{b.booking_reference}</div>
              <div style={{fontSize:12,color:T.textMid,marginTop:1}}>{b.lead_traveller_snapshot?.name||'—'}</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{fmtDate(b.booked_at)}</div>
            </div>
            <div style={{textAlign:'right'}}>
              <div style={{fontSize:14,fontWeight:700,color:T.gold}}>{fmt(b.total_display_zar||0)}</div>
              <div style={{fontSize:11,color:b.status==='confirmed'?T.green:T.amber,marginTop:2}}>{b.status?.replace(/_/g,' ')}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── BOOKINGS ──────────────────────────────────────────────────
function Bookings(){
  const [bookings,setBookings]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [sortField,setSortField]=useState('booked_at')
  const [sortDir,setSortDir]=useState('desc')
  const [expanded,setExpanded]=useState<string|null>(null)
  const SPECIALISTS=['Sarah Mitchell','James Okonkwo','Priya Naidoo','Tom van der Berg']

  useEffect(()=>{
    sb('bookings?select=id,booking_reference,status,total_display_zar,total_net_zar,total_paid_zar,booked_at,lead_traveller_snapshot,itinerary_id&order=created_at.desc')
      .then(async(data:any[])=>{
        const enriched=await Promise.all(data.map(async(b:any)=>{
          try{
            const [itin,components]=await Promise.all([
              sb(`itineraries?select=date_from,date_to,nights,adults,title&id=eq.${b.itinerary_id}`),
              sb(`itinerary_components?select=pillar,display_rate_zar,net_rate_zar,notes,suppliers(name,destination)&itinerary_id=eq.${b.itinerary_id}&order=sequence`)
            ])
            return{...b,itinerary:itin[0]||null,components:components||[]}
          }catch{return{...b,itinerary:null,components:[]}}
        }))
        setBookings(enriched)
      }).catch(console.error).finally(()=>setLoading(false))
  },[])

  const handleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}

  let filtered=bookings
  if(filter!=='all')filtered=filtered.filter((b:any)=>b.status===filter)
  if(search)filtered=filtered.filter((b:any)=>(b.booking_reference||'').toLowerCase().includes(search.toLowerCase())||(b.lead_traveller_snapshot?.name||'').toLowerCase().includes(search.toLowerCase()))
  filtered=[...filtered].sort((a,b)=>{
    const av=sortField==='total_display_zar'?(a[sortField]||0):new Date(a[sortField]).getTime()
    const bv=sortField==='total_display_zar'?(b[sortField]||0):new Date(b[sortField]).getTime()
    return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading bookings…</div>

  return(
    <div>
      <TableToolbar title="Bookings" count={filtered.length} search={search} onSearch={setSearch} searchPlaceholder="Search reference or name…"
        filters={[{label:'All',value:'all'},{label:'Confirmed',value:'confirmed'},{label:'Pending payment',value:'pending_payment'},{label:'Cancelled',value:'cancelled'}]}
        activeFilter={filter} onFilter={setFilter}
        onExportCSV={()=>exportCSV(filtered.map(b=>({'Ref':b.booking_reference,'Name':b.lead_traveller_snapshot?.name||'—','Status':b.status,'Value':b.total_display_zar||0,'Net':b.total_net_zar||0,'Date':fmtDate(b.booked_at)})),'bookings')}
        onExportPDF={()=>exportPDF('Bookings',['Ref','Name','Status','Value','Margin','Date'],filtered.map(b=>[b.booking_reference,b.lead_traveller_snapshot?.name||'—',b.status,fmt(b.total_display_zar||0),b.total_net_zar?Math.round(((b.total_display_zar-b.total_net_zar)/b.total_display_zar)*100)+'%':'—',fmtDate(b.booked_at)]))}
      />

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1fr 1fr 1fr 20px',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <ColHeader label="Reference" field="booking_reference" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Traveller"/>
          <ColHeader label="Value" field="total_display_zar" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right"/>
          <ColHeader label="Margin"/>
          <ColHeader label="Date" field="booked_at" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <div/>
        </div>

        {filtered.length===0?<div style={{padding:24,textAlign:'center',color:T.textDim}}>No bookings found</div>
        :filtered.map((b:any,i:number)=>{
          const margin=b.total_display_zar&&b.total_net_zar?b.total_display_zar-b.total_net_zar:0
          const marginPct=b.total_display_zar&&margin?Math.round((margin/b.total_display_zar)*100):0
          const itin=b.itinerary
          const depositPaid=b.total_paid_zar||0
          const balance=(b.total_display_zar||0)-depositPaid
          const balanceDue=itin?.date_from?new Date(new Date(itin.date_from).getTime()-30*24*60*60*1000):null
          const specialist=SPECIALISTS[i%SPECIALISTS.length]
          const isExpanded=expanded===b.id
          return(
            <div key={i}>
              <div onClick={()=>setExpanded(isExpanded?null:b.id)} style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1fr 1fr 1fr 20px',gap:8,padding:'12px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',cursor:'pointer',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=i%2===1?'rgba(255,255,255,0.01)':'transparent'}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:T.gold}}>{b.booking_reference}</div>
                  <div style={{fontSize:10,marginTop:2,padding:'1px 6px',borderRadius:4,display:'inline-block',background:b.status==='confirmed'?'rgba(74,222,128,0.1)':b.status==='cancelled'?'rgba(248,113,113,0.1)':'rgba(251,191,36,0.1)',color:b.status==='confirmed'?T.green:b.status==='cancelled'?T.red:T.amber}}>{b.status?.replace(/_/g,' ')}</div>
                </div>
                <div>
                  <div style={{fontSize:13,color:T.text}}>{b.lead_traveller_snapshot?.name||'—'}</div>
                  <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{b.lead_traveller_snapshot?.email||'—'}</div>
                </div>
                <div style={{textAlign:'right',fontSize:13,fontWeight:700,color:T.gold}}>{fmt(b.total_display_zar||0)}</div>
                <div>
                  {margin>0&&<><div style={{fontSize:12,color:T.green,fontWeight:600}}>{fmt(margin)}</div><div style={{fontSize:10,color:T.textDim}}>{marginPct}%</div></>}
                </div>
                <div style={{fontSize:11,color:T.textDim}}>{fmtDate(b.booked_at)}</div>
                <div style={{fontSize:12,color:T.textDim}}>{isExpanded?'▲':'▼'}</div>
              </div>

              {isExpanded&&(
                <div style={{background:'rgba(255,255,255,0.01)',borderBottom:`0.5px solid ${T.border}`,padding:'16px 18px'}}>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:10,marginBottom:16}}>
                    {itin?.date_from&&<div style={{background:T.bg,borderRadius:9,padding:'10px 12px'}}><div style={{fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Travel dates</div><div style={{fontSize:12,color:T.text}}>{fmtDate(itin.date_from)}</div>{itin.date_to&&<div style={{fontSize:11,color:T.textDim}}>to {fmtDate(itin.date_to)}</div>}</div>}
                    {itin?.nights&&<div style={{background:T.bg,borderRadius:9,padding:'10px 12px'}}><div style={{fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Duration</div><div style={{fontSize:12,color:T.text}}>{itin.nights}n · {itin.adults||2} adults</div></div>}
                    <div style={{background:T.bg,borderRadius:9,padding:'10px 12px'}}><div style={{fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Deposit paid</div><div style={{fontSize:12,color:depositPaid>0?T.green:T.amber}}>{depositPaid>0?fmt(depositPaid):'Not paid'}</div></div>
                    <div style={{background:T.bg,borderRadius:9,padding:'10px 12px'}}><div style={{fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Balance due</div><div style={{fontSize:12,color:balance>0?T.text:T.green}}>{balance>0?fmt(balance):'Paid in full'}</div>{balanceDue&&balance>0&&<div style={{fontSize:10,color:T.textDim}}>by {fmtDate(balanceDue.toISOString())}</div>}</div>
                    <div style={{background:'rgba(212,175,55,0.06)',border:`0.5px solid ${T.borderGold}`,borderRadius:9,padding:'10px 12px'}}><div style={{fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Journey Specialist</div><div style={{fontSize:12,color:T.gold,fontWeight:600}}>{specialist}</div></div>
                  </div>

                  {b.components&&b.components.length>0&&(
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>Supplier Breakdown</div>
                      <div style={{background:T.bg,borderRadius:9,overflow:'hidden'}}>
                        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:8,padding:'7px 12px',borderBottom:`0.5px solid ${T.border}`,fontSize:10,color:T.textDim,textTransform:'uppercase',letterSpacing:'0.06em'}}>
                          <div>Supplier</div><div>Pillar</div><div>Net cost</div><div>Display rate</div>
                        </div>
                        {b.components.map((c:any,ci:number)=>(
                          <div key={ci} style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:8,padding:'8px 12px',borderBottom:`0.5px solid ${T.border}`,background:ci%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
                            <div style={{fontSize:12,color:T.text}}>{c.suppliers?.name||c.notes||'—'}</div>
                            <div style={{fontSize:11,color:T.textMid,textTransform:'capitalize'}}>{c.pillar}</div>
                            <div style={{fontSize:12,color:T.textMid}}>{c.net_rate_zar?fmt(c.net_rate_zar):'—'}</div>
                            <div style={{fontSize:12,color:T.green,fontWeight:600}}>{c.display_rate_zar?fmt(c.display_rate_zar):'—'}</div>
                          </div>
                        ))}
                        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:8,padding:'8px 12px',borderTop:`0.5px solid ${T.borderGold}`,background:'rgba(212,175,55,0.03)'}}>
                          <div style={{fontSize:12,fontWeight:700,color:T.text,gridColumn:'1/3'}}>Total</div>
                          <div style={{fontSize:12,fontWeight:700,color:T.textMid}}>{fmt(b.total_net_zar||0)}</div>
                          <div style={{fontSize:12,fontWeight:700,color:T.gold}}>{fmt(b.total_display_zar||0)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{display:'flex',gap:8}}>
                    {b.itinerary_id&&<a href={`/journey/${b.itinerary_id}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:T.blue,textDecoration:'none',padding:'5px 12px',border:'0.5px solid rgba(96,165,250,0.3)',borderRadius:7,background:'rgba(96,165,250,0.06)'}}>View journey ↗</a>}
                    <button style={{fontSize:11,color:T.gold,padding:'5px 12px',border:`0.5px solid ${T.borderGold}`,borderRadius:7,background:T.goldDim,cursor:'pointer',fontFamily:'inherit'}}>Send confirmation</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── SUPPLIER INVITE MODAL ─────────────────────────────────────
function InviteModal({onClose}:{onClose:()=>void}){
  const [email,setEmail]=useState('')
  const [name,setName]=useState('')
  const [sent,setSent]=useState(false)
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:28,width:'100%',maxWidth:440}}>
        <div style={{fontSize:16,fontWeight:700,color:T.gold,marginBottom:4}}>Invite Supplier</div>
        <div style={{fontSize:12,color:T.textDim,marginBottom:20}}>Send a registration form to the supplier. They complete their details online and our team verifies and approves.</div>
        <div style={{marginBottom:12}}>
          <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Property name</label>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Singita Sabi Sand"
            style={{width:'100%',padding:'10px 12px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        </div>
        <div style={{marginBottom:20}}>
          <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>Supplier email</label>
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="reservations@property.com"
            style={{width:'100%',padding:'10px 12px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
        </div>
        {sent&&<div style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.2)',borderRadius:9,padding:'10px 14px',marginBottom:16}}><div style={{fontSize:12,color:T.green,fontWeight:600}}>✓ Invitation logged</div><div style={{fontSize:11,color:T.textDim,marginTop:2}}>Email sends when Operations module is connected.</div></div>}
        <div style={{display:'flex',gap:10}}>
          <button onClick={()=>{if(email&&name)setSent(true)}} style={{flex:1,padding:'11px',background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:9,color:'#0a0a0a',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Send Invitation</button>
          <button onClick={onClose} style={{padding:'11px 18px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:9,color:T.textDim,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── SUPPLIERS ─────────────────────────────────────────────────
const SUPPLIER_TYPES = ['Lodge','Hotel','Charter','Commercial Airline','Road Transfer Service','Activity']

function Suppliers({onViewSupplier}:{onViewSupplier:(s:any)=>void}){
  const [suppliers,setSuppliers]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [sortField,setSortField]=useState('name')
  const [sortDir,setSortDir]=useState('desc')
  const [adding,setAdding]=useState(false)
  const [inviting,setInviting]=useState(false)
  const [saving,setSaving]=useState(false)
  const [saveMsg,setSaveMsg]=useState('')
  const [newSupplier,setNewSupplier]=useState({
    name:'',type:'Lodge',country:'South Africa',destination:'',tagline:'',
    commission_pct:15,override_pct:3,override_threshold_nights:100,
    payment_terms:'End of Month Following Travel',
    max_adults:2,max_children:2,extra_beds:0,
    net_rate_pppn:0,min_nights:2,meal_basis:'All-Inclusive',
    pms_type:'',keywords:'',notes:''
  })

  const [loadError,setLoadError]=useState('')
  const load=()=>{
    setLoading(true); setLoadError('')
    sb('suppliers?select=*&order=name.asc&limit=200')
      .then(data=>{
        setSuppliers(data)
        if(data.length===0)setLoadError('No suppliers returned from Supabase. The table may be empty or RLS may be blocking reads.')
      })
      .catch(e=>{
        const msg = typeof e.message === 'string' ? e.message : JSON.stringify(e)
        setLoadError(`Supabase error: ${msg}`)
        console.error('Suppliers load error:', e)
      })
      .finally(()=>setLoading(false))
  }
  useEffect(()=>{load()},[])

  const handleAdd=async()=>{
    if(!newSupplier.name.trim()){setSaveMsg('Property name is required');return}
    setSaving(true);setSaveMsg('')
    try{
      const payload={
        name:newSupplier.name,
        type:newSupplier.type.toLowerCase().replace(/ /g,'_'),
        country:newSupplier.country,
        destination:newSupplier.destination,
        tagline:newSupplier.tagline,
        commission_pct:newSupplier.commission_pct,
        override_pct:newSupplier.override_pct,
        payment_terms:newSupplier.payment_terms,
        is_active:true,
        trust_score:70,
        content_score:50,
      }
      await sb('suppliers',{method:'POST',body:JSON.stringify(payload)})
      setSaveMsg('✓ Supplier saved successfully')
      setTimeout(()=>{setAdding(false);setSaveMsg('');setNewSupplier({name:'',type:'Lodge',country:'South Africa',destination:'',tagline:'',commission_pct:15,override_pct:3,override_threshold_nights:100,payment_terms:'End of Month Following Travel',max_adults:2,max_children:2,extra_beds:0,net_rate_pppn:0,min_nights:2,meal_basis:'All-Inclusive',pms_type:'',keywords:'',notes:''})},1000)
      load()
    }catch(e:any){
      setSaveMsg(`Error: ${e.message||'Could not save. Check Supabase connection.'}`)
    }
    setSaving(false)
  }

  const handleToggle=async(id:string,current:boolean)=>{
    await sb(`suppliers?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({is_active:!current})})
    load()
  }
  const handleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}

  const typeFilterOptions=[{label:'All',value:'all'},{label:'Lodge',value:'lodge'},{label:'Hotel',value:'hotel'},{label:'Charter',value:'charter'},{label:'Airline',value:'commercial_airline'},{label:'Transfer',value:'road_transfer_service'},{label:'Activity',value:'activity'}]

  let filtered=suppliers
  if(filter!=='all')filtered=filtered.filter((s:any)=>(s.type||'').toLowerCase().replace(/ /g,'_')===filter)
  if(search)filtered=filtered.filter((s:any)=>(s.name||'').toLowerCase().includes(search.toLowerCase())||(s.destination||'').toLowerCase().includes(search.toLowerCase()))
  filtered=[...filtered].sort((a,b)=>{
    const av=typeof a[sortField]==='number'?(a[sortField]||0):(a[sortField]||'')
    const bv=typeof b[sortField]==='number'?(b[sortField]||0):(b[sortField]||'')
    return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading suppliers from Supabase…</div>
  if(loadError)return <div style={{color:T.red,padding:40,fontSize:13}}>{loadError} <button onClick={load} style={{marginLeft:12,padding:'6px 12px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Retry</button></div>

  const F=({label,k,ph='',type='text'}:{label:string,k:string,ph?:string,type?:string})=>(
    <div>
      <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>{label}</label>
      <input type={type} value={(newSupplier as any)[k]} onChange={e=>setNewSupplier(s=>({...s,[k]:type==='number'?Number(e.target.value):e.target.value}))} placeholder={ph}
        style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
    </div>
  )

  return(
    <div>
      {inviting&&<InviteModal onClose={()=>setInviting(false)}/>}
      <TableToolbar title="Suppliers" count={filtered.length} search={search} onSearch={setSearch} searchPlaceholder="Search by name or destination…"
        filters={typeFilterOptions} activeFilter={filter} onFilter={setFilter}
        onExportCSV={()=>exportCSV(filtered.map((s:any)=>({Name:s.name,Type:s.type,Destination:s.destination,Country:s.country,Trust:s.trust_score,Commission:`${s.commission_pct||15}%`,Active:s.is_active?'Yes':'No'})),'suppliers')}
        onExportPDF={()=>exportPDF('Suppliers',['Name','Type','Destination','Trust','Commission','Active'],filtered.map((s:any)=>[s.name,s.type,s.destination||'—',String(Math.round(s.trust_score||0)),`${s.commission_pct||15}%`,s.is_active?'Yes':'No']))}
        actions={<>
          <button onClick={()=>setInviting(true)} style={{padding:'7px 12px',borderRadius:8,border:`0.5px solid ${T.borderGold}`,background:T.goldDim,color:T.gold,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✉ Invite</button>
          <button onClick={()=>setAdding(v=>!v)} style={{padding:'7px 12px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{adding?'✕ Cancel':'+ Add'}</button>
        </>}
      />

      {adding&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'20px',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:T.gold,marginBottom:16}}>New Supplier / Property</div>

          {/* Section 1: Identity */}
          <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8,marginTop:4}}>Identity</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <F label="Property name *" k="name" ph="e.g. Singita Sabi Sand"/>
            <div>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Type *</label>
              <select value={newSupplier.type} onChange={e=>setNewSupplier(s=>({...s,type:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                {SUPPLIER_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <F label="Destination" k="destination" ph="e.g. Sabi Sand Game Reserve"/>
            <F label="Country" k="country" ph="South Africa"/>
            <F label="Tagline" k="tagline" ph="One line — what makes this property special"/>
            <F label="Keywords (for AI/KB)" k="keywords" ph="e.g. leopard, family, malaria-free"/>
          </div>

          {/* Section 2: Commercial */}
          <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8,marginTop:16}}>Commercial terms</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
            <F label="Commission %" k="commission_pct" ph="15" type="number"/>
            <F label="Override %" k="override_pct" ph="3" type="number"/>
            <F label="Override threshold (nights)" k="override_threshold_nights" ph="100" type="number"/>
            <div>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Payment terms</label>
              <select value={newSupplier.payment_terms} onChange={e=>setNewSupplier(s=>({...s,payment_terms:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                {['End of Month Following Travel','30 Days After Travel','60 Days After Travel','On Confirmation (Deposit)'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Section 3: Accommodation rates */}
          {['Lodge','Hotel'].includes(newSupplier.type)&&(
            <>
              <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8,marginTop:16}}>Base accommodation rate</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:12}}>
                <F label="Net rate PPPN (ZAR)" k="net_rate_pppn" ph="28000" type="number"/>
                <F label="Max adults" k="max_adults" ph="2" type="number"/>
                <F label="Max children" k="max_children" ph="2" type="number"/>
                <F label="Extra beds" k="extra_beds" ph="0" type="number"/>
                <F label="Min nights" k="min_nights" ph="2" type="number"/>
                <div>
                  <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Meal basis</label>
                  <select value={newSupplier.meal_basis} onChange={e=>setNewSupplier(s=>({...s,meal_basis:e.target.value}))}
                    style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                    {['All-Inclusive','Full Board','Half Board','Bed & Breakfast','Room Only','All-Inclusive + Private Chef'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{fontSize:11,color:T.textDim,marginBottom:12,padding:'8px 12px',background:'rgba(212,175,55,0.06)',borderRadius:8}}>
                ✦ Full rate sheet with multiple room types is managed in the Supplier Portal once the supplier is onboarded. This creates the base entry.
              </div>
            </>
          )}

          {/* Section 4: PMS */}
          <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.08em',marginBottom:8,marginTop:16}}>PMS connection</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>PMS type</label>
              <select value={newSupplier.pms_type} onChange={e=>setNewSupplier(s=>({...s,pms_type:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                <option value="">None yet — manual</option>
                {['ResRequest','Nightsbridge','Opera Cloud','RMS Cloud'].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{fontSize:11,color:T.textDim,padding:'10px 12px',background:T.bg,borderRadius:7,border:`0.5px solid ${T.border}`,display:'flex',alignItems:'center'}}>
              Full PMS wizard available in the Supplier Portal after onboarding.
            </div>
          </div>

          {/* Notes */}
          <div style={{marginBottom:16}}>
            <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Internal notes</label>
            <textarea value={newSupplier.notes} onChange={e=>setNewSupplier(s=>({...s,notes:e.target.value}))} rows={2} placeholder="e.g. Contact: James. Known for leopard sightings. Malaria area."
              style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const,resize:'vertical' as const}}/>
          </div>

          {saveMsg&&<div style={{fontSize:12,color:saveMsg.startsWith('✓')?T.green:T.red,marginBottom:10,padding:'8px 12px',background:saveMsg.startsWith('✓')?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)',borderRadius:7}}>{saveMsg}</div>}

          <div style={{display:'flex',gap:8}}>
            <button onClick={handleAdd} disabled={saving}
              style={{background:saving?'rgba(255,255,255,0.06)':`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:8,padding:'10px 22px',color:saving?T.textDim:'#0a0a0a',fontSize:13,fontWeight:700,cursor:saving?'wait':'pointer',fontFamily:'inherit'}}>
              {saving?'Saving…':'Save Supplier'}
            </button>
            <button onClick={()=>{setAdding(false);setSaveMsg('')}}
              style={{background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:8,padding:'10px 18px',color:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2.5fr 1.2fr 1fr 1fr 50px 70px',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <ColHeader label="Supplier" field="name" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Type" field="type" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Destination" field="destination" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Commission" field="commission_pct" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Active"/>
          <ColHeader label="Portal"/>
        </div>
        {filtered.length===0
          ?<div style={{padding:24,textAlign:'center',color:T.textDim}}>No suppliers found</div>
          :filtered.map((s:any,i:number)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'2.5fr 1.2fr 1fr 1fr 50px 70px',gap:8,padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div>
              <div onClick={()=>onViewSupplier(s)} style={{fontSize:13,fontWeight:600,color:T.gold,cursor:'pointer',textDecoration:'underline',textDecorationColor:'rgba(212,175,55,0.4)'}}>{s.name||'—'}</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{s.country||''}</div>
            </div>
            <div style={{fontSize:11,color:T.textMid,textTransform:'capitalize' as const}}>{(s.type||'').replace(/_/g,' ')}</div>
            <div style={{fontSize:11,color:T.textMid,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{s.destination||'—'}</div>
            <div style={{fontSize:12,color:T.textMid}}>{s.commission_pct||15}%</div>
            <button onClick={()=>handleToggle(s.id,s.is_active)}
              style={{width:36,height:20,borderRadius:10,border:'none',background:s.is_active?T.green:'rgba(255,255,255,0.1)',cursor:'pointer',position:'relative' as const,transition:'background 0.2s'}}>
              <div style={{position:'absolute' as const,top:2,left:s.is_active?18:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/>
            </button>
            <a href="/supplier" target="_blank" rel="noopener noreferrer"
              style={{fontSize:11,color:T.blue,textDecoration:'none',padding:'4px 8px',border:'0.5px solid rgba(96,165,250,0.25)',borderRadius:6,background:'rgba(96,165,250,0.06)',textAlign:'center' as const,display:'block'}}>
              Portal ↗
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── STACK MANAGER ─────────────────────────────────────────────
function StackManager(){
  const [suppliers,setSuppliers]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [dragIdx,setDragIdx]=useState<number|null>(null)
  const [saved,setSaved]=useState(false)
  const [search,setSearch]=useState('')

  useEffect(()=>{sb('suppliers?select=*&type=in.(lodge,hotel)&is_active=eq.true&order=name.asc').then(setSuppliers).catch(console.error).finally(()=>setLoading(false))},[])
  const handleDragStart=(idx:number)=>setDragIdx(idx)
  const handleDragOver=(e:any,idx:number)=>{e.preventDefault();if(dragIdx===null||dragIdx===idx)return;const items=[...suppliers];const [moved]=items.splice(dragIdx,1);items.splice(idx,0,moved);setSuppliers(items);setDragIdx(idx)}
  const handleSave=async()=>{await Promise.all(suppliers.map((s,i)=>sb(`suppliers?id=eq.${s.id}`,{method:'PATCH',body:JSON.stringify({is_featured:i<5})})));setSaved(true);setTimeout(()=>setSaved(false),2000)}

  const filtered=search?suppliers.filter(s=>(s.name||'').toLowerCase().includes(search.toLowerCase())):suppliers
  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading…</div>

  // AI recommended score (composite of trust, content, campaigns, commission, bednights)
  const aiScore=(s:any)=>{
    const stats=BULK_SUPPLIER_STATS[s.id]
    if(!stats) return Math.round((s.trust_score||60)*0.4 + 50*0.3 + 10)
    const trustW=(stats.trust_score||60)*0.3
    const contentW=(stats.content_score||60)*0.25
    const campaignW=Math.min(stats.active_campaigns*10,20)*0.2
    const commissionW=Math.min(stats.net_commission_ytd/10000,20)*0.15
    const bednightW=Math.min((stats.bednights_ytd/stats.threshold_nights)*20,20)*0.1
    return Math.round(trustW+contentW+campaignW+commissionW+bednightW)
  }

  // Sort by AI score if not manually overridden
  const [useAI,setUseAI]=useState(true)
  const displaySuppliers=useAI?[...filtered].sort((a,b)=>aiScore(b)-aiScore(a)):filtered

  return(
    <div>
      <TableToolbar title="Stack Manager" search={search} onSearch={setSearch} searchPlaceholder="Search properties…"
        actions={<div style={{display:'flex',gap:8,alignItems:'center'}}>
          <button onClick={()=>setUseAI(v=>!v)}
            style={{padding:'7px 12px',borderRadius:8,border:`0.5px solid ${useAI?T.blue:T.border}`,background:useAI?'rgba(96,165,250,0.1)':'transparent',color:useAI?T.blue:T.textDim,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
            {useAI?'🤖 AI Ranked':'✋ Manual Order'}
          </button>
          <button onClick={handleSave} style={{padding:'7px 14px',borderRadius:8,border:'none',background:saved?T.green:`linear-gradient(135deg,${T.gold},#f0c040)`,color:saved?'white':'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>{saved?'✓ Saved':'Save Order'}</button>
        </div>}
      />
      <div style={{background:'rgba(212,175,55,0.06)',border:`0.5px solid ${T.borderGold}`,borderRadius:9,padding:'9px 14px',marginBottom:12,fontSize:12,color:T.gold}}>
        {useAI?'🤖 AI ranking considers: Trust Score · Content Score · Active Campaigns · Commission YTD · Bednights progress':'✋ Manual order — drag to reorder · Save to apply'}
      </div>
      {displaySuppliers.map((s,i)=>{
        const stats=BULK_SUPPLIER_STATS[s.id]
        const score=aiScore(s)
        return(
        <div key={s.id} draggable={!useAI} onDragStart={()=>!useAI&&handleDragStart(i)} onDragOver={e=>!useAI&&handleDragOver(e,i)}
          style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:i<5?'rgba(212,175,55,0.04)':T.surface,border:`0.5px solid ${i<5?T.borderGold:T.border}`,borderRadius:9,marginBottom:6,cursor:useAI?'default':'grab',userSelect:'none'}}>
          <div style={{fontSize:12,color:T.textDim,width:14,flexShrink:0}}>{useAI?'':' ⠿'}</div>
          <div style={{width:26,height:26,borderRadius:6,background:i<5?T.goldDim:'rgba(255,255,255,0.05)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:i<5?T.gold:T.textDim,flexShrink:0}}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{s.name}</div>
            <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{s.destination} · {s.type}</div>
          </div>
          {/* AI score */}
          <div style={{textAlign:'right' as const,minWidth:50}}>
            <div style={{fontSize:9,color:T.blue,textTransform:'uppercase' as const,letterSpacing:'0.06em'}}>AI Score</div>
            <div style={{fontSize:14,fontWeight:700,color:T.blue}}>{score}</div>
          </div>
          {/* Stats */}
          {stats&&<>
            <div style={{textAlign:'right' as const,minWidth:45}}>
              <div style={{fontSize:9,color:T.textDim}}>Campaigns</div>
              <div style={{fontSize:12,color:stats.active_campaigns>0?T.purple:T.textDim,fontWeight:600}}>{stats.active_campaigns}</div>
            </div>
            <div style={{textAlign:'right' as const,minWidth:55}}>
              <div style={{fontSize:9,color:T.textDim}}>Content</div>
              <div style={{fontSize:12,color:T.amber,fontWeight:600}}>{stats.content_score}</div>
            </div>
            <div style={{textAlign:'right' as const,minWidth:70}}>
              <div style={{fontSize:9,color:T.textDim}}>Commission YTD</div>
              <div style={{fontSize:11,color:T.green,fontWeight:600}}>{fmt(stats.net_commission_ytd)}</div>
            </div>
            <div style={{textAlign:'right' as const,minWidth:80}}>
              <div style={{fontSize:9,color:T.textDim}}>Nights to override</div>
              <div style={{fontSize:11,color:T.gold,fontWeight:600}}>{Math.max(0,stats.threshold_nights-stats.bednights_ytd)}n</div>
            </div>
          </>}
          {i<5&&<div style={{background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:6,padding:'2px 7px',fontSize:10,color:T.gold}}>Featured</div>}
        </div>
        )
      })}
    </div>
  )
}

// ── KNOWLEDGE BASE ────────────────────────────────────────────
function KnowledgeBase(){
  const LOCAL_KB=[
    {id:'kb1',segment_type:'property',title:'Singita Sabi Sand — Booking Notes',content:'Request Boulders Suite for couples. North-facing — uninterrupted bush views. WiFi limited at Boulders. Private vehicle confirmed with 48h notice. Early check-in available at R1,800.',priority:'high',verified_at:'2026-04-01'},
    {id:'kb2',segment_type:'region',title:'Sabi Sand — Seasonal Notes',content:'Peak: June–October. Green season Nov–Feb — lower rates, dramatic skies, good birding. Leopard sightings year-round. Malaria area — prophylaxis required.',priority:'standard',verified_at:'2026-04-01'},
    {id:'kb3',segment_type:'airport',title:'JNB — OR Tambo Transit Tips',content:'Domestic connections: minimum 2h. International to domestic: minimum 3h. Forex rates poor at airport — use Bidvest. SLOW lounge excellent for long layovers.',priority:'standard',verified_at:'2026-04-01'},
    {id:'kb4',segment_type:'transfer',title:'Federal Airlines — Booking Notes',content:'Weight limit 20kg per person in soft bags only. Check-in 45min before departure. Ensure arrival before 16:00 at Skukuza for afternoon drive.',priority:'high',verified_at:'2026-04-01'},
    {id:'kb5',segment_type:'region',title:'Okavango Delta — Best Timing',content:'Peak water: June–August. Best wildlife: July–October. Green season: Nov–March — good for birdlife. Mokoro season: May–September.',priority:'standard',verified_at:'2026-04-01'},
  ]
  const [entries,setEntries]=useState<any[]>(LOCAL_KB)
  const [adding,setAdding]=useState(false)
  const [form,setForm]=useState({segment_type:'property',title:'',content:'',priority:'standard'})
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [sortField,setSortField]=useState('priority')
  const [sortDir,setSortDir]=useState('desc')
  const handleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}
  const priorityColor=(p:string)=>p==='critical'?T.red:p==='high'?T.amber:T.textDim
  const priorityRank=(p:string)=>p==='critical'?3:p==='high'?2:1

  let filtered=entries
  if(filter!=='all')filtered=filtered.filter(e=>e.segment_type===filter)
  if(search)filtered=filtered.filter(e=>e.title.toLowerCase().includes(search.toLowerCase())||e.content.toLowerCase().includes(search.toLowerCase()))
  filtered=[...filtered].sort((a,b)=>sortField==='priority'?(sortDir==='asc'?priorityRank(a.priority)-priorityRank(b.priority):priorityRank(b.priority)-priorityRank(a.priority)):sortDir==='asc'?(a[sortField]>b[sortField]?1:-1):(a[sortField]<b[sortField]?1:-1))

  return(
    <div>
      <TableToolbar title="Knowledge Base" count={filtered.length} search={search} onSearch={setSearch} searchPlaceholder="Search entries…"
        filters={[{label:'All',value:'all'},{label:'Property',value:'property'},{label:'Region',value:'region'},{label:'Area',value:'area'},{label:'Activity',value:'activity'},{label:'Airport',value:'airport'},{label:'Transfer',value:'transfer'}]}
        activeFilter={filter} onFilter={setFilter}
        onExportCSV={()=>exportCSV(filtered.map(e=>({Type:e.segment_type,Title:e.title,Content:e.content,Priority:e.priority,Verified:e.verified_at})),'knowledge-base')}
        onExportPDF={()=>exportPDF('Knowledge Base',['Type','Title','Priority','Verified'],filtered.map(e=>[e.segment_type,e.title,e.priority,e.verified_at]))}
        actions={<button onClick={()=>setAdding(true)} style={{padding:'7px 12px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Add Entry</button>}
      />

      {adding&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'18px',marginBottom:14}}>
          <div style={{fontSize:13,fontWeight:600,color:T.gold,marginBottom:12}}>New Entry</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Type</label>
            <select value={form.segment_type} onChange={e=>setForm(f=>({...f,segment_type:e.target.value}))} style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
              {['property','region','area','activity','airport','transfer'].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
            <div><label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Priority</label>
            <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
              {['standard','high','critical'].map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          </div>
          <div style={{marginBottom:10}}><label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Title</label>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Singita — Booking Notes"
            style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/></div>
          <div style={{marginBottom:12}}><label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>Notes</label>
          <textarea value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} rows={3} placeholder="Specialist notes…"
            style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box',resize:'vertical'}}/></div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{if(form.title&&form.content){setEntries(e=>[{...form,id:`kb${Date.now()}`,verified_at:new Date().toISOString().slice(0,10)},...e]);setAdding(false);setForm({segment_type:'property',title:'',content:'',priority:'standard'})}}} style={{background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:8,padding:'8px 16px',color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Save</button>
            <button onClick={()=>setAdding(false)} style={{background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:8,padding:'8px 16px',color:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'120px 1fr 80px 100px',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <ColHeader label="Type" field="segment_type" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Title" field="title" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Priority" field="priority" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Verified" field="verified_at" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
        </div>
        {filtered.map((e,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'120px 1fr 80px 100px',gap:8,padding:'0',borderBottom:`0.5px solid ${T.border}`,background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div style={{padding:'12px 16px',fontSize:11,color:T.textDim,textTransform:'capitalize',alignSelf:'start',paddingTop:14}}>{e.segment_type}</div>
            <div style={{padding:'12px 8px'}}>
              <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:3}}>{e.title}</div>
              <div style={{fontSize:11,color:T.textMid,lineHeight:1.5}}>{e.content}</div>
            </div>
            <div style={{padding:'14px 8px',fontSize:11,color:priorityColor(e.priority),fontWeight:600,textTransform:'uppercase',alignSelf:'start'}}>{e.priority}</div>
            <div style={{padding:'14px 8px',fontSize:11,color:T.textDim,alignSelf:'start'}}>{e.verified_at}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ITINERARIES ───────────────────────────────────────────────
function Itineraries(){
  const [items,setItems]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [sortField,setSortField]=useState('created_at')
  const [sortDir,setSortDir]=useState('desc')

  useEffect(()=>{setLoading(false)},[])
  const handleSort=(f:string)=>{if(sortField===f)setSortDir(d=>d==='asc'?'desc':'asc');else{setSortField(f);setSortDir('asc')}}

  let filtered=items
  if(filter!=='all')filtered=filtered.filter((i:any)=>i.status===filter)
  if(search)filtered=filtered.filter((i:any)=>(i.title||'').toLowerCase().includes(search.toLowerCase())||(i.share_token||'').toLowerCase().includes(search.toLowerCase()))
  filtered=[...filtered].sort((a,b)=>{
    const av=sortField==='total_display_zar'?(a[sortField]||0):sortField==='created_at'?new Date(a[sortField]).getTime():(a[sortField]||'')
    const bv=sortField==='total_display_zar'?(b[sortField]||0):sortField==='created_at'?new Date(b[sortField]).getTime():(b[sortField]||'')
    return sortDir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
  })

  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading itineraries…</div>

  return(
    <div>
      <TableToolbar title="Itineraries" count={filtered.length} search={search} onSearch={setSearch} searchPlaceholder="Search by title or token…"
        filters={[{label:'All',value:'all'},{label:'Quote',value:'quote'},{label:'Confirmed',value:'confirmed'},{label:'Cancelled',value:'cancelled'}]}
        activeFilter={filter} onFilter={setFilter}
        onExportCSV={()=>exportCSV(filtered.map((i:any)=>({Title:i.title,Nights:i.nights,Value:i.total_display_zar,Status:i.status,Created:fmtDate(i.created_at)})),'itineraries')}
        onExportPDF={()=>exportPDF('Itineraries',['Title','Nights','Value','Status','Created'],filtered.map((i:any)=>[i.title||'—',String(i.nights||'—'),fmt(i.total_display_zar||0),i.status,fmtDate(i.created_at)]))}
      />

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 0.5fr 1fr 1fr',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <ColHeader label="Title" field="title" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Share link"/>
          <ColHeader label="Nights" field="nights" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          <ColHeader label="Value" field="total_display_zar" sortField={sortField} sortDir={sortDir} onSort={handleSort} align="right"/>
          <ColHeader label="Status · Date" field="created_at" sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
        </div>
        {filtered.length===0?<div style={{padding:24,textAlign:'center',color:T.textDim}}>No itineraries found</div>
        :filtered.map((it:any,i:number)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 1fr 0.5fr 1fr 1fr',gap:8,padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{it.title||'—'}</div>
            <div>{it.share_token&&<a href={`/journey/${it.share_token}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:T.blue,textDecoration:'none',display:'flex',alignItems:'center',gap:4}}><span style={{overflow:'hidden',textOverflow:'ellipsis',maxWidth:80,display:'inline-block',whiteSpace:'nowrap'}}>{it.share_token.slice(0,8)}…</span>↗</a>}</div>
            <div style={{fontSize:12,color:T.textMid}}>{it.nights||'—'}</div>
            <div style={{fontSize:13,fontWeight:600,color:T.gold,textAlign:'right'}}>{fmt(it.total_display_zar||0)}</div>
            <div>
              <div style={{fontSize:11,padding:'1px 7px',borderRadius:4,display:'inline-block',marginBottom:3,background:it.status==='confirmed'?'rgba(74,222,128,0.1)':it.status==='quote'?'rgba(251,191,36,0.1)':'rgba(255,255,255,0.05)',color:it.status==='confirmed'?T.green:it.status==='quote'?T.amber:T.textDim}}>{it.status}</div>
              <div style={{fontSize:10,color:T.textDim}}>{fmtDate(it.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────

// ── USER MANAGEMENT ───────────────────────────────────────────
const DEMO_STAFF = [
  { id:'u1', name:'JD (Founder)', email:'admin@thesafariedition.com', role:'edition_admin', dept:'Leadership', active:true, lastLogin:'2026-04-28' },
  { id:'u2', name:'Sarah Mitchell', email:'ops@thesafariedition.com', role:'edition_ops', dept:'Operations', active:true, lastLogin:'2026-04-27' },
  { id:'u3', name:'Tom van der Berg', email:'finance@thesafariedition.com', role:'edition_finance', dept:'Finance', active:true, lastLogin:'2026-04-26' },
  { id:'u4', name:'Priya Naidoo', email:'content@thesafariedition.com', role:'edition_content', dept:'Content', active:true, lastLogin:'2026-04-25' },
  // Supplier contacts
  { id:'u5', name:'Sarah Dlamini', email:'admin@singita.com', role:'supplier_admin', dept:'Singita Sabi Sand', active:true, lastLogin:'2026-04-28' },
  { id:'u6', name:'Thabo Nkosi', email:'reservations@singita.com', role:'reservations_manager', dept:'Singita Sabi Sand', active:true, lastLogin:'2026-04-27' },
  { id:'u7', name:'Priya Moodley', email:'content@singita.com', role:'content_manager', dept:'Singita Sabi Sand', active:true, lastLogin:'2026-04-20' },
  { id:'u8', name:'James Olifant', email:'finance@singita.com', role:'finance_contact', dept:'Singita Sabi Sand', active:false, lastLogin:'2026-03-15' },
  { id:'u9', name:'Mpho Sithole', email:'sales@singita.com', role:'sales_marketing', dept:'Singita Sabi Sand', active:true, lastLogin:'2026-04-22' },
]

const ROLE_PERMISSIONS: Record<string,{label:string,read:string[],write:string[]}> = {
  edition_admin: { label:'Edition Admin', read:['all'], write:['all'] },
  edition_ops: { label:'Edition Operations', read:['bookings','suppliers','itineraries'], write:['bookings','suppliers'] },
  edition_finance: { label:'Edition Finance', read:['bookings','payments'], write:['payments'] },
  edition_content: { label:'Edition Content', read:['suppliers','knowledge'], write:['knowledge','suppliers'] },
  supplier_admin: { label:'Supplier Admin', read:['all portal tabs'], write:['rates','content','bookings'] },
  reservations_manager: { label:'Reservations Manager', read:['bookings','rates','payments'], write:['bookings'] },
  content_manager: { label:'Content Manager', read:['content','reviews'], write:['content'] },
  finance_contact: { label:'Finance Contact', read:['bookings (values only)','payments'], write:[] },
  sales_marketing: { label:'Sales & Marketing', read:['campaigns','content','reviews'], write:['campaigns'] },
}

function UserManagement(){
  const [users,setUsers]=useState(DEMO_STAFF)
  const [selectedUser,setSelectedUser]=useState<any>(null)
  const [showAdd,setShowAdd]=useState(false)
  const [newUser,setNewUser]=useState({name:'',email:'',role:'reservations_manager',dept:''})
  const [resetPwdUser,setResetPwdUser]=useState<any>(null)
  const [newPwd,setNewPwd]=useState('')
  const [saved,setSaved]=useState('')
  const [filterType,setFilterType]=useState<'all'|'edition'|'supplier'>('all')

  const filtered = users.filter(u => {
    if(filterType==='edition') return u.role.startsWith('edition')
    if(filterType==='supplier') return !u.role.startsWith('edition')
    return true
  })

  return(
    <div>
      <SectionHeader title="User Management" sub="Manage Edition team and supplier portal access. Reset passwords, assign roles, control permissions."
        action={<Btn variant="gold" label="+ Add User" onClick={()=>setShowAdd(v=>!v)}/>}
      />

      {/* Add user form */}
      {showAdd&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:20,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,color:T.gold,marginBottom:14}}>New User</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            {[{k:'name',l:'Full name',ph:'e.g. Sarah Mitchell'},{k:'email',l:'Email address',ph:'e.g. sarah@thesafariedition.com'},{k:'dept',l:'Supplier / Department',ph:'e.g. Singita Sabi Sand'}].map(f=>(
              <div key={f.k}>
                <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>{f.l}</label>
                <input value={(newUser as any)[f.k]} onChange={e=>setNewUser(u=>({...u,[f.k]:e.target.value}))} placeholder={f.ph}
                  style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
              </div>
            ))}
            <div>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Role</label>
              <select value={newUser.role} onChange={e=>setNewUser(u=>({...u,role:e.target.value}))}
                style={{width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit'}}>
                {Object.entries(ROLE_PERMISSIONS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          {saved&&<div style={{fontSize:12,color:T.green,marginBottom:10}}>{saved}</div>}
          <div style={{display:'flex',gap:8}}>
            <Btn variant="gold" label="Create User & Send Invite" onClick={()=>{
              setUsers(u=>[...u,{id:`u${Date.now()}`,name:newUser.name,email:newUser.email,role:newUser.role,dept:newUser.dept,active:true,lastLogin:'Never'}])
              setSaved('✓ User created. Invite email logged — will send when email integration is active.')
              setTimeout(()=>{setSaved('');setShowAdd(false);setNewUser({name:'',email:'',role:'reservations_manager',dept:''})},2000)
            }}/>
            <Btn label="Cancel" onClick={()=>setShowAdd(false)}/>
          </div>
        </div>
      )}

      {/* Password reset modal */}
      {resetPwdUser&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:28,width:'100%',maxWidth:400}}>
            <div style={{fontSize:15,fontWeight:700,color:T.gold,marginBottom:4}}>Reset Password</div>
            <div style={{fontSize:12,color:T.textDim,marginBottom:16}}>{resetPwdUser.name} · {resetPwdUser.email}</div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:4}}>New password</label>
              <input type="text" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="e.g. Safari2026!"
                style={{width:'100%',padding:'10px 12px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
              <div style={{fontSize:10,color:T.textDim,marginTop:4}}>Min 8 characters. User will be prompted to change on next login.</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn variant="gold" label="Set Password" onClick={()=>{setSaved(`✓ Password reset for ${resetPwdUser.name}`);setResetPwdUser(null);setNewPwd('');setTimeout(()=>setSaved(''),3000)}}/>
              <Btn label="Cancel" onClick={()=>{setResetPwdUser(null);setNewPwd('')}}/>
            </div>
          </div>
        </div>
      )}

      {saved&&!resetPwdUser&&<div style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.2)',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:12,color:T.green}}>{saved}</div>}

      {/* Filters */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        {(['all','edition','supplier'] as const).map(f=>(
          <button key={f} onClick={()=>setFilterType(f)}
            style={{padding:'6px 14px',borderRadius:8,border:`0.5px solid ${filterType===f?T.gold:T.border}`,background:filterType===f?T.goldDim:'transparent',color:filterType===f?T.gold:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit',textTransform:'capitalize' as const}}>
            {f==='all'?`All (${users.length})`:f==='edition'?`Edition team (${users.filter(u=>u.role.startsWith('edition')).length})`:`Supplier contacts (${users.filter(u=>!u.role.startsWith('edition')).length})`}
          </button>
        ))}
      </div>

      {/* User table */}
      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.2fr 1fr 0.8fr 0.6fr 1.2fr',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`,fontSize:9,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.07em'}}>
          <div>Name</div><div>Email</div><div>Role</div><div>Dept / Supplier</div><div>Last login</div><div>Active</div><div>Actions</div>
        </div>
        {filtered.map((u,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.2fr 1fr 0.8fr 0.6fr 1.2fr',gap:8,padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
            <div style={{fontSize:11,color:T.textDim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{u.email}</div>
            <div>
              <div style={{fontSize:11,color:u.role.startsWith('edition')?T.gold:T.blue}}>{ROLE_PERMISSIONS[u.role]?.label||u.role}</div>
            </div>
            <div style={{fontSize:11,color:T.textMid}}>{u.dept}</div>
            <div style={{fontSize:11,color:T.textDim}}>{u.lastLogin}</div>
            <div>
              <button onClick={()=>setUsers(us=>us.map(x=>x.id===u.id?{...x,active:!x.active}:x))}
                style={{width:32,height:18,borderRadius:9,border:'none',background:u.active?T.green:'rgba(255,255,255,0.1)',cursor:'pointer',position:'relative' as const}}>
                <div style={{position:'absolute' as const,top:2,left:u.active?14:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/>
              </button>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setResetPwdUser(u)}
                style={{padding:'4px 9px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:6,color:T.gold,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
                Reset pwd
              </button>
              <button onClick={()=>setSelectedUser(selectedUser?.id===u.id?null:u)}
                style={{padding:'4px 9px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:6,color:T.textDim,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
                Permissions
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Permissions detail */}
      {selectedUser&&(
        <div style={{marginTop:14,background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:20}}>
          <div style={{fontSize:13,fontWeight:700,color:T.gold,marginBottom:4}}>{selectedUser.name} — Permissions</div>
          <div style={{fontSize:11,color:T.textDim,marginBottom:14}}>{ROLE_PERMISSIONS[selectedUser.role]?.label} · {selectedUser.email}</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <div style={{fontSize:10,color:T.green,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:8,fontWeight:600}}>Read access</div>
              {(ROLE_PERMISSIONS[selectedUser.role]?.read||[]).map((p,i)=>(
                <div key={i} style={{fontSize:12,color:T.textMid,display:'flex',gap:6,marginBottom:4,padding:'5px 10px',background:'rgba(74,222,128,0.06)',borderRadius:6}}>
                  <span style={{color:T.green}}>✓</span>{p}
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:8,fontWeight:600}}>Write access</div>
              {(ROLE_PERMISSIONS[selectedUser.role]?.write||[]).length===0
                ?<div style={{fontSize:12,color:T.textDim,fontStyle:'italic' as const}}>Read-only role</div>
                :(ROLE_PERMISSIONS[selectedUser.role]?.write||[]).map((p,i)=>(
                  <div key={i} style={{fontSize:12,color:T.textMid,display:'flex',gap:6,marginBottom:4,padding:'5px 10px',background:T.goldDim,borderRadius:6}}>
                    <span style={{color:T.gold}}>✎</span>{p}
                  </div>
                ))
              }
            </div>
          </div>
          <div style={{marginTop:14,fontSize:11,color:T.textDim,padding:'8px 12px',background:T.bg,borderRadius:8}}>
            Role changes must be made by JD (Edition Admin). Contact admin@thesafariedition.com to request a role change for this user.
          </div>
        </div>
      )}
    </div>
  )
}

// ── SUPPLIER DASHBOARD (admin read-only view) ──────────────────
function SupplierDashboard({supplier, onClose}:{supplier:any, onClose:()=>void}){
  const [tab,setTab]=useState('overview')
  const [pendingChange,setPendingChange]=useState<any>(null)
  const [changeApprovals,setChangeApprovals]=useState<any[]>([])
  const stats=BULK_SUPPLIER_STATS[supplier.id]||{trust_score:70,content_score:60,active_campaigns:0,net_commission_ytd:0,bookings_ytd:0,bednights_ytd:0,threshold_nights:100,override_pct:3,peer_avg_trust:80,peer_avg_content:65,region:supplier.destination}
  const today=new Date().toISOString().slice(0,10)

  const past=BULK_BOOKINGS.filter(b=>b.booked_at<'2026-04-01')
  const current=BULK_BOOKINGS.filter(b=>b.booking_reference.includes('CURR'))
  const future=BULK_BOOKINGS.filter(b=>b.booking_reference.includes('FUT'))

  const TABS=['overview','bookings','rates','content','trust','payments','contacts','banking','audit']

  const submitChange=(type:string,data:any,approversNeeded:number)=>{
    setPendingChange({type,data,approversNeeded,approvals:[],submitted:new Date().toLocaleString('en-ZA')})
  }

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:600,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      {/* Header */}
      <div style={{background:T.bg2,borderBottom:`0.5px solid ${T.border}`,padding:'0 24px',display:'flex',alignItems:'center',justifyContent:'space-between',height:56,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={onClose} style={{background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:7,padding:'5px 12px',color:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>← Back</button>
          <div>
            <span style={{fontSize:15,fontWeight:700,color:T.text}}>{supplier.name}</span>
            <span style={{fontSize:11,color:T.textDim,marginLeft:10}}>{supplier.destination}</span>
          </div>
          <div style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'rgba(74,222,128,0.1)',color:T.green,border:'0.5px solid rgba(74,222,128,0.3)'}}>Read-only view</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>submitChange('general',{field:'name',current:supplier.name},1)}
            style={{padding:'6px 14px',borderRadius:8,border:`0.5px solid ${T.borderGold}`,background:T.goldDim,color:T.gold,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Recommend change</button>
          <a href="/supplier" target="_blank" rel="noopener noreferrer"
            style={{padding:'6px 14px',borderRadius:8,border:'0.5px solid rgba(96,165,250,0.3)',background:'rgba(96,165,250,0.06)',color:T.blue,fontSize:11,textDecoration:'none'}}>
            Open supplier portal ↗
          </a>
        </div>
      </div>

      {/* Change workflow banner */}
      {pendingChange&&(
        <div style={{background:'rgba(251,191,36,0.08)',borderBottom:`0.5px solid rgba(251,191,36,0.2)`,padding:'10px 24px',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontSize:12,color:T.amber}}>⚠ Pending change recommendation: <strong>{pendingChange.type}</strong> · Submitted {pendingChange.submitted} · Requires {pendingChange.approversNeeded} approver{pendingChange.approversNeeded>1?'s':''}</div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>setChangeApprovals(a=>[...a,{by:'Current user',at:new Date().toLocaleString('en-ZA')}])}
              style={{padding:'5px 12px',background:'rgba(74,222,128,0.1)',border:'0.5px solid rgba(74,222,128,0.3)',borderRadius:7,color:T.green,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              Approve ({changeApprovals.length}/{pendingChange.approversNeeded})
            </button>
            <button onClick={()=>{setPendingChange(null);setChangeApprovals([])}}
              style={{padding:'5px 12px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:7,color:T.textDim,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          </div>
        </div>
      )}
      {changeApprovals.length>0&&pendingChange&&changeApprovals.length>=pendingChange.approversNeeded&&(
        <div style={{background:'rgba(74,222,128,0.08)',borderBottom:`0.5px solid rgba(74,222,128,0.2)`,padding:'8px 24px',fontSize:12,color:T.green,flexShrink:0}}>
          ✓ Change approved by {changeApprovals.length} approver{changeApprovals.length>1?'s':''} — change will be applied on next sync
        </div>
      )}

      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        {/* Sidebar tabs */}
        <div style={{width:160,background:T.bg2,borderRight:`0.5px solid ${T.border}`,padding:8,flexShrink:0,overflowY:'auto'}}>
          {TABS.map(t=>(
            <button key={t} onClick={()=>setTab(t)}
              style={{width:'100%',padding:'9px 12px',borderRadius:8,border:'none',background:tab===t?T.goldDim:'transparent',color:tab===t?T.gold:T.textMid,fontSize:12,cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const,marginBottom:2,textTransform:'capitalize' as const}}>
              {t==='overview'?'📊':t==='bookings'?'📋':t==='rates'?'💰':t==='content'?'📸':t==='trust'?'⭐':t==='payments'?'🏦':t==='contacts'?'👥':t==='banking'?'🔐':t==='audit'?'📝':'•'} {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{flex:1,overflowY:'auto',padding:24}}>

          {tab==='overview'&&(
            <div>
              <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:16}}>Supplier Overview</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))',gap:10,marginBottom:20}}>
                {[
                  {l:'Trust Score',v:`${stats.trust_score}/100`,c:T.green,sub:`Peer avg: ${stats.peer_avg_trust}`},
                  {l:'Content Score',v:`${stats.content_score}/100`,c:T.amber,sub:`Peer avg: ${stats.peer_avg_content}`},
                  {l:'Active Campaigns',v:String(stats.active_campaigns),c:T.purple,sub:'Running now'},
                  {l:'YTD Bookings',v:String(stats.bookings_ytd),c:T.gold,sub:'This year'},
                  {l:'YTD Bednights',v:String(stats.bednights_ytd),c:T.blue,sub:`of ${stats.threshold_nights} threshold`},
                  {l:'Net Commission YTD',v:fmt(stats.net_commission_ytd),c:T.green,sub:`${stats.override_pct}% override when threshold hit`},
                ].map((s,i)=>(
                  <div key={i} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:11,padding:'14px 16px'}}>
                    <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.07em',marginBottom:5}}>{s.l}</div>
                    <div style={{fontSize:20,fontWeight:700,color:s.c,fontFamily:"'Playfair Display',serif"}}>{s.v}</div>
                    <div style={{fontSize:10,color:T.textDim,marginTop:3}}>{s.sub}</div>
                  </div>
                ))}
              </div>
              {/* Override progress */}
              <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:11,padding:'16px 18px',marginBottom:16}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>Override / Incentive Progress</div>
                  <div style={{fontSize:12,color:T.gold}}>{stats.bednights_ytd}/{stats.threshold_nights} nights · {stats.override_pct}% on all nights when unlocked</div>
                </div>
                <div style={{height:8,background:'rgba(255,255,255,0.08)',borderRadius:4,overflow:'hidden',marginBottom:6}}>
                  <div style={{width:`${Math.min(100,Math.round((stats.bednights_ytd/stats.threshold_nights)*100))}%`,height:'100%',background:`linear-gradient(90deg,${T.gold},#f0c040)`,borderRadius:4}}/>
                </div>
                <div style={{fontSize:11,color:T.textDim}}>{stats.threshold_nights-stats.bednights_ytd} bednights remaining to unlock override · Est. override value: {fmt(stats.bednights_ytd*28000*(stats.override_pct/100))}</div>
              </div>
              {/* Peer comparison */}
              <div style={{background:'rgba(167,139,250,0.06)',border:'0.5px solid rgba(167,139,250,0.2)',borderRadius:11,padding:'14px 18px'}}>
                <div style={{fontSize:12,fontWeight:600,color:T.purple,marginBottom:8}}>Anonymous Peer Comparison — {stats.region}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  {[
                    {l:'This property Trust Score',v:stats.trust_score,peer:stats.peer_avg_trust,max:100},
                    {l:'This property Content Score',v:stats.content_score,peer:stats.peer_avg_content,max:100},
                  ].map((p,i)=>(
                    <div key={i} style={{background:T.bg,borderRadius:9,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:T.textDim,marginBottom:6}}>{p.l}</div>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                        <div style={{fontSize:13,fontWeight:700,color:p.v>=p.peer?T.green:T.amber}}>{p.v}</div>
                        <div style={{fontSize:10,color:T.textDim}}>vs {p.peer} peer avg</div>
                        <div style={{fontSize:10,color:p.v>=p.peer?T.green:T.amber}}>{p.v>=p.peer?`+${p.v-p.peer} above`:`${p.v-p.peer} below`} avg</div>
                      </div>
                      <div style={{height:4,background:'rgba(255,255,255,0.08)',borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${(p.v/p.max)*100}%`,height:'100%',background:p.v>=p.peer?T.green:T.amber,borderRadius:2}}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{fontSize:10,color:T.textDim,marginTop:8,fontStyle:'italic' as const}}>Peer scores are anonymised averages of 5-star properties in the same region. No individual property is identified.</div>
              </div>
            </div>
          )}

          {tab==='bookings'&&(
            <div>
              <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:16}}>Bookings — {supplier.name}</div>
              {[{label:'Past',data:past,color:T.textDim},{label:'Current / In-house',data:current,color:T.blue},{label:'Future',data:future,color:T.green}].map(group=>(
                <div key={group.label} style={{marginBottom:20}}>
                  <div style={{fontSize:11,color:group.color,textTransform:'uppercase' as const,letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>{group.label} ({group.data.length})</div>
                  {group.data.length===0?<div style={{fontSize:12,color:T.textDim,padding:'12px 0'}}>None</div>:group.data.map((b,i)=>(
                    <div key={i} style={{display:'grid',gridTemplateColumns:'1fr 1.5fr 1fr 1fr 1fr',gap:8,padding:'10px 14px',background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:9,marginBottom:6,alignItems:'center'}}>
                      <div style={{fontSize:12,fontWeight:600,color:T.gold}}>{b.booking_reference}</div>
                      <div style={{fontSize:12,color:T.text}}>{b.lead_traveller_snapshot.name}</div>
                      <div style={{fontSize:12,color:T.gold,fontWeight:600}}>{fmt(b.total_display_zar)}</div>
                      <div style={{fontSize:11,color:b.total_paid_zar>=b.total_display_zar?T.green:T.amber}}>{b.total_paid_zar>=b.total_display_zar?'Paid in full':fmt(b.total_paid_zar)+' paid'}</div>
                      <div style={{fontSize:11,color:T.textDim}}>{fmtDate(b.booked_at)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {tab==='banking'&&(
            <div>
              <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:8}}>Banking Details</div>
              <div style={{background:'rgba(248,113,113,0.06)',border:'0.5px solid rgba(248,113,113,0.2)',borderRadius:10,padding:'12px 16px',marginBottom:20,fontSize:12,color:T.red}}>
                🔐 Banking details require TWO rounds of approval. Round 1: Edition staff recommendation. Round 2: Super-user (MD/CFO) approval. Changes take effect only after both approvals are logged.
              </div>
              <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:11,padding:'18px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
                  {[['Bank name','FNB (First National Bank)'],['Account name','Singita Sabi Sand (Pty) Ltd'],['Account number','62•••••••89'],['Branch code','250655'],['Account type','Business Cheque'],['SWIFT code','FIRNZAJJ']].map(([l,v])=>(
                    <div key={l} style={{background:T.bg,borderRadius:8,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>{l}</div>
                      <div style={{fontSize:13,color:T.text,fontWeight:600}}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',padding:'10px 14px',background:'rgba(74,222,128,0.06)',border:'0.5px solid rgba(74,222,128,0.2)',borderRadius:8,marginBottom:12}}>
                  <span style={{color:T.green}}>✓</span>
                  <div style={{fontSize:12,color:T.textMid}}>Bank confirmation letter verified · Uploaded 2026-03-10 · Account name matches legal entity</div>
                </div>
                <button onClick={()=>submitChange('banking',{reason:'Bank account change request'},2)}
                  style={{padding:'9px 18px',background:'rgba(248,113,113,0.08)',border:'0.5px solid rgba(248,113,113,0.3)',borderRadius:8,color:T.red,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
                  Request banking detail change (requires 2 approvals)
                </button>
              </div>
              <div style={{marginTop:16,background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:11,padding:'14px 16px'}}>
                <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:8}}>Approval History</div>
                {[{action:'Bank details verified',by:'Tom van der Berg (Finance)',date:'2026-03-11',type:'verify'},
                  {action:'Bank confirmation letter uploaded',by:'Singita Finance Contact',date:'2026-03-10',type:'upload'}].map((h,i)=>(
                  <div key={i} style={{display:'flex',gap:10,padding:'7px 0',borderBottom:`0.5px solid ${T.border}`,alignItems:'center'}}>
                    <span style={{fontSize:14,color:T.green}}>✓</span>
                    <div style={{flex:1,fontSize:12,color:T.textMid}}>{h.action}</div>
                    <div style={{fontSize:11,color:T.textDim}}>{h.by}</div>
                    <div style={{fontSize:10,color:T.textDim}}>{h.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab==='audit'&&(
            <div>
              <div style={{fontSize:18,fontWeight:700,color:T.text,fontFamily:"'Playfair Display',serif",marginBottom:16}}>Audit Log</div>
              <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:11,overflow:'hidden'}}>
                <div style={{display:'grid',gridTemplateColumns:'1.5fr 2fr 1fr 1fr',gap:8,padding:'9px 14px',borderBottom:`0.5px solid ${T.border}`,fontSize:9,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.07em'}}>
                  <div>Action</div><div>Detail</div><div>By</div><div>Date</div>
                </div>
                {[
                  {action:'Profile viewed',detail:'Full supplier dashboard opened',by:'JD (Admin)',date:'2026-04-28'},
                  {action:'Content score updated',detail:'Score moved from 82 to 88 — Reel uploaded',by:'System',date:'2026-04-15'},
                  {action:'Booking confirmed',detail:'TSE-FUT001 — Van der Berg',by:'Sarah Mitchell',date:'2026-04-01'},
                  {action:'Bank details verified',detail:'FNB account confirmed',by:'Tom van der Berg',date:'2026-03-11'},
                  {action:'Rate card reviewed',detail:'Annual rate review — no changes',by:'Contracts Team',date:'2026-01-15'},
                ].map((a,i)=>(
                  <div key={i} style={{display:'grid',gridTemplateColumns:'1.5fr 2fr 1fr 1fr',gap:8,padding:'10px 14px',borderBottom:`0.5px solid ${T.border}`,background:i%2===1?'rgba(255,255,255,0.01)':'transparent',alignItems:'center'}}>
                    <div style={{fontSize:12,color:T.text,fontWeight:600}}>{a.action}</div>
                    <div style={{fontSize:11,color:T.textMid}}>{a.detail}</div>
                    <div style={{fontSize:11,color:T.textDim}}>{a.by}</div>
                    <div style={{fontSize:10,color:T.textDim}}>{a.date}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!['overview','bookings','banking','audit'].includes(tab)&&(
            <div style={{textAlign:'center',padding:'60px 20px'}}>
              <div style={{fontSize:32,marginBottom:12}}>
                {tab==='rates'?'💰':tab==='content'?'📸':tab==='trust'?'⭐':tab==='payments'?'🏦':tab==='contacts'?'👥':'📋'}
              </div>
              <div style={{fontSize:16,fontWeight:600,color:T.text,marginBottom:8,textTransform:'capitalize' as const}}>{tab} — Full detail in Supplier Portal</div>
              <div style={{fontSize:13,color:T.textMid,marginBottom:20,maxWidth:400,margin:'0 auto 20px'}}>
                The full {tab} module is managed by the supplier in their portal. You can view and recommend changes, but all edits go through the approval workflow.
              </div>
              <div style={{display:'flex',gap:10,justifyContent:'center'}}>
                <a href="/supplier" target="_blank" rel="noopener noreferrer"
                  style={{padding:'10px 22px',background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:9,color:'#0a0a0a',fontSize:13,fontWeight:700,textDecoration:'none'}}>
                  Open {tab} in Supplier Portal ↗
                </a>
                <button onClick={()=>submitChange(tab,{},1)}
                  style={{padding:'10px 22px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:9,color:T.gold,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>
                  Recommend change
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
export default function AdminPage(){
  const [authed,setAuthed]=useState(false)
  const [active,setActive]=useState('dashboard')
  const [userName,setUserName]=useState('Admin')
  const [viewingSupplier,setViewingSupplier]=useState<any>(null)

  // Check for existing session on mount
  useEffect(()=>{
    try{
      const sess=sessionStorage.getItem('tse_session')
      if(sess){
        const s=JSON.parse(sess)
        if(s.type==='edition'){
          localStorage.setItem('tse_session', sess)
          setUserName(s.name);setAuthed(true)
        }
        else if(s.type==='supplier'){
          window.location.href=`/supplier?role=${s.role}&name=${encodeURIComponent(s.name)}&supplier=${encodeURIComponent(s.supplier||'')}`
        }
      }
    }catch{}
  },[])

  if(!authed)return <Login onLogin={(name:string)=>{setUserName(name);setAuthed(true)}}/>
  const panels:Record<string,JSX.Element>={dashboard:<Dashboard setActive={setActive} userName={userName}/>,bookings:<Bookings/>,suppliers:<Suppliers onViewSupplier={setViewingSupplier}/>,stack:<StackManager/>,knowledge:<KnowledgeBase/>,itineraries:<Itineraries/>,users:<UserManagement/>}
  return(
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',fontFamily:'Arial,sans-serif',color:T.text}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap');*{box-sizing:border-box}`}</style>
      {viewingSupplier&&<SupplierDashboard supplier={viewingSupplier} onClose={()=>setViewingSupplier(null)}/>}
      <div style={{width:220,background:T.bg2,borderRight:`0.5px solid ${T.border}`,display:'flex',flexDirection:'column',flexShrink:0,position:'sticky',top:0,height:'100vh',overflowY:'auto'}}>
        <div style={{padding:'20px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:T.gold,fontWeight:700}}>✦ The Safari Edition</div>
          <div style={{fontSize:11,color:T.textDim,marginTop:3}}>Admin Portal</div>
        </div>
        <nav style={{padding:'8px',flex:1}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setActive(n.id)} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'10px 12px',borderRadius:9,border:'none',background:active===n.id?T.goldDim:'transparent',color:active===n.id?T.gold:T.textMid,fontSize:13,cursor:'pointer',fontFamily:'inherit',textAlign:'left',marginBottom:2}}>
              <span style={{fontSize:16}}>{n.icon}</span>{n.label}
            </button>
          ))}
        </nav>
        <div style={{padding:'16px',borderTop:`0.5px solid ${T.border}`,display:'flex',flexDirection:'column',gap:8}}>
          <div style={{fontSize:11,color:T.textDim}}>Signed in as <span style={{color:T.text}}>{userName}</span></div>
          <a href="/" style={{fontSize:12,color:T.textDim,textDecoration:'none'}}>← Back to site</a>
          <button onClick={()=>{sessionStorage.removeItem('tse_session');setAuthed(false)}}
            style={{padding:'6px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:7,color:T.textDim,fontSize:11,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
            Sign out
          </button>
        </div>
      </div>
      <div style={{flex:1,overflow:'auto',padding:'28px 32px'}}>{panels[active]}</div>
    </div>
  )
}
