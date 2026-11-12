import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';

interface AdminCampaignBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

type CampaignRunStatus = 'upcoming' | 'active' | 'completed' | 'expired';

interface AdminCampaignRun {
  id: number;
  campaign_id: number;
  run_number: number;
  target_distance: number;
  start_date: string;
  end_date: string;
  status: CampaignRunStatus;
  completed_at: string | null;
  announced_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
  created_at: string;
  updated_at: string;
}

interface AdminCampaign {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: AdminCampaignBadge | null;
  badge_name: string | null;
  activeRun: AdminCampaignRun | null;
  latestRun: AdminCampaignRun | null;
  activeParticipantCount: number;
  runs?: AdminCampaignRun[];
}

interface CampaignFormState {
  slug: string;
  name: string;
  description: string;
  imageSlug: string;
  badgeSlug: string;
  badgeName: string;
  badgeDescription: string;
  badgeImageSlug: string;
  repeatable: boolean;
  rankThresholds: string;
  targetDistance: string;
  startDate: string;
  endDate: string;
}

interface RetriggerFormState {
  targetDistance: string;
  startDate: string;
  endDate: string;
}

interface RetriggerState {
  campaign: AdminCampaign;
  form: RetriggerFormState;
  fieldErrors: FieldErrors;
  formError: string | null;
}

type FieldErrors = Record<string, string>;

type UpdateForm = <K extends keyof CampaignFormState>(key: K, value: CampaignFormState[K]) => void;

interface DisableConfirmation {
  campaign: AdminCampaign;
  activeParticipants: number;
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

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Single source of truth for how each form field maps to the API payload and
 * to the validation error keys returned by the campaign endpoints.
 */
const FIELD_SPECS: Record<keyof CampaignFormState, FormFieldSpec> = {
  slug: { payloadKey: 'slug', errorKey: 'slug', serialize: (value) => (value as string).trim() },
  name: { payloadKey: 'name', errorKey: 'name', serialize: (value) => (value as string).trim() },
  description: {
    payloadKey: 'description',
    errorKey: 'description',
    serialize: (value) => (value as string).trim(),
  },
  imageSlug: {
    payloadKey: 'image_slug',
    errorKey: 'image_slug',
    serialize: (value) => (value as string).trim(),
  },
  badgeSlug: {
    payloadKey: 'badge_slug',
    errorKey: 'badge_slug',
    serialize: (value) => (value as string).trim(),
  },
  badgeName: {
    payloadKey: 'badge_name',
    errorKey: 'badge_name',
    serialize: (value) => (value as string).trim(),
  },
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
  repeatable: { payloadKey: 'repeatable', errorKey: 'repeatable', serialize: (value) => value === true },
  rankThresholds: {
    payloadKey: 'rank_thresholds',
    errorKey: 'rank_thresholds',
    serialize: (value) => parseRankThresholds(value as string),
  },
  targetDistance: {
    payloadKey: 'target_distance',
    errorKey: 'target_distance',
    serialize: (value) => toNumber(value as string),
  },
  startDate: {
    payloadKey: 'start_date',
    errorKey: 'start_date',
    serialize: (value) => (value as string).trim(),
  },
  endDate: {
    payloadKey: 'end_date',
    errorKey: 'end_date',
    serialize: (value) => (value as string).trim(),
  },
};

/** UTC date `offsetDays` from today, as YYYY-MM-DD. */
function utcDateOffset(offsetDays: number): string {
  const date = new Date(Date.now() + offsetDays * 86_400_000);
  return date.toISOString().slice(0, 10);
}

function toNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRankThresholds(value: string): number[] {
  return value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((entry) => Number.isFinite(entry));
}

function readRankThresholds(metadata: string | null): number[] | null {
  if (!metadata) return null;
  try {
    const parsed: unknown = JSON.parse(metadata);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const value = (parsed as Record<string, unknown>).rank_thresholds;
    if (!Array.isArray(value)) return null;
    const numbers = value.filter((entry): entry is number => typeof entry === 'number');
    return numbers.length === value.length ? numbers : null;
  } catch {
    return null;
  }
}

const EMPTY_FORM: CampaignFormState = {
  slug: '',
  name: '',
  description: '',
  imageSlug: '',
  badgeSlug: '',
  badgeName: '',
  badgeDescription: '',
  badgeImageSlug: '',
  repeatable: true,
  rankThresholds: '1, 3, 7, 15',
  targetDistance: '',
  startDate: utcDateOffset(1),
  endDate: utcDateOffset(14),
};

function toFormState(campaign: AdminCampaign): CampaignFormState {
  const run = campaign.activeRun ?? campaign.latestRun;
  const thresholds = readRankThresholds(campaign.badge?.metadata ?? null);
  return {
    slug: campaign.slug,
    name: campaign.name,
    description: campaign.description,
    imageSlug: campaign.image_slug ?? '',
    badgeSlug: campaign.badge_slug ?? '',
    badgeName: campaign.badge_name ?? campaign.badge?.name ?? '',
    badgeDescription: campaign.badge?.description ?? '',
    badgeImageSlug: campaign.badge?.image_slug ?? '',
    repeatable: campaign.badge?.is_repeatable ?? true,
    rankThresholds: thresholds ? thresholds.join(', ') : '1, 3, 7, 15',
    targetDistance: run ? String(run.target_distance) : '',
    startDate: run?.start_date ?? utcDateOffset(1),
    endDate: run?.end_date ?? utcDateOffset(14),
  };
}

function buildPayload(form: CampaignFormState): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of Object.keys(FIELD_SPECS) as Array<keyof CampaignFormState>) {
    const spec = FIELD_SPECS[key];
    if (key === 'rankThresholds' && !form.repeatable) continue;
    payload[spec.payloadKey] = spec.serialize(form[key]);
  }
  return payload;
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

