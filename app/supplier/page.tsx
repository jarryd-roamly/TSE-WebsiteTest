'use client'
import { useState, useEffect, useRef } from 'react'

// ── DESIGN TOKENS ─────────────────────────────────────────────
const T = {
  bg: '#07080f', bg2: '#0d0e1a', surface: '#12142a', surface2: '#1a1c35',
  gold: '#d4af37', goldDim: 'rgba(212,175,55,0.12)', borderGold: 'rgba(212,175,55,0.25)',
  text: '#f0ede6', textMid: 'rgba(240,237,230,0.6)', textDim: 'rgba(240,237,230,0.32)',
  border: 'rgba(255,255,255,0.07)', green: '#4ade80', red: '#f87171',
  blue: '#60a5fa', amber: '#fbbf24', purple: '#a78bfa',
}

const SUPABASE_URL = 'https://zhkpxmcoklbmpsdcjffb.supabase.co'
const SUPABASE_KEY = 'sb_publishable_LjKnraC4RwaYLS9F-P-kww_nKljckkn'

async function sb(path: string, opts: any = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...opts.headers },
    ...opts
  })
  if (!res.ok) throw new Error(await res.text())
  const t = await res.text(); return t ? JSON.parse(t) : []
}

function fmt(n: number) { return `R ${Math.round(n).toLocaleString()}` }
function fmtDate(d: string) { return d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
function ts() { return new Date().toISOString() }

// ── ROLE DEFINITIONS ──────────────────────────────────────────
type Role = 'supplier_admin' | 'reservations_manager' | 'content_manager' | 'finance_contact' | 'sales_marketing'

const ROLE_TABS: Record<Role, string[]> = {
  supplier_admin: ['dashboard', 'bookings', 'rates', 'addons', 'content', 'reviews', 'campaigns', 'payments', 'api', 'feedback', 'chat', 'team'],
  reservations_manager: ['dashboard', 'bookings', 'rates', 'payments', 'chat'],
  content_manager: ['dashboard', 'content', 'reviews', 'chat'],
  finance_contact: ['dashboard', 'bookings', 'payments', 'chat'],
  sales_marketing: ['dashboard', 'campaigns', 'content', 'reviews', 'chat'],
}

const ROLE_LABELS: Record<Role, string> = {
  supplier_admin: 'Supplier Admin',
  reservations_manager: 'Reservations Manager',
  content_manager: 'Content Manager',
  finance_contact: 'Finance Contact',
  sales_marketing: 'Sales & Marketing',
}

const TAB_META: Record<string, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: '📊' },
  bookings: { label: 'Bookings', icon: '📋' },
  rates: { label: 'Rates & Contracts', icon: '💰' },
  addons: { label: 'Add-on Activities', icon: '🏊' },
  content: { label: 'Content & Media', icon: '📸' },
  reviews: { label: 'Reviews', icon: '⭐' },
  campaigns: { label: 'Campaigns', icon: '🎯' },
  payments: { label: 'Payments', icon: '🏦' },
  api: { label: 'API & Connections', icon: '🔌' },
  feedback: { label: 'Feedback', icon: '💬' },
  chat: { label: 'Messages', icon: '✉️' },
  team: { label: 'Team & Permissions', icon: '👥' },
}

// ── DEMO SUPPLIER DATA ─────────────────────────────────────────
const DEMO_SUPPLIER = {
  id: 'sup-singita-001',
  name: 'Singita Sabi Sand',
  type: 'Lodge',
  destination: 'Sabi Sand Game Reserve',
  country: 'South Africa',
  tagline: 'The pinnacle of the African safari experience',
  trust_score: 97,
  content_score: 88,
  commission_pct: 15,
  is_active: true,
  contract_start: '2025-01-01',
  payment_terms: 'End of Month Following Travel',
  annual_threshold_nights: 150,
  current_nights: 87,
  override_pct: 3,
}

const DEMO_BOOKINGS = [
  {
    ref: 'TSE-YMNCX0P8', supplier_ref: 'SING-2026-0714', guest: 'Johnson Family', 
    check_in: '2026-07-14', check_out: '2026-07-18', nights: 4,
    adults: 2, children: 2, room: 'Forest Suite', value: 224000, net_value: 189760,
    status: 'confirmed', payment_status: 'deposit_paid',
    deposit_pct: 30, deposit_paid: 67200, balance_due: 156800, balance_due_date: '2026-06-14',
    payment_terms: '30% deposit / 70% balance', payment_type: 'Deposit payment (1 of 2)',
    specialist: 'Sarah Mitchell', specialist_email: 'sarah@thesafariedition.com',
    origin_country: 'United Kingdom', origin_flag: '🇬🇧', origin_city: 'London',
    language: 'English', dietary: 'One vegetarian (adult female)', allergies: 'Tree nuts',
    preferences: 'Morning game drives preferred. Private vehicle if possible. Celebrating 10th anniversary.',
    special_requests: 'Rose petals on arrival. Champagne at sundowner.',
    notes: 'VIP family. Return guests — booked twice before. Very photography-focused.',
    contact: '+44 7711 234567'
  },
  {
    ref: 'TSE-0NOO3WOO', supplier_ref: 'SING-2026-0801', guest: 'Henderson Couple',
    check_in: '2026-08-01', check_out: '2026-08-07', nights: 6,
    adults: 2, children: 0, room: 'Private Villa', value: 465000, net_value: 394500,
    status: 'confirmed', payment_status: 'full_paid',
    deposit_pct: 80, deposit_paid: 372000, balance_due: 0, balance_due_date: '2026-07-01',
    payment_terms: '80% deposit / 20% balance', payment_type: 'Paid in full',
    specialist: 'James Okonkwo', specialist_email: 'james@thesafariedition.com',
    origin_country: 'United States', origin_flag: '🇺🇸', origin_city: 'New York',
    language: 'English', dietary: 'None', allergies: 'None known',
    preferences: 'Late wake-ups. Prefer afternoon drives. Interested in photographic safari.',
    special_requests: 'Private chef dinner on final night. Airport pick-up in Land Rover.',
    notes: 'High-net-worth. First safari. Very excited. Budget not a concern.',
    contact: '+1 212 555 0198'
  },
  {
    ref: 'TSE-BK9X2M11', supplier_ref: 'SING-2026-0912', guest: 'Van der Berg Group',
    check_in: '2026-09-12', check_out: '2026-09-16', nights: 4,
    adults: 4, children: 0, room: 'Luxury Suite x2', value: 312000, net_value: 265200,
    status: 'confirmed', payment_status: 'balance_due',
    deposit_pct: 25, deposit_paid: 78000, balance_due: 234000, balance_due_date: '2026-08-12',
    payment_terms: '25% deposit / 75% balance', payment_type: 'Balance due (2 of 2)',
    specialist: 'Priya Naidoo', specialist_email: 'priya@thesafariedition.com',
    origin_country: 'South Africa', origin_flag: '🇿🇦', origin_city: 'Cape Town',
    language: 'Afrikaans / English', dietary: 'Halaal (one guest)', allergies: 'Shellfish',
    preferences: 'Keen birders. Want maximum time in the bush. No spa.',
    special_requests: 'Binoculars available? Bird checklist for Sabi Sand?',
    notes: 'Corporate group — two couples. Domestic VIP. ABSA Bank relationship.',
    contact: '+27 21 555 0892'
  },
  {
    ref: 'TSE-HIST001', supplier_ref: 'SING-2026-0201', guest: 'Müller Family',
    check_in: '2026-02-10', check_out: '2026-02-17', nights: 7,
    adults: 2, children: 1, room: 'Luxury Suite', value: 186000, net_value: 157980,
    status: 'completed', payment_status: 'full_paid',
    deposit_pct: 50, deposit_paid: 93000, balance_due: 0, balance_due_date: '2026-01-10',
    payment_terms: '50% deposit / 50% balance', payment_type: 'Paid in full',
    specialist: 'Sarah Mitchell', specialist_email: 'sarah@thesafariedition.com',
    origin_country: 'Germany', origin_flag: '🇩🇪', origin_city: 'Munich',
    language: 'German / English', dietary: 'None', allergies: 'None',
    preferences: 'Green season specialists. Interested in birdlife and insects.',
    special_requests: 'German-speaking ranger if available.',
    notes: 'Conservation-focused. Photography. Excellent review left.',
    contact: '+49 89 555 0123'
  },
]

const DEMO_REMITTANCES = [
  { date: '2026-03-31', reference: 'REM-2026-03-001', bookings: 3, gross: 680000, commission: 102000, net: 578000, status: 'paid' },
  { date: '2026-04-30', reference: 'REM-2026-04-001', bookings: 2, gross: 445000, commission: 66750, net: 378250, status: 'pending' },
]

// ── MEAL BASIS OPTIONS ───────────────────────────────────────
const MEAL_OPTIONS_ALL=[
  'No meals',
  'Breakfast only',
  'Half board (breakfast & dinner)',
  'Full board (breakfast, lunch & dinner)',
  'All meals & soft drinks',
  'All meals, soft drinks, house wines & beers',
  'All meals & all drinks',
]

// ── AGE CATEGORIES ────────────────────────────────────────────
const AGE_CATEGORIES=[
  {id:'under2',label:'Under 2',default_free:true},
  {id:'age2to6',label:'2–6 years',default_pct:50},
  {id:'age7to12',label:'7–12 years',default_pct:75},
  {id:'age13to18',label:'13–18 years',default_pct:90},
  {id:'adult',label:'Adults (18+)',default_pct:100},
]

const DEMO_ROOMS = [
  { id: 'r1', name: 'Luxury Suite', type: 'Suite', max_adults: 2, max_children: 1, extra_beds: 1, net_rate_2ad: 28000, net_rate_2ad1ch: 35000, net_rate_2ad2ch: 42000, meal_basis: ['All-Inclusive','Half Board'], amenities: ['Private deck', 'Outdoor shower', 'Plunge pool', 'Mini bar', 'Air conditioning', 'Safe'], min_nights: 3, keywords: 'romantic, couple, view', children_policy: 'Children 7+ welcome. Under 7 on request.', children_on_drives: true, children_free_under: 2 },
  { id: 'r2', name: 'Forest Suite', type: 'Suite', max_adults: 2, max_children: 1, extra_beds: 0, net_rate_2ad: 32000, net_rate_2ad1ch: 39500, net_rate_2ad2ch: 47000, meal_basis: ['All-Inclusive','Bed & Breakfast'], amenities: ['Forest views', 'Private deck', 'Freestanding bath', 'Outdoor shower', 'Reading nook'], min_nights: 3, keywords: 'forest, quiet, intimate', children_policy: 'No children under 12.', children_on_drives: false, children_free_under: 0 },
  { id: 'r3', name: 'Private Villa', type: 'Villa', max_adults: 4, max_children: 3, extra_beds: 2, net_rate_2ad: 78000, net_rate_2ad1ch: 88000, net_rate_2ad2ch: 98000, meal_basis: ['All-Inclusive + Private Chef','Full Board','All-Inclusive'], amenities: ['Private pool', 'Full kitchen', 'Dedicated game vehicle', 'Butler', 'Gym', 'Cinema room'], min_nights: 4, keywords: 'family, group, exclusive, private', children_policy: 'All ages welcome. Under 2 free.', children_on_drives: true, children_free_under: 2 },
]

const DEMO_ADDONS = [
  { id: 'a1', name: 'Spa Treatment — 60min', category: 'Spa', net_rate: 1200, display_rate: 1560, duration: '60 min', max_pax: 1, notes: 'Advance booking required' },
  { id: 'a2', name: 'Bush Breakfast', category: 'Dining', net_rate: 800, display_rate: 1040, duration: '2 hours', max_pax: 6, notes: 'Subject to conditions' },
  { id: 'a3', name: 'Private Sundowner', category: 'Experience', net_rate: 1500, display_rate: 1950, duration: '2 hours', max_pax: 8, notes: 'Private vehicle required' },
  { id: 'a4', name: 'Guided Bush Walk', category: 'Activity', net_rate: 900, display_rate: 1170, duration: '3 hours', max_pax: 6, notes: 'Armed ranger included' },
]

const DEMO_REVIEWS = [
  { source: 'Internal', guest: 'Johnson Family', date: '2026-03-18', rating: 5, text: 'Absolutely flawless. The ranger was exceptional and the villa exceeded every expectation.', sentiment: 'positive' },
  { source: 'TripAdvisor', guest: 'Margaret H.', date: '2026-02-22', rating: 5, text: 'Best safari of my life. Singita is in a class of its own.', sentiment: 'positive' },
  { source: 'Google', guest: 'R. Vandenberg', date: '2026-01-15', rating: 4, text: 'Incredible wildlife, great staff. The food was good but not quite matching the price point.', sentiment: 'mixed' },
  { source: 'Booking.com', guest: 'Anonymous', date: '2025-12-08', rating: 3, text: 'Exceptional game viewing but WiFi was unreliable in the suites which was frustrating.', sentiment: 'mixed' },
]

const DEMO_CAMPAIGNS = [
  { id: 'c1', name: 'Winter Safari Special', type: 'Pay 5 Stay 6', status: 'active', approvals: { product: true, commercial: true, contracts: true }, bookings: 7, revenue: 1120000, start: '2026-06-01', end: '2026-08-31' },
  { id: 'c2', name: 'Early Bird 2027', type: 'Early Bird', status: 'pending_approval', approvals: { product: true, commercial: false, contracts: false }, bookings: 0, revenue: 0, start: '2026-10-01', end: '2027-03-31' },
]


