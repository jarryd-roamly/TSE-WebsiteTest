// ─────────────────────────────────────────────────────────────────────────────
// ContentCMS.jsx  —  v4.0
// Changes from v3:
//   - Hero image distortion fixed (absolute positioned img)
//   - YouTube embed popup: paste URL → range slider (5–15s) → speed → save
//   - Playback speed: 0.5x / 0.75x / 1x / 1.25x / 1.5x
//   - Property-level gallery (exterior/common/food — not room-specific)
//   - supplier_type awareness: lodge/camp → rooms; others → gallery only
//   - "Add room" button removed (rate card is source of truth)
//   - Reels accessible directly from Overview tile (no separate tab needed)
//   - Score breakdown shown once only
//   - Flash messages persist 5s
//   - YouTube reel renders as iframe in reel slot
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useCallback } from "react";

const EDITION_CONFIG = { name: "The Safari Edition" };

const T = {
  bg:"#07080f", bg2:"#0d0e1a", surface:"#12142a", surface2:"#1a1c35",
  gold:"#d4af37", goldDim:"rgba(212,175,55,0.10)", borderGold:"rgba(212,175,55,0.28)",
  text:"#f0ede6", textMid:"rgba(240,237,230,0.62)", textDim:"rgba(240,237,230,0.32)",
  border:"rgba(255,255,255,0.07)",
  green:"#4ade80", greenDim:"rgba(74,222,128,0.10)",
  red:"#f87171", redDim:"rgba(248,113,113,0.10)",
  amber:"#fbbf24", amberDim:"rgba(251,191,36,0.10)",
  blue:"#60a5fa", blueDim:"rgba(96,165,250,0.10)",
  purple:"#a78bfa",
};

const SB_URL = "https://tkthsbxuyihoblpcfnml.supabase.co";
const SB_KEY = "sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx";

// Supplier types that have room type tiles
const HAS_ROOMS = ["lodge", "camp", "hotel", "boutique-hotel", "villa", "tented-camp"];

// ── HAIKU ─────────────────────────────────────────────────────────────────────
async function haikusCheck(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await res.json();
    return d?.content?.[0]?.text ?? "Unable to check.";
  } catch { return "AI check unavailable."; }
}

// ── YOUTUBE HELPERS ───────────────────────────────────────────────────────────
function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return null;
}

