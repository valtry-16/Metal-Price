import { Link } from "react-router-dom";
import { useState } from "react";
import "./Faq.css";

const FAQ_ITEMS = [
  {
    q: "What is Auric Ledger?",
    a: "Auric Ledger is a premium precious metals intelligence platform — a production-ready, full-stack AI-powered application for tracking real-time prices of 9+ precious metals and commodities with transparent INR conversion, import duty calculations, and GST applied. Built for Indian investors, jewellers, and enthusiasts."
  },
  {
    q: "How are metal prices calculated?",
    a: "We use a transparent, industry-standard formula: Final Price = (USD Spot Price ÷ 31.1035 g/oz) × USD→INR Rate × 1.06 (Import Duty) × 1.03 (GST). Gold prices are additionally adjusted by purity: 24K × 1.0, 22K × 0.916, 18K × 0.75, 14K × 0.583."
  },
  {
    q: "How often are prices updated?",
    a: "Metal prices are automatically fetched via a cron job every hour during market hours. The displayed timestamp on the Market page shows exactly when data was last refreshed. Live prices reflect the most recent data from apised.com."
  },
  {
    q: "Which metals are tracked on the platform?",
    a: "We track Gold (XAU), Silver (XAG), Platinum (XPT), Palladium (XPD), Copper (XCU), Nickel (NI), Zinc (ZNC), Aluminium (ALU), and Lead (LEAD) — all priced in Indian Rupees with per-gram, per-8g, and per-kg units."
  },
  {
    q: "What is the Portfolio Simulator?",
    a: "The Portfolio Simulator gives you a virtual ₹10,00,000 balance to practice metal trading without real money. You can buy and sell metals, track your holdings, view profit/loss, and analyze trade history — all based on real live prices."
  },
  {
    q: "How does the Jewellery Calculator work?",
    a: "Select a metal, choose the purity (for gold: 24K, 22K, 18K, or 14K), enter the weight in grams, set making charges (%), and GST (%). The calculator provides a detailed price breakdown using live metal rates, including metal value, making charges, GST, and final price."
  },
  {
    q: "Can I calculate prices for a past date?",
    a: "Yes! The advanced Jewellery Calculator supports historical date-based pricing. Select any date within our database range and the calculator will retrieve that day's metal rate for accurate historical jewellery price estimation."
  },
  {
    q: "How do price alerts work?",
    a: "You can set two types of alerts: Price Threshold (triggers when a metal crosses above or below a specific price) and Percentage Change (triggers when daily price movement exceeds a set percentage). Alerts can notify you via browser push notifications and optional email alerts."
  },
  {
    q: "Is my data secure?",
    a: "Yes. We don't use tracking cookies, advertising scripts, or device fingerprinting. Authentication is handled securely by Supabase (Google OAuth & Email/Password). Your preferences (selected metal, carat, unit, theme) are stored locally in your browser and never leave your device."
  },
  {
    q: "Can I export market data?",
    a: "Yes. You can download weekly price data as a CSV spreadsheet or as a professionally formatted PDF report that includes charts, statistics, and price tables. Both formats support sharing on supported devices."
  },
  {
    q: "What is the AI Market Summary?",
    a: "Every day, our AI analyzes price movements, trends, and market conditions to generate a concise summary. It includes observations on gold, silver, and other metals, along with key insights for investors. The AI chatbot can also answer specific questions about prices, trends, and comparisons."
  },
  {
    q: "Is Auric Ledger a PWA (Progressive Web App)?",
    a: "Yes! You can install Auric Ledger on your mobile device or desktop from the browser. It works offline for cached data and provides a native app-like experience with push notifications."
  },
  {
    q: "How does the Metal Comparison tool work?",
    a: "Select any two metals and compare their price trends side-by-side. The tool shows absolute prices, normalized percentage changes, correlation analysis, volatility metrics, SMA indicators, and visual bar/line charts — all for 7-day or 30-day periods."
  },
  {
    q: "Do you have a Telegram Bot?",
    a: "Yes! Our Telegram bot provides instant metal price queries, daily updates, and alert notifications directly in Telegram. Search for our bot or check the About section for the link."
  },
  {
    q: "Who built Auric Ledger?",
    a: "Auric Ledger was built by Sabithulla as a full-stack production application. The tech stack includes React 19, Vite, Node.js/Express, Supabase (PostgreSQL + Auth), Chart.js, ApexCharts, and jsPDF. Frontend deployed on Vercel, backend on Render."
  },
  {
    q: "How can I contact support?",
    a: "For questions, feedback, bug reports, or feature requests, email us at auricledger@gmail.com. We typically respond within 24–48 hours."
  }
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState(null);

  return (
    <div className="al-faq">
      <div className="al-faq__shell">
        <div className="al-faq__hero">
          <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-faq__logo" />
          <h1 className="al-faq__title">About &amp; FAQ</h1>
          <p className="al-faq__subtitle">
            Everything you need to know about Auric Ledger — India's premium precious metals intelligence platform
          </p>
        </div>

        {/* About Overview */}
        <section className="al-faq__about-card">
          <h2 className="al-faq__about-heading">About Auric Ledger</h2>
          <p>
            Auric Ledger is a comprehensive precious metals pricing and analytics platform designed for the Indian market.
            We provide real-time prices for 9+ metals with transparent INR conversion, import duty, and GST calculations.
            Our platform includes an AI-powered market summary, a smart chatbot, portfolio simulation, jewellery calculator,
            metal comparison tools, CSV/PDF exports, price alerts, daily email updates, and a Telegram bot — all wrapped
            in a luxury fintech design.
          </p>
          <div className="al-faq__stats-row">
            <div className="al-faq__stat">
              <span className="al-faq__stat-num">9+</span>
              <span className="al-faq__stat-label">Metals Tracked</span>
            </div>
            <div className="al-faq__stat">
              <span className="al-faq__stat-num">22K</span>
              <span className="al-faq__stat-label">Default Gold Purity</span>
            </div>
            <div className="al-faq__stat">
              <span className="al-faq__stat-num">1hr</span>
              <span className="al-faq__stat-label">Price Refresh</span>
            </div>
            <div className="al-faq__stat">
              <span className="al-faq__stat-num">AI</span>
              <span className="al-faq__stat-label">Powered Insights</span>
            </div>
          </div>
        </section>

        {/* Key Features Grid */}
        <section className="al-faq__features-section">
          <h2 className="al-faq__section-heading">Key Features</h2>
          <div className="al-faq__features-grid">
            {[
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, title: "Real-Time Pricing", desc: "Live precious metal prices updated hourly from MCX feeds with INR conversion" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>, title: "AI Market Summary", desc: "Daily AI-generated analysis of market trends, movements, and investment insights" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, title: "AI Chatbot", desc: "Ask questions about prices, trends, comparisons, and get instant intelligent responses" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, title: "Smart Alerts", desc: "Price threshold and percentage change alerts via browser push and email notifications" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>, title: "Portfolio Simulator", desc: "Virtual trading balance to practice metal investments with real live prices" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, title: "Jewellery Calculator", desc: "Calculate jewellery prices with purity, making charges, GST, and historical dates" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, title: "Metal Comparison", desc: "Side-by-side analysis with correlation, volatility, SMA, and trend charts" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, title: "PDF & CSV Export", desc: "Download professional market reports with charts, stats, and share functionality" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>, title: "Daily Emails", desc: "Automated daily price emails with detailed market summary and trends" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>, title: "PWA Support", desc: "Install as a native app on mobile or desktop with offline support" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>, title: "Dark / Light Mode", desc: "Elegant luxury theme with smooth dark/light mode toggle for comfort" },
              { icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>, title: "Telegram Bot", desc: "Get instant metal prices and alerts directly in your Telegram app" },
            ].map((f) => (
              <div key={f.title} className="al-faq__feature-item">
                <span className="al-faq__feature-icon">{f.icon}</span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Formula */}
        <section className="al-faq__formula-card">
          <h2 className="al-faq__section-heading">Pricing Formula</h2>
          <div className="al-faq__formula">
            Final Price = (USD Spot Price &divide; 31.1035 g/oz) &times; USD&rarr;INR Rate &times; 1.06 (Import Duty) &times; 1.03 (GST)
          </div>
          <div className="al-faq__formula-notes">
            <p><strong>Gold Purity Multipliers:</strong></p>
            <div className="al-faq__purity-grid">
              <span>24K &times; 1.000</span>
              <span>22K &times; 0.916</span>
              <span>18K &times; 0.750</span>
              <span>14K &times; 0.583</span>
            </div>
            <p className="al-faq__formula-note">
              USD&rarr;INR exchange rate is fetched live. Import duty (6%) and GST (3%) reflect current Indian government rates.
              Actual retail prices may vary due to local premiums, design, and brand markups.
            </p>
          </div>
        </section>

        {/* FAQ Accordion */}
        <section className="al-faq__accordion-section">
          <h2 className="al-faq__section-heading">Frequently Asked Questions</h2>
          <div className="al-faq__accordion">
            {FAQ_ITEMS.map((item, idx) => (
              <div key={idx} className={`al-faq__accordion-item ${openIdx === idx ? "open" : ""}`}>
                <button
                  className="al-faq__accordion-trigger"
                  onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                  aria-expanded={openIdx === idx}
                >
                  <span className="al-faq__accordion-q">{item.q}</span>
                  <svg
                    className="al-faq__accordion-chevron"
                    width="20" height="20" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <div className="al-faq__accordion-body">
                  <p>{item.a}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Developer & Version */}
        <section className="al-faq__footer-card">
          <div className="al-faq__footer-info">
            <p><strong>Version:</strong> 1.1.0</p>
            <p><strong>Developer:</strong> Sabithulla</p>
            <p><strong>Released:</strong> February 15, 2026</p>
            <p>
              <strong>Contact:</strong>{" "}
              <a href="mailto:auricledger@gmail.com" className="al-faq__link">auricledger@gmail.com</a>
            </p>
          </div>
        </section>

        <div className="al-faq__back">
          <Link to="/market" className="al-faq__back-link">&larr; Back to Market</Link>
        </div>
      </div>
    </div>
  );
}
