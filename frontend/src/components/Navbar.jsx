import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";

export default function Navbar({ onOpenAuth }) {
  const { darkMode, toggleDarkMode } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const toolsRef = useRef(null);
  const profileRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) setToolsOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setToolsOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const handleProtectedNav = (path) => {
    if (!isAuthenticated) {
      onOpenAuth?.();
    } else {
      navigate(path);
    }
    setMobileOpen(false);
  };

  return (
    <nav className="al-navbar">
      <div className="al-navbar__inner">
        {/* Logo */}
        <Link to="/" className="al-navbar__brand">
          <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-navbar__logo" />
          <span className="al-navbar__title">Auric Ledger</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="al-navbar__links desktop-only">
          <Link to="/" className={`al-nav-link ${isActive("/") ? "active" : ""}`}>Home</Link>
          <Link to="/market" className={`al-nav-link ${isActive("/market") ? "active" : ""}`}>Market</Link>
          <button type="button" className={`al-nav-link ${isActive("/portfolio") ? "active" : ""}`} onClick={() => handleProtectedNav("/portfolio")}>Portfolio</button>

          {/* Tools Dropdown */}
          <div className="al-nav-dropdown" ref={toolsRef}>
            <button
              type="button"
              className={`al-nav-link ${["/calculator", "/compare"].includes(location.pathname) ? "active" : ""}`}
              onClick={() => setToolsOpen(!toolsOpen)}
              aria-expanded={toolsOpen}
            >
              Tools
              <svg className={`al-nav-chevron ${toolsOpen ? "open" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2 4 6 8 10 4" /></svg>
            </button>
            {toolsOpen && (
              <div className="al-nav-dropdown__menu">
                <button type="button" className="al-nav-dropdown__item" onClick={() => { handleProtectedNav("/calculator"); setToolsOpen(false); }}>
                  <svg className="al-nav-dropdown__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Jewellery Calculator
                </button>
                <Link to="/compare" className="al-nav-dropdown__item" onClick={() => setToolsOpen(false)}>
                  <svg className="al-nav-dropdown__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Metal Comparison
                </Link>
              </div>
            )}
          </div>

          <Link to="/news" className={`al-nav-link ${isActive("/news") ? "active" : ""}`}>News</Link>
        </div>

        {/* Right Actions */}
        <div className="al-navbar__actions">
          <button type="button" className="al-navbar__theme-btn" onClick={toggleDarkMode} aria-label="Toggle theme">
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            )}
          </button>

          {isAuthenticated ? (
            <div className="al-nav-dropdown" ref={profileRef}>
              <button type="button" className="al-navbar__avatar-btn" onClick={() => setProfileOpen(!profileOpen)} aria-expanded={profileOpen}>
                <div className="al-navbar__avatar">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="User avatar" />
                  ) : (
                    <span>{(user?.email?.[0] || "U").toUpperCase()}</span>
                  )}
                </div>
              </button>
              {profileOpen && (
                <div className="al-nav-dropdown__menu al-nav-dropdown__menu--right">
                  <div className="al-nav-dropdown__header">
                    <span className="al-nav-dropdown__email">{user?.email}</span>
                  </div>
                  <Link to="/dashboard" className="al-nav-dropdown__item" onClick={() => setProfileOpen(false)}>
                    <svg className="al-nav-dropdown__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                    Dashboard
                  </Link>
                  <Link to="/settings" className="al-nav-dropdown__item" onClick={() => setProfileOpen(false)}>
                    <svg className="al-nav-dropdown__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    Settings
                  </Link>
                  <button type="button" className="al-nav-dropdown__item al-nav-dropdown__item--danger" onClick={() => { signOut(); setProfileOpen(false); }}>
                    <svg className="al-nav-dropdown__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="al-navbar__login-btn" onClick={() => onOpenAuth?.()}>
              Sign In
            </button>
          )}

          {/* Mobile hamburger */}
          <button type="button" className="al-navbar__hamburger mobile-only" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu" aria-expanded={mobileOpen}>
            <span className={`al-hamburger-line ${mobileOpen ? "open" : ""}`} />
            <span className={`al-hamburger-line ${mobileOpen ? "open" : ""}`} />
            <span className={`al-hamburger-line ${mobileOpen ? "open" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="al-navbar__mobile">
          <Link to="/" className="al-mobile-link" onClick={() => setMobileOpen(false)}>Home</Link>
          <Link to="/market" className="al-mobile-link" onClick={() => setMobileOpen(false)}>Market</Link>
          <button type="button" className="al-mobile-link" onClick={() => handleProtectedNav("/portfolio")}>Portfolio</button>
          <button type="button" className="al-mobile-link" onClick={() => handleProtectedNav("/calculator")}>Calculator</button>
          <Link to="/compare" className="al-mobile-link" onClick={() => setMobileOpen(false)}>Comparison</Link>
          <Link to="/news" className="al-mobile-link" onClick={() => setMobileOpen(false)}>News</Link>
          {isAuthenticated && (
            <>
              <div className="al-mobile-divider" />
              <Link to="/dashboard" className="al-mobile-link" onClick={() => setMobileOpen(false)}>Dashboard</Link>
              <Link to="/settings" className="al-mobile-link" onClick={() => setMobileOpen(false)}>Settings</Link>
              <button type="button" className="al-mobile-link al-mobile-link--danger" onClick={() => { signOut(); setMobileOpen(false); }}>Sign Out</button>
            </>
          )}
          {!isAuthenticated && (
            <>
              <div className="al-mobile-divider" />
              <button type="button" className="al-mobile-link al-mobile-link--accent" onClick={() => { onOpenAuth?.(); setMobileOpen(false); }}>Sign In</button>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
