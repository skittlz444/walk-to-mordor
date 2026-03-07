import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { ImageBrowserModal } from '../components/admin/ImageBrowserModal';

// Configure marked for safe output
marked.setOptions({
  breaks: true,
});

interface GoalDetail {
  id: number;
  title: string;
  distance: number;
  description: string;
  special: string | null;
  image_id: string | null;
}

interface FieldErrors {
  title?: string;
  distance?: string;
  description?: string;
  image_id?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function getGoalIdFromPath(): number | null {
  const match = window.location.pathname.match(/^\/admin\/goals\/(\d+)$/);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function AdminGoalEditIsland() {
  const [goal, setGoal] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
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

  // Image workflow state (Story 4.5)
  const [imageStatus, setImageStatus] = useState<'loading' | 'found' | 'missing' | 'none'>('none');
  const [showImageBrowser, setShowImageBrowser] = useState(false);
  const [showImageHelp, setShowImageHelp] = useState(false);
  const imageDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goalId = getGoalIdFromPath();

  const fetchGoal = useCallback(async () => {
    if (!goalId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/admin/goals/${goalId}`, {
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
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error('Failed to load goal');
      }
      const data: GoalDetail = await res.json();
      setGoal(data);
      setTitle(data.title);
      setDistance(String(data.distance));
      setDescription(data.description || '');
      setSpecial(data.special || '');
      setImageId(data.image_id || '');
      document.title = `Walk to Mordor - Edit: ${data.title}`;
      // Update breadcrumb with goal title (AC12)
      const breadcrumbCurrent = document.querySelector('.admin-breadcrumb [aria-current="page"]');
      if (breadcrumbCurrent) {
        breadcrumbCurrent.textContent = `Edit: ${data.title}`;
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Failed to load goal');
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchGoal();
  }, [fetchGoal]);

  // Clean up success timer on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
      if (imageDebounceRef.current) {
        clearTimeout(imageDebounceRef.current);
      }
    };
  }, []);

  // Debounced image validation (Story 4.5 — AC1, AC2)
  // Checks BOTH highres and thumb existence per AC1 requirement
  useEffect(() => {
    const trimmed = imageId.trim();
    if (!trimmed) {
      setImageStatus('none');
      return;
    }
    if (!SLUG_REGEX.test(trimmed)) {
      setImageStatus('none');
      return;
    }
    setImageStatus('loading');
    if (imageDebounceRef.current) {
      clearTimeout(imageDebounceRef.current);
    }
    imageDebounceRef.current = setTimeout(() => {
      const thumbPromise = new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = `/img/thumbs/${trimmed}-thumb.webp`;
      });
      const highresPromise = fetch(`/img/highres/${trimmed}.webp`, { method: 'HEAD' })
        .then(r => r.ok)
        .catch(() => false);

      Promise.all([thumbPromise, highresPromise]).then(([thumbOk, highresOk]) => {
        setImageStatus(thumbOk && highresOk ? 'found' : 'missing');
      });
    }, 300);
  }, [imageId]);

  const handleImageBrowserSelect = useCallback((slug: string) => {
    setImageId(slug);
    setShowImageBrowser(false);
  }, []);

  const validate = useCallback((): FieldErrors => {
    const errs: FieldErrors = {};
    if (!title.trim()) {
      errs.title = 'Title is required';
    }
    const distVal = parseFloat(distance);
    if (!distance.trim() || isNaN(distVal) || distVal <= 0) {
      errs.distance = 'Distance must be a positive number';
    }
    if (!description.trim()) {
      errs.description = 'Description is required';
    }
    const trimmedImageId = imageId.trim();
    if (trimmedImageId && !SLUG_REGEX.test(trimmedImageId)) {
      errs.image_id = 'Image ID must be a valid slug (lowercase letters, numbers, hyphens)';
    }
    return errs;
  }, [title, distance, description, imageId]);

  // Live validation — clear errors when fields are corrected
  useEffect(() => {
    setErrors((prev) => {
      const next = { ...prev };
      if (prev.title && title.trim()) delete next.title;
      if (prev.distance) {
        const d = parseFloat(distance);
        if (distance.trim() && !isNaN(d) && d > 0) delete next.distance;
      }
      if (prev.description && description.trim()) delete next.description;
      if (prev.image_id) {
        const tid = imageId.trim();
        if (!tid || SLUG_REGEX.test(tid)) delete next.image_id;
      }
      return next;
    });
  }, [title, distance, description, imageId]);

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
      const res = await fetch(`/api/admin/goals/${goalId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: title.trim(),
          distance: parseFloat(distance),
          description: description.trim(),
          special: special.trim() || null,
          image_id: imageId.trim() || null,
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
        throw new Error(data.error || 'Failed to save goal');
      }
      const updated: GoalDetail = await res.json();
      setGoal(updated);
      setTitle(updated.title);
      setDistance(String(updated.distance));
      setDescription(updated.description || '');
      setSpecial(updated.special || '');
      setImageId(updated.image_id || '');
      document.title = `Walk to Mordor - Edit: ${updated.title}`;
      setSuccessMessage('Goal updated successfully');
      // Auto-dismiss success after 3 seconds
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  }, [goalId, title, distance, description, special, imageId, validate]);

  const hasValidationErrors = Object.keys(errors).length > 0;

  // Loading state
  if (loading) {
    return (
      <div className="admin-goal-edit">
        <h2>Edit Goal</h2>
        <div className="admin-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading goal...
        </div>
      </div>
    );
  }

  // 404 state
  if (notFound) {
    return (
      <div className="admin-goal-edit">
        <h2>Goal Not Found</h2>
        <div className="admin-error" role="alert">
          <p>The requested goal could not be found.</p>
          <a href="/admin/goals" className="admin-goal-actions__back">
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Goals
          </a>
        </div>
      </div>
    );
  }

  // Fetch error state
  if (fetchError) {
    return (
      <div className="admin-goal-edit">
        <h2>Edit Goal</h2>
        <div className="admin-error" role="alert">
          <p>{fetchError}</p>
          <button type="button" className="admin-error__btn" onClick={fetchGoal}>
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  const previewHtml = showPreview ? DOMPurify.sanitize(marked.parse(description) as string) : '';
  const hasImage = !!(imageId.trim());

  return (
    <div className="admin-goal-edit">
      <h2>Edit Goal: {goal?.title}</h2>

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
        {/* Read-only ID */}
        <div className="admin-goal-field admin-goal-readonly">
          <label>ID</label>
          <span className="admin-goal-readonly__value">{goal?.id}</span>
        </div>

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
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'title-error' : undefined}
          />
          {errors.title && (
            <span id="title-error" className="field-error" role="alert">{errors.title}</span>
          )}
        </div>

        {/* Distance */}
        <div className="admin-goal-field">
          <label htmlFor="goal-distance">
            Distance (km) <span className="admin-goal-required" aria-hidden="true">*</span>
          </label>
          <input
            id="goal-distance"
            type="number"
            step="any"
            min="0"
            value={distance}
            onInput={(e) => setDistance((e.target as HTMLInputElement).value)}
            required
            aria-invalid={!!errors.distance}
            aria-describedby={errors.distance ? 'distance-error' : undefined}
          />
          {errors.distance && (
            <span id="distance-error" className="field-error" role="alert">{errors.distance}</span>
          )}
        </div>

        {/* Description with Edit/Preview toggle */}
        <div className="admin-goal-field">
          <label htmlFor="goal-description">
            Description <span className="admin-goal-required" aria-hidden="true">*</span>
          </label>
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
              required
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? 'description-error' : undefined}
            />
          ) : (
            <div
              className="admin-goal-preview"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          )}
          {errors.description && (
            <span id="description-error" className="field-error" role="alert">{errors.description}</span>
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

        {/* Image ID with Browse button */}
        <div className="admin-goal-field">
          <label htmlFor="goal-image-id">Image ID</label>
          <div className="admin-image-section__input-row">
            <input
              id="goal-image-id"
              type="text"
              value={imageId}
              onInput={(e) => setImageId((e.target as HTMLInputElement).value)}
              placeholder="e.g. rivendell, bag-end"
              aria-invalid={!!errors.image_id}
              aria-describedby={errors.image_id ? 'image-id-error' : 'image-id-hint'}
            />
            <button
              type="button"
              className="admin-image-section__browse-btn"
              onClick={() => setShowImageBrowser(true)}
              title="Browse available images"
            >
              <i className="fas fa-images" aria-hidden="true"></i> Browse
            </button>
          </div>
          <small id="image-id-hint" className="admin-goal-field__hint">
            Slug format: lowercase letters, numbers, hyphens only
          </small>
          {errors.image_id && (
            <span id="image-id-error" className="field-error" role="alert">{errors.image_id}</span>
          )}
        </div>

        {/* Image Status & Preview Section (Story 4.5 — AC1, AC2, AC7) */}
        <div className="admin-image-section">
          <label>Image Status</label>
          <div className="admin-image-section__status-row">
            {imageStatus === 'none' && (
              <span className="admin-image-status none">
                <i className="fas fa-info-circle" aria-hidden="true"></i> No image assigned
              </span>
            )}
            {imageStatus === 'loading' && (
              <span className="admin-image-status loading">
                <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Checking...
              </span>
            )}
            {imageStatus === 'found' && (
              <span className="admin-image-status found">
                <i className="fas fa-check-circle" aria-hidden="true"></i> Image found
              </span>
            )}
            {imageStatus === 'missing' && (
              <span className="admin-image-status missing">
                <i className="fas fa-exclamation-triangle" aria-hidden="true"></i> Image not found
              </span>
            )}
          </div>

          {/* Thumbnail preview + full-size link */}
          {hasImage && imageStatus === 'found' && (
            <div className="admin-image-preview">
              <img
                src={`/img/thumbs/${imageId.trim()}-thumb.webp`}
                alt={`Thumbnail for ${title}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <a
                href={`/img/highres/${imageId.trim()}.webp`}
                target="_blank"
                rel="noopener noreferrer"
                className="admin-image-preview__fullsize"
              >
                <i className="fas fa-external-link-alt" aria-hidden="true"></i> View Full Size
              </a>
            </div>
          )}

          {/* Warning for missing images (AC7) */}
          {hasImage && imageStatus === 'missing' && (
            <div className="admin-image-warning" role="alert">
              <i className="fas fa-exclamation-triangle" aria-hidden="true"></i>
              {' '}Image files not found for slug &apos;{imageId.trim()}&apos;.{' '}
              <button
                type="button"
                className="admin-image-warning__link"
                onClick={() => setShowImageHelp(true)}
              >
                Follow the image asset workflow to add images.
              </button>
            </div>
          )}

          {/* Inline Help Panel (AC6) */}
          <div className="admin-image-help">
            <button
              type="button"
              className="admin-image-help__toggle"
              onClick={() => setShowImageHelp(!showImageHelp)}
              aria-expanded={showImageHelp}
            >
              <i className={`fas fa-${showImageHelp ? 'chevron-down' : 'chevron-right'}`} aria-hidden="true"></i>
              {' '}How to add images
            </button>
            {showImageHelp && (
              <div className="admin-image-help__content">
                <ol>
                  <li>Place source image in <code>raw_assets/</code> directory</li>
                  <li>Run <code>npm run optimize:images</code> to generate WebP variants</li>
                  <li>Commit new files in <code>public/img/highres/</code> and <code>public/img/thumbs/</code></li>
                  <li>Run <code>npm run build</code> (regenerates image manifest)</li>
                  <li>Deploy via <code>npm run deploy</code></li>
                  <li>Return to admin and assign the <code>image_id</code> slug to the goal</li>
                </ol>
                <p>
                  <strong>Naming convention:</strong> Use lowercase letters, numbers, and hyphens.
                  The filename (without extension) becomes the <code>image_id</code> slug.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="admin-goal-actions">
          <button
            type="submit"
            className="admin-goal-actions__save"
            disabled={saving || hasValidationErrors}
          >
            {saving ? (
              <>
                <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save" aria-hidden="true"></i> Save
              </>
            )}
          </button>
          <a href="/admin/goals" className="admin-goal-actions__back">
            <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Goals
          </a>
        </div>
      </form>

      {/* Image Browser Modal (Story 4.5 — AC5) */}
      <ImageBrowserModal
        isOpen={showImageBrowser}
        onClose={() => setShowImageBrowser(false)}
        onSelect={handleImageBrowserSelect}
        currentImageId={imageId.trim()}
      />
    </div>
  );
}
