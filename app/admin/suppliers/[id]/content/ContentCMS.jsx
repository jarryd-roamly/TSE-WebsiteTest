// ─────────────────────────────────────────────────────────────────────────────
// ContentCMS.jsx
// Route (supplier):  /supplier/[id]/content
// Route (admin):     /admin/content
// White-label:       all Edition config comes from EDITION_CONFIG
// AI sense-checks:   claude-haiku-4-5-20251001  (cheap, fast, inline)
// Media storage:     Cloudflare R2 (presigned URL upload)
// DB writes:         Supabase REST (suppliers + knowledge_base tables)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from "react";

// ── EDITION CONFIG (swap per white-label Edition) ────────────────────────────
const EDITION_CONFIG = {
  name: "The Safari Edition",
  primaryColor: "#d4af37",
  accentColor: "#f0c040",
};

// ── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg: "#07080f", bg2: "#0d0e1a", surface: "#12142a", surface2: "#1a1c35",
  gold: "#d4af37", goldDim: "rgba(212,175,55,0.10)", borderGold: "rgba(212,175,55,0.28)",
  text: "#f0ede6", textMid: "rgba(240,237,230,0.62)", textDim: "rgba(240,237,230,0.32)",
  border: "rgba(255,255,255,0.07)",
  green: "#4ade80", greenDim: "rgba(74,222,128,0.10)",
  red: "#f87171", redDim: "rgba(248,113,113,0.10)",
  amber: "#fbbf24", amberDim: "rgba(251,191,36,0.10)",
  blue: "#60a5fa", blueDim: "rgba(96,165,250,0.10)",
  purple: "#a78bfa",
};

// ── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SB_URL = "https://zhkpxmcoklbmpsdcjffb.supabase.co";
const SB_KEY = "sb_publishable_LjKnraC4RwaYLS9F-P-kww_nKljckkn";

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...opts.headers,
    },
    ...opts,
  });
  if (!res.ok) throw new Error(await res.text());
  const t = await res.text();
  return t ? JSON.parse(t) : [];
}

// ── ANTHROPIC HAIKU SENSE-CHECK ──────────────────────────────────────────────
// Uses claude-haiku — cheap, fast. Only for lightweight validation.
async function haikusCheck(prompt) {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return data?.content?.[0]?.text ?? "Unable to check.";
  } catch {
    return "AI check unavailable — proceed with manual review.";
  }
}

// ── CONTENT SCORE CALCULATOR (mirrors SQL function) ──────────────────────────
function calcScore(supplier, kbCount) {
  let s = 0;
  const desc = supplier.description ?? "";
  if (desc.length >= 150) s += 15; else if (desc.length >= 75) s += 8;
  const imgs = supplier.images ?? [];
  if (imgs.length >= 12) s += 20; else if (imgs.length >= 6) s += 12; else if (imgs.length >= 3) s += 6;
  const reels = supplier.reels ?? [];
  if (reels.length >= 3) s += 25; else if (reels.length >= 2) s += 20; else if (reels.length >= 1) s += 10;
  const soc = supplier.social ?? {};
  if (soc.instagram) s += 4; if (soc.facebook) s += 3; if (soc.youtube) s += 3;
  if (kbCount >= 3) s += 10; else if (kbCount >= 1) s += 4;
  const kw = supplier.keywords ?? [];
  if (kw.length >= 5) s += 5; else if (kw.length >= 2) s += 2;
  return Math.min(s, 100);
}

// ── SCORE DIMENSIONS (for progress bars) ────────────────────────────────────
const SCORE_DIMS = [
  { key: "description", label: "Property description", max: 15 },
  { key: "rooms",       label: "Room descriptions",    max: 15 },
  { key: "photography", label: "Photography",          max: 20 },
  { key: "reels",       label: "Video reels",          max: 20 },
  { key: "social",      label: "Social connections",   max: 10 },
  { key: "kb",          label: "Knowledge base",       max: 10 },
  { key: "keywords",    label: "Keywords & tags",      max:  5 },
  { key: "freshness",   label: "Content freshness",    max:  5 },
];

function dimScore(supplier, kbCount) {
  const desc  = supplier.description ?? "";
  const imgs  = supplier.images ?? [];
  const reels = supplier.reels ?? [];
  const soc   = supplier.social ?? {};
  const kw    = supplier.keywords ?? [];
  return {
    description: desc.length >= 150 ? 15 : desc.length >= 75 ? 8 : 0,
    rooms:       0, // placeholder — room_types table
    photography: imgs.length >= 12 ? 20 : imgs.length >= 6 ? 12 : imgs.length >= 3 ? 6 : 0,
    reels:       reels.length >= 3 ? 25 : reels.length >= 2 ? 20 : reels.length >= 1 ? 10 : 0,
    social:      (soc.instagram ? 4 : 0) + (soc.facebook ? 3 : 0) + (soc.youtube ? 3 : 0),
    kb:          kbCount >= 3 ? 10 : kbCount >= 1 ? 4 : 0,
    keywords:    kw.length >= 5 ? 5 : kw.length >= 2 ? 2 : 0,
    freshness:   supplier.last_content_update ? 5 : 0,
  };
}

// ── EXPERIENCE / TRAVELLER / THEME TAGS ─────────────────────────────────────
const EXP_TAGS    = ["big-five","gorilla-trekking","marine","walking-safari","birding","photographic","night-drive","fly-camping","horseback","canoeing","balloon","boat-safari"];
const TRAV_TAGS   = ["honeymoon","family","solo","group","anniversary","first-timer","return-traveller","multi-gen","corporate","celebration"];
const THEME_TAGS  = ["conservation","adventure","wellness","cultural","photographic","off-grid","ultra-luxury","community","digital-detox","star-gazing"];

