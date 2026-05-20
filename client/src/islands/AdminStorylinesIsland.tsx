import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';

interface StorylineSummary {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  path_key: string;
  sort_order: number;
  is_active: boolean;
  admin_only: boolean;
  goal_count: number;
  min_distance: number | null;
  max_distance: number | null;
}

interface StorylineGoal {
  storyline_goal_id: number;
  goal_id: number;
  title: string;
  distance: number;
  sort_order: number;
}

interface StorylinesListResponse {
  storylines: StorylineSummary[];
}

interface StorylineDetailResponse {
  storyline: StorylineSummary;
  goals: StorylineGoal[];
}

interface AdminGoalOption {
  id: number;
  title: string;
  distance: number;
}

interface AdminGoalsListResponse {
  goals: AdminGoalOption[];
  page: number;
  totalPages: number;
}

interface StorylineFormState {
  slug: string;
  title: string;
  description: string;
  pathKey: string;
  sortOrder: number;
  isActive: boolean;
  adminOnly: boolean;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

function toFormState(storyline: StorylineSummary): StorylineFormState {
  return {
    slug: storyline.slug,
    title: storyline.title,
    description: storyline.description ?? '',
    pathKey: storyline.path_key,
    sortOrder: storyline.sort_order,
    isActive: storyline.is_active,
    adminOnly: storyline.admin_only,
  };
}

function getStatusLabel(storyline: StorylineSummary): string {
  if (!storyline.is_active) return 'Hidden';
  return storyline.admin_only ? 'Admin only' : 'Active';
}

function getStatusClass(storyline: StorylineSummary): string {
  if (!storyline.is_active) return 'admin-badge--neutral';
  return storyline.admin_only ? 'admin-badge--warning' : 'admin-badge--success';
}

function formatRange(storyline: StorylineSummary): string {
  if (storyline.min_distance === null || storyline.max_distance === null) {
    return 'No goals';
  }
  return `${storyline.min_distance.toFixed(1)}-${storyline.max_distance.toFixed(1)} km`;
}

export function AdminStorylinesIsland() {
  const [storylines, setStorylines] = useState<StorylineSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<StorylineFormState | null>(null);
  const [goals, setGoals] = useState<StorylineGoal[]>([]);
  const [availableGoals, setAvailableGoals] = useState<AdminGoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingMetadata, setSavingMetadata] = useState(false);
  const [savingGoals, setSavingGoals] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<StorylineFormState>({
    slug: '',
    title: '',
    description: '',
    pathKey: 'fellowship',
    sortOrder: 10,
    isActive: true,
    adminOnly: false,
  });
  const [copyFromStorylineId, setCopyFromStorylineId] = useState<number | null>(null);

