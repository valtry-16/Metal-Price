import { Link } from "react-router-dom";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="al-footer">
      <div className="al-footer__inner">
        <div className="al-footer__brand">
          <div className="al-footer__logo-row">
            <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-footer__logo" />
            <span className="al-footer__title">Auric Ledger</span>
          </div>
          <p className="al-footer__desc">
            Real-time precious metals and commodity pricing for the Indian market.
            Track Gold, Silver, Platinum, Palladium, and more.
          </p>
        </div>

        <div className="al-footer__divider" />

        <div className="al-footer__grid">
          <div className="al-footer__col">
            <h4 className="al-footer__col-title">Platform</h4>
            <Link to="/market" className="al-footer__link">Live Market</Link>
            <Link to="/portfolio" className="al-footer__link">Portfolio</Link>
            <Link to="/calculator" className="al-footer__link">Calculator</Link>
            <Link to="/compare" className="al-footer__link">Comparison</Link>
          </div>
          <div className="al-footer__col">
            <h4 className="al-footer__col-title">Resources</h4>
            <Link to="/news" className="al-footer__link">Market News</Link>
            <Link to="/faq" className="al-footer__link">About &amp; FAQ</Link>
            <Link to="/" className="al-footer__link">Home</Link>
          </div>
          <div className="al-footer__col">
            <h4 className="al-footer__col-title">Legal</h4>
            <Link to="/privacy" className="al-footer__link">Privacy Policy</Link>
            <a className="al-footer__link" href="mailto:auricledger@gmail.com">auricledger@gmail.com</a>
            <span className="al-footer__note">For privacy questions or deletion requests</span>
          </div>
        </div>

        <div className="al-footer__divider" />

        <div className="al-footer__bottom">
          <span>© {currentYear} Auric Ledger. All rights reserved.</span>
          <span className="al-footer__credit">Developed by Sabithulla</span>
        </div>
      </div>
    </footer>
  );
}
