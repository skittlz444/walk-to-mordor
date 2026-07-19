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

type GoalContentType = 'story' | 'poetry' | 'appendix';

interface GoalContentEntry {
  id: number;
  goal_id: number;
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface GoalContentFormState {
  type: GoalContentType;
  title: string;
  body: string;
  author_attribution: string;
  sort_order: string;
}

interface GoalContentFieldErrors {
  type?: string;
  title?: string;
  body?: string;
  author_attribution?: string;
  sort_order?: string;
  form?: string;
}

const SLUG_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GOAL_CONTENT_TYPES: GoalContentType[] = ['story', 'poetry', 'appendix'];
const MAX_CONTENT_TITLE_LENGTH = 120;
const MAX_CONTENT_ATTRIBUTION_LENGTH = 255;
const MAX_CONTENT_BODY_LENGTH = 20000;
const MAX_CONTENT_SORT_ORDER = 999;
const EMPTY_CONTENT_FORM: GoalContentFormState = {
  type: 'story',
  title: '',
  body: '',
  author_attribution: '',
  sort_order: '0',
};

/** Next default sort order: one above the highest existing entry (0 when empty). */
function computeNextSortOrder(entries: GoalContentEntry[]): number {
  if (entries.length === 0) return 0;
  return Math.max(...entries.map((entry) => entry.sort_order)) + 1;
}

function sanitizeRenderedHtml(html: string): string {
  const sanitized = DOMPurify.sanitize(html);
  const template = document.createElement('template');
  template.innerHTML = sanitized;
  template.content.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attr) => {
      if (/^on/i.test(attr.name) || /^\s*javascript:/i.test(attr.value)) {
        element.removeAttribute(attr.name);
      }
    });
  });
  return template.innerHTML;
}

