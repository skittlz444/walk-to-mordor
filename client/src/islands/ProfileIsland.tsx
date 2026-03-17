import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { Avatar } from '../components/Avatar';

interface SessionData {
  username: string;
  email: string;
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
  avatarId: string | null;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function ProfileIsland() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showFutureGoalsUnlocked, setShowFutureGoalsUnlocked] = useState(true);
  const [defaultViewMap, setDefaultViewMap] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [preferenceStatus, setPreferenceStatus] = useState('');
  const [preferenceStatusClass, setPreferenceStatusClass] = useState('');
  const [avatarStatus, setAvatarStatus] = useState('');
  const [avatarStatusClass, setAvatarStatusClass] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [sessionRes, avatarRes] = await Promise.all([
          fetch('/api/session', { headers: getAuthHeaders() }),
          fetch('/api/avatars', { headers: getAuthHeaders() }),
        ]);

        if (cancelled) return;

        if (sessionRes.ok) {
          const data: SessionData = await sessionRes.json();
          setUsername(data.username || '');
          setEmail(data.email || '');
          setShowFutureGoalsUnlocked(
            typeof data.showFutureGoalsUnlocked === 'boolean' ? data.showFutureGoalsUnlocked : true
          );
          setDefaultViewMap(
            typeof data.defaultViewMap === 'boolean' ? data.defaultViewMap : false
          );
          setAvatarId(data.avatarId ?? null);
        }

        if (avatarRes.ok) {
          const avatars: string[] = await avatarRes.json();
          setAvailableAvatars(avatars);
        }
      } catch (err) {
        console.error('Error fetching profile data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loading && usernameRef.current) {
      usernameRef.current.focus();
    }
  }, [loading]);

  const saveAvatarChoice = useCallback(async (slug: string | null) => {
    setAvatarStatus('Saving...');
    setAvatarStatusClass('saving');

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ avatarId: slug }),
      });

      if (response.ok) {
        setAvatarId(slug);
        setAvatarStatus('Saved');
        setAvatarStatusClass('saved');
        setTimeout(() => { setAvatarStatus(''); setAvatarStatusClass(''); }, 1500);

        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { avatarId: slug },
        }));
      } else {
        const data = await response.json();
        setAvatarStatus(data.error || 'Failed to save');
        setAvatarStatusClass('error');
      }
    } catch (err) {
      console.error('Error saving avatar:', err);
      setAvatarStatus('Network error');
      setAvatarStatusClass('error');
    }
  }, []);

  const savePreference = useCallback(async (
    preferenceKey: string,
    newValue: boolean,
    rollback: () => void
  ) => {
    setPreferenceStatus('Saving...');
    setPreferenceStatusClass('saving');

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ [preferenceKey]: newValue }),
      });

      if (response.ok) {
        setPreferenceStatus('Saved');
        setPreferenceStatusClass('saved');
        setTimeout(() => { setPreferenceStatus(''); setPreferenceStatusClass(''); }, 1500);

        if (preferenceKey === 'defaultViewMap') {
          try {
            localStorage.setItem('defaultViewMap', newValue ? 'true' : 'false');
          } catch { /* localStorage may be unavailable */ }
        }

        // Update window.userPreferences so legacy JS (e.g. goals.js) stays in sync
        const prefs = (window as typeof window & { userPreferences?: Record<string, unknown> }).userPreferences;
        if (prefs) {
          prefs[preferenceKey] = newValue;
        }

        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { [preferenceKey]: newValue },
        }));
      } else {
        const data = await response.json();
        setPreferenceStatus(data.error || 'Failed to save');
        setPreferenceStatusClass('error');
        rollback();
      }
    } catch (err) {
      console.error('Error saving preference:', err);
      setPreferenceStatus('Network error');
      setPreferenceStatusClass('error');
      rollback();
    }
  }, []);

  const handleSave = useCallback(async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    setError('');
    setSuccess('');

    if (!trimmedUsername && !trimmedEmail) {
      setError('Please provide at least one field to update');
      return;
    }

    const updates: Record<string, string> = {};
    if (trimmedUsername) updates.username = trimmedUsername;
    if (trimmedEmail) updates.email = trimmedEmail;

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Profile updated successfully!');
      } else {
        setError(data.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Network error. Please try again.');
    }
  }, [username, email]);

  const handleLogout = useCallback(() => {
    const logoutFn = (window as typeof window & { logout?: () => void }).logout;
    if (logoutFn) {
      logoutFn();
    }
  }, []);

  const handleBack = useCallback(() => {
    window.history.back();
  }, []);

  const handleGalleryKeyDown = useCallback((e: KeyboardEvent) => {
    const gallery = (e.currentTarget as HTMLElement);
    const buttons = Array.from(gallery.querySelectorAll('.avatar-option')) as HTMLElement[];
    const current = document.activeElement as HTMLElement;
    const idx = buttons.indexOf(current);
    if (idx === -1) return;

    let next = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % buttons.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + buttons.length) % buttons.length;
    }
    if (next >= 0) {
      e.preventDefault();
      buttons[next].focus();
    }
  }, []);

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="party-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-card-body">
          <div className="form-group">
            <label htmlFor="profile-username">Username:</label>
            <input
              type="text"
              id="profile-username"
              ref={usernameRef}
              value={username}
              onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
              placeholder="Enter username"
            />
            <small className="field-hint">3-30 characters, letters, numbers, and underscores only</small>
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email:</label>
            <input
              type="email"
              id="profile-email"
              value={email}
              onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              placeholder="Enter email"
            />
            <small className="field-hint">Valid email address</small>
          </div>

          <div className="form-group avatar-section">
            <label>Avatar</label>
            <div className="avatar-preview" id="avatar-preview">
              <Avatar username={username || 'U'} avatarId={avatarId} size={128} />
            </div>
            <div
              className="avatar-gallery"
              id="avatar-gallery"
              role="radiogroup"
              aria-label="Choose avatar"
              onKeyDown={handleGalleryKeyDown}
            >
              {availableAvatars.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className={`avatar-option${avatarId === slug ? ' selected' : ''}`}
                  data-slug={slug}
                  role="radio"
                  aria-checked={avatarId === slug ? 'true' : 'false'}
                  aria-label={slug}
                  onClick={() => {
                    if (slug !== avatarId) saveAvatarChoice(slug);
                  }}
                >
                  <img
                    src={`/img/avatars/${encodeURIComponent(slug)}.webp`}
                    alt={slug}
                    width={64}
                    height={64}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              className="avatar-reset-btn"
              id="avatar-reset-btn"
              onClick={() => { if (avatarId !== null) saveAvatarChoice(null); }}
            >
              <i className="fas fa-undo" aria-hidden="true"></i> Use initials
            </button>
            <div id="avatar-status" className={`preference-status ${avatarStatusClass}`}>
              {avatarStatus}
            </div>
          </div>

          <div className="form-group toggle-group">
            <label htmlFor="preview-milestones-toggle" className="toggle-label">
              Preview all milestones
              <small className="field-hint">Reveal future destinations on your journey</small>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="preview-milestones-toggle"
                checked={showFutureGoalsUnlocked}
                onChange={(e) => {
                  const newVal = (e.target as HTMLInputElement).checked;
                  setShowFutureGoalsUnlocked(newVal);
                  savePreference('showFutureGoalsUnlocked', newVal, () => setShowFutureGoalsUnlocked(!newVal));
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="form-group toggle-group">
            <label htmlFor="default-view-toggle" className="toggle-label">
              Default to map view
              <small className="field-hint">Open the map instead of the journey page on launch</small>
            </label>
            <label className="toggle-switch">
              <input
                type="checkbox"
                id="default-view-toggle"
                checked={defaultViewMap}
                onChange={(e) => {
                  const newVal = (e.target as HTMLInputElement).checked;
                  setDefaultViewMap(newVal);
                  savePreference('defaultViewMap', newVal, () => setDefaultViewMap(!newVal));
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div id="preference-status" className={`preference-status ${preferenceStatusClass}`}>
            {preferenceStatus}
          </div>

          {error && <div id="profile-error" className="error-message" style={{ display: 'block' }}>{error}</div>}
          {success && <div id="profile-success" className="success-message" style={{ display: 'block' }}>{success}</div>}
        </div>

        <div className="profile-card-footer">
          <div className="profile-footer-btns">
            <button type="button" className="btn btn-primary" id="save-profile-btn" onClick={handleSave}>
              Save Changes
            </button>
            <button type="button" className="btn btn-danger" id="logout-modal-btn" onClick={handleLogout}>
              Logout
            </button>
            <button type="button" className="btn btn-secondary" id="cancel-profile-btn" onClick={handleBack}>
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
