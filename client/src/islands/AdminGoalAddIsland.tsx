import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Configure marked for safe output
marked.setOptions({
  breaks: true,
});

interface GoalRow {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
}

interface GoalsListResponse {
  goals: GoalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface FieldErrors {
  title?: string;
  distance?: string;
  image_id?: string;
}

interface PositionPreview {
  previousGoal: GoalRow | null;
  nextGoal: GoalRow | null;
}

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const KM_PER_MILE = 1.60934;
const DISTANCE_TOLERANCE = 0.01;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function AdminGoalAddIsland() {
  // Form state
  const [title, setTitle] = useState('');
  const [distanceMiles, setDistanceMiles] = useState('');
  const [description, setDescription] = useState('');
  const [special, setSpecial] = useState('');
  const [imageId, setImageId] = useState('');

  // UI state
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Goals data for position preview and duplicate check
  const [existingGoals, setExistingGoals] = useState<GoalRow[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState<string | null>(null);

  // Distance-derived state (debounced)
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [positionPreview, setPositionPreview] = useState<PositionPreview | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch all existing goals on mount for position preview
  const fetchExistingGoals = useCallback(async () => {
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const res = await fetch('/api/admin/goals?pageSize=100&order=asc', {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/journey';
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load goals');
      }
      const data: GoalsListResponse = await res.json();
      setExistingGoals(data.goals);
    } catch (err) {
      setGoalsError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setGoalsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExistingGoals();
  }, [fetchExistingGoals]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Debounced distance checks (duplicate + position preview)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const miles = parseFloat(distanceMiles);
      if (isNaN(miles) || miles <= 0 || existingGoals.length === 0) {
        setDuplicateWarning(null);
        setPositionPreview(null);
        return;
      }

      const km = miles * KM_PER_MILE;

      // Duplicate check
      const duplicate = existingGoals.find(
        (g) => Math.abs(g.distance - km) < DISTANCE_TOLERANCE
      );
      if (duplicate) {
        setDuplicateWarning(
          `A goal already exists at this distance (${duplicate.title}). Are you sure?`
        );
      } else {
        setDuplicateWarning(null);
      }

      // Position preview
      let previousGoal: GoalRow | null = null;
      let nextGoal: GoalRow | null = null;

      for (const g of existingGoals) {
        if (g.distance < km) {
          if (!previousGoal || g.distance > previousGoal.distance) {
            previousGoal = g;
          }
        }
        if (g.distance > km) {
          if (!nextGoal || g.distance < nextGoal.distance) {
            nextGoal = g;
          }
        }
      }

      setPositionPreview({ previousGoal, nextGoal });
    }, 300);
  }, [distanceMiles, existingGoals]);

