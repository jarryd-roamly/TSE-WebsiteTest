const ACTIVITY_REGIONS = [
  { slug:'cape-town',        label:'Cape Town' },
  { slug:'chobe-vic-falls',  label:'Victoria Falls' },
  { slug:'kruger-sabi-sand', label:'Greater Kruger' },
  { slug:'okavango-delta',   label:'Okavango' },
  { slug:'madikwe',          label:'Madikwe' },
]
const ACTIVITY_CATEGORIES = ['Adventure','Scenic','Culture','Wildlife','Luxury']

function Activities(){
  const [activities,setActivities]=useState<any[]>([])
  const [loading,setLoading]=useState(true)
  const [loadError,setLoadError]=useState('')
  const [search,setSearch]=useState('')
  const [filter,setFilter]=useState('all')
  const [editing,setEditing]=useState<any>(null)      // the activity being edited (or 'new')
  const [saving,setSaving]=useState(false)
  const [saveMsg,setSaveMsg]=useState('')
  const [uploading,setUploading]=useState(false)

  const blank=()=>({region_slug:'cape-town',name:'',description:'',net_rate:0,currency:'ZAR',duration:'',category:'Scenic',requires_transfer:false,transfer_note:'',image_urls:[],is_active:true,sort_order:100})

  const load=()=>{
    setLoading(true); setLoadError('')
    sb('activities?select=*&order=region_slug.asc,sort_order.asc')
      .then((data:any[])=>{ setActivities(data); if(data.length===0)setLoadError('No activities returned. Check the table + RLS.') })
      .catch((e:any)=>{ setLoadError(`Supabase error: ${e.message||JSON.stringify(e)}`) })
      .finally(()=>setLoading(false))
  }
  useEffect(()=>{load()},[])

  const startEdit=(a:any)=>setEditing({...a, image_urls: Array.isArray(a.image_urls)?a.image_urls:(()=>{try{return JSON.parse(a.image_urls||'[]')}catch{return []}})()})
  const startNew=()=>setEditing({...blank(), id:null})

  const save=async()=>{
    if(!editing.name.trim()){setSaveMsg('Name is required');return}
    setSaving(true);setSaveMsg('')
    try{
      const payload={
        region_slug:editing.region_slug, name:editing.name, description:editing.description||'',
        net_rate:Number(editing.net_rate)||0, currency:editing.currency||'ZAR',
        duration:editing.duration||'', category:editing.category||'', 
        requires_transfer:!!editing.requires_transfer, transfer_note:editing.transfer_note||'',
        image_urls:editing.image_urls||[], is_active:!!editing.is_active, sort_order:Number(editing.sort_order)||100,
      }
      if(editing.id){
        await sb(`activities?id=eq.${editing.id}`,{method:'PATCH',body:JSON.stringify(payload)})
      }else{
        await sb('activities',{method:'POST',body:JSON.stringify(payload)})
      }
      setSaveMsg('✓ Saved'); setTimeout(()=>{setEditing(null);setSaveMsg('')},800); load()
    }catch(e:any){setSaveMsg(`Error: ${e.message||'Could not save'}`)}
    setSaving(false)
  }

  const toggleActive=async(a:any)=>{ await sb(`activities?id=eq.${a.id}`,{method:'PATCH',body:JSON.stringify({is_active:!a.is_active})}); load() }
  const remove=async(a:any)=>{ if(!confirm(`Delete "${a.name}"? This cannot be undone.`))return; await sb(`activities?id=eq.${a.id}`,{method:'DELETE'}); load() }

  // Upload an image file to the activity-images bucket, return its public URL.
  const uploadImage=async(file:File)=>{
    if((editing.image_urls||[]).length>=3){setSaveMsg('Maximum 3 images');return}
    setUploading(true);setSaveMsg('')
    try{
      const ext=file.name.split('.').pop()||'jpg'
      const path=`${editing.id||'new'}-${Date.now()}.${ext}`
      const res=await fetch(`${SUPABASE_URL}/storage/v1/object/activity-images/${path}`,{
        method:'POST',
        headers:{ 'apikey':SUPABASE_KEY, 'Authorization':`Bearer ${SUPABASE_KEY}`, 'Content-Type':file.type||'image/jpeg' },
        body:file,
      })
      if(!res.ok)throw new Error(await res.text())
      const publicUrl=`${SUPABASE_URL}/storage/v1/object/public/activity-images/${path}`
      setEditing((e:any)=>({...e, image_urls:[...(e.image_urls||[]), publicUrl]}))
      setSaveMsg('✓ Image uploaded')
    }catch(e:any){setSaveMsg(`Upload failed: ${e.message||'error'}`)}
    setUploading(false)
  }
  const removeImage=(url:string)=>setEditing((e:any)=>({...e, image_urls:(e.image_urls||[]).filter((u:string)=>u!==url)}))

  let filtered=activities
  if(filter!=='all')filtered=filtered.filter((a:any)=>a.region_slug===filter)
  if(search)filtered=filtered.filter((a:any)=>(a.name||'').toLowerCase().includes(search.toLowerCase()))

  const fmtRate=(a:any)=>a.currency==='USD'?`$${Math.round(a.net_rate).toLocaleString()}`:`R ${Math.round(a.net_rate).toLocaleString()}`
  const regionLabel=(slug:string)=>ACTIVITY_REGIONS.find(r=>r.slug===slug)?.label||slug

  if(loading)return <div style={{color:T.textDim,padding:40}}>Loading activities…</div>
  if(loadError)return <div style={{color:T.red,padding:40,fontSize:13}}>{loadError} <button onClick={load} style={{marginLeft:12,padding:'6px 12px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Retry</button></div>

  const Field=({label,children}:{label:string,children:any})=>(
    <div><label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:3}}>{label}</label>{children}</div>
  )
  const inp={width:'100%',padding:'8px 10px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}

  return(
    <div>
      <TableToolbar title="Activities" count={filtered.length} search={search} onSearch={setSearch} searchPlaceholder="Search activities…"
        filters={[{label:'All',value:'all'},...ACTIVITY_REGIONS.map(r=>({label:r.label,value:r.slug}))]}
        activeFilter={filter} onFilter={setFilter}
        onExportCSV={()=>exportCSV(filtered.map((a:any)=>({Region:regionLabel(a.region_slug),Name:a.name,Rate:a.net_rate,Currency:a.currency,Duration:a.duration,Category:a.category,Active:a.is_active?'Yes':'No'})),'activities')}
        actions={<button onClick={startNew} style={{padding:'7px 12px',borderRadius:8,border:'none',background:`linear-gradient(135deg,${T.gold},#f0c040)`,color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>+ Add Activity</button>}
      />

      {editing&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:'20px',marginBottom:16}}>
          <div style={{fontSize:14,fontWeight:700,color:T.gold,marginBottom:16}}>{editing.id?'Edit Activity':'New Activity'}</div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:12}}>
            <Field label="Name *"><input value={editing.name} onChange={e=>setEditing((x:any)=>({...x,name:e.target.value}))} style={inp} placeholder="e.g. Table Mountain Cableway"/></Field>
            <Field label="Region"><select value={editing.region_slug} onChange={e=>setEditing((x:any)=>({...x,region_slug:e.target.value}))} style={inp}>{ACTIVITY_REGIONS.map(r=><option key={r.slug} value={r.slug}>{r.label}</option>)}</select></Field>
          </div>
          <div style={{marginBottom:12}}>
            <Field label="Description"><textarea value={editing.description} onChange={e=>setEditing((x:any)=>({...x,description:e.target.value}))} rows={2} style={{...inp,resize:'vertical' as const}} placeholder="What the traveller experiences…"/></Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:12}}>
            <Field label="Net rate"><input type="number" value={editing.net_rate} onChange={e=>setEditing((x:any)=>({...x,net_rate:e.target.value}))} style={inp}/></Field>
            <Field label="Currency"><select value={editing.currency} onChange={e=>setEditing((x:any)=>({...x,currency:e.target.value}))} style={inp}><option value="ZAR">ZAR</option><option value="USD">USD</option></select></Field>
            <Field label="Duration"><input value={editing.duration} onChange={e=>setEditing((x:any)=>({...x,duration:e.target.value}))} style={inp} placeholder="e.g. Full day"/></Field>
            <Field label="Category"><select value={editing.category} onChange={e=>setEditing((x:any)=>({...x,category:e.target.value}))} style={inp}>{ACTIVITY_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:12}}>
            <Field label="Transfer note"><input value={editing.transfer_note} onChange={e=>setEditing((x:any)=>({...x,transfer_note:e.target.value}))} style={inp} placeholder="e.g. Hotel pickup included"/></Field>
            <Field label="Sort order"><input type="number" value={editing.sort_order} onChange={e=>setEditing((x:any)=>({...x,sort_order:e.target.value}))} style={inp}/></Field>
          </div>
          <div style={{display:'flex',gap:18,marginBottom:16}}>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:T.textMid}}><input type="checkbox" checked={editing.requires_transfer} onChange={e=>setEditing((x:any)=>({...x,requires_transfer:e.target.checked}))} style={{accentColor:T.gold}}/>Requires transfer (logistics priced in)</label>
            <label style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',fontSize:12,color:T.textMid}}><input type="checkbox" checked={editing.is_active} onChange={e=>setEditing((x:any)=>({...x,is_active:e.target.checked}))} style={{accentColor:T.gold}}/>Active</label>
          </div>

          {/* Images — up to 3, uploaded to activity-images bucket */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:10,color:T.gold,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:6}}>Images ({(editing.image_urls||[]).length}/3)</div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              {(editing.image_urls||[]).map((url:string)=>(
                <div key={url} style={{position:'relative',width:90,height:90,borderRadius:8,overflow:'hidden',border:`0.5px solid ${T.border}`}}>
                  <img src={url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <button onClick={()=>removeImage(url)} style={{position:'absolute',top:3,right:3,width:18,height:18,borderRadius:'50%',border:'none',background:'rgba(0,0,0,0.7)',color:'white',fontSize:11,cursor:'pointer',lineHeight:1}}>×</button>
                </div>
              ))}
              {(editing.image_urls||[]).length<3&&(
                <label style={{width:90,height:90,borderRadius:8,border:`1px dashed ${T.borderGold}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:uploading?'wait':'pointer',color:T.gold,fontSize:11,textAlign:'center',background:T.goldDim}}>
                  {uploading?'…':'+ Upload'}
                  <input type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)uploadImage(f);e.target.value=''}} style={{display:'none'}} disabled={uploading}/>
                </label>
              )}
            </div>
            {!editing.id&&<div style={{fontSize:10,color:T.textDim,marginTop:6}}>Tip: save the activity first, then images attach to its record cleanly.</div>}
          </div>

          {saveMsg&&<div style={{fontSize:12,color:saveMsg.startsWith('✓')?T.green:T.red,marginBottom:10,padding:'8px 12px',background:saveMsg.startsWith('✓')?'rgba(74,222,128,0.08)':'rgba(248,113,113,0.08)',borderRadius:7}}>{saveMsg}</div>}
          <div style={{display:'flex',gap:8}}>
            <button onClick={save} disabled={saving} style={{background:saving?'rgba(255,255,255,0.06)':`linear-gradient(135deg,${T.gold},#f0c040)`,border:'none',borderRadius:8,padding:'10px 22px',color:saving?T.textDim:'#0a0a0a',fontSize:13,fontWeight:700,cursor:saving?'wait':'pointer',fontFamily:'inherit'}}>{saving?'Saving…':'Save Activity'}</button>
            <button onClick={()=>{setEditing(null);setSaveMsg('')}} style={{background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:8,padding:'10px 18px',color:T.textDim,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'2.5fr 1.2fr 1fr 1fr 50px 90px',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`}}>
          <ColHeader label="Activity"/><ColHeader label="Region"/><ColHeader label="Rate"/><ColHeader label="Category"/><ColHeader label="Active"/><ColHeader label="Actions"/>
        </div>
        {filtered.length===0?<div style={{padding:24,textAlign:'center',color:T.textDim}}>No activities found</div>
        :filtered.map((a:any,i:number)=>(
          <div key={a.id} style={{display:'grid',gridTemplateColumns:'2.5fr 1.2fr 1fr 1fr 50px 90px',gap:8,padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              {(Array.isArray(a.image_urls)&&a.image_urls[0])?<img src={a.image_urls[0]} alt="" style={{width:34,height:34,borderRadius:6,objectFit:'cover',flexShrink:0}}/>:<div style={{width:34,height:34,borderRadius:6,background:'rgba(255,255,255,0.05)',flexShrink:0}}/>}
              <div><div onClick={()=>startEdit(a)} style={{fontSize:13,fontWeight:600,color:T.gold,cursor:'pointer',textDecoration:'underline',textDecorationColor:'rgba(212,175,55,0.4)'}}>{a.name}</div><div style={{fontSize:11,color:T.textDim}}>{a.duration||'—'}</div></div>
            </div>
            <div style={{fontSize:11,color:T.textMid}}>{regionLabel(a.region_slug)}</div>
            <div style={{fontSize:12,color:T.textMid}}>{fmtRate(a)}</div>
            <div style={{fontSize:11,color:T.textMid}}>{a.category||'—'}</div>
            <button onClick={()=>toggleActive(a)} style={{width:36,height:20,borderRadius:10,border:'none',background:a.is_active?T.green:'rgba(255,255,255,0.1)',cursor:'pointer',position:'relative'}}><div style={{position:'absolute',top:2,left:a.is_active?18:2,width:16,height:16,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/></button>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>startEdit(a)} style={{padding:'4px 9px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:6,color:T.gold,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>Edit</button>
              <button onClick={()=>remove(a)} style={{padding:'4px 8px',background:'transparent',border:`0.5px solid ${T.border}`,borderRadius:6,color:T.red,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>Del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
