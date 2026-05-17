// ─────────────────────────────────────────────────────────────────────────────
// ContentCMS.jsx  —  v3.0
// Tile-based content management for The Travel Catalogue
//
// Tile structure:
//   Overview tile   — hero image, reel slot, tagline, description, scores
//   Room Type tiles — each room: description + 7+ image gallery, drag-reorder
//   Activity tiles  — paid add-ons: description + images
//   Reels section   — 3-reel structure, upload, duration check
//   Social section  — Instagram/Facebook/YouTube
//   Tags section    — experience/traveller/theme tags, keywords, KB locked notice
//
// Approval logic:
//   uploadedBy === "admin"    → status: "approved", logged to AUDIT_LOG immediately
//   uploadedBy === "supplier" → status: "pending",  goes to review queue
//
// Content Score (mirrors spec):
//   Description 15 · Room descs 15 · Photography 20 · Reels 20(+5)
//   Social 10 · KB 10 (admin-only) · Keywords 5 · Freshness 5
//
// Supabase: tkthsbxuyihoblpcfnml (correct project)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect } from "react";

const EDITION_CONFIG = { name: "The Safari Edition", primaryColor: "#d4af37" };

const T = {
  bg:"#07080f",bg2:"#0d0e1a",surface:"#12142a",surface2:"#1a1c35",
  gold:"#d4af37",goldDim:"rgba(212,175,55,0.10)",borderGold:"rgba(212,175,55,0.28)",
  text:"#f0ede6",textMid:"rgba(240,237,230,0.62)",textDim:"rgba(240,237,230,0.32)",
  border:"rgba(255,255,255,0.07)",
  green:"#4ade80",greenDim:"rgba(74,222,128,0.10)",
  red:"#f87171",redDim:"rgba(248,113,113,0.10)",
  amber:"#fbbf24",amberDim:"rgba(251,191,36,0.10)",
  blue:"#60a5fa",blueDim:"rgba(96,165,250,0.10)",
  purple:"#a78bfa",
};

// ── SUPABASE (correct project) ────────────────────────────────────────────────
const SB_URL = "https://tkthsbxuyihoblpcfnml.supabase.co";
const SB_KEY = "sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx";

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...opts.headers },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text(); return t ? JSON.parse(t) : [];
}

// ── HAIKU ─────────────────────────────────────────────────────────────────────
async function haikusCheck(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text ?? "Unable to check.";
  } catch { return "AI check unavailable."; }
}

// ── CONTENT SCORE ─────────────────────────────────────────────────────────────
function calcFullScore(supplier, kbCount) {
  const desc  = supplier.description ?? "";
  const imgs  = (supplier.images ?? []).filter(i => i.status === "approved");
  const reels = (supplier.reels ?? []).filter(r => r.status === "approved");
  const rooms = supplier.room_types ?? [];
  const soc   = supplier.social ?? {};
  const kw    = supplier.keywords ?? [];

  const descPts  = desc.split(/\s+/).filter(Boolean).length >= 150 ? 15 : desc.split(/\s+/).filter(Boolean).length >= 75 ? 8 : 0;
  const roomsWithDesc = rooms.filter(r => (r.description ?? "").split(/\s+/).filter(Boolean).length >= 100);
  const roomPts  = rooms.length > 0 ? Math.round((roomsWithDesc.length / rooms.length) * 15) : 0;
  const photoPts = imgs.length >= 12 ? 20 : imgs.length >= 6 ? 12 : imgs.length >= 3 ? 6 : 0;
  const reelPts  = reels.length >= 3 ? 25 : reels.length >= 2 ? 20 : reels.length >= 1 ? 10 : 0;
  const socPts   = (soc.instagram ? 4 : 0) + (soc.facebook ? 3 : 0) + (soc.youtube ? 3 : 0);
  const kbPts    = kbCount >= 3 ? 10 : kbCount >= 1 ? 4 : 0;
  const kwPts    = kw.length >= 5 ? 5 : kw.length >= 2 ? 2 : 0;
  const freshPts = supplier.last_content_update ? 5 : 0;

  return {
    total: Math.min(descPts + roomPts + photoPts + reelPts + socPts + kbPts + kwPts + freshPts, 100),
    dims: {
      description: { pts: descPts,  max: 15, label: "Property description" },
      rooms:        { pts: roomPts,  max: 15, label: "Room descriptions" },
      photography:  { pts: photoPts, max: 20, label: "Photography" },
      reels:        { pts: reelPts,  max: 25, label: "Video reels" },
      social:       { pts: socPts,   max: 10, label: "Social connections" },
      kb:           { pts: kbPts,    max: 10, label: "Knowledge base (TSE only)", locked: true },
      keywords:     { pts: kwPts,    max:  5, label: "Keywords & tags" },
      freshness:    { pts: freshPts, max:  5, label: "Content freshness" },
    },
  };
}

// ── TAGS ──────────────────────────────────────────────────────────────────────
const EXP_TAGS   = ["big-five","gorilla-trekking","marine","walking-safari","birding","photographic","night-drive","fly-camping","horseback","canoeing","balloon","boat-safari"];
const TRAV_TAGS  = ["honeymoon","family","solo","group","anniversary","first-timer","return-traveller","multi-gen","corporate","celebration"];
const THEME_TAGS = ["conservation","adventure","wellness","cultural","photographic","off-grid","ultra-luxury","community","digital-detox","star-gazing"];

// ── AUDIT LOG ─────────────────────────────────────────────────────────────────
let AUDIT_LOG = [];
function auditLog(action, field, oldVal, newVal, user) {
  AUDIT_LOG.push({ ts: new Date().toISOString(), action, field, oldVal: String(oldVal).slice(0,80), newVal: String(newVal).slice(0,80), user });
}

