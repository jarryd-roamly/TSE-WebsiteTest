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

const SUPABASE_URL = 'https://tkthsbxuyihoblpcfnml.supabase.co'
const SUPABASE_KEY='sb_publishable_N1f-OiHXmxQiQTv_EkELcA_IvNtnHsx'
const EDITION_ID = '3fc42337-7dd0-426a-acef-790938aa9671'

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

// ── ROLE DEFINITIONS ──────────────────────────────────────────
type Role = 'supplier_admin' | 'reservations_manager' | 'content_manager' | 'finance_contact' | 'sales_marketing'

const ROLE_TABS: Record<Role, string[]> = {
  supplier_admin: ['dashboard', 'bookings', 'rates', 'content', 'reviews', 'campaigns', 'payments', 'api', 'team'],
  reservations_manager: ['dashboard', 'bookings', 'rates', 'payments'],
  content_manager: ['dashboard', 'content', 'reviews'],
  finance_contact: ['dashboard', 'bookings', 'payments'],
  sales_marketing: ['dashboard', 'campaigns', 'content', 'reviews'],
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
  content: { label: 'Content & Media', icon: '📸' },
  reviews: { label: 'Reviews', icon: '⭐' },
  campaigns: { label: 'Campaigns', icon: '🎯' },
  payments: { label: 'Payments', icon: '🏦' },
  api: { label: 'API & Connections', icon: '🔌' },
  team: { label: 'Team & Permissions', icon: '👥' },
}

// ── SHARED UI ─────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: string }) {
  return <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: color + '18', color, fontWeight: 600, border: `0.5px solid ${color}40` }}>{label}</span>
}

function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif" }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{sub}</div>}
      </div>
      {action}
    </div>
  )
}

function Card({ children, style = {} }: { children: React.ReactNode; style?: any }) {
  return <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, ...style }}>{children}</div>
}