  const fetchStorylines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/storylines', { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) { window.location.href = '/login'; return; }
        if (res.status === 403) { window.location.href = '/journey'; return; }
        throw new Error('Failed to load storylines');
      }
      const data: StorylinesListResponse = await res.json();
      setStorylines(data.storylines);
      setCopyFromStorylineId(data.storylines[0]?.id ?? null);
      setSelectedId((current) => current ?? data.storylines[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storylines');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDetail = useCallback(async (storylineId: number) => {
    setDetailLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/storylines/${storylineId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to load storyline details');
      const data: StorylineDetailResponse = await res.json();
      setForm(toFormState(data.storyline));
      setGoals(data.goals);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storyline details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const fetchAvailableGoals = useCallback(async () => {
    setLoadingGoals(true);
    try {
      const allGoals: AdminGoalOption[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        const res = await fetch(`/api/admin/goals?page=${page}&pageSize=100`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error('Failed to load available goals');
        const data: AdminGoalsListResponse = await res.json();
        allGoals.push(...data.goals);
        totalPages = data.totalPages;
        page += 1;
      } while (page <= totalPages);

      setAvailableGoals(allGoals);
      setSelectedGoalId((current) => current ?? allGoals[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load available goals');
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  useEffect(() => {
    void fetchStorylines();
    void fetchAvailableGoals();
  }, [fetchAvailableGoals, fetchStorylines]);

  useEffect(() => {
    if (selectedId !== null) {
      void fetchDetail(selectedId);
    }
  }, [fetchDetail, selectedId]);

  const selectedStoryline = storylines.find((storyline) => storyline.id === selectedId) ?? null;
  const addableGoals = useMemo(() => {
    const mappedGoalIds = new Set(goals.map((goal) => goal.goal_id));
    return availableGoals.filter((goal) => !mappedGoalIds.has(goal.id));
  }, [availableGoals, goals]);

  useEffect(() => {
    setSelectedGoalId((current) => current !== null && addableGoals.some((goal) => goal.id === current)
      ? current
      : addableGoals[0]?.id ?? null);
  }, [addableGoals]);

  const updateForm = useCallback(<K extends keyof StorylineFormState>(key: K, value: StorylineFormState[K]) => {
    setForm((current) => current ? { ...current, [key]: value } : current);
  }, []);

  const updateCreateForm = useCallback(<K extends keyof StorylineFormState>(key: K, value: StorylineFormState[K]) => {
    setCreateForm((current) => ({ ...current, [key]: value }));
  }, []);

  const handleCreate = useCallback(async (e: Event) => {
    e.preventDefault();
    setSavingMetadata(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/storylines', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...createForm, copyFromStorylineId }),
      });
      const data = await res.json() as { storyline?: StorylineSummary; error?: string };
      if (!res.ok || !data.storyline) throw new Error(data.error || 'Failed to create storyline');
      setNotice('Storyline created');
      setShowCreate(false);
      setCreateForm({ slug: '', title: '', description: '', pathKey: 'fellowship', sortOrder: 10, isActive: true, adminOnly: false });
      setSelectedId(data.storyline.id);
      await fetchStorylines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create storyline');
    } finally {
      setSavingMetadata(false);
    }
  }, [copyFromStorylineId, createForm, fetchStorylines]);

  const handleSaveMetadata = useCallback(async (e: Event) => {
    e.preventDefault();
    if (!selectedId || !form) return;
    setSavingMetadata(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/storylines/${selectedId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(form),
      });
      const data = await res.json() as { storyline?: StorylineSummary; error?: string };
      if (!res.ok || !data.storyline) throw new Error(data.error || 'Failed to save storyline');
      setNotice('Storyline saved');
      await fetchStorylines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save storyline');
    } finally {
      setSavingMetadata(false);
    }
  }, [fetchStorylines, form, selectedId]);

  const handleSaveGoals = useCallback(async () => {
    if (!selectedId) return;
    setSavingGoals(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/storylines/${selectedId}/goals`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          goals: goals.map((goal) => ({
            goalId: goal.goal_id,
            distance: goal.distance,
            sortOrder: goal.sort_order,
          })),
        }),
      });
      const data = await res.json() as StorylineDetailResponse | { error?: string };
      if (!res.ok || !('storyline' in data)) throw new Error('error' in data && data.error ? data.error : 'Failed to save distances');
      setNotice('Goal distances saved');
      setForm(toFormState(data.storyline));
      setGoals(data.goals);
      await fetchStorylines();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save distances');
    } finally {
      setSavingGoals(false);
    }
  }, [fetchStorylines, goals, selectedId]);

  const handleAddGoal = useCallback(() => {
    if (selectedGoalId === null) return;
    const goalToAdd = availableGoals.find((goal) => goal.id === selectedGoalId);
    if (!goalToAdd) return;

    setGoals((current) => {
      if (current.some((goal) => goal.goal_id === goalToAdd.id)) return current;
      const nextSortOrder = current.reduce((maxSortOrder, goal) => Math.max(maxSortOrder, goal.sort_order), 0) + 1;
      return [
        ...current,
        {
          // Negative sentinel: no real storyline_goal_id yet — will be assigned on save.
          // handleSaveGoals only sends goal_id/distance/sortOrder, so the sentinel is never sent to the API.
          storyline_goal_id: -goalToAdd.id,
          goal_id: goalToAdd.id,
          title: goalToAdd.title,
          distance: goalToAdd.distance,
          sort_order: nextSortOrder,
        },
      ].sort((a, b) => a.distance - b.distance || a.sort_order - b.sort_order || a.goal_id - b.goal_id);
    });
    setSelectedGoalId(null);
  }, [availableGoals, selectedGoalId]);

  const handleRemoveGoal = useCallback((goalId: number) => {
    setGoals((current) => current.filter((goal) => goal.goal_id !== goalId));
  }, []);

  if (loading && storylines.length === 0) {
    return <div className="admin-loading"><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading storylines...</div>;
  }

  return (
    <div className="admin-storylines">
      <div className="admin-section-heading">
        <div>
          <h2>Storylines</h2>
          <p>Manage route metadata and milestone distances for each journey.</p>
        </div>
        <button type="button" className="admin-btn admin-btn-primary" onClick={() => setShowCreate((value) => !value)}>
          <i className="fas fa-plus" aria-hidden="true"></i> New Storyline
        </button>
      </div>

      {notice && <div className="admin-notice" role="status">{notice}</div>}
      {error && <div className="admin-error" role="alert"><p>{error}</p></div>}

      {showCreate && (
        <form className="admin-storyline-panel admin-storyline-form" onSubmit={handleCreate}>
          <h3>Create Storyline</h3>
          <div className="admin-storyline-form__grid">
            <label>Slug<input value={createForm.slug} onInput={(e) => updateCreateForm('slug', (e.target as HTMLInputElement).value)} required /></label>
            <label>Title<input value={createForm.title} onInput={(e) => updateCreateForm('title', (e.target as HTMLInputElement).value)} required /></label>
            <label>Path Key<input value={createForm.pathKey} onInput={(e) => updateCreateForm('pathKey', (e.target as HTMLInputElement).value)} required /></label>
            <label>Sort Order<input type="number" value={createForm.sortOrder} onInput={(e) => updateCreateForm('sortOrder', Number((e.target as HTMLInputElement).value))} /></label>
            <label className="admin-storyline-form__wide">Description<textarea value={createForm.description} onInput={(e) => updateCreateForm('description', (e.target as HTMLTextAreaElement).value)} rows={3}></textarea></label>
            <label>Copy Goals From<select value={copyFromStorylineId ?? ''} onChange={(e) => setCopyFromStorylineId(Number((e.target as HTMLSelectElement).value) || null)}>
              <option value="">No goals</option>
              {storylines.map((storyline) => <option key={storyline.id} value={storyline.id}>{storyline.title}</option>)}
            </select></label>
            <label className="admin-storyline-checkbox"><input type="checkbox" checked={createForm.isActive} onChange={(e) => updateCreateForm('isActive', (e.target as HTMLInputElement).checked)} /> Active</label>
            <label className="admin-storyline-checkbox"><input type="checkbox" checked={createForm.adminOnly} onChange={(e) => updateCreateForm('adminOnly', (e.target as HTMLInputElement).checked)} /> Admin only</label>
          </div>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={savingMetadata}>Create Storyline</button>
        </form>
      )}

      <div className="admin-storylines-grid">
        <div className="admin-goals-table-wrap">
          <table className="admin-goals-table" role="grid">
            <thead>
              <tr>
                <th>Title</th>
                <th>Goals</th>
                <th>Range</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {storylines.map((storyline) => (
                <tr key={storyline.id} className="admin-goals-row" onClick={() => setSelectedId(storyline.id)} tabIndex={0}>
                  <td className="admin-goals-cell--title">{storyline.title}<span className="admin-storyline-slug">{storyline.slug}</span></td>
                  <td>{storyline.goal_count}</td>
                  <td>{formatRange(storyline)}</td>
                  <td><span className={`admin-badge ${getStatusClass(storyline)}`}>{getStatusLabel(storyline)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-storyline-panel">
          {!selectedStoryline || !form ? (
            <p className="admin-storyline-empty">Select a storyline to edit.</p>
          ) : detailLoading ? (
            <div className="admin-loading"><i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading...</div>
          ) : (
            <>
              <form className="admin-storyline-form" onSubmit={handleSaveMetadata}>
                <h3>{selectedStoryline.title}</h3>
                <div className="admin-storyline-form__grid">
                  <label>Slug<input value={form.slug} onInput={(e) => updateForm('slug', (e.target as HTMLInputElement).value)} required /></label>
                  <label>Title<input value={form.title} onInput={(e) => updateForm('title', (e.target as HTMLInputElement).value)} required /></label>
                  <label>Path Key<input value={form.pathKey} onInput={(e) => updateForm('pathKey', (e.target as HTMLInputElement).value)} required /></label>
                  <label>Sort Order<input type="number" value={form.sortOrder} onInput={(e) => updateForm('sortOrder', Number((e.target as HTMLInputElement).value))} /></label>
                  <label className="admin-storyline-form__wide">Description<textarea value={form.description} onInput={(e) => updateForm('description', (e.target as HTMLTextAreaElement).value)} rows={3}></textarea></label>
                  <label className="admin-storyline-checkbox"><input type="checkbox" checked={form.isActive} onChange={(e) => updateForm('isActive', (e.target as HTMLInputElement).checked)} /> Active</label>
                  <label className="admin-storyline-checkbox"><input type="checkbox" checked={form.adminOnly} onChange={(e) => updateForm('adminOnly', (e.target as HTMLInputElement).checked)} /> Admin only</label>
                </div>
                <button type="submit" className="admin-btn admin-btn-primary" disabled={savingMetadata}>Save Metadata</button>
              </form>

              <div className="admin-storyline-goals">
                <div className="admin-panel__header">
                  <div>
                    <h3>Goal Distances</h3>
                    <p>{goals.length} mapped goals</p>
                  </div>
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={handleSaveGoals} disabled={savingGoals}>Save Distances</button>
                </div>
                <div className="admin-storyline-goal-add">
                  <select
                    value={selectedGoalId ?? ''}
                    onChange={(e) => setSelectedGoalId(Number((e.target as HTMLSelectElement).value) || null)}
                    disabled={loadingGoals || addableGoals.length === 0}
                  >
                    <option value="">{loadingGoals ? 'Loading goals...' : 'Select a goal'}</option>
                    {addableGoals.map((goal) => (
                      <option key={goal.id} value={goal.id}>{goal.title} ({goal.distance.toFixed(2)} km)</option>
                    ))}
                  </select>
                  <button type="button" className="admin-btn admin-btn-secondary" onClick={handleAddGoal} disabled={selectedGoalId === null || savingGoals}>Add Goal</button>
                </div>
                <div className="admin-storyline-goal-list">
                  {goals.map((goal, index) => (
                    <div className="admin-storyline-goal-row" key={goal.storyline_goal_id}>
                      <span>{goal.title}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={goal.distance}
                        onInput={(e) => {
                          const distance = Number((e.target as HTMLInputElement).value);
                          setGoals((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, distance } : item));
                        }}
                      />
                      <button type="button" className="admin-btn admin-btn-secondary" onClick={() => handleRemoveGoal(goal.goal_id)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
