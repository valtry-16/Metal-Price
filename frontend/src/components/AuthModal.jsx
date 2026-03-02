import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function AuthModal({ onClose }) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (mode === "signup" && !username.trim()) {
      setError("Please enter a display name.");
      return;
    }
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    let result;
    if (mode === "signup") {
      result = await signUpWithEmail(email, password, username.trim());
    } else {
      result = await signInWithEmail(email, password);
    }

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
    } else if (mode === "signup") {
      // When email confirmation is disabled, Supabase returns a session directly
      if (result.data?.session) {
        onClose();
      } else {
        setSuccess("Account created! You can now sign in.");
        setMode("login");
      }
    } else {
      onClose();
    }
  };

  const handleGoogle = async () => {
    setError("");
    const { error: authError } = await signInWithGoogle();
    if (authError) setError(authError.message);
  };

  return (
    <div className="al-modal-overlay" onClick={onClose}>
      <div className="al-auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="al-modal-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div className="al-auth-modal__header">
          <img src="/metal-price-icon.svg" alt="" className="al-auth-modal__logo" />
          <h2 className="al-auth-modal__title">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="al-auth-modal__subtitle">
            {mode === "login"
              ? "Sign in to access your portfolio, alerts, and more."
              : "Join Auric Ledger and start tracking your metals."}
          </p>
        </div>

        {/* Google Button */}
        <button type="button" className="al-auth-google-btn" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="al-auth-divider">
          <span>or</span>
        </div>

        {/* Email Form */}
        <form className="al-auth-form" onSubmit={handleEmailAuth}>
          {mode === "signup" && (
            <div className="al-auth-field">
              <label>Display Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          )}
          <div className="al-auth-field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="al-auth-field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </div>

          {error && <div className="al-auth-error">{error}</div>}
          {success && <div className="al-auth-success">{success}</div>}

          <button type="submit" className="al-auth-submit-btn" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <div className="al-auth-switch">
          {mode === "login" ? (
            <span>Don't have an account? <button type="button" onClick={() => { setMode("signup"); setError(""); setSuccess(""); }}>Sign up</button></span>
          ) : (
            <span>Already have an account? <button type="button" onClick={() => { setMode("login"); setError(""); setSuccess(""); }}>Sign in</button></span>
          )}
        </div>
      </div>
    </div>
  );
}
