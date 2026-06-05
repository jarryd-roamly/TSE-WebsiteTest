'use client';

// Terms & Conditions — The Safari Edition
// South African law · Consumer Protection Act 68 of 2008 · ASATA Code of Conduct
// Last updated: May 2026

export default function TermsPage() {
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
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,0,0.97)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(200,169,110,0.1)', padding: '0 clamp(16px,4vw,56px)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 16, color: 'rgba(200,169,110,0.9)', textDecoration: 'none', letterSpacing: '0.08em' }}>
          The Safari Edition
        </a>
        <span style={{ fontWeight: 200, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)' }}>
          Terms &amp; Conditions
        </span>
      </nav>

      <div className="legal-body" style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,48px) 80px' }}>

        <h1>Terms &amp; Conditions</h1>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', marginBottom: 32 }}>
          The Safari Edition (Pty) Ltd · Version 1.0 · Effective June 2026
        </p>

        <div className="legal-notice">
          <p><strong style={{ color: 'rgba(200,169,110,0.9)' }}>Important:</strong> Please read these Terms carefully before making a booking. By confirming a booking with The Safari Edition, you agree to be bound by these Terms. If you do not agree, please do not proceed with a booking.</p>
        </div>

        <h2>1. About Us</h2>
        <p>The Safari Edition is a trading name of The Safari Edition (Pty) Ltd, a company incorporated in the Republic of South Africa ("The Company", "we", "us", "our"). We are an ASATA (Association of Southern African Travel Agents) member and SATSA (Southern Africa Tourism Services Association) registered operator.</p>
        <p>We act as a <strong style={{ color: 'rgba(245,240,232,0.75)' }}>Merchant of Record</strong> on all bookings, meaning we contract directly with you (the traveller) and manage all payments, remittances to suppliers, and financial obligations on your behalf.</p>
        <p><strong style={{ color: 'rgba(245,240,232,0.75)' }}>Registered address:</strong> [To be updated on registration] · South Africa<br/>
        <strong style={{ color: 'rgba(245,240,232,0.75)' }}>Contact:</strong> <a href="mailto:journeys@thesafariedition.com">journeys@thesafariedition.com</a><br/>
        <strong style={{ color: 'rgba(245,240,232,0.75)' }}>ASATA membership:</strong> [Number to be inserted]</p>

        <h2>2. Definitions</h2>
        <ul>
          <li><strong>"Booking"</strong> means a confirmed travel itinerary accepted and paid for by you.</li>
          <li><strong>"Traveller" / "Guest"</strong> means any person included in a confirmed Booking.</li>
          <li><strong>"Supplier"</strong> means any lodge, airline, transfer operator, activity provider or other third-party service provider included in your itinerary.</li>
          <li><strong>"Journey Specialist"</strong> means the dedicated Travel Catalogue representative assigned to your booking.</li>
          <li><strong>"Itinerary"</strong> means the personalised travel plan generated through our platform and confirmed upon payment of the deposit.</li>
          <li><strong>"Platform"</strong> means The Safari Edition website, app, and associated booking systems.</li>
        </ul>

        <h2>3. Booking Process &amp; Confirmation</h2>
        <h3>3.1 How a booking is made</h3>
        <p>A binding contract between you and The Safari Edition is formed when: (a) you accept your itinerary on the Platform; (b) you pay the required deposit; and (c) we issue written confirmation via email. All bookings are subject to availability confirmation by your Journey Specialist within 2 hours of deposit payment.</p>
        <h3>3.2 Accuracy of information</h3>
        <p>You are responsible for ensuring that all traveller names, passport details, dietary requirements, medical conditions relevant to travel, and other information provided to us are accurate and complete. We cannot accept liability for any loss or additional cost arising from inaccurate information provided by you.</p>
        <h3>3.3 AI-generated itineraries</h3>
        <p>Our Platform uses artificial intelligence to generate itinerary suggestions. All AI-generated inclusions, pricing, and availability are reviewed and confirmed by a Journey Specialist before constituting a binding offer. Any statement tagged as "AI-inferred" in our system will not form part of your confirmed booking until reviewed by a Journey Specialist. We do not accept liability for any reliance placed on AI-generated suggestions prior to Journey Specialist confirmation.</p>

        <h2>4. Pricing &amp; Payments</h2>
        <h3>4.1 Pricing</h3>
        <p>All prices are displayed in your selected currency. Prices are inclusive of our service fee and applicable taxes unless otherwise stated. International flights, where not included in the itinerary, are excluded from the quoted price. Prices are subject to change until deposit is received.</p>
        <h3>4.2 Payment schedule</h3>
        <ul>
          <li><strong>Deposit:</strong> 30% of the total itinerary value (100% of international flight component if included) is due upon booking confirmation.</li>
          <li><strong>Balance:</strong> The remaining 70% is due 30 days before your travel start date.</li>
          <li><strong>Late payment:</strong> If the balance is not received by the due date, we reserve the right to treat the booking as cancelled and apply the applicable cancellation fees.</li>
        </ul>
        <h3>4.3 Payment methods</h3>
        <p>We accept payment via credit card, debit card, and EFT (South African clients). International clients may pay by card (USD, GBP, EUR). All card payments are processed securely. We do not store card details. For international clients using USD or GBP, the exchange rate applied will be the rate on the date of payment using our designated FX provider.</p>
        <h3>4.4 Price adjustments</h3>
        <p>We reserve the right to adjust confirmed booking prices in exceptional circumstances including: currency fluctuations exceeding 10% against the ZAR; supplier surcharges imposed after booking confirmation; government-imposed taxes or levies. We will provide a minimum of 7 days notice of any adjustment. You may cancel without penalty within 7 days of being notified of an increase exceeding 10% of the original booking value.</p>

        <h2>5. Cancellations &amp; Refunds</h2>
        <p>Please refer to our <a href="/cancellation">Cancellation Policy</a> for full details of cancellation fees and refund timelines. We strongly recommend purchasing comprehensive travel insurance at the time of booking.</p>

        <h2>6. Changes to Bookings</h2>
        <p>Amendment requests must be submitted in writing to your Journey Specialist. Amendments are subject to supplier availability and may attract additional charges. We will confirm whether an amendment is possible within 2 business days. Minor amendments (spelling corrections, dietary updates) are made at no charge. Significant amendments (destination changes, date changes, accommodation changes) may attract a re-booking fee of R1,500 per amendment.</p>

        <h2>7. Our Responsibilities</h2>
        <p>We accept responsibility for ensuring that the travel arrangements we have agreed to provide are supplied as described and that all components reach a reasonable standard. We will not be responsible for any failure to provide, or failure in, travel arrangements where this is caused by: (a) your own acts or omissions; (b) unforeseeable or unavoidable acts or omissions of a third party unconnected with our services; (c) unusual or unforeseeable circumstances beyond our control; or (d) an event that neither we nor our suppliers could have foreseen or avoided.</p>
        <h3>7.1 Limitation of liability</h3>
        <p>Our maximum liability to you for any confirmed booking is limited to the total price paid for that booking. We do not accept liability for indirect, consequential, or special damages including loss of enjoyment or opportunity.</p>

        <h2>8. Your Responsibilities</h2>
        <ul>
          <li>Ensure you hold a valid passport (minimum 6 months validity beyond return date) and all required visas.</li>
          <li>Obtain travel insurance prior to travel — strongly recommended and your sole responsibility.</li>
          <li>Arrive at airports and airstrips with sufficient time before departure.</li>
          <li>Comply with all applicable laws and regulations of countries visited.</li>
          <li>Respect lodge rules including weight restrictions on light aircraft (maximum 20kg soft bag).</li>
          <li>Disclose relevant medical conditions that may affect participation in activities.</li>
        </ul>

        <h2>9. Special Requirements</h2>
        <p>Please advise your Journey Specialist of any special requirements at the time of booking including dietary requirements, mobility issues, medical equipment, or specific room preferences. We will use reasonable efforts to accommodate these but cannot guarantee all requests.</p>

        <h2>10. Travel Insurance</h2>
        <p>We strongly recommend that all travellers purchase comprehensive travel insurance including cancellation cover, medical evacuation, and personal liability. Travel insurance is not included in our pricing and is your sole responsibility. We cannot be held liable for any costs arising from inadequate or absent insurance cover.</p>

        <h2>11. Consumer Protection Act</h2>
        <p>These Terms are subject to the Consumer Protection Act 68 of 2008 ("CPA") of South Africa. Nothing in these Terms limits or excludes any rights you have under the CPA that cannot be lawfully limited or excluded. In the event of any conflict between these Terms and the CPA, the CPA will prevail to the extent of such conflict.</p>

        <h2>12. Data Protection</h2>
        <p>Your personal information is processed in accordance with our <a href="/privacy">Privacy Policy</a> and the Protection of Personal Information Act 4 of 2013 ("POPIA").</p>

        <h2>13. Complaints</h2>
        <p>Any complaint must be notified to your Journey Specialist as soon as reasonably practicable. If we are unable to resolve your complaint, you may contact ASATA's consumer complaints department at <a href="https://www.asata.co.za">www.asata.co.za</a>. We will acknowledge all written complaints within 3 business days and aim to resolve within 14 business days.</p>

        <h2>14. Governing Law &amp; Jurisdiction</h2>
        <p>These Terms are governed by and construed in accordance with the laws of the Republic of South Africa. You consent to the jurisdiction of the South Gauteng High Court for any dispute arising from these Terms, without prejudice to our right to enforce in any other jurisdiction.</p>

        <h2>15. Changes to These Terms</h2>
        <p>We reserve the right to update these Terms at any time. Changes will be published on this page with a revised effective date. Continued use of the Platform after changes are published constitutes acceptance of the revised Terms.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', letterSpacing: '0.08em' }}>
            The Safari Edition (Pty) Ltd · ASATA Member · SATSA Member · POPIA Compliant<br/>
            For enquiries: <a href="mailto:journeys@thesafariedition.com" style={{ color: 'rgba(200,169,110,0.5)' }}>journeys@thesafariedition.com</a>
          </p>
        </div>

      </div>
    </div>
  );
}
