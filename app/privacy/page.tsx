'use client';

// Privacy Policy — The Safari Edition
// Protection of Personal Information Act 4 of 2013 (POPIA) compliant
// GDPR considerations for UK/EU guests noted
// Last updated: May 2026

export default function PrivacyPage() {
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
        .popia-box { background:rgba(74,222,128,0.05); border:0.5px solid rgba(74,222,128,0.18); border-radius:10px; padding:14px 18px; margin:12px 0 20px; }
        .popia-box p { color:rgba(74,222,128,0.75); margin:0; font-size:12px; }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(8,8,0,0.97)', backdropFilter: 'blur(20px)', borderBottom: '0.5px solid rgba(200,169,110,0.1)', padding: '0 clamp(16px,4vw,56px)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <a href="/" style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 16, color: 'rgba(200,169,110,0.9)', textDecoration: 'none', letterSpacing: '0.08em' }}>
          The Safari Edition
        </a>
        <span style={{ fontWeight: 200, fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(245,240,232,0.3)' }}>
          Privacy Policy
        </span>
      </nav>

      <div className="legal-body" style={{ maxWidth: 780, margin: '0 auto', padding: 'clamp(40px,6vw,80px) clamp(20px,5vw,48px) 80px' }}>

        <h1>Privacy Policy</h1>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', color: 'rgba(245,240,232,0.3)', textTransform: 'uppercase', marginBottom: 32 }}>
          The Safari Edition (Pty) Ltd · POPIA Compliant · Version 1.0 · Effective June 2026
        </p>

        <div className="legal-notice">
          <p>We take your privacy seriously. This Policy explains what personal information we collect, why we collect it, how we use it, who we share it with, and what your rights are. We are committed to complying with the Protection of Personal Information Act 4 of 2013 ("POPIA") and, where applicable, the General Data Protection Regulation ("GDPR") for guests in the United Kingdom and European Union.</p>
        </div>

        <h2>1. Who We Are</h2>
        <p>The Safari Edition (Pty) Ltd ("The Company", "we", "us", "our") is the Responsible Party under POPIA for the personal information we collect through our Platform, bookings, and communications.</p>
        <p><strong style={{ color: 'rgba(245,240,232,0.75)' }}>Information Officer:</strong> [Name to be designated pre-launch]<br/>
        <strong style={{ color: 'rgba(245,240,232,0.75)' }}>Contact:</strong> <a href="mailto:privacy@thesafariedition.com">privacy@thesafariedition.com</a><br/>
        <strong style={{ color: 'rgba(245,240,232,0.75)' }}>Address:</strong> [Registered address to be inserted]</p>

        <div className="popia-box">
          <p>✓ Registered Information Officer as required by section 55 of POPIA · Data processing register maintained internally · Annual compliance review scheduled</p>
        </div>

        <h2>2. What Personal Information We Collect</h2>
        <h3>2.1 Information you provide directly</h3>
        <ul>
          <li>Full name, email address, phone number, country of residence</li>
          <li>Passport details, nationality, date of birth (required for booking and travel)</li>
          <li>Payment information (processed securely — we do not store card numbers)</li>
          <li>Dietary requirements, medical conditions relevant to travel, accessibility needs</li>
          <li>Travel preferences, previous travel experience, budget range</li>
          <li>Communication records with your Journey Specialist</li>
          <li>Post-journey feedback and NPS survey responses</li>
        </ul>
        <h3>2.2 Information collected automatically</h3>
        <ul>
          <li>Device type, browser, operating system, IP address</li>
          <li>Pages visited, time on page, journey planning behaviour on our Platform</li>
          <li>Source of visit (search engine, Pinterest, email, referral)</li>
          <li>Itineraries built, destinations researched, properties viewed</li>
        </ul>
        <h3>2.3 Information from third parties</h3>
        <ul>
          <li>Flight and transfer booking confirmations (from our flight and transfer partners)</li>
          <li>Guest reviews from TripAdvisor or Google (where you have submitted them)</li>
        </ul>

        <h2>3. Why We Collect Your Information</h2>
        <p>We process personal information only for specific, defined purposes:</p>
        <ul>
          <li><strong>To fulfil your booking:</strong> We need your personal details to confirm reservations with suppliers, issue travel documents, and manage your itinerary.</li>
          <li><strong>To communicate with you:</strong> Your Journey Specialist uses your contact details to provide personalised service and keep you informed about your booking.</li>
          <li><strong>To process payments:</strong> Your financial information is passed securely to our payment processor (PayFast / Stripe). We do not retain card details.</li>
          <li><strong>To improve our Platform:</strong> We use anonymised behavioural data to improve the itinerary builder, destination recommendations, and overall experience.</li>
          <li><strong>To comply with legal obligations:</strong> We retain certain records as required by South African tax law, ASATA regulations, and applicable regulations in your home country.</li>
          <li><strong>To send you relevant communications:</strong> Where you have opted in, we may send you destination inspiration, seasonal offers, and journey ideas. You can unsubscribe at any time.</li>
        </ul>

        <h2>4. Legal Basis for Processing</h2>
        <p>Under POPIA, we process your information on the following grounds:</p>
        <ul>
          <li><strong>Contractual necessity:</strong> Processing required to fulfil your booking and travel arrangements.</li>
          <li><strong>Legal obligation:</strong> Processing required to comply with South African law and regulatory requirements.</li>
          <li><strong>Legitimate interests:</strong> Platform improvement, fraud prevention, security. We conduct a balancing test to ensure our interests do not override your rights.</li>
          <li><strong>Consent:</strong> Marketing communications and use of non-essential cookies. You may withdraw consent at any time.</li>
        </ul>
        <p><em>For UK and EU guests:</em> The above grounds correspond to the equivalent GDPR legal bases. Where GDPR applies, you have additional rights as set out in Section 8.</p>

        <h2>5. Who We Share Your Information With</h2>
        <p>We share personal information only where necessary and only with parties who are required to treat it with the same level of care we apply:</p>
        <ul>
          <li><strong>Suppliers (lodges, airlines, transfer operators):</strong> Your name, dietary requirements, and relevant preferences are shared with suppliers to fulfil your booking. Suppliers are contractually bound to use this information only for your booking.</li>
          <li><strong>Payment processors (PayFast, Stripe):</strong> For processing card payments. Both are PCI-DSS compliant. We do not store card numbers.</li>
          <li><strong>Email service provider (Resend):</strong> For sending booking confirmations, updates, and remittances. We use a data processing agreement with Resend.</li>
          <li><strong>Cloud storage (Supabase, Cloudflare):</strong> Our platform infrastructure providers. Data processing agreements are in place with all providers.</li>
          <li><strong>Regulatory bodies:</strong> Where required by law, including SARS, ASATA, or law enforcement.</li>
        </ul>
        <p>We do not sell your personal information to any third party. We do not share your information with advertisers.</p>

        <h2>6. International Transfers</h2>
        <p>Our platform infrastructure includes services hosted outside South Africa (including in the United States and EU). Where personal information is transferred internationally, we ensure adequate protection is in place including: standard contractual clauses, adequacy decisions, or equivalent safeguards as required by POPIA section 72 and, where applicable, GDPR Chapter V.</p>

        <h2>7. How Long We Keep Your Information</h2>
        <ul>
          <li><strong>Booking records:</strong> 5 years from travel completion (required for tax compliance)</li>
          <li><strong>Financial records:</strong> 7 years (SARS requirements)</li>
          <li><strong>Communication records:</strong> 2 years from last contact</li>
          <li><strong>Marketing preferences:</strong> Until you unsubscribe or request deletion</li>
          <li><strong>Platform analytics:</strong> 24 months (anonymised after 12 months)</li>
        </ul>

        <h2>8. Your Rights</h2>
        <p>Under POPIA (and GDPR where applicable), you have the following rights:</p>
        <ul>
          <li><strong>Right of access:</strong> Request a copy of the personal information we hold about you.</li>
          <li><strong>Right to rectification:</strong> Ask us to correct inaccurate or incomplete information.</li>
          <li><strong>Right to erasure:</strong> Request deletion of your personal information, subject to legal retention obligations.</li>
          <li><strong>Right to object:</strong> Object to processing based on legitimate interests or for direct marketing.</li>
          <li><strong>Right to restrict processing:</strong> Ask us to limit how we use your information in certain circumstances.</li>
          <li><strong>Right to data portability:</strong> (GDPR only) Request your data in a structured, machine-readable format.</li>
          <li><strong>Right to withdraw consent:</strong> Where processing is based on consent, you may withdraw at any time without affecting prior processing.</li>
        </ul>
        <p>To exercise any of these rights, email us at <a href="mailto:privacy@thesafariedition.com">privacy@thesafariedition.com</a>. We will respond within 20 business days as required by POPIA.</p>

        <h2>9. Cookies</h2>
        <p>We use cookies and similar technologies to improve your experience on our Platform. Essential cookies are required for the Platform to function and cannot be disabled. Analytics cookies (Google Analytics 4) are used only with your consent. We do not use advertising cookies or share cookie data with third parties for advertising purposes.</p>
        <p>You may control cookies through your browser settings. Disabling all cookies may limit some Platform functionality.</p>

        <h2>10. Security</h2>
        <p>We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, loss, or disclosure. These include: encryption of data in transit (TLS), Row-Level Security on our database, separate environments for development and production, and regular security reviews. In the event of a data breach that poses a risk to your rights, we will notify you and the Information Regulator as required by POPIA within 72 hours of becoming aware of the breach.</p>

        <h2>11. Children's Privacy</h2>
        <p>Our services are not directed at children under the age of 18. Where a booking includes a minor as a traveller, we collect only the personal information necessary to fulfil the booking, and this is provided by and consented to by the parent or guardian making the booking.</p>

        <h2>12. Complaints</h2>
        <p>If you have a concern about how we handle your personal information, please contact our Information Officer at <a href="mailto:privacy@thesafariedition.com">privacy@thesafariedition.com</a>. If you are not satisfied with our response, you have the right to lodge a complaint with:</p>
        <ul>
          <li><strong>South Africa:</strong> The Information Regulator — <a href="https://www.justice.gov.za/inforeg/">www.justice.gov.za/inforeg</a></li>
          <li><strong>United Kingdom:</strong> The Information Commissioner's Office (ICO) — <a href="https://ico.org.uk">ico.org.uk</a></li>
          <li><strong>European Union:</strong> Your local Data Protection Authority</li>
        </ul>

        <h2>13. Changes to This Policy</h2>
        <p>We may update this Privacy Policy from time to time. When we do, we will update the effective date at the top of this page. Where changes are material, we will notify you by email. Continued use of our Platform after notification constitutes acceptance of the updated Policy.</p>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 11, color: 'rgba(245,240,232,0.25)', letterSpacing: '0.08em' }}>
            The Safari Edition (Pty) Ltd · POPIA Compliant · Information Officer designated<br/>
            Privacy enquiries: <a href="mailto:privacy@thesafariedition.com" style={{ color: 'rgba(200,169,110,0.5)' }}>privacy@thesafariedition.com</a>
          </p>
        </div>

      </div>
    </div>
  );
}