const ALL_TAGS=[
  // Experience type
  'Big Five','Leopard specialist','Lion specialist','Wild dog','Rhino tracking','Walking safari',
  'Night drives','Mokoro','Boat safari','Fly camping','Horseback safari','Gorilla trekking',
  'Chimp trekking','Balloon safari','Helicopter','Birdwatching','Photography',
  // Guest type
  'Honeymoon','Anniversary','Family','Multi-generational','Solo','Group','Corporate',
  'Celebration','Milestone birthday','First safari',
  // Lodge features
  'Private pool','Plunge pool','Private vehicle','Exclusive use','Infinity pool','Spa',
  'Gym','Wine cellar','Private chef','Butler','Rooftop deck','Treehouse','Overwater villa',
  'Beach access','Riverside','Hillside views','Bush views','Mountain views','Desert',
  // Practical
  'Malaria-free','Child-friendly','Pet-friendly','Wheelchair accessible','LGBTQ+ welcoming',
  'Vegetarian-friendly','Vegan-friendly','Halaal','Kosher','Gluten-free available',
  // Conservation
  'Conservation','Anti-poaching','Community trust','Wildlife fund','Eco-certified',
  'Solar-powered','Carbon-neutral','Plastic-free','Water-wise',
  // Region
  'Sabi Sand','Kruger','Okavango','Chobe','Victoria Falls','Masai Mara','Serengeti',
  'Rwanda','Uganda','Namibia','Cape Town','Winelands','Garden Route','Zanzibar',
  'Seychelles','Maldives','Mauritius','Mozambique','Zambia','Zimbabwe',
  // Season
  'Peak season','Green season','Dry season','Migration','Calving season','Winter special',
  // Price signal
  'Ultra-luxury','Premium','Mid-range','Value','All-inclusive','Half board',
  // Special
  'Remote','Off-grid','Intimate','Adults-only','No Wi-Fi','Digital detox',
  'Star gazing','Cultural experience','Village visits','Beach and bush',
]

const DEMO_CHAT = [
  { id: 'm1', from: 'Contracts Team', role: 'edition', time: '2026-04-20 09:14', text: 'Hi Singita team — we have approved the Winter Safari Special. It will go live in the Experience Designer from 1 June. Please confirm your availability calendar is up to date on ResRequest.', audit: true },
  { id: 'm2', from: 'Sarah Dlamini', role: 'supplier', time: '2026-04-20 11:32', text: 'Confirmed. Calendar updated on ResRequest this morning. All June–August dates are loaded correctly.', audit: true },
  { id: 'm3', from: 'Contracts Team', role: 'edition', time: '2026-04-22 14:05', text: 'Rate recommendation received. We will review and come back within 5 business days as per SLA.', audit: true },
]

// ── SHARED UI COMPONENTS ──────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: color + '18', color, fontWeight: 600, border: `0.5px solid ${color}40` }}>
      {label}
    </span>
  )
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'Playfair Display',serif" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: any }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, ...style }}>
      {children}
    </div>
  )
}

