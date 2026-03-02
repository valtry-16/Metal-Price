import { useAuth } from "../contexts/AuthContext";

export default function ProtectedRoute({ children, onOpenAuth }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="al-page-loading">
        <div className="al-loading-orb" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Trigger auth modal and show a message
    return (
      <div className="al-protected-gate">
        <div className="al-protected-gate__card">
          <div className="al-protected-gate__icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h2>Sign In Required</h2>
          <p>You need to be signed in to access this feature. Create a free account to unlock portfolio tracking, alerts, and more.</p>
          <button type="button" className="al-btn al-btn--primary" onClick={() => onOpenAuth?.()}>
            Sign In to Continue
          </button>
        </div>
      </div>
    );
  }

  return children;
}