// ── DEMO DATA ─────────────────────────────────────────────────────────────────
const DEMO_SUPPLIER = {
  id: "sup-singita-boulders",
  name: "Singita Boulders Lodge",
  region_slug: "kruger-sabi-sand",
  short_tagline: "River-facing suites on the Sand River. Six guests per guide.",
  description: "Singita Boulders Lodge sits above the Sand River in the Sabi Sand Game Reserve. The six riverside suites — each with a private plunge pool and uninterrupted bush views — represent the quiet apex of the African safari experience. The lodge was built around the boulders that give it its name, and the design feels grown from the landscape rather than imposed upon it.",
  images: [
    { id:"img1",url:"https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800",caption:"Aerial view",room_type:"exterior",is_primary:true,order:0,status:"approved",width:1920,height:1080 },
    { id:"img2",url:"https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800",caption:"Main suite deck",room_type:"suite",is_primary:false,order:1,status:"approved",width:1920,height:1080 },
    { id:"img3",url:"https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800",caption:"Bush view",room_type:"exterior",is_primary:false,order:2,status:"approved",width:1920,height:1080 },
    { id:"img4",url:"https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=800",caption:"Dining area",room_type:"common",is_primary:false,order:3,status:"pending",width:800,height:600 },
    { id:"img5",url:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",caption:"Pool deck",room_type:"suite",is_primary:false,order:4,status:"pending",width:1200,height:800 },
    { id:"img6",url:"https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800",caption:"Sundowner",room_type:"experience",is_primary:false,order:5,status:"approved",width:1920,height:1080 },
  ],
  reels: [
    { id:"reel1",url:"#",thumbnail:"https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400",type:"arrival",caption:"Arrival experience",approved:true,duration_s:24,status:"approved" },
  ],
  room_types: [
    { id:"rt1", name:"Boulders Suite", category:"suite", description:"The Boulders Suite is built directly into the granite outcrop above the Sand River. At 120m², the suite features a king bedroom, outdoor shower, private plunge pool, and a wraparound deck where leopards are regularly seen at the river below. North-facing for the best light and uninterrupted views across the Sabi Sand. Ideal for couples and honeymooners seeking privacy.", beds:"King", size_sqm:120, max_pax:2, view:"River and bush",
      images:[
        { id:"rt1-img1",url:"https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800",caption:"Bedroom",order:0,status:"approved",width:1920,height:1080 },
        { id:"rt1-img2",url:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",caption:"Plunge pool",order:1,status:"approved",width:1200,height:800 },
      ]
    },
    { id:"rt2", name:"River Suite", category:"suite", description:"", beds:"Twin or King", size_sqm:95, max_pax:2, view:"River", images:[] },
  ],
  activities: [
    { id:"act1", name:"Private Bush Walk", type:"activity", description:"A 3-hour guided walk with an armed ranger. Morning departure, tracking wildlife on foot through the Sabi Sand. Limited to 4 guests. The ranger explains tracks, plants and behaviour you miss entirely from a vehicle.", duration:"3 hours · dawn", price_display:"R1,800 per person", is_included:false,
      images:[{ id:"act1-img1",url:"https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800",caption:"Bush walk",order:0,status:"approved",width:1920,height:1080 }]
    },
    { id:"act2", name:"Hot Air Balloon", type:"activity", description:"", duration:"3 hours · dawn", price_display:"R4,800 per person", is_included:false, images:[] },
  ],
  social:{ instagram:"@singitasabisand", facebook:"", youtube:"" },
  keywords:["big-five","private-reserve","sand-river","sabi-sand","ultra-luxury","photography"],
  experience_tags:["big-five","photographic","walking-safari","night-drive"],
  traveller_tags:["honeymoon","anniversary","return-traveller"],
  theme_tags:["conservation","photographic","off-grid"],
  last_content_update: new Date().toISOString(),
};

const ADMIN_QUEUE = [
  { id:"q1",supplier_name:"Singita Boulders Lodge",supplier_id:"sup-singita-boulders",type:"image",preview:"https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=400",caption:"Dining area",submitted_at:"2026-05-14T09:22:00Z",width:800,height:600,status:"pending" },
  { id:"q2",supplier_name:"Singita Boulders Lodge",supplier_id:"sup-singita-boulders",type:"image",preview:"https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400",caption:"Pool deck",submitted_at:"2026-05-14T09:25:00Z",width:1200,height:800,status:"pending" },
  { id:"q3",supplier_name:"Londolozi Tree Camp",supplier_id:"sup-londolozi",type:"description",body:"Singita Boulders is the best lodge in Africa with amazing rooms and fantastic staff. The food is great and you'll see lots of animals.",submitted_at:"2026-05-12T11:00:00Z",status:"pending" },
  { id:"q4",supplier_name:"Dulini Lodge",supplier_id:"sup-dulini",type:"reel",preview:"https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400",caption:"Room walkthrough",reel_type:"room",duration_s:41,submitted_at:"2026-05-11T16:00:00Z",status:"pending" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }) {
  const r = size/2 - 8;
  const circ = 2 * Math.PI * r;
  const fill = (Math.min(score,100)/100) * circ;
  const color = score >= 80 ? T.green : score >= 60 ? T.amber : score >= 40 ? T.gold : T.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dasharray 0.6s ease"}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size/4.5} fontWeight="700" fontFamily="inherit">{score}</text>
    </svg>
  );
}

function DimBar({ label, current, max, locked }) {
  const pct = Math.min((current/max)*100, 100);
  const color = locked ? T.purple : current >= max ? T.green : current > 0 ? T.amber : "rgba(255,255,255,0.08)";
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:11,color:locked?T.purple:T.textMid}}>{label}{locked&&<span style={{fontSize:9,opacity:0.6}}> · TSE only</span>}</span>
        <span style={{fontSize:11,color:current>=max?T.green:T.textDim}}>{current}/{max}</span>
      </div>
      <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const m = { approved:{bg:T.greenDim,border:"rgba(74,222,128,0.3)",color:T.green,label:"Approved"}, pending:{bg:T.amberDim,border:"rgba(251,191,36,0.3)",color:T.amber,label:"Pending"}, rejected:{bg:T.redDim,border:"rgba(248,113,113,0.3)",color:T.red,label:"Rejected"} };
  const s = m[status] ?? m.pending;
  return <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:s.bg,border:`0.5px solid ${s.border}`,color:s.color,fontWeight:700}}>{s.label}</span>;
}

function QualBar({ width, height }) {
  const ok = width >= 1920 && height >= 1080;
  const warn = width >= 1200 && height >= 800;
  return <div style={{fontSize:10,color:ok?T.green:warn?T.amber:T.red}}>{width}×{height} {ok?"✓ HD":warn?"⚠ OK":"✗ Low"}</div>;
}

function Pencil({ onClick, small }) {
  return (
    <button onClick={onClick} title="Edit" style={{background:"rgba(212,175,55,0.10)",border:`0.5px solid ${T.borderGold}`,borderRadius:6,padding:small?"2px 5px":"3px 7px",cursor:"pointer",color:T.gold,fontSize:small?10:11,lineHeight:1,display:"inline-flex",alignItems:"center"}}>
      ✎
    </button>
  );
}

