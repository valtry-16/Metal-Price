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
            <h2>Overview</h2>
            <p>
              Auric Ledger respects your privacy. We are committed to protecting the personal
              information you share with us. This policy explains what data we collect, how we
              use it, and your rights regarding that data.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>Data We Collect</h2>
            <ul className="al-privacy__list">
              <li>
                <strong>Email Address</strong> — Optional, only if you subscribe to daily price
                update emails. Used solely for sending price notifications.
              </li>
              <li>
                <strong>Local Preferences</strong> — Your selected metal, carat, unit, theme, and
                alert configurations are stored locally in your browser using localStorage. This
                data never leaves your device.
              </li>
              <li>
                <strong>Authentication Data</strong> — If you sign in via Google OAuth or email/password
                through Supabase, your authentication credentials are managed securely by Supabase.
                We do not store passwords.
              </li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>Data We Do NOT Collect</h2>
            <ul className="al-privacy__list">
              <li>No tracking cookies or analytics scripts</li>
              <li>No third-party advertising trackers</li>
              <li>No device fingerprinting</li>
              <li>No location data</li>
              <li>No browsing history or cross-site tracking</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>How We Use Your Data</h2>
            <ul className="al-privacy__list">
              <li>Send daily metal price summary emails (if subscribed)</li>
              <li>Send price alert notifications (browser push and/or email)</li>
              <li>Authenticate your account for protected features (portfolio, settings)</li>
            </ul>
          </section>

          <section className="al-privacy__section">
            <h2>Data Retention &amp; Deletion</h2>
            <p>
              You can unsubscribe from email notifications at any time from the Market page alerts
              panel. To request complete data deletion, contact us and we will remove all associated
              data within 7 business days.
            </p>
          </section>

          <section className="al-privacy__section">
            <h2>Third-Party Services</h2>
            <ul className="al-privacy__list">
              <li><strong>Supabase</strong> — Authentication and database hosting</li>
              <li><strong>Vercel</strong> — Frontend hosting</li>
              <li><strong>Render</strong> — Backend API hosting</li>
              <li><strong>Resend</strong> — Email delivery service</li>
              <li><strong>apised.com</strong> — Precious metals price data source</li>
            </ul>
            <p>Each service has its own privacy policy. We do not share your data beyond what is necessary for these services to function.</p>
          </section>

          <section className="al-privacy__section">
            <h2>Contact</h2>
            <p>
              For privacy questions, concerns, or data deletion requests, email us at{" "}
              <a href="mailto:auricledger@gmail.com" className="al-privacy__link">auricledger@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="al-privacy__back">
          <Link to="/market" className="al-privacy__back-link">&larr; Back to Market</Link>
        </div>
      </div>
    </div>
  );
}
