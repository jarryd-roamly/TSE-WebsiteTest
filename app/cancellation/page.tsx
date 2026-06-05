'use client';

// Cancellation Policy — The Safari Edition
// Industry-standard luxury safari cancellation terms
// Last updated: May 2026

export default function CancellationPage() {
  const tiers = [
    { window: '90+ days before travel',  fee: '0%',   description: 'Full refund of all payments made, less a R2,500 administration fee. Deposit returned within 10 business days.' },
    { window: '61–90 days before travel', fee: '25%',  description: '25% of total booking value forfeited. Remaining 75% refunded within 10 business days.' },
    { window: '31–60 days before travel', fee: '50%',  description: '50% of total booking value forfeited. Remaining 50% refunded within 10 business days.' },
    { window: '15–30 days before travel', fee: '75%',  description: '75% of total booking value forfeited. Remaining 25% refunded within 10 business days.' },
    { window: '0–14 days before travel',  fee: '100%', description: 'Full booking value forfeited. No refund. Travel insurance recommended.' },
  ];

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh', color: '#f5f0e8', fontFamily: "'Jost', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap');
        .legal-body h1 { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:clamp(28px,4vw,42px); color:#f5f0e8; letter-spacing:0.04em; margin-bottom:8px; }
        .legal-body h2 { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:22px; color:rgba(200,169,110,0.9); margin:36px 0 14px; border-bottom:0.5px solid rgba(200,169,110,0.15); padding-bottom:8px; }
        .legal-body h3 { font-weight:400; font-size:14px; color:rgba(245,240,232,0.75); letter-spacing:0.06em; margin:20px 0 8px; }
        .legal-body p  { font-weight:200; font-size:13px; color:rgba(245,240,232,0.55); line-height:1.9; margin-bottom:14px; }
        .legal-body ul { padding-left:20px; margin-bottom:14px; }
        .legal-body ul li { font-weight:200; font-size:13px; color:rgba(245,240,232,0.55); line-height:1.9; margin-bottom:6px; }
        .legal-body a  { color:rgba(200,169,110,0.7); }
        .legal-notice { background:rgba(200,169,110,0.06); border:0.5px solid rgba(200,169,110,0.2); border-radius:10px; padding:16px 20px; margin-bottom:28px; }
        .legal-notice p { color:rgba(200,169,110,0.75); margin:0; }
        .cancel-row { display:grid; grid-template-columns:1fr 80px 2fr; gap:16px; align-items:start; padding:16px 0; border-bottom:0.5px solid rgba(255,255,255,0.06); }
        .cancel-row:last-child { border-bottom:none; }
        .cancel-label { font-weight:300; font-size:12px; color:rgba(245,240,232,0.6); letter-spacing:0.04em; padding-top:2px; }
        .cancel-pct { font-family:'Cormorant Garamond',serif; font-weight:400; font-size:22px; text-align:right; }
        .cancel-desc { font-weight:200; font-size:12px; color:rgba(245,240,232,0.45); line-height:1.75; }
        @media(max-width:560px){ .cancel-row{grid-template-columns:1fr 60px; gap:10px;} .cancel-desc{grid-column:1/-1;} }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,0,0.97)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(200,169,110,0.1)', padding: '0 clamp(16px,4vw,56px)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 16, color: 'rgba(200,169,110,0.9)', textDecoration: 'none', letterSpacing: '0.08em' }}>
          The Safari Edition
        </a>
        <span style={{ fontWeight: 200, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)' }}>
          Cancellation Policy
        </span>
      </nav>

      <div className="legal-body" style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,48px) 80px' }}>

        <h1>Cancellation Policy</h1>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', marginBottom: 32 }}>
          The Safari Edition (Pty) Ltd · Version 1.0 · Effective June 2026
        </p>

        <div className="legal-notice">
          <p><strong style={{ color: 'rgba(200,169,110,0.9)' }}>We recommend purchasing travel insurance at the time of booking.</strong> Safari travel involves significant advance payments to lodges, charter operators, and airlines that are themselves non-refundable. Insurance protects you against the cancellation fees below in the event of unforeseen circumstances.</p>
        </div>

        <h2>Cancellation Fees</h2>
        <p>All cancellations must be submitted in writing to your Journey Specialist. The following fees apply based on the number of days before your travel start date:</p>

        {/* Fee table */}
        <div style={{ margin: '24px 0 32px', background: 'rgba(255,255,255,0.02)', border: '0.5px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0 20px' }}>
          {tiers.map((t, i) => (
            <div key={i} className="cancel-row">
              <div className="cancel-label">{t.window}</div>
              <div className="cancel-pct" style={{ color: i === 0 ? '#4ade80' : i === 4 ? '#f87171' : 'rgba(200,169,110,0.85)' }}>
                {t.fee}
              </div>
              <div className="cancel-desc">{t.description}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.3)', letterSpacing: '0.04em' }}>
          All percentages are calculated on the total confirmed booking value inclusive of all components. Administration fee of R2,500 applies to all cancellations regardless of timeline.
        </p>

        <h2>How to Cancel</h2>
        <p>To cancel a confirmed booking:</p>
        <ul>
          <li>Contact your Journey Specialist directly via WhatsApp or email.</li>
          <li>Alternatively, email <a href="mailto:journeys@thesafariedition.com">journeys@thesafariedition.com</a> with your booking reference and reason for cancellation.</li>
          <li>You will receive written acknowledgement within 1 business day.</li>
          <li>Your cancellation date is the date on which written notice is received and acknowledged by us.</li>
        </ul>

        <h2>Refund Processing</h2>
        <p>Refunds are processed to the original payment method within <strong style={{ color: 'rgba(245,240,232,0.75)' }}>10 business days</strong> of cancellation confirmation. Card refunds may take a further 3–7 business days to appear on your statement, depending on your card issuer.</p>
        <p>Where bookings were paid in multiple currencies, refunds will be made in the currency in which payment was made at the original exchange rate. We are not liable for exchange rate movements between the date of payment and the date of refund.</p>

        <h2>Changes vs Cancellations</h2>
        <p>If you wish to <strong style={{ color: 'rgba(245,240,232,0.75)' }}>amend</strong> (rather than cancel) your booking, a different fee structure applies. Please contact your Journey Specialist. Where an amendment cannot be accommodated and you choose not to travel on the original itinerary, cancellation fees will apply.</p>

        <h2>Force Majeure</h2>
        <p>We will not be liable for cancellations or changes arising from Force Majeure events — circumstances beyond our reasonable control including: natural disasters, war, civil unrest, pandemics, government travel bans, or airport/airstrip closures. In Force Majeure situations, we will:</p>
        <ul>
          <li>Work with you to rebook travel for an alternative date at no additional amendment fee.</li>
          <li>Issue a travel credit valid for 24 months where rebooking is not possible.</li>
          <li>Where a full refund is required and we have been able to recover costs from suppliers, we will pass this recovery through to you after deducting reasonable administration costs.</li>
        </ul>
        <p>We strongly recommend travel insurance that covers Force Majeure events, as this is the most effective protection in these circumstances.</p>

        <h2>Supplier-Specific Terms</h2>
        <p>Certain suppliers — particularly remote wilderness lodges and light aircraft charter operators — impose their own cancellation policies which may be more restrictive than our standard terms above. Where this is the case:</p>
        <ul>
          <li>Your Journey Specialist will advise you of any non-standard supplier terms at the time of booking.</li>
          <li>These will be documented in your booking confirmation.</li>
          <li>In the event of a cancellation, supplier-specific fees will be applied before our own administration fee.</li>
        </ul>
        <p>International flight components, where included in your itinerary, are subject to the relevant airline's own cancellation and change policies, which we will communicate to you at the time of booking.</p>

        <h2>Travel Insurance — Our Recommendation</h2>
        <p>We strongly recommend purchasing a comprehensive travel insurance policy at the time of booking that covers:</p>
        <ul>
          <li>Cancellation and curtailment (including pre-existing medical conditions if applicable)</li>
          <li>Medical evacuation — essential for remote wilderness locations</li>
          <li>Personal liability</li>
          <li>Baggage and personal effects</li>
          <li>Flight delay and missed connections</li>
        </ul>
        <p>We are happy to recommend reputable travel insurance providers on request. Travel insurance is entirely your responsibility and is not included in our pricing.</p>

        <h2>Amendments by The Safari Edition</h2>
        <p>In the unlikely event that we are required to make a material change to your confirmed itinerary, we will notify you as soon as reasonably possible and offer: (a) acceptance of the change; (b) an alternative itinerary of equivalent or higher standard; or (c) a full refund of all payments made. Minor changes (guide name, vehicle type, meal variation) do not constitute a material change and do not trigger this provision.</p>

        <h2>Questions</h2>
        <p>If you have any questions about this policy or wish to discuss your options before cancelling, please contact your Journey Specialist or email <a href="mailto:journeys@thesafariedition.com">journeys@thesafariedition.com</a>. We prefer to find a solution that works for you and will always explore alternatives before cancellation fees apply.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', letterSpacing: '0.08em' }}>
            The Safari Edition (Pty) Ltd · This policy forms part of our full <a href="/terms" style={{ color: 'rgba(200,169,110,0.4)' }}>Terms &amp; Conditions</a><br/>
            Contact: <a href="mailto:journeys@thesafariedition.com" style={{ color: 'rgba(200,169,110,0.5)' }}>journeys@thesafariedition.com</a>
          </p>
        </div>

      </div>
    </div>
  );
}