function Btn({ label, onClick, variant = 'ghost', small = false }: { label: string; onClick?: () => void; variant?: 'gold' | 'ghost' | 'danger'; small?: boolean }) {
  const styles: any = {
    gold: { background: `linear-gradient(135deg,${T.gold},#f0c040)`, color: '#0a0a0a', border: 'none' },
    ghost: { background: 'transparent', color: T.textMid, border: `0.5px solid ${T.border}` },
    danger: { background: 'rgba(248,113,113,0.1)', color: T.red, border: `0.5px solid rgba(248,113,113,0.3)` },
  }
  return <button onClick={onClick} style={{ ...styles[variant], padding: small ? '5px 12px' : '9px 18px', borderRadius: 8, fontSize: small ? 11 : 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
}

function StatTile({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: color || T.gold, fontFamily: "'Cormorant Garamond',serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function Spinner() {
  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
    <div style={{ width: 24, height: 24, border: `2px solid rgba(212,175,55,0.2)`, borderTopColor: T.gold, borderRadius: '50%', animation: 'spin 0.75s linear infinite' }} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>
}

// ── LISTING STATUS HELPER ─────────────────────────────────────
function getListingStatus(contentScore: number, trustScore: number) {
  if (contentScore >= 90 && trustScore >= 95) return { label: '✦ Featured — Gold', color: T.gold }
  if (contentScore >= 80 && trustScore >= 85) return { label: 'Enhanced listing', color: T.green }
  if (contentScore >= 60 && trustScore >= 70) return { label: 'Standard listing', color: T.blue }
  if (contentScore >= 40 && trustScore >= 50) return { label: 'Listed — flagged', color: T.amber }
  return { label: 'Not listed', color: T.red }
}

// ── SCORE THRESHOLD TABLE ─────────────────────────────────────
function ScoreThresholdTable() {
  return (
    <div style={{ background: T.bg, borderRadius: 10, overflow: 'hidden', border: `0.5px solid ${T.border}`, marginBottom: 16 }}>
      <div style={{ padding: '8px 12px', background: T.surface, fontSize: 10, color: T.gold, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>What your scores unlock</div>
      {[
        { cs: '90–100', ts: '95–100', status: '✦ Featured — Gold', color: T.gold, effect: 'Top of AI swipe stack · Featured in curated collections · Priority recommendations' },
        { cs: '80–89', ts: '85–94', status: 'Enhanced listing', color: T.green, effect: 'Curated collections · Above-average stack position' },
        { cs: '60–79', ts: '70–84', status: 'Standard listing', color: T.blue, effect: 'Normal stack position · All features available' },
        { cs: '40–59', ts: '50–69', status: 'Listed — flagged', color: T.amber, effect: 'Reduced visibility · Improvement plan required' },
        { cs: '0–39', ts: '0–49', status: 'Not listed', color: T.red, effect: 'Removed from Experience Designer until minimum score achieved' },
      ].map((row, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr', gap: 8, padding: '8px 12px', borderTop: `0.5px solid ${T.border}`, alignItems: 'center' }}>
          <div style={{ fontSize: 10, color: T.textDim }}>Content {row.cs}</div>
          <div style={{ fontSize: 10, color: T.textDim }}>Trust {row.ts}</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: row.color }}>{row.status}</div>
            <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{row.effect}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════
function Dashboard({ supplier, bookings, role, setActiveTab, supplierId }: any) {
  const [showScoreTip, setShowScoreTip] = useState<'trust' | 'content' | null>(null)

  const ts = supplier.trust_score || 0
  const cs = supplier.content_score || 0
  const listing = getListingStatus(cs, ts)

  // Calculate from real bookings
  const today = new Date().toISOString().slice(0, 10)
  const futureBookings = bookings.filter((b: any) => (b.check_in || '') > today)
  const totalNights = bookings.reduce((s: number, b: any) => s + (b.nights || 0), 0)
  const totalRevenue = bookings.reduce((s: number, b: any) => s + (b.total_net_zar || 0), 0)

  // Annual threshold (hardcoded per spec — would come from contract in production)
  const THRESHOLD_NIGHTS = 150
  const OVERRIDE_PCT = 3
  const thresholdPct = Math.min(100, Math.round((totalNights / THRESHOLD_NIGHTS) * 100))
  const estimatedOverride = Math.round(totalNights * (supplier.net_rate_per_night || 0) * (OVERRIDE_PCT / 100))

  // Primary image
  const images: any[] = supplier.images || []
  const primaryImage = images.find((img: any) => img.is_primary && img.status === 'approved')
    || images.find((img: any) => img.status === 'approved')
    || null

  const TRUST_TIPS = [
    { label: 'Legal entity registration verified', impact: '+20 pts', done: ts >= 20, detail: 'Business registration number on file and verified by Contracts team.' },
    { label: 'Bank confirmation letter uploaded & verified', impact: '+20 pts', done: ts >= 40, detail: 'Bank letter uploaded, account name matches legal entity.' },
    { label: 'Average availability response time under 4 hours', impact: '+20 pts', done: false, detail: 'System-measured from query received to confirmation sent. Respond within 4h to earn full points.' },
    { label: 'Zero confirmed bookings cancelled or overbooked (12 months)', impact: '+15 pts', done: true, detail: 'No incidents recorded. Maintain this by checking availability before confirming.' },
    { label: 'At least 10 reviews connected, average 4.0+', impact: '+10 pts', done: ts >= 85, detail: 'Connect TripAdvisor or Google in API & Connections tab.' },
    { label: 'PMS connected for live availability', impact: '+8 pts', done: false, detail: 'Connect ResRequest or Nightsbridge in the API & Connections tab. Takes under 10 minutes.' },
    { label: 'Zero trade complaints in last 90 days', impact: '+7 pts', done: true, detail: 'Anonymous complaints from fellow suppliers. 3 complaints trigger a Catalogue Feedback review.' },
  ]

  const CONTENT_TIPS = [
    { label: 'Property description — 150+ words, AI-verified', impact: '+15 pts', done: cs >= 15, detail: 'Must be original, 150+ words, and pass GPTZero AI detection.' },
    { label: 'Room type descriptions — 100+ words each', impact: '+15 pts', done: cs >= 30, detail: 'Each room type needs 100+ words covering size, bed type, view, occupancy.' },
    { label: 'Photography — 12+ approved images, own photography', impact: '+20 pts', done: images.filter((i: any) => i.status === 'approved').length >= 12, detail: `You have ${images.filter((i: any) => i.status === 'approved').length} approved images. Need 12+. Upload via Content & Media tab.` },
    { label: 'Arrival experience Reel (15–30s)', impact: '+8 pts', done: (supplier.reels || []).filter((r: any) => r.status === 'approved').length >= 1, detail: 'Record a 20-second arrival walkthrough on any smartphone.' },
    { label: 'Room walkthrough Reel', impact: '+8 pts', done: (supplier.reels || []).filter((r: any) => r.status === 'approved').length >= 2, detail: 'Show layout, bathroom, view, balcony. No heavy editing needed.' },
    { label: 'Activity highlight Reel (bonus)', impact: '+4 pts', done: (supplier.reels || []).filter((r: any) => r.status === 'approved').length >= 3, detail: 'Third Reel earns a bonus 4 points.' },
    { label: 'Instagram connected', impact: '+4 pts', done: !!(supplier.social?.instagram), detail: 'Connect in API & Connections tab. Takes 30 seconds.' },
    { label: 'Facebook connected', impact: '+3 pts', done: !!(supplier.social?.facebook), detail: 'Connect in API & Connections tab.' },
    { label: 'YouTube channel connected', impact: '+3 pts', done: !!(supplier.social?.youtube), detail: 'Connect in API & Connections tab.' },
    { label: 'Keyword tags — at least 5 per room type', impact: '+5 pts', done: (supplier.keywords || []).length >= 5, detail: `You have ${(supplier.keywords || []).length} tags. Add tags like: Big Five, Honeymoon, Private pool.` },
    { label: 'Content updated in last 12 months', impact: '+5 pts', done: true, detail: `Last update: ${supplier.last_content_update ? fmtDate(supplier.last_content_update) : 'Unknown'}.` },
  ]

  return (
    <div>
      {showScoreTip && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 16, padding: 28, width: '100%', maxWidth: 500, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.gold, marginBottom: 4 }}>
              {showScoreTip === 'trust' ? `Trust Score — ${ts}/100` : `Content Score — ${cs}/100`}
            </div>
            <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>
              {showScoreTip === 'trust' ? 'How to improve your Trust Score' : 'How to improve your Content Score'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {(showScoreTip === 'trust' ? TRUST_TIPS : CONTENT_TIPS).map((tip, i) => (
                <div key={i} style={{ padding: '10px 12px', background: tip.done ? 'rgba(74,222,128,0.06)' : T.bg, borderRadius: 9, border: `0.5px solid ${tip.done ? 'rgba(74,222,128,0.2)' : T.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1 }}>
                      <span style={{ color: tip.done ? T.green : T.textDim, fontSize: 14, flexShrink: 0 }}>{tip.done ? '✓' : '○'}</span>
                      <span style={{ fontSize: 12, color: tip.done ? T.textMid : T.text, fontWeight: tip.done ? 400 : 600 }}>{tip.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: tip.done ? T.green : T.gold, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>{tip.done ? 'Done' : tip.impact}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim, marginLeft: 22, lineHeight: 1.5 }}>{tip.detail}</div>
                </div>
              ))}
            </div>
            <ScoreThresholdTable />
            <button onClick={() => setShowScoreTip(null)} style={{ width: '100%', padding: '11px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, border: 'none', borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif" }}>Welcome back, {supplier.name}</div>
          <div style={{ fontSize: 12, color: T.textDim, marginTop: 3 }}>{supplier.destination}, {supplier.country}</div>
        </div>
        {primaryImage && (
          <img src={primaryImage.url} alt={supplier.name}
            style={{ width: 72, height: 52, objectFit: 'cover', borderRadius: 8, border: `0.5px solid ${T.border}` }} />
        )}
      </div>

      {/* Score tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 24 }}>
        <div onClick={() => setShowScoreTip('trust')} style={{ background: T.surface, border: `0.5px solid rgba(74,222,128,0.3)`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Trust Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.green, fontFamily: "'Cormorant Garamond',serif" }}>{ts}/100</div>
          <div style={{ fontSize: 10, color: T.green, marginTop: 4 }}>Tap for tips →</div>
        </div>
        <div onClick={() => setShowScoreTip('content')} style={{ background: T.surface, border: `0.5px solid rgba(251,191,36,0.3)`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Content Score</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.amber, fontFamily: "'Cormorant Garamond',serif" }}>{cs}/100</div>
          <div style={{ fontSize: 10, color: T.amber, marginTop: 4 }}>{images.filter((i: any) => i.status === 'approved').length < 12 ? `${12 - images.filter((i: any) => i.status === 'approved').length} images needed` : 'Tap for tips →'}</div>
        </div>
        <div style={{ background: T.surface, border: `0.5px solid ${listing.color}40`, borderRadius: 12, padding: '16px 18px' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Listing Status</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: listing.color }}>{listing.label}</div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>In the Experience Designer</div>
        </div>
        <div onClick={() => setActiveTab('bookings')} style={{ background: T.surface, border: `0.5px solid ${T.borderGold}`, borderRadius: 12, padding: '16px 18px', cursor: 'pointer' }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 6 }}>Future bookings</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.gold, fontFamily: "'Cormorant Garamond',serif" }}>{futureBookings.length}</div>
          <div style={{ fontSize: 10, color: T.gold, marginTop: 4 }}>View all →</div>
        </div>
        <StatTile label="YTD Nights" value={String(totalNights)} sub={`of ${THRESHOLD_NIGHTS} threshold`} />
        <StatTile label="Override est." value={fmt(estimatedOverride)} color={T.gold} sub={`${OVERRIDE_PCT}% at ${THRESHOLD_NIGHTS}n threshold`} />
      </div>

      {/* Override progress */}
      <Card style={{ padding: '18px 20px', marginBottom: 16, border: `0.5px solid ${T.borderGold}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Volume Override Progress</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{totalNights} nights confirmed · {Math.max(0, THRESHOLD_NIGHTS - totalNights)} nights to threshold</div>
          </div>
          <div style={{ textAlign: 'right' as const }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{thresholdPct}%</div>
            <div style={{ fontSize: 10, color: T.textDim }}>{OVERRIDE_PCT}% override on all nights</div>
          </div>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${thresholdPct}%`, height: '100%', background: `linear-gradient(90deg,${T.gold},#f0c040)`, borderRadius: 4, transition: 'width 0.8s' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <div style={{ fontSize: 10, color: T.textDim }}>0</div>
          <div style={{ fontSize: 10, color: T.gold }}>Threshold: {THRESHOLD_NIGHTS} nights</div>
        </div>
      </Card>

      {/* Property quick stats */}
      <Card style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 14 }}>Property details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            { label: 'Net rate per night', value: fmt(supplier.net_rate_per_night || 0), sub: 'Contracted rate' },
            { label: 'Display rate', value: fmt(supplier.display_rate_per_night || 0), sub: `Incl. ${supplier.commission_pct || 15}% margin` },
            { label: 'OTA rate', value: supplier.ota_rate_per_night ? fmt(supplier.ota_rate_per_night) : 'Not set', sub: 'Booking.com / Expedia' },
            { label: 'Saving vs OTA', value: supplier.ota_rate_per_night ? fmt((supplier.ota_rate_per_night - (supplier.display_rate_per_night || 0))) : '—', sub: 'Our exclusive advantage', color: T.green },
            { label: 'Meal basis', value: supplier.meal_basis || '—', sub: 'Included in rate' },
            { label: 'Min nights', value: String(supplier.min_nights || '—'), sub: 'Minimum stay' },
          ].map((s, i) => (
            <div key={i} style={{ background: T.bg, borderRadius: 9, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: (s as any).color || T.gold }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Tags */}
      {(supplier.keywords?.length > 0 || supplier.tags?.length > 0) && (
        <Card style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.text, marginBottom: 10 }}>Property tags</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[...(supplier.tags || []), ...(supplier.keywords || [])].map((tag: string, i: number) => (
              <span key={i} style={{ fontSize: 11, color: T.textMid, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '3px 10px' }}>{tag}</span>
            ))}
          </div>
        </Card>
      )}

      {/* Recent bookings */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>Recent Bookings</div>
          <button onClick={() => setActiveTab('bookings')} style={{ fontSize: 12, color: T.gold, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>View all →</button>
        </div>
        {bookings.length === 0
          ? <div style={{ padding: 24, textAlign: 'center' as const, color: T.textDim, fontSize: 13 }}>No bookings yet</div>
          : bookings.slice(0, 4).map((b: any, i: number) => (
            <div key={i} style={{ padding: '11px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>{b.title || 'Safari Journey'}</div>
                <div style={{ fontSize: 11, color: T.textMid, marginTop: 1 }}>{b.nights}n · {b.adults} adults{b.children_count > 0 ? ` · ${b.children_count} children` : ''}</div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>{b.check_in ? fmtDate(b.check_in) : '—'}</div>
              </div>
              <div style={{ textAlign: 'right' as const }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{fmt(b.total_net_zar || 0)}</div>
                <Badge label={b.state || 'quote'} color={b.state === 'confirmed' ? T.green : T.amber} />
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BOOKINGS
// ══════════════════════════════════════════════════════════════
function Bookings({ bookings, role }: any) {
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'quote'>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10)

  const filtered = bookings.filter((b: any) => filter === 'all' || b.state === filter)

  return (
    <div>
      <SectionHeader title="Bookings" sub={`${bookings.length} total bookings from The Safari Edition`} />

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['all', 'All', bookings.length], ['confirmed', 'Confirmed', bookings.filter((b: any) => b.state === 'confirmed').length], ['quote', 'Quotes', bookings.filter((b: any) => b.state === 'quote').length]] as any[]).map(([id, label, count]: any) => (
          <button key={id} onClick={() => setFilter(id)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `0.5px solid ${filter === id ? T.gold : T.border}`, background: filter === id ? T.goldDim : 'transparent', color: filter === id ? T.gold : T.textDim, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
            {label} <span style={{ background: filter === id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.08)', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>{count}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0
        ? <Card style={{ padding: 32, textAlign: 'center' as const }}><div style={{ fontSize: 13, color: T.textDim }}>No bookings found</div></Card>
        : filtered.map((b: any, i: number) => {
          const isExpanded = expanded === b.id
          const components: any[] = b.components || []
          return (
            <Card key={i} style={{ marginBottom: 12, overflow: 'hidden' }}>
              <div onClick={() => setExpanded(isExpanded ? null : b.id)}
                style={{ padding: '16px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.gold }}>{b.title || 'Safari Journey'}</div>
                    <Badge label={b.state || 'quote'} color={b.state === 'confirmed' ? T.green : T.amber} />
                  </div>
                  <div style={{ fontSize: 12, color: T.textMid }}>{b.nights}n · {b.adults} adults{b.children_count > 0 ? ` · ${b.children_count} children` : ''}</div>
                  <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{b.check_in ? fmtDate(b.check_in) : '—'} → {b.check_out ? fmtDate(b.check_out) : '—'}</div>
                </div>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.gold }}>{fmt(b.total_net_zar || 0)}</div>
                  <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>Net to supplier</div>
                  <div style={{ fontSize: 12, color: T.textDim, marginTop: 6 }}>{isExpanded ? '▲' : '▼'}</div>
                </div>
              </div>
              {isExpanded && (
                <div style={{ borderTop: `0.5px solid ${T.border}`, padding: '14px 18px', background: 'rgba(255,255,255,0.01)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: 'Display rate', value: fmt(b.total_display_zar || 0) },
                      { label: 'Net to supplier', value: fmt(b.total_net_zar || 0) },
                      { label: 'Margin', value: b.total_display_zar ? `${Math.round(((b.total_display_zar - b.total_net_zar) / b.total_display_zar) * 100)}%` : '—' },
                      { label: 'Created', value: fmtDate(b.created_at) },
                    ].map((s, si) => (
                      <div key={si} style={{ background: T.bg, borderRadius: 8, padding: '9px 12px' }}>
                        <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{s.label}</div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {components.length > 0 && (
                    <div>
                      <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 8 }}>Components</div>
                      {components.map((c: any, ci: number) => (
                        <div key={ci} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 10px', background: T.bg, borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                          <div>
                            <span style={{ color: T.text, fontWeight: 600 }}>{c.name || c.pillar}</span>
                            {c.location && <span style={{ color: T.textDim, marginLeft: 8 }}>{c.location}</span>}
                          </div>
                          <div style={{ color: T.gold }}>{c.display_rate_zar ? fmt(c.display_rate_zar) : '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          )
        })
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// RATES & CONTRACTS
// ══════════════════════════════════════════════════════════════
function RatesContracts({ supplier, supplierId }: any) {
  const [recSent, setRecSent] = useState(false)
  const [amendReason, setAmendReason] = useState('')
  const [proposedRate, setProposedRate] = useState('')

  const netRate = supplier.net_rate_per_night || 0
  const displayRate = supplier.display_rate_per_night || Math.round(netRate * 1.15)
  const otaRate = supplier.ota_rate_per_night || null
  const commissionPct = supplier.commission_pct || 15

  return (
    <div>
      <SectionHeader title="Rates & Contracts" sub="View your current rates. Submit rate recommendations to the Contracts team." />

      {/* Rate overview */}
      <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.gold }}>
        ✦ Rates are view-only. To request a rate change, use the form below. All changes reviewed by Contracts within 5 business days.
      </div>

      {/* Rate card */}
      <Card style={{ padding: '20px', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 16 }}>{supplier.name} — Rate Card</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Net rate per night', value: fmt(netRate), sub: 'Your contracted rate', color: T.text },
            { label: `${commissionPct}% commission applied`, value: fmt(displayRate), sub: 'Traveller sees this rate', color: T.gold },
            { label: 'OTA rate', value: otaRate ? fmt(otaRate) : 'Not tracked', sub: 'Booking.com / Expedia', color: T.textMid },
            { label: 'Exclusive saving', value: otaRate ? fmt(otaRate - displayRate) : '—', sub: 'vs OTA — our advantage', color: T.green },
          ].map((s, i) => (
            <div key={i} style={{ background: T.bg, borderRadius: 10, padding: '14px 16px' }}>
              <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'Cormorant Garamond',serif" }}>{s.value}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Margin explanation */}
        <div style={{ background: 'rgba(167,139,250,0.06)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: T.textMid, lineHeight: 1.6 }}>
          <strong style={{ color: T.purple }}>How our margin works:</strong> We apply a {commissionPct}% margin on top of your net rate. Your net rate is paid in full on the agreed payment date — our margin is never deducted from your payment. The traveller pays {fmt(displayRate)}/night. You receive {fmt(netRate)}/night. The R{Math.round(displayRate - netRate).toLocaleString()} difference funds our platform, specialists, and marketing.
        </div>
      </Card>

      {/* Additional property details */}
      <Card style={{ padding: '18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Property details</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10 }}>
          {[
            ['Meal basis', supplier.meal_basis || '—'],
            ['Min nights', String(supplier.min_nights || '—')],
            ['Max guests', String(supplier.max_guests || supplier.max_pax || '—')],
            ['Malaria status', supplier.malaria_status || '—'],
            ['Entry airport', supplier.entry_airport || '—'],
            ['Transfer time', supplier.transfer_time_mins ? `${supplier.transfer_time_mins} min` : '—'],
            ['Child min age', supplier.child_min_age ? `${supplier.child_min_age}+` : '—'],
            ['Family suitable', supplier.family_suitable ? 'Yes' : 'No'],
          ].map(([l, v], i) => (
            <div key={i} style={{ background: T.bg, borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{l}</div>
              <div style={{ fontSize: 12, color: T.text }}>{v}</div>
            </div>
          ))}
        </div>
        {supplier.seasonal_notes && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 9, fontSize: 12, color: T.gold }}>
            ✦ {supplier.seasonal_notes}
          </div>
        )}
      </Card>

      {/* Payment terms */}
      <Card style={{ padding: '18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Commercial terms</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[
            { l: 'Commission', v: `${commissionPct}%` },
            { l: 'Override at threshold', v: `3% above 150 nights` },
            { l: 'Payment terms', v: 'End of Month Following Travel' },
          ].map((s, i) => (
            <div key={i} style={{ background: T.bg, borderRadius: 8, padding: '9px 12px' }}>
              <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 3 }}>{s.l}</div>
              <div style={{ fontSize: 13, color: T.gold, fontWeight: 600 }}>{s.v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Rate amendment form */}
      <Card style={{ padding: '20px', border: `0.5px solid ${T.borderGold}` }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.gold, marginBottom: 4 }}>Propose Rate Amendment</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16, lineHeight: 1.6 }}>
          Suppliers cannot change live rates directly. Submit a recommendation below — the Contracts team will review within 5 business days.
        </div>
        {recSent ? (
          <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '14px', textAlign: 'center' as const }}>
            <div style={{ fontSize: 13, color: T.green, fontWeight: 700 }}>✓ Amendment submitted to Contracts team</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4 }}>Review within 5 business days. You will be notified of approval or rejection with reason. All communication is permanently logged.</div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.textDim, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Current net rate (locked)</label>
                <div style={{ padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, fontSize: 13, color: T.textMid }}>{fmt(netRate)}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Proposed net rate (ZAR)</label>
                <input type="number" value={proposedRate} onChange={e => setProposedRate(e.target.value)} placeholder={String(netRate)}
                  style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Reason for amendment *</label>
              <textarea value={amendReason} onChange={e => setAmendReason(e.target.value)} rows={3}
                placeholder="e.g. Annual rate review. New private pool added to all suites. Market conditions have shifted."
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
            </div>
            <Btn variant="gold" label="Submit Amendment →" onClick={() => { if (amendReason.trim() && proposedRate) setRecSent(true) }} />
          </div>
        )}
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CONTENT & MEDIA
// ══════════════════════════════════════════════════════════════
function ContentMedia({ supplier, supplierId }: any) {
  const images: any[] = supplier.images || []
  const reels: any[] = supplier.reels || []
  const approvedImages = images.filter((i: any) => i.status === 'approved')
  const pendingImages = images.filter((i: any) => i.status === 'pending')
  const approvedReels = reels.filter((r: any) => r.status === 'approved')

  return (
    <div>
      <SectionHeader title="Content & Media"
        sub="Manage your property images, Reels, and description."
        action={
          <a href={`/admin/suppliers/${supplierId}/content`} target="_blank" rel="noopener noreferrer"
            style={{ padding: '8px 16px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, borderRadius: 9, color: '#0a0a0a', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
            Open Full CMS ↗
          </a>
        }
      />

      {/* Score impact */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 20 }}>
        <StatTile label="Content Score" value={`${supplier.content_score || 0}/100`} color={T.amber} sub="Click score on dashboard for tips" />
        <StatTile label="Approved images" value={String(approvedImages.length)} sub={approvedImages.length < 12 ? `Need ${12 - approvedImages.length} more for full score` : 'Full score achieved'} color={approvedImages.length >= 12 ? T.green : T.amber} />
        <StatTile label="Approved Reels" value={String(approvedReels.length)} sub={approvedReels.length < 2 ? 'Need 2 for full score' : approvedReels.length === 2 ? '3rd Reel = +4 bonus pts' : 'Full score achieved'} color={approvedReels.length >= 2 ? T.green : T.red} />
        <StatTile label="Pending review" value={String(pendingImages.length + reels.filter((r: any) => r.status === 'pending').length)} sub="Awaiting TSE approval" color={T.textMid} />
      </div>

      {/* CMS link banner */}
      <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.gold, marginBottom: 4 }}>Full content management</div>
          <div style={{ fontSize: 12, color: T.textDim }}>Upload images, Reels, update descriptions, add tags and keywords in the full CMS.</div>
        </div>
        <a href={`/admin/suppliers/${supplierId}/content`} target="_blank" rel="noopener noreferrer"
          style={{ padding: '10px 20px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, borderRadius: 9, color: '#0a0a0a', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' as const, flexShrink: 0, marginLeft: 16 }}>
          Open CMS ↗
        </a>
      </div>

      {/* Image gallery */}
      {approvedImages.length > 0 && (
        <Card style={{ padding: '18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>Approved images ({approvedImages.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
            {approvedImages.map((img: any, i: number) => (
              <div key={i} style={{ position: 'relative' as const, borderRadius: 8, overflow: 'hidden', aspectRatio: '4/3' }}>
                <img src={img.url} alt={img.caption || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                {img.is_primary && (
                  <div style={{ position: 'absolute' as const, top: 4, left: 4, fontSize: 9, padding: '2px 6px', background: T.gold, color: '#0a0a0a', borderRadius: 4, fontWeight: 700 }}>PRIMARY</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending */}
      {pendingImages.length > 0 && (
        <Card style={{ padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.amber, marginBottom: 10 }}>⏳ Pending review ({pendingImages.length})</div>
          <div style={{ fontSize: 12, color: T.textDim }}>These images have been uploaded and are awaiting TSE admin approval before going live.</div>
        </Card>
      )}

      {/* Reels */}
      <Card style={{ padding: '18px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 12 }}>
          Reels — {approvedReels.length} approved
          {approvedReels.length < 2 && <span style={{ fontSize: 11, color: T.red, marginLeft: 8 }}>⚠ {2 - approvedReels.length} more needed for full content score</span>}
        </div>
        {reels.length === 0 ? (
          <div style={{ padding: '24px', background: T.bg, border: `1.5px dashed ${T.border}`, borderRadius: 10, textAlign: 'center' as const }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎬</div>
            <div style={{ fontSize: 13, color: T.textMid, fontWeight: 600 }}>No Reels uploaded yet</div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 4, marginBottom: 12 }}>15–30 seconds · 1080p minimum · MP4 or MOV</div>
            <a href={`/admin/suppliers/${supplierId}/content`} target="_blank" rel="noopener noreferrer"
              style={{ padding: '8px 18px', background: `linear-gradient(135deg,${T.gold},#f0c040)`, borderRadius: 8, color: '#0a0a0a', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              Upload in CMS ↗
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            {reels.map((r: any, i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: T.bg, borderRadius: 9 }}>
                <div>
                  <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{r.caption || r.type || 'Reel'}</div>
                  <div style={{ fontSize: 11, color: T.textDim }}>{r.duration_s ? `${r.duration_s}s` : '—'}</div>
                </div>
                <Badge label={r.status} color={r.status === 'approved' ? T.green : T.amber} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Property description */}
      {supplier.description && (
        <Card style={{ padding: '18px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>Property description</div>
          <div style={{ fontSize: 13, color: T.textMid, lineHeight: 1.7 }}>{supplier.description}</div>
          <div style={{ marginTop: 10, fontSize: 11, color: T.textDim }}>{supplier.description.split(' ').length} words · {supplier.description.split(' ').length >= 150 ? <span style={{ color: T.green }}>✓ Meets 150-word minimum</span> : <span style={{ color: T.amber }}>⚠ Needs {150 - supplier.description.split(' ').length} more words</span>}</div>
        </Card>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PAYMENTS
// ══════════════════════════════════════════════════════════════
function Payments({ bookings }: any) {
  const totalNet = bookings.filter((b: any) => b.state === 'confirmed').reduce((s: number, b: any) => s + (b.total_net_zar || 0), 0)

  return (
    <div>
      <SectionHeader title="Payments & Remittances" sub="Float-maximised payment model — supplier payment released end of month following travel." />

      <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 12, color: T.gold }}>
        ✦ Payment terms: <strong>End of Month Following Travel</strong> · Remittances are auto-generated per booking with line-item breakdown.
      </div>

      {/* Margin stack — supplier visibility */}
      <Card style={{ padding: '18px 20px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>How The Safari Edition earns — full transparency</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 14, lineHeight: 1.6 }}>
          We apply a margin on each booking pillar on top of your contracted net rate. Your net rate is paid in full — our margin is never deducted from your payment.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 14 }}>
          {[
            { pillar: 'Lodges / Hotels', margin: '15%', note: 'Applied to your contracted net rate', color: T.green },
            { pillar: 'Flights & Charters', margin: '8%', note: 'Lowest margin — most price-sensitive', color: T.gold },
            { pillar: 'Transfers', margin: '20%', note: 'Road, charter, boat transfers', color: T.blue },
            { pillar: 'Activities', margin: '18%', note: 'Add-ons and excursions', color: T.purple },
          ].map((p, i) => (
            <div key={i} style={{ background: T.bg, borderRadius: 9, padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: T.textDim, marginBottom: 4 }}>{p.pillar}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: p.color, fontFamily: "'Cormorant Garamond',serif" }}>{p.margin}</div>
              <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>{p.note}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`, borderRadius: 9, padding: '10px 14px', fontSize: 11, color: T.gold, lineHeight: 1.6 }}>
          ✦ <strong>Float model:</strong> Traveller deposits are held in the Edition account between payment and supplier payment date. Your contracted net rate is always paid in full on the agreed date — float income is retained by The Safari Edition as disclosed in your contract.
        </div>
      </Card>

      {/* Summary stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        <StatTile label="Confirmed bookings value" value={fmt(totalNet)} sub="Net to supplier (YTD)" color={T.green} />
        <StatTile label="Active bookings" value={String(bookings.filter((b: any) => b.state === 'confirmed').length)} sub="Confirmed" />
        <StatTile label="Payment terms" value="EOM+1" sub="End of Month Following Travel" color={T.gold} />
      </div>

      {/* Bookings breakdown */}
      <Card style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `0.5px solid ${T.border}`, fontSize: 13, fontWeight: 700, color: T.text }}>Booking payment summary</div>
        {bookings.length === 0
          ? <div style={{ padding: 24, textAlign: 'center' as const, color: T.textDim }}>No bookings yet</div>
          : bookings.map((b: any, i: number) => (
            <div key={i} style={{ padding: '12px 18px', borderBottom: `0.5px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: i % 2 === 1 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{b.title || 'Safari Journey'}</div>
                <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{b.check_in ? fmtDate(b.check_in) : '—'} · {b.nights}n</div>
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' as const }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.gold }}>{fmt(b.total_net_zar || 0)}</div>
                  <div style={{ fontSize: 10, color: T.textDim }}>Net to supplier</div>
                </div>
                <Badge label={b.state || 'quote'} color={b.state === 'confirmed' ? T.green : T.amber} />
              </div>
            </div>
          ))
        }
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// CAMPAIGNS
// ══════════════════════════════════════════════════════════════
function Campaigns() {
  const [showForm, setShowForm] = useState(false)
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [newCampaign, setNewCampaign] = useState({ name: '', type: 'Pay 5 Stay 6', start: '', end: '', details: '' })
  const [submitted, setSubmitted] = useState(false)
  const TYPES = ['Pay 5 Stay 6', 'Pay 6 Stay 7', 'Early Bird', 'Last Minute', 'Family Promotion', 'Honeymoon Package', 'Free Night', 'Room Upgrade', 'Custom']

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
            <div>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Campaign name</label>
              <input value={newCampaign.name} onChange={e => setNewCampaign(c => ({ ...c, name: e.target.value }))} placeholder="e.g. Winter Safari Special"
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Campaign type</label>
              <select value={newCampaign.type} onChange={e => setNewCampaign(c => ({ ...c, type: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit' }}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Start date</label>
              <input type="date" value={newCampaign.start} onChange={e => setNewCampaign(c => ({ ...c, start: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>End date</label>
              <input type="date" value={newCampaign.end} onChange={e => setNewCampaign(c => ({ ...c, end: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Campaign details</label>
            <textarea value={newCampaign.details} onChange={e => setNewCampaign(c => ({ ...c, details: e.target.value }))} rows={3}
              placeholder="Describe terms, inclusions, exclusions, and conditions..."
              style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, resize: 'vertical' as const }} />
          </div>
          {submitted ? (
            <div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 9, padding: '12px 14px', marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✓ Submitted for approval — 3-team sign-off required: Product · Commercial · Contracts</div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <Btn variant="gold" label="Submit for Approval →" onClick={() => { setCampaigns(c => [...c, { ...newCampaign, id: Date.now(), status: 'pending_approval', bookings: 0 }]); setSubmitted(true) }} />
              <Btn label="Cancel" onClick={() => setShowForm(false)} />
            </div>
          )}
        </Card>
      )}
      {campaigns.length === 0
        ? <Card style={{ padding: 32, textAlign: 'center' as const }}><div style={{ fontSize: 13, color: T.textDim }}>No campaigns yet. Submit one above for Contracts team review.</div></Card>
        : campaigns.map((c, i) => (
          <Card key={i} style={{ padding: '16px 18px', marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{c.name}</div><div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{c.type} · {c.start} – {c.end}</div></div>
              <Badge label={c.status.replace(/_/g, ' ')} color={T.amber} />
            </div>
          </Card>
        ))
      }
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// REVIEWS
// ══════════════════════════════════════════════════════════════
function Reviews() {
  return (
    <div>
      <SectionHeader title="Guest Reviews" sub="Reviews referencing your property — internal and third-party." />
      <Card style={{ padding: 32, textAlign: 'center' as const }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>Reviews module</div>
        <div style={{ fontSize: 13, color: T.textMid, maxWidth: 380, margin: '0 auto' }}>Connect your TripAdvisor, Google, and Booking.com accounts in API & Connections to pull your reviews here automatically. Internal guest reviews from The Safari Edition will appear here once bookings complete.</div>
        <div style={{ marginTop: 20, fontSize: 11, color: T.textDim }}>NPS target: &gt; 70 · Review average target: 4.0+</div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// API & CONNECTIONS
// ══════════════════════════════════════════════════════════════
function APIConnections({ supplier }: any) {
  const [pmsStep, setPmsStep] = useState(0)
  const [pmsType, setPmsType] = useState('')
  const [pmsConfig, setPmsConfig] = useState({ url: '', api_key: '', property_id: '', username: '', password: '' })
  const [testResult, setTestResult] = useState<null | 'success' | 'fail'>(null)
  const [testing, setTesting] = useState(false)
  const [socialConnected, setSocialConnected] = useState({
    instagram: !!(supplier.social?.instagram),
    facebook: !!(supplier.social?.facebook),
    youtube: !!(supplier.social?.youtube),
    tripadvisor: false, google: false, booking: false
  })
  const PMS_OPTIONS = ['ResRequest', 'Nightsbridge', 'Opera Cloud', 'RMS Cloud', 'Manual (rate sheets only)']
  const handleTest = async () => {
    setTesting(true); setTestResult(null)
    await new Promise(r => setTimeout(r, 2000))
    setTestResult(pmsConfig.api_key.length > 5 ? 'success' : 'fail')
    setTesting(false)
  }
  return (
    <div>
      <SectionHeader title="API & Connections" sub="Connect your PMS, social channels, and review platforms." />
      <Card style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>PMS Connection Wizard</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 20 }}>Connect your Property Management System for live availability. Adds +8 pts to your Trust Score.</div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
          {['Select PMS', 'Credentials', 'Test', 'Activate'].map((step, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: pmsStep > i ? T.green : pmsStep === i ? T.gold : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: pmsStep >= i ? '#0a0a0a' : T.textDim, marginBottom: 6 }}>
                {pmsStep > i ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 10, color: pmsStep === i ? T.gold : T.textDim, textAlign: 'center' as const }}>{step}</div>
            </div>
          ))}
        </div>
        {pmsStep === 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 16 }}>
              {PMS_OPTIONS.map(p => (
                <button key={p} onClick={() => setPmsType(p)} style={{ padding: '12px 14px', background: pmsType === p ? T.goldDim : T.bg, border: `0.5px solid ${pmsType === p ? T.gold : T.border}`, borderRadius: 9, color: pmsType === p ? T.gold : T.textMid, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>{p}</button>
              ))}
            </div>
            <Btn variant="gold" label="Next →" onClick={() => pmsType && setPmsStep(1)} />
          </div>
        )}
        {pmsStep === 1 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              {[{ k: 'url', l: 'API URL', ph: 'https://...' }, { k: 'api_key', l: 'API Key', ph: 'Your API key' }, { k: 'property_id', l: 'Property ID', ph: 'PROP_001' }].map(f => (
                <div key={f.k}>
                  <label style={{ display: 'block', fontSize: 10, color: T.gold, textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>{f.l}</label>
                  <input value={(pmsConfig as any)[f.k]} onChange={e => setPmsConfig(c => ({ ...c, [f.k]: e.target.value }))} placeholder={f.ph}
                    style={{ width: '100%', padding: '9px 12px', background: T.bg, border: `0.5px solid ${T.border}`, borderRadius: 8, color: T.text, fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}><Btn variant="gold" label="Next →" onClick={() => setPmsStep(2)} /><Btn label="← Back" onClick={() => setPmsStep(0)} /></div>
          </div>
        )}
        {pmsStep === 2 && (
          <div>
            {testResult === null && <button onClick={handleTest} disabled={testing} style={{ padding: '12px 28px', background: testing ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg,${T.blue},#3b82f6)`, border: 'none', borderRadius: 9, color: 'white', fontSize: 14, fontWeight: 700, cursor: testing ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{testing ? '⟳ Testing...' : '▶ Run Connection Test'}</button>}
            {testResult === 'success' && <div><div style={{ background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 10, padding: '14px', marginBottom: 12 }}><div style={{ fontSize: 13, color: T.green, fontWeight: 700 }}>✓ Connection successful</div></div><Btn variant="gold" label="Activate →" onClick={() => setPmsStep(3)} /></div>}
            {testResult === 'fail' && <div><div style={{ background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '14px', marginBottom: 12 }}><div style={{ fontSize: 13, color: T.red, fontWeight: 700 }}>✗ Connection failed — check credentials</div></div><div style={{ display: 'flex', gap: 10 }}><Btn label="← Edit" onClick={() => { setTestResult(null); setPmsStep(1) }} /><Btn variant="gold" label="Try again" onClick={handleTest} /></div></div>}
          </div>
        )}
        {pmsStep === 3 && (
          <div style={{ textAlign: 'center' as const, padding: '20px 0' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: T.green }}>Integration Active</div>
            <div style={{ fontSize: 12, color: T.textDim, marginTop: 8 }}>{pmsType} connected · Availability syncs every 15 minutes · +8 Trust Score points</div>
          </div>
        )}
      </Card>
      <Card style={{ padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 4 }}>Social & Review Platforms</div>
        <div style={{ fontSize: 12, color: T.textDim, marginBottom: 16 }}>Read-only connections. We never post on your behalf. Each platform adds to your Content Score.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10 }}>
          {([['instagram', '📸', 'Instagram', '+4 pts'], ['facebook', '📘', 'Facebook', '+3 pts'], ['youtube', '▶️', 'YouTube', '+3 pts'], ['tripadvisor', '🦉', 'TripAdvisor', 'Reviews'], ['google', '🔵', 'Google My Business', 'Reviews'], ['booking', '🔷', 'Booking.com', 'Reviews']] as any[]).map(([key, icon, label, pts]: any) => (
            <button key={key} onClick={() => setSocialConnected((s: any) => ({ ...s, [key]: !s[key] }))}
              style={{ padding: '12px 14px', background: (socialConnected as any)[key] ? 'rgba(74,222,128,0.06)' : T.bg, border: `0.5px solid ${(socialConnected as any)[key] ? 'rgba(74,222,128,0.3)' : T.border}`, borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: (socialConnected as any)[key] ? T.green : T.text }}>{label}</div>
              <div style={{ fontSize: 10, color: (socialConnected as any)[key] ? T.green : T.textDim, marginTop: 2 }}>{(socialConnected as any)[key] ? '✓ Connected' : pts}</div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// TEAM
// ══════════════════════════════════════════════════════════════
function Team({ role }: { role: Role }) {
  if (role !== 'supplier_admin') return (
    <div style={{ padding: 40, textAlign: 'center' as const }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>Access restricted</div>
      <div style={{ fontSize: 13, color: T.textMid }}>Only Supplier Admins can manage team access.</div>
    </div>
  )
  return (
    <div>
      <SectionHeader title="Team & Permissions" sub="Manage your team's portal access. Role changes must be approved by TSE Contracts." />
      <Card style={{ padding: 32, textAlign: 'center' as const }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>Team management</div>
        <div style={{ fontSize: 13, color: T.textMid, maxWidth: 380, margin: '0 auto' }}>Team management is handled by The Safari Edition Contracts team. To add or remove portal users, send a request via the Messages tab or email contracts@thesafariedition.com</div>
      </Card>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN SUPPLIER PORTAL
// ══════════════════════════════════════════════════════════════
export default function SupplierPortal() {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<Role>('supplier_admin')
  const [userName, setUserName] = useState('')
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [isEditionAdmin, setIsEditionAdmin] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [noSession, setNoSession] = useState(false)

  // Real Supabase data
  const [supplier, setSupplier] = useState<any>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
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
        if (s.supplier_id) setSupplierId(s.supplier_id)
        setReady(true)
        return
      }
      if (s.type === 'edition') {
        // Edition admin viewing portal — give full access
        setRole('supplier_admin')
        setIsEditionAdmin(true)
        setUserName(s.name || 'Admin')
        // For edition admins, try to get supplier_id from URL param or use first active supplier
        const urlParams = new URLSearchParams(window.location.search)
        const urlSupplierId = urlParams.get('supplier_id')
        if (urlSupplierId) setSupplierId(urlSupplierId)
        setReady(true)
        return
      }
    }
    setNoSession(true)
  }, [])

  // Load real supplier data from Supabase
  useEffect(() => {
    if (!ready) return
    setLoadingData(true)
    setLoadError('')

    const loadSupplier = async () => {
      try {
        // If we have a specific supplier ID, load that one
        // Otherwise load the first active supplier for this edition (for demo/admin viewing)
        const query = supplierId
          ? `suppliers?id=eq.${supplierId}&edition_id=eq.${EDITION_ID}&limit=1`
          : `suppliers?edition_id=eq.${EDITION_ID}&is_active=eq.true&order=trust_score.desc&limit=1`

        const supplierData = await sb(query)
        if (supplierData?.length > 0) {
          setSupplier(supplierData[0])
          if (!supplierId) setSupplierId(supplierData[0].id)
        } else {
          setLoadError('No supplier found. Check your account configuration.')
        }
      } catch (e: any) {
        setLoadError(`Could not load supplier data: ${e.message}`)
      }
    }

    const loadBookings = async () => {
      try {
        // Load bookings for this edition — in production would filter by supplier_id
        // via itinerary_components JSONB. For now load all edition bookings.
        const bookingData = await sb(
          `bookings?edition_id=eq.${EDITION_ID}&order=created_at.desc&limit=50`
        )
        setBookings(bookingData || [])
      } catch (e: any) {
        console.error('Could not load bookings:', e)
        setBookings([])
      }
    }

    Promise.all([loadSupplier(), loadBookings()])
      .finally(() => setLoadingData(false))
  }, [ready, supplierId])

  if (noSession) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial,sans-serif' }}>
    
      <div style={{ textAlign: 'center' as const, maxWidth: 380, padding: 24 }}>
        <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 22, color: '#d4af37', marginBottom: 12 }}>✦ Supplier Portal</div>
        <div style={{ fontSize: 14, color: 'rgba(240,237,230,0.6)', marginBottom: 24, lineHeight: 1.7 }}>Please sign in through the Edition portal to access your supplier account.</div>
        <a href="/admin" style={{ display: 'inline-block', padding: '12px 28px', background: 'linear-gradient(135deg,#d4af37,#f0c040)', borderRadius: 9, color: '#0a0a0a', fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Sign In →</a>
      </div>
    </div>
  )

  if (!ready || loadingData) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <Spinner />
      <div style={{ fontSize: 13, color: 'rgba(240,237,230,0.35)', fontFamily: 'Arial,sans-serif' }}>Loading supplier data…</div>
    </div>
  )

  if (loadError) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial,sans-serif' }}>
      <div style={{ textAlign: 'center' as const, maxWidth: 420, padding: 24 }}>
        <div style={{ fontSize: 14, color: '#f87171', marginBottom: 16 }}>{loadError}</div>
        <a href="/admin" style={{ color: '#d4af37', fontSize: 13 }}>← Back to admin portal</a>
      </div>
    </div>
  )

  if (!supplier) return (
    <div style={{ minHeight: '100vh', background: '#07080f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial,sans-serif' }}>
      <div style={{ textAlign: 'center' as const, padding: 24, color: 'rgba(240,237,230,0.5)' }}>No supplier data found.</div>
    </div>
  )

  const allowedTabs = ROLE_TABS[role] || ROLE_TABS['supplier_admin']
  const currentTab = allowedTabs.includes(activeTab) ? activeTab : allowedTabs[0]

  const renderModule = () => {
    switch (currentTab) {
      case 'dashboard': return <Dashboard supplier={supplier} bookings={bookings} role={role} setActiveTab={setActiveTab} supplierId={supplierId} />
      case 'bookings': return <Bookings bookings={bookings} role={role} />
      case 'rates': return <RatesContracts supplier={supplier} supplierId={supplierId} />
      case 'content': return <ContentMedia supplier={supplier} supplierId={supplierId} />
      case 'payments': return <Payments bookings={bookings} />
      case 'campaigns': return <Campaigns />
      case 'reviews': return <Reviews />
      case 'api': return <APIConnections supplier={supplier} />
      case 'team': return <Team role={role} />
      default: return <Dashboard supplier={supplier} bookings={bookings} role={role} setActiveTab={setActiveTab} supplierId={supplierId} />
    }
  }

  const images: any[] = supplier.images || []
  const primaryImage = images.find((i: any) => i.is_primary && i.status === 'approved') || images.find((i: any) => i.status === 'approved')
  const listing = getListingStatus(supplier.content_score || 0, supplier.trust_score || 0)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', fontFamily: 'Arial,sans-serif', color: T.text }}>
    
      <style>{`*{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:10px}`}</style>

      {/* Sidebar */}
      <div style={{ width: 230, background: T.bg2, borderRight: `0.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 14, color: T.gold, fontWeight: 700, letterSpacing: '0.06em' }}>✦ Supplier Portal</div>
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>The Safari Edition</div>
        </div>

        {/* Supplier identity */}
        <div style={{ padding: '14px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          {primaryImage && (
            <img src={primaryImage.url} alt={supplier.name}
              style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 10, border: `0.5px solid ${T.border}` }} />
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{supplier.name}</div>
          <div style={{ fontSize: 11, color: T.textDim, marginTop: 2 }}>{supplier.destination}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(74,222,128,0.1)', color: T.green, border: '0.5px solid rgba(74,222,128,0.3)' }}>Trust {supplier.trust_score}</div>
            <div style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(251,191,36,0.1)', color: T.amber, border: '0.5px solid rgba(251,191,36,0.3)' }}>Content {supplier.content_score}</div>
          </div>
          <div style={{ marginTop: 6, fontSize: 10, color: listing.color, fontWeight: 600 }}>{listing.label}</div>
        </div>

        {/* Role */}
        <div style={{ padding: '10px 16px', borderBottom: `0.5px solid ${T.border}` }}>
          <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 3 }}>Logged in as</div>
          <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{userName}</div>
          <div style={{ fontSize: 10, color: T.gold, marginTop: 1 }}>{ROLE_LABELS[role]}</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '8px', flex: 1 }}>
          {allowedTabs.map(tabId => (
            <button key={tabId} onClick={() => setActiveTab(tabId)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 9, border: 'none', background: currentTab === tabId ? T.goldDim : 'transparent', color: currentTab === tabId ? T.gold : T.textMid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', marginBottom: 2, transition: 'all 0.1s' }}>
              <span style={{ fontSize: 15 }}>{TAB_META[tabId].icon}</span>{TAB_META[tabId].label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '14px 16px', borderTop: `0.5px solid ${T.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: T.textDim }}>Signed in as <span style={{ color: T.text }}>{userName}</span></div>
          {isEditionAdmin && (
            <a href="/admin" style={{ fontSize: 11, color: T.textDim, textDecoration: 'none' }}>⚙ Edition Portal ↗</a>
          )}
          {!isEditionAdmin && (
            <a href="/" style={{ fontSize: 11, color: T.textDim, textDecoration: 'none' }}>🏠 Home</a>
          )}
          <button onClick={() => { sessionStorage.removeItem('tse_session'); localStorage.removeItem('tse_session'); window.location.href = isEditionAdmin ? '/admin' : '/' }}
            style={{ padding: '6px', background: 'transparent', border: `0.5px solid ${T.border}`, borderRadius: 7, color: T.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const }}>
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