function sanitizeMarkdown(markdown: string): string {
  return sanitizeRenderedHtml(marked.parse(markdown) as string);
}

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

  // Goal content authoring state
  const [contentEntries, setContentEntries] = useState<GoalContentEntry[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentForm, setContentForm] = useState<GoalContentFormState>({ ...EMPTY_CONTENT_FORM });
  const [contentErrors, setContentErrors] = useState<GoalContentFieldErrors>({});
  const [contentSaving, setContentSaving] = useState(false);
  const [showContentPreview, setShowContentPreview] = useState(false);
  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editContentForm, setEditContentForm] = useState<GoalContentFormState>({ ...EMPTY_CONTENT_FORM });
  const [editContentErrors, setEditContentErrors] = useState<GoalContentFieldErrors>({});
  const [editContentSaving, setEditContentSaving] = useState(false);
  const [showEditContentPreview, setShowEditContentPreview] = useState(false);
  const [deletingContentId, setDeletingContentId] = useState<number | null>(null);

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

  const fetchContentEntries = useCallback(async () => {
    if (!goalId) return;

    setContentLoading(true);
    setContentError(null);
    try {
      const res = await fetch(`/api/admin/goals/${goalId}/content`, {
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
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load goal content');
      }
      const data: { entries?: GoalContentEntry[] } = await res.json();
      const sortedEntries = [...(data.entries ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      setContentEntries(sortedEntries);
      setContentForm((current) => ({ ...current, sort_order: String(computeNextSortOrder(sortedEntries)) }));
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Failed to load goal content');
    } finally {
      setContentLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchGoal();
    fetchContentEntries();
  }, [fetchGoal, fetchContentEntries]);

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
    if (!distance.trim() || isNaN(distVal) || !isFinite(distVal) || distVal <= 0) {
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
        if (distance.trim() && !isNaN(d) && isFinite(d) && d > 0) delete next.distance;
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

  const validateContentForm = useCallback((form: GoalContentFormState): GoalContentFieldErrors => {
    const errs: GoalContentFieldErrors = {};
    const titleValue = form.title.trim();
    const bodyValue = form.body.trim();
    const attributionValue = form.author_attribution.trim();
    const sortOrderValue = Number(form.sort_order);

    if (!GOAL_CONTENT_TYPES.includes(form.type)) {
      errs.type = 'Content type is required';
    }
    if (!titleValue) {
      errs.title = 'Title is required';
    } else if (titleValue.length > MAX_CONTENT_TITLE_LENGTH) {
      errs.title = `Title must be ${MAX_CONTENT_TITLE_LENGTH} characters or fewer`;
    }
    if (!bodyValue) {
      errs.body = 'Body is required';
    } else if (bodyValue.length > MAX_CONTENT_BODY_LENGTH) {
      errs.body = `Body must be ${MAX_CONTENT_BODY_LENGTH} characters or fewer`;
    }
    if (attributionValue.length > MAX_CONTENT_ATTRIBUTION_LENGTH) {
      errs.author_attribution = `Attribution must be ${MAX_CONTENT_ATTRIBUTION_LENGTH} characters or fewer`;
    }
    if (!form.sort_order.trim() || !Number.isInteger(sortOrderValue) || sortOrderValue < 0 || sortOrderValue > MAX_CONTENT_SORT_ORDER) {
      errs.sort_order = `Sort order must be an integer from 0 to ${MAX_CONTENT_SORT_ORDER}`;
    }

    return errs;
  }, []);

  const buildContentPayload = useCallback((form: GoalContentFormState) => ({
    type: form.type,
    title: form.title.trim(),
    body: form.body.trim(),
    author_attribution: form.author_attribution.trim() || null,
    sort_order: Number(form.sort_order),
  }), []);

  const parseContentError = useCallback(async (res: Response): Promise<string> => {
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      return 'Sort order already exists for this goal. Choose a unique sort order.';
    }
    return typeof data.error === 'string' ? data.error : 'Failed to save goal content';
  }, []);

  const handleCreateContent = useCallback(async () => {
    const validationErrors = validateContentForm(contentForm);
    if (Object.keys(validationErrors).length > 0) {
      setContentErrors(validationErrors);
      return;
    }

    setContentErrors({});
    setContentSaving(true);
    setContentError(null);
    try {
      const res = await fetch(`/api/admin/goals/${goalId}/content`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(buildContentPayload(contentForm)),
      });
      if (!res.ok) {
        throw new Error(await parseContentError(res));
      }
      const created: GoalContentEntry = await res.json();
      const updatedEntries = [...contentEntries, created].sort((a, b) => a.sort_order - b.sort_order);
      setContentEntries(updatedEntries);
      setContentForm({ ...EMPTY_CONTENT_FORM, sort_order: String(computeNextSortOrder(updatedEntries)) });
      setShowContentPreview(false);
      setSuccessMessage('Goal content created');
    } catch (err) {
      setContentErrors({ form: err instanceof Error ? err.message : 'Failed to create goal content' });
    } finally {
      setContentSaving(false);
    }
  }, [buildContentPayload, contentEntries, contentForm, goalId, parseContentError, validateContentForm]);

  const startEditContent = useCallback((entry: GoalContentEntry) => {
    setEditingContentId(entry.id);
    setEditContentForm({
      type: entry.type,
      title: entry.title,
      body: entry.body,
      author_attribution: entry.author_attribution || '',
      sort_order: String(entry.sort_order),
    });
    setEditContentErrors({});
    setShowEditContentPreview(false);
  }, []);

  const cancelEditContent = useCallback(() => {
    setEditingContentId(null);
    setEditContentForm({ ...EMPTY_CONTENT_FORM });
    setEditContentErrors({});
    setShowEditContentPreview(false);
  }, []);

  const handleUpdateContent = useCallback(async (contentId: number) => {
    const validationErrors = validateContentForm(editContentForm);
    if (Object.keys(validationErrors).length > 0) {
      setEditContentErrors(validationErrors);
      return;
    }

    setEditContentErrors({});
    setEditContentSaving(true);
    try {
      const res = await fetch(`/api/admin/goals/${goalId}/content/${contentId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(buildContentPayload(editContentForm)),
      });
      if (!res.ok) {
        throw new Error(await parseContentError(res));
      }
      const updated: GoalContentEntry = await res.json();
      setContentEntries((entries) => entries.map((entry) => entry.id === updated.id ? updated : entry).sort((a, b) => a.sort_order - b.sort_order));
      setSuccessMessage('Goal content updated');
      cancelEditContent();
    } catch (err) {
      setEditContentErrors({ form: err instanceof Error ? err.message : 'Failed to update goal content' });
    } finally {
      setEditContentSaving(false);
    }
  }, [buildContentPayload, cancelEditContent, editContentForm, goalId, parseContentError, validateContentForm]);

  const handleDeleteContent = useCallback(async (contentId: number) => {
    if (!confirm('Delete this goal content entry?')) return;

    setDeletingContentId(contentId);
    setContentError(null);
    try {
      const res = await fetch(`/api/admin/goals/${goalId}/content/${contentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to delete goal content');
      }
      setContentEntries((entries) => entries.filter((entry) => entry.id !== contentId));
      setSuccessMessage('Goal content deleted');
      if (editingContentId === contentId) {
        cancelEditContent();
      }
    } catch (err) {
      setContentError(err instanceof Error ? err.message : 'Failed to delete goal content');
    } finally {
      setDeletingContentId(null);
    }
  }, [cancelEditContent, editingContentId, goalId]);

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

  const previewHtml = showPreview ? sanitizeMarkdown(description) : '';
  const hasImage = !!(imageId.trim());
  const contentPreviewHtml = showContentPreview ? sanitizeMarkdown(contentForm.body) : '';
  const editContentPreviewHtml = showEditContentPreview ? sanitizeMarkdown(editContentForm.body) : '';

  const renderContentFields = (
    form: GoalContentFormState,
    setForm: (updater: (current: GoalContentFormState) => GoalContentFormState) => void,
    formErrors: GoalContentFieldErrors,
    previewEnabled: boolean,
    setPreviewEnabled: (enabled: boolean) => void,
    previewBodyHtml: string,
    prefix: string,
  ) => (
    <>
      <div className="admin-goal-field">
        <label htmlFor={`${prefix}-type`}>
          Type <span className="admin-goal-required" aria-hidden="true">*</span>
        </label>
        <select
          id={`${prefix}-type`}
          value={form.type}
          onInput={(e) => setForm((current) => ({ ...current, type: (e.target as HTMLSelectElement).value as GoalContentType }))}
          aria-invalid={!!formErrors.type}
        >
          <option value="story">Story</option>
          <option value="poetry">Poetry</option>
          <option value="appendix">Appendix</option>
        </select>
        {formErrors.type && <span className="field-error" role="alert">{formErrors.type}</span>}
      </div>

      <div className="admin-goal-field">
        <label htmlFor={`${prefix}-title`}>
          Title <span className="admin-goal-required" aria-hidden="true">*</span>
        </label>
        <input
          id={`${prefix}-title`}
          type="text"
          maxLength={MAX_CONTENT_TITLE_LENGTH}
          value={form.title}
          onInput={(e) => setForm((current) => ({ ...current, title: (e.target as HTMLInputElement).value }))}
          aria-invalid={!!formErrors.title}
        />
        <small className="admin-goal-field__hint">{form.title.length}/{MAX_CONTENT_TITLE_LENGTH}</small>
        {formErrors.title && <span className="field-error" role="alert">{formErrors.title}</span>}
      </div>

      <div className="admin-goal-field">
        <label htmlFor={`${prefix}-sort-order`}>
          Sort order <span className="admin-goal-required" aria-hidden="true">*</span>
        </label>
        <input
          id={`${prefix}-sort-order`}
          type="number"
          min="0"
          max={MAX_CONTENT_SORT_ORDER}
          step="1"
          value={form.sort_order}
          onInput={(e) => setForm((current) => ({ ...current, sort_order: (e.target as HTMLInputElement).value }))}
          aria-invalid={!!formErrors.sort_order}
        />
        <small className="admin-goal-field__hint">
          Controls display order — lower numbers appear first. Each entry needs a unique number.
        </small>
        {formErrors.sort_order && <span className="field-error" role="alert">{formErrors.sort_order}</span>}
      </div>

      <div className="admin-goal-field">
        <label htmlFor={`${prefix}-attribution`}>Attribution</label>
        <input
          id={`${prefix}-attribution`}
          type="text"
          maxLength={MAX_CONTENT_ATTRIBUTION_LENGTH}
          value={form.author_attribution}
          onInput={(e) => setForm((current) => ({ ...current, author_attribution: (e.target as HTMLInputElement).value }))}
          aria-invalid={!!formErrors.author_attribution}
        />
        <small className="admin-goal-field__hint">{form.author_attribution.length}/{MAX_CONTENT_ATTRIBUTION_LENGTH}</small>
        {formErrors.author_attribution && <span className="field-error" role="alert">{formErrors.author_attribution}</span>}
      </div>

      <div className="admin-goal-field">
        <label htmlFor={`${prefix}-body`}>
          Markdown body <span className="admin-goal-required" aria-hidden="true">*</span>
        </label>
        <div className="admin-goal-preview-toggle">
          <button
            type="button"
            className={`admin-goal-preview-toggle__btn ${!previewEnabled ? 'admin-goal-preview-toggle__btn--active' : ''}`}
            onClick={() => setPreviewEnabled(false)}
          >
            Edit
          </button>
          <button
            type="button"
            className={`admin-goal-preview-toggle__btn ${previewEnabled ? 'admin-goal-preview-toggle__btn--active' : ''}`}
            onClick={() => setPreviewEnabled(true)}
          >
            Preview
          </button>
        </div>
        {!previewEnabled ? (
          <textarea
            id={`${prefix}-body`}
            rows={8}
            maxLength={MAX_CONTENT_BODY_LENGTH}
            value={form.body}
            onInput={(e) => setForm((current) => ({ ...current, body: (e.target as HTMLTextAreaElement).value }))}
            aria-invalid={!!formErrors.body}
          />
        ) : (
          <div
            className="admin-goal-preview admin-goal-content-preview"
            dangerouslySetInnerHTML={{ __html: previewBodyHtml }}
          />
        )}
        <small className="admin-goal-field__hint">{form.body.length}/{MAX_CONTENT_BODY_LENGTH}</small>
        {formErrors.body && <span className="field-error" role="alert">{formErrors.body}</span>}
      </div>

      {formErrors.form && (
        <div className="admin-error" role="alert">
          {formErrors.form}
        </div>
      )}
    </>
  );

  const renderGoalContentManagement = () => (
    <section className="admin-goal-content" style={{ marginTop: '2em' }}>
      <h3>Goal Content</h3>
      <p className="admin-goal-field__hint">
        Add ordered campfire stories, poems, and appendices. Reorder by editing sort order directly.
      </p>

      {contentError && (
        <div className="admin-error" role="alert">
          {contentError}
          <button type="button" className="admin-error__btn" onClick={fetchContentEntries} style={{ marginLeft: '0.75em' }}>
            Retry
          </button>
        </div>
      )}

      <div className="admin-goal-content__list" style={{ margin: '1em 0' }}>
        {contentLoading ? (
          <div className="admin-loading">
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading goal content...
          </div>
        ) : contentEntries.length === 0 ? (
          <div className="admin-empty-state">No goal content yet.</div>
        ) : (
          contentEntries.map((entry) => (
            <article key={entry.id} className="admin-goal-content__entry" style={{ border: '1px solid #444', borderRadius: '8px', padding: '1em', marginBottom: '1em' }}>
              {editingContentId === entry.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleUpdateContent(entry.id);
                  }}
                >
                  {renderContentFields(
                    editContentForm,
                    setEditContentForm,
                    editContentErrors,
                    showEditContentPreview,
                    setShowEditContentPreview,
                    editContentPreviewHtml,
                    `edit-content-${entry.id}`,
                  )}
                  <div className="admin-goal-actions" style={{ marginTop: '0.75em' }}>
                    <button type="submit" className="admin-goal-actions__save" disabled={editContentSaving}>
                      {editContentSaving ? 'Saving...' : 'Save Content'}
                    </button>
                    <button type="button" className="admin-goal-actions__back" onClick={cancelEditContent}>
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1em', flexWrap: 'wrap' }}>
                    <div>
                      <span className={`goal-content-badge goal-content-badge--${entry.type}`}>{entry.type}</span>
                      <h4 style={{ margin: '0.25em 0' }}>{entry.title}</h4>
                      <div className="admin-goal-field__hint">Sort order: {entry.sort_order}</div>
                      {entry.author_attribution && (
                        <div className="admin-goal-field__hint">Attribution: {entry.author_attribution}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5em', alignItems: 'flex-start' }}>
                      <button type="button" className="admin-image-section__browse-btn" onClick={() => startEditContent(entry)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-image-section__browse-btn"
                        onClick={() => handleDeleteContent(entry.id)}
                        disabled={deletingContentId === entry.id}
                      >
                        {deletingContentId === entry.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                  <div
                    className="admin-goal-preview admin-goal-content-preview"
                    style={{ marginTop: '0.75em' }}
                    dangerouslySetInnerHTML={{ __html: sanitizeMarkdown(entry.body) }}
                  />
                </>
              )}
            </article>
          ))
        )}
      </div>

      <form
        className="admin-goal-form admin-goal-content__create"
        onSubmit={(e) => {
          e.preventDefault();
          handleCreateContent();
        }}
      >
        <h4>Add Content Entry</h4>
        {renderContentFields(
          contentForm,
          setContentForm,
          contentErrors,
          showContentPreview,
          setShowContentPreview,
          contentPreviewHtml,
          'new-content',
        )}
        <div className="admin-goal-actions">
          <button type="submit" className="admin-goal-actions__save" disabled={contentSaving}>
            {contentSaving ? 'Creating...' : 'Create Content'}
          </button>
        </div>
      </form>
    </section>
  );

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
        </div>
      </form>

      {renderGoalContentManagement()}

      <div className="admin-goal-actions" style={{ marginTop: '1.5em' }}>
        <a href="/admin/goals" className="admin-goal-actions__back">
          <i className="fas fa-arrow-left" aria-hidden="true"></i> Back to Goals
        </a>
      </div>

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
