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
          <img src="/metal-price-icon.svg" alt="" className="al-navbar__logo" />
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
            >
              Tools
              <svg className={`al-nav-chevron ${toolsOpen ? "open" : ""}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="2 4 6 8 10 4" /></svg>
            </button>
            {toolsOpen && (
              <div className="al-nav-dropdown__menu">
                <button type="button" className="al-nav-dropdown__item" onClick={() => { handleProtectedNav("/calculator"); setToolsOpen(false); }}>
                  <span className="al-nav-dropdown__icon">💎</span>
                  Jewellery Calculator
                </button>
                <Link to="/compare" className="al-nav-dropdown__item" onClick={() => setToolsOpen(false)}>
                  <span className="al-nav-dropdown__icon">⚖️</span>
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
              <button type="button" className="al-navbar__avatar-btn" onClick={() => setProfileOpen(!profileOpen)}>
                <div className="al-navbar__avatar">
                  {user?.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="" />
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
                    <span className="al-nav-dropdown__icon">📊</span>Dashboard
                  </Link>
                  <Link to="/settings" className="al-nav-dropdown__item" onClick={() => setProfileOpen(false)}>
                    <span className="al-nav-dropdown__icon">⚙️</span>Settings
                  </Link>
                  <button type="button" className="al-nav-dropdown__item al-nav-dropdown__item--danger" onClick={() => { signOut(); setProfileOpen(false); }}>
                    <span className="al-nav-dropdown__icon">🚪</span>Sign Out
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
          <button type="button" className="al-navbar__hamburger mobile-only" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
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