  const validate = useCallback((): FieldErrors => {
    const errs: FieldErrors = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    }
    const trimmed = distanceMiles.trim();
    if (!trimmed) {
      errs.distance = 'Distance must be a positive number';
    } else {
      const distVal = parseFloat(trimmed);
      if (isNaN(distVal) || !isFinite(distVal)) {
        errs.distance = 'Invalid distance value';
      } else if (distVal <= 0) {
        errs.distance = 'Distance must be a positive number';
      }
    }
    const trimmedImageId = imageId.trim();
    if (trimmedImageId && !SLUG_REGEX.test(trimmedImageId)) {
      errs.image_id = "Image ID must be a kebab-case slug (e.g., 'rivendell', 'camp-under-oak')";
    }
    return errs;
  }, [title, distanceMiles, imageId]);

  // Live validation — clear errors when fields are corrected
  useEffect(() => {
    setErrors((prev) => {
      const next = { ...prev };
      if (prev.title && title.trim()) delete next.title;
      if (prev.distance) {
        const d = parseFloat(distanceMiles);
        if (distanceMiles.trim() && !isNaN(d) && d > 0) delete next.distance;
      }
      if (prev.image_id) {
        const tid = imageId.trim();
        if (!tid || SLUG_REGEX.test(tid)) delete next.image_id;
      }
      return next;
    });
  }, [title, distanceMiles, imageId]);

  const handleSave = useCallback(async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/goals', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          distance_miles: parseFloat(distanceMiles),
          description: description.trim() || undefined,
          special: special.trim() || undefined,
          image_id: imageId.trim() || undefined,
        }),
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 403) {
        window.location.href = '/journey';
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create goal');
      }

      const created = await res.json();
      setSuccessMessage('Goal created successfully! Redirecting...');

      // Redirect to the edit page for the new goal
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        window.location.href = `/admin/goals/${created.id}`;
      }, 1000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create goal');
    } finally {
      setSaving(false);
    }
  }, [title, distanceMiles, description, special, imageId, validate]);

  const hasValidationErrors = Object.keys(errors).length > 0;
  const previewHtml = showPreview ? DOMPurify.sanitize(marked.parse(description) as string) : '';
  const distMiles = parseFloat(distanceMiles);
  const distKm = !isNaN(distMiles) && distMiles > 0 ? distMiles * KM_PER_MILE : null;

  return (
    <div className="admin-goal-add">
      <h2>Add New Goal</h2>

      {goalsLoading && (
        <div className="admin-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading existing goals...
        </div>
      )}

      {goalsError && (
        <div className="admin-error" role="alert">
          <p>{goalsError}</p>
          <button type="button" className="admin-error__btn" onClick={fetchExistingGoals}>
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="admin-toast admin-toast-success" role="status">
          <i className="fas fa-check-circle" aria-hidden="true"></i> {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="admin-toast admin-toast-error" role="alert">
          <i className="fas fa-exclamation-circle" aria-hidden="true"></i> {errorMessage}
          <button
            type="button"
            className="admin-toast__dismiss"
            onClick={() => setErrorMessage(null)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      <form
        className="admin-goal-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
      >
        {/* Title */}
        <div className="admin-goal-field">
          <label htmlFor="goal-title">
            Title <span className="admin-goal-required" aria-hidden="true">*</span>
          </label>
          <input
            id="goal-title"
            type="text"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            required
            placeholder="e.g. Camp at Weathertop"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
          {errors.title && (
            <span id="title-error" className="field-error" role="alert">{errors.title}</span>
          )}
        </div>

        {/* Distance (miles) */}
        <div className="admin-goal-field">
          <label htmlFor="goal-distance">
            Distance (miles) <span className="admin-goal-required" aria-hidden="true">*</span>
          </label>
          <input
            id="goal-distance"
            type="number"
            step="0.1"
            min="0"
            value={distanceMiles}
            onInput={(e) => setDistanceMiles((e.target as HTMLInputElement).value)}
            required
            placeholder="e.g. 120.5"
            aria-invalid={!!errors.distance}
            aria-describedby={errors.distance ? 'distance-error' : 'distance-hint'}
          />
          <small id="distance-hint" className="admin-goal-field__hint">
            Stored as km internally ({distKm !== null ? `${distKm.toFixed(1)} km` : '—'})
          </small>
          {errors.distance && (
            <span id="distance-error" className="field-error" role="alert">{errors.distance}</span>
          )}
        </div>

        {/* Duplicate distance warning */}
        {duplicateWarning && (
          <div className="admin-distance-warning" role="alert">
            <i className="fas fa-exclamation-triangle" aria-hidden="true"></i> {duplicateWarning}
          </div>
        )}

        {/* Position preview */}
        {positionPreview && distKm !== null && (
          <div className="admin-position-preview">
            <label>Position Preview</label>
            <div className="admin-position-preview__sequence">
              {positionPreview.previousGoal ? (
                <span className="admin-position-preview__goal">
                  {positionPreview.previousGoal.title} ({(positionPreview.previousGoal.distance / KM_PER_MILE).toFixed(1)} mi)
                </span>
              ) : (
                <span className="admin-position-preview__edge">Start of journey</span>
              )}
              <span className="admin-position-preview__arrow">→</span>
              <span className="admin-position-preview__new">
                <strong>NEW GOAL</strong> ({distMiles.toFixed(1)} mi)
              </span>
              <span className="admin-position-preview__arrow">→</span>
              {positionPreview.nextGoal ? (
                <span className="admin-position-preview__goal">
                  {positionPreview.nextGoal.title} ({(positionPreview.nextGoal.distance / KM_PER_MILE).toFixed(1)} mi)
                </span>
              ) : (
                <span className="admin-position-preview__edge">End of journey</span>
              )}
            </div>
            {!positionPreview.previousGoal && (
              <small className="admin-position-preview__note">Will appear as the first goal</small>
            )}
            {!positionPreview.nextGoal && (
              <small className="admin-position-preview__note">Will appear as the last goal</small>
            )}
          </div>
        )}

        {/* Description with Edit/Preview toggle */}
        <div className="admin-goal-field">
          <label htmlFor="goal-description">Description</label>
          <div className="admin-goal-preview-toggle">
            <button
              type="button"
              className={`admin-goal-preview-toggle__btn ${!showPreview ? 'admin-goal-preview-toggle__btn--active' : ''}`}
              onClick={() => setShowPreview(false)}
            >
              Edit
            </button>
            <button
              type="button"
              className={`admin-goal-preview-toggle__btn ${showPreview ? 'admin-goal-preview-toggle__btn--active' : ''}`}
              onClick={() => setShowPreview(true)}
            >
              Preview
            </button>
          </div>
          {!showPreview ? (
            <textarea
              id="goal-description"
              rows={8}
              value={description}
              onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Markdown supported — describe this milestone's narrative significance"
            />
          ) : (
            <div
              className="admin-goal-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}
        </div>

        {/* Special */}
        <div className="admin-goal-field">
          <label htmlFor="goal-special">Special</label>
          <input
            id="goal-special"
            type="text"
            value={special}
            onInput={(e) => setSpecial((e.target as HTMLInputElement).value)}
            placeholder="Optional special event text"
          />
        </div>

        {/* Image ID */}
        <div className="admin-goal-field">
          <label htmlFor="goal-image-id">Image ID</label>
          <input
            id="goal-image-id"
            type="text"
            value={imageId}
            onInput={(e) => setImageId((e.target as HTMLInputElement).value)}
            placeholder="e.g. rivendell, bag-end"
            aria-invalid={!!errors.image_id}
            aria-describedby={errors.image_id ? 'image-id-error' : 'image-id-hint'}
          />
          <small id="image-id-hint" className="admin-goal-field__hint">
            Slug format: lowercase letters, numbers, hyphens only
          </small>
          {errors.image_id && (
            <span id="image-id-error" className="field-error" role="alert">{errors.image_id}</span>
          )}
        </div>

        {/* Actions */}
        <div className="admin-goal-actions">
          <button
            type="submit"
            className="admin-goal-actions__save"
            disabled={saving || hasValidationErrors || goalsLoading}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Creating...
              </>
            ) : (
              <>
                <i className="fas fa-plus" aria-hidden="true"></i> Create Goal
              </>
            )}
          </button>
          <a href="/admin/goals" className="admin-goal-actions__back">
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Goals
          </a>
        </div>
      </form>
    </div>
  );
}
