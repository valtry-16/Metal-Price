import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { PROD_API_URL } from "../utils/constants";
import { maskEmail } from "../utils/helpers";

export default function Settings() {
  const { user, signOut } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  const [emailSub, setEmailSub] = useState("");
  const [emailSubStatus, setEmailSubStatus] = useState("");
  const [emailSubLoading, setEmailSubLoading] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("auric-alert-email");
    if (savedEmail) setEmailSub(savedEmail);
    const alertPref = localStorage.getItem("auric-alerts-enabled");
    if (alertPref !== null) setAlertsEnabled(alertPref !== "false");
  }, []);

  const handleEmailSubscribe = async () => {
    if (!emailSub || !emailSub.includes("@")) {
      setEmailSubStatus("Please enter a valid email.");
      return;
    }
    setEmailSubLoading(true);
    setEmailSubStatus("");
    try {
      const res = await fetch(`${PROD_API_URL}/subscribe-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailSub }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("auric-alert-email", emailSub);
        setEmailSubStatus("✅ Subscribed successfully!");
      } else {
        setEmailSubStatus(data.error || "Subscription failed.");
      }
    } catch {
      setEmailSubStatus("Network error. Try again.");
    }
    setEmailSubLoading(false);
  };

  const handleAlertToggle = () => {
    const next = !alertsEnabled;
    setAlertsEnabled(next);
    localStorage.setItem("auric-alerts-enabled", String(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="al-page al-settings-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Settings</h1>
        <p className="al-page__subtitle">Manage your preferences</p>
      </div>

      <div className="al-settings__grid">
        {/* Account Info */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">👤 Account</h3>
          <div className="al-settings__info-row">
            <span className="al-settings__label">Email</span>
            <span className="al-settings__value">{user?.email || "—"}</span>
          </div>
          <div className="al-settings__info-row">
            <span className="al-settings__label">Provider</span>
            <span className="al-settings__value">
              {user?.app_metadata?.provider === "google" ? "Google" : "Email / Password"}
            </span>
          </div>
        </div>

        {/* Appearance */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">🎨 Appearance</h3>
          <div className="al-settings__toggle-row">
            <span>Dark Mode</span>
            <button
              type="button"
              className={`al-toggle ${darkMode ? "al-toggle--on" : ""}`}
              onClick={toggleDarkMode}
              aria-label="Toggle dark mode"
            >
              <span className="al-toggle__thumb" />
            </button>
          </div>
        </div>

        {/* Alerts */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">🔔 Alerts</h3>
          <div className="al-settings__toggle-row">
            <span>Enable price alerts</span>
            <button
              type="button"
              className={`al-toggle ${alertsEnabled ? "al-toggle--on" : ""}`}
              onClick={handleAlertToggle}
              aria-label="Toggle alerts"
            >
              <span className="al-toggle__thumb" />
            </button>
          </div>
          {saved && <span className="al-settings__saved">Saved ✓</span>}
        </div>

        {/* Email Subscription */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">📧 Email Updates</h3>
          <p className="al-settings__desc">Subscribe to daily market updates via email.</p>
          <div className="al-settings__email-row">
            <input
              type="email"
              className="al-input"
              value={emailSub}
              onChange={(e) => setEmailSub(e.target.value)}
              placeholder="you@example.com"
            />
            <button
              type="button"
              className="al-btn al-btn--primary al-btn--sm"
              onClick={handleEmailSubscribe}
              disabled={emailSubLoading}
            >
              {emailSubLoading ? "..." : "Subscribe"}
            </button>
          </div>
          {emailSubStatus && <p className="al-settings__email-status">{emailSubStatus}</p>}
        </div>

        {/* Sign Out */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">🚪 Session</h3>
          <p className="al-settings__desc">Sign out of your account on this device.</p>
          <button type="button" className="al-btn al-btn--danger al-btn--sm" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
