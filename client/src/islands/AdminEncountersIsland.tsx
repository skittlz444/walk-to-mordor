import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';

interface AdminEncounterBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

interface AdminEncounterDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
  target_stretch_multiplier: number;
  target_min_distance: number;
  target_max_distance: number;
  is_repeatable: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: AdminEncounterBadge | null;
  badge_name: string | null;
}

interface EncounterFormState {
  slug: string;
  name: string;
  description: string;
  imageSlug: string;
  badgeSlug: string;
  badgeName: string;
  badgeDescription: string;
  badgeImageSlug: string;
  durationDays: string;
  targetStretchMultiplier: string;
  targetMinDistance: string;
  targetMaxDistance: string;
  isRepeatable: boolean;
}

type FieldErrors = Record<string, string>;

type UpdateForm = <K extends keyof EncounterFormState>(key: K, value: EncounterFormState[K]) => void;

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type BadgeFieldName = 'badgeSlug' | 'badgeName' | 'badgeDescription' | 'badgeImageSlug';

interface BadgeDefinitionFieldsProps {
  idPrefix: string;
  slug: string;
  name: string;
  description: string;
  imageSlug: string;
  errors: FieldErrors;
  onChange: (field: BadgeFieldName, value: string) => void;
}

interface DisableConfirmation {
  encounter: AdminEncounterDefinition;
  activeOccurrences: number;
}

interface UnauthorizedState {
  redirect: string;
  message: string;
}

interface FormFieldSpec {
  payloadKey: string;
  errorKey: string | null;
  serialize: (value: string | boolean) => unknown;
}

/**
 * Single source of truth for how each form field maps to the API payload and
 * to the validation error keys returned by the encounter endpoints. Keeping
 * both mappings here stops the payload and the error clearing from drifting.
 */
const FIELD_SPECS: Record<keyof EncounterFormState, FormFieldSpec> = {
  slug: { payloadKey: 'slug', errorKey: 'slug', serialize: (value) => (value as string).trim() },
  name: { payloadKey: 'name', errorKey: 'name', serialize: (value) => (value as string).trim() },
  description: { payloadKey: 'description', errorKey: 'description', serialize: (value) => (value as string).trim() },
  imageSlug: { payloadKey: 'image_slug', errorKey: 'image_slug', serialize: (value) => (value as string).trim() },
  badgeSlug: { payloadKey: 'badge_slug', errorKey: 'badge_slug', serialize: (value) => (value as string).trim() },
  badgeName: { payloadKey: 'badge_name', errorKey: 'badge_name', serialize: (value) => (value as string).trim() },
  badgeDescription: {
    payloadKey: 'badge_description',
    errorKey: 'badge_description',
    serialize: (value) => (value as string).trim(),
  },
  badgeImageSlug: {
    payloadKey: 'badge_image_slug',
    errorKey: 'badge_image_slug',
    serialize: (value) => (value as string).trim(),
  },
  durationDays: { payloadKey: 'duration_days', errorKey: 'duration_days', serialize: (value) => toNumber(value as string) },
  targetStretchMultiplier: {
    payloadKey: 'target_stretch_multiplier',
    errorKey: 'target_stretch_multiplier',
    serialize: (value) => toNumber(value as string),
  },
  targetMinDistance: {
    payloadKey: 'target_min_distance',
    errorKey: 'target_min_distance',
    serialize: (value) => toNumber(value as string),
  },
  targetMaxDistance: {
    payloadKey: 'target_max_distance',
    errorKey: 'target_max_distance',
    serialize: (value) => toNumber(value as string),
  },
  isRepeatable: { payloadKey: 'is_repeatable', errorKey: null, serialize: (value) => value === true },
};

const EMPTY_FORM: EncounterFormState = {
  slug: '',
  name: '',
  description: '',
  imageSlug: '',
  badgeSlug: '',
  badgeName: '',
  badgeDescription: '',
  badgeImageSlug: '',
  durationDays: '7',
  targetStretchMultiplier: '1.5',
  targetMinDistance: '5',
  targetMaxDistance: '15',
  isRepeatable: true,
};

