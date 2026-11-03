import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { Avatar } from '../components/Avatar';
import { AvatarPickerModal } from '../components/AvatarPickerModal';
import { getAuthHeaders } from '../utils/auth';
import { clearMapCache } from '../utils/map-cache';
import type { ActiveStoryline } from '../types/session';
import { isValidEmail, isValidUsername } from '../../../src/validators';

interface SessionData {
  username: string;
  email: string;
  showFutureGoalsUnlocked: boolean;
  defaultViewMap: boolean;
  avatarId: string | null;
  activeStoryline?: ActiveStoryline;
}

interface StorylineOption {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  pathKey: string;
}

interface StorylineListResponse {
  storylines: StorylineOption[];
}

interface StorylineSwitchResponse {
  totalDistance: number;
  rawTotalDistance: number;
  activeStoryline: ActiveStoryline;
}

type FieldName = 'username' | 'email';
type StatusClass = '' | 'saving' | 'saved' | 'error';

interface FieldStatus {
  message: string;
  statusClass: StatusClass;
}

const EMPTY_STATUS: FieldStatus = { message: '', statusClass: '' };
const SAVED_STATUS_MS = 1500;

/**
 * Per-field save bookkeeping.
 *
 * `inFlight` counts PUTs the server has not answered yet, so a blur that happens
 * while a previous value is still saving can never be treated as a no-op: that
 * older PUT may still land and revert the field. `lastRequested*` remembers the
 * newest request so a re-blur of the same value does not queue a duplicate PUT
 * while that request's response is still the one the field is waiting on.
 */
interface FieldSaveState {
  inFlight: number;
  lastRequestedValue: string | null;
  lastRequestedSeq: number;
}

const FIELD_RULES: Record<FieldName, {
  validate: (value: string) => boolean;
  invalidMessage: string;
}> = {
  username: {
    validate: isValidUsername,
    invalidMessage: 'Username must be 3-30 characters using letters, numbers, and underscores.',
  },
  email: {
    validate: isValidEmail,
    invalidMessage: 'Enter a valid email address.',
  },
};

async function clearServiceWorkerSWRCache(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const message = { type: 'sw-clear-cache' };
  const serviceWorker = navigator.serviceWorker;

  try {
    if (serviceWorker.controller) {
      serviceWorker.controller.postMessage(message);
      return;
    }

    const registration = await serviceWorker.ready;
    registration.active?.postMessage(message);
  } catch {
    // Non-critical: if SW messaging fails, the mutation itself still succeeded.
  }
}

/**
 * Editable profile settings. The SSR renderer owns the `.profile-page` wrapper
 * and the Back to profile row; this island renders the settings cards only.
 * Username/email save on blur with per-field status; the avatar list is owned
 * by `AvatarPickerModal`, so this island never requests `/api/avatars`.
 */
