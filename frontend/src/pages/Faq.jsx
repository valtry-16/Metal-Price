import { Link } from "react-router-dom";
import "./Faq.css";

export default function Faq() {
  return (
    <div className="al-faq">
      <div className="al-faq__shell">
        <div className="al-faq__hero">
          <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-faq__logo" />
          <h1 className="al-faq__title">About Auric Ledger</h1>
          <p className="al-faq__subtitle">Everything you need to know about our platform</p>
        </div>

        <div className="al-faq__grid">
          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#9830;</div>
            <h2>What is Auric Ledger?</h2>
            <p>
              Auric Ledger is a premium precious metals price tracker — a production-ready,
              full-stack AI-powered application for tracking real-time prices of 9 precious metals
              and commodities with transparent INR conversion, import duty calculations, and GST applied.
            </p>
          </section>

          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#9733;</div>
            <h2>Key Features</h2>
            <ul className="al-faq__list">
              <li>Real-Time Pricing with daily auto-fetch</li>
              <li>AI-Powered Daily Market Summary</li>
              <li>AI Chatbot for metal price queries</li>
              <li>Smart Price Alerts (browser + email)</li>
              <li>Progressive Web App (installable)</li>
              <li>Telegram Bot integration</li>
              <li>Portfolio tracking and analytics</li>
              <li>CSV &amp; PDF export</li>
              <li>Daily email updates</li>
              <li>Dark / Light mode</li>
              <li>Automated cron-based data refresh</li>
            </ul>
          </section>

          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#8377;</div>
            <h2>How Are Prices Calculated?</h2>
            <p>Our pricing formula ensures transparency:</p>
            <div className="al-faq__formula">
              Final Price = (USD Price / 31.1035g) &times; USD&rarr;INR Rate &times; 1.06 (Duty) &times; 1.03 (GST)
            </div>
            <p>
              <strong>Gold purity multipliers:</strong> 18K &times; 0.75 &nbsp;|&nbsp; 22K &times; 0.916 &nbsp;|&nbsp; 24K &times; 1.0
            </p>
          </section>

          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#128202;</div>
            <h2>Which Metals Are Tracked?</h2>
            <p>
              Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD), Rhodium (XRH),
              Iridium (XRI), Ruthenium (XRU), Osmium (XOS), and Rhenium (XRE) —
              all priced in Indian Rupees.
            </p>
          </section>

          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#128276;</div>
            <h2>How Do Alerts Work?</h2>
            <p>
              Set price threshold or percentage-change alerts for any metal. When triggered,
              you'll receive browser push notifications and optional email alerts.
              Alerts are checked every time fresh price data is loaded.
            </p>
          </section>

          <section className="al-faq__card">
            <div className="al-faq__card-icon">&#128187;</div>
            <h2>Developer</h2>
            <p>
              Built by <strong>Sabithulla</strong>. Version 1.1.0 — Released February 15, 2026.
            </p>
            <p>
              Questions? Reach out at{" "}
              <a href="mailto:auricledger@gmail.com" className="al-faq__link">auricledger@gmail.com</a>
            </p>
          </section>
        </div>

        <div className="al-faq__back">
          <Link to="/market" className="al-faq__back-link">&larr; Back to Market</Link>
        </div>
      </div>
    </div>
  );
}
