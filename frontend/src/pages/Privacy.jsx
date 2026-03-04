import { Link } from "react-router-dom";
import "./Privacy.css";

export default function Privacy() {
  return (
    <div className="al-privacy">
      <div className="al-privacy__shell">
        <div className="al-privacy__hero">
          <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-privacy__logo" />
          <h1 className="al-privacy__title">Privacy Policy</h1>
          <p className="al-privacy__subtitle">Last updated: February 15, 2026</p>
        </div>

        <div className="al-privacy__content">
          <section className="al-privacy__section">
            <h2>1. Overview</h2>
            <p>
              Auric Ledger (&ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is committed to protecting and respecting your privacy.
              This Privacy Policy explains how we collect, use, store, and protect personal information
              when you use our precious metals intelligence platform at{" "}
              <a href="https://auric-ledger.vercel.app" className="al-privacy__link" target="_blank" rel="noopener noreferrer">
                auric-ledger.vercel.app
              </a>.
              By using our Service, you agree to the practices described in this policy.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>2. Information We Collect</h2>
            <p>We collect minimal data necessary to provide our services:</p>
            <ul className="al-privacy__list">
              <li>
                <strong>Email Address</strong> &mdash; Collected only if you subscribe to daily price update emails
                or register for an account. Used solely for sending price notifications, alerts, and account-related
                communications.
              </li>
              <li>
                <strong>Authentication Credentials</strong> &mdash; If you sign in via Google OAuth or email/password
                through Supabase, your credentials are managed securely by Supabase&apos;s authentication service.
                We never store plain-text passwords on our servers.
              </li>
              <li>
                <strong>Portfolio Data</strong> &mdash; If you use the Portfolio Simulator, your virtual holdings
                and trade history are stored in our Supabase database and linked to your authenticated account.
              </li>
              <li>
                <strong>Alert Configurations</strong> &mdash; Price alerts (threshold values, metal selections)
                are stored locally in your browser via localStorage and optionally synced if email alerts are enabled.
              </li>
              <li>
                <strong>Local Preferences</strong> &mdash; Your selected metal, carat, unit, theme (dark/light),
                and other UI preferences are stored exclusively in your browser&apos;s localStorage. This data
                never leaves your device.
              </li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>3. Information We Do NOT Collect</h2>
            <p>We are committed to minimal data collection. We explicitly do not collect:</p>
            <ul className="al-privacy__list">
              <li>No tracking cookies or analytics cookies</li>
              <li>No third-party advertising trackers or pixels</li>
              <li>No device fingerprinting or hardware identifiers</li>
              <li>No GPS or precise location data</li>
              <li>No browsing history or cross-site tracking</li>
              <li>No personal demographic data (age, gender, etc.)</li>
              <li>No payment or financial account information</li>
              <li>No social media profiles or contacts</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>4. How We Use Your Information</h2>
            <p>Information collected is used exclusively for the following purposes:</p>
            <ul className="al-privacy__list">
              <li><strong>Price Notifications:</strong> Sending daily metal price summary emails and triggered price alert emails to subscribed users</li>
              <li><strong>Authentication:</strong> Verifying your identity for access to protected features (portfolio, settings, calculator, dashboard)</li>
              <li><strong>Portfolio Management:</strong> Storing and retrieving your virtual portfolio holdings and trade history</li>
              <li><strong>Service Improvement:</strong> Aggregate, anonymous usage patterns may be used to improve platform performance and features</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>5. Data Storage &amp; Security</h2>
            <p>Your data is stored securely using industry-standard practices:</p>
            <ul className="al-privacy__list">
              <li><strong>Database:</strong> Supabase PostgreSQL with row-level security (RLS) policies</li>
              <li><strong>Authentication:</strong> Supabase Auth with bcrypt password hashing, JWT tokens, and OAuth 2.0</li>
              <li><strong>Transport:</strong> All data transmitted over HTTPS/TLS encryption</li>
              <li><strong>Access Control:</strong> API endpoints are protected with rate limiting, input validation, and authentication middleware</li>
              <li><strong>Local Storage:</strong> Preferences stored client-side never transit through our servers</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>6. Data Retention &amp; Deletion</h2>
            <p>We retain your data only as long as necessary to provide our services:</p>
            <ul className="al-privacy__list">
              <li><strong>Email Subscriptions:</strong> You can unsubscribe at any time from the Market page alerts panel. Your email will be removed from our mailing list immediately.</li>
              <li><strong>Account Data:</strong> You can request complete account deletion by contacting us. We will remove all associated data within 7 business days.</li>
              <li><strong>Portfolio Data:</strong> Deleted when you delete your account or upon written request.</li>
              <li><strong>Price History:</strong> Market price data is public information and retained indefinitely for historical analysis.</li>
              <li><strong>Local Data:</strong> Clear your browser&apos;s localStorage at any time to remove all local preferences.</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>7. Third-Party Services</h2>
            <p>We use the following third-party services to operate our platform:</p>
            <ul className="al-privacy__list">
              <li><strong>Supabase</strong> &mdash; Authentication, database hosting, and row-level security</li>
              <li><strong>Vercel</strong> &mdash; Frontend hosting and CDN delivery</li>
              <li><strong>Render</strong> &mdash; Backend API hosting</li>
              <li><strong>Resend</strong> &mdash; Transactional email delivery service</li>
              <li><strong>apised.com</strong> &mdash; Precious metals price data API source</li>
              <li><strong>NewsAPI</strong> &mdash; News article aggregation</li>
              <li><strong>Google</strong> &mdash; OAuth authentication provider</li>
            </ul>
            <p>
              Each third-party service operates under its own privacy policy. We do not sell, rent, or share
              your personal data with any third party beyond what is strictly necessary for these services to function.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>8. Cookies &amp; Tracking</h2>
            <p>
              Auric Ledger does <strong>not</strong> use cookies for tracking, advertising, or analytics purposes.
              Our authentication system uses secure HTTP-only session tokens managed by Supabase, which are
              essential for the service to function. No third-party cookies are set.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>9. Children&apos;s Privacy</h2>
            <p>
              Our Service is not intended for children under the age of 13. We do not knowingly collect
              personal information from children. If you believe a child has provided us with personal
              information, please contact us and we will promptly delete such information.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>10. Your Rights</h2>
            <p>Depending on your jurisdiction, you may have the following rights:</p>
            <ul className="al-privacy__list">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Rectification:</strong> Request correction of inaccurate personal data</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Portability:</strong> Request your data in a machine-readable format</li>
              <li><strong>Objection:</strong> Object to processing of your data for specific purposes</li>
              <li><strong>Withdrawal:</strong> Withdraw consent for email communications at any time</li>
            </ul>
            <p>
              To exercise any of these rights, contact us at the email address below. We will respond
              within 30 days of receiving your request.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>11. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time to reflect changes in our practices
              or for legal, regulatory, or operational reasons. We will notify users of significant changes
              by posting a notice on our platform. Continued use of the Service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>12. Contact Us</h2>
            <p>
              For privacy questions, concerns, data access requests, or data deletion requests, please contact us:
            </p>
            <div className="al-privacy__contact-card">
              <p><strong>Auric Ledger</strong></p>
              <p>
                Email:{" "}
                <a href="mailto:auricledger@gmail.com" className="al-privacy__link">auricledger@gmail.com</a>
              </p>
              <p>
                Website:{" "}
                <a href="https://auric-ledger.vercel.app" className="al-privacy__link" target="_blank" rel="noopener noreferrer">
                  auric-ledger.vercel.app
                </a>
              </p>
              <p className="al-privacy__response-note">We typically respond within 24&ndash;48 hours.</p>
            </div>
          </section>
        </div>

        <div className="al-privacy__back">
          <Link to="/market" className="al-privacy__back-link">&larr; Back to Market</Link>
        </div>
      </div>
    </div>
  );
}
