import { useCallback } from 'preact/hooks';

/**
 * Account card for the settings page. Owns the existing logout action so the
 * sign-out control stays last on the page, after the push-notification island.
 */
export function ProfileAccountIsland() {
  const handleLogout = useCallback(() => {
    const logoutFn = (window as typeof window & { logout?: () => void }).logout;
    if (logoutFn) {
      logoutFn();
    }
  }, []);

  return (
    <div className="profile-card profile-account-card">
      <div className="profile-card-body">
        <h2 className="profile-card-heading">Account</h2>
        <p className="field-hint">Sign out of Walk to Mordor on this device.</p>
        <button
          type="button"
          className="btn btn-danger profile-logout-btn"
          id="logout-modal-btn"
          onClick={handleLogout}
        >
          <i className="fas fa-right-from-bracket" aria-hidden="true"></i> Logout
        </button>
      </div>
    </div>
  );
}