function buildYouTubeEmbedUrl(videoId, start, end, speed = 1, autoplay = 1) {
  const params = new URLSearchParams({
    start:          Math.floor(start),
    end:            Math.floor(end),
    autoplay:       autoplay,
    mute:           1,
    loop:           1,
    playlist:       videoId,   // required for loop to work
    controls:       0,         // hides play/pause bar
    rel:            0,         // no related videos
    modestbranding: 1,         // removes YouTube logo
    showinfo:       0,         // deprecated but still suppresses some UI
    fs:             0,         // no fullscreen button
    disablekb:      1,         // disable keyboard controls
    iv_load_policy: 3,         // no annotations
    playsinline:    1,
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

// ── CONTENT SCORE ─────────────────────────────────────────────────────────────
// kbCount is internal TSE notes — deliberately excluded from score (suppliers should not see why their score differs)
function calcFullScore(supplier) {
  const desc  = supplier.description ?? "";
  const imgs  = (supplier.images ?? []).filter(i => i.status === "approved");
  const reels = (supplier.reels ?? []).filter(r => r.status === "approved");
  const rooms = supplier.room_types ?? [];
  const soc   = supplier.social ?? {};
  const kw    = supplier.keywords ?? [];

  const wc = desc.split(/\s+/).filter(Boolean).length;
  const descPts  = wc >= 150 ? 15 : wc >= 75 ? 8 : 0;
  const roomsWithDesc = rooms.filter(r => (r.description ?? "").split(/\s+/).filter(Boolean).length >= 100);
  const roomPts  = rooms.length > 0 ? Math.round((roomsWithDesc.length / rooms.length) * 15) : 0;
  const photoPts = imgs.length >= 12 ? 20 : imgs.length >= 6 ? 12 : imgs.length >= 3 ? 6 : 0;
  const reelPts  = reels.length >= 3 ? 25 : reels.length >= 2 ? 20 : reels.length >= 1 ? 10 : 0;
  const socPts   = (soc.instagram ? 4 : 0) + (soc.facebook ? 3 : 0) + (soc.youtube ? 3 : 0);
  const kbPts    = 0; // TSE internal notes excluded from score — suppliers can't see them
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

const EXP_TAGS   = ["big-five","gorilla-trekking","marine","walking-safari","birding","photographic","night-drive","fly-camping","horseback","canoeing","balloon","boat-safari"];
const TRAV_TAGS  = ["honeymoon","family","solo","group","anniversary","first-timer","return-traveller","multi-gen","corporate","celebration"];
const THEME_TAGS = ["conservation","adventure","wellness","cultural","photographic","off-grid","ultra-luxury","community","digital-detox","star-gazing"];

let AUDIT_LOG = [];
function auditLog(action, field, oldVal, newVal, user) {
  AUDIT_LOG.push({ ts: new Date().toISOString(), action, field, oldVal: String(oldVal).slice(0,80), newVal: String(newVal).slice(0,80), user });
}

// ── DEMO DATA ─────────────────────────────────────────────────────────────────
const DEMO_SUPPLIER = {
  id: "sup-singita-boulders",
  name: "Singita Boulders Lodge",
  supplier_type: "lodge",
  region_slug: "kruger-sabi-sand",
  short_tagline: "River-facing suites on the Sand River. Six guests per guide.",
  description: "Singita Boulders Lodge sits above the Sand River in the Sabi Sand Game Reserve. The six riverside suites — each with a private plunge pool and uninterrupted bush views — represent the quiet apex of the African safari experience.",
  images: [
    { id:"img1", url:"https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200", caption:"Aerial view", room_type:"exterior", is_primary:true, order:0, status:"approved", width:1920, height:1080 },
    { id:"img2", url:"https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=1200", caption:"Suite deck", room_type:"suite", is_primary:false, order:1, status:"approved", width:1920, height:1080 },
    { id:"img3", url:"https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1200", caption:"Bush view", room_type:"exterior", is_primary:false, order:2, status:"approved", width:1920, height:1080 },
  ],
  reels: [],
  room_types: [
    { id:"rt1", name:"Boulders Suite", category:"suite", description:"The Boulders Suite is built directly into the granite outcrop above the Sand River. At 120m², the suite features a king bedroom, outdoor shower, private plunge pool, and a wraparound deck where leopards are regularly seen at the river below. North-facing for the best light.", beds:"King", size_sqm:120, max_pax:2, view:"River and bush", images:[] },
    { id:"rt2", name:"River Suite", category:"suite", description:"", beds:"Twin or King", size_sqm:95, max_pax:2, view:"River", images:[] },
  ],
  activities: [
    { id:"act1", name:"Private Bush Walk", type:"activity", description:"A 3-hour guided walk with an armed ranger.", duration:"3 hours · dawn", price_display:"R1,800 per person", is_included:false, images:[] },
  ],
  social:{ instagram:"@singitasabisand", facebook:"", youtube:"" },
  keywords:["big-five","private-reserve","sand-river","sabi-sand","ultra-luxury"],
  experience_tags:["big-five","photographic","walking-safari"],
  traveller_tags:["honeymoon","anniversary"],
  theme_tags:["conservation","off-grid"],
  last_content_update: new Date().toISOString(),
};

const ADMIN_QUEUE = [
  { id:"q1", supplier_name:"Singita Boulders Lodge", supplier_id:"sup-singita-boulders", type:"image", preview:"https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=400", caption:"Dining area", submitted_at:"2026-05-14T09:22:00Z", width:800, height:600, status:"pending" },
  { id:"q2", supplier_name:"Londolozi Tree Camp", supplier_id:"sup-londolozi", type:"description", body:"Singita Boulders is the best lodge in Africa with amazing rooms and fantastic staff.", submitted_at:"2026-05-12T11:00:00Z", status:"pending" },
];

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 72 }) {
  const r = size/2 - 8;
  const circ = 2 * Math.PI * r;
  const fill = (Math.min(score,100)/100) * circ;
  const color = score >= 80 ? T.green : score >= 60 ? T.amber : score >= 40 ? T.gold : T.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dasharray 0.6s ease"}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size/4.2} fontWeight="700" fontFamily="inherit">{score}</text>
    </svg>
  );
}

function DimBar({ label, current, max, locked }) {
  const pct = Math.min((current/max)*100, 100);
  const color = locked ? T.purple : current >= max ? T.green : current > 0 ? T.amber : "rgba(255,255,255,0.07)";
  return (
    <div style={{marginBottom:7}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:11,color:locked?T.purple:T.textMid}}>{label}{locked&&<span style={{fontSize:9,opacity:0.6,marginLeft:4,padding:"1px 5px",background:"rgba(167,139,250,0.1)",borderRadius:4}}> TSE only</span>}</span>
        <span style={{fontSize:11,color:current>=max?T.green:T.textDim}}>{current}/{max}</span>
      </div>
      <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width 0.5s"}}/>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const m = {
    approved:{ bg:T.greenDim, border:"rgba(74,222,128,0.3)", color:T.green, label:"Approved" },
    pending:{ bg:T.amberDim, border:"rgba(251,191,36,0.3)", color:T.amber, label:"Pending" },
    rejected:{ bg:T.redDim, border:"rgba(248,113,113,0.3)", color:T.red, label:"Rejected" },
  };
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
    <button onClick={onClick} title="Edit"
      style={{background:"rgba(212,175,55,0.10)",border:`0.5px solid ${T.borderGold}`,borderRadius:6,padding:small?"2px 5px":"3px 7px",cursor:"pointer",color:T.gold,fontSize:small?9:11,lineHeight:1}}>
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
      {multiline
        ? <textarea ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} rows={6} placeholder={placeholder}
            style={{width:"100%",padding:"10px 12px",background:T.bg2,border:`1px solid ${T.borderGold}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box",resize:"vertical",lineHeight:1.7}}/>
        : <input ref={ref} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={placeholder}
            style={{width:"100%",padding:"8px 10px",background:T.bg2,border:`1px solid ${T.borderGold}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
      }
      {multiline&&minWords&&<div style={{fontSize:10,color:wc>=(minWords??100)?T.green:T.amber,marginTop:3}}>{wc} words {wc<(minWords??100)?`(need ${(minWords??100)-wc} more)`:"✓"}</div>}
      <div style={{display:"flex",gap:8,marginTop:8}}>
        <button onClick={()=>onSave(draft)} style={{padding:"5px 14px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:7,color:"#0a0a0a",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Save</button>
        <button onClick={onCancel} style={{padding:"5px 12px",background:"transparent",border:`0.5px solid ${T.border}`,borderRadius:7,color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUTUBE EMBED POPUP
// Paste URL → scrub → dual-handle range slider (5–15s) → speed → preview → save
// ─────────────────────────────────────────────────────────────────────────────
function YouTubeEmbedPopup({ onSave, onClose, existingReel }) {
  const [url, setUrl] = useState(existingReel?.source === "youtube" ? `https://youtu.be/${existingReel.video_id}` : "");
  const [videoId, setVideoId] = useState(existingReel?.source === "youtube" ? existingReel.video_id : null);
  const [duration, setDuration] = useState(120); // estimated; YouTube API gives real value
  const [start, setStart] = useState(existingReel?.start ?? 0);
  const [end, setEnd] = useState(existingReel?.end ?? 12);
  const [speed, setSpeed] = useState(existingReel?.speed ?? 1);
  const [caption, setCaption] = useState(existingReel?.caption ?? "");
  const [reelType, setReelType] = useState(existingReel?.type ?? "arrival");
  const [dragging, setDragging] = useState(null); // "start" | "end"
  const [previewing, setPreviewing] = useState(false);
  const sliderRef = useRef();
  const previewKey = useRef(0);

  const MIN_CLIP = 5;
  const MAX_CLIP = 15;

  const handleUrlChange = (val) => {
    setUrl(val);
    const id = extractYouTubeId(val);
    setVideoId(id);
    if (id) { setPreviewing(false); setStart(0); setEnd(10); }
  };

  const clipLen = end - start;
  const clipOk = clipLen >= MIN_CLIP && clipLen <= MAX_CLIP;

  // Slider drag logic
  const handleSliderMouseDown = (handle, e) => {
    e.preventDefault();
    setDragging(handle);
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging || !sliderRef.current) return;
      const rect = sliderRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const val = Math.round(pct * duration);
      if (dragging === "start") {
        const newStart = Math.min(val, end - MIN_CLIP);
        setStart(Math.max(0, newStart));
      } else {
        const newEnd = Math.max(val, start + MIN_CLIP);
        setEnd(Math.min(duration, Math.min(newEnd, start + MAX_CLIP)));
      }
    };
    const onUp = () => setDragging(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [dragging, start, end, duration]);

  const startPct = (start / duration) * 100;
  const endPct = (end / duration) * 100;

  const handlePreview = () => { previewKey.current++; setPreviewing(true); };

  const handleSave = () => {
    if (!videoId || !clipOk) return;
    onSave({
      id: existingReel?.id ?? `reel_yt_${Date.now()}`,
      source: "youtube",
      video_id: videoId,
      start, end, speed,
      type: reelType,
      caption: caption || `${reelType} clip`,
      status: "approved",
      duration_s: Math.round(end - start),
    });
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2,"0")}`;
  };

  const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
      <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,width:"100%",maxWidth:680,maxHeight:"90vh",overflowY:"auto"}}>
        {/* Header */}
        <div style={{padding:"18px 20px",borderBottom:`0.5px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:16,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>Embed from YouTube</div>
            <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Paste a YouTube URL · select a 5–15 second clip · set speed</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:T.textDim,fontSize:20,cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        <div style={{padding:"20px"}}>
          {/* URL input */}
          <div style={{marginBottom:20}}>
            <label style={{display:"block",fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>YouTube URL</label>
            <input value={url} onChange={e=>handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
              style={{width:"100%",padding:"10px 12px",background:T.bg,border:`0.5px solid ${videoId?T.borderGold:T.border}`,borderRadius:9,color:T.text,fontSize:13,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            {url && !videoId && <div style={{fontSize:11,color:T.red,marginTop:4}}>⚠ Could not extract YouTube ID — check the URL</div>}
            {videoId && <div style={{fontSize:11,color:T.green,marginTop:4}}>✓ Video ID: {videoId}</div>}
          </div>

          {videoId && (
            <>
              {/* YouTube thumbnail preview */}
              <div style={{marginBottom:20}}>
                <div style={{position:"relative",paddingTop:"56.25%",borderRadius:10,overflow:"hidden",background:T.bg2}}>
                  {previewing ? (
                    <>
                      <iframe
                        key={previewKey.current}
                        src={buildYouTubeEmbedUrl(videoId, start, end, speed, 1)}
                        style={{position:"absolute",inset:0,width:"100%",height:"100%",border:"none"}}
                        allow="autoplay; encrypted-media"
                        allowFullScreen={false}
                      />
                      {/* Transparent overlay: blocks YouTube share/info/branding UI */}
                      <div style={{position:"absolute",inset:0,zIndex:2,background:"transparent",pointerEvents:"none"}} />
                    </>
                  ) : (
                    <img
                      src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                      alt="Video thumbnail"
                      style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}
                    />
                  )}
                </div>
              </div>

              {/* Range slider */}
              <div style={{marginBottom:20}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <label style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Clip range</label>
                  <div style={{fontSize:12,color:clipOk?T.green:T.amber,fontWeight:600}}>
                    {formatTime(start)} → {formatTime(end)} · {Math.round(end-start)}s {clipOk?"✓":`(need ${MIN_CLIP}–${MAX_CLIP}s)`}
                  </div>
                </div>

                {/* Track */}
                <div ref={sliderRef} style={{position:"relative",height:36,cursor:"crosshair",userSelect:"none",padding:"14px 0"}}>
                  {/* Background track */}
                  <div style={{position:"absolute",top:"50%",left:0,right:0,height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,transform:"translateY(-50%)"}}/>
                  {/* Selected range highlight */}
                  <div style={{position:"absolute",top:"50%",left:`${startPct}%`,width:`${endPct-startPct}%`,height:4,background:clipOk?T.gold:T.amber,borderRadius:2,transform:"translateY(-50%)",transition:"background 0.2s"}}/>
                  {/* Start handle */}
                  <div onMouseDown={e=>handleSliderMouseDown("start",e)} onTouchStart={e=>handleSliderMouseDown("start",e)}
                    style={{position:"absolute",top:"50%",left:`${startPct}%`,width:20,height:20,borderRadius:"50%",background:T.gold,border:"2px solid #fff",transform:"translate(-50%,-50%)",cursor:"ew-resize",boxShadow:"0 2px 8px rgba(0,0,0,0.4)",zIndex:2}}>
                    <div style={{position:"absolute",top:-22,left:"50%",transform:"translateX(-50%)",fontSize:10,color:T.gold,fontWeight:700,whiteSpace:"nowrap"}}>{formatTime(start)}</div>
                  </div>
                  {/* End handle */}
                  <div onMouseDown={e=>handleSliderMouseDown("end",e)} onTouchStart={e=>handleSliderMouseDown("end",e)}
                    style={{position:"absolute",top:"50%",left:`${endPct}%`,width:20,height:20,borderRadius:"50%",background:T.gold,border:"2px solid #fff",transform:"translate(-50%,-50%)",cursor:"ew-resize",boxShadow:"0 2px 8px rgba(0,0,0,0.4)",zIndex:2}}>
                    <div style={{position:"absolute",bottom:-22,left:"50%",transform:"translateX(-50%)",fontSize:10,color:T.gold,fontWeight:700,whiteSpace:"nowrap"}}>{formatTime(end)}</div>
                  </div>
                </div>

                {/* Fine-tune inputs */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:8}}>
                  <div>
                    <label style={{fontSize:10,color:T.textDim,display:"block",marginBottom:3}}>Start (seconds)</label>
                    <input type="number" value={start} min={0} max={end - MIN_CLIP}
                      onChange={e=>setStart(Math.max(0,Math.min(Number(e.target.value),end-MIN_CLIP)))}
                      style={{width:"100%",padding:"6px 10px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:10,color:T.textDim,display:"block",marginBottom:3}}>End (seconds)</label>
                    <input type="number" value={end} min={start + MIN_CLIP} max={start + MAX_CLIP}
                      onChange={e=>setEnd(Math.max(start+MIN_CLIP,Math.min(Number(e.target.value),start+MAX_CLIP)))}
                      style={{width:"100%",padding:"6px 10px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                  </div>
                </div>
              </div>

              {/* Playback speed */}
              <div style={{marginBottom:20}}>
                <label style={{fontSize:11,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:8}}>Playback speed</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {SPEEDS.map(s => (
                    <button key={s} onClick={()=>setSpeed(s)}
                      style={{padding:"6px 14px",borderRadius:20,border:`0.5px solid ${speed===s?T.gold:T.border}`,background:speed===s?T.goldDim:"transparent",color:speed===s?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:speed===s?700:400}}>
                      {s}×
                    </button>
                  ))}
                </div>
                <div style={{fontSize:10,color:T.textDim,marginTop:5}}>
                  {speed < 1 ? "Slow motion — good for wildlife detail or landing sequences" : speed > 1 ? "Fast — good for scenery, arrivals, timelapses" : "Normal speed"}
                </div>
              </div>

              {/* Reel type + caption */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                <div>
                  <label style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5}}>Clip type</label>
                  <select value={reelType} onChange={e=>setReelType(e.target.value)}
                    style={{width:"100%",padding:"8px 10px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit"}}>
                    {["arrival","room","activity","wildlife","aerial","dining","spa"].map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5}}>Caption</label>
                  <input value={caption} onChange={e=>setCaption(e.target.value)} placeholder="e.g. Arrival at dusk"
                    style={{width:"100%",padding:"8px 10px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:7,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                </div>
              </div>

              {/* Actions */}
              <div style={{display:"flex",gap:10}}>
                <button onClick={handlePreview}
                  style={{padding:"9px 18px",background:T.blueDim,border:"0.5px solid rgba(96,165,250,0.3)",borderRadius:8,color:T.blue,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                  ▶ Preview clip
                </button>
                <button onClick={handleSave} disabled={!clipOk}
                  style={{padding:"9px 20px",background:clipOk?`linear-gradient(135deg,${T.gold},#f0c040)`:"rgba(255,255,255,0.05)",border:"none",borderRadius:8,color:clipOk?"#0a0a0a":T.textDim,fontSize:13,fontWeight:700,cursor:clipOk?"pointer":"not-allowed",fontFamily:"inherit"}}>
                  Save clip →
                </button>
                <button onClick={onClose}
                  style={{padding:"9px 14px",background:"transparent",border:`0.5px solid ${T.border}`,borderRadius:8,color:T.textDim,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REEL SLOT — shows thumbnail in tile, never autoplays iframe
// iframe only runs inside the popup preview
// ─────────────────────────────────────────────────────────────────────────────
function ReelSlot({ reel, onEmbed, onRemove, isAdmin }) {
  const thumbUrl = reel?.source === "youtube"
    ? `https://img.youtube.com/vi/${reel.video_id}/hqdefault.jpg`
    : null;

  return (
    <div style={{position:"relative",width:"100%",height:"100%",background:T.bg2,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>

      {/* Thumbnail — static image, no iframe in the tile */}
      {thumbUrl ? (
        <img src={thumbUrl} alt="Reel thumbnail"
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      ) : reel?.url ? (
        <video src={reel.url} muted playsInline preload="metadata"
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
      ) : null}

      {/* Dark overlay */}
      {(thumbUrl || reel?.url) && (
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.35)"}}/>
      )}

      {/* Play icon — decorative, shows a reel exists */}
      {reel && (
        <div style={{position:"relative",zIndex:2,width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.45)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontSize:14,marginLeft:3,color:"#fff"}}>▶</span>
        </div>
      )}

      {/* Empty state */}
      {!reel && (
        <>
          <div style={{fontSize:24,marginBottom:6,position:"relative",zIndex:2}}>🎬</div>
          <div style={{fontSize:11,color:T.textDim,textAlign:"center",padding:"0 16px",position:"relative",zIndex:2}}>No reel yet</div>
          <div style={{fontSize:10,color:T.gold,marginTop:4,position:"relative",zIndex:2}}>+20 pts</div>
        </>
      )}

      {/* Embed button — subtle, bottom left */}
      <div style={{position:"absolute",bottom:8,left:8,zIndex:10,display:"flex",gap:5}}>
        <button onClick={onEmbed}
          style={{padding:"3px 9px",background:"rgba(0,0,0,0.65)",border:`0.5px solid ${T.borderGold}`,borderRadius:5,color:T.gold,fontSize:9,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          🎬 {reel ? "Edit" : "Add YouTube clip"}
        </button>
        {reel && onRemove && (
          <button onClick={e=>{e.stopPropagation();onRemove();}}
            style={{padding:"3px 7px",background:"rgba(0,0,0,0.65)",border:"0.5px solid rgba(248,113,113,0.4)",borderRadius:5,color:T.red,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
        )}
      </div>

      {/* Duration + speed badges — top right, minimal */}
      {reel?.source === "youtube" && (
        <div style={{position:"absolute",top:8,right:8,zIndex:10,display:"flex",gap:4}}>
          <span style={{fontSize:9,padding:"2px 5px",background:"rgba(0,0,0,0.65)",borderRadius:20,color:"rgba(255,255,255,0.6)"}}>{Math.round(reel.end-reel.start)}s</span>
          {reel.speed !== 1 && <span style={{fontSize:9,padding:"2px 5px",background:"rgba(0,0,0,0.65)",borderRadius:20,color:T.gold}}>{reel.speed}×</span>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE GALLERY — drag-to-reorder
// ─────────────────────────────────────────────────────────────────────────────
function ImageGallery({ images, onReorder, onRemove, onUpload, onSetPrimary, minTarget=7, maxImages=20, showPrimary=false }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef();

  const handleDragEnter = (i) => {
    if (dragIdx === null || dragIdx === i) return;
    const next = [...images];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved);
    onReorder(next.map((img,idx) => ({...img,order:idx})));
    setDragIdx(i);
  };

  const approved = images.filter(i=>i.status==="approved").length;
  const pending  = images.filter(i=>i.status==="pending").length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:11,color:T.textDim}}>
          <span style={{color:approved>=minTarget?T.green:T.amber,fontWeight:600}}>{approved} approved</span>
          {pending>0&&<span style={{color:T.amber,marginLeft:8}}>{pending} pending</span>}
          <span style={{color:T.textDim,marginLeft:8}}>· target {minTarget}+</span>
        </div>
        <button onClick={()=>inputRef.current?.click()}
          style={{padding:"4px 12px",background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          + Add photos
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>onUpload(Array.from(e.target.files))}/>
      </div>

      {images.length===0 ? (
        <div onClick={()=>inputRef.current?.click()}
          onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
          onDrop={e=>{e.preventDefault();setDragOver(false);onUpload(Array.from(e.dataTransfer.files));}}
          style={{padding:"24px",border:`1.5px dashed ${dragOver?T.gold:T.border}`,borderRadius:10,textAlign:"center",cursor:"pointer",background:dragOver?T.goldDim:"transparent",transition:"all 0.15s"}}>
          <div style={{fontSize:22,marginBottom:5}}>📸</div>
          <div style={{fontSize:12,color:T.textMid}}>Drag photos here or click to select</div>
          <div style={{fontSize:10,color:T.textDim,marginTop:2}}>JPEG · PNG · min 1200×800 · max 20MB</div>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:8}} onDragOver={e=>e.preventDefault()}>
          {images.map((img,i) => (
            <div key={img.id} draggable
              onDragStart={()=>setDragIdx(i)} onDragEnter={()=>handleDragEnter(i)} onDragEnd={()=>setDragIdx(null)}
              style={{position:"relative",borderRadius:8,overflow:"hidden",border:`0.5px solid ${dragIdx===i?T.gold:img.status==="approved"?"rgba(74,222,128,0.25)":T.border}`,cursor:"grab",opacity:dragIdx===i?0.5:1,transition:"opacity 0.15s,border-color 0.15s"}}>
              {/* Thumbnail — FIXED: absolute positioned to prevent distortion */}
              <div style={{position:"relative",paddingTop:"65%",background:T.bg2}}>
                <img src={img.url} alt={img.caption??""} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
                <div style={{position:"absolute",top:3,left:3,fontSize:9,color:"rgba(255,255,255,0.5)",background:"rgba(0,0,0,0.5)",borderRadius:3,padding:"1px 4px",pointerEvents:"none"}}>⠿{i+1}</div>
                {img.is_primary&&showPrimary&&<div style={{position:"absolute",top:3,right:3,fontSize:8,fontWeight:700,background:T.gold,color:"#0a0a0a",borderRadius:20,padding:"2px 5px"}}>★</div>}
              </div>
              <div style={{padding:"5px 7px",background:T.surface}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <StatusPill status={img.status}/>
                  <QualBar width={img.width??0} height={img.height??0}/>
                </div>
                <div style={{fontSize:9,color:T.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:4}}>{img.caption||"No caption"}</div>
                <div style={{display:"flex",gap:4}}>
                  {showPrimary&&!img.is_primary&&onSetPrimary&&(
                    <button onClick={()=>onSetPrimary(img.id)} style={{flex:1,padding:"2px 0",background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:4,color:T.gold,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>★ Primary</button>
                  )}
                  <button onClick={()=>onRemove(img.id)} style={{flex:showPrimary&&!img.is_primary&&onSetPrimary?0:1,padding:"2px 0",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:4,color:T.red,fontSize:9,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
                </div>
              </div>
            </div>
          ))}
          {images.length < maxImages && (
            <div onClick={()=>inputRef.current?.click()}
              onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);onUpload(Array.from(e.dataTransfer.files));}}
              style={{borderRadius:8,border:`1.5px dashed ${dragOver?T.gold:T.border}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:90,cursor:"pointer",background:dragOver?T.goldDim:"transparent",transition:"all 0.15s"}}>
              <div style={{fontSize:18,color:T.textDim}}>+</div>
              <div style={{fontSize:9,color:T.textDim,marginTop:2}}>Add more</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW TILE — hero (fixed), reel slot, tagline, description
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTile({ supplier, scoreData, onUpdate, uploadedBy, onFlash }) {
  const [editing, setEditing] = useState(null);
  const [descChecking, setDescChecking] = useState(false);
  const [descCheckResult, setDescCheckResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showYTPopup, setShowYTPopup] = useState(false);
  const heroImgRef = useRef();
  const isAdmin = uploadedBy === "admin";

  const primaryImg = (supplier.images??[]).find(i=>i.is_primary)??(supplier.images??[])[0];
  const approvedReel = (supplier.reels??[]).find(r=>r.status==="approved");
  const wc = (supplier.description??"").split(/\s+/).filter(Boolean).length;

  const handleSave = (field, value) => {
    if (isAdmin) { auditLog("edit",field,supplier[field]??"",value,"TSE Admin"); onUpdate({[field]:value}); onFlash(`✓ ${field} updated`); }
    else { onUpdate({[field]:value}); onFlash("✓ Submitted for review"); }
    setEditing(null); setDescCheckResult(null);
  };

  const checkDesc = async () => {
    setDescChecking(true); setDescCheckResult(null);
    const r = await haikusCheck(`Luxury safari content editor. Property: "${supplier.name}" (${supplier.region_slug}). Description:\n"${supplier.description}"\n2–3 sentences: Specific, sensory, no generic superlatives? APPROVE or NOTE CONCERNS.`);
    setDescCheckResult(r); setDescChecking(false);
  };

  const handleHeroImage = async (file) => {
    if (!file) return;
    setUploading(true); onFlash("⟳ Uploading hero image…");
    try {
      const fd = new FormData();
      fd.append("file",file); fd.append("supplier_id",supplier.id);
      fd.append("media_type","images"); fd.append("caption","Hero image");
      fd.append("room_type","exterior"); fd.append("is_primary","true");
      fd.append("uploaded_by",uploadedBy);
      const res = await fetch("/api/upload",{method:"POST",body:fd});
      const data = await res.json();
      if (data.success) {
        const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
        const newImg = {id:data.image_id,url:data.url,path:data.path,caption:"Hero image",room_type:"exterior",is_primary:true,order:0,status:isAdmin?"approved":"pending",...dims};
        const updated = (supplier.images??[]).map(i=>({...i,is_primary:false}));
        updated.unshift(newImg);
        onUpdate({images:updated});
        onFlash(isAdmin?"✓ Hero image live":"✓ Hero image uploaded — pending review");
      } else onFlash("✗ "+(data.error??"Upload failed"));
    } catch { onFlash("✗ Upload error"); }
    setUploading(false);
  };

  const handleYTSave = (reel) => {
    const updatedReels = (supplier.reels??[]).filter(r=>r.id!==reel.id);
    updatedReels.unshift(reel);
    onUpdate({reels:updatedReels});
    setShowYTPopup(false);
    onFlash("✓ YouTube clip saved");
  };

  return (
    <>
      {showYTPopup && (
        <YouTubeEmbedPopup
          onSave={handleYTSave}
          onClose={()=>setShowYTPopup(false)}
          existingReel={approvedReel?.source==="youtube"?approvedReel:null}
        />
      )}

      <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,overflow:"hidden",marginBottom:16}}>
        {/* Hero + reel — FIXED heights */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 260px",height:220}}>

          {/* Hero image — fixed distortion */}
          <div style={{position:"relative",overflow:"hidden",background:T.bg2}}>
            {primaryImg
              ? <img src={primaryImg.url} alt={supplier.name} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
              : <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}><div style={{fontSize:32}}>🏕</div><div style={{fontSize:12,color:T.textDim}}>No primary image</div></div>
            }
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(7,8,15,0.92) 0%,rgba(7,8,15,0.12) 50%,transparent 100%)"}}/>
            {/* Change hero button */}
            <div style={{position:"absolute",top:10,left:10}}>
              <button onClick={()=>heroImgRef.current?.click()} disabled={uploading}
                style={{padding:"5px 10px",background:"rgba(0,0,0,0.65)",border:`0.5px solid ${T.borderGold}`,borderRadius:7,color:T.gold,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(8px)"}}>
                {uploading?"⟳":"📸 Change hero"}
              </button>
              <input ref={heroImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleHeroImage(e.target.files[0]);e.target.value="";}}/>
            </div>
            <div style={{position:"absolute",bottom:14,left:16,right:16,display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:19,fontWeight:700,color:"#fff",fontFamily:"'Playfair Display',serif",lineHeight:1.2,textShadow:"0 1px 4px rgba(0,0,0,0.5)"}}>{supplier.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",marginTop:2}}>{supplier.region_slug?.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</div>
              </div>
              <ScoreRing score={scoreData.total} size={54}/>
            </div>
          </div>

          {/* Reel slot */}
          <div style={{borderLeft:`0.5px solid ${T.border}`,overflow:"hidden"}}>
            <ReelSlot
              reel={approvedReel}
              onEmbed={()=>setShowYTPopup(true)}
              onRemove={approvedReel?()=>{onUpdate({reels:(supplier.reels??[]).filter(r=>r.id!==approvedReel.id)});onFlash("✓ Reel removed");}:null}
              isAdmin={isAdmin}
            />
          </div>
        </div>

        {/* Tagline */}
        <div style={{padding:"14px 18px 0",borderTop:`0.5px solid ${T.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Short tagline</span>
            <Pencil onClick={()=>setEditing(editing==="tagline"?null:"tagline")}/>
            {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"1px 7px"}}>instant</span>}
          </div>
          {editing==="tagline"
            ?<InlineEdit value={supplier.short_tagline??""} placeholder="One line — what makes this property unmissable" onSave={v=>handleSave("short_tagline",v)} onCancel={()=>setEditing(null)}/>
            :<div style={{fontSize:13,color:supplier.short_tagline?T.textMid:T.textDim,fontStyle:supplier.short_tagline?"normal":"italic"}}>{supplier.short_tagline||"No tagline — click ✎ to add"}</div>
          }
        </div>

        {/* Description */}
        <div style={{padding:"14px 18px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <span style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Property description</span>
            <Pencil onClick={()=>setEditing(editing==="description"?null:"description")}/>
            <span style={{fontSize:10,color:wc>=150?T.green:T.amber}}>{wc}/150 words</span>
            {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"1px 7px"}}>instant</span>}
          </div>
          {editing==="description" ? (
            <div>
              <InlineEdit value={supplier.description??""} multiline minWords={150}
                placeholder="150+ words. Specific, sensory, original. Names, views, architecture. No generic superlatives."
                onSave={v=>handleSave("description",v)} onCancel={()=>{setEditing(null);setDescCheckResult(null);}}/>
              <button onClick={checkDesc} disabled={descChecking} style={{marginTop:8,padding:"5px 12px",background:T.blueDim,border:"0.5px solid rgba(96,165,250,0.3)",borderRadius:7,color:T.blue,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
                {descChecking?"⟳ Checking…":"✦ AI Haiku Check"}
              </button>
              {descCheckResult&&(
                <div style={{marginTop:8,background:descCheckResult.includes("CONCERNS")?T.amberDim:T.greenDim,border:`0.5px solid ${descCheckResult.includes("CONCERNS")?"rgba(251,191,36,0.3)":"rgba(74,222,128,0.3)"}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.textMid,lineHeight:1.6}}>
                  <div style={{fontSize:10,fontWeight:700,color:descCheckResult.includes("CONCERNS")?T.amber:T.green,marginBottom:3}}>{descCheckResult.includes("CONCERNS")?"⚠ AI note":"✓ Looks good"}</div>
                  {descCheckResult}
                </div>
              )}
            </div>
          ) : (
            <div style={{fontSize:13,color:supplier.description?T.textMid:T.textDim,lineHeight:1.7,fontStyle:supplier.description?"normal":"italic"}}>
              {supplier.description||"No description — click ✎ to add. Minimum 150 words required (+15 pts)"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOM TYPE TILE — with YouTube embed + image gallery
// ─────────────────────────────────────────────────────────────────────────────
function RoomTile({ room, supplierId, onUpdate, onRemove, uploadedBy, onFlash }) {
  const [editingField, setEditingField] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [showYTPopup, setShowYTPopup] = useState(false);
  const isAdmin = uploadedBy === "admin";
  const approvedImgs = (room.images??[]).filter(i=>i.status==="approved").length;
  const wc = (room.description??"").split(/\s+/).filter(Boolean).length;
  const roomReel = room.reel ?? null;

  const handleSave = (field, value) => {
    if (isAdmin) auditLog("edit",`room.${room.id}.${field}`,room[field]??"",value,"TSE Admin");
    onUpdate(room.id,{[field]:value});
    onFlash(isAdmin?`✓ ${room.name} updated`:"✓ Submitted for review");
    setEditingField(null);
  };

  const handleImageUpload = async (files) => {
    onFlash(`⟳ Uploading ${files.length} image(s)…`);
    const uploaded = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file",file); fd.append("supplier_id",supplierId);
        fd.append("media_type","images"); fd.append("caption",file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));
        fd.append("room_type",room.category??room.name); fd.append("is_primary","false");
        fd.append("uploaded_by",uploadedBy);
        const res = await fetch("/api/upload",{method:"POST",body:fd});
        const data = await res.json();
        if (data.success) {
          const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
          uploaded.push({id:data.image_id,url:data.url,path:data.path,caption:file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "),order:(room.images??[]).length+uploaded.length,status:isAdmin?"approved":"pending",...dims});
        }
      } catch(e){console.error(e);}
    }
    if (uploaded.length>0){onUpdate(room.id,{images:[...(room.images??[]),...uploaded]});onFlash(`✓ ${uploaded.length} uploaded`);}
    else onFlash("✗ Upload failed");
  };

  const handleYTSave = (reel) => {
    onUpdate(room.id,{reel});
    setShowYTPopup(false);
    onFlash(`✓ ${room.name} — reel saved`);
  };

  return (
    <>
      {showYTPopup&&<YouTubeEmbedPopup onSave={handleYTSave} onClose={()=>setShowYTPopup(false)} existingReel={roomReel}/>}
      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpanded(e=>!e)}>
          {/* Thumbnail */}
          <div style={{width:52,height:38,borderRadius:7,overflow:"hidden",background:T.bg2,flexShrink:0,position:"relative"}}>
            {room.images?.[0]
              ?<img src={room.images[0].url} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🛏</div>
            }
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{room.name}</div>
            <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{room.beds||"—"} · {room.size_sqm?`${room.size_sqm}m²`:"n/a"} · {room.view||"—"}</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.textDim,marginBottom:1}}>DESC</div><div style={{fontSize:11,fontWeight:700,color:wc>=100?T.green:T.amber}}>{wc}w</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.textDim,marginBottom:1}}>PHOTOS</div><div style={{fontSize:11,fontWeight:700,color:approvedImgs>=7?T.green:T.amber}}>{approvedImgs}/7</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:9,color:T.textDim,marginBottom:1}}>REEL</div><div style={{fontSize:11,fontWeight:700,color:roomReel?"#4ade80":T.textDim}}>{roomReel?"✓":"—"}</div></div>
            <div style={{fontSize:12,color:T.textDim}}>{expanded?"▲":"▼"}</div>
          </div>
        </div>

        {expanded&&(
          <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 16px"}}>
            {/* Metadata */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:14}}>
              {[{key:"beds",label:"Bed type"},{key:"size_sqm",label:"Size m²"},{key:"max_pax",label:"Max guests"},{key:"view",label:"View"}].map(({key,label})=>(
                <div key={key} style={{background:T.bg,borderRadius:8,padding:"8px 10px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                    <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                    <Pencil small onClick={()=>setEditingField(editingField===key?null:key)}/>
                  </div>
                  {editingField===key
                    ?<InlineEdit value={String(room[key]??"")} placeholder={label} onSave={v=>handleSave(key,key==="size_sqm"||key==="max_pax"?Number(v):v)} onCancel={()=>setEditingField(null)}/>
                    :<div style={{fontSize:12,color:room[key]?T.text:T.textDim,fontStyle:room[key]?"normal":"italic"}}>{room[key]||`Add`}</div>
                  }
                </div>
              ))}
            </div>

            {/* Description */}
            <div style={{marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <span style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Description</span>
                <Pencil onClick={()=>setEditingField(editingField==="description"?null:"description")}/>
                <span style={{fontSize:10,color:wc>=100?T.green:T.amber}}>{wc}/100 words</span>
                {isAdmin&&<span style={{fontSize:9,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"1px 6px"}}>instant</span>}
              </div>
              {editingField==="description"
                ?<InlineEdit value={room.description??""} multiline minWords={100} placeholder="100+ words. Bed, size, view, bathroom, private facilities, what makes this room special." onSave={v=>handleSave("description",v)} onCancel={()=>setEditingField(null)}/>
                :<div style={{fontSize:12,color:room.description?T.textMid:T.textDim,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 12px",fontStyle:room.description?"normal":"italic"}}>{room.description||"No description — click ✎ to add. 100+ words required."}</div>
              }
            </div>

            {/* Room reel */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Room tour reel</div>
              <div style={{height:140,borderRadius:10,overflow:"hidden",background:T.bg2}}>
                <ReelSlot reel={roomReel} onEmbed={()=>setShowYTPopup(true)} onRemove={roomReel?()=>{onUpdate(room.id,{reel:null});onFlash("✓ Reel removed");}:null} isAdmin={isAdmin}/>
              </div>
            </div>

            {/* Gallery */}
            <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>
              Room gallery <span style={{textTransform:"none",letterSpacing:0,fontStyle:"italic",fontSize:10,color:T.textDim}}> — drag to reorder · 7+ approved target</span>
            </div>
            <ImageGallery
              images={room.images??[]}
              onReorder={imgs=>onUpdate(room.id,{images:imgs})}
              onRemove={imgId=>onUpdate(room.id,{images:(room.images??[]).filter(i=>i.id!==imgId)})}
              onUpload={handleImageUpload}
              minTarget={7} maxImages={20}
            />

            <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
              <button onClick={()=>onRemove(room.id)} style={{padding:"4px 12px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:7,color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Remove room type</button>
            </div>
          </div>
        )}
      </div>
    </>
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
        fd.append("file",file); fd.append("supplier_id",supplierId);
        fd.append("media_type","images"); fd.append("caption",file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));
        fd.append("room_type","activity"); fd.append("uploaded_by",uploadedBy);
        const res = await fetch("/api/upload",{method:"POST",body:fd});
        const data = await res.json();
        if (data.success){
          const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
          uploaded.push({id:data.image_id,url:data.url,path:data.path,caption:file.name.replace(/\.[^.]+$/,""),order:(activity.images??[]).length+uploaded.length,status:isAdmin?"approved":"pending",...dims});
        }
      } catch(e){console.error(e);}
    }
    if (uploaded.length>0){onUpdate(activity.id,{images:[...(activity.images??[]),...uploaded]});onFlash("✓ Uploaded");}
    else onFlash("✗ Failed");
  };

  return (
    <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,overflow:"hidden",marginBottom:10}}>
      <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}} onClick={()=>setExpanded(e=>!e)}>
        <div style={{width:52,height:38,borderRadius:7,overflow:"hidden",background:T.bg2,flexShrink:0,position:"relative"}}>
          {activity.images?.[0]
            ?<img src={activity.images[0].url} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
            :<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>🏃</div>
          }
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{activity.name}</div>
            <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:T.goldDim,border:`0.5px solid ${T.borderGold}`,color:T.gold}}>Paid add-on</span>
          </div>
          <div style={{fontSize:11,color:T.textDim,marginTop:1}}>{activity.duration} · {activity.price_display}</div>
        </div>
        <div style={{fontSize:12,color:T.textDim}}>{expanded?"▲":"▼"}</div>
      </div>

      {expanded&&(
        <div style={{borderTop:`0.5px solid ${T.border}`,padding:"14px 16px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            {[{key:"duration",label:"Duration"},{key:"price_display",label:"Price"}].map(({key,label})=>(
              <div key={key} style={{background:T.bg,borderRadius:8,padding:"8px 10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</div>
                  <Pencil small onClick={()=>setEditingField(editingField===key?null:key)}/>
                </div>
                {editingField===key
                  ?<InlineEdit value={activity[key]??""} placeholder={label} onSave={v=>handleSave(key,v)} onCancel={()=>setEditingField(null)}/>
                  :<div style={{fontSize:12,color:activity[key]?T.text:T.textDim}}>{activity[key]||`Add ${label.toLowerCase()}`}</div>
                }
              </div>
            ))}
          </div>

          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
              <span style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Description</span>
              <Pencil onClick={()=>setEditingField(editingField==="description"?null:"description")}/>
            </div>
            {editingField==="description"
              ?<InlineEdit value={activity.description??""} multiline placeholder="Describe the activity — what happens, who leads it, what guests experience." onSave={v=>handleSave("description",v)} onCancel={()=>setEditingField(null)}/>
              :<div style={{fontSize:12,color:activity.description?T.textMid:T.textDim,lineHeight:1.7,background:T.bg,borderRadius:8,padding:"10px 12px",fontStyle:activity.description?"normal":"italic"}}>{activity.description||"No description yet"}</div>
            }
          </div>

          <div style={{fontSize:10,color:T.textDim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Activity photos — drag to reorder</div>
          <ImageGallery
            images={activity.images??[]}
            onReorder={imgs=>onUpdate(activity.id,{images:imgs})}
            onRemove={imgId=>onUpdate(activity.id,{images:(activity.images??[]).filter(i=>i.id!==imgId)})}
            onUpload={handleImageUpload}
            minTarget={3} maxImages={10}
          />
          <div style={{marginTop:12,paddingTop:12,borderTop:`0.5px solid ${T.border}`}}>
            <button onClick={()=>onRemove(activity.id)} style={{padding:"4px 12px",background:T.redDim,border:"0.5px solid rgba(248,113,113,0.3)",borderRadius:7,color:T.red,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Remove activity</button>
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

  // Load real supplier from URL
  useEffect(() => {
    // Extract supplier ID from URL — supports both path and query param
    const parts = window.location.pathname.split("/");
    const idx = parts.indexOf("suppliers");
    // Path param: /admin/suppliers/[id]/content
    let supplierId = idx !== -1 ? parts[idx+1] : null;
    // Fallback: query param ?supplier_id=xxx
    if (!supplierId) {
      const qp = new URLSearchParams(window.location.search);
      supplierId = qp.get("supplier_id");
    }
    // UUIDs are 36 chars. Reject obviously wrong values.
    if (!supplierId || supplierId === "[id]" || supplierId === "content" || supplierId.length < 8) {
      setLoading(false);
      setFlash("❌ No supplier ID found in URL. Open this page from a supplier record.");
      return;
    }
    // Primary: filter by id on server. Fallback: fetch all and filter client-side
    // (handles Supabase RLS policies that may block eq. filters with anon key)
    fetch(`${SB_URL}/rest/v1/suppliers?id=eq.${supplierId}&select=*`, {
      headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
    })
    .then(r=>r.json())
    .then(async data => {
      // If server-side filter returned nothing, try fetching all and filtering client-side
      let record = data?.[0];
      if (!record) {
        const allRes = await fetch(`${SB_URL}/rest/v1/suppliers?select=*&order=name.asc&limit=500`, {
          headers:{ apikey:SB_KEY, Authorization:`Bearer ${SB_KEY}` }
        });
        const allData = await allRes.json();
        record = Array.isArray(allData) ? allData.find(s => s.id === supplierId) : null;
      }
      if (record) {
        const s = record;
        // s already assigned as record above
        setSupplier({
          ...DEMO_SUPPLIER,
          id:          s.id,
          name:        s.name         ?? DEMO_SUPPLIER.name,
          supplier_type: s.supplier_type ?? s.property_type ?? "lodge",
          region_slug: s.region_slug  ?? DEMO_SUPPLIER.region_slug,
          short_tagline:       s.short_tagline ?? "",
          description:         s.description  ?? "",
          images:   Array.isArray(s.images)     ? s.images     : [],
          reels:    Array.isArray(s.reels)      ? s.reels      : [],
          room_types: Array.isArray(s.room_types) ? s.room_types : [],
          activities: Array.isArray(s.activities) ? s.activities : [],
          keywords:   s.tags ?? [],
          social:     s.social ?? { instagram:"", facebook:"", youtube:"" },
          experience_tags: s.experience_tags ?? [],
          traveller_tags:  s.traveller_tags  ?? [],
          theme_tags:      s.theme_tags      ?? [],
          last_content_update: s.updated_at ?? null,
        });
      } else {
        // No supplier found — show clear error instead of silently falling back to demo data
        setFlash(`❌ Supplier ID "${supplierId}" not found in Supabase. Check the URL.`);
        setSupplier(prev => ({ ...prev, name: "Supplier not found", id: supplierId }));
      }
    })
    .catch(err => { console.error(err); setFlash("❌ Could not load supplier: " + err.message); })
    .finally(()=>setLoading(false));
  }, []);

  const onFlash = (msg) => { setFlash(msg); setTimeout(()=>setFlash(""),5000); };
  const update = (patch) => {
    setSupplier(s => {
      const updated = {...s, ...patch, last_content_update: new Date().toISOString()};
      // Persist to Supabase immediately — fire and forget with flash on error
      if (updated.id && updated.id !== "sup-singita-boulders") {
        fetch(`${SB_URL}/rest/v1/suppliers?id=eq.${updated.id}`, {
          method: "PATCH",
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify(patch),
        }).then(r => { if (!r.ok) r.text().then(t => setFlash("⚠ Save error: " + t)); })
          .catch(e => setFlash("⚠ Save error: " + e.message));
      }
      return updated;
    });
  };
  const updateRoom = (id,patch) => setSupplier(s=>({...s,room_types:s.room_types.map(r=>r.id===id?{...r,...patch}:r),last_content_update:new Date().toISOString()}));
  const removeRoom = (id) => setSupplier(s=>({...s,room_types:s.room_types.filter(r=>r.id!==id)}));
  const updateActivity = (id,patch) => setSupplier(s=>({...s,activities:s.activities.map(a=>a.id===id?{...a,...patch}:a)}));
  const removeActivity = (id) => setSupplier(s=>({...s,activities:s.activities.filter(a=>a.id!==id)}));
  const addActivity = () => { const id=`act-${Date.now()}`; setSupplier(s=>({...s,activities:[...s.activities,{id,name:"New Activity",type:"activity",description:"",duration:"",price_display:"",is_included:false,images:[]}]})); };

  const scoreData = calcFullScore(supplier);
  const hasRooms = HAS_ROOMS.includes((supplier.supplier_type??"lodge").toLowerCase());

  // Property gallery — images not tied to a specific room
  const propertyImages = (supplier.images??[]).filter(i=>["exterior","common","food-beverage","general",""].includes(i.room_type??""));

  const handlePropertyImageUpload = async (files) => {
    onFlash(`⟳ Uploading ${files.length} image(s)…`);
    const uploaded = [];
    for (const file of files) {
      try {
        const fd = new FormData();
        fd.append("file",file); fd.append("supplier_id",supplier.id);
        fd.append("media_type","images"); fd.append("caption",file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "));
        fd.append("room_type","exterior"); fd.append("is_primary","false");
        fd.append("uploaded_by",uploadedBy);
        const res = await fetch("/api/upload",{method:"POST",body:fd});
        const data = await res.json();
        if (data.success){
          const dims = await new Promise(resolve=>{const img=new window.Image();img.onload=()=>resolve({width:img.naturalWidth,height:img.naturalHeight});img.onerror=()=>resolve({width:0,height:0});img.src=data.url;});
          uploaded.push({id:data.image_id,url:data.url,path:data.path,caption:file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "),room_type:"exterior",is_primary:supplier.images.length===0&&uploaded.length===0,order:(supplier.images??[]).length+uploaded.length,status:isAdmin?"approved":"pending",...dims});
        }
      } catch(e){console.error(e);}
    }
    if (uploaded.length>0){update({images:[...(supplier.images??[]),...uploaded]});onFlash(`✓ ${uploaded.length} uploaded`);}
    else onFlash("✗ Upload failed");
  };

  const SECTIONS = [
    {id:"tiles",  label:"Content Tiles"},
    {id:"social", label:"Social"},
    {id:"tags",   label:"Tags & Keywords"},
  ];

  return (
    <div style={{fontFamily:"Arial,sans-serif",color:T.text}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>{loading?"Loading…":supplier.name}</div>
          <div style={{fontSize:12,color:T.textDim,marginTop:2}}>
            {supplier.region_slug?.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
            {isAdmin&&<span style={{color:T.green,marginLeft:8}}>· TSE Admin — instant apply, audit logged</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
          <ScoreRing score={scoreData.total} size={62}/>
          <div style={{fontSize:9,color:T.textDim}}>Content Score</div>
          <div style={{fontSize:10,fontWeight:700,color:scoreData.total>=90?T.green:scoreData.total>=80?"#4ade80":scoreData.total>=60?T.amber:T.red}}>
            {scoreData.total>=90?"✦ Featured":scoreData.total>=80?"Enhanced":scoreData.total>=60?"Standard":scoreData.total>=40?"Flagged":"Not listed"}
          </div>
        </div>
      </div>

      {/* Score bar — shown once */}
      <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <div style={{fontSize:11,fontWeight:700,color:T.text,marginBottom:10}}>Score breakdown</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px"}}>
          {Object.entries(scoreData.dims).filter(([key,dim])=>!(dim.locked && uploadedBy!=="admin")).map(([key,dim])=>(
            <DimBar key={key} label={dim.label} current={dim.pts} max={dim.max} locked={!!dim.locked}/>
          ))}
        </div>
      </div>

      {loading&&<div style={{fontSize:13,color:T.textDim,padding:"16px 0",textAlign:"center"}}>⟳ Loading supplier data…</div>}
      {flash&&<div style={{background:flash.startsWith("✗")?T.redDim:T.greenDim,border:`0.5px solid ${flash.startsWith("✗")?"rgba(248,113,113,0.3)":"rgba(74,222,128,0.3)"}`,borderRadius:9,padding:"10px 16px",marginBottom:14,fontSize:13,color:flash.startsWith("✗")?T.red:T.green}}>{flash}</div>}

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
          {/* Overview tile */}
          <OverviewTile supplier={supplier} scoreData={scoreData} onUpdate={update} uploadedBy={uploadedBy} onFlash={onFlash}/>

          {/* Property gallery — all supplier types get this */}
          <div style={{marginBottom:10,marginTop:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.text}}>Property Gallery</div>
                <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Exterior, common areas, dining, arrival — not tied to a specific room. Drag to reorder. First approved image becomes the hero.</div>
              </div>
            </div>
            <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:14,padding:"14px 16px"}}>
              <ImageGallery
                images={propertyImages}
                onReorder={imgs=>{
                  const roomImgs = (supplier.images??[]).filter(i=>!["exterior","common","food-beverage","general",""].includes(i.room_type??""));
                  update({images:[...imgs,...roomImgs]});
                }}
                onRemove={imgId=>update({images:(supplier.images??[]).filter(i=>i.id!==imgId)})}
                onUpload={handlePropertyImageUpload}
                onSetPrimary={imgId=>update({images:(supplier.images??[]).map(i=>({...i,is_primary:i.id===imgId}))})}
                minTarget={6} maxImages={30} showPrimary
              />
            </div>
          </div>

          {/* Room types — only for lodge/camp/hotel */}
          {hasRooms&&(
            <>
              <div style={{marginBottom:10,marginTop:20}}>
                <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>Room Types</div>
                <div style={{fontSize:11,color:T.textDim}}>Room types are created in the rate card. Each room needs 100+ word description · 7+ approved photos · reel optional</div>
              </div>
              {supplier.room_types.length===0
                ?<div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"20px",textAlign:"center",fontSize:12,color:T.textDim}}>No room types found. Room types are added via the rate card by the contracts team.</div>
                :supplier.room_types.map(room=>(
                  <RoomTile key={room.id} room={room} supplierId={supplier.id} onUpdate={updateRoom} onRemove={removeRoom} uploadedBy={uploadedBy} onFlash={onFlash}/>
                ))
              }
            </>
          )}

          {/* Activities */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,marginTop:20}}>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>Paid Add-on Activities</div>
              <div style={{fontSize:11,color:T.textDim,marginTop:2}}>Separately-priced only — included activities are part of the lodge rate</div>
            </div>
            <button onClick={addActivity} style={{padding:"5px 14px",background:`linear-gradient(135deg,${T.gold},#f0c040)`,border:"none",borderRadius:8,color:"#0a0a0a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ Add activity</button>
          </div>
          {supplier.activities.length===0
            ?<div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:"20px",textAlign:"center",fontSize:12,color:T.textDim}}>No paid activities added yet.</div>
            :supplier.activities.map(act=>(
              <ActivityTile key={act.id} activity={act} supplierId={supplier.id} onUpdate={updateActivity} onRemove={removeActivity} uploadedBy={uploadedBy} onFlash={onFlash}/>
            ))
          }
        </div>
      )}

      {/* ── SOCIAL ── */}
      {section==="social"&&(
        <div>
          <div style={{fontSize:12,color:T.textDim,marginBottom:16,lineHeight:1.7}}>Read-only connections — we pull content to keep your profile fresh and award score points.<br/><span style={{color:T.gold}}>Instagram +4 · Facebook +3 · YouTube +3</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12}}>
            {[{platform:"instagram",icon:"📸",label:"Instagram",pts:"+4"},{platform:"facebook",icon:"📘",label:"Facebook",pts:"+3"},{platform:"youtube",icon:"▶️",label:"YouTube",pts:"+3"}].map(soc=>{
              const connected = !!supplier.social?.[soc.platform];
              return (
                <div key={soc.platform} style={{background:connected?T.greenDim:T.surface,border:`0.5px solid ${connected?"rgba(74,222,128,0.3)":T.border}`,borderRadius:12,padding:"16px"}}>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:20}}>{soc.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:T.text}}>{soc.label}</div>
                      <div style={{fontSize:10,color:connected?T.green:T.gold}}>{connected?"Connected ✓":`${soc.pts} pts available`}</div>
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
          <div style={{fontSize:12,color:T.textDim,marginBottom:16,lineHeight:1.7}}>Tags feed the AI matching engine. Be accurate — over-tagging causes poor matches.<br/><span style={{color:T.gold}}>5+ keywords = +5 pts</span></div>
          {[{group:"experience_tags",label:"Experience type",tags:EXP_TAGS,color:T.blue},{group:"traveller_tags",label:"Traveller type",tags:TRAV_TAGS,color:T.purple},{group:"theme_tags",label:"Themes",tags:THEME_TAGS,color:T.gold}].map(sec=>(
            <div key={sec.group} style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:sec.color,marginBottom:8,textTransform:"uppercase",letterSpacing:"0.06em"}}>{sec.label}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {sec.tags.map(tag=>{
                  const sel=(supplier[sec.group]??[]).includes(tag);
                  return <button key={tag} onClick={()=>update({[sec.group]:sel?(supplier[sec.group]??[]).filter(t=>t!==tag):[...(supplier[sec.group]??[]),tag]})} style={{padding:"4px 12px",borderRadius:20,border:`0.5px solid ${sel?sec.color:T.border}`,background:sel?`${sec.color}18`:"transparent",color:sel?sec.color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit",fontWeight:sel?600:400}}>{tag}</button>;
                })}
              </div>
            </div>
          ))}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,fontWeight:700,color:T.textDim,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.06em"}}>Keyword tags</div>
            <input value={(supplier.keywords??[]).join(", ")} onChange={e=>update({keywords:e.target.value.split(",").map(t=>t.trim()).filter(Boolean)})}
              placeholder="sand-river, private-concession, big-five, plunge-pool…"
              style={{width:"100%",padding:"9px 12px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            <div style={{fontSize:11,color:(supplier.keywords??[]).length>=5?T.green:T.amber,marginTop:4}}>{(supplier.keywords??[]).length} keywords {(supplier.keywords??[]).length<5?`(need ${5-(supplier.keywords??[]).length} more)`:"✓"}</div>
          </div>
          <div style={{background:"rgba(167,139,250,0.08)",border:"0.5px solid rgba(167,139,250,0.25)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.purple,marginBottom:4}}>✦ Knowledge Base (+10 pts) — TSE team only</div>
            <div style={{fontSize:12,color:T.textDim,lineHeight:1.6}}>Specialist notes, booking tips, room recommendations, and seasonal advice are added by The Safari Edition team. Injected into every AI recommendation. Not editable by suppliers.</div>
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
    let p = "";
    if (item.type==="image") p=`Luxury safari content. Image for "${item.supplier_name}", ${item.width}×${item.height}px. Min 1200×800. Caption: "${item.caption}". 2-sentence review + APPROVE or REJECT.`;
    else if (item.type==="description") p=`Luxury safari content. Description for "${item.supplier_name}":\n"${item.body}"\nSpecific, sensory, no superlatives? 2 sentences + APPROVE or REJECT.`;
    else if (item.type==="reel") p=`Reel for "${item.supplier_name}", ${item.duration_s}s. Spec: 15–30s. APPROVE or REJECT.`;
    const r = await haikusCheck(p);
    setAiResult(r); setAiChecking(false);
  };

  return (
    <div style={{fontFamily:"Arial,sans-serif",color:T.text}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:T.gold,fontFamily:"'Playfair Display',serif"}}>Review Queue</div>
          <div style={{fontSize:12,color:T.green,marginTop:2}}>TSE Admin — your edits are instant. This queue is for supplier submissions.</div>
        </div>
        <button onClick={()=>setShowAudit(v=>!v)} style={{padding:"5px 12px",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.textDim,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>📋 Audit ({AUDIT_LOG.length})</button>
      </div>

      {showAudit&&(
        <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:12,padding:"14px",marginBottom:16,maxHeight:180,overflowY:"auto"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.gold,marginBottom:8}}>Audit log — this session</div>
          {AUDIT_LOG.length===0?<div style={{fontSize:12,color:T.textDim}}>No admin actions yet.</div>
          :AUDIT_LOG.slice().reverse().map((e,i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"120px 80px 1fr",gap:8,padding:"4px 0",borderBottom:`0.5px solid ${T.border}`,fontSize:11}}>
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
          return <button key={f} onClick={()=>setFilter(f)} style={{padding:"6px 13px",borderRadius:8,border:`0.5px solid ${filter===f?T.gold:T.border}`,background:filter===f?T.goldDim:"transparent",color:filter===f?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",display:"flex",gap:6,alignItems:"center"}}>
            {f==="all"?"All pending":TYPE_LABELS[f]}
            {count>0&&<span style={{background:filter===f?"rgba(212,175,55,0.25)":"rgba(255,255,255,0.08)",borderRadius:20,padding:"1px 6px",fontSize:10}}>{count}</span>}
          </button>;
        })}
      </div>

      {filtered.length===0?(
        <div style={{background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:12,padding:32,textAlign:"center"}}>
          <div style={{fontSize:24,marginBottom:6}}>✓</div>
          <div style={{fontSize:14,color:T.green,fontWeight:700}}>Queue clear</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(item=>(
            <div key={item.id} style={{background:T.surface,border:`0.5px solid ${activeItem?.id===item.id?T.borderGold:T.border}`,borderRadius:12,overflow:"hidden"}}>
              <div style={{padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}}
                onClick={()=>{setActiveItem(activeItem?.id===item.id?null:item);setAiResult(null);setRejectReason("");}}>
                <div style={{display:"flex",gap:12,alignItems:"center"}}>
                  {(item.type==="image"||item.type==="reel")&&item.preview&&<img src={item.preview} alt="" style={{width:50,height:36,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
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
                  <span style={{fontSize:12,color:T.textDim}}>{activeItem?.id===item.id?"▲":"▼"}</span>
                </div>
              </div>

              {activeItem?.id===item.id&&(
                <div style={{padding:"0 16px 16px",borderTop:`0.5px solid ${T.border}`}}>
                  <div style={{paddingTop:14}}>
                    {item.type==="image"&&<div style={{marginBottom:14}}><img src={item.preview} alt={item.caption} style={{width:"100%",maxHeight:260,objectFit:"cover",borderRadius:10,marginBottom:10}}/><QualBar width={item.width} height={item.height}/></div>}
                    {(item.type==="description"||item.type==="kb")&&<div style={{background:T.bg,borderRadius:10,padding:"12px 14px",marginBottom:14,fontSize:13,color:T.textMid,lineHeight:1.7}}>{item.body}<div style={{fontSize:11,color:T.textDim,marginTop:5}}>{item.body?.split(/\s+/).filter(Boolean).length} words</div></div>}
                    <div style={{marginBottom:12}}>
                      <button onClick={()=>runAiCheck(item)} disabled={aiChecking} style={{padding:"5px 12px",background:T.blueDim,border:"0.5px solid rgba(96,165,250,0.3)",borderRadius:7,color:T.blue,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{aiChecking?"⟳ Checking…":"✦ AI Haiku Check"}</button>
                      {aiResult&&<div style={{marginTop:8,background:aiResult.includes("REJECT")?T.redDim:T.greenDim,border:`0.5px solid ${aiResult.includes("REJECT")?"rgba(248,113,113,0.3)":"rgba(74,222,128,0.3)"}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:T.textMid,lineHeight:1.6}}>{aiResult}</div>}
                    </div>
                    <div style={{marginBottom:10}}>
                      <input value={rejectReason} onChange={e=>setRejectReason(e.target.value)} placeholder="Rejection reason (required to reject) — sent to supplier"
                        style={{width:"100%",padding:"8px 12px",background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
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
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function ContentCMS() {
  // Determine if the logged-in user is a TSE admin by reading the session.
  // Suppliers NEVER see the toggle — they always get supplier mode.
  // This runs once on mount; no toggle rendered for non-admins.
  const [isTSEAdmin, setIsTSEAdmin] = useState(false);
  const [mode, setMode] = useState("admin"); // default admin since this page is /admin/suppliers/[id]/content

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tse_session") || localStorage.getItem("tse_session");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.type === "edition") {
          setIsTSEAdmin(true);
          setMode("admin");
        } else {
          // Supplier logged in — lock to supplier view, no toggle
          setIsTSEAdmin(false);
          setMode("supplier");
        }
      } else {
        // No session — default to admin mode (this page is under /admin/)
        setIsTSEAdmin(true);
        setMode("admin");
      }
    } catch {
      setIsTSEAdmin(true);
      setMode("admin");
    }
  }, []);

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"Arial,sans-serif"}}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>
      <div style={{background:T.bg2,borderBottom:`0.5px solid ${T.border}`,padding:"10px 24px",display:"flex",gap:10,alignItems:"center"}}>
        {/* Toggle only shown to TSE admins — suppliers never see this */}
        {isTSEAdmin && (
          <>
            <span style={{fontSize:12,color:T.textDim,marginRight:6}}>View as:</span>
            {[["admin","TSE Admin"],["supplier","Supplier Preview"]].map(([id,label])=>(
              <button key={id} onClick={()=>setMode(id)}
                style={{padding:"6px 16px",borderRadius:8,border:`0.5px solid ${mode===id?T.gold:T.border}`,background:mode===id?T.goldDim:"transparent",color:mode===id?T.gold:T.textDim,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:mode===id?700:400}}>
                {label}
              </button>
            ))}
            {mode==="admin"&&<span style={{fontSize:11,color:T.green,background:T.greenDim,border:"0.5px solid rgba(74,222,128,0.3)",borderRadius:20,padding:"2px 9px"}}>✓ Instant apply · audit logged</span>}
            {mode==="supplier"&&<span style={{fontSize:11,color:T.amber,background:T.amberDim,border:"0.5px solid rgba(251,191,36,0.3)",borderRadius:20,padding:"2px 9px"}}>👁 Supplier preview — changes still apply as admin</span>}
          </>
        )}
        <span style={{marginLeft:"auto",fontSize:11,color:T.textDim}}>✦ {EDITION_CONFIG.name} · Content CMS v4</span>
      </div>
      <div style={{maxWidth:980,margin:"0 auto",padding:"28px 24px"}}>
        {mode==="supplier"?(
          <SupplierContentPanel uploadedBy={isTSEAdmin ? "admin" : "supplier"}/>
        ):(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24,alignItems:"start"}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,color:T.gold,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"}}>Edit content — instant apply</div>
              <SupplierContentPanel uploadedBy="admin"/>
            </div>
            <div style={{position:"sticky",top:20}}>
              <div style={{fontSize:11,fontWeight:700,color:T.gold,marginBottom:14,textTransform:"uppercase",letterSpacing:"0.07em"}}>Supplier submission queue</div>
              <AdminReviewPanel/>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
