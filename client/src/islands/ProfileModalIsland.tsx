import { useState, useEffect, useRef, useCallback } from 'preact/hooks';

interface ProfileModalIslandProps {
  onClose: () => void;
  initialData?: SessionData;
}

interface SessionData {
  username?: string;
  email?: string;
  showFutureGoalsUnlocked?: boolean;
  defaultViewMap?: boolean;
}

interface PreferenceStatus {
  text: string;
  className: string;
}

declare global {
  interface Window {
    getAuthHeaders: () => Record<string, string>;
    logout: () => void;
    userPreferences?: Record<string, boolean>;
    profileModule?: {
      showProfileModal: () => void;
    };
    showProfileModal?: () => void;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function ProfileModalIsland({ onClose, initialData }: ProfileModalIslandProps) {
  const [username, setUsername] = useState(initialData?.username || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [showFutureGoalsUnlocked, setShowFutureGoalsUnlocked] = useState(
    typeof initialData?.showFutureGoalsUnlocked === 'boolean' ? initialData.showFutureGoalsUnlocked : true
  );
  const [defaultViewMap, setDefaultViewMap] = useState(
    typeof initialData?.defaultViewMap === 'boolean' ? initialData.defaultViewMap : false
  );
  const [preferenceStatus, setPreferenceStatus] = useState<PreferenceStatus>({ text: '', className: 'preference-status' });
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const usernameRef = useRef<HTMLInputElement>(null);

  // Fetch user data on mount if no initial data provided
  useEffect(() => {
    if (initialData) return;
    async function fetchSession() {
      try {
        const response = await fetch('/api/session', {
          headers: window.getAuthHeaders()
        });
        if (response.ok) {
          const data: SessionData = await response.json();
          setUsername(data.username || '');
          setEmail(data.email || '');
          setShowFutureGoalsUnlocked(
            typeof data.showFutureGoalsUnlocked === 'boolean' ? data.showFutureGoalsUnlocked : true
          );
          setDefaultViewMap(
            typeof data.defaultViewMap === 'boolean' ? data.defaultViewMap : false
          );
        }
      } catch (error) {
        console.error('Error fetching user info:', error);
      }
    }
    fetchSession();
  }, [initialData]);

  // Focus username input after mount (only if no other field is already focused)
  useEffect(() => {
    const timer = setTimeout(() => {
      const active = document.activeElement;
      const modalEl = usernameRef.current?.closest('.modal-overlay');
      const alreadyFocused = active && modalEl?.contains(active) && active.tagName === 'INPUT';
      if (!alreadyFocused) {
        usernameRef.current?.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = useCallback((e: MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      onClose();
    }
  }, [onClose]);

  const savePreference = useCallback(async (
    preferenceKey: string,
    newValue: boolean,
    revert: () => void
  ) => {
    setPreferenceStatus({ text: 'Saving...', className: 'preference-status saving' });

    try {
      const response = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...window.getAuthHeaders()
        },
        body: JSON.stringify({ [preferenceKey]: newValue })
      });

      if (response.ok) {
        setPreferenceStatus({ text: 'Saved', className: 'preference-status saved' });
        setTimeout(() => {
          setPreferenceStatus({ text: '', className: 'preference-status' });
        }, 1500);

        if (window.userPreferences) {
          window.userPreferences[preferenceKey] = newValue;
        }

        if (preferenceKey === 'defaultViewMap') {
          try {
            localStorage.setItem('defaultViewMap', newValue ? 'true' : 'false');
          } catch (_e) { /* localStorage may be unavailable */ }
        }

        window.dispatchEvent(new CustomEvent('preferenceChanged', {
          detail: { [preferenceKey]: newValue }
        }));
      } else {
        const data = await response.json();
        setPreferenceStatus({
          text: data.error || 'Failed to save',
          className: 'preference-status error'
        });
        revert();
      }
    } catch (error) {
      console.error('Error saving preference:', error);
      setPreferenceStatus({ text: 'Network error', className: 'preference-status error' });
      revert();
    }
  }, []);

  const handleMilestonesToggle = useCallback(() => {
    const newValue = !showFutureGoalsUnlocked;
    setShowFutureGoalsUnlocked(newValue);
    savePreference('showFutureGoalsUnlocked', newValue, () => setShowFutureGoalsUnlocked(!newValue));
  }, [showFutureGoalsUnlocked, savePreference]);

  const handleDefaultViewToggle = useCallback(() => {
    const newValue = !defaultViewMap;
    setDefaultViewMap(newValue);
    savePreference('defaultViewMap', newValue, () => setDefaultViewMap(!newValue));
  }, [defaultViewMap, savePreference]);

  const handleSaveProfile = useCallback(async () => {
    const trimmedUsername = username.trim();
    const trimmedEmail = email.trim();

    setErrorMessage('');
    setSuccessMessage('');

    if (!trimmedUsername && !trimmedEmail) {
      setErrorMessage('Please provide at least one field to update');
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
          ...window.getAuthHeaders()
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(data.message || 'Profile updated successfully!');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMessage(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setErrorMessage('Network error. Please try again.');
    }
  }, [username, email, onClose]);

  const handleLogout = useCallback(() => {
    onClose();
    if (window.logout) {
      window.logout();
    }
  }, [onClose]);

  return (
    <div class="modal-overlay" onClick={handleOverlayClick}>
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h2 class="modal-title">User Profile</h2>
            <button class="close-btn" id="close-profile-modal" aria-label="Close" onClick={onClose}>&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label for="profile-username">Username:</label>
              <input
                type="text"
                id="profile-username"
                ref={usernameRef}
                value={username}
                onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
                placeholder="Enter username"
              />
              <small class="field-hint">3-30 characters, letters, numbers, and underscores only</small>
            </div>
            <div class="form-group">
              <label for="profile-email">Email:</label>
              <input
                type="email"
                id="profile-email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="Enter email"
              />
              <small class="field-hint">Valid email address</small>
            </div>
            <div class="form-group toggle-group">
              <label for="preview-milestones-toggle" class="toggle-label">
                Preview all milestones
                <small class="field-hint">Reveal future destinations on your journey</small>
              </label>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  id="preview-milestones-toggle"
                  checked={showFutureGoalsUnlocked}
                  onChange={handleMilestonesToggle}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div class="form-group toggle-group">
              <label for="default-view-toggle" class="toggle-label">
                Default to map view
                <small class="field-hint">Open the map instead of the journey page on launch</small>
              </label>
              <label class="toggle-switch">
                <input
                  type="checkbox"
                  id="default-view-toggle"
                  checked={defaultViewMap}
                  onChange={handleDefaultViewToggle}
                />
                <span class="toggle-slider"></span>
              </label>
            </div>
            <div id="preference-status" class={preferenceStatus.className}>{preferenceStatus.text}</div>
            <div id="profile-error" class="error-message">{errorMessage}</div>
            <div id="profile-success" class="success-message">{successMessage}</div>
          </div>
          <div class="modal-footer modal-footer-full">
            <div class="modal-footer-btns modal-footer-btns-profile">
              <button type="button" class="btn btn-primary" id="save-profile-btn" onClick={handleSaveProfile}>Save Changes</button>
              <button type="button" class="btn btn-danger" id="logout-modal-btn" onClick={handleLogout}>Logout</button>
              <button type="button" class="btn btn-secondary" id="cancel-profile-btn" onClick={onClose}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
