import { formatMetalLabel } from "../../utils/helpers";

/**
 * AlertsModal — Modal for managing price alerts, email subscription, and Telegram.
 * Extracted from the monolithic Market.jsx.
 */
export default function AlertsModal({
  show,
  onClose,
  metals,
  alerts,
  newAlert,
  setNewAlert,
  onAddAlert,
  onDeleteAlert,
  onToggleAlert,
  userEmail,
  savedEmailMask,
  rememberEmail,
  setRememberEmail,
  onSaveEmail,
  onRemoveEmail,
  emailLoading,
  notificationPermission,
  onRequestNotificationPermission,
}) {
  if (!show) return null;

  return (
    <div className="al-market-modal-overlay" onClick={onClose}>
      <div className="al-market-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="al-market-modal-header">
          <div className="al-market-modal-header-left">
            <img src="/metal-price-icon.svg" alt="Auric Ledger" className="al-market-modal-logo" />
            <h2 className="al-market-modal-title">Price Alerts</h2>
          </div>
          <button className="al-market-modal-close" aria-label="Close" onClick={onClose}>
            &#x2715;
          </button>
        </div>

        {/* Create New Alert */}
        <div className="al-market-modal-section">
          <h3>Create New Alert</h3>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            <div className="al-market-form-group">
              <label className="al-market-form-label" htmlFor="alert-metal">Select Metal</label>
              <select
                id="alert-metal"
                className="al-market-form-select"
                value={newAlert.metal}
                onChange={(e) => setNewAlert({ ...newAlert, metal: e.target.value })}
              >
                <option value="">Choose a metal...</option>
                {metals.filter(m => !["BTC", "ETH", "HG"].includes(m.metal_name)).map((metal) => (
                  <option key={metal.metal_name} value={metal.metal_name}>
                    {formatMetalLabel(metal)}
                  </option>
                ))}
              </select>
            </div>

            <div className="al-market-form-group">
              <label className="al-market-form-label" htmlFor="alert-type">Alert Type</label>
              <select
                id="alert-type"
                className="al-market-form-select"
                value={newAlert.type}
                onChange={(e) => setNewAlert({ ...newAlert, type: e.target.value })}
              >
                <option value="price_threshold">Price Threshold (₹/g)</option>
                <option value="percentage_change">Price Change (%)</option>
              </select>
            </div>

            {newAlert.type === "price_threshold" && (
              <div className="al-market-form-group">
                <label className="al-market-form-label" htmlFor="alert-direction">Alert When Price Goes</label>
                <select
                  id="alert-direction"
                  className="al-market-form-select"
                  value={newAlert.direction}
                  onChange={(e) => setNewAlert({ ...newAlert, direction: e.target.value })}
                >
                  <option value="below">Below this price</option>
                  <option value="above">Above this price</option>
                </select>
              </div>
            )}

            <div className="al-market-form-group">
              <label className="al-market-form-label" htmlFor="alert-value">
                {newAlert.type === "price_threshold" ? "Threshold Price in ₹/g" : "Percentage Change (%)"}
              </label>
              <input
                id="alert-value"
                type="number"
                className="al-market-form-input"
                placeholder={newAlert.type === "price_threshold" ? "e.g., 7500" : "e.g., 2.5"}
                value={newAlert.value}
                onChange={(e) => setNewAlert({ ...newAlert, value: e.target.value })}
              />
            </div>

            <button className="al-market-form-btn accent" onClick={onAddAlert}>Create Alert</button>

            {notificationPermission !== "granted" && (
              <button className="al-market-form-btn accent-2" onClick={onRequestNotificationPermission}>
                Enable Notifications
              </button>
            )}
          </div>
        </div>

        {/* Daily Email Notifications */}
        <div className="al-market-modal-section">
          <h3>Daily Email Notifications</h3>
          <p style={{ marginBottom: 10 }}>Get daily price updates for all metals at your email</p>
          {userEmail || savedEmailMask ? (
            <div className="al-market-email-status">
              <p>Emails enabled for: <strong>{userEmail || savedEmailMask}</strong></p>
              {!userEmail && savedEmailMask && (
                <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 0" }}>
                  Saved as masked email for privacy.
                </p>
              )}
              <button className="al-market-form-btn danger small" style={{ marginTop: 8 }} onClick={onRemoveEmail}>
                Remove Email
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              <input
                type="email"
                className="al-market-form-input"
                placeholder="your.email@example.com"
                id="alert-email-input"
              />
              <button
                className="al-market-form-btn accent-2"
                disabled={emailLoading}
                onClick={() => {
                  const email = document.getElementById("alert-email-input")?.value;
                  if (email) onSaveEmail(email);
                }}
              >
                {emailLoading ? "Subscribing..." : "Subscribe to Daily Emails"}
              </button>
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--muted)" }}>
                <input type="checkbox" checked={rememberEmail} onChange={(e) => setRememberEmail(e.target.checked)} />
                Remember my email on this device
              </label>
            </div>
          )}
        </div>

        {/* Telegram */}
        <div className="al-market-modal-section">
          <h3>Telegram Bot Notifications</h3>
          <div className="al-market-telegram-box">
            <p style={{ margin: "0 0 8px", fontSize: 14, color: "var(--panel-ink)" }}>
              Chat with our bot for prices, charts, and daily updates
            </p>
            <a href="https://t.me/AuricLedgerBot" target="_blank" rel="noopener noreferrer" className="al-market-telegram-btn">
              Open Telegram Bot
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--muted)" }}>
              Commands: /prices, /yesterday, /summary, /chart, /ask, /subscribe
            </p>
          </div>
        </div>

        {/* Your Alerts */}
        {alerts.length === 0 ? (
          <div className="al-market-modal-section" style={{ textAlign: "center", color: "var(--muted)" }}>
            <p>No alerts yet. Create one to get started!</p>
          </div>
        ) : (
          <div className="al-market-modal-section">
            <h3>Your Alerts ({alerts.length})</h3>
            <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
              {alerts.map((alert) => (
                <div key={alert.id} className={`al-market-alert-item ${alert.enabled ? "enabled" : ""}`}>
                  <div className="al-market-alert-item-meta">
                    <strong>{formatMetalLabel({ metal_name: alert.metal })}</strong>
                    <p>
                      {(alert.type === "price_threshold" || alert.type === "target_price")
                        ? `When price goes ${alert.direction === "above" ? "above" : "below"} ₹${alert.value.toFixed(2)}/g`
                        : `When price changes by ${alert.value.toFixed(2)}%`}
                    </p>
                  </div>
                  <div className="al-market-alert-actions">
                    <button
                      className={`al-market-form-btn small ${alert.enabled ? "accent" : ""}`}
                      onClick={() => onToggleAlert(alert.id)}
                      style={!alert.enabled ? { background: "var(--line)", color: "var(--muted)" } : {}}
                    >
                      {alert.enabled ? "On" : "Off"}
                    </button>
                    <button className="al-market-form-btn danger small" onClick={() => onDeleteAlert(alert.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How Alerts Work */}
        <div className="al-market-modal-section">
          <h3>How Alerts Work</h3>
          <p>
            <strong style={{ color: "var(--accent)" }}>Price Threshold:</strong> Set a price limit — get alerted when the metal price crosses below or above your threshold.<br />
            <strong style={{ color: "var(--accent)" }}>Price Change %:</strong> Get notified when a metal's daily price change exceeds your set percentage.<br />
            <strong style={{ color: "var(--accent)" }}>Delivery:</strong> Alerts sent via browser notification + email (if subscribed).<br />
            <strong style={{ color: "var(--accent)" }}>Cooldown:</strong> Each alert waits 60 minutes before triggering again.
          </p>
        </div>
      </div>
    </div>
  );
}