// ── DEMO / SEED DATA ─────────────────────────────────────────────────────────
const DEMO_SUPPLIER = {
  id: "sup-singita-boulders",
  name: "Singita Boulders Lodge",
  region_slug: "kruger-sabi-sand",
  short_tagline: "River-facing suites on the Sand River. Six guests per guide.",
  description: "Singita Boulders Lodge sits above the Sand River in the Sabi Sand Game Reserve. The six riverside suites — each with a private plunge pool and uninterrupted bush views — represent the quiet apex of the African safari experience. The lodge was built around the boulders that give it its name, and the design feels grown from the landscape rather than imposed upon it.",
  images: [
    { id: "img1", url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=800", caption: "Aerial view", room_type: "exterior", is_primary: true, order: 0, status: "approved", width: 1920, height: 1080 },
    { id: "img2", url: "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800", caption: "Main suite deck", room_type: "suite", is_primary: false, order: 1, status: "approved", width: 1920, height: 1080 },
    { id: "img3", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=800", caption: "Bush view", room_type: "exterior", is_primary: false, order: 2, status: "approved", width: 1920, height: 1080 },
    { id: "img4", url: "https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=800", caption: "Dining area", room_type: "common", is_primary: false, order: 3, status: "pending", width: 800, height: 600 },
    { id: "img5", url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800", caption: "Pool deck", room_type: "suite", is_primary: false, order: 4, status: "pending", width: 1200, height: 800 },
    { id: "img6", url: "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800", caption: "Sundowner setup", room_type: "experience", is_primary: false, order: 5, status: "approved", width: 1920, height: 1080 },
  ],
  reels: [
    { id: "reel1", url: "#", thumbnail: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=400", type: "arrival", caption: "Arrival experience", approved: true, duration_s: 24, status: "approved" },
  ],
  social: { instagram: "@singitasabisand", facebook: "", youtube: "" },
  keywords: ["big-five","private-reserve","sand-river","sabi-sand","ultra-luxury","photography"],
  experience_tags: ["big-five","photographic","walking-safari","night-drive"],
  traveller_tags: ["honeymoon","anniversary","return-traveller"],
  theme_tags: ["conservation","photographic","off-grid"],
  content_score: 52,
  last_content_update: new Date().toISOString(),
};

// Knowledge Base: internal Edition IP only. No supplier access.
// Managed exclusively by The Safari Edition team via /admin/content.

const ADMIN_REVIEW_QUEUE = [
  { id: "q1", supplier_name: "Singita Boulders Lodge", supplier_id: "sup-singita-boulders", type: "image", content_type: "image", preview: "https://images.unsplash.com/photo-1504432842672-1a79f78e4084?w=400", caption: "Dining area", submitted_at: "2026-05-14T09:22:00Z", width: 800, height: 600, status: "pending" },
  { id: "q2", supplier_name: "Singita Boulders Lodge", supplier_id: "sup-singita-boulders", type: "image", content_type: "image", preview: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=400", caption: "Pool deck", submitted_at: "2026-05-14T09:25:00Z", width: 1200, height: 800, status: "pending" },
  { id: "q3", supplier_name: "Londolozi Tree Camp", supplier_id: "sup-londolozi", type: "kb", content_type: "knowledge_base", title: "Best room for leopard viewing", body: "Tree Camp Suite 1 faces the dry riverbed where leopards cross most evenings. Ask for the tracker's radio frequency — guests can monitor sightings from the deck.", submitted_at: "2026-05-13T14:10:00Z", category: "room-tip", status: "pending" },
  { id: "q4", supplier_name: "Singita Boulders Lodge", supplier_id: "sup-singita-boulders", type: "description", content_type: "description", body: "Singita Boulders is the best lodge in Africa with amazing rooms and fantastic staff. The food is great and you'll see lots of animals.", submitted_at: "2026-05-12T11:00:00Z", status: "pending" },
  { id: "q5", supplier_name: "Dulini Lodge", supplier_id: "sup-dulini", type: "reel", content_type: "reel", preview: "https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=400", caption: "Room walkthrough", reel_type: "room", duration_s: 41, submitted_at: "2026-05-11T16:00:00Z", status: "pending" },
];

// ── SMALL SHARED COMPONENTS ──────────────────────────────────────────────────

function ScoreRing({ score, size = 80 }) {
  const r = size / 2 - 8;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? T.green : score >= 60 ? T.amber : score >= 40 ? T.gold : T.red;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={7}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={7}
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} style={{transition:"stroke-dasharray 0.6s ease"}}/>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill={color} fontSize={size/5} fontWeight="700" fontFamily="inherit">{score}</text>
    </svg>
  );
}

function DimBar({ label, current, max }) {
  const pct = Math.min((current / max) * 100, 100);
  const color = current >= max ? T.green : current > 0 ? T.amber : "rgba(255,255,255,0.08)";
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: T.textMid }}>{label}</span>
        <span style={{ fontSize: 11, color: current >= max ? T.green : T.textDim }}>{current}/{max}</span>
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s" }}/>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    approved:    { bg: T.greenDim,  border: "rgba(74,222,128,0.3)",  color: T.green,  label: "Approved" },
    pending:     { bg: T.amberDim,  border: "rgba(251,191,36,0.3)",  color: T.amber,  label: "Pending review" },
    rejected:    { bg: T.redDim,    border: "rgba(248,113,113,0.3)", color: T.red,    label: "Rejected" },
    flagged:     { bg: T.redDim,    border: "rgba(248,113,113,0.3)", color: T.red,    label: "AI flagged" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: s.bg, border: `0.5px solid ${s.border}`, color: s.color, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function QualityIndicator({ width, height, isReel, duration_s }) {
  if (isReel) {
    const ok = duration_s >= 15 && duration_s <= 30;
    return (
      <div style={{ fontSize: 10, color: ok ? T.green : T.red, display: "flex", gap: 4, alignItems: "center" }}>
        <span>{ok ? "✓" : "✗"}</span>
        <span>{duration_s}s {ok ? "(within 15–30s)" : duration_s < 15 ? "(too short — min 15s)" : "(too long — max 30s)"}</span>
      </div>
    );
  }
  const mp = (width * height) / 1_000_000;
  const ok = width >= 1920 && height >= 1080;
  const warn = width >= 1200 && height >= 800;
  const color = ok ? T.green : warn ? T.amber : T.red;
  const label = ok ? "HD+ ✓" : warn ? "Acceptable — recommend upgrading to 1920×1080" : "Low resolution — minimum 1200×800 required";
  return (
    <div style={{ fontSize: 10, color }}>
      {width}×{height}px · {mp.toFixed(1)}MP · {label}
    </div>
  );
}

function AISenseCheck({ result, loading }) {
  if (loading) return (
    <div style={{ background: T.blueDim, border: `0.5px solid rgba(96,165,250,0.3)`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.blue }}>
      ⟳ AI checking…
    </div>
  );
  if (!result) return null;
  const isWarn = result.toLowerCase().includes("concern") || result.toLowerCase().includes("generic") ||
                 result.toLowerCase().includes("vague") || result.toLowerCase().includes("inaccurate") ||
                 result.toLowerCase().includes("mismatch") || result.toLowerCase().includes("unclear");
  return (
    <div style={{ background: isWarn ? T.amberDim : T.greenDim, border: `0.5px solid ${isWarn ? "rgba(251,191,36,0.3)" : "rgba(74,222,128,0.3)"}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: isWarn ? T.amber : T.green, marginBottom: 4 }}>
        {isWarn ? "⚠ AI Haiku — review note" : "✓ AI Haiku — looks good"}
      </div>
      <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>{result}</div>
    </div>
  );
}

function Btn({ label, onClick, variant = "ghost", small = false, disabled = false }) {
  const styles = {
    gold:   { background: `linear-gradient(135deg,${T.gold},${T.accentColor ?? "#f0c040"})`, color: "#0a0a0a", border: "none" },
    ghost:  { background: "transparent", color: T.textMid, border: `0.5px solid ${T.border}` },
    danger: { background: T.redDim, color: T.red, border: `0.5px solid rgba(248,113,113,0.3)` },
    green:  { background: T.greenDim, color: T.green, border: `0.5px solid rgba(74,222,128,0.3)` },
  };
  const s = styles[variant] ?? styles.ghost;
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ ...s, padding: small ? "5px 12px" : "9px 18px", borderRadius: 8, fontSize: small ? 11 : 13, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, fontFamily: "inherit" }}>
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SUPPLIER CONTENT PANEL
// What the supplier sees and interacts with
// ────────────────────────────────────────────────────────────────────────────
function SupplierContentPanel({ uploadedBy = "supplier" }) {
  const [supplier, setSupplier] = useState(DEMO_SUPPLIER);
  const [tab, setTab] = useState("overview");
  const [saved, setSaved] = useState("");

  // Description
  const [descDraft, setDescDraft] = useState(supplier.description);
  const [descChecking, setDescChecking] = useState(false);
  const [descCheckResult, setDescCheckResult] = useState(null);
  const [descSubmitted, setDescSubmitted] = useState(false);

  // Images
  const [dragOver, setDragOver] = useState(false);
  const imgInputRef = useRef(null);

  // Reels
  const [reelDragOver, setReelDragOver] = useState(false);
  const reelInputRef = useRef(null);


  // Social
  const [socialDraft, setSocialDraft] = useState(supplier.social);
  const [socialSaved, setSocialSaved] = useState(false);

  // Tags
  const [tagsDraft, setTagsDraft] = useState({
    experience_tags: [...supplier.experience_tags],
    traveller_tags: [...supplier.traveller_tags],
    theme_tags: [...supplier.theme_tags],
    keywords: [...supplier.keywords],
  });
  const [tagsChecking, setTagsChecking] = useState(false);
  const [tagsCheckResult, setTagsCheckResult] = useState(null);

  // KB score managed server-side by Edition team
  const score = calcScore(supplier, 0);
  const dims = dimScore(supplier, 0);

  const saveFlash = (msg) => { setSaved(msg); setTimeout(() => setSaved(""), 3000); };

  // ── CHECK DESCRIPTION WITH HAIKU ──────────────────────────────────────────
  const checkDescription = async () => {
    setDescChecking(true); setDescCheckResult(null);
    const tags = [...supplier.experience_tags, ...supplier.theme_tags].join(", ");
    const result = await haikusCheck(
      `You are a luxury safari travel content editor. A lodge called "${supplier.name}" in the "${supplier.region_slug}" region has submitted this property description:\n\n"${descDraft}"\n\nTheir declared tags are: ${tags}.\n\nIn 2-3 sentences: Does the description match the tags and region? Is it specific enough (names, features, sensory detail) to be useful for a luxury traveller? Flag anything generic, implausible, or mismatched. Be concise and direct.`
    );
    setDescCheckResult(result);
    setDescChecking(false);
  };

  const submitDescription = () => {
    setSupplier(s => ({ ...s, description: descDraft }));
    setDescSubmitted(true);
    saveFlash("✓ Description submitted for admin review");
  };

  // ── REAL IMAGE UPLOAD — posts to /api/upload → Supabase Storage ────────────
  const handleImageFiles = async (files) => {
    const arr = Array.from(files).slice(0, 20 - supplier.images.length);
    if (arr.length === 0) return;
    saveFlash(`⟳ Uploading ${arr.length} image(s)…`);

    const uploaded = [];
    for (const file of arr) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("supplier_id", supplier.id);
        fd.append("media_type", "images");
        fd.append("caption", file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
        fd.append("room_type", "general");
        fd.append("is_primary", String(supplier.images.length === 0 && uploaded.length === 0));
        fd.append("uploaded_by", uploadedBy);

        const res  = await fetch("/api/upload", { method: "POST", body: fd });
        const data = await res.json();

        if (data.success) {
          // Get image dimensions from the returned URL
          const dims = await getImageDimensions(data.url);
          uploaded.push({
            id:        data.image_id,
            url:       data.url,
            path:      data.path,
            caption:   file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
            room_type: "general",
            is_primary: supplier.images.length === 0 && uploaded.length === 0,
            order:     supplier.images.length + uploaded.length,
            status:    data.status,  // "approved" for admin, "pending" for supplier
            width:     dims.width,
            height:    dims.height,
          });
        } else {
          console.error("Upload failed:", data.error);
        }
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    if (uploaded.length > 0) {
      setSupplier(s => ({ ...s, images: [...s.images, ...uploaded] }));
      saveFlash(`✓ ${uploaded.length} image(s) uploaded — pending admin review`);
    } else {
      saveFlash("✗ Upload failed — please try again");
    }
  };

  // Get image dimensions after upload for quality indicator
  const getImageDimensions = (url) => new Promise((resolve) => {
    const img = new window.Image();
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 0, height: 0 });
    img.src = url;
  });

  const updateImageMeta = async (id, updates) => {
    setSupplier(s => ({ ...s, images: s.images.map(img => img.id === id ? { ...img, ...updates } : img) }));
    try {
      await fetch("/api/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplier.id, file_id: id, updates, media_type: "images" }),
      });
    } catch (err) { console.error("Meta update error:", err); }
  };
  const updateImageCaption  = (id, caption)    => updateImageMeta(id, { caption });
  const updateImageRoomType = (id, room_type)  => updateImageMeta(id, { room_type });

  const removeImage = async (id) => {
    const img = supplier.images.find(i => i.id === id);
    if (img?.path) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supplier_id: supplier.id, file_id: id, file_path: img.path, media_type: "images" }),
        });
      } catch (err) { console.error("Delete error:", err); }
    }
    setSupplier(s => ({ ...s, images: s.images.filter(i => i.id !== id) }));
    saveFlash("✓ Image removed");
  };

  const setPrimary = async (id) => {
    setSupplier(s => ({ ...s, images: s.images.map(img => ({ ...img, is_primary: img.id === id })) }));
    try {
      await fetch("/api/upload", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: supplier.id, file_id: id, updates: { is_primary: true }, media_type: "images" }),
      });
    } catch (err) { console.error("Set primary error:", err); }
  };

  // ── REAL REEL UPLOAD — posts to /api/upload → Supabase Storage ─────────────
  const handleReelFile = async (file) => {
    saveFlash("⟳ Uploading reel…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("supplier_id", supplier.id);
      fd.append("media_type", "reels");
      fd.append("caption", file.name.replace(/\.[^.]+$/, ""));
      fd.append("reel_type", "room");
      fd.append("uploaded_by", uploadedBy);

      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();

      if (data.success) {
        const duration = await getVideoDuration(file);
        setSupplier(s => ({
          ...s,
          reels: [...s.reels, {
            id:         data.reel_id,
            url:        data.url,
            path:       data.path,
            thumbnail:  null,
            type:       "room",
            caption:    file.name.replace(/\.[^.]+$/, ""),
            approved:   false,
            duration_s: Math.round(duration),
            status:     "pending",
          }],
        }));
        saveFlash("✓ Reel uploaded — pending admin review");
      } else {
        saveFlash("✗ Reel upload failed: " + data.error);
      }
    } catch (err) {
      saveFlash("✗ Upload error — please try again");
      console.error(err);
    }
  };

  // Get video duration from file before upload
  const getVideoDuration = (file) => new Promise((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => { URL.revokeObjectURL(video.src); resolve(video.duration); };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });

  // ── CHECK TAGS WITH HAIKU ─────────────────────────────────────────────────
  const checkTags = async () => {
    setTagsChecking(true); setTagsCheckResult(null);
    const result = await haikusCheck(
      `You are a safari content specialist. Review these tags for "${supplier.name}" (${supplier.region_slug}):\n\nExperience tags: ${tagsDraft.experience_tags.join(", ")}\nTraveller tags: ${tagsDraft.traveller_tags.join(", ")}\nTheme tags: ${tagsDraft.theme_tags.join(", ")}\nKeywords: ${tagsDraft.keywords.join(", ")}\nDescription snippet: "${supplier.description.slice(0, 200)}"\n\nIn 2-3 sentences: Are the tags accurate for this property and region? Any tags that seem unlikely or missing? Any contradictions (e.g. "family" + "adults-only")? Be specific.`
    );
    setTagsCheckResult(result);
    setTagsChecking(false);
  };

  const saveTags = () => {
    setSupplier(s => ({ ...s, ...tagsDraft }));
    saveFlash("✓ Tags saved");
  };

    // ── CONNECT SOCIAL ────────────────────────────────────────────────────────
  const connectSocial = (platform) => {
    // In production: OAuth redirect. Here: simulate.
    const handles = { instagram: "@singitaboulders", facebook: "SingitaBoulders", youtube: "SingitaSafaris" };
    setSocialDraft(s => ({ ...s, [platform]: handles[platform] }));
    setSupplier(s => ({ ...s, social: { ...s.social, [platform]: handles[platform] } }));
    saveFlash(`✓ ${platform} connected`);
  };

  const removeSocial = (platform) => {
    setSocialDraft(s => ({ ...s, [platform]: "" }));
    setSupplier(s => ({ ...s, social: { ...s.social, [platform]: "" } }));
  };

  const toggleTag = (group, tag) => {
    setTagsDraft(d => ({
      ...d,
      [group]: d[group].includes(tag) ? d[group].filter(t => t !== tag) : [...d[group], tag],
    }));
  };

  const TAB_LIST = [
    { id: "overview",     label: "Score & Overview" },
    { id: "description",  label: "Description" },
    { id: "photos",       label: `Photos (${supplier.images.length})` },
    { id: "reels",        label: `Reels (${supplier.reels.length}/3)` },
    { id: "social",       label: "Social Links" },
    { id: "tags",         label: "Tags & Keywords" },
  ];

  const ROOM_TYPE_OPTIONS = ["exterior", "suite", "room", "villa", "common", "activity", "experience", "food-beverage"];

  return (
    <div style={{ fontFamily: "Arial,sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display',serif" }}>{supplier.name}</div>
          <div style={{ fontSize: 13, color: T.textDim, marginTop: 3 }}>{supplier.region_slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())} · Content Manager</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <ScoreRing score={score} size={72} />
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>Content Score</div>
        </div>
      </div>

      {saved && (
        <div style={{ background: T.greenDim, border: `0.5px solid rgba(74,222,128,0.3)`, borderRadius: 9, padding: "10px 16px", marginBottom: 16, fontSize: 13, color: T.green }}>
          {saved}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24, borderBottom: `0.5px solid ${T.border}`, paddingBottom: 12 }}>
        {TAB_LIST.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: "7px 14px", borderRadius: 8, border: `0.5px solid ${tab === t.id ? T.gold : T.border}`, background: tab === t.id ? T.goldDim : "transparent", color: tab === t.id ? T.gold : T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>Score breakdown</div>
              {SCORE_DIMS.map(d => (
                <DimBar key={d.key} label={d.label} current={Math.min(dims[d.key] ?? 0, d.max)} max={d.max} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 14 }}>What to do next</div>
              {[
                { done: supplier.description.length >= 150, label: "Property description (150+ words)", pts: "+15 pts", action: "description" },
                { done: supplier.images.filter(i => i.status === "approved").length >= 12, label: "12+ approved photos", pts: "+20 pts", action: "photos" },
                { done: supplier.reels.filter(r => r.status === "approved").length >= 2, label: "2+ approved reels", pts: "+20 pts", action: "reels" },
                { done: !!supplier.social.instagram, label: "Connect Instagram", pts: "+4 pts", action: "social" },
                { done: !!supplier.social.facebook, label: "Connect Facebook", pts: "+3 pts", action: "social" },
                { done: !!supplier.social.youtube, label: "Connect YouTube", pts: "+3 pts", action: "social" },
                { done: false, label: "Knowledge Base — managed by The Safari Edition team", pts: "+10 pts", action: null },
                { done: (supplier.keywords?.length ?? 0) >= 5, label: "5+ keyword tags", pts: "+5 pts", action: "tags" },
              ].map((item, i) => (
                <div key={i} onClick={() => !item.done && item.action && setTab(item.action)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 12px", marginBottom: 6, borderRadius: 9, background: item.done ? T.greenDim : T.surface, border: `0.5px solid ${item.done ? "rgba(74,222,128,0.2)" : T.border}`, cursor: item.done ? "default" : "pointer" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ color: item.done ? T.green : T.textDim, fontSize: 14 }}>{item.done ? "✓" : "○"}</span>
                    <span style={{ fontSize: 12, color: item.done ? T.textMid : T.text }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: item.done ? T.green : T.gold, fontWeight: 700 }}>{item.done ? "Done" : item.pts}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pending items */}
          {(supplier.images.some(i => i.status === "pending") || supplier.reels.some(r => r.status === "pending")) && (
            <div style={{ background: T.amberDim, border: `0.5px solid rgba(251,191,36,0.3)`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 8 }}>⏳ Items awaiting admin review</div>
              <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.7 }}>
                {supplier.images.filter(i => i.status === "pending").length > 0 && <div>• {supplier.images.filter(i => i.status === "pending").length} photo(s) — pending quality review</div>}
                {supplier.reels.filter(r => r.status === "pending").length > 0 && <div>• {supplier.reels.filter(r => r.status === "pending").length} reel(s) — pending review</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DESCRIPTION TAB ──────────────────────────────────────────────── */}
      {tab === "description" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Property Description</div>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
            Minimum 150 words. Must be original (not AI-generated). This text is injected into AI responses for every itinerary that includes your property — make it specific.
          </div>

          <textarea value={descDraft} onChange={e => setDescDraft(e.target.value)} rows={10}
            style={{ width: "100%", padding: "12px 14px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 10, color: T.text, fontSize: 13, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical", lineHeight: 1.7 }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6, marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: descDraft.split(/\s+/).filter(Boolean).length >= 150 ? T.green : T.amber }}>
              {descDraft.split(/\s+/).filter(Boolean).length} words {descDraft.split(/\s+/).filter(Boolean).length < 150 ? `(need ${150 - descDraft.split(/\s+/).filter(Boolean).length} more)` : "✓"}
            </div>
            <div style={{ fontSize: 11, color: T.textDim }}>
              {descDraft.length} characters
            </div>
          </div>

          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, marginBottom: 8 }}>CONTENT RULES</div>
            {[
              { rule: "150+ words", met: descDraft.split(/\s+/).filter(Boolean).length >= 150 },
              { rule: "Original writing (not AI-generated)", met: true },
              { rule: "Mentions specific features (views, architecture, activities)", met: descDraft.includes("river") || descDraft.includes("suite") || descDraft.includes("reserve") },
              { rule: "Avoids generic superlatives ('the best', 'amazing', 'fantastic')", met: !/(the best|amazing|fantastic|incredible|world-class)/i.test(descDraft) },
            ].map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: c.met ? T.green : T.amber, marginBottom: 4 }}>
                <span>{c.met ? "✓" : "⚠"}</span><span style={{ color: c.met ? T.textMid : T.amber }}>{c.rule}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <Btn label="✦ AI Haiku Check" onClick={checkDescription} disabled={descDraft.length < 50} />
            <Btn variant="gold" label="Submit for Review →" onClick={submitDescription} disabled={descDraft.split(/\s+/).filter(Boolean).length < 50 || descSubmitted} />
            {descSubmitted && <span style={{ fontSize: 12, color: T.green, alignSelf: "center" }}>✓ Submitted — awaiting admin approval</span>}
          </div>

          <AISenseCheck result={descCheckResult} loading={descChecking} />
        </div>
      )}

      {/* ── PHOTOS TAB ───────────────────────────────────────────────────── */}
      {tab === "photos" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>Photography</div>
              <div style={{ fontSize: 12, color: T.textDim, marginTop: 2 }}>{supplier.images.filter(i => i.status === "approved").length} approved · {supplier.images.filter(i => i.status === "pending").length} pending review · target: 12+</div>
            </div>
            <div style={{ fontSize: 12, color: supplier.images.length >= 12 ? T.green : T.amber }}>
              {supplier.images.length}/12 minimum
            </div>
          </div>

          {/* Quality standards */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, marginBottom: 8 }}>PHOTO QUALITY STANDARDS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>
              <div>✓ Minimum 1200×800px (recommend 1920×1080+)</div>
              <div>✓ Own photography — no stock images</div>
              <div>✓ No logos, watermarks, or text overlays</div>
              <div>✓ At least 1 image per room type</div>
              <div>✓ Maximum 20 images per property</div>
              <div>✓ JPEG or PNG, max 20MB per file</div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onClick={() => imgInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleImageFiles(e.dataTransfer.files); }}
            style={{ padding: "28px 20px", background: dragOver ? "rgba(212,175,55,0.08)" : T.bg, border: `1.5px dashed ${dragOver ? T.gold : T.border}`, borderRadius: 12, textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "all 0.15s" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
            <div style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>Drag photos here, or click to select</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>JPEG · PNG · Minimum 1200×800px · Max 20MB · Up to 20 images</div>
            <input ref={imgInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImageFiles(e.target.files)} />
          </div>

          {/* Image grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {supplier.images.map(img => (
              <div key={img.id} style={{ background: T.surface, border: `0.5px solid ${img.status === "approved" ? "rgba(74,222,128,0.2)" : img.status === "rejected" ? "rgba(248,113,113,0.2)" : T.border}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Image */}
                <div style={{ position: "relative", paddingTop: "56.25%", background: T.bg2, overflow: "hidden" }}>
                  <img src={img.url} alt={img.caption} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  {img.is_primary && (
                    <div style={{ position: "absolute", top: 8, left: 8, background: T.gold, color: "#0a0a0a", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20 }}>PRIMARY</div>
                  )}
                  <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={img.status} /></div>
                </div>

                {/* Controls */}
                <div style={{ padding: "10px 12px" }}>
                  <QualityIndicator width={img.width} height={img.height} />

                  <input value={img.caption} onChange={e => updateImageCaption(img.id, e.target.value)}
                    placeholder="Caption…"
                    style={{ width: "100%", padding: "6px 8px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 11, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginTop: 8 }} />

                  <select value={img.room_type} onChange={e => updateImageRoomType(img.id, e.target.value)}
                    style={{ width: "100%", padding: "6px 8px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 11, outline: "none", fontFamily: "inherit", marginTop: 6 }}>
                    {ROOM_TYPE_OPTIONS.map(rt => <option key={rt} value={rt}>{rt}</option>)}
                  </select>

                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    {!img.is_primary && (
                      <button onClick={() => setPrimary(img.id)}
                        style={{ flex: 1, padding: "4px", background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 6, color: T.gold, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                        Set primary
                      </button>
                    )}
                    <button onClick={() => removeImage(img.id)}
                      style={{ padding: "4px 8px", background: T.redDim, border: `0.5px solid rgba(248,113,113,0.3)`, borderRadius: 6, color: T.red, fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>
                      ✕
                    </button>
                  </div>

                  {img.status === "rejected" && (
                    <div style={{ marginTop: 8, fontSize: 10, color: T.red, background: T.redDim, borderRadius: 6, padding: "5px 8px" }}>
                      Rejected: Low resolution. Minimum 1200×800px required.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REELS TAB ────────────────────────────────────────────────────── */}
      {tab === "reels" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Video Reels</div>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
            15–30 seconds. Vertical or landscape. 1080p minimum. No heavy editing needed — authentic, handheld footage performs better than over-produced video.
          </div>

          {/* Required reels */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
            {[
              { type: "arrival", label: "Arrival experience", pts: "+8 pts", desc: "Drive-in, first impression, welcome" },
              { type: "room",    label: "Room walkthrough",   pts: "+8 pts", desc: "Layout, bathroom, view, balcony" },
              { type: "activity",label: "Activity highlight", pts: "+8 pts (bonus)", desc: "Game drive, walk, or water activity" },
            ].map(req => {
              const existing = supplier.reels.find(r => r.type === req.type);
              return (
                <div key={req.type} style={{ background: existing ? (existing.status === "approved" ? T.greenDim : T.amberDim) : T.surface, border: `0.5px solid ${existing ? (existing.status === "approved" ? "rgba(74,222,128,0.3)" : "rgba(251,191,36,0.3)") : T.border}`, borderRadius: 12, padding: "14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text, marginBottom: 4 }}>{req.label}</div>
                  <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>{req.desc}</div>
                  {existing ? (
                    <div>
                      <StatusBadge status={existing.status} />
                      <div style={{ marginTop: 6 }}><QualityIndicator isReel duration_s={existing.duration_s} /></div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{req.pts} available</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Quality standards */}
          <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.textDim, marginBottom: 8 }}>REEL QUALITY STANDARDS</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>
              <div>✓ Duration: 15–30 seconds exactly</div>
              <div>✓ Resolution: 1080p minimum (1920×1080)</div>
              <div>✓ No heavy transitions or text overlays</div>
              <div>✓ Natural lighting — no filters</div>
              <div>✓ MP4 or MOV format</div>
              <div>✓ Max 500MB per file</div>
            </div>
          </div>

          {/* Upload zone */}
          <div
            onClick={() => reelInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setReelDragOver(true); }}
            onDragLeave={() => setReelDragOver(false)}
            onDrop={e => { e.preventDefault(); setReelDragOver(false); if (e.dataTransfer.files[0]) handleReelFile(e.dataTransfer.files[0]); }}
            style={{ padding: "28px 20px", background: reelDragOver ? "rgba(212,175,55,0.08)" : T.bg, border: `1.5px dashed ${reelDragOver ? T.gold : T.border}`, borderRadius: 12, textAlign: "center", cursor: "pointer", marginBottom: 20, transition: "all 0.15s" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
            <div style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>Drop reel here, or click to select</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>MP4 · MOV · 1080p minimum · 15–30 seconds · Max 500MB</div>
            <input ref={reelInputRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleReelFile(e.target.files[0]); }} />
          </div>

          {/* Reel cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {supplier.reels.map(reel => (
              <div key={reel.id} style={{ background: T.surface, border: `0.5px solid ${reel.status === "approved" ? "rgba(74,222,128,0.2)" : T.border}`, borderRadius: 12, overflow: "hidden" }}>
                {/* Thumbnail */}
                <div style={{ position: "relative", paddingTop: "56.25%", background: T.bg2 }}>
                  {reel.thumbnail ? (
                    <img src={reel.thumbnail} alt={reel.caption} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 24 }}>🎬</span>
                      <span style={{ fontSize: 10, color: T.textDim }}>Preview pending</span>
                    </div>
                  )}
                  <div style={{ position: "absolute", top: 8, right: 8 }}><StatusBadge status={reel.status} /></div>
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 4 }}>{reel.caption}</div>
                  <QualityIndicator isReel duration_s={reel.duration_s} />
                  <div style={{ marginTop: 6 }}>
                    <select value={reel.type} onChange={e => setSupplier(s => ({ ...s, reels: s.reels.map(r => r.id === reel.id ? { ...r, type: e.target.value } : r) }))}
                      style={{ width: "100%", padding: "5px 8px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 11, outline: "none", fontFamily: "inherit" }}>
                      {["arrival", "room", "activity", "wildlife"].map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SOCIAL TAB ───────────────────────────────────────────────────── */}
      {tab === "social" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Social Media Connections</div>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Read-only connections. We pull your latest content to keep your profile fresh and award Content Score points. We never post on your behalf.</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {[
              { platform: "instagram", icon: "📸", label: "Instagram",        pts: "+4 pts", placeholder: "@yourhandle",     connected: !!supplier.social.instagram, handle: supplier.social.instagram },
              { platform: "facebook",  icon: "📘", label: "Facebook",         pts: "+3 pts", placeholder: "YourPageName",    connected: !!supplier.social.facebook,  handle: supplier.social.facebook  },
              { platform: "youtube",   icon: "▶️", label: "YouTube",          pts: "+3 pts", placeholder: "@yourchannel",    connected: !!supplier.social.youtube,   handle: supplier.social.youtube   },
            ].map(soc => (
              <div key={soc.platform} style={{ background: soc.connected ? T.greenDim : T.surface, border: `0.5px solid ${soc.connected ? "rgba(74,222,128,0.3)" : T.border}`, borderRadius: 12, padding: "18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 22 }}>{soc.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{soc.label}</div>
                      <div style={{ fontSize: 10, color: soc.connected ? T.green : T.gold }}>{soc.connected ? "Connected" : soc.pts + " available"}</div>
                    </div>
                  </div>
                  {soc.connected && <span style={{ fontSize: 20, color: T.green }}>✓</span>}
                </div>

                {soc.connected ? (
                  <div>
                    <div style={{ fontSize: 12, color: T.textMid, marginBottom: 10 }}>{soc.handle}</div>
                    <Btn small variant="danger" label="Disconnect" onClick={() => removeSocial(soc.platform)} />
                  </div>
                ) : (
                  <div>
                    <input value={socialDraft[soc.platform] ?? ""} onChange={e => setSocialDraft(d => ({ ...d, [soc.platform]: e.target.value }))}
                      placeholder={soc.placeholder}
                      style={{ width: "100%", padding: "7px 10px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
                    <Btn small variant="gold" label={`Connect ${soc.label} →`} onClick={() => connectSocial(soc.platform)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAGS TAB ─────────────────────────────────────────────────────── */}
      {tab === "tags" && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 6 }}>Tags & Keywords</div>
          <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
            Tags are injected into the AI matching engine. The Socratic flow uses these to match traveller answers to your property. Be accurate — over-tagging causes poor matches and AI flags.
          </div>

          {[
            { group: "experience_tags", label: "Experience type", tags: EXP_TAGS, color: T.blue },
            { group: "traveller_tags",  label: "Traveller type",  tags: TRAV_TAGS, color: T.purple },
            { group: "theme_tags",      label: "Themes",          tags: THEME_TAGS, color: T.gold },
          ].map(section => (
            <div key={section.group} style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: section.color, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>{section.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {section.tags.map(tag => {
                  const sel = tagsDraft[section.group]?.includes(tag);
                  return (
                    <button key={tag} onClick={() => toggleTag(section.group, tag)}
                      style={{ padding: "4px 12px", borderRadius: 20, border: `0.5px solid ${sel ? section.color : T.border}`, background: sel ? `${section.color}18` : "transparent", color: sel ? section.color : T.textDim, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: sel ? 600 : 400 }}>
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Keywords freeform */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Keyword tags</div>
            <div style={{ fontSize: 11, color: T.textDim, marginBottom: 8 }}>Specific, searchable terms. Min 5 for full score. E.g. "sand-river", "private-concession", "big-five".</div>
            <input value={tagsDraft.keywords.join(", ")} onChange={e => setTagsDraft(d => ({ ...d, keywords: e.target.value.split(",").map(t => t.trim()).filter(Boolean) }))}
              placeholder="sand-river, private-concession, big-five, plunge-pool…"
              style={{ width: "100%", padding: "9px 12px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            <div style={{ fontSize: 11, color: tagsDraft.keywords.length >= 5 ? T.green : T.amber, marginTop: 4 }}>
              {tagsDraft.keywords.length} keywords {tagsDraft.keywords.length < 5 ? `(need ${5 - tagsDraft.keywords.length} more for full score)` : "✓"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <Btn label="✦ AI Haiku Check" onClick={checkTags} />
            <Btn variant="gold" label="Save Tags →" onClick={saveTags} />
          </div>

          <AISenseCheck result={tagsCheckResult} loading={tagsChecking} />
        </div>
      )}

      {/* ── KNOWLEDGE BASE TAB ───────────────────────────────────────────── */}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ADMIN CONTENT REVIEW PANEL
// What the admin sees — review queue, approve/reject, AI sense-check on demand
// ────────────────────────────────────────────────────────────────────────────
function AdminReviewPanel() {
  const [queue, setQueue] = useState(ADMIN_REVIEW_QUEUE);
  const [filter, setFilter] = useState("all");
  const [activeItem, setActiveItem] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [aiChecking, setAiChecking] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [processed, setProcessed] = useState([]);

  const filtered = queue.filter(i => {
    if (filter === "all") return i.status === "pending";
    return i.type === filter && i.status === "pending";
  });

  const pending = queue.filter(i => i.status === "pending");
  const approved = queue.filter(i => i.status === "approved");
  const rejected = queue.filter(i => i.status === "rejected");

  const approve = (id) => {
    setQueue(q => q.map(i => i.id === id ? { ...i, status: "approved" } : i));
    setProcessed(p => [...p, id]);
    setActiveItem(null);
    setAiResult(null);
  };

  const reject = (id) => {
    if (!rejectReason.trim()) return;
    setQueue(q => q.map(i => i.id === id ? { ...i, status: "rejected", reject_reason: rejectReason } : i));
    setProcessed(p => [...p, id]);
    setActiveItem(null);
    setRejectReason("");
    setAiResult(null);
  };

  const runAiCheck = async (item) => {
    setAiChecking(true); setAiResult(null);
    let prompt = "";
    if (item.type === "image") {
      prompt = `You are a luxury safari content approver. An image was submitted for "${item.supplier_name}" with caption "${item.caption}". The image is ${item.width}x${item.height}px. Minimum quality: 1200×800px. Does it meet minimum quality? Is the caption appropriate for a luxury safari property? Give a 2-sentence review and a clear APPROVE or REJECT recommendation.`;
    } else if (item.type === "kb") {
      prompt = `You are a luxury safari Knowledge Base specialist. Review this entry:\n\nSupplier: ${item.supplier_name}\nCategory: ${item.category}\nTitle: "${item.title}"\nBody: "${item.body}"\n\nIs this entry specific enough to be genuinely useful (concrete room numbers, timings, names)? Or is it generic advice that could apply anywhere? 2 sentences + APPROVE or REJECT.`;
    } else if (item.type === "description") {
      prompt = `You are a luxury safari content editor. Review this property description submitted for "${item.supplier_name}":\n\n"${item.body}"\n\nIs it specific, sensory, and appropriate for a luxury audience? Does it avoid generic superlatives? Is it likely original (not AI-generated)? 2 sentences + APPROVE or REJECT.`;
    } else if (item.type === "reel") {
      prompt = `A video reel was submitted for "${item.supplier_name}" — caption: "${item.caption}", type: "${item.reel_type}", duration: ${item.duration_s} seconds. The spec requires 15–30 seconds. Does the duration pass? Give a 1-sentence comment and APPROVE or REJECT based solely on spec compliance.`;
    }
    const result = await haikusCheck(prompt);
    setAiResult(result);
    setAiChecking(false);
  };

  const TYPE_LABELS = { image: "Photos", kb: "Knowledge Base", description: "Descriptions", reel: "Reels" };

  return (
    <div style={{ fontFamily: "Arial,sans-serif", color: T.text }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display',serif", marginBottom: 4 }}>Content Review Queue</div>
        <div style={{ fontSize: 13, color: T.textDim }}>Admin · {EDITION_CONFIG.name}</div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Pending review", value: pending.length, color: T.amber },
          { label: "Approved today", value: approved.length, color: T.green },
          { label: "Rejected today", value: rejected.length, color: T.red },
        ].map(s => (
          <div key={s.label} style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: "'Playfair Display',serif" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "image", "reel", "kb", "description"].map(f => {
          const count = f === "all" ? pending.length : queue.filter(i => i.type === f && i.status === "pending").length;
          return (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "7px 14px", borderRadius: 8, border: `0.5px solid ${filter === f ? T.gold : T.border}`, background: filter === f ? T.goldDim : "transparent", color: filter === f ? T.gold : T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit", display: "flex", gap: 6, alignItems: "center" }}>
              {f === "all" ? "All pending" : TYPE_LABELS[f]}
              {count > 0 && <span style={{ background: filter === f ? "rgba(212,175,55,0.25)" : "rgba(255,255,255,0.08)", borderRadius: 20, padding: "1px 6px", fontSize: 10 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 15, color: T.green, fontWeight: 700 }}>Queue clear</div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>No {filter === "all" ? "" : TYPE_LABELS[filter] + " "}items pending review.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(item => (
            <div key={item.id} style={{ background: T.surface, border: `0.5px solid ${activeItem?.id === item.id ? T.borderGold : T.border}`, borderRadius: 12, overflow: "hidden" }}>
              {/* Item header */}
              <div style={{ padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                onClick={() => { setActiveItem(activeItem?.id === item.id ? null : item); setAiResult(null); setRejectReason(""); }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  {(item.type === "image" || item.type === "reel") && item.preview && (
                    <img src={item.preview} alt="" style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                  )}
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 20, background: T.amberDim, border: "0.5px solid rgba(251,191,36,0.3)", color: T.amber, fontWeight: 600 }}>
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>
                        {item.title ?? item.caption ?? item.type}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: T.textDim }}>
                      {item.supplier_name} · {new Date(item.submitted_at).toLocaleDateString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {/* Quick quality flags */}
                  {item.type === "image" && (item.width < 1200 || item.height < 800) && (
                    <span style={{ fontSize: 10, color: T.red, background: T.redDim, border: "0.5px solid rgba(248,113,113,0.3)", borderRadius: 20, padding: "2px 8px" }}>⚠ Low res</span>
                  )}
                  {item.type === "reel" && (item.duration_s < 15 || item.duration_s > 30) && (
                    <span style={{ fontSize: 10, color: T.red, background: T.redDim, border: "0.5px solid rgba(248,113,113,0.3)", borderRadius: 20, padding: "2px 8px" }}>⚠ Duration</span>
                  )}
                  <span style={{ fontSize: 12, color: T.textDim }}>{activeItem?.id === item.id ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded review panel */}
              {activeItem?.id === item.id && (
                <div style={{ padding: "0 18px 18px", borderTop: `0.5px solid ${T.border}` }}>
                  <div style={{ paddingTop: 16 }}>

                    {/* Image preview */}
                    {item.type === "image" && (
                      <div style={{ marginBottom: 16 }}>
                        <img src={item.preview} alt={item.caption} style={{ width: "100%", maxHeight: 320, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Caption</div>
                            <div style={{ fontSize: 12, color: T.text }}>{item.caption}</div>
                          </div>
                          <div style={{ background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Resolution</div>
                            <QualityIndicator width={item.width} height={item.height} />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Reel preview */}
                    {item.type === "reel" && (
                      <div style={{ marginBottom: 16 }}>
                        <img src={item.preview} alt={item.caption} style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Duration</div>
                            <QualityIndicator isReel duration_s={item.duration_s} />
                          </div>
                          <div style={{ background: T.bg, borderRadius: 8, padding: "10px 12px" }}>
                            <div style={{ fontSize: 9, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>Type</div>
                            <div style={{ fontSize: 12, color: T.text }}>{item.reel_type}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* KB / description preview */}
                    {(item.type === "kb" || item.type === "description") && (
                      <div style={{ background: T.bg, borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
                        {item.title && <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>{item.title}</div>}
                        {item.category && <div style={{ fontSize: 10, color: T.purple, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{item.category.replace(/-/g, " ")}</div>}
                        <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7 }}>{item.body}</div>
                        <div style={{ marginTop: 8, fontSize: 11, color: T.textDim }}>{item.body?.split(/\s+/).filter(Boolean).length} words</div>
                      </div>
                    )}

                    {/* AI Check */}
                    <div style={{ marginBottom: 16 }}>
                      <Btn label="✦ AI Haiku Check" onClick={() => runAiCheck(item)} disabled={aiChecking} />
                      <AISenseCheck result={aiResult} loading={aiChecking} />
                    </div>

                    {/* Reject reason */}
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: "block", fontSize: 10, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5 }}>Rejection reason (required to reject)</label>
                      <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Low resolution — minimum 1200×800px required. Please re-upload at full resolution."
                        style={{ width: "100%", padding: "9px 12px", background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 12, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
                      <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>Rejection reason is sent to the supplier automatically.</div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 10 }}>
                      <Btn variant="green" label="✓ Approve" onClick={() => approve(item.id)} />
                      <Btn variant="danger" label="✗ Reject" onClick={() => reject(item.id)} disabled={!rejectReason.trim()} />
                      <Btn label="Skip" onClick={() => { setActiveItem(null); setAiResult(null); setRejectReason(""); }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Processed items */}
      {processed.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.textDim, marginBottom: 12 }}>Processed this session</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {queue.filter(i => processed.includes(i.id)).map(item => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", background: item.status === "approved" ? T.greenDim : T.redDim, border: `0.5px solid ${item.status === "approved" ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)"}`, borderRadius: 10 }}>
                <div style={{ fontSize: 12, color: T.textMid }}>
                  <span style={{ fontWeight: 700, color: T.text }}>{item.supplier_name}</span> — {item.title ?? item.caption ?? item.type}
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ROOT EXPORT — toggle between Supplier and Admin view
// ────────────────────────────────────────────────────────────────────────────
export default function ContentCMS() {
  const [mode, setMode] = useState("supplier");

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "Arial, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet" />

      {/* Mode switcher */}
      <div style={{ background: T.bg2, borderBottom: `0.5px solid ${T.border}`, padding: "10px 24px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: T.textDim, marginRight: 6 }}>View as:</span>
        {[["supplier", "Supplier (Content Manager)"], ["admin", "Admin (Review Queue)"]].map(([id, label]) => (
          <button key={id} onClick={() => setMode(id)}
            style={{ padding: "6px 16px", borderRadius: 8, border: `0.5px solid ${mode === id ? T.gold : T.border}`, background: mode === id ? T.goldDim : "transparent", color: mode === id ? T.gold : T.textDim, fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: mode === id ? 700 : 400 }}>
            {label}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 11, color: T.textDim }}>✦ {EDITION_CONFIG.name} · Content CMS</span>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 24px" }}>
        {mode === "supplier" ? <SupplierContentPanel uploadedBy={mode === "admin" ? "admin" : "supplier"} /> : <AdminReviewPanel />}
      </div>
    </div>
  );
}
