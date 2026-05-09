'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// THE TRAVEL CATALOGUE — Website Builder v2
// Route:  /admin/content/builder
// Single file. Replace entire contents of page.tsx with this.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── TYPES ────────────────────────────────────────────────────────────────────

type BlockType = 'nav'|'hero'|'text'|'image'|'gallery'|'reel'|'cta'|'journeys'|'testimonial'|'trust'|'form'|'footer'|'spacer'|'columns';
type DeviceMode = 'desktop'|'tablet'|'mobile';
type TextAlign  = 'left'|'center'|'right';
type PageStatus = 'live'|'draft';
type FontWeight = 'normal'|'bold';
type ImgFilter  = 'none'|'warm'|'cool'|'bw'|'fade'|'vivid'|'dark';

interface Column {
  id: string;
  width: number;
  type: 'text'|'image'|'video';
  heading: string;
  body: string;
  imgUrl: string;
  imgFilter: ImgFilter;
}

interface Block {
  id: string;
  type: BlockType;
  heading: string;
  body: string;
  btnLabel: string;
  btnLink: string;
  btnLabel2: string;
  btnLink2: string;
  imgUrl: string;
  imgFilter: ImgFilter;
  bg: string;
  textColor: string;
  align: TextAlign;
  paddingY: number;
  paddingX: number;
  fontSize: number;
  fontWeight: FontWeight;
  showDesktop: boolean;
  showMobile: boolean;
  published: boolean;
  analyticsTag: string;
  smartLink: string;
  columns: Column[];
  imgWidth: number;
  imgHeight: number;
}

interface Page {
  id: string;
  slug: string;
  label: string;
  icon: string;
  status: PageStatus;
  blocks: Block[];
  versions: Version[];
}

interface Version {
  id: string;
  num: number;
  when: string;
  who: string;
  blocks: Block[];
}