function toFormState(encounter: AdminEncounterDefinition): EncounterFormState {
  return {
    slug: encounter.slug,
    name: encounter.name,
    description: encounter.description,
    imageSlug: encounter.image_slug ?? '',
    badgeSlug: encounter.badge_slug ?? '',
    badgeName: encounter.badge_name ?? encounter.badge?.name ?? '',
    badgeDescription: encounter.badge?.description ?? '',
    badgeImageSlug: encounter.badge?.image_slug ?? '',
    durationDays: String(encounter.duration_days),
    targetStretchMultiplier: String(encounter.target_stretch_multiplier),
    targetMinDistance: String(encounter.target_min_distance),
    targetMaxDistance: String(encounter.target_max_distance),
    isRepeatable: encounter.is_repeatable,
  };
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPayload(form: EncounterFormState): Record<string, unknown> {
  return Object.fromEntries(
    (Object.keys(FIELD_SPECS) as Array<keyof EncounterFormState>).map((key): [string, unknown] => {
      const spec = FIELD_SPECS[key];
      return [spec.payloadKey, spec.serialize(form[key])];
    }),
  );
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return await res.json() as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readFieldErrors(data: Record<string, unknown>): FieldErrors | null {
  if (data.error !== 'validation' || !data.fields || typeof data.fields !== 'object') {
    return null;
  }
  const fieldErrors: FieldErrors = {};
  for (const [key, value] of Object.entries(data.fields as Record<string, unknown>)) {
    if (typeof value === 'string') fieldErrors[key] = value;
  }
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  return typeof data.error === 'string' ? data.error : fallback;
}

function badgeLabel(encounter: AdminEncounterDefinition): string {
  return encounter.badge_name || encounter.badge?.name || encounter.badge_slug || '—';
}

/**
 * Reusable inline badge metadata fields. Defined here so it can be extracted
 * into a shared admin component once other surfaces manage their own badges.
 */
function BadgeDefinitionFields({
  idPrefix,
  slug,
  name,
  description,
  imageSlug,
  errors,
  onChange,
}: BadgeDefinitionFieldsProps) {
  return (
    <fieldset className="admin-encounter-badge-fields">
      <legend>Badge definition</legend>
      <p className="admin-encounter-hint">
        Link an existing badge by slug, or fill in the badge metadata to create a challenge badge on save.
      </p>
      <div className="admin-encounter-form__grid">
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-badge-slug`}>Badge slug</label>
          <input
            id={`${idPrefix}-badge-slug`}
            type="text"
            maxLength={120}
            value={slug}
            onInput={(e) => onChange('badgeSlug', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.badge_slug}
            aria-describedby={errors.badge_slug ? `${idPrefix}-badge-slug-error` : undefined}
          />
          {errors.badge_slug && (
            <span className="field-error" role="alert" id={`${idPrefix}-badge-slug-error`}>{errors.badge_slug}</span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-badge-name`}>Badge name</label>
          <input
            id={`${idPrefix}-badge-name`}
            type="text"
            value={name}
            onInput={(e) => onChange('badgeName', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.badge_name}
            aria-describedby={errors.badge_name ? `${idPrefix}-badge-name-error` : undefined}
          />
          {errors.badge_name && (
            <span className="field-error" role="alert" id={`${idPrefix}-badge-name-error`}>{errors.badge_name}</span>
          )}
        </div>
        <div className="admin-encounter-field admin-encounter-form__wide">
          <label htmlFor={`${idPrefix}-badge-description`}>Badge description</label>
          <textarea
            id={`${idPrefix}-badge-description`}
            rows={2}
            value={description}
            onInput={(e) => onChange('badgeDescription', (e.target as HTMLTextAreaElement).value)}
            aria-invalid={!!errors.badge_description}
            aria-describedby={errors.badge_description ? `${idPrefix}-badge-description-error` : undefined}
          ></textarea>
          {errors.badge_description && (
            <span className="field-error" role="alert" id={`${idPrefix}-badge-description-error`}>
              {errors.badge_description}
            </span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-badge-image-slug`}>Badge image slug</label>
          <input
            id={`${idPrefix}-badge-image-slug`}
            type="text"
            maxLength={120}
            value={imageSlug}
            onInput={(e) => onChange('badgeImageSlug', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.badge_image_slug}
            aria-describedby={errors.badge_image_slug ? `${idPrefix}-badge-image-slug-error` : undefined}
          />
          {errors.badge_image_slug && (
            <span className="field-error" role="alert" id={`${idPrefix}-badge-image-slug-error`}>
              {errors.badge_image_slug}
            </span>
          )}
        </div>
      </div>
    </fieldset>
  );
}

function EncounterFields({
  idPrefix,
  form,
  errors,
  update,
}: {
  idPrefix: string;
  form: EncounterFormState;
  errors: FieldErrors;
  update: UpdateForm;
}) {
  return (
    <>
      <div className="admin-encounter-form__grid">
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-slug`}>Slug</label>
          <input
            id={`${idPrefix}-slug`}
            type="text"
            maxLength={80}
            value={form.slug}
            onInput={(e) => update('slug', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.slug}
            aria-describedby={errors.slug ? `${idPrefix}-slug-error` : undefined}
          />
          {errors.slug && <span className="field-error" role="alert" id={`${idPrefix}-slug-error`}>{errors.slug}</span>}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-name`}>Name</label>
          <input
            id={`${idPrefix}-name`}
            type="text"
            maxLength={120}
            value={form.name}
            onInput={(e) => update('name', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? `${idPrefix}-name-error` : undefined}
          />
          {errors.name && <span className="field-error" role="alert" id={`${idPrefix}-name-error`}>{errors.name}</span>}
        </div>
        <div className="admin-encounter-field admin-encounter-form__wide">
          <label htmlFor={`${idPrefix}-description`}>Description</label>
          <textarea
            id={`${idPrefix}-description`}
            rows={3}
            maxLength={2000}
            value={form.description}
            onInput={(e) => update('description', (e.target as HTMLTextAreaElement).value)}
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? `${idPrefix}-description-error` : undefined}
          ></textarea>
          {errors.description && (
            <span className="field-error" role="alert" id={`${idPrefix}-description-error`}>{errors.description}</span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-image-slug`}>Image slug</label>
          <input
            id={`${idPrefix}-image-slug`}
            type="text"
            maxLength={120}
            value={form.imageSlug}
            onInput={(e) => update('imageSlug', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.image_slug}
            aria-describedby={errors.image_slug ? `${idPrefix}-image-slug-error` : undefined}
          />
          {errors.image_slug && (
            <span className="field-error" role="alert" id={`${idPrefix}-image-slug-error`}>{errors.image_slug}</span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-duration-days`}>Duration (days)</label>
          <input
            id={`${idPrefix}-duration-days`}
            type="number"
            min="1"
            max="30"
            step="1"
            value={form.durationDays}
            onInput={(e) => update('durationDays', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.duration_days}
            aria-describedby={errors.duration_days ? `${idPrefix}-duration-days-error` : undefined}
          />
          {errors.duration_days && (
            <span className="field-error" role="alert" id={`${idPrefix}-duration-days-error`}>{errors.duration_days}</span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-stretch-multiplier`}>Target stretch multiplier</label>
          <input
            id={`${idPrefix}-stretch-multiplier`}
            type="number"
            min="1"
            max="5"
            step="0.1"
            value={form.targetStretchMultiplier}
            onInput={(e) => update('targetStretchMultiplier', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.target_stretch_multiplier}
            aria-describedby={errors.target_stretch_multiplier ? `${idPrefix}-stretch-multiplier-error` : undefined}
          />
          {errors.target_stretch_multiplier && (
            <span className="field-error" role="alert" id={`${idPrefix}-stretch-multiplier-error`}>
              {errors.target_stretch_multiplier}
            </span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-min-distance`}>Target minimum distance (km)</label>
          <input
            id={`${idPrefix}-min-distance`}
            type="number"
            min="0"
            step="0.1"
            value={form.targetMinDistance}
            onInput={(e) => update('targetMinDistance', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.target_min_distance}
            aria-describedby={errors.target_min_distance ? `${idPrefix}-min-distance-error` : undefined}
          />
          {errors.target_min_distance && (
            <span className="field-error" role="alert" id={`${idPrefix}-min-distance-error`}>
              {errors.target_min_distance}
            </span>
          )}
        </div>
        <div className="admin-encounter-field">
          <label htmlFor={`${idPrefix}-max-distance`}>Target maximum distance (km)</label>
          <input
            id={`${idPrefix}-max-distance`}
            type="number"
            min="0"
            step="0.1"
            value={form.targetMaxDistance}
            onInput={(e) => update('targetMaxDistance', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.target_max_distance}
            aria-describedby={errors.target_max_distance ? `${idPrefix}-max-distance-error` : undefined}
          />
          {errors.target_max_distance && (
            <span className="field-error" role="alert" id={`${idPrefix}-max-distance-error`}>
              {errors.target_max_distance}
            </span>
          )}
        </div>
        <label className="admin-encounter-checkbox" htmlFor={`${idPrefix}-repeatable`}>
          <input
            id={`${idPrefix}-repeatable`}
            type="checkbox"
            checked={form.isRepeatable}
            onChange={(e) => update('isRepeatable', (e.target as HTMLInputElement).checked)}
          />
          Repeatable
        </label>
      </div>

      <BadgeDefinitionFields
        idPrefix={idPrefix}
        slug={form.badgeSlug}
        name={form.badgeName}
        description={form.badgeDescription}
        imageSlug={form.badgeImageSlug}
        errors={errors}
        onChange={update}
      />
    </>
  );
}

export function AdminEncountersIsland() {
  const [encounters, setEncounters] = useState<AdminEncounterDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState<UnauthorizedState | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<EncounterFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [disableConfirmation, setDisableConfirmation] = useState<DisableConfirmation | null>(null);

  const sectionRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const keepActiveRef = useRef<HTMLButtonElement | null>(null);

  const handleAuthFailure = useCallback((res: Response): boolean => {
    if (res.status === 401) {
      setUnauthorized({ redirect: '/login', message: 'Your session has expired. Redirecting to sign in…' });
      window.location.href = '/login';
      return true;
    }
    if (res.status === 403) {
      setUnauthorized({ redirect: '/journey', message: 'Admin access is required. Redirecting…' });
      window.location.href = '/journey';
      return true;
    }
    return false;
  }, []);

  const fetchEncounters = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/encounters', { headers: getAuthHeaders() });
      if (handleAuthFailure(res)) return;
      if (!res.ok) throw new Error('Failed to load encounters');
      const data = await res.json() as { encounters?: AdminEncounterDefinition[] };
      setEncounters(data.encounters ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load encounters');
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    void fetchEncounters();
  }, [fetchEncounters]);

  /**
   * While the disable confirmation is open, the page behind it is inert, focus
   * starts on the safe action, Tab stays inside the dialog, and closing returns
   * focus to the control that opened it. Escape keeps its existing close
   * behavior; the backdrop keeps its click-to-dismiss behavior.
   */
  useEffect(() => {
    if (!disableConfirmation) return;

    const section = sectionRef.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    section?.setAttribute('inert', '');
    keepActiveRef.current?.focus();

    const trapFocus = (event: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (active === last || !dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDisableConfirmation(null);
        return;
      }
      if (event.key === 'Tab') {
        trapFocus(event);
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      section?.removeAttribute('inert');
      if (previouslyFocused && previouslyFocused !== document.body && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [disableConfirmation]);

  const updateForm: UpdateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    const errorKey = FIELD_SPECS[key].errorKey;
    if (!errorKey) return;
    setFieldErrors((current) => {
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };

  const resetFormState = () => {
    setFieldErrors({});
    setFormError(null);
  };

  const startCreate = () => {
    setEditingId(null);
    setShowCreate(true);
    setForm(EMPTY_FORM);
    resetFormState();
    setNotice(null);
  };

  const startEdit = (encounter: AdminEncounterDefinition) => {
    setShowCreate(false);
    setEditingId(encounter.id);
    setForm(toFormState(encounter));
    resetFormState();
    setNotice(null);
  };

  const cancelForm = () => {
    setShowCreate(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetFormState();
  };

  const handleValidationFailure = (data: Record<string, unknown>, fallback: string) => {
    const fieldErrorsFromApi = readFieldErrors(data);
    if (fieldErrorsFromApi) {
      setFieldErrors(fieldErrorsFromApi);
      setFormError('Please correct the highlighted fields.');
      return;
    }
    setFormError(errorMessage(data, fallback));
  };

  const submitForm = async (event: Event) => {
    event.preventDefault();
    const isEdit = editingId !== null;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/encounters/${editingId}` : '/api/admin/encounters',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(buildPayload(form)),
        },
      );
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (!res.ok) {
        handleValidationFailure(data, isEdit ? 'Failed to save encounter' : 'Failed to create encounter');
        return;
      }
      const saved = data.encounter as AdminEncounterDefinition | undefined;
      if (!saved) {
        setFormError(isEdit ? 'Failed to save encounter' : 'Failed to create encounter');
        return;
      }
      setShowCreate(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      resetFormState();
      setNotice(isEdit ? 'Encounter updated' : 'Encounter created');
      await fetchEncounters(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save encounter');
    } finally {
      setSaving(false);
    }
  };

  const applyEncounterUpdate = (encounter: AdminEncounterDefinition) => {
    setEncounters((current) => current.map((item) => (item.id === encounter.id ? encounter : item)));
  };

  const enableEncounter = async (encounter: AdminEncounterDefinition) => {
    setBusyId(encounter.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/encounters/${encounter.id}/enable`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (!res.ok || !data.encounter) {
        throw new Error(errorMessage(data, 'Failed to enable encounter'));
      }
      applyEncounterUpdate(data.encounter as AdminEncounterDefinition);
      setNotice(`Enabled ${encounter.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable encounter');
    } finally {
      setBusyId(null);
    }
  };

  const disableEncounter = async (
    encounter: AdminEncounterDefinition,
    cancelActive?: boolean,
    activeOccurrences = 0,
  ) => {
    setBusyId(encounter.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/encounters/${encounter.id}/disable`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        ...(cancelActive === undefined ? {} : { body: JSON.stringify({ cancelActive }) }),
      });
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (res.status === 400 && data.requiresConfirmation === true) {
        setDisableConfirmation({
          encounter,
          activeOccurrences: typeof data.activeOccurrences === 'number' ? data.activeOccurrences : 0,
        });
        return;
      }
      if (!res.ok || !data.encounter) {
        throw new Error(errorMessage(data, 'Failed to disable encounter'));
      }
      applyEncounterUpdate(data.encounter as AdminEncounterDefinition);
      setDisableConfirmation(null);
      if (cancelActive === true && activeOccurrences > 0) {
        setNotice(`Encounter disabled. ${activeOccurrences} active challenge${activeOccurrences === 1 ? '' : 's'} cancelled.`);
      } else {
        setNotice(`Disabled ${encounter.name}`);
      }
    } catch (err) {
      setDisableConfirmation(null);
      setError(err instanceof Error ? err.message : 'Failed to disable encounter');
    } finally {
      setBusyId(null);
    }
  };

  const resolveDisableConfirmation = (cancelActive: boolean) => {
    if (!disableConfirmation) return;
    void disableEncounter(disableConfirmation.encounter, cancelActive, disableConfirmation.activeOccurrences);
  };

  if (unauthorized) {
    return (
      <section className="admin-encounters">
        <div className="admin-section-heading">
          <div>
            <h2>Personal Encounters</h2>
            <p>Create, tune, and enable personal challenge encounters.</p>
          </div>
        </div>
        <div className="admin-error" role="alert">
          <p>{unauthorized.message}</p>
          <a className="admin-btn admin-btn-secondary" href={unauthorized.redirect}>Continue</a>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="admin-encounters" ref={sectionRef}>
        <div className="admin-section-heading">
          <div>
            <h2>Personal Encounters</h2>
            <p>Create, tune, and enable personal challenge encounters. New encounters start disabled.</p>
          </div>
          <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
            <i className="fas fa-plus" aria-hidden="true"></i> New Encounter
          </button>
        </div>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        {error && (
          <div className="admin-error" role="alert">
            <p>{error}</p>
            <button type="button" className="admin-error__btn" onClick={() => void fetchEncounters()}>
              <i className="fas fa-redo" aria-hidden="true"></i> Retry
            </button>
          </div>
        )}

        {(showCreate || editingId !== null) && (
          <form className="admin-panel admin-encounter-form" onSubmit={submitForm}>
            <h3>{editingId !== null ? 'Edit Encounter' : 'Create Encounter'}</h3>
            <EncounterFields
              idPrefix={editingId !== null ? `edit-encounter-${editingId}` : 'create-encounter'}
              form={form}
              errors={fieldErrors}
              update={updateForm}
            />
            {formError && <div className="admin-error" role="alert"><p>{formError}</p></div>}
            <div className="admin-encounter-form__actions">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editingId !== null ? 'Save Encounter' : 'Create Encounter'}
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={cancelForm} disabled={saving}>
                Cancel
              </button>
            </div>
        </form>
      )}

        {loading ? (
          <div className="admin-loading" role="status">
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading encounters...
          </div>
        ) : encounters.length === 0 ? (
          <div className="admin-panel admin-encounters-empty">
            <i className="fas fa-compass" aria-hidden="true"></i>
            <p>No personal encounters yet.</p>
            <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
              <i className="fas fa-plus" aria-hidden="true"></i> New Encounter
            </button>
          </div>
        ) : (
          <div className="admin-panel admin-encounters-panel">
            <div className="admin-encounters-table-wrap">
              <table className="admin-encounters-table">
                <thead>
                  <tr>
                    <th scope="col">Encounter</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Badge</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {encounters.map((encounter) => (
                    <tr key={encounter.id} className="admin-encounters-row">
                      <td>
                        <span className="admin-encounters-name">{encounter.name}</span>
                        <span className="admin-encounters-slug">{encounter.slug}</span>
                      </td>
                      <td>{encounter.duration_days} day{encounter.duration_days === 1 ? '' : 's'}</td>
                      <td className="admin-encounters-badge">{badgeLabel(encounter)}</td>
                      <td>
                        <span className={`admin-badge ${encounter.enabled ? 'admin-badge--success' : 'admin-badge--neutral'}`}>
                          {encounter.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <div className="admin-encounters-actions">
                          <button
                            type="button"
                            className="admin-btn admin-btn-secondary"
                            onClick={() => startEdit(encounter)}
                            disabled={busyId === encounter.id}
                          >
                            Edit
                          </button>
                          {encounter.enabled ? (
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger"
                              onClick={() => void disableEncounter(encounter)}
                              disabled={busyId === encounter.id}
                            >
                              {busyId === encounter.id ? 'Disabling…' : 'Disable'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-btn admin-btn-primary"
                              onClick={() => void enableEncounter(encounter)}
                              disabled={busyId === encounter.id}
                            >
                              {busyId === encounter.id ? 'Enabling…' : 'Enable'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {disableConfirmation && (
        <div
          className="admin-encounters-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Disable encounter"
          tabIndex={-1}
          ref={dialogRef}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDisableConfirmation(null);
          }}
        >
          <div className="admin-encounters-modal__content">
            <h3>Disable {disableConfirmation.encounter.name}</h3>
            <p>
              {disableConfirmation.activeOccurrences} user{disableConfirmation.activeOccurrences === 1 ? ' has' : 's have'} active
              {' '}challenge{disableConfirmation.activeOccurrences === 1 ? '' : 's'} for this encounter. What would you like to do?
            </p>
            <div className="admin-encounters-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => resolveDisableConfirmation(false)}
                disabled={busyId === disableConfirmation.encounter.id}
                ref={keepActiveRef}
              >
                Keep active challenges
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => resolveDisableConfirmation(true)}
                disabled={busyId === disableConfirmation.encounter.id}
              >
                Cancel all active challenges
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setDisableConfirmation(null)}
                disabled={busyId === disableConfirmation.encounter.id}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