function InlineEdit({ value, onSave, onCancel, multiline, placeholder, minWords }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef();
  useEffect(() => { ref.current?.focus(); }, []);
  const wc = draft.split(/\s+/).filter(Boolean).length;
  return (
    <div>
      {multiline ? (
        <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} rows={6} placeholder={placeholder}
          style={{width:"100%",padding:"10px 12px",background:T.bg2,border:`1px solid ${T.borderGold}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",lineHeight:1.7}}/>
      ) : (
        <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} placeholder={placeholder}
          style={{width:"100%",padding:"8px 10px",background:T.bg2,border:`1px solid ${T.borderGold}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      )}
      {multiline && minWords && <div style={{fontSize:10,color:wc>=(minWords??100)?T.green:T.amber,marginTop:3}}>{wc} words {wc<(minWords??100)?`(need ${(minWords??100)-wc} more)`:"✓"}</div>}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={() => onSave(draft)} style={{padding:"5px 14px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:7,color:"#0a0a0a",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
        <button onClick={onCancel} style={{padding:"5px 12px",background:"transparent",border:`0.5px solid ${T.border}`,borderRadius:7,color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GALLERY — drag-to-reorder, 7+ target per room
// ─────────────────────────────────────────────────────────────────────────────
function ImageGallery({ images, onReorder, onRemove, onUpload, onSetPrimary, minTarget=7, maxImages=20 }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleDragEnter = (i) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    onReorder(next.map((img, idx) => ({ ...img, order: idx })));
    setDragIdx(i);
  };

  const approved = images.filter(i => i.status === "approved").length;
  const pending  = images.filter(i => i.status === "pending").length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:T.textDim}}>
          <span style={{color:approved>=minTarget?T.green:T.amber,fontWeight:600}}>{approved} approved</span>
          {pending>0&&<span style={{color:T.amber,marginLeft:8}}>{pending} pending</span>}
          <span style={{color:T.textDim,marginLeft:8}}>· target {minTarget}+</span>
        </div>
        <button onClick={() => inputRef.current?.click()} style={{padding:"5px 12px",background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Add photos</button>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e => onUpload(Array.from(e.target.files))}/>
      </div>

      {images.length === 0 && (
        <div onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); onUpload(Array.from(e.dataTransfer.files)); }}
          style={{padding:"24px",border:`1.5px dashed ${dragOver?T.gold:T.border}`,borderRadius:10,textAlign:"center",cursor:"pointer",background:dragOver?T.goldDim:"transparent",transition:"all 0.15s"}}>
          <div style={{fontSize:24,marginBottom:6}}>📸</div>
          <div style={{fontSize:12,color:T.textMid}}>Drag photos here or click to select</div>
          <div style={{fontSize:10,color:T.textDim,marginTop:3}}>JPEG · PNG · 1200×800px min · 20MB max</div>
        </div>
      )}

      {images.length > 0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",gap:8}} onDragOver={e => e.preventDefault()}>
          {images.map((img, i) => (
            <div key={img.id} draggable
              onDragStart={() => setDragIdx(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={() => setDragIdx(null)}
              style={{position:"relative",borderRadius:9,overflow:"hidden",border:`0.5px solid ${dragIdx===i?T.gold:img.status==="approved"?"rgba(74,222,128,0.25)":T.border}`,cursor:"grab",opacity:dragIdx===i?0.5:1,transition:"opacity 0.15s,border-color 0.15s"}}>
              <div style={{paddingTop:"65%",position:"relative",background:T.bg2}}>
                <img src={img.url} alt={img.caption??""} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",top:4,left:4,fontSize:9,color:"rgba(255,255,255,0.5)",background:"rgba(0,0,0,0.4)",borderRadius:4,padding:"2px 4px",pointerEvents:"none"}}>⠿ {i+1}</div>
                {img.is_primary&&<div style={{position:"absolute",top:4,right:4,fontSize:8,fontWeight:700,background:T.gold,color:"#0a0a0a",borderRadius:20,padding:"2px 6px"}}>PRIMARY</div>}
              </div>
              <div style={{padding:"6px 8px",background:T.surface}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <StatusPill status={img.status}/>
                  <QualBar width={img.width??0} height={img.height??0}/>
                </div>
                <div style={{fontSize:10,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{img.caption||"No caption"}</div>
                <div style={{display:"flex",gap:4}}>
                  {!img.is_primary&&onSetPrimary&&(
                    <button onClick={() => onSetPrimary(img.id)} style={{flex:1,padding:"3px 0",background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:5,color:T.gold,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>★ Primary</button>
                  )}
                  <button onClick={() => onRemove(img.id)} style={{padding:"3px 7px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:5,color:T.red,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                </div>
              </div>
            </div>
          ))}
          {images.length < maxImages && (
            <div onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); onUpload(Array.from(e.dataTransfer.files)); }}
              style={{borderRadius:9,border:`1.5px dashed ${dragOver?T.gold:T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:100,cursor:"pointer",background:dragOver?T.goldDim:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:20,color:T.textDim}}>+</div>
              <div style={{fontSize:9,color:T.textDim,marginTop:3}}>Add more</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TILE
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTile({ supplier, scoreData, onUpdate, uploadedBy, onFlash }) {
  const [editing, setEditing] = useState(null);
  const [descChecking, setDescChecking] = useState(false);
  const [descCheckResult, setDescCheckResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const heroImgRef = useRef();
  const heroReelRef = useRef();
  const isAdmin = uploadedBy === "admin";
  const primaryImg = (supplier.images??[]).find(i=>i.is_primary)??(supplier.images??[])[0];
  const approvedReel = (supplier.reels??[]).find(r=>r.status==="approved");
  const wc = (supplier.description??"").split(/\s+/).filter(Boolean).length;

  const handleSave = (field, value) => {
    if (isAdmin) { auditLog("edit", field, supplier[field]??"", value, "TSE Admin"); onUpdate({[field]:value}); onFlash(`✓ ${field} updated`); }
    else { onUpdate({[field]:value}); onFlash(`✓ Submitted for review`); }
    setEditing(null); setDescCheckResult(null);
  };

  const checkDesc = async () => {
    setDescChecking(true); setDescCheckResult(null);
    const r = await haikusCheck(`Luxury safari content editor. Property: "${supplier.name}" (${supplier.region_slug}). Description:\n"${supplier.description}"\n\n2–3 sentences: Specific, sensory, no generic superlatives? Flag anything weak. APPROVE or NOTE CONCERNS.`);
    setDescCheckResult(r); setDescChecking(false);
  };

  // Upload hero image — sets as primary, room_type: exterior
  const handleHeroImage = async (file) => {
    if (!file) return;
    setUploading(true);
    onFlash("⟳ Uploading hero image…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("supplier_id", supplier.id);
      fd.append("media_type", "images");
      fd.append("caption", "Hero image");
      fd.append("room_type", "exterior");
      fd.append("is_primary", "true");
      fd.append("uploaded_by", uploadedBy);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        const dims = await new Promise(resolve => { const img = new window.Image(); img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight }); img.onerror = () => resolve({ width: 0, height: 0 }); img.src = data.url; });
        const newImg = { id: data.image_id, url: data.url, path: data.path, caption: "Hero image", room_type: "exterior", is_primary: true, order: 0, status: isAdmin ? "approved" : "pending", ...dims };
        const updatedImages = (supplier.images ?? []).map(i => ({ ...i, is_primary: false }));
        updatedImages.unshift(newImg);
        onUpdate({ images: updatedImages });
        onFlash(isAdmin ? "✓ Hero image uploaded and live" : "✓ Hero image uploaded — pending review");
      } else { onFlash("✗ " + (data.error ?? "Upload failed")); }
    } catch { onFlash("✗ Upload error — try again"); }
    setUploading(false);
  };

  // Upload hero reel — sets as arrival reel
  const handleHeroReel = async (file) => {
    if (!file) return;
    setUploading(true);
    onFlash("⟳ Uploading reel…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("supplier_id", supplier.id);
      fd.append("media_type", "reels");
      fd.append("caption", "Property reel");
      fd.append("reel_type", "arrival");
      fd.append("uploaded_by", uploadedBy);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        const duration = await new Promise(resolve => { const v = document.createElement("video"); v.preload = "metadata"; v.onloadedmetadata = () => { URL.revokeObjectURL(v.src); resolve(v.duration); }; v.onerror = () => resolve(0); v.src = URL.createObjectURL(file); });
        const newReel = { id: data.reel_id, url: data.url, path: data.path, thumbnail: null, type: "arrival", caption: "Property reel", approved: isAdmin, duration_s: Math.round(duration), status: isAdmin ? "approved" : "pending" };
        onUpdate({ reels: [...(supplier.reels ?? []), newReel] });
        onFlash(isAdmin ? "✓ Reel uploaded and live" : "✓ Reel uploaded — pending review");
      } else { onFlash("✗ " + (data.error ?? "Upload failed")); }
    } catch { onFlash("✗ Upload error — try again"); }
    setUploading(false);
  };

  return (
    <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,overflow:"hidden",marginBottom:16}}>
      {/* Hero + reel */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 260px",height:210}}>
        {/* Hero image slot */}
        <div style={{position:"relative",overflow:"hidden",background:T.bg2}}>
          {primaryImg
            ? <img src={primaryImg.url} alt={supplier.name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}><div style={{fontSize:32}}>🏕</div><div style={{fontSize:12,color:T.textDim}}>No primary image</div></div>
          }
          <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(7,8,15,0.92) 0%,rgba(7,8,15,0.15) 55%,transparent 100%)"}}/>
          {/* Upload button — top right of hero */}
          <div style={{position:"absolute",top:10,right:10}}>
            <button onClick={() => heroImgRef.current?.click()} disabled={uploading}
              style={{padding:"5px 10px",background:"rgba(0,0,0,0.6)",border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(8px)"}}>
              {uploading ? "⟳" : "📸 Change hero"}
            </button>
            <input ref={heroImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e => { if (e.target.files[0]) handleHeroImage(e.target.files[0]); e.target.value = ""; }}/>
          </div>
          <div style={{position:"absolute",bottom:14,left:16,right:16,display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
            <div>
              <div style={{fontSize:20,fontWeight:700,color:"#fff",fontFamily:"'Playfair Display',serif",lineHeight:1.2}}>{supplier.name}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:3}}>{supplier.region_slug?.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</div>
            </div>
            <ScoreRing score={scoreData.total} size={56}/>
          </div>
        </div>
        {/* Reel slot */}
        <div style={{background:T.bg2,position:"relative",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderLeft:`0.5px solid ${T.border}`}}>
          {/* Upload reel button — top right of reel slot */}
          <div style={{position:"absolute",top:10,right:10,zIndex:10}}>
            <button onClick={() => heroReelRef.current?.click()} disabled={uploading}
              style={{padding:"5px 10px",background:"rgba(0,0,0,0.6)",border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(8px)"}}>
              {uploading ? "⟳" : "🎬 Upload reel"}
            </button>
            <input ref={heroReelRef} type="file" accept="video/*" style={{display:"none"}} onChange={e => { if (e.target.files[0]) handleHeroReel(e.target.files[0]); e.target.value = ""; }}/>
          </div>
          {approvedReel?.thumbnail ? (
            <div style={{position:"relative",width:"100%",height:"100%"}}>
              <img src={approvedReel.thumbnail} alt="Reel" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"2px solid rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:16,marginLeft:3}}>▶</span></div>
              </div>
              <div style={{position:"absolute",bottom:8,left:8,right:8}}>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.7)"}}>{approvedReel.caption}</div>
                <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:1}}>{approvedReel.duration_s}s · {approvedReel.type}</div>
              </div>
            </div>
          ) : (
            <>
              <div style={{fontSize:28,marginBottom:6}}>🎬</div>
              <div style={{fontSize:11,color:T.textDim,textAlign:"center",padding:"0 12px"}}>No approved reel yet</div>
              <div style={{fontSize:10,color:T.gold,marginTop:4}}>+20 pts available</div>
            </>
          )}
        </div>
      </div>

      {/* Tagline */}
      <div style={{padding:"14px 18px 0",borderTop:`0.5px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
          <span style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Short tagline</span>
          <Pencil onClick={() => setEditing(editing==="tagline"?null:"tagline")}/>
          {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"2px 7px"}}>instant apply</span>}
        </div>
        {editing==="tagline" ? (
          <InlineEdit value={supplier.short_tagline??""} placeholder="One line — what makes this property unmissable"
            onSave={v=>handleSave("short_tagline",v)} onCancel={()=>setEditing(null)}/>
        ) : (
          <div style={{fontSize:13,color:supplier.short_tagline?T.textMid:T.textDim,fontStyle:supplier.short_tagline?"normal":"italic"}}>
            {supplier.short_tagline||"No tagline yet — click ✎ to add"}
          </div>
        )}
      </div>

      {/* Description */}
      <div style={{padding:"14px 18px 18px"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          <span style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Property description</span>
          <Pencil onClick={() => setEditing(editing==="description"?null:"description")}/>
          <span style={{fontSize:10,color:wc>=150?T.green:T.amber}}>{wc}/150 words</span>
          {!isAdmin&&<StatusPill status="pending"/>}
          {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"2px 7px"}}>instant apply</span>}
        </div>
        {editing==="description" ? (
          <div>
            <InlineEdit value={supplier.description??""} multiline minWords={150}
              placeholder="150+ words. Specific, sensory, original. Names, views, architecture. No generic superlatives."
              onSave={v=>handleSave("description",v)} onCancel={()=>{setEditing(null);setDescCheckResult(null);}}/>
            <div style={{marginTop:10,display:"flex",gap:8}}>
              <button onClick={checkDesc} disabled={descChecking} style={{padding:"5px 12px",background:T.blueDim,border:"0.5px solid rgba(96,165,250,0.3)",borderRadius:7,color:T.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {descChecking?"⟳ Checking…":"✦ AI Haiku Check"}
              </button>
            </div>
            {descCheckResult&&(
              <div style={{marginTop:8,background:descCheckResult.includes("CONCERNS")?T.amberDim:T.greenDim,border:`0.5px solid ${descCheckResult.includes("CONCERNS")?"rgba(251,191,36,0.3)":"rgba(74,222,128,0.3)"}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.textMid,lineHeight:1.6}}>
                <div style={{fontSize:10,fontWeight:700,color:descCheckResult.includes("CONCERNS")?T.amber:T.green,marginBottom:4}}>{descCheckResult.includes("CONCERNS")?"⚠ AI note":"✓ AI — looks good"}</div>
                {descCheckResult}
              </div>
            )}
          </div>
        ) : (
          <div style={{fontSize:13,color:supplier.description?T.textMid:T.textDim,lineHeight:1.7,fontStyle:supplier.description?"normal":"italic"}}>
            {supplier.description||"No description yet — click ✎ to add. Minimum 150 words required (+15 pts)"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM TYPE TILE
// ─────────────────────────────────────────────────────────────────────────────
function RoomTile({ room, supplierId, onUpdate, onRemove, uploadedBy, onFlash }) {
  const [editingField, setEditingField] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const isAdmin = uploadedBy === "admin";
  const approvedImgs = (room.images??[]).filter(i=>i.status==="approved").length;
  const wc = (room.description??"").split(/\s+/).filter(Boolean).length;

  const handleSave = (field, value) => {
    if (isAdmin) { auditLog("edit",`room.${room.id}.${field}`,room[field]??"",value,"TSE Admin"); }
    onUpdate(room.id, {[field]: value});
    onFlash(isAdmin?`✓ ${room.name} — ${field} updated`:"✓ Submitted for review");
    setEditingField(null);
  };

  const handleImageUpload = async (files) => {
    onFlash(`⟳ Uploading ${files.length} image(s)…`);
    const uploaded = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file",file); fd.append("supplier_id", supplierId);
        fd.append("media_type","images"); fd.append("caption",file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));
        fd.append("room_type",room.category); fd.append("is_primary",String((room.images??[]).length===0&&uploaded.length===0));
        fd.append("uploaded_by",uploadedBy);
        const res = await fetch("/api/upload",{method:"POST",body:fd});
        const data = await res.json();
        if (data.success) {
          const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
          uploaded.push({id:data.image_id,url:data.url,path:data.path,caption:file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "),order:(room.images??[]).length+uploaded.length,status:isAdmin?"approved":"pending",...dims});
        }
      } catch(e){console.error(e);}
    }
    if (uploaded.length>0) { onUpdate(room.id,{images:[...(room.images??[]),...uploaded]}); onFlash(`✓ ${uploaded.length} uploaded`); }
    else onFlash("✗ Upload failed");
  };

  return (
    <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
      {/* Header — click to expand */}
      <div style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpanded(e=>!e)}>
        <div style={{width:52,height:38,borderRadius:7,overflow:"hidden",background:T.bg2,flexShrink:0}}>
          {room.images?.[0]?<img src={room.images[0].url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🛏</div>}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text}}>{room.name}</div>
          <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{room.beds||"—"} · {room.size_sqm?`${room.size_sqm}m²`:"size n/a"} · {room.view||"view n/a"}</div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,color:T.textDim,marginBottom:1}}>DESC</div>
            <div style={{fontSize:11,fontWeight:700,color:wc>=100?T.green:T.amber}}>{wc}w</div>
          </div>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,color:T.textDim,marginBottom:1}}>PHOTOS</div>
            <div style={{fontSize:11,fontWeight:700,color:approvedImgs>=7?T.green:T.amber}}>{approvedImgs}/7</div>
          </div>
          <div style={{fontSize:12,color:T.textDim,marginLeft:4}}>{expanded?"▲":"▼"}</div>
        </div>
      </div>

      {expanded&&(
        <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 16px"}}>
          {/* Metadata grid */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
            {[{key:"beds",label:"Bed type"},{key:"size_sqm",label:"Size m²"},{key:"max_pax",label:"Max guests"},{key:"view",label:"View"}].map(({key,label})=>(
              <div key={key} style={{background:T.bg,borderRadius:8,padding:"9px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                  <Pencil small onClick={()=>setEditingField(editingField===key?null:key)}/>
                </div>
                {editingField===key?(
                  <InlineEdit value={String(room[key]??"")} placeholder={label}
                    onSave={v=>handleSave(key,key==="size_sqm"||key==="max_pax"?Number(v):v)} onCancel={()=>setEditingField(null)}/>
                ):(
                  <div style={{fontSize:12,color:room[key]?T.text:T.textDim,fontStyle:room[key]?"normal":"italic"}}>{room[key]||`Add ${label.toLowerCase()}`}</div>
                )}
              </div>
            ))}
          </div>

          {/* Room description */}
          <div style={{marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Room description</span>
              <Pencil onClick={()=>setEditingField(editingField==="description"?null:"description")}/>
              <span style={{fontSize:10,color:wc>=100?T.green:T.amber}}>{wc}/100 words</span>
              {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"2px 7px"}}>instant</span>}
            </div>
            {editingField==="description"?(
              <InlineEdit value={room.description??""} multiline minWords={100}
                placeholder="100+ words. Bed type, size, view, bathroom, private facilities, what makes this room special."
                onSave={v=>handleSave("description",v)} onCancel={()=>setEditingField(null)}/>
            ):(
              <div style={{fontSize:12,color:room.description?T.textMid:T.textDim,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 12px",fontStyle:room.description?"normal":"italic"}}>
                {room.description||"No description — click ✎ to add. 100+ words required for full room score."}
              </div>
            )}
          </div>

          {/* Gallery */}
          <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>
            Room gallery <span style={{fontSize:10,color:T.textDim,textTransform:"none",letterSpacing:0,fontStyle:"italic"}}>— drag to reorder · target 7+ approved</span>
          </div>
          <ImageGallery
            images={room.images??[]}
            onReorder={imgs=>onUpdate(room.id,{images:imgs})}
            onRemove={imgId=>onUpdate(room.id,{images:(room.images??[]).filter(i=>i.id!==imgId)})}
            onUpload={handleImageUpload}
            onSetPrimary={imgId=>onUpdate(room.id,{images:(room.images??[]).map(i=>({...i,is_primary:i.id===imgId}))})}
            minTarget={7} maxImages={20}
          />

          <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
            <button onClick={()=>onRemove(room.id)} style={{padding:"5px 12px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:7,color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Remove room type</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY TILE
// ─────────────────────────────────────────────────────────────────────────────
function ActivityTile({ activity, supplierId, onUpdate, onRemove, uploadedBy, onFlash }) {
  const [editingField, setEditingField] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const isAdmin = uploadedBy === "admin";

  const handleSave = (field, value) => {
    if (isAdmin) auditLog("edit",`activity.${activity.id}.${field}`,activity[field]??"",value,"TSE Admin");
    onUpdate(activity.id,{[field]:value});
    onFlash(isAdmin?`✓ ${activity.name} updated`:"✓ Updated");
    setEditingField(null);
  };

  const handleImageUpload = async (files) => {
    onFlash("⟳ Uploading…");
    const uploaded = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file",file); fd.append("supplier_id", supplierId);
        fd.append("media_type","images"); fd.append("caption",file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));
        fd.append("room_type","activity"); fd.append("uploaded_by",uploadedBy);
        const res = await fetch("/api/upload",{method:"POST",body:fd});
        const data = await res.json();
        if (data.success) {
          const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
          uploaded.push({id:data.image_id,url:data.url,path:data.path,caption:file.name.replace(/\.[^.]+$/,""),order:(activity.images??[]).length+uploaded.length,status:isAdmin?"approved":"pending",...dims});
        }
      } catch(e){console.error(e);}
    }
    if (uploaded.length>0) { onUpdate(activity.id,{images:[...(activity.images??[]),...uploaded]}); onFlash("✓ Uploaded"); }
    else onFlash("✗ Failed");
  };

  return (
    <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
      <div style={{padding:"13px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpanded(e=>!e)}>
        <div style={{width:52,height:38,borderRadius:7,overflow:"hidden",background:T.bg2,flexShrink:0}}>
          {activity.images?.[0]?<img src={activity.images[0].url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏃</div>}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{activity.name}</div>
            <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold}}>Paid add-on</span>
          </div>
          <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{activity.duration} · {activity.price_display} · {(activity.images??[]).length} photos</div>
        </div>
        <div style={{fontSize:12,color:T.textDim}}>{expanded?"▲":"▼"}</div>
      </div>

      {expanded&&(
        <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[{key:"duration",label:"Duration"},{key:"price_display",label:"Price"}].map(({key,label})=>(
              <div key={key} style={{background:T.bg,borderRadius:8,padding:"9px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                  <Pencil small onClick={()=>setEditingField(editingField===key?null:key)}/>
                </div>
                {editingField===key?(
                  <InlineEdit value={activity[key]??""} placeholder={label} onSave={v=>handleSave(key,v)} onCancel={()=>setEditingField(null)}/>
                ):(
                  <div style={{fontSize:12,color:activity[key]?T.text:T.textDim}}>{activity[key]||`Add ${label.toLowerCase()}`}</div>
                )}
              </div>
            ))}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Description</span>
              <Pencil onClick={()=>setEditingField(editingField==="description"?null:"description")}/>
            </div>
            {editingField==="description"?(
              <InlineEdit value={activity.description??""} multiline placeholder="Describe the activity: what happens, who leads it, what guests experience."
                onSave={v=>handleSave("description",v)} onCancel={()=>setEditingField(null)}/>
            ):(
              <div style={{fontSize:12,color:activity.description?T.textMid:T.textDim,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 12px",fontStyle:activity.description?"normal":"italic"}}>
                {activity.description||"No description yet"}
              </div>
            )}
          </div>

          <div style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Activity photos — drag to reorder</div>
          <ImageGallery
            images={activity.images??[]}
            onReorder={imgs=>onUpdate(activity.id,{images:imgs})}
            onRemove={imgId=>onUpdate(activity.id,{images:(activity.images??[]).filter(i=>i.id!==imgId)})}
            onUpload={handleImageUpload}
            minTarget={3} maxImages={10}
          />
          <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
            <button onClick={()=>onRemove(activity.id)} style={{padding:"5px 12px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:7,color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Remove activity</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPPLIER CONTENT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SupplierContentPanel({ uploadedBy = "supplier" }) {
  const [supplier, setSupplier] = useState(DEMO_SUPPLIER);
  const [loading, setLoading] = useState(true);
  const [flash, setFlash] = useState("");
  const [section, setSection] = useState("tiles");
  const isAdmin = uploadedBy === "admin";
  const reelInputRef = useRef();

  // Load real supplier from URL — /admin/suppliers/[uuid]/content
  useEffect(() => {
    const parts = window.location.pathname.split("/");
    const idx = parts.indexOf("suppliers");
    const supplierId = idx !== -1 ? parts[idx + 1] : null;
    if (!supplierId || supplierId.length < 10) { setLoading(false); return; }
    fetch(`${SB_URL}/rest/v1/suppliers?id=eq.${supplierId}&select=*`, {
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
      }
    })
    .then(r => r.json())
    .then(data => {
      if (data?.[0]) {
        const s = data[0];
        setSupplier({
          ...DEMO_SUPPLIER,
          id:          s.id,
          name:        s.name         ?? DEMO_SUPPLIER.name,
          region_slug: s.region_slug  ?? DEMO_SUPPLIER.region_slug,
          short_tagline:       s.short_tagline ?? "",
          description:         s.description  ?? "",
          images:   Array.isArray(s.images) ? s.images : [],
          reels:    Array.isArray(s.reels)  ? s.reels  : [],
          room_types:  Array.isArray(s.room_types)  ? s.room_types  : DEMO_SUPPLIER.room_types,
          activities:  Array.isArray(s.activities)   ? s.activities  : DEMO_SUPPLIER.activities,
          keywords:    s.tags ?? [],
          social:      s.social ?? { instagram: "", facebook: "", youtube: "" },
          experience_tags: s.experience_tags ?? [],
          traveller_tags:  s.traveller_tags  ?? [],
          theme_tags:      s.theme_tags      ?? [],
          last_content_update: s.updated_at ?? null,
        });
      }
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  }, []);

  const onFlash = (msg) => { setFlash(msg); setTimeout(()=>setFlash(""),3000); };
  const update = (patch) => setSupplier(s=>({...s,...patch,last_content_update:new Date().toISOString()}));
  const updateRoom = (id, patch) => setSupplier(s=>({...s,room_types:s.room_types.map(r=>r.id===id?{...r,...patch}:r),last_content_update:new Date().toISOString()}));
  const removeRoom = (id) => setSupplier(s=>({...s,room_types:s.room_types.filter(r=>r.id!==id)}));
  const addRoom = () => { const id=`rt-${Date.now()}`; setSupplier(s=>({...s,room_types:[...s.room_types,{id,name:"New Room Type",category:"suite",description:"",beds:"",size_sqm:null,max_pax:2,view:"",images:[]}]})); };
  const updateActivity = (id, patch) => setSupplier(s=>({...s,activities:s.activities.map(a=>a.id===id?{...a,...patch}:a)}));
  const removeActivity = (id) => setSupplier(s=>({...s,activities:s.activities.filter(a=>a.id!==id)}));
  const addActivity = () => { const id=`act-${Date.now()}`; setSupplier(s=>({...s,activities:[...s.activities,{id,name:"New Activity",type:"activity",description:"",duration:"",price_display:"",is_included:false,images:[]}]})); };

  const scoreData = calcFullScore(supplier, 0);

  const handleReelUpload = async (file) => {
    if (!file) return;
    onFlash("⟳ Uploading reel…");
    try {
      const fd = new FormData();
      fd.append("file",file); fd.append("supplier_id",supplier.id);
      fd.append("media_type","reels"); fd.append("caption",file.name.replace(/\.[^.]+$/,""));
      fd.append("reel_type","room"); fd.append("uploaded_by",uploadedBy);
      const res = await fetch("/api/upload",{method:"POST",body:fd});
      const data = await res.json();
      if (data.success) {
        const duration = await new Promise(resolve=>{const v=document.createElement("video");v.preload="metadata";v.onloadedmetadata=()=>{URL.revokeObjectURL(v.src);resolve(v.duration);};v.onerror=()=>resolve(0);v.src=URL.createObjectURL(file);});
        setSupplier(s=>({...s,reels:[...s.reels,{id:data.reel_id,url:data.url,path:data.path,thumbnail:null,type:"room",caption:file.name.replace(/\.[^.]+$/,""),approved:isAdmin,duration_s:Math.round(duration),status:isAdmin?"approved":"pending"}]}));
        onFlash(isAdmin?"✓ Reel uploaded and approved":"✓ Reel uploaded — pending review");
      } else onFlash("✗ "+data.error);
    } catch { onFlash("✗ Upload error"); }
  };

  const SECTIONS = [
    {id:"tiles",label:"Content Tiles"},
    {id:"reels",label:`Reels (${supplier.reels.length}/3)`},
    {id:"social",label:"Social"},
    {id:"tags",label:"Tags & Keywords"},
  ];

  return (
    <div style={{fontFamily:"Arial,sans-serif",color:T.text}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{supplier.name}</div>
          <div style={{fontSize:12,color:T.textDim,marginTop:2}}>
            {supplier.region_slug?.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())} · {isAdmin?<span style={{color:T.green}}>TSE Admin — instant apply, audit logged</span>:"Content Manager"}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <ScoreRing score={scoreData.total} size={64}/>
          <div style={{fontSize:10,color:T.textDim}}>Content Score</div>
          <div style={{fontSize:10,fontWeight:700,color:scoreData.total>=90?T.green:scoreData.total>=80?"#4ade80":scoreData.total>=60?T.amber:T.red}}>
            {scoreData.total>=90?"✦ Featured":scoreData.total>=80?"Enhanced":scoreData.total>=60?"Standard":scoreData.total>=40?"Flagged":"Not listed"}
          </div>
        </div>
      </div>

      {/* Score breakdown */}
      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:10}}>Score breakdown</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px"}}>
          {Object.entries(scoreData.dims).map(([key,dim])=>(
            <DimBar key={key} label={dim.label} current={dim.pts} max={dim.max} locked={!!dim.locked}/>
          ))}
        </div>
      </div>

      {loading&&<div style={{fontSize:13,color:T.textDim,padding:"20px 0",textAlign:"center"}}>⟳ Loading supplier…</div>}
      {flash&&<div style={{background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:13,color:T.green}}>{flash}</div>}

      {/* Section nav */}
      <div style={{display:"flex",gap:6,marginBottom:18,borderBottom:`0.5px solid ${T.border}`,paddingBottom:12}}>
        {SECTIONS.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)}
            style={{padding:"7px 14px",borderRadius:8,border:`0.5px solid ${section===s.id?T.gold:T.border}`,background:section===s.id?T.goldDim:"transparent",color:section===s.id?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:section===s.id?600:400}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── TILES ── */}
      {section==="tiles"&&(
        <div>
          <OverviewTile supplier={supplier} scoreData={scoreData} onUpdate={update} uploadedBy={uploadedBy} onFlash={onFlash}/>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,marginTop:20}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Room Types</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Each room needs 100+ word description + 7+ approved photos · contributes to room score</div>
            </div>
            <button onClick={addRoom} style={{padding:"6px 14px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:8,color:"#0a0a0a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add room</button>
          </div>
          {supplier.room_types.map(room=>(
            <RoomTile key={room.id} room={room} supplierId={supplier.id} onUpdate={updateRoom} onRemove={removeRoom} uploadedBy={uploadedBy} onFlash={onFlash}/>
          ))}
          {supplier.room_types.length===0&&<div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"24px",textAlign:"center",fontSize:13,color:T.textDim}}>No room types added yet.</div>}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,marginTop:20}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Paid Add-on Activities</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Separately-priced only — included activities are part of the lodge rate</div>
            </div>
            <button onClick={addActivity} style={{padding:"6px 14px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:8,color:"#0a0a0a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add activity</button>
          </div>
          {supplier.activities.map(act=>(
            <ActivityTile key={act.id} activity={act} supplierId={supplier.id} onUpdate={updateActivity} onRemove={removeActivity} uploadedBy={uploadedBy} onFlash={onFlash}/>
          ))}
          {supplier.activities.length===0&&<div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"24px",textAlign:"center",fontSize:13,color:T.textDim}}>No paid activities added yet.</div>}
        </div>
      )}

      {/* ── REELS ── */}
      {section==="reels"&&(
        <div>
          <div style={{fontSize:12,color:T.textDim,marginBottom:16,lineHeight:1.7}}>
            15–30 seconds · 1080p minimum · Authentic footage outperforms over-produced video.<br/>
            <span style={{color:T.gold}}>2 approved reels = 20 pts · 3rd reel = +5 bonus</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
            {[{type:"arrival",label:"Arrival experience",desc:"Drive-in, first impression, welcome",pts:"+8"},{type:"room",label:"Room walkthrough",desc:"Layout, bathroom, view, balcony",pts:"+8"},{type:"activity",label:"Activity highlight",desc:"Game drive, walk, or water",pts:"+5 bonus"}].map(req=>{
              const existing = supplier.reels.find(r=>r.type===req.type);
              return (
                <div key={req.type} style={{background:existing?.status==="approved"?T.greenDim:existing?T.amberDim:T.surface,border:`0.5px solid ${existing?.status==="approved"?"rgba(74,222,128,0.3)":existing?"rgba(251,191,36,0.3)":T.border}`,borderRadius:12,padding:"13px"}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.text,marginBottom:3}}>{req.label}</div>
                  <div style={{fontSize:11,color:T.textDim,marginBottom:8}}>{req.desc}</div>
                  {existing?<StatusPill status={existing.status}/>:<div style={{fontSize:12,color:T.gold,fontWeight:600}}>{req.pts} pts available</div>}
                </div>
              );
            })}
          </div>
          <div onClick={()=>reelInputRef.current?.click()} style={{padding:"24px",border:`1.5px dashed ${T.border}`,borderRadius:12,textAlign:"center",cursor:"pointer",marginBottom:16}}>
            <div style={{fontSize:26,marginBottom:6}}>🎬</div>
            <div style={{fontSize:13,color:T.textMid,fontWeight:600}}>Drop reel here, or click to select</div>
            <div style={{fontSize:11,color:T.textDim,marginTop:3}}>MP4 · MOV · 1080p · 15–30s · Max 500MB</div>
            <input ref={reelInputRef} type="file" accept="video/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleReelUpload(e.target.files[0]);}}/>
          </div>
          {supplier.reels.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10}}>
              {supplier.reels.map(reel=>(
                <div key={reel.id} style={{background:T.surface,border:`0.5px solid ${reel.status==="approved"?"rgba(74,222,128,0.2)":T.border}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{paddingTop:"56.25%",position:"relative",background:T.bg2}}>
                    {reel.thumbnail?<img src={reel.thumbnail} alt={reel.caption} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:4}}><span style={{fontSize:22}}>🎬</span><span style={{fontSize:10,color:T.textDim}}>Preview pending</span></div>}
                    <div style={{position:"absolute",top:8,right:8}}><StatusPill status={reel.status}/></div>
                  </div>
                  <div style={{padding:"9px 12px"}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:3}}>{reel.caption}</div>
                    <div style={{fontSize:10,color:reel.duration_s>=15&&reel.duration_s<=30?T.green:T.red}}>{reel.duration_s}s {reel.duration_s>=15&&reel.duration_s<=30?"✓":"✗ must be 15–30s"}</div>
                    <select value={reel.type} onChange={e=>setSupplier(s=>({...s,reels:s.reels.map(r=>r.id===reel.id?{...r,type:e.target.value}:r)}))}
                      style={{width:"100%",padding:"5px 8px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:11,outline:"none",fontFamily:"inherit",marginTop:6}}>
                      {["arrival","room","activity","wildlife"].map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SOCIAL ── */}
      {section==="social"&&(
        <div>
          <div style={{fontSize:12,color:T.textDim,marginBottom:16,lineHeight:1.7}}>Read-only connections — we pull your content to keep your profile fresh and award score points.<br/><span style={{color:T.gold}}>Instagram +4 · Facebook +3 · YouTube +3</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
            {[{platform:"instagram",icon:"📸",label:"Instagram",pts:"+4 pts"},{platform:"facebook",icon:"📘",label:"Facebook",pts:"+3 pts"},{platform:"youtube",icon:"▶️",label:"YouTube",pts:"+3 pts"}].map(soc=>{
              const connected = !!supplier.social[soc.platform];
              return (
                <div key={soc.platform} style={{background:connected?T.greenDim:T.surface,border:`0.5px solid ${connected?"rgba(74,222,128,0.3)":T.border}`,borderRadius:12,padding:"16px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:20}}>{soc.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{soc.label}</div>
                      <div style={{fontSize:10,color:connected?T.green:T.gold}}>{connected?"Connected ✓":`${soc.pts} available`}</div>
                    </div>
                  </div>
                  {connected?(
                    <div>
                      <div style={{fontSize:12,color:T.textMid,marginBottom:8}}>{supplier.social[soc.platform]}</div>
                      <button onClick={()=>update({social:{...supplier.social,[soc.platform]:""}})} style={{padding:"4px 10px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:6,color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Disconnect</button>
                    </div>
                  ):(
                    <input placeholder={soc.platform==="instagram"?"@yourhandle":soc.platform==="facebook"?"YourPageName":"@yourchannel"}
                      style={{width:"100%",padding:"7px 10px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                      onKeyDown={e=>{if(e.key==="Enter"&&e.target.value){update({social:{...supplier.social,[soc.platform]:e.target.value}});onFlash(`✓ ${soc.label} connected`);}}}/>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAGS ── */}
      {section==="tags"&&(
        <div>
          <div style={{fontSize:12,color:T.textDim,marginBottom:16,lineHeight:1.7}}>Tags feed the AI matching engine. Be accurate — over-tagging causes poor matches and AI flags.<br/><span style={{color:T.gold}}>5+ keywords = +5 pts</span></div>
          {[{group:"experience_tags",label:"Experience type",tags:EXP_TAGS,color:T.blue},{group:"traveller_tags",label:"Traveller type",tags:TRAV_TAGS,color:T.purple},{group:"theme_tags",label:"Themes",tags:THEME_TAGS,color:T.gold}].map(sec=>(
            <div key={sec.group} style={{marginBottom:18}}>
              <div style={{fontSize:12,fontWeight:700,color:sec.color,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>{sec.label}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {sec.tags.map(tag=>{
                  const sel=(supplier[sec.group]??[]).includes(tag);
                  return <button key={tag} onClick={()=>update({[sec.group]:sel?(supplier[sec.group]??[]).filter(t=>t!==tag):[...(supplier[sec.group]??[]),tag]})} style={{padding:"4px 12px",borderRadius:20,border:`0.5px solid ${sel?sec.color:T.border}`,background:sel?`${sec.color}18`:"transparent",color:sel?sec.color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?600:400}}>{tag}</button>;
                })}
              </div>
            </div>
          ))}

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textDim,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Keyword tags</div>
            <input value={(supplier.keywords??[]).join(", ")} onChange={e=>update({keywords:e.target.value.split(",").map(t=>t.trim()).filter(Boolean)})}
              placeholder="sand-river, private-concession, big-five, plunge-pool…"
              style={{width:"100%",padding:"9px 12px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            <div style={{fontSize:11,color:(supplier.keywords??[]).length>=5?T.green:T.amber,marginTop:4}}>
              {(supplier.keywords??[]).length} keywords {(supplier.keywords??[]).length<5?`(need ${5-(supplier.keywords??[]).length} more)`:"✓"}
            </div>
          </div>

          <div style={{background:"rgba(167,139,250,0.08)",border:"0.5px solid rgba(167,139,250,0.25)",borderRadius:12,padding:"13px 16px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.purple,marginBottom:4}}>✦ Knowledge Base (+10 pts) — TSE team only</div>
            <div style={{fontSize:12,color:T.textDim,lineHeight:1.6}}>Specialist notes, booking tips, room recommendations, and seasonal advice are added by The Safari Edition team after your content advisor visit. Injected into every AI recommendation. Not editable by suppliers.</div>
          </div>

          <button onClick={()=>{update({});onFlash("✓ Tags saved");}} style={{padding:"9px 20px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:8,color:"#0a0a0a",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save Tags →</button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN REVIEW PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AdminReviewPanel() {
  const [queue, setQueue] = useState(ADMIN_QUEUE);
  const [filter, setFilter] = useState("all");
  const [activeItem, setActiveItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [aiChecking, setAiChecking] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [processed, setProcessed] = useState([]);
  const [showAudit, setShowAudit] = useState(false);

  const pending  = queue.filter(i=>i.status==="pending");
  const approved = queue.filter(i=>i.status==="approved");
  const rejected = queue.filter(i=>i.status==="rejected");
  const filtered = queue.filter(i=>i.status==="pending"&&(filter==="all"||i.type===filter));
  const TYPE_LABELS = {image:"Photos",description:"Descriptions",reel:"Reels",kb:"Knowledge Base"};

  const approve = (id) => { auditLog("approve","status","pending","approved","TSE Admin"); setQueue(q=>q.map(i=>i.id===id?{...i,status:"approved"}:i)); setProcessed(p=>[...p,id]); setActiveItem(null); setAiResult(null); };
  const reject  = (id) => { if(!rejectReason.trim())return; auditLog("reject","status","pending",`rejected: ${rejectReason}`,"TSE Admin"); setQueue(q=>q.map(i=>i.id===id?{...i,status:"rejected",reject_reason:rejectReason}:i)); setProcessed(p=>[...p,id]); setActiveItem(null); setRejectReason(""); setAiResult(null); };

  const runAiCheck = async (item) => {
    setAiChecking(true); setAiResult(null);
    let prompt = "";
    if (item.type==="image") prompt = `Luxury safari content. Image for "${item.supplier_name}", caption:"${item.caption}", ${item.width}×${item.height}px. Min 1200×800. 2-sentence review + APPROVE or REJECT.`;
    else if (item.type==="description") prompt = `Luxury safari content editor. Description for "${item.supplier_name}":\n"${item.body}"\nSpecific, sensory, no generic superlatives? 2 sentences + APPROVE or REJECT.`;
    else if (item.type==="reel") prompt = `Video reel for "${item.supplier_name}", ${item.duration_s}s. Spec: 15–30s. 1-sentence + APPROVE or REJECT.`;
    const r = await haikusCheck(prompt);
    setAiResult(r); setAiChecking(false);
  };

  return (
    <div style={{fontFamily:"Arial,sans-serif",color:T.text}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>Content Review Queue</div>
          <div style={{fontSize:12,color:T.green,marginTop:2}}>TSE Admin — no approval required for your own edits</div>
        </div>
        <button onClick={()=>setShowAudit(v=>!v)} style={{padding:"6px 12px",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📋 Audit ({AUDIT_LOG.length})</button>
      </div>

      {showAudit&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:"14px",marginBottom:16,maxHeight:200,overflowY:"auto"}}>
          <div style={{fontSize:12,fontWeight:700,color:T.gold,marginBottom:8}}>Audit log</div>
          {AUDIT_LOG.length===0?<div style={{fontSize:12,color:T.textDim}}>No admin actions this session.</div>
          :AUDIT_LOG.slice().reverse().map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"130px 90px 1fr",gap:8,padding:"5px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:11}}>
              <div style={{color:T.textDim}}>{new Date(e.ts).toLocaleTimeString("en-ZA")}</div>
              <div style={{color:T.amber,textTransform:"capitalize"}}>{e.action}</div>
              <div style={{color:T.green,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.field}: {e.newVal}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[{label:"Pending",value:pending.length,color:T.amber},{label:"Approved",value:approved.length,color:T.green},{label:"Rejected",value:rejected.length,color:T.red}].map(s=>(
          <div key={s.label} style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:10,padding:"12px 14px"}}>
            <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{s.label}</div>
            <div style={{fontSize:22,fontWeight:700,color:s.color,fontFamily:"'Playfair Display',serif"}}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {["all","image","reel","description"].map(f=>{
          const count = f==="all"?pending.length:queue.filter(i=>i.type===f&&i.status==="pending").length;
          return (
            <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 13px",borderRadius:8,border:`0.5px solid ${filter===f?T.gold:T.border}`,background:filter===f?T.goldDim:"transparent",color:filter===f?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",gap:6,alignItems:"center"}}>
              {f==="all"?"All pending":TYPE_LABELS[f]}
              {count>0&&<span style={{background:filter===f?"rgba(212,175,55,0.25)":"rgba(255,255,255,0.08)",borderRadius:20,padding:"1px 6px",fontSize:10}}>{count}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length===0?(
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:36,textAlign:"center"}}>
          <div style={{fontSize:26,marginBottom:6}}>✓</div>
          <div style={{fontSize:14,color:T.green,fontWeight:700}}>Queue clear</div>
          <div style={{fontSize:12,color:T.textDim,marginTop:3}}>No items pending review.</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(item=>(
            <div key={item.id} style={{background:T.surface,border:`0.5px solid ${activeItem?.id===item.id?T.borderGold:T.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"13px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
                onClick={()=>{setActiveItem(activeItem?.id===item.id?null:item);setAiResult(null);setRejectReason("");}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  {(item.type==="image"||item.type==="reel")&&item.preview&&<img src={item.preview} alt="" style={{width:52,height:38,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
                  <div>
                    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:3}}>
                      <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,background:T.amberDim,border:"0.5px solid rgba(251,191,36,0.3)",color:T.amber,fontWeight:600}}>{TYPE_LABELS[item.type]??item.type}</span>
                      <span style={{fontSize:13,fontWeight:700,color:T.text}}>{item.caption??item.supplier_name}</span>
                    </div>
                    <div style={{fontSize:11,color:T.textDim}}>{item.supplier_name} · {new Date(item.submitted_at).toLocaleDateString("en-ZA",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {item.type==="image"&&(item.width<1200||item.height<800)&&<span style={{fontSize:10,color:T.red,background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:20,padding:"2px 8px"}}>⚠ Low res</span>}
                  {item.type==="reel"&&(item.duration_s<15||item.duration_s>30)&&<span style={{fontSize:10,color:T.red,background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:20,padding:"2px 8px"}}>⚠ Duration</span>}
                  <span style={{fontSize:12,color:T.textDim}}>{activeItem?.id===item.id?"▲":"▼"}</span>
                </div>
              </div>

              {activeItem?.id===item.id&&(
                <div style={{padding:"0 16px 16px",borderTop:`0.5px solid ${T.border}`}}>
                  <div style={{paddingTop:14}}>
                    {item.type==="image"&&(
                      <div style={{marginBottom:14}}>
                        <img src={item.preview} alt={item.caption} style={{width:"100%",maxHeight:280,objectFit:"cover",borderRadius:10,marginBottom:10}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <div style={{background:T.bg,borderRadius:8,padding:"9px 12px"}}><div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",marginBottom:3}}>Caption</div><div style={{fontSize:12,color:T.text}}>{item.caption}</div></div>
                          <div style={{background:T.bg,borderRadius:8,padding:"9px 12px"}}><div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",marginBottom:3}}>Resolution</div><QualBar width={item.width} height={item.height}/></div>
                        </div>
                      </div>
                    )}
                    {item.type==="reel"&&(
                      <div style={{marginBottom:14}}>
                        <img src={item.preview} alt={item.caption} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,marginBottom:10}}/>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                          <div style={{background:T.bg,borderRadius:8,padding:"9px 12px"}}><div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",marginBottom:3}}>Duration</div><div style={{fontSize:12,color:item.duration_s>=15&&item.duration_s<=30?T.green:T.red}}>{item.duration_s}s {item.duration_s>=15&&item.duration_s<=30?"✓":"✗"}</div></div>
                          <div style={{background:T.bg,borderRadius:8,padding:"9px 12px"}}><div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",marginBottom:3}}>Type</div><div style={{fontSize:12,color:T.text}}>{item.reel_type}</div></div>
                        </div>
                      </div>
                    )}
                    {(item.type==="description"||item.type==="kb")&&(
                      <div style={{background:T.bg,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
                        {item.title&&<div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:6}}>{item.title}</div>}
                        <div style={{fontSize:13,color:T.textMid,lineHeight:1.7}}>{item.body}</div>
                        <div style={{fontSize:11,color:T.textDim,marginTop:5}}>{item.body?.split(/\s+/).filter(Boolean).length} words</div>
                      </div>
                    )}

                    <div style={{marginBottom:12}}>
                      <button onClick={()=>runAiCheck(item)} disabled={aiChecking} style={{padding:"5px 12px",background:T.blueDim,border:"0.5px solid rgba(96,165,250,0.3)",borderRadius:7,color:T.blue,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                        {aiChecking?"⟳ Checking…":"✦ AI Haiku Check"}
                      </button>
                      {aiResult&&(
                        <div style={{marginTop:8,background:aiResult.includes("REJECT")?T.redDim:T.greenDim,border:`0.5px solid ${aiResult.includes("REJECT")?"rgba(248,113,113,0.3)":"rgba(74,222,128,0.3)"}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.textMid,lineHeight:1.6}}>
                          <div style={{fontSize:10,fontWeight:700,color:aiResult.includes("REJECT")?T.red:T.green,marginBottom:3}}>{aiResult.includes("REJECT")?"⚠ AI — suggests reject":"✓ AI — suggests approve"}</div>
                          {aiResult}
                        </div>
                      )}
                    </div>

                    <div style={{marginBottom:10}}>
                      <label style={{display:"block",fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Rejection reason (required to reject)</label>
                      <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="e.g. Low resolution — minimum 1200×800px required."
                        style={{width:"100%",padding:"9px 12px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                      <div style={{fontSize:10,color:T.textDim,marginTop:3}}>Sent to supplier automatically.</div>
                    </div>

                    <div style={{display:"flex",gap:10}}>
                      <button onClick={()=>approve(item.id)} style={{padding:"8px 18px",background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:8,color:T.green,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✓ Approve</button>
                      <button onClick={()=>reject(item.id)} disabled={!rejectReason.trim()} style={{padding:"8px 18px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:8,color:T.red,fontSize:13,fontWeight:600,cursor:!rejectReason.trim()?"not-allowed":"pointer",opacity:!rejectReason.trim()?0.45:1,fontFamily:"inherit"}}>✗ Reject</button>
                      <button onClick={()=>{setActiveItem(null);setAiResult(null);setRejectReason("");}} style={{padding:"8px 14px",background:"transparent",border:`0.5px solid ${T.border}`,borderRadius:8,color:T.textDim,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Skip</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {processed.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontSize:12,fontWeight:700,color:T.textDim,marginBottom:10}}>Processed this session</div>
          {queue.filter(i=>processed.includes(i.id)).map(item=>(
            <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",marginBottom:5,background:item.status==="approved"?T.greenDim:T.redDim,border:`0.5px solid ${item.status==="approved"?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.2)"}`,borderRadius:9}}>
              <div style={{fontSize:12,color:T.textMid}}><span style={{fontWeight:700,color:T.text}}>{item.supplier_name}</span> — {item.caption??item.type}</div>
              <StatusPill status={item.status}/>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function ContentCMS() {
  const [mode, setMode] = useState("supplier");

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"Arial,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>

      <div style={{background:T.bg2,borderBottom:`0.5px solid ${T.border}`,padding:"10px 24px",display:"flex",gap:10,alignItems:"center"}}>
        <span style={{fontSize:12,color:T.textDim,marginRight:6}}>View as:</span>
        {[["supplier","Supplier — Content Manager"],["admin","TSE Admin — instant apply"]].map(([id,label])=>(
          <button key={id} onClick={()=>setMode(id)}
            style={{padding:"6px 16px",borderRadius:8,border:`0.5px solid ${mode===id?T.gold:T.border}`,background:mode===id?T.goldDim:"transparent",color:mode===id?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:mode===id?700:400}}>
            {label}
          </button>
        ))}
        {mode==="admin"&&<span style={{fontSize:11,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"2px 9px"}}>✓ No approval needed · all changes logged</span>}
        <span style={{marginLeft:"auto",fontSize:11,color:T.textDim}}>✦ {EDITION_CONFIG.name} · Content CMS v3</span>
      </div>

      <div style={{maxWidth:960,margin:"0 auto",padding:"28px 24px"}}>
        {mode==="supplier"?(
          <SupplierContentPanel uploadedBy="supplier"/>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
            <div>
              <div style={{fontSize:12,fontWeight:700,color:T.gold,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"}}>Edit content — instant apply</div>
              <SupplierContentPanel uploadedBy="admin"/>
            </div>
            <div style={{position:"sticky",top:20}}>
              <div style={{fontSize:12,fontWeight:700,color:T.gold,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"}}>Supplier submission queue</div>
              <AdminReviewPanel/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