function Btn({ label, onClick, variant = 'ghost', small = false }: { label: string; onClick?: () => void; variant?: 'gold' | 'ghost' | 'danger'; small?: boolean }) {
  const styles: any = {
    gold: { background: `linear-gradient(135deg,${T.gold},#f0c040)`, color: '#0a0a0a', border: 'none' },
    ghost: { background: 'transparent', color: T.textMid, border: `0.5px solid ${T.border}` },
    danger: { background: 'rgba(248,113,113,0.1)', color: T.red, border: `0.5px solid rgba(248,113,113,0.3)` },
  }
  return (
    <button onClick={onClick} style={{ ...styles[variant], padding: small ? '5px 12px' : '9px 18px', borderRadius: 8, fontSize: small ? 11 : 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
      {label}
    </button>
  )
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || T.gold, fontFamily: "'Playfair Display',serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

// ── INPUT HELPERS ─────────────────────────────────────────────
function Field({ label, value, onChange, type = 'text', placeholder = '' }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
    </div>
  )
}

function Select({ label, value, onChange, options }: any) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ role, setActiveTab }: { role: Role; setActiveTab: (t: string) => void }) {
  const thresholdPct = Math.round((DEMO_SUPPLIER.current_nights / DEMO_SUPPLIER.annual_threshold_nights) * 100)
  const estimatedOverride = Math.round(DEMO_SUPPLIER.current_nights * 56000 * (DEMO_SUPPLIER.override_pct / 100))
  const today = new Date().toISOString().slice(0, 10)
  const futureBookings = DEMO_BOOKINGS.filter(b => b.check_in >= today && b.status !== 'completed')
  const pastBookings = DEMO_BOOKINGS.filter(b => b.check_out < today || b.status === 'completed')
  const activeBookings = DEMO_BOOKINGS.filter(b => b.check_in <= today && b.check_out >= today)
  const [showScoreTip, setShowScoreTip] = useState<'trust'|'content'|null>(null)

  const TRUST_TIPS = [
    { label: 'Legal entity registration verified', impact: '+20 pts', done: true, detail: 'Business registration number on file and verified' },
    { label: 'Bank confirmation letter uploaded & verified', impact: '+20 pts', done: true, detail: 'Bank letter uploaded, account name matches legal entity' },
    { label: 'Average availability response time under 4 hours', impact: '+20 pts', done: false, detail: 'Current average: 9.2 hours. Respond to next 5 queries within 4h to start moving this score.' },
    { label: 'Zero confirmed bookings cancelled or overbooked (12 months)', impact: '+15 pts', done: true, detail: 'No incidents recorded. Maintain this by using PMS and checking availability before confirming.' },
    { label: 'At least 10 reviews connected, average 4.0+', impact: '+10 pts', done: true, detail: 'TripAdvisor 4.6 · Google 4.8 · 42 reviews connected' },
    { label: 'PMS connected for live availability', impact: '+8 pts', done: false, detail: 'Connect ResRequest or Nightsbridge in the API & Connections tab. Takes under 10 minutes.' },
    { label: 'Zero trade complaints in last 90 days', impact: '+7 pts', done: true, detail: 'Anonymous complaints from fellow suppliers. 3 complaints trigger a Catalogue Feedback review.' },
  ]
  const CONTENT_TIPS = [
    { label: 'Property description — 150+ words, AI-verified', impact: '+15 pts', done: true, detail: 'Current: 210 words. GPTZero: Human-written. Last updated 2026-02-14.' },
    { label: 'Room type descriptions — 100+ words each', impact: '+15 pts', done: false, detail: 'Forest Suite: 80 words (needs 20 more). Private Villa: 45 words (needs 55 more).' },
    { label: 'Photography — 12+ approved images, own photography', impact: '+20 pts', done: false, detail: 'You have 6 images. Upload 6 more to reach 12. At least 1 per room type required.' },
    { label: 'Arrival experience Reel (15–30s)', impact: '+8 pts', done: false, detail: 'Record a 20-second walkthrough on any smartphone. Upload here. Biggest single content score boost.' },
    { label: 'Room walkthrough Reel', impact: '+8 pts', done: false, detail: 'Show layout, bathroom, view, balcony. Keep it natural — no heavy editing needed.' },
    { label: 'Activity highlight Reel', impact: '+8 pts', done: true, detail: 'Approved. Last updated 2026-03-01.' },
    { label: 'Instagram connected', impact: '+4 pts', done: false, detail: 'Connect in API & Connections tab. Takes 30 seconds.' },
    { label: 'Facebook connected', impact: '+3 pts', done: false, detail: 'Connect in API & Connections tab.' },
    { label: 'YouTube channel connected', impact: '+3 pts', done: false, detail: 'Connect in API & Connections tab.' },
    { label: 'Knowledge Base entries — at least 3', impact: '+10 pts', done: false, detail: 'Add booking tips, room recommendations, seasonal advice. Your specialist knowledge injected into every AI response.' },
    { label: 'Keyword tags — at least 5 per room type', impact: '+5 pts', done: false, detail: 'Add tags like: Big Five, Honeymoon, Private pool, Malaria-free. Helps AI match guests to your property.' },
    { label: 'Content updated in last 12 months', impact: '+5 pts', done: true, detail: 'Last update: 2026-03-01.' },
  ]

  return (
    <div>
      {showScoreTip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 480 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, marginBottom: 4 }}>
              {showScoreTip === 'trust' ? `Trust Score — ${DEMO_SUPPLIER.trust_score}/100` : `Content Score — ${DEMO_SUPPLIER.content_score}/100`}
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>
              {showScoreTip === 'trust' ? 'How to improve your Trust Score' : 'How to improve your Content Score'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {(showScoreTip === 'trust' ? TRUST_TIPS : CONTENT_TIPS).map((tip, i) => (
                <div key={i} style={{ padding: '10px 12px', background: tip.done ? 'rgba(74,222,128,0.06)' : T.bg, borderRadius: 9, border: `0.5px solid ${tip.done ? 'rgba(74,222,128,0.2)' : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: tip.detail ? 4 : 0 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                      <span style={{ color: tip.done ? T.green : T.textDim, fontSize: 14, flexShrink: 0 }}>{tip.done ? '✓' : '○'}</span>
                      <span style={{ fontSize: 12, color: tip.done ? T.textMid : T.text, fontWeight: tip.done ? 400 : 600 }}>{tip.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: tip.done ? T.green : T.gold, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>{tip.done ? 'Done' : tip.impact}</span>
                  </div>
                  {(tip as any).detail && <div style={{ fontSize: 10, color: T.textDim, marginLeft: 22, lineHeight: 1.5 }}>{(tip as any).detail}</div>}
                </div>
              ))}
            </div>
            <button onClick={() => setShowScoreTip(null)} style={{ width: '100%', padding: '11px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, border: 'none', borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}

      <SectionHeader title={`Welcome back, ${DEMO_SUPPLIER.name}`} sub={`${ROLE_LABELS[role]} · ${DEMO_SUPPLIER.destination}, ${DEMO_SUPPLIER.country}`} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 24 }}>
        <div onClick={() => setShowScoreTip('trust')} style={{ background: T.surface, border: `0.5px solid rgba(74,222,128,0.3)`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Trust Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.green, fontFamily: "'Playfair Display',serif" }}>{DEMO_SUPPLIER.trust_score}/100</div>
          <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>↑ 2 pts · Tap for tips →</div>
        </div>
        <div onClick={() => setShowScoreTip('content')} style={{ background: T.surface, border: `0.5px solid rgba(251,191,36,0.3)`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Content Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.amber, fontFamily: "'Playfair Display',serif" }}>{DEMO_SUPPLIER.content_score}/100</div>
          <div style={{ fontSize: 10, color: T.amber, marginTop: 4 }}>2 Reels missing · Tap for tips →</div>
        </div>
        <div onClick={() => setActiveTab('bookings')} style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Future bookings</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display',serif" }}>{futureBookings.length}</div>
          <div style={{ fontSize: 10, color: T.gold, marginTop: 4 }}>View all →</div>
        </div>
        <div onClick={() => setActiveTab('bookings')} style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Past bookings</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.textMid, fontFamily: "'Playfair Display',serif" }}>{pastBookings.length}</div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>View history →</div>
        </div>
        <StatTile label="YTD Nights" value={`${DEMO_SUPPLIER.current_nights}`} sub={`of ${DEMO_SUPPLIER.annual_threshold_nights} threshold`} />
        <StatTile label="Override est." value={fmt(estimatedOverride)} color={T.gold} sub="At current pace" />
      </div>

      {/* Override progress */}
      <Card style={{ padding: '18px 20px', marginBottom: 16, border: `0.5px solid ${T.borderGold}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Volume Override Progress</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
              {DEMO_SUPPLIER.current_nights} nights confirmed · {DEMO_SUPPLIER.annual_threshold_nights - DEMO_SUPPLIER.current_nights} nights to threshold
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{thresholdPct}%</div>
            <div style={{ fontSize: 10, color: T.textDim }}>{DEMO_SUPPLIER.override_pct}% override on all nights</div>
          </div>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${thresholdPct}%`, height: '100%', background: `linear-gradient(90deg,${T.gold},#f0c040)`, borderRadius: 4, transition: 'width 0.8s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ fontSize: 10, color: T.textDim }}>0</div>
          <div style={{ fontSize: 10, color: T.gold }}>Threshold: {DEMO_SUPPLIER.annual_threshold_nights} nights</div>
        </div>
      </Card>

      {/* Recent bookings */}
      <Card style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.text }}>Recent Bookings</div>
        {DEMO_BOOKINGS.map((b, i) => (
          <div key={i} style={{ padding: '11px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>{b.ref}</div>
              <div style={{ fontSize: 11, color: T.textMid, marginTop: 1 }}>{b.guest} · {b.room} · {b.nights}n</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{fmtDate(b.check_in)} → {fmtDate(b.check_out)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{role === 'finance_contact' ? fmt(b.value) : `${b.adults + b.children} guests`}</div>
              <Badge label={b.payment_status.replace(/_/g, ' ')} color={b.payment_status === 'full_paid' ? T.green : T.amber} />
            </div>
          </div>
        ))}
      </Card>

      {/* AI sentiment summary */}
      <Card style={{ padding: '18px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>AI Sentiment Summary — this week</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: T.green, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>Guests love</div>
            {['Ranger and tracker quality', 'Bush experience authenticity', 'Room size and privacy'].map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textMid, display: 'flex', gap: 6, marginBottom: 4 }}>
                <span style={{ color: T.green }}>✓</span>{t}
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 10, color: T.amber, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 600 }}>Guests flag</div>
            {[{ issue: 'WiFi unreliable in suites', action: 'Recommend Starlink upgrade' }, { issue: 'Food not at price level', action: 'Review F&B provider' }, { issue: 'Early game drive intensity', action: 'Offer flexible wake-up option' }].map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: T.textMid, marginBottom: 6 }}>
                <div style={{ display: 'flex', gap: 6 }}><span style={{ color: T.amber }}>!</span>{t.issue}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginLeft: 14 }}>→ {t.action}</div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: RATES & CONTRACTS
// ══════════════════════════════════════════════════════════════
function RatesContracts({ role }: { role: Role }) {
  const [tab, setTab] = useState<'rooms' | 'history' | 'repository' | 'recommend'>('rooms')
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [rooms, setRooms] = useState(DEMO_ROOMS)
  const [amendRoom, setAmendRoom] = useState<any>(null)
  const [recSent, setRecSent] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string|null>(null)
  const [docs, setDocs] = useState([
    { name: 'Master Rate Agreement 2025–2026.pdf', type: 'Contract', uploaded: '2025-01-15', size: '2.1 MB', status: 'active' },
    { name: 'Override Incentive Addendum April 2026.pdf', type: 'Override', uploaded: '2026-04-01', size: '0.8 MB', status: 'active' },
    { name: 'Bank Confirmation Letter — FNB.pdf', type: 'Banking', uploaded: '2026-03-10', size: '0.3 MB', status: 'verified' },
  ])
  const [newRoom, setNewRoom] = useState<any>({
    name: '', type: 'Suite', max_adults: 2, max_children: 1,
    extra_beds: 0, min_nights: 2, amenities: '', keywords: '',
    children_policy: '', children_on_drives: true, children_free_under: 2,
    rates: [{ meal_basis: 'Breakfast only', net_2ad: '', add_adult: '', add_ch_0_5: '', add_ch_6_12: '', add_ch_13_18: '' }]
  })
  const [rateErrors, setRateErrors] = useState<string[]>([])

  const ROOM_TYPES = ['Suite', 'Villa', 'Tent', 'Chalet', 'Room', 'Cottage', 'House']
  const MEAL_OPTIONS = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All-Inclusive', 'All-Inclusive + Private Chef']

  return (
    <div>
      <SectionHeader title="Rates & Contracts" sub="View your current rates and submit rate recommendations to the Contracts team." />

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[{ id: 'rooms', label: 'Rate Card' }, { id: 'history', label: 'Rate History' }, { id: 'repository', label: 'Documents & Contracts' }, { id: 'recommend', label: 'Submit Amendment' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `0.5px solid ${tab === t.id ? T.gold : T.border}`, background: tab === t.id ? T.goldDim : 'transparent', color: tab === t.id ? T.gold : T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t.id ? 600 : 400 }}>
            {t.label}
          </button>
        ))}
        <button onClick={() => setShowRoomForm(v => !v)}
          style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg,${T.gold},#f0c040)`, color: '#0a0a0a', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          {showRoomForm ? '✕ Cancel' : '+ Add Room Type'}
        </button>
      </div>

      {/* Amendment modal — pre-filled from row */}
      {amendRoom && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 500 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.gold, marginBottom: 4 }}>Propose Rate Amendment</div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Pre-filled from current rate card. Edit your proposed changes and submit to the Contracts team.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Room (locked)</label>
                <div style={{ padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textMid }}>{amendRoom.name}</div>
              </div>
              <Field label="Proposed net rate PPPN (ZAR)" value={String(amendRoom._proposed_rate || amendRoom.net_rate)} onChange={(v: string) => setAmendRoom((r: any) => ({...r, _proposed_rate: v}))} type="number" />
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Current net rate</label>
                <div style={{ padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textMid }}>{fmt(amendRoom.net_rate)}</div>
              </div>
              <Field label="Effective date" value={amendRoom._effective_date || ''} onChange={(v: string) => setAmendRoom((r: any) => ({...r, _effective_date: v}))} type="date" />
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Max adults (current: {amendRoom.max_adults})</label>
                <input type="number" defaultValue={amendRoom.max_adults} onChange={e => setAmendRoom((r: any) => ({...r, _max_adults: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Min nights (current: {amendRoom.min_nights})</label>
                <input type="number" defaultValue={amendRoom.min_nights} onChange={e => setAmendRoom((r: any) => ({...r, _min_nights: e.target.value}))}
                  style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Reason for amendment</label>
              <textarea value={amendRoom._reason || ''} onChange={e => setAmendRoom((r: any) => ({...r, _reason: e.target.value}))} rows={3} placeholder="e.g. Annual rate review, new amenities added, market conditions..."
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
            </div>
            {recSent ? (
              <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '12px', textAlign: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 13, color: T.green, fontWeight: 700 }}>✓ Amendment submitted to Contracts team</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Review within 5 business days. You will be notified of approval or rejection with reason.</div>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="gold" label={recSent ? 'Close' : 'Submit Amendment →'} onClick={() => { if (recSent) { setAmendRoom(null); setRecSent(false) } else setRecSent(true) }} />
              <Btn label="Cancel" onClick={() => { setAmendRoom(null); setRecSent(false) }} />
            </div>
          </div>
        </div>
      )}

      {/* Add room form */}
      {showRoomForm && (() => {
        const updateRate = (idx: number, field: string, val: string) => {
          setNewRoom((r: any) => ({ ...r, rates: r.rates.map((row: any, i: number) => i === idx ? { ...row, [field]: val } : row) }))
        }
        const addRateRow = () => {
          const used = newRoom.rates.map((r: any) => r.meal_basis)
          const next = MEAL_OPTIONS_ALL.find(m => !used.includes(m)) || MEAL_OPTIONS_ALL[0]
          setNewRoom((r: any) => ({ ...r, rates: [...r.rates, { meal_basis: next, net_2ad: '', add_adult: '', add_ch_0_5: '', add_ch_6_12: '', add_ch_13_18: '' }] }))
        }
        const removeRateRow = (idx: number) => {
          if (newRoom.rates.length <= 1) return
          setNewRoom((r: any) => ({ ...r, rates: r.rates.filter((_: any, i: number) => i !== idx) }))
        }
        const validateAndSave = () => {
          const errors: string[] = []
          if (!newRoom.name.trim()) errors.push('Room name is required.')
          if (newRoom.max_adults < 1) errors.push('Max adults must be at least 1.')
          if (newRoom.min_nights < 1) errors.push('Minimum nights must be at least 1.')
          for (const [i, row] of newRoom.rates.entries()) {
            const base = Number(row.net_2ad)
            const addAd = Number(row.add_adult)
            const ch05 = Number(row.add_ch_0_5)
            const ch612 = Number(row.add_ch_6_12)
            const ch1318 = Number(row.add_ch_13_18)
            if (!base || base < 100) { errors.push(`Row ${i+1}: Net rate for 2 adults must be at least R100.`); continue }
            if (addAd < 0) errors.push(`Row ${i+1}: Additional adult rate cannot be negative.`)
            if (ch05 < 0) errors.push(`Row ${i+1}: Child rate 0–5 cannot be negative.`)
            if (ch612 < 0) errors.push(`Row ${i+1}: Child rate 6–12 cannot be negative.`)
            if (ch1318 < 0) errors.push(`Row ${i+1}: Child rate 13–18 cannot be negative.`)
            if (ch05 > ch612) errors.push(`Row ${i+1}: Child rate 0–5 is higher than 6–12 — is this intentional?`)
            if (ch612 > ch1318) errors.push(`Row ${i+1}: Child rate 6–12 is higher than 13–18 — is this intentional?`)
            if (ch1318 > addAd && addAd > 0) errors.push(`Row ${i+1}: Child 13–18 rate is higher than adult rate — please check.`)
            if (addAd > base) errors.push(`Row ${i+1}: Additional adult rate (${addAd}) exceeds base 2-adult rate (${base}) — this seems high. Please check.`)
          }
          setRateErrors(errors)
          if (errors.filter(e => !e.includes('intentional') && !e.includes('seems high')).length > 0) return
          const primaryRate = newRoom.rates[0]
          setRooms((rs: any[]) => [...rs, {
            id: `r${Date.now()}`,
            name: newRoom.name, type: newRoom.type,
            max_adults: newRoom.max_adults, max_children: newRoom.max_children,
            extra_beds: newRoom.extra_beds, min_nights: newRoom.min_nights,
            net_rate_2ad: Number(primaryRate.net_2ad),
            net_rate_2ad1ch: Number(primaryRate.net_2ad) + Number(primaryRate.add_ch_6_12 || 0),
            net_rate_2ad2ch: Number(primaryRate.net_2ad) + 2 * Number(primaryRate.add_ch_6_12 || 0),
            meal_basis: newRoom.rates.map((r: any) => r.meal_basis),
            amenities: newRoom.amenities.split(',').map((s: string) => s.trim()).filter(Boolean),
            keywords: newRoom.keywords,
            children_policy: newRoom.children_policy,
            children_on_drives: newRoom.children_on_drives,
            children_free_under: newRoom.children_free_under,
            rates: newRoom.rates,
          }])
          setShowRoomForm(false)
          setRateErrors([])
          setNewRoom({ name: '', type: 'Suite', max_adults: 2, max_children: 1, extra_beds: 0, min_nights: 2, amenities: '', keywords: '', children_policy: '', children_on_drives: true, children_free_under: 2, rates: [{ meal_basis: 'Breakfast only', net_2ad: '', add_adult: '', add_ch_0_5: '', add_ch_6_12: '', add_ch_13_18: '' }] })
        }

        return (
          <Card style={{ padding: 22, marginBottom: 16, border: `0.5px solid ${T.borderGold}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginBottom: 18 }}>New Room / Accommodation Type</div>

            {/* Room identity */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <Field label="Room name *" value={newRoom.name} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, name: v }))} placeholder="e.g. Boulders Suite" />
              <Select label="Room type" value={newRoom.type} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, type: v }))} options={ROOM_TYPES.map(t => ({ value: t, label: t }))} />
              <Field label="Max adults" value={String(newRoom.max_adults)} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, max_adults: Number(v) }))} type="number" />
              <Field label="Max children" value={String(newRoom.max_children)} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, max_children: Number(v) }))} type="number" />
              <Field label="Extra beds" value={String(newRoom.extra_beds)} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, extra_beds: Number(v) }))} type="number" />
              <Field label="Minimum nights" value={String(newRoom.min_nights)} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, min_nights: Number(v) }))} type="number" />
            </div>

            {/* Rate table */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 700 }}>Rate sheet — net rates per night (ZAR)</label>
                <button onClick={addRateRow} disabled={newRoom.rates.length >= MEAL_OPTIONS_ALL.length}
                  style={{ padding: '4px 12px', borderRadius: 7, border: `0.5px solid ${T.borderGold}`, background: T.goldDim, color: T.gold, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + Add meal basis row
                </button>
              </div>
              <div style={{ background: T.bg, borderRadius: 10, overflow: 'hidden', border: `0.5px solid ${T.border}` }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 0.85fr 0.85fr 0.85fr 30px', gap: 0, background: T.surface }}>
                  {['Meal basis','2 Adults (base)','Add. per adult','Child 0–5','Child 6–12','Child 13–18',''].map((h, hi) => (
                    <div key={hi} style={{ padding: '8px 10px', fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700, borderRight: hi < 6 ? `0.5px solid ${T.border}` : 'none' }}>{h}</div>
                  ))}
                </div>
                {/* Rate rows */}
                {newRoom.rates.map((row: any, idx: number) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 0.85fr 0.85fr 0.85fr 30px', gap: 0, borderTop: `0.5px solid ${T.border}`, background: idx%2===1?'rgba(255,255,255,0.01)':'transparent' }}>
                    <div style={{ padding: '6px 8px', borderRight: `0.5px solid ${T.border}` }}>
                      <select value={row.meal_basis} onChange={e => updateRate(idx, 'meal_basis', e.target.value)}
                        style={{ width: '100%', padding: '6px 8px', background: 'transparent', border: 'none', color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                        {MEAL_OPTIONS_ALL.map(m => <option key={m} value={m} style={{ background: '#12142a' }}>{m}</option>)}
                      </select>
                    </div>
                    {(['net_2ad','add_adult','add_ch_0_5','add_ch_6_12','add_ch_13_18'] as const).map((field, fi) => (
                      <div key={field} style={{ padding: '6px 8px', borderRight: `0.5px solid ${T.border}` }}>
                        <input
                          type="number"
                          value={row[field]}
                          onChange={e => updateRate(idx, field, e.target.value)}
                          placeholder={fi===0?'e.g. 28000':fi===1?'e.g. 8000':'e.g. 0'}
                          style={{ width: '100%', background: 'transparent', border: 'none', color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', padding: 0, textAlign: 'right' as const }}
                        />
                        {row[field] && Number(row[field]) > 0 && (
                          <div style={{ fontSize: 9, color: T.textDim, textAlign: 'right' as const, marginTop: 1 }}>
                            {fi===0?`= ${fmt(Number(row.net_2ad))}`:fi > 0 ? `${Math.round((Number(row[field])/Math.max(Number(row.net_2ad),1))*100)}% of base` : ''}
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <button onClick={() => removeRateRow(idx)} disabled={newRoom.rates.length <= 1}
                        style={{ background: 'none', border: 'none', color: newRoom.rates.length <= 1 ? T.textDim : T.red, cursor: newRoom.rates.length <= 1 ? 'default' : 'pointer', fontSize: 14, lineHeight: 1, padding: '4px' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>
                Base rate is for 2 adults. Additional rates are per person, per night. Enter 0 or leave blank if not applicable.
                {newRoom.max_children === 0 && ' · This room type has no children — child rate columns will be ignored.'}
              </div>
            </div>

            {/* Children policy */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Children policy</label>
                <input value={newRoom.children_policy} onChange={e => setNewRoom((r: any) => ({ ...r, children_policy: e.target.value }))} placeholder="e.g. Children 7+ welcome. Under 7 on request."
                  style={{ width: '100%', padding: '8px 10px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Children free under age</label>
                <select value={newRoom.children_free_under} onChange={e => setNewRoom((r: any) => ({ ...r, children_free_under: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '8px 10px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.text, fontSize: 12, outline: 'none', fontFamily: 'inherit' }}>
                  {[0,1,2,3,4,5,6].map(n => <option key={n} value={n}>{n===0?'No free children':n===1?'Under 1 (infants only)':`Under ${n} years`}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: T.bg, borderRadius: 8, border: `0.5px solid ${T.border}` }}>
                <button onClick={() => setNewRoom((r: any) => ({ ...r, children_on_drives: !r.children_on_drives }))}
                  style={{ width: 36, height: 20, borderRadius: 10, border: 'none', background: newRoom.children_on_drives ? T.green : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative' as const, flexShrink: 0 }}>
                  <div style={{ position: 'absolute' as const, top: 2, left: newRoom.children_on_drives ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                </button>
                <div>
                  <div style={{ fontSize: 12, color: T.text }}>Children permitted on game drives</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{newRoom.children_on_drives ? 'Yes — subject to min age policy above' : 'No — this room type does not permit children on drives'}</div>
                </div>
              </div>
            </div>

            {/* Amenities + Tags */}
            <div style={{ marginBottom: 16 }}>
              <Field label="Amenities (comma separated)" value={newRoom.amenities} onChange={(v: string) => setNewRoom((r: any) => ({ ...r, amenities: v }))} placeholder="Private deck, Plunge pool, Outdoor shower, Mini bar" />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>Tags (click to add · {ALL_TAGS.length} available)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 110, overflowY: 'auto', padding: 8, background: T.bg, borderRadius: 8, border: `0.5px solid ${T.border}` }}>
                {ALL_TAGS.map(tag => {
                  const sel = (newRoom.keywords||'').split(',').map((t: string) => t.trim()).filter(Boolean).includes(tag)
                  return (
                    <button key={tag} onClick={() => {
                      const cur = (newRoom.keywords||'').split(',').map((t: string) => t.trim()).filter(Boolean)
                      setNewRoom((r: any) => ({ ...r, keywords: (sel ? cur.filter((t: string) => t !== tag) : [...cur, tag]).join(', ') }))
                    }}
                    style={{ padding: '3px 8px', borderRadius: 20, border: `0.5px solid ${sel?T.gold:T.border}`, background: sel?T.goldDim:'transparent', color: sel?T.gold:T.textDim, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const }}>
                      {tag}
                    </button>
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
                {(newRoom.keywords||'').split(',').filter((t: string) => t.trim()).length} tags selected
              </div>
            </div>

            {/* Validation errors */}
            {rateErrors.length > 0 && (
              <div style={{ marginBottom: 14, background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.3)', borderRadius: 9, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.red, marginBottom: 6 }}>Please review before saving:</div>
                {rateErrors.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: rateErrors[i].includes('intentional')||rateErrors[i].includes('seems high') ? T.amber : T.red, display: 'flex', gap: 6, marginBottom: 3 }}>
                    <span>{rateErrors[i].includes('intentional')||rateErrors[i].includes('seems high')?'⚠':'✗'}</span>{e}
                  </div>
                ))}
                {rateErrors.some(e => e.includes('intentional') || e.includes('seems high')) && (
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 6 }}>Warnings (⚠) won't block saving — click Save again to confirm.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <Btn variant="gold" label="Save Room Type" onClick={validateAndSave} />
              <Btn label="Cancel" onClick={() => { setShowRoomForm(false); setRateErrors([]) }} />
            </div>
          </Card>
        )
      })()}

      {/* Rate card */}
      {tab === 'rooms' && (
        <div>
          <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: T.gold }}>
            ✦ Rates are view-only. To request a rate change, use the "Submit Recommendation" tab. All changes are reviewed by the Contracts team.
          </div>
          {/* Meal basis rate table per room */}
          {rooms.map((r, ri) => {
            // Support both old flat structure and new rates[] array
            const rateRows: any[] = r.rates && r.rates.length > 0
              ? r.rates
              : (Array.isArray(r.meal_basis) ? r.meal_basis : [r.meal_basis]).map((mb: string) => ({
                  meal_basis: mb,
                  net_2ad: r.net_rate_2ad || r.net_rate || 0,
                  add_adult: 0,
                  add_ch_0_5: 0,
                  add_ch_6_12: Math.round(((r.net_rate_2ad1ch||0) - (r.net_rate_2ad||0)) || 0),
                  add_ch_13_18: Math.round(((r.net_rate_2ad2ch||0) - (r.net_rate_2ad||0)) * 0.7 || 0),
                }))

            return (
            <div key={ri} style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>
                    {r.type} · Min {r.min_nights} nights · Max {r.max_adults} adults, {r.max_children} children
                    {r.extra_beds > 0 ? ` · Extra beds: ${r.extra_beds}` : ''}
                  </div>
                </div>
                <button onClick={() => { setAmendRoom({...r}); setRecSent(false) }}
                  style={{ padding: '5px 12px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 7, color: T.gold, fontSize: 10, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Propose amendment
                </button>
              </div>

              {/* Rate table — per meal basis row */}
              <Card style={{ overflow: 'hidden', marginBottom: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 0.8fr', gap: 0, borderBottom: `0.5px solid ${T.border}`, background: T.surface }}>
                  {['Meal basis','2 Adults','Add. per adult','Child 0–5','Child 6–12','Child 13–18'].map((h, hi) => (
                    <div key={hi} style={{ padding: '8px 12px', fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 700, borderRight: hi < 5 ? `0.5px solid ${T.border}` : 'none' }}>{h}</div>
                  ))}
                </div>
                {rateRows.map((row: any, mi: number) => {
                  const base = Number(row.net_2ad || row.net_rate_2ad || 0)
                  const addAd = Number(row.add_adult || 0)
                  const ch05 = Number(row.add_ch_0_5 || 0)
                  const ch612 = Number(row.add_ch_6_12 || 0)
                  const ch1318 = Number(row.add_ch_13_18 || 0)
                  return (
                    <div key={mi} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 0.8fr 0.8fr 0.8fr', gap: 0, borderBottom: `0.5px solid ${T.border}`, alignItems: 'center', background: mi%2===1?'rgba(255,255,255,0.01)':'transparent' }}>
                      <div style={{ padding: '9px 12px', fontSize: 12, color: T.text, borderRight: `0.5px solid ${T.border}` }}>{row.meal_basis}</div>
                      <div style={{ padding: '9px 12px', borderRight: `0.5px solid ${T.border}` }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.gold }}>{fmt(base)}</div>
                        <div style={{ fontSize: 9, color: T.textDim }}>2 adults/night</div>
                      </div>
                      <div style={{ padding: '9px 12px', borderRight: `0.5px solid ${T.border}` }}>
                        {addAd > 0 ? (
                          <>
                            <div style={{ fontSize: 12, color: T.textMid }}>{fmt(addAd)}</div>
                            <div style={{ fontSize: 9, color: T.textDim }}>{base > 0 ? `${Math.round((addAd/base)*100)}% of base` : ''}</div>
                          </>
                        ) : <div style={{ fontSize: 11, color: T.textDim }}>—</div>}
                      </div>
                      {[[ch05,'0–5'],[ch612,'6–12'],[ch1318,'13–18']].map(([val, label], ci) => (
                        <div key={ci} style={{ padding: '9px 12px', borderRight: ci < 2 ? `0.5px solid ${T.border}` : 'none' }}>
                          {r.max_children === 0 ? (
                            <div style={{ fontSize: 10, color: T.textDim }}>N/A</div>
                          ) : Number(val) === 0 && r.children_free_under > Number(label.split('–')[0]) ? (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 700, color: T.green }}>Free</div>
                              <div style={{ fontSize: 9, color: T.textDim }}>Under {r.children_free_under}</div>
                            </>
                          ) : Number(val) > 0 ? (
                            <>
                              <div style={{ fontSize: 12, color: T.textMid }}>{fmt(Number(val))}</div>
                              <div style={{ fontSize: 9, color: T.textDim }}>{base > 0 ? `${Math.round((Number(val)/base)*100)}% of base` : ''}</div>
                            </>
                          ) : (
                            <div style={{ fontSize: 11, color: T.textDim }}>—</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </Card>

              {/* Children policy */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 4 }}>
                <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>Children policy</div>
                  <div style={{ fontSize: 11, color: T.textMid }}>{r.children_policy||'Contact for children policy'}</div>
                </div>
                <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                  <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>Game drives / Activities</div>
                  <div style={{ fontSize: 11, color: r.children_on_drives?T.green:T.amber }}>{r.children_on_drives?'Children welcome on drives':'Children not permitted on drives'}</div>
                  {r.children_free_under > 0 && <div style={{ fontSize: 10, color: T.textDim }}>Under {r.children_free_under}: Free</div>}
                </div>
              </div>

              {/* Tags */}
              {r.keywords && r.keywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                  {String(r.keywords).split(',').map((t: string) => t.trim()).filter(Boolean).map((tag: string, ti: number) => (
                    <span key={ti} style={{ fontSize: 9, color: T.textDim, background: 'rgba(255,255,255,0.04)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '2px 8px' }}>{tag}</span>
                  ))}
                </div>
              )}

              {ri < rooms.length-1 && <div style={{ height: 1, background: T.border, margin: '14px 0' }}/>}
            </div>
            )
          })}
          <div style={{ marginTop: 14, display: 'flex', gap: 10, fontSize: 12, color: T.textDim, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>Payment terms: <span style={{ color: T.gold, cursor: 'pointer' }} title={DEMO_SUPPLIER.payment_terms}>{DEMO_SUPPLIER.payment_terms.slice(0,30)}{DEMO_SUPPLIER.payment_terms.length>30?'…':''}</span></div>
            <div>·</div>
            <div>Commission: <span style={{ color: T.gold }}>{DEMO_SUPPLIER.commission_pct}%</span></div>
            <div>·</div>
            <div>Override: <span style={{ color: T.green }}>{DEMO_SUPPLIER.override_pct}% above {DEMO_SUPPLIER.annual_threshold_nights} nights</span></div>
            <div>·</div>
            <div onClick={() => setTab('repository')} style={{ color: T.blue, cursor: 'pointer' }}>View contract PDF ↗</div>
          </div>

          {/* Campaign pricing note */}
          <div style={{ marginTop: 12, background: 'rgba(167,139,250,0.06)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: T.purple, marginBottom: 4 }}>How campaigns affect your rate card</div>
            <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>
              Active campaigns (e.g. Pay 5 Stay 6) are applied on top of your contracted net rates. The Edition handles all campaign pricing calculations. 
              Your net rate stays the same — we absorb the complimentary night by reducing our margin, not your income. 
              When a campaign is active, the Experience Designer surfaces your property higher in the swipe stack.
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
              <button onClick={() => {}} style={{ fontSize: 11, color: T.purple, padding: '4px 10px', border: '0.5px solid rgba(167,139,250,0.3)', borderRadius: 6, background: 'rgba(167,139,250,0.08)', cursor: 'pointer', fontFamily: 'inherit' }}>
                View active campaigns ↗
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate history */}
      {tab === 'history' && (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.text }}>Rate Change History</div>
          {[
            { date: '2026-01-01', room: 'Luxury Suite', from: 26000, to: 28000, reason: 'Annual rate review — approved', status: 'approved' },
            { date: '2025-07-01', room: 'Private Villa', from: 72000, to: 78000, reason: 'Peak season adjustment', status: 'approved' },
            { date: '2025-03-15', room: 'Forest Suite', from: 34000, to: 32000, reason: 'Off-peak reduction request — approved', status: 'approved' },
          ].map((h, i) => (
            <div key={i} style={{ padding: '12px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: T.text }}>{h.room}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{h.reason}</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>{fmt(h.from)} → <span style={{ color: T.gold }}>{fmt(h.to)}</span></div>
                  <div style={{ fontSize: 10, color: T.textDim }}>{fmtDate(h.date)}</div>
                </div>
                <Badge label={h.status} color={T.green} />
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Submit amendment — shown when tab is 'recommend' */}
      {tab === 'recommend' && (
        <Card style={{ padding: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginBottom: 8 }}>How to propose a rate amendment</div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7, marginBottom: 16 }}>
            Click <strong style={{ color: T.gold }}>"Propose amendment"</strong> on any room in the Rate Card tab. A pre-filled form will open with the current rates and room details. Edit only the fields you want to change, add a reason, and submit. The Contracts team will review within 5 business days and notify you of approval or rejection with a reason.
          </div>
          <div style={{ background: 'rgba(96,165,250,0.06)', border: '0.5px solid rgba(96,165,250,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: T.blue }}>
            All amendment requests are permanently logged. You cannot change live rates directly. The Safari Edition Contracts team has final approval on all rate changes.
          </div>
          <button onClick={() => setTab('rooms')} style={{ marginTop: 16, padding: '10px 20px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, border: 'none', borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Go to Rate Card →
          </button>
        </Card>
      )}

      {/* Document repository */}
      {tab === 'repository' && (
        <div>
          <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.gold }}>
            ✦ Upload contracts, overrides, and bank confirmation letters here. AI will automatically extract contracted rates from uploaded PDFs for Contracts team review.
          </div>

          {/* AI scan feature */}
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>AI Contract Rate Scanner</div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>Upload a signed rate agreement PDF and our AI will automatically extract room types, rates, meal basis, and dates — ready for Contracts team review and approval. Avoids manual re-entry.</div>
            <div style={{ padding: '24px', background: T.bg, border: `1.5px dashed ${scanning ? T.gold : T.border}`, borderRadius: 12, textAlign: 'center', cursor: 'pointer', marginBottom: 12, transition: 'border-color 0.2s' }}
              onClick={() => { setScanning(true); setTimeout(() => { setScanResult('AI extracted 3 room types, 2 seasonal rate periods, and payment terms from the document. Ready for Contracts team review.'); setScanning(false) }, 2500) }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{scanning ? '⟳' : '📄'}</div>
              <div style={{ fontSize: 13, color: scanning ? T.gold : T.textMid, fontWeight: scanning ? 700 : 400 }}>{scanning ? 'Scanning document…' : 'Drop rate agreement PDF here, or click to upload'}</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>PDF · Max 20MB · File compressed automatically</div>
            </div>
            {scanResult && (
              <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '12px 14px' }}>
                <div style={{ fontSize: 12, color: T.green, fontWeight: 700, marginBottom: 4 }}>✓ Scan complete</div>
                <div style={{ fontSize: 12, color: T.textMid }}>{scanResult}</div>
                <button style={{ marginTop: 10, padding: '6px 14px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 7, color: T.gold, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Send to Contracts team for review →
                </button>
              </div>
            )}
          </Card>

          {/* Document list */}
          <Card style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Document Repository</div>
              <div style={{ fontSize: 11, color: T.textDim }}>{docs.length} files</div>
            </div>
            {docs.map((d, i) => (
              <div key={i} style={{ padding: '12px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div>
                    <div style={{ fontSize: 13, color: T.text }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{d.type} · {d.size} · Uploaded {fmtDate(d.uploaded)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge label={d.status} color={d.status === 'verified' ? T.green : T.gold} />
                  <button style={{ padding: '5px 10px', background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>View ↗</button>
                </div>
              </div>
            ))}
            <div style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ padding: '16px', background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 12, color: T.textDim }}
                onClick={() => setDocs(d => [...d, { name: `New document ${Date.now()}.pdf`, type: 'Contract', uploaded: new Date().toISOString().slice(0,10), size: '1.2 MB', status: 'pending' }])}>
                + Upload new document (drag & drop or click)
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: ADD-ON ACTIVITIES
// ══════════════════════════════════════════════════════════════
function Addons() {
  const [addons, setAddons] = useState(DEMO_ADDONS)
  const [showForm, setShowForm] = useState(false)
  const [newAddon, setNewAddon] = useState({ name: '', category: 'Activity', net_rate: 0, display_rate: 0, duration: '', max_pax: 6, notes: '' })

  const CATS = ['Activity', 'Spa', 'Dining', 'Experience', 'Transfer', 'Flight', 'Other']

  return (
    <div>
      <SectionHeader title="Add-on Activities"
        sub="Additional activities and experiences offered by your property — shown separately in the itinerary builder under supplier add-ons."
        action={<Btn variant="gold" label="+ Add Activity" onClick={() => setShowForm(true)} />}
      />

      <div style={{ background: 'rgba(167,139,250,0.06)', border: `0.5px solid rgba(167,139,250,0.2)`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.purple }}>
        ✦ Add-ons appear as a separate toggle in the itinerary builder — "Property Add-ons from {DEMO_SUPPLIER.name}" — so they never inflate the base accommodation rate in the price summary.
      </div>

      {showForm && (
        <Card style={{ padding: 20, marginBottom: 16, border: `0.5px solid ${T.borderGold}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginBottom: 16 }}>New Add-on Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Activity name" value={newAddon.name} onChange={(v: string) => setNewAddon(a => ({ ...a, name: v }))} placeholder="e.g. Guided Bush Walk" />
            <Select label="Category" value={newAddon.category} onChange={(v: string) => setNewAddon(a => ({ ...a, category: v }))} options={CATS.map(c => ({ value: c, label: c }))} />
            <Field label="Net rate (ZAR)" value={String(newAddon.net_rate || '')} onChange={(v: string) => setNewAddon(a => ({ ...a, net_rate: Number(v), display_rate: Math.round(Number(v) * 1.18) }))} type="number" placeholder="e.g. 900" />
            
            <Field label="Duration" value={newAddon.duration} onChange={(v: string) => setNewAddon(a => ({ ...a, duration: v }))} placeholder="e.g. 3 hours" />
            <Field label="Max participants" value={String(newAddon.max_pax)} onChange={(v: string) => setNewAddon(a => ({ ...a, max_pax: Number(v) }))} type="number" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Field label="Notes for traveller" value={newAddon.notes} onChange={(v: string) => setNewAddon(a => ({ ...a, notes: v }))} placeholder="Advance booking required. Subject to conditions." />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="gold" label="Save Add-on" onClick={() => { setAddons(ads => [...ads, { ...newAddon, id: `a${Date.now()}` }]); setShowForm(false) }} />
            <Btn label="Cancel" onClick={() => setShowForm(false)} />
          </div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {addons.map((a, i) => (
          <Card key={i} style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{a.name}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{a.duration} · max {a.max_pax} pax</div>
              </div>
              <Badge label={a.category} color={T.purple} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: T.textDim }}>Net {fmt(a.net_rate)} / person</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{fmt(a.display_rate)}</div>
            </div>
            {a.notes && <div style={{ fontSize: 11, color: T.textDim, fontStyle: 'italic' }}>{a.notes}</div>}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: CAMPAIGNS
// ══════════════════════════════════════════════════════════════
function Campaigns() {
  const [campaigns, setCampaigns] = useState(DEMO_CAMPAIGNS)
  const [showForm, setShowForm] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'Pay 5 Stay 6', start: '', end: '', details: '' })
  const [submitted, setSubmitted] = useState(false)

  const CAMPAIGN_TYPES = ['Pay 5 Stay 6', 'Pay 6 Stay 7', 'Early Bird', 'Last Minute', 'Family Promotion', 'Honeymoon Package', 'Conservation Stay', 'Free Night', 'Room Upgrade', 'Custom']

  const statusColor = (s: string) => s === 'active' ? T.green : s === 'pending_approval' ? T.amber : T.textDim

  return (
    <div>
      <SectionHeader title="Campaigns & Commercial"
        sub="Submit campaigns for approval. All campaigns require Product + Commercial + Contracts sign-off."
        action={<Btn variant="gold" label="+ New Campaign" onClick={() => setShowForm(true)} />}
      />

      {showForm && (
        <Card style={{ padding: 20, marginBottom: 16, border: `0.5px solid ${T.borderGold}` }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginBottom: 16 }}>New Campaign Submission</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Field label="Campaign name" value={newCampaign.name} onChange={(v: string) => setNewCampaign(c => ({ ...c, name: v }))} placeholder="e.g. Winter Safari Special" />
            <Select label="Campaign type" value={newCampaign.type} onChange={(v: string) => setNewCampaign(c => ({ ...c, type: v }))} options={CAMPAIGN_TYPES.map(t => ({ value: t, label: t }))} />
            <Field label="Start date" value={newCampaign.start} onChange={(v: string) => setNewCampaign(c => ({ ...c, start: v }))} type="date" />
            <Field label="End date" value={newCampaign.end} onChange={(v: string) => setNewCampaign(c => ({ ...c, end: v }))} type="date" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Campaign details</label>
            <textarea value={newCampaign.details} onChange={e => setNewCampaign(c => ({ ...c, details: e.target.value }))} rows={3} placeholder="Describe the campaign terms, inclusions, exclusions, and any specific conditions..."
              style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
          </div>
          {submitted ? (
            <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✓ Submitted for approval</div>
              <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>3-team approval required: Product · Commercial · Contracts. You will be notified on each sign-off.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="gold" label="Submit for Approval →" onClick={() => { setCampaigns(c => [...c, { id: `c${Date.now()}`, name: newCampaign.name, type: newCampaign.type, status: 'pending_approval', approvals: { product: false, commercial: false, contracts: false }, bookings: 0, revenue: 0, start: newCampaign.start, end: newCampaign.end }]); setSubmitted(true) }} />
              <Btn label="Cancel" onClick={() => setShowForm(false)} />
            </div>
          )}
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {campaigns.map((c, i) => (
          <Card key={i} style={{ padding: '18px 20px', border: `0.5px solid ${c.status === 'active' ? 'rgba(74,222,128,0.2)' : T.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{c.name}</div>
                  <Badge label={c.status.replace(/_/g, ' ')} color={statusColor(c.status)} />
                </div>
                <div style={{ fontSize: 11, color: T.textDim }}>{c.type} · {fmtDate(c.start)} – {fmtDate(c.end)}</div>
              </div>
              {c.status === 'active' && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{fmt(c.revenue)}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{c.bookings} bookings</div>
                </div>
              )}
            </div>

            {/* Approval progress */}
            <div style={{ display: 'flex', gap: 8 }}>
              {[['Product', c.approvals.product], ['Commercial', c.approvals.commercial], ['Contracts', c.approvals.contracts]].map(([label, done]) => (
                <div key={String(label)} style={{ flex: 1, padding: '8px 10px', background: done ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.03)', border: `0.5px solid ${done ? 'rgba(74,222,128,0.3)' : T.border}`, borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 16 }}>{done ? '✓' : '○'}</div>
                  <div style={{ fontSize: 10, color: done ? T.green : T.textDim, marginTop: 2 }}>{String(label)}</div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: PAYMENTS & REMITTANCES
// ══════════════════════════════════════════════════════════════
function Payments() {
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <div>
      <SectionHeader title="Payments & Remittances" sub="Float-maximised payment model — supplier payment released end of month following travel." />

      <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: T.gold }}>
        ✦ Payment terms: <strong>End of Month Following Travel</strong> · Remittances are auto-generated per transfer with booking-by-booking line items. Currency noted on every line.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Next remittance</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display',serif" }}>{fmt(378250)}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>Est. 31 May 2026 · 2 bookings</div>
        </Card>
        <Card style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>YTD paid</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.green, fontFamily: "'Playfair Display',serif" }}>{fmt(578000)}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>1 remittance · Jan–Mar 2026</div>
        </Card>
      </div>

      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.text }}>Remittance History</div>
        {DEMO_REMITTANCES.map((r, i) => (
          <div key={i}>
            <div onClick={() => setSelected(selected === i ? null : i)}
              style={{ padding: '13px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{r.reference}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{fmtDate(r.date)} · {r.bookings} bookings</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{fmt(r.net)}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>Gross {fmt(r.gross)} · Comm {fmt(r.commission)}</div>
                </div>
                <Badge label={r.status} color={r.status === 'paid' ? T.green : T.amber} />
                <div style={{ fontSize: 12, color: T.textDim }}>{selected === i ? '▲' : '▼'}</div>
              </div>
            </div>
            {selected === i && (
              <div style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.01)', borderBottom: `0.5px solid ${T.border}` }}>
                <div style={{ fontSize: 11, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Booking breakdown</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr 1fr 0.8fr 1fr', gap: 8, padding: '7px 0', borderBottom: `0.5px solid ${T.border}`, fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                  <div>TSE Ref</div><div>Supplier Ref</div><div>Guest / Travel dates</div><div>Payment type</div><div>Currency</div><div style={{ textAlign: 'right' as const }}>Net to supplier</div>
                </div>
                {DEMO_BOOKINGS.slice(0, r.bookings).map((b, bi) => (
                  <div key={bi} style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.5fr 1fr 0.8fr 1fr', gap: 8, padding: '9px 0', borderBottom: `0.5px solid ${T.border}`, alignItems: 'center' }}>
                    <div style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>{b.ref}</div>
                    <div style={{ fontSize: 11, color: T.textDim }}>{b.supplier_ref}</div>
                    <div>
                      <div style={{ fontSize: 12, color: T.text }}>{b.guest}</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>{fmtDate(b.check_in)} – {fmtDate(b.check_out)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: T.textMid }}>{b.payment_type}</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>{b.deposit_pct}%/{100 - b.deposit_pct}% split</div>
                    </div>
                    <div style={{ fontSize: 11, color: T.textMid }}>ZAR</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: T.gold, textAlign: 'right' as const }}>{fmt(Math.round(b.net_value))}</div>
                  </div>
                ))}
                <button style={{ marginTop: 12, padding: '6px 14px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 7, color: T.gold, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Download PDF ↗
                </button>
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: API & CONNECTIONS
// ══════════════════════════════════════════════════════════════
function APIConnections() {
  const [pmsStep, setPmsStep] = useState(0)
  const [pmsType, setPmsType] = useState('')
  const [pmsConfig, setPmsConfig] = useState({ url: '', api_key: '', property_id: '', username: '', password: '' })
  const [testResult, setTestResult] = useState<null | 'success' | 'fail'>(null)
  const [testing, setTesting] = useState(false)
  const [socialConnected, setSocialConnected] = useState({ instagram: false, facebook: false, youtube: false, tripadvisor: false, google: true, booking: false })

  const PMS_OPTIONS = ['ResRequest', 'Nightsbridge', 'Opera Cloud', 'RMS Cloud', 'Manual (rate sheets only)']

  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 2000))
    setTestResult(pmsConfig.api_key.length > 5 ? 'success' : 'fail')
    setTesting(false)
  }

  return (
    <div>
      <SectionHeader title="API & Connections" sub="Connect your PMS, social channels, and review platforms. All credentials stored encrypted." />

      {/* PMS Wizard */}
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>PMS Connection Wizard</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Connect your Property Management System for live availability and automatic rate sync. No technical knowledge required.</div>

        {/* Step indicators */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
          {['Select PMS', 'Enter Credentials', 'Test Connection', 'Activate'].map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: pmsStep > i ? T.green : pmsStep === i ? T.gold : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: pmsStep >= i ? '#0a0a0a' : T.textDim, marginBottom: 6, zIndex: 1 }}>
                {pmsStep > i ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: pmsStep === i ? T.gold : T.textDim, textAlign: 'center' }}>{step}</div>
              {i < 3 && <div style={{ position: 'absolute', marginLeft: `${(i + 1) * 25}%`, width: '25%', height: 1, background: pmsStep > i ? T.green : T.border, marginTop: 14 }} />}
            </div>
          ))}
        </div>

        {pmsStep === 0 && (
          <div>
            <div style={{ fontSize: 12, color: T.textMid, marginBottom: 14 }}>Which Property Management System do you use?</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 10 }}>
              {PMS_OPTIONS.map(p => (
                <button key={p} onClick={() => setPmsType(p)}
                  style={{ padding: '14px 16px', background: pmsType === p ? T.goldDim : T.bg, border: `0.5px solid ${pmsType === p ? T.gold : T.border}`, borderRadius: 10, color: pmsType === p ? T.gold : T.textMid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontWeight: pmsType === p ? 600 : 400 }}>
                  {p}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Btn variant="gold" label="Next →" onClick={() => pmsType && setPmsStep(1)} />
            </div>
          </div>
        )}

        {pmsStep === 1 && (
          <div>
            <div style={{ fontSize: 13, color: T.gold, fontWeight: 600, marginBottom: 16 }}>Connecting to: {pmsType}</div>
            {pmsType === 'Manual (rate sheets only)' ? (
              <div>
                <div style={{ fontSize: 12, color: T.textMid, marginBottom: 16 }}>Manual mode — upload a rate sheet CSV monthly. Availability is confirmed by your team for each booking.</div>
                <div style={{ padding: '20px', background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                  <div style={{ fontSize: 13, color: T.textMid }}>Upload rate sheet CSV</div>
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Download template · Max 5MB</div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {/* Demo credentials helper */}
                <div style={{ gridColumn: '1 / -1', background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.gold }}>
                  ✦ Demo credentials below — use these to test the connection wizard. Real credentials are supplied by your PMS provider.
                </div>

                {pmsType === 'ResRequest' && <>
                  <div style={{ gridColumn: '1 / -1', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>
                    <strong style={{ color: T.text }}>ResRequest (ResConnect API)</strong><br/>
                    API docs: <span style={{ color: T.blue }}>support.resrequest.com/developer</span><br/>
                    Demo property: <span style={{ color: T.gold, cursor: 'pointer' }} onClick={() => { setPmsConfig(p => ({...p, url:'https://imvelo.resrequest.com', api_key:'DEMO_RR_API_KEY_2026', property_id:'IMVELO_001'})) }}>Imvelo Safari Lodges (click to fill)</span><br/>
                    Format: <span style={{ color: T.textDim }}>https://[property].resrequest.com + ResConnect API key from your ResRequest admin panel</span>
                  </div>
                  <Field label="ResRequest URL" value={pmsConfig.url} onChange={(v: string) => setPmsConfig(c => ({ ...c, url: v }))} placeholder="https://yourproperty.resrequest.com" />
                  <Field label="ResConnect API Key" value={pmsConfig.api_key} onChange={(v: string) => setPmsConfig(c => ({ ...c, api_key: v }))} placeholder="DEMO_RR_API_KEY_2026" />
                  <Field label="Property ID" value={pmsConfig.property_id} onChange={(v: string) => setPmsConfig(c => ({ ...c, property_id: v }))} placeholder="PROP_001" />
                </>}
                {pmsType === 'Nightsbridge' && <>
                  <div style={{ gridColumn: '1 / -1', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>
                    <strong style={{ color: T.text }}>Nightsbridge API</strong><br/>
                    Africa most widely used PMS for guesthouses and lodges. <span style={{ color: T.blue }}>nightsbridge.co.za</span><br/>
                    Demo: <span style={{ color: T.gold, cursor: 'pointer' }} onClick={() => { setPmsConfig(p => ({...p, username:'DEMO_NB_USER', password:'DEMO_NB_PASS_2026', property_id:'BBID_12345'})) }}>Click to fill demo credentials</span><br/>
                    Format: <span style={{ color: T.textDim }}>Your NB User ID + Password from your Nightsbridge admin + BBID (property booking ID)</span>
                  </div>
                  <Field label="NB UserID" value={pmsConfig.username} onChange={(v: string) => setPmsConfig(c => ({ ...c, username: v }))} placeholder="DEMO_NB_USER" />
                  <Field label="NB Password" value={pmsConfig.password} onChange={(v: string) => setPmsConfig(c => ({ ...c, password: v }))} placeholder="DEMO_NB_PASS_2026" type="password" />
                  <Field label="BBID (Property Booking ID)" value={pmsConfig.property_id} onChange={(v: string) => setPmsConfig(c => ({ ...c, property_id: v }))} placeholder="BBID_12345" />
                </>}
                {pmsType === 'Opera Cloud' && <>
                  <div style={{ gridColumn: '1 / -1', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>
                    <strong style={{ color: T.text }}>Oracle OPERA Cloud PMS</strong><br/>
                    Used by larger lodge groups and 5-star hotels. Oracle Hospitality Integration Platform (OHIP).<br/>
                    Demo: <span style={{ color: T.gold, cursor: 'pointer' }} onClick={() => { setPmsConfig(p => ({...p, url:'https://integrated-sandbox.hospitality.us.oracle.com/fidelio/v1', username:'safari_edition_client', api_key:'OHIP_DEMO_SECRET_2026', property_id:'DEMO_HOTEL_001'})) }}>Click to fill OHIP sandbox credentials</span><br/>
                    <span style={{ color: T.textDim }}>Register at: developer.oracle.com/hospitality to get real sandbox credentials</span>
                  </div>
                  <Field label="OHIP API Endpoint" value={pmsConfig.url} onChange={(v: string) => setPmsConfig(c => ({ ...c, url: v }))} placeholder="https://integrated-sandbox.hospitality.us.oracle.com/fidelio/v1" />
                  <Field label="Client ID" value={pmsConfig.username} onChange={(v: string) => setPmsConfig(c => ({ ...c, username: v }))} placeholder="safari_edition_client" />
                  <Field label="Client Secret" value={pmsConfig.api_key} onChange={(v: string) => setPmsConfig(c => ({ ...c, api_key: v }))} placeholder="OHIP_DEMO_SECRET_2026" type="password" />
                  <Field label="Hotel / Chain Code" value={pmsConfig.property_id} onChange={(v: string) => setPmsConfig(c => ({ ...c, property_id: v }))} placeholder="DEMO_HOTEL_001" />
                </>}
                {pmsType === 'RMS Cloud' && <>
                  <div style={{ gridColumn: '1 / -1', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.textMid, lineHeight: 1.7 }}>
                    <strong style={{ color: T.text }}>RMS Cloud PMS</strong><br/>
                    Popular in SA lodges and game reserves. RMS REST API v2.<br/>
                    Demo: <span style={{ color: T.gold, cursor: 'pointer' }} onClick={() => { setPmsConfig(p => ({...p, url:'https://api.rmscloud.com/v2', username:'SE_DEMO_CLIENT', api_key:'rms_demo_api_key_2026_safari', property_id:'PROP_DEMO_SA'})) }}>Click to fill RMS demo credentials</span><br/>
                    <span style={{ color: T.textDim }}>Get real API keys at: api.rmscloud.com/developer</span>
                  </div>
                  <Field label="RMS API URL" value={pmsConfig.url} onChange={(v: string) => setPmsConfig(c => ({ ...c, url: v }))} placeholder="https://api.rmscloud.com/v2" />
                  <Field label="Client ID" value={pmsConfig.username} onChange={(v: string) => setPmsConfig(c => ({ ...c, username: v }))} placeholder="SE_DEMO_CLIENT" />
                  <Field label="API Key" value={pmsConfig.api_key} onChange={(v: string) => setPmsConfig(c => ({ ...c, api_key: v }))} placeholder="rms_demo_api_key_2026_safari" type="password" />
                  <Field label="Property Code" value={pmsConfig.property_id} onChange={(v: string) => setPmsConfig(c => ({ ...c, property_id: v }))} placeholder="PROP_DEMO_SA" />
                </>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <Btn variant="gold" label="Next →" onClick={() => setPmsStep(2)} />
              <Btn label="← Back" onClick={() => setPmsStep(0)} />
            </div>
          </div>
        )}

        {pmsStep === 2 && (
          <div>
            <div style={{ fontSize: 13, color: T.textMid, marginBottom: 20 }}>Test the connection before activating. This checks credentials and reads one sample availability response.</div>
            {testResult === null && (
              <button onClick={handleTest} disabled={testing}
                style={{ padding: '12px 28px', background: testing ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${T.blue},#3b82f6)`, border: 'none', borderRadius: 9, color: 'white', fontSize: 14, fontWeight: 700, cursor: testing ? 'wait' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 10 }}>
                {testing ? '⟳ Testing connection...' : '▶ Run Connection Test'}
              </button>
            )}
            {testResult === 'success' && (
              <div>
                <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: T.green, fontWeight: 700 }}>✓ Connection successful</div>
                  <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>Property found: {DEMO_SUPPLIER.name} · 3 room types returned · Availability data syncing</div>
                </div>
                <Btn variant="gold" label="Activate Integration →" onClick={() => setPmsStep(3)} />
              </div>
            )}
            {testResult === 'fail' && (
              <div>
                <div style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                  <div style={{ fontSize: 14, color: T.red, fontWeight: 700 }}>✗ Connection failed</div>
                  <div style={{ fontSize: 12, color: T.textMid, marginTop: 4 }}>Could not authenticate. Check your API key and property ID and try again. Contact your PMS provider if the issue persists.</div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Btn variant="ghost" label="← Edit credentials" onClick={() => { setTestResult(null); setPmsStep(1) }} />
                  <Btn variant="gold" label="Try again" onClick={handleTest} />
                </div>
              </div>
            )}
          </div>
        )}

        {pmsStep === 3 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.green, fontFamily: "'Playfair Display',serif", marginBottom: 8 }}>Integration Active</div>
            <div style={{ fontSize: 13, color: T.textMid, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
              {pmsType} is now connected. Availability syncs every 15 minutes. Rate changes must still go through the Rate Recommendation workflow.
            </div>
            <button onClick={() => { setPmsStep(0); setPmsType(''); setPmsConfig({ url: '', api_key: '', property_id: '', username: '', password: '' }); setTestResult(null) }}
              style={{ marginTop: 16, padding: '8px 18px', background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Configure another
            </button>
          </div>
        )}
      </Card>

      {/* Social connections */}
      <Card style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Social & Review Platforms</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Read-only connections. We never post on your behalf.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {([['instagram', '📸', 'Instagram', 'OAuth'], ['facebook', '📘', 'Facebook', 'OAuth'], ['youtube', '▶️', 'YouTube', 'OAuth'], ['tripadvisor', '🦉', 'TripAdvisor', 'API key'], ['google', '🔵', 'Google My Business', 'OAuth'], ['booking', '🔷', 'Booking.com', 'API key']] as [keyof typeof socialConnected, string, string, string][]).map(([key, icon, label, method]) => (
            <button key={key} onClick={() => setSocialConnected(s => ({ ...s, [key]: !s[key] }))}
              style={{ padding: '12px 14px', background: socialConnected[key] ? 'rgba(74,222,128,0.06)' : T.bg, border: `0.5px solid ${socialConnected[key] ? 'rgba(74,222,128,0.3)' : T.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: socialConnected[key] ? T.green : T.text }}>{label}</div>
              <div style={{ fontSize: 10, color: socialConnected[key] ? T.green : T.textDim, marginTop: 2 }}>{socialConnected[key] ? '✓ Connected' : `Connect via ${method}`}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: REVIEWS
// ══════════════════════════════════════════════════════════════
function Reviews() {
  const [filter, setFilter] = useState('all')
  const sentimentColor = (s: string) => s === 'positive' ? T.green : s === 'mixed' ? T.amber : T.red

  const filtered = filter === 'all' ? DEMO_REVIEWS : DEMO_REVIEWS.filter(r => r.source.toLowerCase() === filter.toLowerCase())

  return (
    <div>
      <SectionHeader title="Guest Reviews" sub="All reviews referencing your property — internal and third-party. AI sentiment updated weekly." />

      {/* Sentiment summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}>
        <StatTile label="Overall sentiment" value="4.4 / 5" color={T.green} sub="Last 90 days" />
        <StatTile label="Total reviews" value={String(DEMO_REVIEWS.length)} sub="All platforms" />
        <StatTile label="Response rate" value="0%" color={T.amber} sub="Respond via Messages tab" />
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['all', 'Internal', 'TripAdvisor', 'Google', 'Booking.com'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 12px', borderRadius: 8, border: `0.5px solid ${filter === f ? T.gold : T.border}`, background: filter === f ? T.goldDim : 'transparent', color: filter === f ? T.gold : T.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((r, i) => (
          <Card key={i} style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge label={r.source} color={T.blue} />
                <span style={{ fontSize: 12, color: '⭐'.repeat(r.rating) ? T.amber : T.textDim }}>{'⭐'.repeat(r.rating)}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge label={r.sentiment} color={sentimentColor(r.sentiment)} />
                <span style={{ fontSize: 11, color: T.textDim }}>{fmtDate(r.date)}</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.text, lineHeight: 1.6, marginBottom: 8 }}>"{r.text}"</div>
            <div style={{ fontSize: 11, color: T.textDim }}>— {r.guest}</div>
            {r.sentiment === 'mixed' && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(251,191,36,0.06)', border: `0.5px solid rgba(251,191,36,0.2)`, borderRadius: 8, fontSize: 11, color: T.amber }}>
                <strong>Catalogue Feedback:</strong> Guest flagged WiFi reliability. Recommended action: Contact your IT provider about a Starlink installation. Typically under R8,000 all-in.
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: MESSAGES (Internal Chat + Audit Log)
// ══════════════════════════════════════════════════════════════
function Messages({ role, userName }: { role: Role; userName: string }) {
  const [messages, setMessages] = useState(DEMO_CHAT)
  const [input, setInput] = useState('')
  const [showAudit, setShowAudit] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const send = () => {
    if (!input.trim()) return
    setMessages(m => [...m, { id: `m${Date.now()}`, from: userName, role: 'supplier', time: new Date().toLocaleString('en-ZA').slice(0, 16), text: input.trim(), audit: true }])
    setInput('')
  }

  return (
    <div>
      <SectionHeader title="Messages" sub="Persistent message thread with The Safari Edition Contracts team. All messages permanently logged."
        action={<button onClick={() => setShowAudit(s => !s)} style={{ padding: '6px 14px', borderRadius: 8, border: `0.5px solid ${T.border}`, background: showAudit ? T.goldDim : 'transparent', color: showAudit ? T.gold : T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Audit log {showAudit ? '▲' : '▼'}</button>}
      />

      <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: T.gold }}>
        ✦ All messages are permanently logged and admissible as part of the contract record. Every message is timestamped and attributed.
      </div>

      {showAudit && (
        <Card style={{ padding: 16, marginBottom: 16, border: `0.5px solid rgba(96,165,250,0.2)` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginBottom: 10 }}>Full Audit Log — {messages.length} entries</div>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '6px 0', borderBottom: `0.5px solid ${T.border}`, fontSize: 11 }}>
              <span style={{ color: T.textDim, flexShrink: 0, width: 130 }}>{m.time}</span>
              <span style={{ color: m.role === 'edition' ? T.blue : T.gold, flexShrink: 0, width: 120 }}>{m.from}</span>
              <span style={{ color: T.textMid }}>{m.text.slice(0, 80)}{m.text.length > 80 ? '…' : ''}</span>
            </div>
          ))}
        </Card>
      )}

      <Card style={{ overflow: 'hidden' }}>
        <div style={{ height: 360, overflowY: 'auto', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'supplier' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '75%', padding: '10px 14px', borderRadius: m.role === 'supplier' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.role === 'supplier' ? T.goldDim : T.surface2, border: `0.5px solid ${m.role === 'supplier' ? T.borderGold : T.border}` }}>
                <div style={{ fontSize: 11, color: m.role === 'supplier' ? T.gold : T.blue, fontWeight: 600, marginBottom: 4 }}>{m.from}</div>
                <div style={{ fontSize: 13, color: T.text, lineHeight: 1.5 }}>{m.text}</div>
              </div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3, padding: '0 4px' }}>{m.time}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div style={{ borderTop: `0.5px solid ${T.border}`, padding: '12px 16px', display: 'flex', gap: 10 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message…"
            style={{ flex: 1, padding: '10px 14px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }} />
          <button onClick={send} style={{ padding: '10px 18px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, border: 'none', borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Send
          </button>
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: FEEDBACK PORTAL
// ══════════════════════════════════════════════════════════════
function FeedbackPortal() {
  const [type, setType] = useState('')
  const [text, setText] = useState('')
  const [sent, setSent] = useState(false)

  const TYPES = ['Guest arrived late/early', 'Fellow supplier issue', 'Safety note', 'Product feedback', 'Commercial feedback', 'Other']

  return (
    <div>
      <SectionHeader title="Feedback Portal" sub="Report operational issues, guest situations, and product feedback directly to the Edition team." />

      <div style={{ background: 'rgba(248,113,113,0.06)', border: `0.5px solid rgba(248,113,113,0.2)`, borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 12, color: T.red }}>
        ⚠ Fellow supplier complaints are logged anonymously against the named supplier. 3 complaints within 90 days triggers an automatic Catalogue Feedback review to the Contracts Manager.
      </div>

      {sent ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: T.green, marginBottom: 8 }}>Feedback received</div>
          <div style={{ fontSize: 12, color: T.textDim, maxWidth: 380, margin: '0 auto', lineHeight: 1.7 }}>Your feedback has been logged and assigned to the relevant team. You will be notified if a follow-up response is required.</div>
          <button onClick={() => { setSent(false); setType(''); setText('') }} style={{ marginTop: 16, padding: '8px 18px', background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Submit another</button>
        </Card>
      ) : (
        <Card style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Feedback type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8 }}>
              {TYPES.map(t => (
                <button key={t} onClick={() => setType(t)}
                  style={{ padding: '10px 12px', background: type === t ? T.goldDim : T.bg, border: `0.5px solid ${type === t ? T.gold : T.border}`, borderRadius: 9, color: type === t ? T.gold : T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {type && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Details</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Please provide as much detail as possible. Include dates, booking references, and names where relevant."
                style={{ width: '100%', padding: '10px 14px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 9, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          )}
          {type && text.length > 20 && (
            <Btn variant="gold" label="Submit Feedback →" onClick={() => setSent(true)} />
          )}
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MODULE: CONTENT & MEDIA
// ══════════════════════════════════════════════════════════════
function ContentMedia() {
  return (
    <div>
      <SectionHeader title="Content & Media" sub="Manage your property content, images, Reels, and Knowledge Base entries." />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <StatTile label="Content Score" value={`${DEMO_SUPPLIER.content_score}/100`} color={T.amber} sub="2 Reels missing" />
        <StatTile label="Images" value="18" sub="Approved · Last updated 2026-03-01" />
      </div>

      {[
        { label: 'Property Reels (15–30s)', status: 'missing', note: '2 of 3 required Reels uploaded. Missing: Arrival experience, Room walkthrough.', color: T.red },
        { label: 'Hero Photography', status: 'approved', note: '18 images approved. Next review: 2026-07-01.', color: T.green },
        { label: 'Knowledge Base entries', status: 'partial', note: '3 entries active. Room booking notes missing.', color: T.amber },
        { label: 'Property description copy', status: 'approved', note: 'AI-verified. GPTZero: Human-written. Last updated 2026-02-14.', color: T.green },
      ].map((item, i) => (
        <Card key={i} style={{ padding: '14px 18px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.label}</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{item.note}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Badge label={item.status} color={item.color} />
            <Btn small label="Upload" variant="ghost" />
          </div>
        </Card>
      ))}

      <div style={{ marginTop: 20, padding: '20px', background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 12, textAlign: 'center', cursor: 'pointer' }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
        <div style={{ fontSize: 14, color: T.textMid, fontWeight: 600 }}>Upload a Reel</div>
        <div style={{ fontSize: 12, color: T.textDim, marginTop: 4 }}>15–30 seconds · 1080p minimum · MP4 or MOV</div>
        <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>Arrival experience · Room walkthrough · Activity highlight</div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN SUPPLIER PORTAL
// ══════════════════════════════════════════════════════════════

// ── DYNAMIC PAYMENT TERMS BUILDER ────────────────────────────
function PaymentTermsBuilder({value, onChange}:{value:string, onChange:(v:string)=>void}){
  const [showBuilder,setShowBuilder]=useState(false)
  const [custom,setCustom]=useState({
    dep1_pct:30,dep1_days:-1,dep1_anchor:'on_booking',
    dep2_pct:0,dep2_days:60,dep2_anchor:'before_arrival',
    balance_pct:70,balance_days:30,balance_anchor:'before_arrival',
    supplier_pct:100,supplier_days:30,supplier_anchor:'after_travel',
  })

  const PRESETS=[
    {label:'30% deposit / 70% balance (30 days prior)',value:'30% deposit on booking · 70% balance 30 days prior to arrival'},
    {label:'50/50 split (60 days prior)',value:'50% deposit on booking · 50% balance 60 days prior to arrival'},
    {label:'80% deposit / 20% on arrival',value:'80% deposit on booking · 20% balance on arrival'},
    {label:'Full payment on booking',value:'100% payment on booking'},
    {label:'End of Month Following Travel',value:'End of Month Following Travel'},
    {label:'30 days after travel',value:'30 days after travel date'},
    {label:'60 days after travel',value:'60 days after travel date'},
    {label:'Custom…',value:'custom'},
  ]

  const buildCustomLabel=()=>{
    const parts=[]
    parts.push(`${custom.dep1_pct}% deposit on booking`)
    if(custom.dep2_pct>0) parts.push(`${custom.dep2_pct}% progress payment ${custom.dep2_days} days before arrival`)
    const bal=100-custom.dep1_pct-custom.dep2_pct
    if(bal>0) parts.push(`${bal}% balance ${custom.balance_days} days before arrival`)
    parts.push(`Supplier paid ${custom.supplier_days} days after travel`)
    return parts.join(' · ')
  }

  return(
    <div style={{position:'relative' as const}}>
      <div style={{display:'flex',gap:8,alignItems:'center'}}>
        <select value={PRESETS.find(p=>p.value===value)?value:'custom'} onChange={e=>{if(e.target.value==='custom'){setShowBuilder(true)}else{onChange(e.target.value);setShowBuilder(false)}}}
          style={{flex:1,padding:'8px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit'}}>
          {PRESETS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        <button onClick={()=>setShowBuilder(v=>!v)}
          style={{padding:'8px 12px',borderRadius:7,border:'0.5px solid rgba(212,175,55,0.3)',background:'rgba(212,175,55,0.1)',color:'#d4af37',fontSize:11,cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap' as const}}>
          ⚙ Build custom
        </button>
      </div>
      {showBuilder&&(
        <div style={{position:'absolute' as const,top:'100%',left:0,right:0,zIndex:300,background:'#12142a',border:'0.5px solid rgba(212,175,55,0.3)',borderRadius:12,padding:16,marginTop:4,boxShadow:'0 8px 32px rgba(0,0,0,0.6)'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#d4af37',marginBottom:12}}>Custom Payment Terms Builder</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div>
              <label style={{display:'block',fontSize:9,color:'rgba(240,237,230,0.35)',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Deposit %</label>
              <input type="number" value={custom.dep1_pct} onChange={e=>setCustom(c=>({...c,dep1_pct:Number(e.target.value)}))} min={0} max={100}
                style={{width:'100%',padding:'7px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:9,color:'rgba(240,237,230,0.35)',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Progress payment % (0 = none)</label>
              <input type="number" value={custom.dep2_pct} onChange={e=>setCustom(c=>({...c,dep2_pct:Number(e.target.value)}))} min={0} max={100}
                style={{width:'100%',padding:'7px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
            </div>
            {custom.dep2_pct>0&&<div>
              <label style={{display:'block',fontSize:9,color:'rgba(240,237,230,0.35)',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Progress payment — days before arrival</label>
              <input type="number" value={custom.dep2_days} onChange={e=>setCustom(c=>({...c,dep2_days:Number(e.target.value)}))}
                style={{width:'100%',padding:'7px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
            </div>}
            <div>
              <label style={{display:'block',fontSize:9,color:'rgba(240,237,230,0.35)',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Balance due — days before arrival</label>
              <input type="number" value={custom.balance_days} onChange={e=>setCustom(c=>({...c,balance_days:Number(e.target.value)}))}
                style={{width:'100%',padding:'7px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
            </div>
            <div>
              <label style={{display:'block',fontSize:9,color:'rgba(240,237,230,0.35)',textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:3}}>Supplier payment — days after travel</label>
              <input type="number" value={custom.supplier_days} onChange={e=>setCustom(c=>({...c,supplier_days:Number(e.target.value)}))}
                style={{width:'100%',padding:'7px 10px',background:'#07080f',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:7,color:'#f0ede6',fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
            </div>
          </div>
          <div style={{background:'rgba(212,175,55,0.06)',border:'0.5px solid rgba(212,175,55,0.2)',borderRadius:8,padding:'8px 12px',marginBottom:10,fontSize:11,color:'rgba(240,237,230,0.6)'}}>
            Preview: <strong style={{color:'#d4af37'}}>{buildCustomLabel()}</strong>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={()=>{onChange(buildCustomLabel());setShowBuilder(false)}}
              style={{padding:'8px 18px',background:'linear-gradient(135deg,#d4af37,#f0c040)',border:'none',borderRadius:8,color:'#0a0a0a',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>Apply</button>
            <button onClick={()=>setShowBuilder(false)}
              style={{padding:'8px 14px',background:'transparent',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:8,color:'rgba(240,237,230,0.35)',fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SUPPLIER TEAM MANAGEMENT ──────────────────────────────────
const SUPPLIER_ROLE_OPTIONS=[
  {value:'supplier_admin',label:'Supplier Admin',desc:'Full access to all portal tabs'},
  {value:'reservations_manager',label:'Reservations Manager',desc:'Bookings, Rates, Payments, Messages'},
  {value:'content_manager',label:'Content Manager',desc:'Content, Media, Reviews, Messages'},
  {value:'finance_contact',label:'Finance Contact',desc:'Bookings (values only), Payments, Messages'},
  {value:'sales_marketing',label:'Sales & Marketing',desc:'Campaigns, Reviews, Content, Messages'},
]

function TeamPermissions({role}:{role:Role}){
  const [team,setTeam]=useState([
    {id:'t1',name:'Sarah Dlamini',email:'admin@singita.com',role:'supplier_admin',active:true,lastLogin:'2026-04-28'},
    {id:'t2',name:'Thabo Nkosi',email:'reservations@singita.com',role:'reservations_manager',active:true,lastLogin:'2026-04-27'},
    {id:'t3',name:'Priya Moodley',email:'content@singita.com',role:'content_manager',active:true,lastLogin:'2026-04-20'},
    {id:'t4',name:'James Olifant',email:'finance@singita.com',role:'finance_contact',active:false,lastLogin:'2026-03-15'},
    {id:'t5',name:'Mpho Sithole',email:'sales@singita.com',role:'sales_marketing',active:true,lastLogin:'2026-04-22'},
  ])
  const [showAdd,setShowAdd]=useState(false)
  const [resetUser,setResetUser]=useState<any>(null)
  const [newPwd,setNewPwd]=useState('')
  const [newUser,setNewUser]=useState({name:'',email:'',role:'reservations_manager'})
  const [saved,setSaved]=useState('')

  if(role!=='supplier_admin') return(
    <div style={{padding:40,textAlign:'center'}}>
      <div style={{fontSize:32,marginBottom:12}}>🔐</div>
      <div style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:8}}>Access restricted</div>
      <div style={{fontSize:13,color:T.textMid}}>Only Supplier Admins can manage team access and permissions.</div>
    </div>
  )

  return(
    <div>
      <SectionHeader title="Team & Permissions" sub="Manage your team's access to the supplier portal. Supplier Admin role required."
        action={<Btn variant="gold" label="+ Add team member" onClick={()=>setShowAdd(v=>!v)}/>}
      />

      {/* Reset password modal */}
      {resetUser&&(
        <div style={{position:'fixed' as const,inset:0,background:'rgba(0,0,0,0.65)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:T.surface,border:`0.5px solid ${T.borderGold}`,borderRadius:16,padding:28,width:'100%',maxWidth:400}}>
            <div style={{fontSize:15,fontWeight:700,color:T.gold,marginBottom:4}}>Reset Password</div>
            <div style={{fontSize:12,color:T.textDim,marginBottom:16}}>{resetUser.name} · {resetUser.email}</div>
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:4}}>New password</label>
              <input type="text" value={newPwd} onChange={e=>setNewPwd(e.target.value)} placeholder="Min 8 characters"
                style={{width:'100%',padding:'10px 12px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:8,color:T.text,fontSize:13,outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const}}/>
              <div style={{fontSize:10,color:T.textDim,marginTop:4}}>User will be prompted to change on next login.</div>
            </div>
            <div style={{display:'flex',gap:10}}>
              <Btn variant="gold" label="Set Password" onClick={()=>{setSaved(`✓ Password reset for ${resetUser.name}`);setResetUser(null);setNewPwd('');setTimeout(()=>setSaved(''),3000)}}/>
              <Btn label="Cancel" onClick={()=>{setResetUser(null);setNewPwd('')}}/>
            </div>
          </div>
        </div>
      )}

      {saved&&<div style={{background:'rgba(74,222,128,0.08)',border:'0.5px solid rgba(74,222,128,0.2)',borderRadius:9,padding:'10px 14px',marginBottom:14,fontSize:12,color:T.green}}>{saved}</div>}

      {/* Add team member */}
      {showAdd&&(
        <Card style={{padding:18,marginBottom:16,border:`0.5px solid ${T.borderGold}`}}>
          <div style={{fontSize:13,fontWeight:700,color:T.gold,marginBottom:12}}>New Team Member</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <Field label="Full name" value={newUser.name} onChange={(v:string)=>setNewUser(u=>({...u,name:v}))} placeholder="e.g. James Khumalo"/>
            <Field label="Email address" value={newUser.email} onChange={(v:string)=>setNewUser(u=>({...u,email:v}))} placeholder="james@singita.com"/>
          </div>
          <div style={{marginBottom:14}}>
            <label style={{display:'block',fontSize:10,color:T.gold,textTransform:'uppercase' as const,letterSpacing:'0.06em',marginBottom:6}}>Role & access level</label>
            <div style={{display:'flex',flexDirection:'column' as const,gap:8}}>
              {SUPPLIER_ROLE_OPTIONS.map(r=>(
                <button key={r.value} onClick={()=>setNewUser(u=>({...u,role:r.value}))}
                  style={{padding:'10px 14px',borderRadius:9,border:`0.5px solid ${newUser.role===r.value?T.gold:T.border}`,background:newUser.role===r.value?T.goldDim:'transparent',cursor:'pointer',fontFamily:'inherit',textAlign:'left' as const,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600,color:newUser.role===r.value?T.gold:T.text}}>{r.label}</div>
                    <div style={{fontSize:10,color:T.textDim,marginTop:2}}>{r.desc}</div>
                  </div>
                  {newUser.role===r.value&&<span style={{color:T.gold}}>✓</span>}
                </button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <Btn variant="gold" label="Add & Send Invite" onClick={()=>{
              if(!newUser.name||!newUser.email)return
              setTeam(t=>[...t,{id:`t${Date.now()}`,name:newUser.name,email:newUser.email,role:newUser.role,active:true,lastLogin:'Never'}])
              setSaved('✓ Team member added. Invite email will be sent when email integration is active.')
              setShowAdd(false)
              setNewUser({name:'',email:'',role:'reservations_manager'})
              setTimeout(()=>setSaved(''),3000)
            }}/>
            <Btn label="Cancel" onClick={()=>setShowAdd(false)}/>
          </div>
        </Card>
      )}

      {/* Team table */}
      <Card style={{overflow:'hidden'}}>
        <div style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.2fr 0.8fr 0.6fr 1fr',gap:8,padding:'10px 16px',borderBottom:`0.5px solid ${T.border}`,fontSize:9,color:T.textDim,textTransform:'uppercase' as const,letterSpacing:'0.07em'}}>
          <div>Name</div><div>Email</div><div>Role</div><div>Last login</div><div>Active</div><div>Actions</div>
        </div>
        {team.map((u,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'1.5fr 1.5fr 1.2fr 0.8fr 0.6fr 1fr',gap:8,padding:'11px 16px',borderBottom:`0.5px solid ${T.border}`,alignItems:'center',background:i%2===1?'rgba(255,255,255,0.01)':'transparent'}}>
            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{u.name}</div>
            <div style={{fontSize:11,color:T.textDim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{u.email}</div>
            <div>
              <select value={u.role} onChange={e=>setTeam(t=>t.map(x=>x.id===u.id?{...x,role:e.target.value}:x))}
                style={{padding:'5px 8px',background:T.bg,border:`0.5px solid ${T.border}`,borderRadius:6,color:T.gold,fontSize:11,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
                {SUPPLIER_ROLE_OPTIONS.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div style={{fontSize:11,color:T.textDim}}>{u.lastLogin}</div>
            <div>
              <button onClick={()=>setTeam(t=>t.map(x=>x.id===u.id?{...x,active:!x.active}:x))}
                style={{width:32,height:18,borderRadius:9,border:'none',background:u.active?T.green:'rgba(255,255,255,0.1)',cursor:'pointer',position:'relative' as const}}>
                <div style={{position:'absolute' as const,top:2,left:u.active?14:2,width:14,height:14,borderRadius:'50%',background:'white',transition:'left 0.2s'}}/>
              </button>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={()=>setResetUser(u)}
                style={{padding:'4px 9px',background:T.goldDim,border:`0.5px solid ${T.borderGold}`,borderRadius:6,color:T.gold,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
                Reset pwd
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  )
}
export default function SupplierPortal() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<Role>('supplier_admin')
  const [userName, setUserName] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')
  const [noSession, setNoSession] = useState(false)

  useEffect(() => {
    // Try sessionStorage first, then localStorage (cross-tab support)
    const getSession = () => {
      try { const s = sessionStorage.getItem('tse_session'); if (s) return JSON.parse(s) } catch {}
      try { const s = localStorage.getItem('tse_session'); if (s) return JSON.parse(s) } catch {}
      return null
    }

    const s = getSession()
    if (s) {
      if (s.type === 'supplier' && s.role) {
        setRole(s.role as Role)
        setUserName(s.name || '')
        setReady(true)
        return
      }
      if (s.type === 'edition') {
        // Edition admin clicking Portal — give them supplier_admin view
        // so JD can see what suppliers see
        setRole('supplier_admin')
        setUserName(s.name || 'Admin')
        setReady(true)
        return
      }
    }
    // No session — show sign-in prompt
    setNoSession(true)
  }, [])

  if (noSession) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap" rel="stylesheet"/>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: 24 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: '#d4af37', marginBottom: 12 }}>✦ Supplier Portal</div>
        <div style={{ fontSize: 14, color: 'rgba(240,237,230,0.6)', marginBottom: 24, lineHeight: 1.7 }}>Please sign in through the Edition portal to access your supplier account.</div>
        <a href="/admin" style={{ display: 'inline-block', padding: '12px 28px', background: 'linear-gradient(135deg,#d4af37,#f0c040)', borderRadius: 9, color: '#0a0a0a', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Sign In →</a>
      </div>
    </div>
  )

  if (!ready) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: 'rgba(240,237,230,0.35)', fontFamily: 'Arial,sans-serif' }}>Loading…</div>
    </div>
  )

  const allowedTabs = ROLE_TABS[role] || ROLE_TABS['supplier_admin']
  if (!allowedTabs.includes(activeTab)) setActiveTab(allowedTabs[0])

  const renderModule = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard role={role} setActiveTab={setActiveTab} />
      case 'bookings': return <Bookings role={role} />
      case 'rates': return <RatesContracts role={role} />
      case 'addons': return <Addons />
      case 'campaigns': return <Campaigns />
      case 'payments': return <Payments />
      case 'api': return <APIConnections />
      case 'reviews': return <Reviews />
      case 'content': return <ContentMedia />
      case 'chat': return <Messages role={role} userName={userName} />
      case 'feedback': return <FeedbackPortal />
      case 'team': return <TeamPermissions role={role} />
      default: return <Dashboard role={role} />
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', fontFamily: 'Arial,sans-serif', color: T.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet" />
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:10px}`}</style>

      {/* Sidebar */}
      <div style={{ width: 230, background: T.bg2, borderRight: `0.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Brand */}
        <div style={{ padding: '20px 16px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 14, color: T.gold, fontWeight: 700, letterSpacing: '0.06em' }}>✦ Supplier Portal</div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>The Safari Edition</div>
        </div>

        {/* Supplier identity */}
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{DEMO_SUPPLIER.name}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{DEMO_SUPPLIER.destination}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', color: T.green, border: '0.5px solid rgba(74,222,128,0.3)' }}>Trust {DEMO_SUPPLIER.trust_score}</div>
            <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', color: T.amber, border: '0.5px solid rgba(251,191,36,0.3)' }}>Content {DEMO_SUPPLIER.content_score}</div>
          </div>
        </div>

        {/* Role pill */}
        <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Logged in as</div>
          <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: 10, color: T.gold, marginTop: 1 }}>{ROLE_LABELS[role]}</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1 }}>
          {allowedTabs.map(tabId => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: 'none', background: activeTab === tabId ? T.goldDim : 'transparent', color: activeTab === tabId ? T.gold : T.textMid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 2, transition: 'all 0.1s' }}>
              <span style={{ fontSize: 15 }}>{TAB_META[tabId].icon}</span>{TAB_META[tabId].label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '14px 16px', borderTop: `0.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: T.textDim }}>Signed in as <span style={{ color: T.text }}>{userName}</span></div>
          <a href="/admin" style={{ fontSize: 11, color: T.textDim, textDecoration: 'none' }}>⚙ Edition Portal ↗</a>
          <button onClick={() => { sessionStorage.removeItem('tse_session'); localStorage.removeItem('tse_session'); window.location.href = '/admin' }}
            style={{ padding: '6px', background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            Sign out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '28px 32px' }}>
        {renderModule()}
      </div>
    </div>
  )
}

// Bookings module (inline — reuses dashboard bookings data)
function Bookings({ role }: { role: Role }) {
  const [filter, setFilter] = useState<'future'|'active'|'past'|'all'>('future')
  const [guestPopup, setGuestPopup] = useState<any>(null)
  const today = new Date().toISOString().slice(0, 10)

  const filtered = DEMO_BOOKINGS.filter(b => {
    if (filter === 'future') return b.check_in > today && b.status !== 'completed'
    if (filter === 'active') return b.check_in <= today && b.check_out >= today
    if (filter === 'past') return b.check_out < today || b.status === 'completed'
    return true
  })

  const paymentColor = (s: string) => s === 'full_paid' ? T.green : s === 'deposit_paid' ? T.amber : T.red

  return (
    <div>
      {guestPopup && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, fontFamily: "'Playfair Display',serif" }}>{guestPopup.guest}</div>
                <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{guestPopup.ref} · {guestPopup.origin_flag} {guestPopup.origin_city}, {guestPopup.origin_country}</div>
              </div>
              <button onClick={() => setGuestPopup(null)} style={{ background: 'transparent', border: 'none', color: T.textDim, fontSize: 20, cursor: 'pointer', fontFamily: 'inherit' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                ['Language', guestPopup.language],
                ['Contact', guestPopup.contact],
                ['Dietary requirements', guestPopup.dietary],
                ['Allergies', guestPopup.allergies || 'None known'],
              ].map(([l, v]) => (
                <div key={l} style={{ background: T.bg, borderRadius: 9, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>{l}</div>
                  <div style={{ fontSize: 12, color: T.text }}>{v}</div>
                </div>
              ))}
            </div>
            {[
              ['Travel preferences', guestPopup.preferences],
              ['Special requests', guestPopup.special_requests],
              ['Specialist notes (internal)', guestPopup.notes],
            ].map(([l, v]) => (
              <div key={l} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>{l}</div>
                <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.6, background: T.bg, borderRadius: 9, padding: '10px 12px' }}>{v}</div>
              </div>
            ))}
            <div style={{ marginTop: 4, padding: '10px 12px', background: 'rgba(212,175,55,0.06)', borderRadius: 9, border: `0.5px solid ${T.borderGold}` }}>
              <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Journey Specialist</div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{guestPopup.specialist}</div>
              <div style={{ fontSize: 11, color: T.textDim }}>{guestPopup.specialist_email}</div>
            </div>
          </div>
        </div>
      )}

      <SectionHeader title="Bookings" sub={`${DEMO_BOOKINGS.length} total bookings · ${ROLE_LABELS[role]}`} />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['future', 'Upcoming', DEMO_BOOKINGS.filter(b=>b.check_in>today&&b.status!=='completed').length],
           ['active', 'Live / In-house', DEMO_BOOKINGS.filter(b=>b.check_in<=today&&b.check_out>=today).length],
           ['past', 'Past', DEMO_BOOKINGS.filter(b=>b.check_out<today||b.status==='completed').length],
           ['all', 'All', DEMO_BOOKINGS.length]] as [string,string,number][]).map(([id, label, count]) => (
          <button key={id} onClick={() => setFilter(id as any)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `0.5px solid ${filter===id?T.gold:T.border}`, background: filter===id?T.goldDim:'transparent', color: filter===id?T.gold:T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {label} <span style={{ background: filter===id?'rgba(212,175,55,0.2)':'rgba(255,255,255,0.08)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>{count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: T.textDim }}>No {filter} bookings</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((b, i) => {
            const isPast = b.check_out < today || b.status === 'completed'
            const isLive = b.check_in <= today && b.check_out >= today
            const borderColor = isLive ? 'rgba(96,165,250,0.3)' : isPast ? T.border : 'rgba(74,222,128,0.18)'
            return (
              <Card key={i} style={{ overflow: 'hidden', border: `0.5px solid ${borderColor}` }}>
                <div style={{ padding: '16px 18px' }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{b.ref}</div>
                        {b.supplier_ref && <div style={{ fontSize: 11, color: T.textDim }}>Your ref: {b.supplier_ref}</div>}
                        {isLive && <Badge label="IN HOUSE" color={T.blue} />}
                        {isPast && <Badge label="Completed" color={T.textDim} />}
                        {!isLive && !isPast && <Badge label="Confirmed" color={T.green} />}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{b.guest}</div>
                        <span style={{ fontSize: 16 }}>{b.origin_flag}</span>
                        <span style={{ fontSize: 11, color: T.textDim }}>{b.origin_city}</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>
                        {b.room} · {b.adults} adults{b.children > 0 ? ` · ${b.children} children` : ''} · {b.nights} nights
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{fmt(b.net_value)}</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>Net to supplier</div>
                      <div style={{ marginTop: 6 }}>
                        <button onClick={() => setGuestPopup(b)}
                          style={{ padding: '5px 12px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 7, color: T.gold, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
                          More info
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                    <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Check-in</div>
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{fmtDate(b.check_in)}</div>
                    </div>
                    <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Check-out</div>
                      <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{fmtDate(b.check_out)}</div>
                    </div>
                    <div style={{ background: T.bg, borderRadius: 8, padding: '8px 12px' }}>
                      <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Specialist</div>
                      <div style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>{b.specialist}</div>
                    </div>
                  </div>

                  {/* Payment progress */}
                  <div style={{ background: T.bg, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Payment progress</div>
                      <div style={{ fontSize: 10, color: T.textDim }}>{b.payment_terms}</div>
                    </div>
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ width: b.payment_status === 'full_paid' ? '100%' : `${Math.round(((b.deposit_paid||0) / Math.max(b.value,1)) * 100)}%`, height: '100%', background: b.payment_status === 'full_paid' ? T.green : `linear-gradient(90deg,${T.gold},#f0c040)`, borderRadius: 3 }} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>Deposit paid</div>
                        <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>{fmt(b.deposit_paid)}</div>
                        <div style={{ fontSize: 9, color: T.textDim }}>{b.deposit_pct}% of total</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>Balance</div>
                        <div style={{ fontSize: 12, color: b.balance_due > 0 ? T.amber : T.green, fontWeight: 600 }}>{b.balance_due > 0 ? fmt(b.balance_due) : 'Paid in full'}</div>
                        {b.balance_due > 0 && <div style={{ fontSize: 9, color: T.textDim }}>Due {fmtDate(b.balance_due_date)}</div>}
                      </div>
                      <div>
                        <div style={{ fontSize: 9, color: T.textDim, marginBottom: 2 }}>Payment type</div>
                        <div style={{ fontSize: 10, color: T.textMid }}>{b.payment_type}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