interface Theme {
  name: string;
  tagline: string;
  primary: string;
  bg: string;
  font: string;
  email: string;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const GOLD   = '#d4af37';
const DARK   = '#080818';
const CARD   = '#12122a';
const PANEL  = '#0d0d20';
const BORDER = 'rgba(255,255,255,0.08)';
const MUTED  = 'rgba(255,255,255,0.35)';
const SERIF  = "'Playfair Display', Georgia, serif";
const SANS   = "'DM Sans', system-ui, sans-serif";

const DEFAULT_THEME: Theme = {
  name: 'The Safari Edition',
  tagline: 'Crafted journeys. Confirmed in seconds.',
  primary: GOLD, bg: DARK, font: SERIF, email: 'hello@thesafariedition.com',
};

const GOOGLE_FONTS = [
  { label:'Playfair Display', value:"'Playfair Display', Georgia, serif" },
  { label:'Georgia',          value:'Georgia, serif' },
  { label:'Garamond',         value:'Garamond, serif' },
  { label:'DM Sans',          value:"'DM Sans', sans-serif" },
  { label:'Montserrat',       value:'Montserrat, sans-serif' },
  { label:'Raleway',          value:'Raleway, sans-serif' },
];

const PALETTE = [
  '#d4af37','#c9a84c','#b8860b','#c0392b','#e74c3c',
  '#1a3a5c','#2980b9','#2e7d52','#27ae60','#7b5ea7',
  '#8e44ad','#e67e22','#e8a020','#2c3e50','#34495e',
];

const BG_SWATCHES = [
  { c:DARK,        l:'Deep Night'  },
  { c:'#12122a',   l:'Card Dark'   },
  { c:'#fdf8ec',   l:'Warm Cream'  },
  { c:'#f8f5ef',   l:'Sand'        },
  { c:'#ffffff',   l:'White'       },
  { c:'#f0f0f0',   l:'Light Grey'  },
  { c:'transparent', l:'None'      },
];

const IMG_FILTERS: { id: ImgFilter; label: string; css: string }[] = [
  { id:'none',  label:'None',  css:'none' },
  { id:'warm',  label:'Warm',  css:'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id:'cool',  label:'Cool',  css:'hue-rotate(20deg) saturate(0.9) brightness(1.05)' },
  { id:'bw',    label:'B&W',   css:'grayscale(1)' },
  { id:'fade',  label:'Fade',  css:'opacity(0.75) grayscale(0.3) brightness(1.1)' },
  { id:'vivid', label:'Vivid', css:'saturate(1.8) contrast(1.1)' },
  { id:'dark',  label:'Dark',  css:'brightness(0.65) contrast(1.1)' },
];

const BLOCK_DEFS: { type: BlockType; label: string; icon: string; cat: string; bg: string }[] = [
  { type:'nav',         label:'Navigation',       icon:'☰',  cat:'structure', bg:DARK        },
  { type:'footer',      label:'Footer',           icon:'⊟',  cat:'structure', bg:DARK        },
  { type:'spacer',      label:'Spacer',           icon:'↕',  cat:'structure', bg:'transparent'},
  { type:'hero',        label:'Hero Banner',      icon:'🌅', cat:'hero',      bg:DARK        },
  { type:'cta',         label:'CTA Banner',       icon:'✦',  cat:'hero',      bg:DARK        },
  { type:'text',        label:'Text Block',       icon:'T',  cat:'content',   bg:'#ffffff'   },
  { type:'columns',     label:'Two Column',       icon:'⊞',  cat:'content',   bg:'#ffffff'   },
  { type:'testimonial', label:'Testimonial',      icon:'❝',  cat:'content',   bg:'#fdf8ec'   },
  { type:'trust',       label:'Trust Badges',     icon:'✓',  cat:'content',   bg:'#ffffff'   },
  { type:'form',        label:'Contact Form',     icon:'✉',  cat:'content',   bg:'#ffffff'   },
  { type:'image',       label:'Image',            icon:'🖼', cat:'media',     bg:'transparent'},
  { type:'gallery',     label:'Gallery',          icon:'▦',  cat:'media',     bg:'#ffffff'   },
  { type:'reel',        label:'Reel / Video',     icon:'▶',  cat:'media',     bg:DARK        },
  { type:'journeys',    label:'Curated Journeys', icon:'🧳', cat:'travel',    bg:'#fafaf8'   },
];

const SMART_LINKS = [
  { label:'None', value:'' },
  { label:'→ Experience Designer (/plan)', value:'/plan' },
  { label:'→ Curated Journeys (/journeys)', value:'/journeys' },
  { label:'→ Inspire Me (/plan/inspire)', value:'/plan/inspire' },
  { label:'→ Contact (/contact)', value:'/contact' },
  { label:'→ About (/about)', value:'/about' },
];

const TEMPLATES = [
  { id:'safari',    name:'Safari Dark',    desc:'Dark · Gold · Editorial', primary:GOLD,      bg:DARK,      types:['nav','hero','trust','text','journeys','reel','testimonial','cta','footer'] as BlockType[] },
  { id:'island',    name:'Island Light',   desc:'Light · Navy · Minimal',  primary:'#1a3a5c', bg:'#f8f5ef', types:['nav','hero','trust','journeys','testimonial','cta','footer'] as BlockType[] },
  { id:'editorial', name:'Euro Editorial', desc:'White · Black · Magazine', primary:'#111',   bg:'#ffffff', types:['nav','hero','text','gallery','testimonial','cta','footer'] as BlockType[] },
  { id:'emerald',   name:'Emerald Forest', desc:'Green · Nature · Deep',   primary:'#90c060', bg:'#1a3a1a', types:['nav','hero','journeys','reel','cta','footer'] as BlockType[] },
  { id:'cape',      name:'Cape Bold',      desc:'Sand · Red · Vibrant',    primary:'#c0392b', bg:'#f5f0e8', types:['nav','hero','trust','journeys','testimonial','cta','footer'] as BlockType[] },
  { id:'blank',     name:'Blank Canvas',   desc:'Start from scratch',      primary:GOLD,      bg:'#fff',    types:[] as BlockType[] },
];

const PAGES_DEFAULT: Omit<Page,'blocks'|'versions'>[] = [
  { id:'home',     slug:'home',     label:'Home',             icon:'🏠', status:'live'  },
  { id:'journeys', slug:'journeys', label:'Curated Journeys', icon:'✈️', status:'live'  },
  { id:'about',    slug:'about',    label:'About Us',         icon:'📖', status:'draft' },
  { id:'contact',  slug:'contact',  label:'Contact',          icon:'✉️', status:'live'  },
  { id:'legal',    slug:'legal',    label:'Terms & Privacy',  icon:'📄', status:'live'  },
];

const AI_ACTIONS: { trigger: RegExp; action: string; params: Record<string,string> }[] = [
  { trigger:/add.*hero|hero.*block/i,               action:'ADD_BLOCK',      params:{ type:'hero' }        },
  { trigger:/add.*cta|call.*action/i,               action:'ADD_BLOCK',      params:{ type:'cta' }         },
  { trigger:/add.*testimonial/i,                    action:'ADD_BLOCK',      params:{ type:'testimonial' }  },
  { trigger:/add.*trust/i,                          action:'ADD_BLOCK',      params:{ type:'trust' }        },
  { trigger:/add.*journey|add.*curated/i,           action:'ADD_BLOCK',      params:{ type:'journeys' }     },
  { trigger:/add.*form|contact.*form/i,             action:'ADD_BLOCK',      params:{ type:'form' }         },
  { trigger:/add.*image/i,                          action:'ADD_BLOCK',      params:{ type:'image' }        },
  { trigger:/add.*reel|add.*video/i,                action:'ADD_BLOCK',      params:{ type:'reel' }         },
  { trigger:/add.*two.?col|add.*column|split/i,     action:'ADD_BLOCK',      params:{ type:'columns' }      },
  { trigger:/add.*spacer/i,                         action:'ADD_BLOCK',      params:{ type:'spacer' }       },
  { trigger:/add.*text/i,                           action:'ADD_BLOCK',      params:{ type:'text' }         },
  { trigger:/add.*gallery/i,                        action:'ADD_BLOCK',      params:{ type:'gallery' }      },
  { trigger:/delete.*select|remove.*block/i,        action:'DELETE_SEL',     params:{}                      },
  { trigger:/bigger|larger|increase.*font/i,        action:'FONT_SIZE_UP',   params:{}                      },
  { trigger:/smaller|decrease.*font/i,              action:'FONT_SIZE_DOWN', params:{}                      },
  { trigger:/bold/i,                                action:'TOGGLE_BOLD',    params:{}                      },
  { trigger:/center.*align|centre/i,                action:'SET_ALIGN',      params:{ align:'center' }      },
  { trigger:/left.*align/i,                         action:'SET_ALIGN',      params:{ align:'left' }        },
  { trigger:/dark.*background|night.*bg/i,          action:'SET_BG',         params:{ color:DARK }          },
  { trigger:/white.*background|light.*bg/i,         action:'SET_BG',         params:{ color:'#ffffff' }     },
  { trigger:/gold.*colour|change.*primary/i,        action:'SET_PRIMARY',    params:{ color:GOLD }          },
];

const AI_REPLIES = [
  { trigger:/suggest.*page/i,    text:"For a safari brand: Home, Curated Journeys, Destinations, About, Journal (SEO), FAQs, Contact. I've added that block for you." },
  { trigger:/hero|luxurious/i,   text:"Done — hero added. Try uploading a full-bleed landscape image, then use the Dark filter + increase font size for a dramatic effect." },
  { trigger:/about.*copy/i,      text:"Draft: 'We believe the best African safari is one that surprises you. The Safari Edition combines AI precision with human expertise — crafted exactly right, confirmed in hours, not weeks.'" },
  { trigger:/mobile/i,           text:"For mobile: toggle 'Mobile / App' visibility OFF for Gallery and Reel blocks. Use single Image blocks instead." },
  { trigger:/two.?col|column/i,  text:"Done — Two Column block added. Double-click the right column to upload an image or video. Drag the block up/down with the arrow controls." },
  { trigger:/button/i,           text:"Done. For Hero and CTA blocks, there are two button slots in Properties — Button 1 (solid gold) and Button 2 (outlined). Fill in both labels and links." },
  { text:"Done! I can add blocks, resize text, change colours, and restructure your page. Try: 'Add a gallery', 'Make heading bigger', 'Add two column layout', or 'Change background to dark'." },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

let _uid = 1;
const uid = () => `b_${Date.now()}_${_uid++}`;
const colId = () => `c_${Date.now()}_${_uid++}`;
const filterCss = (f: ImgFilter) => IMG_FILTERS.find(x => x.id === f)?.css || 'none';

function makeBlock(type: BlockType, theme: Theme): Block {
  const def = BLOCK_DEFS.find(d => d.type === type)!;
  const base: Block = {
    id: uid(), type,
    heading:'', body:'', btnLabel:'', btnLink:'', btnLabel2:'', btnLink2:'',
    imgUrl:'', imgFilter:'none', bg:def.bg, textColor:'',
    align: (type==='hero'||type==='cta'||type==='testimonial') ? 'center' : 'left',
    paddingY: type==='nav'||type==='spacer' ? 0 : type==='hero'||type==='cta' ? 80 : 48,
    paddingX: type==='spacer' ? 0 : 40,
    fontSize:1, fontWeight:'normal',
    showDesktop:true, showMobile:true, published:true,
    analyticsTag:'', smartLink:'', columns:[], imgWidth:100, imgHeight:300,
  };
  const overrides: Partial<Record<BlockType, Partial<Block>>> = {
    nav:         { heading:theme.name },
    hero:        { heading:'Africa, Rediscovered.', body:'Crafted journeys built by AI. Confirmed by specialists.', btnLabel:'Plan My Journey', btnLink:'/plan', btnLabel2:'View Journeys', btnLink2:'/journeys' },
    cta:         { heading:'Your African Safari Awaits', body:'Five questions. Sixty seconds. A fully-priced, bookable itinerary.', btnLabel:'Start Planning', btnLink:'/plan', btnLabel2:'Browse Journeys', btnLink2:'/journeys' },
    text:        { heading:'About The Safari Edition', body:'We are a new kind of travel company — part AI, part specialist, entirely dedicated to the art of the African safari.' },
    testimonial: { heading:'"The most seamless safari booking experience we have ever had."', body:'— James & Catherine M., London · Sabi Sand, 12 nights' },
    form:        { heading:'Start Planning Your Journey' },
    reel:        { heading:'Singita Sabi Sand', body:'Private game reserve. Unmatched big five sightings.' },
    journeys:    { heading:'Curated Journeys' },
    footer:      { heading:theme.name, body:theme.tagline },
    columns:     { columns:[
      { id:colId(), width:50, type:'text',  heading:'Your Heading Here', body:'Add your text. Double-click the image column to upload a photo, reel, or video.', imgUrl:'', imgFilter:'none' },
      { id:colId(), width:50, type:'image', heading:'', body:'', imgUrl:'', imgFilter:'none' },
    ]},
  };
  return { ...base, ...(overrides[type] || {}) };
}

function makeDefaultBlocks(pageId: string, theme: Theme): Block[] {
  const maps: Record<string, BlockType[]> = {
    home:     ['nav','hero','trust','text','journeys','reel','testimonial','cta','footer'],
    journeys: ['nav','hero','journeys','cta','footer'],
    about:    ['nav','text','trust','testimonial','footer'],
    contact:  ['nav','form','footer'],
    legal:    ['nav','text','footer'],
  };
  return (maps[pageId]||['nav','text','footer']).map(t => makeBlock(t as BlockType, theme));
}

// ─── FORMATTING BAR ───────────────────────────────────────────────────────────

function FormattingBar({ block, onUpdate }: { block: Block; onUpdate: (u: Partial<Block>) => void }) {
  const SIZES = [0.7, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2];
  const idx = SIZES.findIndex(s => Math.abs(s - block.fontSize) < 0.05);
  const i = idx < 0 ? 2 : idx;
  const fb = (active?: boolean): React.CSSProperties => ({
    padding:'3px 7px', border:`0.5px solid ${active?GOLD:BORDER}`, borderRadius:4,
    background: active ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.04)',
    color: active ? GOLD : MUTED, fontSize:12, cursor:'pointer', fontFamily:SANS,
  });
  return (
    <div style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 14px', background:CARD, borderBottom:`0.5px solid ${BORDER}`, flexShrink:0, flexWrap:'wrap', zIndex:40 }}>
      <span style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginRight:2 }}>Selected: <strong style={{ color:GOLD }}>{block.type}</strong></span>
      <div style={{ width:'0.5px', height:16, background:BORDER, margin:'0 4px' }} />
      <span style={{ fontSize:10, color:MUTED }}>Size:</span>
      <button onClick={() => i>0 && onUpdate({fontSize:SIZES[i-1]})} style={fb()}>A−</button>
      <span style={{ fontSize:11, color:MUTED, minWidth:32, textAlign:'center' }}>{Math.round(block.fontSize*100)}%</span>
      <button onClick={() => i<SIZES.length-1 && onUpdate({fontSize:SIZES[i+1]})} style={fb()}>A+</button>
      <div style={{ width:'0.5px', height:16, background:BORDER, margin:'0 4px' }} />
      <button onClick={() => onUpdate({fontWeight:block.fontWeight==='bold'?'normal':'bold'})} style={{...fb(block.fontWeight==='bold'), fontWeight:'bold'}}>B</button>
      <div style={{ width:'0.5px', height:16, background:BORDER, margin:'0 4px' }} />
      {(['left','center','right'] as TextAlign[]).map(a => (
        <button key={a} onClick={() => onUpdate({align:a})} style={fb(block.align===a)}>{a==='left'?'⬅':a==='center'?'⬛':'➡'}</button>
      ))}
      <div style={{ width:'0.5px', height:16, background:BORDER, margin:'0 4px' }} />
      <span style={{ fontSize:10, color:MUTED }}>Text:</span>
      <input type="color" value={block.textColor||'#ffffff'} onChange={e => onUpdate({textColor:e.target.value})} style={{ width:24, height:24, border:'none', borderRadius:4, cursor:'pointer', padding:0 }} />
      <span style={{ fontSize:10, color:MUTED }}>BG:</span>
      <input type="color" value={block.bg.startsWith('#')?block.bg:'#080818'} onChange={e => onUpdate({bg:e.target.value})} style={{ width:24, height:24, border:'none', borderRadius:4, cursor:'pointer', padding:0 }} />
    </div>
  );
}

// ─── BLOCK RENDERER ───────────────────────────────────────────────────────────