export function ProfileSettingsIsland() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [showFutureGoalsUnlocked, setShowFutureGoalsUnlocked] = useState(true);
  const [defaultViewMap, setDefaultViewMap] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<FieldStatus>(EMPTY_STATUS);
  const [emailStatus, setEmailStatus] = useState<FieldStatus>(EMPTY_STATUS);
  const [preferenceStatus, setPreferenceStatus] = useState('');
  const [preferenceStatusClass, setPreferenceStatusClass] = useState<StatusClass>('');
  const [storylines, setStorylines] = useState<StorylineOption[]>([]);
  const [activeStoryline, setActiveStoryline] = useState<ActiveStoryline | null>(null);
  const [pendingStoryline, setPendingStoryline] = useState<StorylineOption | null>(null);
  const [storylineStatus, setStorylineStatus] = useState('');
  const [storylineStatusClass, setStorylineStatusClass] = useState<StatusClass>('');
  const [switchingStoryline, setSwitchingStoryline] = useState(false);

  const usernameSeq = useRef(0);
  const emailSeq = useRef(0);
  const savedUsername = useRef('');
  const savedEmail = useRef('');
  const usernameSaveState = useRef<FieldSaveState>({ inFlight: 0, lastRequestedValue: null, lastRequestedSeq: 0 });
  const emailSaveState = useRef<FieldSaveState>({ inFlight: 0, lastRequestedValue: null, lastRequestedSeq: 0 });
  const usernameSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFieldSavedTimer = useCallback((field: FieldName) => {
    const timerRef = field === 'username' ? usernameSavedTimer : emailSavedTimer;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [sessionRes, storylinesRes] = await Promise.all([
          fetch('/api/session', { headers: getAuthHeaders() }),
          fetch('/api/storylines', { headers: getAuthHeaders() }),
        ]);

        if (cancelled) return;

        if (sessionRes.status === 401 || storylinesRes.status === 401) {
          window.location.href = '/login';
          return;
        }

        if (sessionRes.ok) {
          const data: SessionData = await sessionRes.json();
          if (cancelled) return;

          const nextUsername = data.username || '';
          const nextEmail = data.email || '';
          setUsername(nextUsername);
          setEmail(nextEmail);
          savedUsername.current = nextUsername;
          savedEmail.current = nextEmail;
          setShowFutureGoalsUnlocked(
            typeof data.showFutureGoalsUnlocked === 'boolean' ? data.showFutureGoalsUnlocked : true
          );
          setDefaultViewMap(
            typeof data.defaultViewMap === 'boolean' ? data.defaultViewMap : false
          );
          setAvatarId(data.avatarId ?? null);
          setActiveStoryline(data.activeStoryline ?? null);
        }

        if (storylinesRes.ok) {
          const data: StorylineListResponse = await storylinesRes.json();
          if (cancelled) return;
          setStorylines(Array.isArray(data.storylines) ? data.storylines : []);
        }
      } catch (err) {
        console.error('Error fetching profile data:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchData();
    return () => {
      cancelled = true;
      clearFieldSavedTimer('username');
      clearFieldSavedTimer('email');
    };
  }, [clearFieldSavedTimer]);

  const setFieldStatus = useCallback((field: FieldName, status: FieldStatus) => {
    if (field === 'username') {
      setUsernameStatus(status);
    } else {
      setEmailStatus(status);
    }
  }, []);

  const handleFieldInput = useCallback((field: FieldName, value: string) => {
    // Clear any pending "Saved" timer so an older save cannot re-assert its
    // status after the user starts editing again.
    clearFieldSavedTimer(field);

    if (field === 'username') {
      usernameSeq.current += 1;
      setUsername(value);
    } else {
      emailSeq.current += 1;
      setEmail(value);
    }

    setFieldStatus(field, EMPTY_STATUS);
  }, [clearFieldSavedTimer, setFieldStatus]);

  const saveField = useCallback(async (field: FieldName, rawValue: string) => {
    const value = rawValue.trim();
    const rules = FIELD_RULES[field];
    const sequenceRef = field === 'username' ? usernameSeq : emailSeq;
    const savedRef = field === 'username' ? savedUsername : savedEmail;
    const saveState = field === 'username' ? usernameSaveState : emailSaveState;

    // Re-blurring a value the newest in-flight request already carries must not
    // queue a duplicate PUT, nor invalidate the response that request owns (its
    // "Saving…" status stays until it settles).
    if (
      saveState.current.inFlight > 0 &&
      saveState.current.lastRequestedValue === value &&
      saveState.current.lastRequestedSeq === sequenceRef.current
    ) {
      return;
    }

    clearFieldSavedTimer(field);
    setFieldStatus(field, EMPTY_STATUS);

    if (!value || !rules.validate(value)) {
      // Invalidate any in-flight save: the field now holds a value the server
      // must not overwrite while the user is told to fix it.
      sequenceRef.current += 1;
      setFieldStatus(field, { message: rules.invalidMessage, statusClass: 'error' });
      return;
    }

    // Skip only when the server already confirmed this value AND nothing can
    // still revert it: an in-flight PUT may land after this blur and persist the
    // value the user has just typed away from (e.g. save "Samwise", type back
    // "FrodoBaggins" and blur — the restore must still reach the server).
    if (value === savedRef.current && saveState.current.inFlight === 0) {
      return;
    }

    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    saveState.current.inFlight += 1;
    saveState.current.lastRequestedValue = value;
    saveState.current.lastRequestedSeq = sequence;

    setFieldStatus(field, { message: 'Saving…', statusClass: 'saving' });

    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ [field]: value }),
        keepalive: true,
      });

      // A newer edit/blur owns the field now; discard this stale response.
      if (sequence !== sequenceRef.current) return;

      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }

      if (response.ok) {
        savedRef.current = value;
        if (field === 'username') {
          setUsername(value);
        } else {
          setEmail(value);
        }

        setFieldStatus(field, { message: 'Saved', statusClass: 'saved' });

        const timerRef = field === 'username' ? usernameSavedTimer : emailSavedTimer;
        timerRef.current = setTimeout(() => {
          setFieldStatus(field, EMPTY_STATUS);
          timerRef.current = null;
        }, SAVED_STATUS_MS);

        void clearServiceWorkerSWRCache();
        return;
      }

      let message = 'Failed to save';
      try {
        const data = await response.json() as { error?: unknown };
        if (typeof data.error === 'string' && data.error) {
          message = data.error;
        }
      } catch {
        // Non-JSON error body: keep the generic message.
      }

      setFieldStatus(field, { message, statusClass: 'error' });
    } catch (err) {
      if (sequence !== sequenceRef.current) return;
      console.error('Error updating profile:', err);
      setFieldStatus(field, { message: 'Network error. Please try again.', statusClass: 'error' });
    } finally {
      saveState.current.inFlight -= 1;
      if (saveState.current.inFlight === 0) {
        saveState.current.lastRequestedValue = null;
        saveState.current.lastRequestedSeq = 0;
      }
    }
  }, [clearFieldSavedTimer, setFieldStatus]);

  const switchStoryline = useCallback(async (mode: 'carry' | 'reset') => {
    if (!pendingStoryline) return;

    setSwitchingStoryline(true);
    setStorylineStatus('Saving...');
    setStorylineStatusClass('saving');

    try {
      const response = await fetch('/api/user/storyline', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ storylineId: pendingStoryline.id, mode }),
      });
      const data = await response.json() as StorylineSwitchResponse | { error?: string };

      if (!response.ok || !('activeStoryline' in data)) {
        throw new Error('error' in data && data.error ? data.error : 'Failed to update journey');
      }

      setActiveStoryline(data.activeStoryline);
      setPendingStoryline(null);
      setStorylineStatus('Saved');
      setStorylineStatusClass('saved');
      setTimeout(() => { setStorylineStatus(''); setStorylineStatusClass(''); }, SAVED_STATUS_MS);

      clearMapCache();
      window.dispatchEvent(new CustomEvent('storylineChanged', { detail: data }));
      void clearServiceWorkerSWRCache();
    } catch (err) {
      console.error('Error switching storyline:', err);
      setStorylineStatus(err instanceof Error ? err.message : 'Failed to update journey');
      setStorylineStatusClass('error');
    } finally {
      setSwitchingStoryline(false);
    }
  }, [pendingStoryline]);

  const handleStorylineChange = useCallback((e: Event) => {
    const storylineId = Number((e.target as HTMLSelectElement).value);
    const nextStoryline = storylines.find((storyline) => storyline.id === storylineId) ?? null;
    if (!nextStoryline || nextStoryline.id === activeStoryline?.id) return;
    setPendingStoryline(nextStoryline);
  }, [activeStoryline?.id, storylines]);

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
        headers: getAuthHeaders(),
        body: JSON.stringify({ [preferenceKey]: newValue }),
      });

      if (response.ok) {
        setPreferenceStatus('Saved');
        setPreferenceStatusClass('saved');
        setTimeout(() => { setPreferenceStatus(''); setPreferenceStatusClass(''); }, SAVED_STATUS_MS);

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

        void clearServiceWorkerSWRCache();
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

  if (loading) {
    return (
      <div className="profile-page-loading">
        <div className="party-loading">Loading profile...</div>
      </div>
    );
  }

  return (
    <>
      <div className="profile-card">
        <div className="profile-card-body">
          <div className="form-group">
            <label htmlFor="profile-username">Username:</label>
            <input
              type="text"
              id="profile-username"
              value={username}
              onInput={(e) => handleFieldInput('username', (e.target as HTMLInputElement).value)}
              onBlur={(e) => { void saveField('username', (e.target as HTMLInputElement).value); }}
              placeholder="Enter username"
            />
            <small className="field-hint">3-30 characters, letters, numbers, and underscores only</small>
            <div
              id="profile-username-status"
              className={`profile-field-status ${usernameStatus.statusClass}`}
              role="status"
              aria-live="polite"
            >
              {usernameStatus.message}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="profile-email">Email:</label>
            <input
              type="email"
              id="profile-email"
              value={email}
              onInput={(e) => handleFieldInput('email', (e.target as HTMLInputElement).value)}
              onBlur={(e) => { void saveField('email', (e.target as HTMLInputElement).value); }}
              placeholder="Enter email"
            />
            <small className="field-hint">Valid email address</small>
            <div
              id="profile-email-status"
              className={`profile-field-status ${emailStatus.statusClass}`}
              role="status"
              aria-live="polite"
            >
              {emailStatus.message}
            </div>
          </div>

          <div className="form-group avatar-section">
            <span className="avatar-section-label">Avatar</span>
            <div className="avatar-preview" id="avatar-preview">
              <Avatar username={username || 'U'} avatarId={avatarId} size={128} />
            </div>
            <button
              type="button"
              className="btn btn-secondary profile-avatar-trigger"
              id="change-avatar-btn"
              aria-haspopup="dialog"
              onClick={() => setPickerOpen(true)}
            >
              <i className="fas fa-camera" aria-hidden="true"></i> Change avatar
            </button>
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
                  void savePreference('showFutureGoalsUnlocked', newVal, () => setShowFutureGoalsUnlocked(!newVal));
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
                  void savePreference('defaultViewMap', newVal, () => setDefaultViewMap(!newVal));
                }}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div
            id="preference-status"
            className={`preference-status ${preferenceStatusClass}`}
            role="status"
            aria-live="polite"
          >
            {preferenceStatus}
          </div>

          <div className="form-group storyline-section">
            <label htmlFor="profile-storyline">Journey</label>
            <select
              id="profile-storyline"
              value={activeStoryline?.id ?? ''}
              onChange={handleStorylineChange}
              disabled={storylines.length === 0 || switchingStoryline}
            >
              <option value="" disabled>Select a journey</option>
              {storylines.map((storyline) => (
                <option key={storyline.id} value={storyline.id}>{storyline.title}</option>
              ))}
            </select>
            {activeStoryline?.description && (
              <small className="field-hint">{activeStoryline.description}</small>
            )}
            <div
              className={`preference-status ${storylineStatusClass}`}
              role="status"
              aria-live="polite"
            >
              {storylineStatus}
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <AvatarPickerModal
          username={username || 'U'}
          avatarId={avatarId}
          onChange={setAvatarId}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {pendingStoryline && (
        <div className="profile-dialog-overlay" onClick={() => setPendingStoryline(null)}>
          <div className="profile-dialog" role="dialog" aria-modal="true" aria-label="Change journey" onClick={(e) => e.stopPropagation()}>
            <h3>Change Journey</h3>
            <p>
              Switch to <strong>{pendingStoryline.title}</strong> and choose how your current distance should appear there.
            </p>
            <div className="profile-dialog-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingStoryline(null)} disabled={switchingStoryline}>
                Cancel
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { void switchStoryline('carry'); }} disabled={switchingStoryline}>
                Carry Distance
              </button>
              <button type="button" className="btn btn-primary" onClick={() => { void switchStoryline('reset'); }} disabled={switchingStoryline}>
                Start at 0
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