function badgeLabel(campaign: AdminCampaign): string {
  return campaign.badge_name || campaign.badge?.name || campaign.badge_slug || '—';
}

/** Target/start/badge freeze once the current run leaves `upcoming`. */
function runFieldsFrozen(campaign: AdminCampaign): boolean {
  if (campaign.activeRun) return campaign.activeRun.status !== 'upcoming';
  return campaign.latestRun !== null;
}

/** An active run's end date may be extended; a terminal run's may not change. */
function endDateFrozen(campaign: AdminCampaign): boolean {
  return campaign.activeRun === null;
}

function CampaignFields({
  idPrefix,
  form,
  errors,
  update,
  targetFrozen,
  badgeFrozen,
  endFrozen,
  onSuggest,
  suggesting,
}: {
  idPrefix: string;
  form: CampaignFormState;
  errors: FieldErrors;
  update: UpdateForm;
  targetFrozen: boolean;
  badgeFrozen: boolean;
  endFrozen: boolean;
  onSuggest: () => void;
  suggesting: boolean;
}) {
  return (
    <>
      <div className="admin-campaign-form__grid">
        <div className="admin-campaign-field">
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
        <div className="admin-campaign-field">
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
        <div className="admin-campaign-field admin-campaign-form__wide">
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
        <div className="admin-campaign-field">
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
        <div className="admin-campaign-field">
          <label htmlFor={`${idPrefix}-target-distance`}>Target distance (km)</label>
          <input
            id={`${idPrefix}-target-distance`}
            type="number"
            min="0"
            step="0.1"
            value={form.targetDistance}
            disabled={targetFrozen}
            onInput={(e) => update('targetDistance', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.target_distance}
            aria-describedby={errors.target_distance ? `${idPrefix}-target-distance-error` : undefined}
          />
          {errors.target_distance && (
            <span className="field-error" role="alert" id={`${idPrefix}-target-distance-error`}>
              {errors.target_distance}
            </span>
          )}
        </div>
        <div className="admin-campaign-field">
          <label htmlFor={`${idPrefix}-start-date`}>Start date</label>
          <input
            id={`${idPrefix}-start-date`}
            type="date"
            value={form.startDate}
            disabled={targetFrozen}
            onInput={(e) => update('startDate', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.start_date}
            aria-describedby={errors.start_date ? `${idPrefix}-start-date-error` : undefined}
          />
          {errors.start_date && (
            <span className="field-error" role="alert" id={`${idPrefix}-start-date-error`}>{errors.start_date}</span>
          )}
        </div>
        <div className="admin-campaign-field">
          <label htmlFor={`${idPrefix}-end-date`}>End date</label>
          <input
            id={`${idPrefix}-end-date`}
            type="date"
            value={form.endDate}
            disabled={endFrozen}
            onInput={(e) => update('endDate', (e.target as HTMLInputElement).value)}
            aria-invalid={!!errors.end_date}
            aria-describedby={errors.end_date ? `${idPrefix}-end-date-error` : undefined}
          />
          {errors.end_date && (
            <span className="field-error" role="alert" id={`${idPrefix}-end-date-error`}>{errors.end_date}</span>
          )}
        </div>
        <div className="admin-campaign-form__wide admin-campaign-suggestions">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={onSuggest}
            disabled={suggesting || targetFrozen}
          >
            <i className="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
            {suggesting ? 'Calculating…' : 'Get Suggestions'}
          </button>
          <span className="admin-campaign-hint">
            Suggestions use the last 30 days of community walks and a conservative 25% opt-in rate.
          </span>
        </div>
      </div>

      <fieldset className="admin-campaign-badge-fields">
        <legend>Badge definition</legend>
        <p className="admin-campaign-hint">
          Link an existing badge by slug, or fill in the badge metadata to create a community badge on save.
        </p>
        <div className="admin-campaign-form__grid">
          <div className="admin-campaign-field">
            <label htmlFor={`${idPrefix}-badge-slug`}>Badge slug</label>
            <input
              id={`${idPrefix}-badge-slug`}
              type="text"
              maxLength={120}
              value={form.badgeSlug}
              disabled={badgeFrozen}
              onInput={(e) => update('badgeSlug', (e.target as HTMLInputElement).value)}
              aria-invalid={!!errors.badge_slug}
              aria-describedby={errors.badge_slug ? `${idPrefix}-badge-slug-error` : undefined}
            />
            {errors.badge_slug && (
              <span className="field-error" role="alert" id={`${idPrefix}-badge-slug-error`}>{errors.badge_slug}</span>
            )}
          </div>
          <div className="admin-campaign-field">
            <label htmlFor={`${idPrefix}-badge-name`}>Badge name</label>
            <input
              id={`${idPrefix}-badge-name`}
              type="text"
              value={form.badgeName}
              onInput={(e) => update('badgeName', (e.target as HTMLInputElement).value)}
              aria-invalid={!!errors.badge_name}
              aria-describedby={errors.badge_name ? `${idPrefix}-badge-name-error` : undefined}
            />
            {errors.badge_name && (
              <span className="field-error" role="alert" id={`${idPrefix}-badge-name-error`}>{errors.badge_name}</span>
            )}
          </div>
          <div className="admin-campaign-field admin-campaign-form__wide">
            <label htmlFor={`${idPrefix}-badge-description`}>Badge description</label>
            <textarea
              id={`${idPrefix}-badge-description`}
              rows={2}
              value={form.badgeDescription}
              onInput={(e) => update('badgeDescription', (e.target as HTMLTextAreaElement).value)}
              aria-invalid={!!errors.badge_description}
              aria-describedby={errors.badge_description ? `${idPrefix}-badge-description-error` : undefined}
            ></textarea>
            {errors.badge_description && (
              <span className="field-error" role="alert" id={`${idPrefix}-badge-description-error`}>
                {errors.badge_description}
              </span>
            )}
          </div>
          <div className="admin-campaign-field">
            <label htmlFor={`${idPrefix}-badge-image-slug`}>Badge image slug</label>
            <input
              id={`${idPrefix}-badge-image-slug`}
              type="text"
              maxLength={120}
              value={form.badgeImageSlug}
              onInput={(e) => update('badgeImageSlug', (e.target as HTMLInputElement).value)}
              aria-invalid={!!errors.badge_image_slug}
              aria-describedby={errors.badge_image_slug ? `${idPrefix}-badge-image-slug-error` : undefined}
            />
            {errors.badge_image_slug && (
              <span className="field-error" role="alert" id={`${idPrefix}-badge-image-slug-error`}>
                {errors.badge_image_slug}
              </span>
            )}
          </div>
          <label className="admin-campaign-checkbox" htmlFor={`${idPrefix}-repeatable`}>
            <input
              id={`${idPrefix}-repeatable`}
              type="checkbox"
              checked={form.repeatable}
              onChange={(e) => update('repeatable', (e.target as HTMLInputElement).checked)}
            />
            Repeatable badge
          </label>
          {form.repeatable && (
            <div className="admin-campaign-field">
              <label htmlFor={`${idPrefix}-rank-thresholds`}>Rank thresholds</label>
              <input
                id={`${idPrefix}-rank-thresholds`}
                type="text"
                value={form.rankThresholds}
                onInput={(e) => update('rankThresholds', (e.target as HTMLInputElement).value)}
                aria-invalid={!!errors.rank_thresholds}
                aria-describedby={errors.rank_thresholds ? `${idPrefix}-rank-thresholds-error` : undefined}
                placeholder="1, 3, 7, 15"
              />
              {errors.rank_thresholds && (
                <span className="field-error" role="alert" id={`${idPrefix}-rank-thresholds-error`}>
                  {errors.rank_thresholds}
                </span>
              )}
            </div>
          )}
        </div>
      </fieldset>
    </>
  );
}

export function AdminCommunityCampaignsIsland() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unauthorized, setUnauthorized] = useState<UnauthorizedState | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<AdminCampaign | null>(null);
  const [form, setForm] = useState<CampaignFormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [disableConfirmation, setDisableConfirmation] = useState<DisableConfirmation | null>(null);
  const [retrigger, setRetrigger] = useState<RetriggerState | null>(null);
  const [retriggerSaving, setRetriggerSaving] = useState(false);

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

  const fetchCampaigns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/campaigns', { headers: getAuthHeaders() });
      if (handleAuthFailure(res)) return;
      if (!res.ok) throw new Error('Failed to load campaigns');
      const data = await res.json() as { campaigns?: AdminCampaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  }, [handleAuthFailure]);

  useEffect(() => {
    void fetchCampaigns();
  }, [fetchCampaigns]);

  /** Keep the page behind the disable modal inert and trap focus inside it. */
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
    setEditing(null);
    setShowCreate(true);
    setForm(EMPTY_FORM);
    resetFormState();
    setNotice(null);
  };

  const startEdit = (campaign: AdminCampaign) => {
    setShowCreate(false);
    setEditing(campaign);
    setForm(toFormState(campaign));
    resetFormState();
    setNotice(null);
  };

  const cancelForm = () => {
    setShowCreate(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    resetFormState();
  };

  const handleFormFailure = (data: Record<string, unknown>, fallback: string) => {
    const fromApi = readFieldErrors(data);
    if (fromApi) {
      setFieldErrors(fromApi);
      setFormError('Please correct the highlighted fields.');
      return;
    }
    setFormError(errorMessage(data, fallback));
  };

  const fetchSuggestions = async (): Promise<Record<string, unknown> | null> => {
    setSuggesting(true);
    try {
      const res = await fetch('/api/admin/campaigns/suggestions', { headers: getAuthHeaders() });
      if (handleAuthFailure(res)) return null;
      if (!res.ok) throw new Error('Failed to calculate suggestions');
      return await readJson(res);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to calculate suggestions');
      return null;
    } finally {
      setSuggesting(false);
    }
  };

  const applyFormSuggestions = async () => {
    const data = await fetchSuggestions();
    if (!data) return;
    const suggestedTarget = typeof data.suggestedTargetDistance === 'number'
      ? data.suggestedTargetDistance
      : 0;
    const durationDays = typeof data.suggestedDurationDays === 'number'
      ? data.suggestedDurationDays
      : 14;
    const start = utcDateOffset(1);
    const end = utcDateOffset(durationDays);
    const targetFrozen = editing !== null && runFieldsFrozen(editing);
    const endFrozen = editing !== null && endDateFrozen(editing);
    setForm((current) => ({
      ...current,
      targetDistance: targetFrozen ? current.targetDistance : String(suggestedTarget),
      startDate: targetFrozen ? current.startDate : start,
      endDate: endFrozen ? current.endDate : end,
    }));
  };

  const submitForm = async (event: Event) => {
    event.preventDefault();
    const isEdit = editing !== null;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/campaigns/${editing.id}` : '/api/admin/campaigns',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(buildPayload(form)),
        },
      );
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (!res.ok) {
        handleFormFailure(data, isEdit ? 'Failed to save campaign' : 'Failed to create campaign');
        return;
      }
      const saved = data.campaign as AdminCampaign | undefined;
      if (!saved) {
        setFormError(isEdit ? 'Failed to save campaign' : 'Failed to create campaign');
        return;
      }
      setShowCreate(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      resetFormState();
      setNotice(isEdit ? 'Campaign updated' : 'Campaign created');
      await fetchCampaigns(true);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  };

  const applyCampaignUpdate = (campaign: AdminCampaign) => {
    setCampaigns((current) => current.map((item) => (item.id === campaign.id ? campaign : item)));
  };

  const enableCampaign = async (campaign: AdminCampaign) => {
    setBusyId(campaign.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/enable`, {
        method: 'PUT',
        headers: getAuthHeaders(),
      });
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (!res.ok || !data.campaign) {
        throw new Error(errorMessage(data, 'Failed to enable campaign'));
      }
      applyCampaignUpdate(data.campaign as AdminCampaign);
      setNotice(`Enabled ${campaign.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable campaign');
    } finally {
      setBusyId(null);
    }
  };

  const disableCampaign = async (
    campaign: AdminCampaign,
    cancelActive?: boolean,
    activeParticipants = 0,
  ) => {
    setBusyId(campaign.id);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaign.id}/disable`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        ...(cancelActive === undefined ? {} : { body: JSON.stringify({ cancelActive }) }),
      });
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (res.status === 400 && data.requiresConfirmation === true) {
        setDisableConfirmation({
          campaign,
          activeParticipants: typeof data.activeParticipants === 'number' ? data.activeParticipants : 0,
        });
        return;
      }
      if (!res.ok || !data.campaign) {
        throw new Error(errorMessage(data, 'Failed to disable campaign'));
      }
      applyCampaignUpdate(data.campaign as AdminCampaign);
      setDisableConfirmation(null);
      if (cancelActive === true && activeParticipants > 0) {
        setNotice(
          `Campaign disabled. ${activeParticipants} active participant${activeParticipants === 1 ? '' : 's'} cancelled.`,
        );
      } else {
        setNotice(`Disabled ${campaign.name}`);
      }
    } catch (err) {
      setDisableConfirmation(null);
      setError(err instanceof Error ? err.message : 'Failed to disable campaign');
    } finally {
      setBusyId(null);
    }
  };

  const resolveDisableConfirmation = (cancelActive: boolean) => {
    if (!disableConfirmation) return;
    void disableCampaign(
      disableConfirmation.campaign,
      cancelActive,
      disableConfirmation.activeParticipants,
    );
  };

  const openRetrigger = async (campaign: AdminCampaign) => {
    setNotice(null);
    setError(null);
    setFormError(null);
    const data = await fetchSuggestions();
    const suggested = data && typeof data.suggestedTargetDistance === 'number'
      ? data.suggestedTargetDistance
      : 0;
    setRetrigger({
      campaign,
      form: {
        targetDistance: String(Math.max(1, suggested)),
        startDate: utcDateOffset(1),
        endDate: utcDateOffset(14),
      },
      fieldErrors: {},
      formError: null,
    });
  };

  const updateRetrigger = (key: keyof RetriggerFormState, value: string) => {
    setRetrigger((current) => current
      ? { ...current, form: { ...current.form, [key]: value }, fieldErrors: {} }
      : current);
  };

  const submitRetrigger = async (event: Event) => {
    event.preventDefault();
    if (!retrigger) return;
    setRetriggerSaving(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${retrigger.campaign.id}/retrigger`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          target_distance: toNumber(retrigger.form.targetDistance),
          start_date: retrigger.form.startDate,
          end_date: retrigger.form.endDate,
        }),
      });
      if (handleAuthFailure(res)) return;
      const data = await readJson(res);
      if (!res.ok) {
        const fromApi = readFieldErrors(data);
        if (fromApi) {
          setRetrigger((current) => current
            ? { ...current, fieldErrors: fromApi, formError: 'Please correct the highlighted fields.' }
            : current);
        } else {
          setRetrigger((current) => current
            ? { ...current, formError: errorMessage(data, 'Failed to re-trigger the campaign') }
            : current);
        }
        return;
      }
      setRetrigger(null);
      const completedRound = (data.run as AdminCampaignRun | undefined)?.run_number;
      setNotice(completedRound === undefined
        ? 'Re-triggered campaign'
        : `Re-triggered campaign — round ${completedRound}`);
      await fetchCampaigns(true);
    } catch (err) {
      setRetrigger((current) => current
        ? { ...current, formError: err instanceof Error ? err.message : 'Failed to re-trigger the campaign' }
        : current);
    } finally {
      setRetriggerSaving(false);
    }
  };

  if (unauthorized) {
    return (
      <section className="admin-campaigns">
        <div className="admin-section-heading">
          <div>
            <h2>Community Campaigns</h2>
            <p>Create and manage shared community walking campaigns.</p>
          </div>
        </div>
        <div className="admin-error" role="alert">
          <p>{unauthorized.message}</p>
          <a className="admin-btn admin-btn-secondary" href={unauthorized.redirect}>Continue</a>
        </div>
      </section>
    );
  }

  const editingFrozen = editing !== null && runFieldsFrozen(editing);
  const editingEndFrozen = editing !== null && endDateFrozen(editing);

  return (
    <>
      <section className="admin-campaigns" ref={sectionRef}>
        <div className="admin-section-heading">
          <div>
            <h2>Community Campaigns</h2>
            <p>Create, tune, and enable shared community campaigns. New campaigns start disabled.</p>
          </div>
          <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
            <i className="fas fa-plus" aria-hidden="true"></i> New Campaign
          </button>
        </div>

        {notice && <div className="admin-notice" role="status">{notice}</div>}

        {error && (
          <div className="admin-error" role="alert">
            <p>{error}</p>
            <button type="button" className="admin-error__btn" onClick={() => void fetchCampaigns()}>
              <i className="fas fa-redo" aria-hidden="true"></i> Retry
            </button>
          </div>
        )}

        {(showCreate || editing !== null) && (
          <form className="admin-panel admin-campaign-form" onSubmit={submitForm}>
            <h3>{editing !== null ? 'Edit Campaign' : 'Create Campaign'}</h3>
            <CampaignFields
              idPrefix={editing !== null ? `edit-campaign-${editing.id}` : 'create-campaign'}
              form={form}
              errors={fieldErrors}
              update={updateForm}
              targetFrozen={editingFrozen}
              badgeFrozen={editingFrozen}
              endFrozen={editingEndFrozen}
              onSuggest={() => void applyFormSuggestions()}
              suggesting={suggesting}
            />
            {formError && <div className="admin-error" role="alert"><p>{formError}</p></div>}
            <div className="admin-campaign-form__actions">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
                {saving ? 'Saving…' : editing !== null ? 'Save Campaign' : 'Create Campaign'}
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={cancelForm} disabled={saving}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="admin-loading" role="status">
            <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="admin-panel admin-campaigns-empty">
            <i className="fas fa-scroll" aria-hidden="true"></i>
            <p>No community campaigns yet.</p>
            <button type="button" className="admin-btn admin-btn-primary" onClick={startCreate}>
              <i className="fas fa-plus" aria-hidden="true"></i> New Campaign
            </button>
          </div>
        ) : (
          <div className="admin-panel admin-campaigns-panel">
            <div className="admin-campaigns-table-wrap">
              <table className="admin-campaigns-table">
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col">Current window</th>
                    <th scope="col">Badge</th>
                    <th scope="col">Participants</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((campaign) => {
                    const run = campaign.activeRun ?? campaign.latestRun;
                    const canRetrigger = campaign.enabled
                      && campaign.latestRun !== null
                      && (campaign.latestRun.status === 'completed'
                        || campaign.latestRun.status === 'expired');
                    return (
                      <tr key={campaign.id} className="admin-campaigns-row">
                        <td>
                          <span className="admin-campaigns-name">{campaign.name}</span>
                          <span className="admin-campaigns-slug">{campaign.slug}</span>
                        </td>
                        <td>
                          {run ? (
                            <span className="admin-campaigns-run">
                              <span className="admin-campaigns-run__label">Round {run.run_number}</span>
                              <span>{run.target_distance} km</span>
                              <span className="admin-campaigns-run__dates">
                                {run.start_date} – {run.end_date}
                              </span>
                              <span className={`admin-badge admin-campaigns-status--${run.status}`}>
                                {run.status}
                              </span>
                            </span>
                          ) : (
                            <span className="admin-campaigns-run__dates">No window yet</span>
                          )}
                        </td>
                        <td className="admin-campaigns-badge">{badgeLabel(campaign)}</td>
                        <td>{campaign.activeParticipantCount}</td>
                        <td>
                          <span className={`admin-badge ${campaign.enabled ? 'admin-badge--success' : 'admin-badge--neutral'}`}>
                            {campaign.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <div className="admin-campaigns-actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn-secondary"
                              onClick={() => startEdit(campaign)}
                              disabled={busyId === campaign.id}
                            >
                              Edit
                            </button>
                            {campaign.enabled ? (
                              <button
                                type="button"
                                className="admin-btn admin-btn-danger"
                                onClick={() => void disableCampaign(campaign)}
                                disabled={busyId === campaign.id}
                              >
                                {busyId === campaign.id ? 'Disabling…' : 'Disable'}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="admin-btn admin-btn-primary"
                                onClick={() => void enableCampaign(campaign)}
                                disabled={busyId === campaign.id}
                              >
                                {busyId === campaign.id ? 'Enabling…' : 'Enable'}
                              </button>
                            )}
                            {canRetrigger && (
                              <button
                                type="button"
                                className="admin-btn admin-btn-secondary"
                                onClick={() => void openRetrigger(campaign)}
                                disabled={busyId === campaign.id}
                              >
                                Re-trigger campaign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {disableConfirmation && (
        <div
          className="admin-campaigns-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Disable campaign"
          tabIndex={-1}
          ref={dialogRef}
          onClick={(event) => {
            if (event.target === event.currentTarget) setDisableConfirmation(null);
          }}
        >
          <div className="admin-campaigns-modal__content">
            <h3>Disable {disableConfirmation.campaign.name}</h3>
            <p>
              {disableConfirmation.activeParticipants} participant
              {disableConfirmation.activeParticipants === 1 ? ' is' : 's are'} active in this campaign.
              Choose whether to leave them active or cancel their participation. Ledger history and
              earned badges are always kept.
            </p>
            <div className="admin-campaigns-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => resolveDisableConfirmation(false)}
                disabled={busyId === disableConfirmation.campaign.id}
                ref={keepActiveRef}
              >
                Leave active
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-danger"
                onClick={() => resolveDisableConfirmation(true)}
                disabled={busyId === disableConfirmation.campaign.id}
              >
                Cancel all
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setDisableConfirmation(null)}
                disabled={busyId === disableConfirmation.campaign.id}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {retrigger && (
        <div
          className="admin-campaigns-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Re-trigger campaign"
          onClick={(event) => {
            if (event.target === event.currentTarget && !retriggerSaving) setRetrigger(null);
          }}
        >
          <form
            className="admin-panel admin-campaign-form admin-campaigns-modal__content"
            onSubmit={submitRetrigger}
          >
            <h3>Re-trigger campaign: {retrigger.campaign.name}</h3>
            <p className="admin-campaign-hint">
              The new round starts with zero participants and zero progress. Past rounds,
              participant history, and earned badges are kept.
            </p>
            <div className="admin-campaign-form__grid">
              <div className="admin-campaign-field">
                <label htmlFor="retrigger-target-distance">Target distance (km)</label>
                <input
                  id="retrigger-target-distance"
                  type="number"
                  min="1"
                  step="0.1"
                  value={retrigger.form.targetDistance}
                  onInput={(e) => updateRetrigger('targetDistance', (e.target as HTMLInputElement).value)}
                  aria-invalid={!!retrigger.fieldErrors.target_distance}
                />
                {retrigger.fieldErrors.target_distance && (
                  <span className="field-error" role="alert">{retrigger.fieldErrors.target_distance}</span>
                )}
              </div>
              <div className="admin-campaign-field">
                <label htmlFor="retrigger-start-date">Start date</label>
                <input
                  id="retrigger-start-date"
                  type="date"
                  value={retrigger.form.startDate}
                  onInput={(e) => updateRetrigger('startDate', (e.target as HTMLInputElement).value)}
                  aria-invalid={!!retrigger.fieldErrors.start_date}
                />
                {retrigger.fieldErrors.start_date && (
                  <span className="field-error" role="alert">{retrigger.fieldErrors.start_date}</span>
                )}
              </div>
              <div className="admin-campaign-field">
                <label htmlFor="retrigger-end-date">End date</label>
                <input
                  id="retrigger-end-date"
                  type="date"
                  value={retrigger.form.endDate}
                  onInput={(e) => updateRetrigger('endDate', (e.target as HTMLInputElement).value)}
                  aria-invalid={!!retrigger.fieldErrors.end_date}
                />
                {retrigger.fieldErrors.end_date && (
                  <span className="field-error" role="alert">{retrigger.fieldErrors.end_date}</span>
                )}
              </div>
            </div>
            {retrigger.formError && (
              <div className="admin-error" role="alert"><p>{retrigger.formError}</p></div>
            )}
            <div className="admin-campaign-form__actions">
              <button type="submit" className="admin-btn admin-btn-primary" disabled={retriggerSaving}>
                {retriggerSaving ? 'Re-triggering…' : 'Re-trigger campaign'}
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => setRetrigger(null)}
                disabled={retriggerSaving}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