function BlockView({ block, theme, onImageUpload }: {
  block: Block; theme: Theme; onImageUpload: (blockId: string, colId?: string) => void;
}) {
  const { type, heading, body, btnLabel, btnLink, btnLabel2, btnLink2, imgUrl, imgFilter, bg, textColor, align, paddingY, paddingX, fontSize, fontWeight, columns, imgWidth, imgHeight } = block;
  const g = theme.primary;
  const hs = (base: number) => base * fontSize;
  const fw = fontWeight === 'bold' ? 700 : undefined;
  const tc = textColor || undefined;
  const base: React.CSSProperties = {
    background: bg === 'transparent' ? undefined : bg,
    textAlign: align, paddingTop:paddingY, paddingBottom:paddingY, paddingLeft:paddingX, paddingRight:paddingX,
  };

  const SolidBtn = ({ label, link }: { label:string; link:string }) => (
    <a href={link||'#'} style={{ display:'inline-block', padding:'12px 28px', background:g, color:DARK, borderRadius:4, fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:SANS, textDecoration:'none', margin:'4px 6px' }}>{label}</a>
  );
  const OutlineBtn = ({ label, link }: { label:string; link:string }) => (
    <a href={link||'#'} style={{ display:'inline-block', padding:'12px 28px', background:'transparent', color:g, borderRadius:4, fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:SANS, textDecoration:'none', border:`1.5px solid ${g}`, margin:'4px 6px' }}>{label}</a>
  );

  if (type === 'nav') return (
    <div style={{ ...base, display:'flex', alignItems:'center', justifyContent:'space-between', height:60, paddingTop:0, paddingBottom:0 }}>
      <div style={{ fontFamily:theme.font, color:g, fontSize:hs(17), fontWeight:700, letterSpacing:1 }}>{heading||theme.name}</div>
      <div style={{ display:'flex', gap:20 }}>
        {['Journeys','Destinations','About','Contact'].map(l => <span key={l} style={{ color:'rgba(255,255,255,0.65)', fontSize:13, cursor:'pointer', fontFamily:SANS }}>{l}</span>)}
      </div>
    </div>
  );

  if (type === 'hero') return (
    <div style={{ ...base, background:bg||`linear-gradient(135deg,${DARK} 0%,#1a1428 100%)`, color:'#fff', position:'relative', overflow:'hidden' }}>
      {imgUrl && <img src={imgUrl} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', opacity:0.45, filter:filterCss(imgFilter) }} />}
      <div style={{ position:'relative', zIndex:1 }}>
        <h1 style={{ fontFamily:theme.font, fontSize:hs(42), fontWeight:fw||700, color:tc||g, marginBottom:16, lineHeight:1.15 }}>{heading}</h1>
        <p style={{ fontSize:hs(16), opacity:0.85, maxWidth:540, margin:'0 auto 28px', lineHeight:1.65, fontFamily:SANS, color:tc }}>{body}</p>
        <div style={{ display:'flex', justifyContent:align==='center'?'center':align==='right'?'flex-end':'flex-start', flexWrap:'wrap' }}>
          {btnLabel && <SolidBtn label={btnLabel} link={btnLink} />}
          {btnLabel2 && <OutlineBtn label={btnLabel2} link={btnLink2} />}
        </div>
      </div>
    </div>
  );

  if (type === 'cta') return (
    <div style={{ ...base, background:bg||DARK, color:'#fff' }}>
      <h2 style={{ fontFamily:theme.font, fontSize:hs(30), fontWeight:fw||700, color:tc||g, marginBottom:12 }}>{heading}</h2>
      <p style={{ color:tc||'rgba(255,255,255,0.7)', marginBottom:28, fontSize:hs(15), lineHeight:1.6, fontFamily:SANS }}>{body}</p>
      <div style={{ display:'flex', justifyContent:align==='center'?'center':align==='right'?'flex-end':'flex-start', flexWrap:'wrap' }}>
        {btnLabel && <SolidBtn label={btnLabel} link={btnLink} />}
        {btnLabel2 && <OutlineBtn label={btnLabel2} link={btnLink2} />}
      </div>
    </div>
  );

  if (type === 'text') return (
    <div style={{ ...base, background:bg||'#fff' }}>
      <h2 style={{ fontFamily:theme.font, fontSize:hs(26), fontWeight:fw||700, marginBottom:14, color:tc||'#1a1a1a' }}>{heading}</h2>
      <p style={{ fontSize:hs(15), lineHeight:1.75, color:tc||'#555', fontFamily:SANS }}>{body}</p>
    </div>
  );

  if (type === 'columns') return (
    <div style={{ ...base, background:bg||'#fff' }}>
      <div style={{ display:'flex', gap:24, alignItems:'stretch' }}>
        {columns.map(col => (
          <div key={col.id} style={{ flex:`0 0 calc(${col.width}% - 12px)` }}>
            {col.type === 'image' ? (
              <div onDoubleClick={() => onImageUpload(block.id, col.id)}
                style={{ width:'100%', height:280, background:'#e8e0d0', borderRadius:6, overflow:'hidden', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:8, color:'#999', position:'relative' }}>
                {col.imgUrl
                  ? <img src={col.imgUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:filterCss(col.imgFilter), display:'block' }} />
                  : <><span style={{ fontSize:32 }}>🖼</span><span style={{ fontSize:12, fontFamily:SANS }}>Double-click to upload</span></>
                }
                <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.5)', color:'#fff', padding:'3px 7px', borderRadius:4, fontSize:10 }}>
                  {col.imgUrl ? 'Double-click to replace' : 'Image / Reel / Video'}
                </div>
              </div>
            ) : (
              <div>
                {col.heading && <h3 style={{ fontFamily:theme.font, fontSize:hs(20), fontWeight:fw||700, color:tc||'#1a1a1a', marginBottom:10 }}>{col.heading}</h3>}
                <p style={{ fontSize:hs(14), lineHeight:1.75, color:tc||'#555', fontFamily:SANS }}>{col.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'image') return (
    <div onDoubleClick={() => onImageUpload(block.id)}
      style={{ width:`${imgWidth||100}%`, margin:'0 auto', position:'relative', cursor:'pointer' }}>
      {imgUrl
        ? <>
            <img src={imgUrl} alt="" style={{ width:'100%', height:imgHeight||300, objectFit:'cover', display:'block', filter:filterCss(imgFilter) }} />
            <div style={{ position:'absolute', bottom:10, right:10, background:'rgba(0,0,0,0.55)', color:'#fff', padding:'3px 9px', borderRadius:4, fontSize:11, fontFamily:SANS }}>Double-click to replace</div>
          </>
        : <div style={{ width:'100%', height:imgHeight||280, background:'#e8e0d0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'#999', borderRadius:4 }}>
            <span style={{ fontSize:38 }}>🖼</span>
            <span style={{ fontSize:14, fontFamily:SANS }}>Double-click to upload image or video</span>
            <span style={{ fontSize:11, color:'#bbb', fontFamily:SANS }}>JPG, PNG, WebP, MP4, MOV</span>
          </div>
      }
    </div>
  );

  if (type === 'gallery') return (
    <div style={{ ...base, background:bg||'#fff' }}>
      {heading && <h2 style={{ fontFamily:theme.font, fontSize:hs(22), marginBottom:16, color:tc||'#1a1a1a' }}>{heading}</h2>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
        {['photo-1516026672322-bc52d61a55d5','photo-1547471080-7cc2caa01a7e','photo-1504208434309-cb69f4fe52b0',
          'photo-1580060839134-75a5edca2e99','photo-1537953773345-d172ccf13cf1','photo-1548013146-72479768bada'].map((id,i) => (
          <div key={i} onDoubleClick={() => onImageUpload(block.id)} style={{ height:160, overflow:'hidden', position:'relative', cursor:'pointer', borderRadius:4 }}>
            <img src={`https://images.unsplash.com/${id}?w=400&q=70`} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', filter:filterCss(imgFilter), display:'block' }} />
            <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, color:'#fff', fontFamily:SANS, transition:'background 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background='rgba(0,0,0,0.4)'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background='rgba(0,0,0,0)'}
            >Replace</div>
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'reel') return (
    <div style={{ ...base, background:bg||DARK, display:'flex', alignItems:'center', gap:28 }}>
      <div onDoubleClick={() => onImageUpload(block.id)}
        style={{ width:120, height:200, background:'#1a1428', borderRadius:10, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', color:g, fontSize:28, border:`0.5px solid rgba(212,175,55,0.2)`, cursor:'pointer', position:'relative', overflow:'hidden' }}>
        {imgUrl
          ? <video src={imgUrl} style={{ width:'100%', height:'100%', objectFit:'cover', filter:filterCss(imgFilter) }} muted />
          : <div style={{ textAlign:'center' }}><div>▶</div><div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', marginTop:4, fontFamily:SANS }}>Double-click</div></div>
        }
      </div>
      <div style={{ color:'#fff' }}>
        <h3 style={{ fontFamily:theme.font, fontSize:hs(21), fontWeight:fw||700, color:tc||g, marginBottom:10 }}>{heading}</h3>
        <p style={{ fontSize:hs(13), opacity:0.7, lineHeight:1.6, marginBottom:14, fontFamily:SANS, color:tc }}>{body}</p>
        <div style={{ fontSize:13, color:g, cursor:'pointer', fontFamily:SANS }}>▶ Watch Reel (30s)</div>
      </div>
    </div>
  );

  if (type === 'journeys') return (
    <div style={{ ...base, background:bg||'#fafaf8' }}>
      <h2 style={{ fontFamily:theme.font, fontSize:hs(26), color:tc||'#1a1a1a', marginBottom:22, textAlign:'center', fontWeight:fw||700 }}>{heading}</h2>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          { img:'photo-1516026672322-bc52d61a55d5', title:'Sabi Sand & Victoria Falls', sub:'10 nights · SA + Zimbabwe', price:'From R185,000 pp' },
          { img:'photo-1580060839134-75a5edca2e99', title:'Okavango & Cape Town',       sub:'12 nights · Botswana + SA',  price:'From R210,000 pp' },
          { img:'photo-1547471080-7cc2caa01a7e',   title:'Great Migration',             sub:'9 nights · Masai Mara',      price:'From R155,000 pp' },
        ].map(j => (
          <div key={j.title} style={{ borderRadius:8, overflow:'hidden', border:'0.5px solid #e0d8c8', background:'#fff', cursor:'pointer' }}>
            <img src={`https://images.unsplash.com/${j.img}?w=400&q=70`} alt="" style={{ width:'100%', height:150, objectFit:'cover', display:'block' }} />
            <div style={{ padding:12 }}>
              <div style={{ fontSize:hs(13), fontWeight:600, marginBottom:3, fontFamily:theme.font, color:'#1a1a1a' }}>{j.title}</div>
              <div style={{ fontSize:11, color:'#888', fontFamily:SANS }}>{j.sub}</div>
              <div style={{ fontSize:12, fontWeight:600, color:g, marginTop:7, fontFamily:SANS }}>{j.price}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'testimonial') return (
    <div style={{ ...base, background:bg||'#fdf8ec' }}>
      <div style={{ fontSize:30, color:g, marginBottom:14, fontFamily:theme.font }}>❝</div>
      <blockquote style={{ fontFamily:theme.font, fontSize:hs(19), fontWeight:fw||400, color:tc||'#1a1a1a', fontStyle:'italic', marginBottom:14, maxWidth:620, marginLeft:'auto', marginRight:'auto', lineHeight:1.55 }}>{heading}</blockquote>
      <div style={{ fontSize:hs(13), color:tc||'#888', fontFamily:SANS }}>{body}</div>
    </div>
  );

  if (type === 'trust') return (
    <div style={{ ...base, background:bg||'#fff' }}>
      <div style={{ display:'flex', justifyContent:'center', gap:36, flexWrap:'wrap', alignItems:'center' }}>
        {['✓ ASATA Member','⭐ Trustpilot 4.9','🔒 Secure Payments','✦ SATSA Accredited'].map(t => (
          <div key={t} style={{ display:'flex', alignItems:'center', gap:8, color:tc||'#555', fontFamily:SANS, fontSize:hs(13) }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'#f0ede5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>{t.split(' ')[0]}</div>
            {t.split(' ').slice(1).join(' ')}
          </div>
        ))}
      </div>
    </div>
  );

  if (type === 'form') return (
    <div style={{ ...base, background:bg||'#fff' }}>
      <h2 style={{ fontFamily:theme.font, fontSize:hs(24), marginBottom:22, color:tc||'#1a1a1a', fontWeight:fw||700 }}>{heading}</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:10, maxWidth:520 }}>
        <div style={{ display:'flex', gap:10 }}>
          <input readOnly placeholder="First name" style={{ flex:1, padding:'10px 12px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, background:'#f8f8f8', fontFamily:SANS }} />
          <input readOnly placeholder="Last name"  style={{ flex:1, padding:'10px 12px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, background:'#f8f8f8', fontFamily:SANS }} />
        </div>
        <input readOnly placeholder="Email address" style={{ padding:'10px 12px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, background:'#f8f8f8', fontFamily:SANS }} />
        <select style={{ padding:'10px 12px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, background:'#f8f8f8', fontFamily:SANS }}>
          <option>What interests you?</option><option>Safari & Wildlife</option><option>Beach & Island</option>
        </select>
        <textarea readOnly rows={3} placeholder="Tell us about your dream trip..." style={{ padding:'10px 12px', border:'0.5px solid #ddd', borderRadius:6, fontSize:13, background:'#f8f8f8', resize:'vertical', fontFamily:SANS }} />
        <button style={{ padding:'11px 26px', background:g, color:DARK, border:'none', borderRadius:4, fontWeight:700, fontSize:13, cursor:'pointer', alignSelf:'flex-start', fontFamily:SANS }}>Send Enquiry</button>
      </div>
    </div>
  );

  if (type === 'footer') return (
    <div style={{ ...base, background:bg||DARK, color:'#fff' }}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:36, marginBottom:28 }}>
        <div>
          <div style={{ fontFamily:theme.font, color:g, fontSize:hs(17), marginBottom:10, letterSpacing:1 }}>{theme.name}</div>
          <p style={{ color:'rgba(255,255,255,0.4)', fontSize:hs(13), lineHeight:1.7, fontFamily:SANS }}>{theme.tagline}</p>
          <div style={{ color:'rgba(255,255,255,0.3)', fontSize:12, marginTop:10, fontFamily:SANS }}>✉ {theme.email}</div>
        </div>
        {[['Journeys',['Sabi Sand','Okavango','Victoria Falls']],['Company',['About','Privacy Policy','Terms']]].map(([h,links]) => (
          <div key={h as string}>
            <div style={{ fontFamily:theme.font, color:g, fontSize:hs(13), marginBottom:10 }}>{h as string}</div>
            {(links as string[]).map(l => <div key={l} style={{ color:'rgba(255,255,255,0.4)', fontSize:12, lineHeight:2.1, fontFamily:SANS, cursor:'pointer' }}>{l}</div>)}
          </div>
        ))}
      </div>
      <div style={{ borderTop:'0.5px solid rgba(255,255,255,0.07)', paddingTop:18, color:'rgba(255,255,255,0.2)', fontSize:11, fontFamily:SANS }}>
        © 2026 The Travel Catalogue Ltd · All rights reserved
      </div>
    </div>
  );

  if (type === 'spacer') return (
    <div style={{ height:paddingY||40, background:bg==='transparent'?undefined:bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <span style={{ fontSize:10, color:'#ccc', userSelect:'none', fontFamily:SANS }}>spacer · {paddingY||40}px</span>
    </div>
  );

  return <div style={{ padding:20, textAlign:'center', color:'#999', fontSize:13 }}>Unknown: {type}</div>;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const [theme, setTheme]       = useState<Theme>(DEFAULT_THEME);
  const [pages, setPages]       = useState<Page[]>(() =>
    PAGES_DEFAULT.map(p => ({ ...p, blocks:makeDefaultBlocks(p.id, DEFAULT_THEME), versions:[] }))
  );
  const [pageId, setPageId]     = useState('home');
  const [selId, setSelId]       = useState<string|null>(null);
  const [device, setDevice]     = useState<DeviceMode>('desktop');
  const [dirty, setDirty]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [verNum, setVerNum]     = useState(2);
  const [dragType, setDragType] = useState<BlockType|null>(null);
  const [dragOver, setDragOver] = useState<number|null>(null);
  const [leftTab, setLeftTab]   = useState<'blocks'|'pages'|'brand'>('blocks');
  const [search, setSearch]     = useState('');
  const [showTpl, setShowTpl]   = useState(false);
  const [showVer, setShowVer]   = useState(false);
  const [showAI,  setShowAI]    = useState(false);
  const [aiMsgs, setAiMsgs]     = useState([{ role:'assistant', text:`Hi! I can build and edit your ${DEFAULT_THEME.name} site. I can ADD blocks, CHANGE colours, RESIZE text, and more. Try: "Add a two column layout", "Make the heading bigger", or "Add a CTA with two buttons".` }]);
  const [aiInput, setAiInput]   = useState('');
  const [pagesDrop, setPagesDrop] = useState(false);
  const [selTpl, setSelTpl]     = useState('safari');
  const [customFont, setCustomFont] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingUpload, setPendingUpload] = useState<{blockId:string;colId?:string}|null>(null);
  const aiEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { aiEndRef.current?.scrollIntoView({behavior:'smooth'}); }, [aiMsgs]);

  const page   = pages.find(p => p.id === pageId)!;
  const blocks = page?.blocks || [];
  const sel    = blocks.find(b => b.id === selId) || null;

  const updateBlocks = useCallback((fn: (bs:Block[]) => Block[]) => {
    setPages(ps => ps.map(p => p.id===pageId ? {...p, blocks:fn(p.blocks)} : p));
    setDirty(true);
  }, [pageId]);

  const addBlock = useCallback((type: BlockType, at?: number) => {
    const b = makeBlock(type, theme);
    updateBlocks(bs => { const n=[...bs]; n.splice(at??n.length,0,b); return n; });
    setSelId(b.id);
  }, [theme, updateBlocks]);

  const updateSel = useCallback((updates: Partial<Block>) => {
    if (!selId) return;
    updateBlocks(bs => bs.map(b => b.id===selId ? {...b,...updates} : b));
  }, [selId, updateBlocks]);

  const moveBlock = useCallback((id:string, dir:-1|1) => {
    updateBlocks(bs => {
      const i=bs.findIndex(b=>b.id===id), j=i+dir;
      if(j<0||j>=bs.length) return bs;
      const n=[...bs]; [n[i],n[j]]=[n[j],n[i]]; return n;
    });
  }, [updateBlocks]);

  const dupBlock = useCallback((id:string) => {
    updateBlocks(bs => {
      const i=bs.findIndex(b=>b.id===id);
      if(i<0) return bs;
      const n=[...bs]; n.splice(i+1,0,{...bs[i],id:uid()}); return n;
    });
  }, [updateBlocks]);

  const delBlock = useCallback((id:string) => {
    updateBlocks(bs => bs.filter(b=>b.id!==id));
    if(selId===id) setSelId(null);
  }, [selId, updateBlocks]);

  const handleImageUpload = useCallback((blockId:string, colId?:string) => {
    setPendingUpload({blockId,colId});
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file||!pendingUpload) return;
    const url = URL.createObjectURL(file);
    const {blockId,colId} = pendingUpload;
    updateBlocks(bs => bs.map(b => {
      if(b.id!==blockId) return b;
      if(colId) return {...b, columns:b.columns.map(c => c.id===colId ? {...c,imgUrl:url,type:'image' as const} : c)};
      return {...b, imgUrl:url};
    }));
    setPendingUpload(null);
    if(fileInputRef.current) fileInputRef.current.value='';
  }, [pendingUpload, updateBlocks]);

  const sendAI = useCallback(async (msg?:string) => {
    const text = msg || aiInput.trim();
    if(!text) return;
    setAiInput('');
    setAiMsgs(m => [...m,{role:'user',text}]);
    let reply = '';
    for(const a of AI_ACTIONS) {
      if(a.trigger.test(text)) {
        if(a.action==='ADD_BLOCK') { addBlock(a.params.type as BlockType); reply=`Done — added a ${a.params.type} block.`; }
        else if(a.action==='DELETE_SEL'&&sel) { delBlock(sel.id); reply='Done — block deleted.'; }
        else if(a.action==='FONT_SIZE_UP'&&sel) { updateSel({fontSize:Math.min((sel.fontSize||1)+0.15,2)}); reply='Done — text made larger.'; }
        else if(a.action==='FONT_SIZE_DOWN'&&sel) { updateSel({fontSize:Math.max((sel.fontSize||1)-0.15,0.7)}); reply='Done — text made smaller.'; }
        else if(a.action==='TOGGLE_BOLD'&&sel) { updateSel({fontWeight:sel.fontWeight==='bold'?'normal':'bold'}); reply='Done — bold toggled.'; }
        else if(a.action==='SET_ALIGN'&&sel) { updateSel({align:a.params.align as TextAlign}); reply=`Done — aligned ${a.params.align}.`; }
        else if(a.action==='SET_BG'&&sel) { updateSel({bg:a.params.color}); reply='Done — background updated.'; }
        else if(a.action==='SET_PRIMARY') { setTheme(t=>({...t,primary:a.params.color})); reply='Done — primary colour updated.'; }
        break;
      }
    }
    await new Promise(r=>setTimeout(r,600));
    if(!reply) {
      const rd = AI_REPLIES.find(r=>r.trigger?.test(text))||AI_REPLIES[AI_REPLIES.length-1];
      reply = rd.text;
    }
    setAiMsgs(m => [...m,{role:'assistant',text:reply}]);
  }, [aiInput, sel, addBlock, delBlock, updateSel]);

  const switchPage = (id:string) => { setPageId(id); setSelId(null); setPagesDrop(false); };

  const addPage = () => {
    const label = window.prompt('New page name:');
    if(!label) return;
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    const np: Page = { id:slug+Date.now(), slug, label, icon:'📄', status:'draft', blocks:[makeBlock('nav',theme),makeBlock('text',theme),makeBlock('footer',theme)], versions:[] };
    setPages(ps=>[...ps,np]); setPageId(np.id); setSelId(null);
  };

  const save = async () => {
    setSaving(true);
    const ver:Version = {id:'v'+Date.now(), num:verNum, when:new Date().toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}), who:'Admin', blocks:JSON.parse(JSON.stringify(blocks))};
    setPages(ps=>ps.map(p=>p.id===pageId?{...p,versions:[ver,...p.versions].slice(0,3)}:p));
    setVerNum(v=>v+1);
    await new Promise(r=>setTimeout(r,600));
    setSaving(false); setDirty(false);
  };

  const applyTpl = (id:string) => {
    const t=TEMPLATES.find(t=>t.id===id);
    if(!t) return;
    updateBlocks(()=>t.types.map(type=>makeBlock(type,theme)));
    if(t.primary!==theme.primary) setTheme(th=>({...th,primary:t.primary,bg:t.bg}));
    setShowTpl(false); setSelId(null);
  };

  const DMAX = {desktop:'100%',tablet:'768px',mobile:'390px'};
  const pi: React.CSSProperties = {width:'100%',padding:'7px 10px',border:`0.5px solid ${BORDER}`,borderRadius:6,background:'rgba(255,255,255,0.06)',fontSize:12,color:'#fff',outline:'none',fontFamily:SANS};
  const pl: React.CSSProperties = {fontSize:11,color:MUTED,fontWeight:500,marginBottom:4,display:'block'};
  const pg: React.CSSProperties = {display:'flex',flexDirection:'column',gap:5};
  const dv: React.CSSProperties = {height:'0.5px',background:BORDER,margin:'4px 0'};

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:DARK,fontFamily:SANS,color:'#fff',fontSize:13}}>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{display:'none'}} onChange={handleFileChange} />

      {/* TOP BAR */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',height:52,background:'#0a0a1e',borderBottom:`0.5px solid ${BORDER}`,flexShrink:0,gap:12,zIndex:50}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{fontSize:13,fontWeight:600,whiteSpace:'nowrap'}}>✦ <span style={{color:GOLD}}>{theme.name}</span></div>
          <div style={{position:'relative'}}>
            <button onClick={()=>setPagesDrop(o=>!o)} style={{padding:'5px 10px',border:`0.5px solid ${BORDER}`,borderRadius:6,background:'rgba(255,255,255,0.05)',fontSize:12,color:'rgba(255,255,255,0.7)',cursor:'pointer',display:'flex',alignItems:'center',gap:6,fontFamily:SANS}}>
              {page?.icon} {page?.label} <span style={{fontSize:9,opacity:0.5}}>▾</span>
            </button>
            {pagesDrop&&(
              <div style={{position:'absolute',top:'100%',left:0,marginTop:4,background:CARD,border:`0.5px solid ${BORDER}`,borderRadius:8,padding:6,minWidth:200,boxShadow:'0 8px 32px rgba(0,0,0,0.4)',zIndex:200}}>
                {pages.map(p=>(
                  <button key={p.id} onClick={()=>switchPage(p.id)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'7px 10px',borderRadius:6,cursor:'pointer',fontSize:12,background:p.id===pageId?'rgba(212,175,55,0.1)':'transparent',border:'none',color:p.id===pageId?GOLD:MUTED,textAlign:'left',fontFamily:SANS}}>
                    <span>{p.icon} {p.label}</span>
                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:p.status==='live'?'rgba(52,211,153,0.15)':'rgba(251,146,60,0.15)',color:p.status==='live'?'#34d399':'#fb923c'}}>{p.status}</span>
                  </button>
                ))}
                <button onClick={addPage} style={{width:'100%',padding:'7px 10px',border:`0.5px dashed rgba(212,175,55,0.3)`,borderRadius:6,background:'transparent',color:GOLD,fontSize:12,cursor:'pointer',marginTop:4,fontFamily:SANS}}>+ New Page</button>
              </div>
            )}
          </div>
        </div>
        <div style={{display:'flex',gap:4}}>
          {(['desktop','tablet','mobile'] as DeviceMode[]).map(m=>(
            <button key={m} onClick={()=>setDevice(m)} style={{padding:'5px 11px',border:`0.5px solid ${device===m?'rgba(212,175,55,0.5)':BORDER}`,borderRadius:6,background:device===m?'rgba(212,175,55,0.1)':'transparent',fontSize:11,cursor:'pointer',color:device===m?GOLD:MUTED,fontFamily:SANS}}>
              {m==='desktop'?'🖥':m==='tablet'?'📱':'📲'} {m}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:7}}>
          <button onClick={()=>setShowVer(v=>!v)} style={{fontSize:11,color:MUTED,background:'rgba(255,255,255,0.04)',border:`0.5px solid ${BORDER}`,padding:'4px 9px',borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontFamily:SANS,whiteSpace:'nowrap'}}>
            {dirty&&<span style={{width:6,height:6,borderRadius:'50%',background:'#e8a020',display:'inline-block'}}/>}
            v{verNum} · {saving?'saving...':'saved'}
          </button>
          {[{l:'Templates',a:()=>setShowTpl(true)},{l:'AI Assist',a:()=>setShowAI(v=>!v)},{l:'Preview',a:()=>alert('Preview: /preview/'+page?.slug)}].map(b=>(
            <button key={b.l} onClick={b.a} style={{padding:'6px 13px',background:'transparent',color:'rgba(255,255,255,0.7)',border:`0.5px solid ${BORDER}`,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:SANS}}>{b.l}</button>
          ))}
          <button onClick={save} style={{padding:'6px 14px',background:GOLD,color:DARK,border:'none',borderRadius:6,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:SANS}}>
            {saving?'Saving...':'Save & Publish'}
          </button>
        </div>
      </div>

      {/* FORMATTING BAR */}
      {sel && <FormattingBar block={sel} onUpdate={updateSel} />}

      {/* THREE COLUMNS */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}} onClick={()=>setPagesDrop(false)}>

        {/* LEFT PANEL */}
        <div style={{width:222,background:PANEL,borderRight:`0.5px solid ${BORDER}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:`0.5px solid ${BORDER}`,flexShrink:0}}>
            {(['blocks','pages','brand'] as const).map(t=>(
              <button key={t} onClick={()=>setLeftTab(t)} style={{flex:1,padding:'9px 0',textAlign:'center',fontSize:11,cursor:'pointer',color:leftTab===t?GOLD:MUTED,borderBottom:`2px solid ${leftTab===t?GOLD:'transparent'}`,fontWeight:leftTab===t?600:400,background:'transparent',border:'none',borderBottom:`2px solid ${leftTab===t?GOLD:'transparent'}`,fontFamily:SANS}}>
                {t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>

          {leftTab==='blocks'&&<>
            <div style={{padding:'8px 10px',flexShrink:0}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search blocks..." style={{...pi}}/>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:10}}>
              {['structure','hero','content','media','travel'].map(cat=>{
                const defs=BLOCK_DEFS.filter(d=>d.cat===cat&&(!search||d.label.toLowerCase().includes(search.toLowerCase())));
                if(!defs.length) return null;
                return(
                  <div key={cat}>
                    <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.22)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'10px 4px 5px'}}>{cat}</div>
                    <div style={{display:'grid',gridTemplateColumns:cat==='travel'?'1fr':'1fr 1fr',gap:6,marginBottom:4}}>
                      {defs.map(def=>(
                        <div key={def.type} draggable onDragStart={()=>setDragType(def.type)} onClick={()=>addBlock(def.type)}
                          style={{padding:'10px 6px',border:`0.5px solid ${BORDER}`,borderRadius:8,background:'rgba(255,255,255,0.03)',cursor:'pointer',textAlign:'center',userSelect:'none',transition:'all 0.15s'}}
                          onMouseEnter={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor=GOLD;d.style.background='rgba(212,175,55,0.08)';}}
                          onMouseLeave={e=>{const d=e.currentTarget as HTMLDivElement;d.style.borderColor=BORDER;d.style.background='rgba(255,255,255,0.03)';}}
                        >
                          <span style={{fontSize:16,marginBottom:4,display:'block'}}>{def.icon}</span>
                          <div style={{fontSize:10,color:MUTED,lineHeight:1.2}}>{def.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>}

          {leftTab==='pages'&&(
            <div style={{flex:1,overflowY:'auto',padding:10}}>
              <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.22)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'4px 4px 8px'}}>Your Pages</div>
              {pages.map(p=>(
                <button key={p.id} onClick={()=>switchPage(p.id)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',width:'100%',padding:'8px 10px',borderRadius:7,cursor:'pointer',fontSize:12,background:p.id===pageId?'rgba(212,175,55,0.1)':'transparent',border:`0.5px solid ${p.id===pageId?'rgba(212,175,55,0.3)':'transparent'}`,color:p.id===pageId?GOLD:MUTED,textAlign:'left',fontFamily:SANS,marginBottom:3}}>
                  <span>{p.icon} {p.label}</span>
                  <span style={{fontSize:9,padding:'2px 6px',borderRadius:8,background:p.status==='live'?'rgba(52,211,153,0.15)':'rgba(251,146,60,0.15)',color:p.status==='live'?'#34d399':'#fb923c'}}>{p.status}</span>
                </button>
              ))}
              <button onClick={addPage} style={{width:'100%',padding:'8px',border:`0.5px dashed rgba(212,175,55,0.35)`,borderRadius:7,background:'transparent',fontSize:12,color:GOLD,cursor:'pointer',marginTop:8,fontFamily:SANS}}>+ New Custom Page</button>
              <div style={{fontSize:10,fontWeight:600,color:'rgba(255,255,255,0.22)',textTransform:'uppercase',letterSpacing:'0.5px',padding:'16px 4px 8px'}}>Add Recommended</div>
              {[{slug:'destinations',label:'Destinations',icon:'🌍'},{slug:'journal',label:'Journal',icon:'📝'},{slug:'faq',label:'FAQs',icon:'❓'}].map(rp=>(
                <button key={rp.slug} onClick={addPage} style={{display:'flex',alignItems:'center',gap:8,width:'100%',padding:'7px 10px',borderRadius:7,cursor:'pointer',fontSize:12,background:'transparent',border:`0.5px dashed ${BORDER}`,color:MUTED,textAlign:'left',fontFamily:SANS,marginBottom:3}}>
                  {rp.icon} {rp.label}
                </button>
              ))}
            </div>
          )}

          {leftTab==='brand'&&(
            <div style={{flex:1,overflowY:'auto',padding:12}}>
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                <div style={pg}>
                  <span style={pl}>Logo</span>
                  <div style={{border:`1px dashed ${BORDER}`,borderRadius:7,padding:14,textAlign:'center',fontSize:11,color:MUTED,cursor:'pointer'}} onClick={()=>{setPendingUpload({blockId:'__logo__'});fileInputRef.current?.click();}}>
                    <div style={{fontSize:22,marginBottom:4}}>✦</div>Upload SVG / PNG<div style={{fontSize:10,marginTop:2,color:'rgba(255,255,255,0.15)'}}>Stores to Cloudflare R2</div>
                  </div>
                </div>
                <div style={pg}><span style={pl}>Edition Name</span><input style={pi} value={theme.name} onChange={e=>setTheme(t=>({...t,name:e.target.value}))}/></div>
                <div style={pg}><span style={pl}>Tagline</span><input style={pi} value={theme.tagline} onChange={e=>setTheme(t=>({...t,tagline:e.target.value}))}/></div>
                <div style={pg}>
                  <span style={pl}>Primary Colour</span>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                    {PALETTE.map(c=>(
                      <div key={c} onClick={()=>setTheme(t=>({...t,primary:c}))} style={{width:20,height:20,borderRadius:4,background:c,cursor:'pointer',border:`2px solid ${theme.primary===c?'#fff':'transparent'}`,transform:theme.primary===c?'scale(1.2)':'scale(1)',transition:'transform 0.1s'}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="color" value={theme.primary} onChange={e=>setTheme(t=>({...t,primary:e.target.value}))} style={{width:32,height:32,border:'none',borderRadius:6,cursor:'pointer',padding:0}}/>
                    <input style={{...pi,flex:1}} value={theme.primary} onChange={e=>setTheme(t=>({...t,primary:e.target.value}))} placeholder="#d4af37"/>
                  </div>
                </div>
                <div style={pg}>
                  <span style={pl}>Background Colour</span>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:6}}>
                    {BG_SWATCHES.map(s=>(
                      <div key={s.c} onClick={()=>setTheme(t=>({...t,bg:s.c}))} title={s.l} style={{width:20,height:20,borderRadius:4,background:s.c==='transparent'?'repeating-conic-gradient(#808080 0% 25%,transparent 0% 50%) 0 0/8px 8px':s.c,cursor:'pointer',border:`2px solid ${theme.bg===s.c?'#fff':'rgba(255,255,255,0.15)'}`,transform:theme.bg===s.c?'scale(1.15)':'scale(1)',transition:'transform 0.1s'}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:6,alignItems:'center'}}>
                    <input type="color" value={theme.bg.startsWith('#')?theme.bg:'#080818'} onChange={e=>setTheme(t=>({...t,bg:e.target.value}))} style={{width:32,height:32,border:'none',borderRadius:6,cursor:'pointer',padding:0}}/>
                    <input style={{...pi,flex:1}} value={theme.bg} onChange={e=>setTheme(t=>({...t,bg:e.target.value}))} placeholder="#080818"/>
                  </div>
                </div>
                <div style={pg}>
                  <span style={pl}>Display Font</span>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:6}}>
                    {GOOGLE_FONTS.map(f=>(
                      <button key={f.value} onClick={()=>setTheme(t=>({...t,font:f.value}))} style={{padding:'7px',border:`0.5px solid ${theme.font===f.value?GOLD:BORDER}`,borderRadius:6,background:theme.font===f.value?'rgba(212,175,55,0.1)':'rgba(255,255,255,0.03)',fontSize:11,cursor:'pointer',color:theme.font===f.value?GOLD:MUTED,fontFamily:f.value,transition:'all 0.15s'}}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <span style={{...pl,marginTop:4}}>Custom Google Font</span>
                  <div style={{display:'flex',gap:5}}>
                    <input style={{...pi,flex:1}} value={customFont} onChange={e=>setCustomFont(e.target.value)} placeholder="e.g. Cormorant Garamond"/>
                    <button onClick={()=>{if(customFont)setTheme(t=>({...t,font:`'${customFont}', serif`}));}} style={{padding:'7px 10px',background:GOLD,color:DARK,border:'none',borderRadius:6,fontSize:11,cursor:'pointer',fontWeight:700,fontFamily:SANS}}>Set</button>
                  </div>
                </div>
                <div style={pg}><span style={pl}>Contact Email</span><input style={pi} value={theme.email} onChange={e=>setTheme(t=>({...t,email:e.target.value}))}/></div>
                <div style={dv}/>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.18)',lineHeight:1.6}}>Brand changes apply across all pages and feed into mobile and app automatically.</div>
              </div>
            </div>
          )}
        </div>

        {/* CANVAS */}
        <div style={{flex:1,overflowY:'auto',display:'flex',flexDirection:'column',alignItems:'center',padding:'20px 16px 80px',background:'#060614'}}>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.18)',marginBottom:8,letterSpacing:1,textTransform:'uppercase'}}>
            {device} · {device==='desktop'?'960px':device==='tablet'?'768px':'390px'}
          </div>
          <div style={{width:'100%',maxWidth:DMAX[device],minHeight:600,background:'#fff',boxShadow:'0 4px 40px rgba(0,0,0,0.5)',borderRadius:8,overflow:'hidden',transition:'max-width 0.3s ease'}}>
            {blocks.length===0?(
              <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragType){addBlock(dragType,0);setDragType(null);setDragOver(null);}}}
                style={{minHeight:360,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,border:'2px dashed rgba(212,175,55,0.2)',borderRadius:8,margin:24,color:'rgba(100,90,60,0.4)',background:'rgba(212,175,55,0.02)'}}>
                <div style={{fontSize:32,opacity:0.3}}>⊞</div>
                <div style={{fontSize:14}}>Drag blocks here or click any block in the left panel</div>
              </div>
            ):(
              <>
                {blocks.map((block,idx)=>(
                  <div key={block.id}>
                    <div onDragOver={e=>{e.preventDefault();setDragOver(idx);}} onDrop={e=>{e.preventDefault();if(dragType){addBlock(dragType,idx);setDragType(null);setDragOver(null);}}}
                      style={{height:dragOver===idx?44:4,background:dragOver===idx?'rgba(212,175,55,0.12)':'transparent',border:dragOver===idx?'2px dashed rgba(212,175,55,0.4)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:GOLD,transition:'all 0.15s'}}>
                      {dragOver===idx&&'Drop here'}
                    </div>
                    <div onClick={e=>{e.stopPropagation();setSelId(block.id);}}
                      style={{position:'relative',outline:selId===block.id?`2px solid ${GOLD}`:'2px solid transparent',outlineOffset:-2,cursor:'pointer',opacity:block.published?1:0.45,transition:'outline-color 0.15s'}}>
                      {selId===block.id&&(
                        <div style={{position:'absolute',top:6,right:6,zIndex:10,display:'flex',gap:4}} onClick={e=>e.stopPropagation()}>
                          <div style={{padding:'3px 8px',background:GOLD,color:DARK,borderRadius:4,fontSize:10,fontWeight:700,textTransform:'uppercase',alignSelf:'center',marginRight:4}}>{block.type}</div>
                          {[['↑',()=>moveBlock(block.id,-1)],['↓',()=>moveBlock(block.id,1)],['⎘',()=>dupBlock(block.id)],['✕',()=>delBlock(block.id)]].map(([icon,fn])=>(
                            <button key={icon as string} onClick={fn as ()=>void} style={{width:28,height:28,borderRadius:5,border:'0.5px solid rgba(255,255,255,0.2)',background:icon==='✕'?'rgba(220,38,38,0.9)':'rgba(255,255,255,0.95)',cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center',color:icon==='✕'?'#fff':'#1a1a1a',boxShadow:'0 2px 6px rgba(0,0,0,0.2)',fontFamily:SANS}}>
                              {icon as string}
                            </button>
                          ))}
                        </div>
                      )}
                      {!block.published&&<div style={{position:'absolute',top:6,left:6,zIndex:10,padding:'3px 8px',background:'rgba(251,146,60,0.9)',color:'#fff',borderRadius:4,fontSize:10,fontWeight:600}}>HIDDEN</div>}
                      <BlockView block={block} theme={theme} onImageUpload={handleImageUpload}/>
                    </div>
                  </div>
                ))}
                <div onDragOver={e=>{e.preventDefault();setDragOver(blocks.length);}} onDrop={e=>{e.preventDefault();if(dragType){addBlock(dragType);setDragType(null);setDragOver(null);}}}
                  style={{height:dragOver===blocks.length?44:16,background:dragOver===blocks.length?'rgba(212,175,55,0.1)':'transparent',border:dragOver===blocks.length?'2px dashed rgba(212,175,55,0.4)':'none',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,color:GOLD,transition:'all 0.15s'}}>
                  {dragOver===blocks.length&&'Drop here'}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div style={{width:242,background:PANEL,borderLeft:`0.5px solid ${BORDER}`,display:'flex',flexDirection:'column',flexShrink:0,overflow:'hidden'}}>
          <div style={{padding:'12px 14px',borderBottom:`0.5px solid ${BORDER}`,fontSize:12,fontWeight:500,color:'rgba(255,255,255,0.7)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <span>Properties</span>
            {sel&&<span style={{fontSize:11,color:GOLD,fontWeight:600}}>{sel.type.toUpperCase()}</span>}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:12,display:'flex',flexDirection:'column',gap:12}}>
            {!sel?(
              <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 16px',gap:10}}>
                <div style={{fontSize:28,opacity:0.15}}>⊙</div>
                <div style={{fontSize:12,color:'rgba(255,255,255,0.2)',textAlign:'center',lineHeight:1.6}}>Click any block to edit its properties</div>
              </div>
            ):(
              <>
                {['nav','hero','cta','text','testimonial','reel','form','journeys'].includes(sel.type)&&(
                  <div style={pg}><span style={pl}>Heading</span><input style={pi} value={sel.heading} onChange={e=>updateSel({heading:e.target.value})}/></div>
                )}
                {['hero','cta','text','testimonial','reel'].includes(sel.type)&&(
                  <div style={pg}><span style={pl}>Body Text</span><textarea style={{...pi,minHeight:72,resize:'vertical',lineHeight:1.5} as React.CSSProperties} value={sel.body} onChange={e=>updateSel({body:e.target.value})}/></div>
                )}
                {['hero','cta'].includes(sel.type)&&<>
                  <div style={dv}/>
                  <div style={{fontSize:11,fontWeight:600,color:'rgba(212,175,55,0.7)',letterSpacing:'0.5px'}}>BUTTON 1</div>
                  <div style={pg}><span style={pl}>Label</span><input style={pi} value={sel.btnLabel} placeholder="e.g. Plan My Journey" onChange={e=>updateSel({btnLabel:e.target.value})}/></div>
                  <div style={pg}><span style={pl}>Link</span><input style={pi} value={sel.btnLink} placeholder="/plan" onChange={e=>updateSel({btnLink:e.target.value})}/></div>
                  <div style={{fontSize:11,fontWeight:600,color:'rgba(212,175,55,0.5)',letterSpacing:'0.5px',marginTop:4}}>BUTTON 2 (optional — outline style)</div>
                  <div style={pg}><span style={pl}>Label</span><input style={pi} value={sel.btnLabel2} placeholder="e.g. View Journeys" onChange={e=>updateSel({btnLabel2:e.target.value})}/></div>
                  <div style={pg}><span style={pl}>Link</span><input style={pi} value={sel.btnLink2} placeholder="/journeys" onChange={e=>updateSel({btnLink2:e.target.value})}/></div>
                </>}

                <div style={dv}/>
                <div style={pg}>
                  <span style={pl}>Background</span>
                  <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:5}}>
                    {BG_SWATCHES.map(s=>(
                      <div key={s.c} onClick={()=>updateSel({bg:s.c})} title={s.l} style={{width:20,height:20,borderRadius:4,background:s.c==='transparent'?'repeating-conic-gradient(#808080 0% 25%,transparent 0% 50%) 0 0/8px 8px':s.c,cursor:'pointer',border:`2px solid ${sel.bg===s.c?'#fff':'rgba(255,255,255,0.1)'}`,transform:sel.bg===s.c?'scale(1.15)':'scale(1)',transition:'transform 0.1s'}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:5,alignItems:'center'}}>
                    <input type="color" value={sel.bg.startsWith('#')?sel.bg:'#080818'} onChange={e=>updateSel({bg:e.target.value})} style={{width:28,height:28,border:'none',borderRadius:5,cursor:'pointer',padding:0}}/>
                    <input style={{...pi,flex:1}} value={sel.bg} onChange={e=>updateSel({bg:e.target.value})} placeholder="#080818 or transparent"/>
                  </div>
                </div>

                {['image','gallery','hero','reel'].includes(sel.type)&&<>
                  <div style={dv}/>
                  <div style={{fontSize:11,fontWeight:600,color:'rgba(212,175,55,0.7)',letterSpacing:'0.5px'}}>MEDIA</div>
                  <div style={pg}>
                    <span style={pl}>Image / Video URL</span>
                    <input style={pi} value={sel.imgUrl} placeholder="https://... or double-click block" onChange={e=>updateSel({imgUrl:e.target.value})}/>
                  </div>
                  <button onClick={()=>handleImageUpload(sel.id)} style={{padding:'8px',border:`0.5px solid ${BORDER}`,borderRadius:6,background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.6)',fontSize:12,cursor:'pointer',fontFamily:SANS}}>
                    📁 Upload from device (or double-click block)
                  </button>
                  {sel.type==='image'&&<>
                    <div style={pg}>
                      <span style={pl}>Width: {sel.imgWidth||100}%</span>
                      <input type="range" min={20} max={100} value={sel.imgWidth||100} onChange={e=>updateSel({imgWidth:Number(e.target.value)})} style={{width:'100%',accentColor:GOLD}}/>
                    </div>
                    <div style={pg}>
                      <span style={pl}>Height: {sel.imgHeight||300}px</span>
                      <input type="range" min={80} max={800} value={sel.imgHeight||300} onChange={e=>updateSel({imgHeight:Number(e.target.value)})} style={{width:'100%',accentColor:GOLD}}/>
                    </div>
                  </>}
                  <div style={pg}>
                    <span style={pl}>Image Filter</span>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:4}}>
                      {IMG_FILTERS.map(f=>(
                        <button key={f.id} onClick={()=>updateSel({imgFilter:f.id})} style={{padding:'5px 2px',border:`0.5px solid ${sel.imgFilter===f.id?GOLD:BORDER}`,borderRadius:5,background:sel.imgFilter===f.id?'rgba(212,175,55,0.1)':'rgba(255,255,255,0.03)',fontSize:10,cursor:'pointer',color:sel.imgFilter===f.id?GOLD:MUTED,fontFamily:SANS}}>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={()=>alert('AI Image Enhance: removes noise, improves colour, upscales. Wire to image API in production.')} style={{padding:'7px',border:`0.5px solid rgba(212,175,55,0.3)`,borderRadius:6,background:'rgba(212,175,55,0.06)',color:GOLD,fontSize:12,cursor:'pointer',fontFamily:SANS}}>✨ Enhance with AI</button>
                </>}

                <div style={dv}/>
                <div style={pg}>
                  <span style={pl}>Padding (px)</span>
                  <div style={{display:'flex',gap:6}}>
                    {[['Top/Bot','paddingY'],['Left/Right','paddingX']].map(([l,k])=>(
                      <div key={k} style={{flex:1}}>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.2)',marginBottom:3}}>{l}</div>
                        <input type="number" style={{...pi,textAlign:'center'} as React.CSSProperties} value={sel[k as keyof Block] as number} min={0} max={200} onChange={e=>updateSel({[k]:Number(e.target.value)} as Partial<Block>)}/>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={pg}>
                  <span style={pl}>Smart Link</span>
                  <select style={{...pi,background:PANEL} as React.CSSProperties} value={sel.smartLink} onChange={e=>updateSel({smartLink:e.target.value})}>
                    {SMART_LINKS.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                <div style={pg}><span style={pl}>Analytics Tag (GA4)</span><input style={pi} value={sel.analyticsTag} placeholder="e.g. hero_cta_click" onChange={e=>updateSel({analyticsTag:e.target.value})}/></div>

                <div style={dv}/>
                <div style={pg}>
                  <span style={pl}>Visibility</span>
                  {[['Desktop','showDesktop'],['Mobile / App','showMobile'],['Published','published']].map(([l,k])=>(
                    <div key={k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0'}}>
                      <span style={{fontSize:12,color:MUTED}}>{l}</span>
                      <div onClick={()=>updateSel({[k]:!(sel[k as keyof Block] as boolean)} as Partial<Block>)} style={{width:32,height:18,borderRadius:9,background:(sel[k as keyof Block] as boolean)?GOLD:'rgba(255,255,255,0.15)',cursor:'pointer',position:'relative',transition:'background 0.2s'}}>
                        <div style={{position:'absolute',top:2,left:(sel[k as keyof Block] as boolean)?14:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <button onClick={()=>setShowAI(true)} style={{margin:'8px 12px 12px',padding:'10px 12px',border:`0.5px dashed rgba(212,175,55,0.4)`,borderRadius:8,background:'rgba(212,175,55,0.06)',cursor:'pointer',display:'flex',alignItems:'center',gap:8,color:GOLD,fontSize:12,fontFamily:SANS,flexShrink:0}}>
            <span style={{fontSize:15}}>✦</span> Ask AI for help
          </button>
        </div>
      </div>

      {/* TEMPLATE MODAL */}
      {showTpl&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:CARD,border:`0.5px solid ${BORDER}`,borderRadius:12,width:740,maxHeight:'85vh',display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:`0.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div><div style={{fontSize:15,fontWeight:600}}>Choose a Template</div><div style={{fontSize:11,color:MUTED,marginTop:2}}>Applies to current page</div></div>
              <button onClick={()=>setShowTpl(false)} style={{background:'none',border:'none',color:MUTED,cursor:'pointer',fontSize:18,fontFamily:SANS}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:20,display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
              {TEMPLATES.map(t=>(
                <div key={t.id} onClick={()=>setSelTpl(t.id)} style={{border:`1.5px solid ${selTpl===t.id?GOLD:BORDER}`,borderRadius:10,overflow:'hidden',cursor:'pointer',transform:selTpl===t.id?'translateY(-2px)':'none',transition:'all 0.15s',boxShadow:selTpl===t.id?`0 4px 20px rgba(212,175,55,0.15)`:'none'}}>
                  <div style={{height:130,background:t.bg,display:'flex',flexDirection:'column'}}>
                    <div style={{height:20,background:'rgba(0,0,0,0.2)',display:'flex',alignItems:'center',padding:'0 8px',gap:3}}>
                      {[1,2,3].map(i=><div key={i} style={{width:5,height:5,borderRadius:'50%',background:'rgba(255,255,255,0.2)'}}/>)}
                    </div>
                    <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5,padding:10}}>
                      <div style={{fontSize:12,fontWeight:700,color:t.primary,fontFamily:SERIF,textAlign:'center'}}>{t.name}</div>
                      <div style={{fontSize:9,color:t.bg===DARK||t.bg==='#1a3a1a'?'rgba(255,255,255,0.4)':'#888',textAlign:'center'}}>{t.desc}</div>
                    </div>
                  </div>
                  <div style={{padding:'8px 12px',borderTop:`0.5px solid ${BORDER}`,background:'#0d0d20'}}>
                    <div style={{fontSize:12,fontWeight:500,color:selTpl===t.id?GOLD:'#fff'}}>{t.name}</div>
                    <div style={{fontSize:11,color:MUTED}}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{padding:'14px 20px',borderTop:`0.5px solid ${BORDER}`,display:'flex',justifyContent:'flex-end',gap:8}}>
              <button onClick={()=>setShowTpl(false)} style={{padding:'8px 16px',background:'transparent',border:`0.5px solid ${BORDER}`,borderRadius:6,color:MUTED,cursor:'pointer',fontSize:12,fontFamily:SANS}}>Cancel</button>
              <button onClick={()=>applyTpl(selTpl)} style={{padding:'8px 20px',background:GOLD,border:'none',borderRadius:6,color:DARK,cursor:'pointer',fontSize:12,fontWeight:700,fontFamily:SANS}}>Apply Template →</button>
            </div>
          </div>
        </div>
      )}

      {/* VERSION PANEL */}
      {showVer&&(
        <div style={{position:'fixed',top:sel?94:52,right:242,width:230,background:CARD,border:`0.5px solid ${BORDER}`,borderRadius:'0 0 0 10px',boxShadow:'-4px 8px 24px rgba(0,0,0,0.4)',zIndex:100}}>
          <div style={{padding:'10px 14px',borderBottom:`0.5px solid ${BORDER}`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div style={{fontSize:12,fontWeight:500,color:MUTED}}>Version History</div>
            <button onClick={()=>setShowVer(false)} style={{background:'none',border:'none',color:MUTED,cursor:'pointer',fontSize:14,fontFamily:SANS}}>✕</button>
          </div>
          <div style={{padding:8}}>
            {page.versions.length===0
              ? <div style={{padding:16,textAlign:'center',fontSize:12,color:'rgba(255,255,255,0.2)'}}>No saved versions yet. Hit Save & Publish.</div>
              : page.versions.map((v,i)=>(
                  <div key={v.id} style={{padding:10,borderRadius:7,border:`0.5px solid ${i===0?'rgba(212,175,55,0.3)':'transparent'}`,background:i===0?'rgba(212,175,55,0.06)':'transparent',marginBottom:4}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div>
                        <div style={{fontSize:12,fontWeight:500,color:i===0?GOLD:'rgba(255,255,255,0.7)'}}>v{v.num} {i===0?'· Current':''}</div>
                        <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:2}}>{v.when}</div>
                      </div>
                      {i>0&&<button onClick={()=>{if(window.confirm('Restore this version?')){updateBlocks(()=>v.blocks);setShowVer(false);}}} style={{padding:'3px 8px',border:`0.5px solid ${BORDER}`,borderRadius:4,background:'transparent',color:MUTED,fontSize:10,cursor:'pointer',fontFamily:SANS}}>Restore</button>}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* AI PANEL */}
      {showAI&&(
        <div style={{position:'fixed',bottom:20,right:258,width:320,background:PANEL,border:`0.5px solid rgba(212,175,55,0.3)`,borderRadius:12,boxShadow:'0 8px 40px rgba(0,0,0,0.5)',zIndex:150,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 14px',background:'rgba(212,175,55,0.1)',borderBottom:`0.5px solid rgba(212,175,55,0.2)`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:12,fontWeight:600,color:GOLD}}>✦ AI Site Assistant</div>
              <div style={{fontSize:10,color:'rgba(212,175,55,0.5)',marginTop:1}}>Adds blocks · changes styles · acts on your site</div>
            </div>
            <button onClick={()=>setShowAI(false)} style={{background:'none',border:'none',color:MUTED,cursor:'pointer',fontSize:16,fontFamily:SANS}}>✕</button>
          </div>
          <div style={{padding:'7px 10px',borderBottom:`0.5px solid ${BORDER}`,display:'flex',gap:4,flexWrap:'wrap'}}>
            {['Add testimonial','Add two column','Make bigger','Add CTA','Add gallery'].map(p=>(
              <button key={p} onClick={()=>sendAI(p)} style={{padding:'3px 7px',border:`0.5px solid ${BORDER}`,borderRadius:10,background:'rgba(255,255,255,0.04)',color:'rgba(255,255,255,0.45)',fontSize:10,cursor:'pointer',fontFamily:SANS}}>{p}</button>
            ))}
          </div>
          <div style={{height:220,overflowY:'auto',padding:'10px 12px',display:'flex',flexDirection:'column',gap:8}}>
            {aiMsgs.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
                <div style={{maxWidth:'88%',padding:'8px 11px',borderRadius:m.role==='user'?'11px 11px 3px 11px':'11px 11px 11px 3px',background:m.role==='user'?'rgba(212,175,55,0.15)':'rgba(255,255,255,0.06)',border:`0.5px solid ${m.role==='user'?'rgba(212,175,55,0.3)':BORDER}`,fontSize:12,color:'rgba(255,255,255,0.85)',lineHeight:1.55}}>
                  {m.text}
                </div>
              </div>
            ))}
            <div ref={aiEndRef}/>
          </div>
          <div style={{padding:'8px 10px',borderTop:`0.5px solid ${BORDER}`,display:'flex',gap:6}}>
            <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendAI()} placeholder="Add a block, change style, resize..." style={{flex:1,background:'rgba(255,255,255,0.06)',border:`0.5px solid ${BORDER}`,color:'#fff',borderRadius:7,padding:'7px 10px',fontSize:12,outline:'none',fontFamily:SANS}}/>
            <button onClick={()=>sendAI()} style={{padding:'7px 13px',background:GOLD,border:'none',borderRadius:7,color:DARK,cursor:'pointer',fontSize:13,fontWeight:700,fontFamily:SANS}}>→</button>
          </div>
        </div>
      )}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.1);border-radius:2px;}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.2);}
        select option{background:#12122a;color:#fff;}
      `}</style>
    </div>
  );
}