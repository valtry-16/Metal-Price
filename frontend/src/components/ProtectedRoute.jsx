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
          <div className="al-protected-gate__icon">🔒</div>
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
