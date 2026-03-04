import { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { PROD_API_URL } from "../utils/constants";

const TELEGRAM_BOT_URL = "https://t.me/auric_ledger_bot";

export default function Settings() {
  const { user, signOut, getDisplayName, getAvatarUrl, updateProfile } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();

  const [displayName, setDisplayName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  const [emailSub, setEmailSub] = useState("");
  const [emailSubStatus, setEmailSubStatus] = useState("");
  const [emailSubLoading, setEmailSubLoading] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(getDisplayName());
    const savedEmail = localStorage.getItem("auric-alert-email");
    if (savedEmail) setEmailSub(savedEmail);
    const alertPref = localStorage.getItem("auric-alerts-enabled");
    if (alertPref !== null) setAlertsEnabled(alertPref !== "false");
  }, [user]);

  const avatarUrl = getAvatarUrl();

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setProfileMsg("Display name cannot be empty.");
      return;
    }
    setProfileSaving(true);
    setProfileMsg("");
    const { error } = await updateProfile({ display_name: displayName.trim() });
    setProfileSaving(false);
    if (error) {
      setProfileMsg(error.message || "Failed to update profile.");
    } else {
      setProfileMsg("Profile updated successfully.");
      setTimeout(() => setProfileMsg(""), 3000);
    }
  };

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
        setEmailSubStatus("Subscribed successfully!");
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

  const provider = user?.app_metadata?.provider === "google" ? "Google" : "Email / Password";

  return (
    <div className="al-page al-settings-page">
      <div className="al-page__header">
        <h1 className="al-page__title">Settings</h1>
        <p className="al-page__subtitle">Manage your account and preferences</p>
      </div>

      <div className="al-settings__grid">
        {/* Profile Card */}
        <div className="al-settings__card al-settings__card--profile">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Profile
          </h3>
          <div className="al-settings__profile-section">
            <div className="al-settings__avatar-wrapper">
              <div className="al-settings__avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} />
                ) : (
                  <span>{(displayName || "U")[0].toUpperCase()}</span>
                )}
              </div>
              <span className="al-settings__avatar-hint">
                {provider === "Google" ? "Avatar synced from Google" : "Default avatar from name"}
              </span>
            </div>
            <div className="al-settings__profile-fields">
              <div className="al-settings__field">
                <label htmlFor="settings-name" className="al-settings__label">Display Name</label>
                <input
                  id="settings-name"
                  type="text"
                  className="al-input"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="al-settings__field">
                <label htmlFor="settings-email" className="al-settings__label">Email</label>
                <input
                  id="settings-email"
                  type="email"
                  className="al-input"
                  value={user?.email || ""}
                  disabled
                />
              </div>
              <div className="al-settings__field">
                <label htmlFor="settings-provider" className="al-settings__label">Provider</label>
                <input
                  id="settings-provider"
                  type="text"
                  className="al-input"
                  value={provider}
                  disabled
                />
              </div>
              <button
                type="button"
                className="al-btn al-btn--primary al-btn--sm"
                onClick={handleSaveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving..." : "Save Changes"}
              </button>
              {profileMsg && <p className="al-settings__msg">{profileMsg}</p>}
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            Appearance
          </h3>
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
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Notifications
          </h3>
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
          {saved && <span className="al-settings__saved">Saved</span>}
        </div>

        {/* Email Subscription */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Email Updates
          </h3>
          <p className="al-settings__desc">Subscribe to daily market updates via email.</p>
          <div className="al-settings__email-row">
            <label htmlFor="settings-email-sub" className="sr-only">Email for updates</label>
            <input
              id="settings-email-sub"
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

        {/* Telegram Bot */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Telegram Bot
          </h3>
          <p className="al-settings__desc">
            Get instant metal price updates, daily summaries, and alerts directly on Telegram.
          </p>
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="al-btn al-btn--primary al-btn--sm al-settings__telegram-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Open Telegram Bot
          </a>
        </div>

        {/* Data & Privacy */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Data & Privacy
          </h3>
          <p className="al-settings__desc">
            Your data is stored securely in Supabase. Portfolio data is linked to an anonymous ID
            and is not shared with third parties. For deletion requests, email us at{" "}
            <a href="mailto:auricledger@gmail.com" className="al-settings__link">auricledger@gmail.com</a>.
          </p>
        </div>

        {/* Sign Out */}
        <div className="al-settings__card">
          <h3 className="al-settings__card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Session
          </h3>
          <p className="al-settings__desc">Sign out of your account on this device.</p>
          <button type="button" className="al-btn al-btn--danger al-btn--sm" onClick={signOut}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
