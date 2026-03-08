import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface GoalRow {
  id: number;
  title: string;
  distance: number;
  description: string | null;
  special: string | null;
  image_id: string | null;
  has_image: boolean;
}

interface GoalsListResponse {
  goals: GoalRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function AdminGoalsListIsland() {
  const [goals, setGoals] = useState<GoalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const fetchGoals = useCallback(async (p: number, s: string, order: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(pageSize),
        order,
      });
      if (s) {
        params.set('search', s);
      }
      const res = await fetch(`/api/admin/goals?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (res.status === 403) {
          window.location.href = '/journey';
          return;
        }
        throw new Error('Failed to load goals');
      }
      const data: GoalsListResponse = await res.json();
      setGoals(data.goals);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  // Fetch when page, debouncedSearch, or sortOrder changes
  useEffect(() => {
    fetchGoals(page, debouncedSearch, sortOrder);
  }, [page, debouncedSearch, sortOrder, fetchGoals]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Debounce search input
  const handleSearchChange = useCallback((e: Event) => {
    const value = (e.target as HTMLInputElement).value;
    setSearch(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(value);
    }, 300);
  }, []);

  const toggleSort = useCallback(() => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    setPage(1);
  }, []);

  const handleRowClick = useCallback((goalId: number) => {
    window.location.href = `/admin/goals/${goalId}`;
  }, []);

  if (loading && goals.length === 0) {
    return (
      <div className="admin-goals">
        <h2>Goal Management</h2>
        <div className="admin-goals-toolbar">
          <div className="admin-goals-search">
            <i className="fas fa-search" aria-hidden="true"></i>
            <input
              type="text"
              placeholder="Search goals..."
              disabled
              className="admin-goals-search__input"
            />
          </div>
        </div>
        <div className="admin-goals-table-wrap">
          <table className="admin-goals-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Distance</th>
                <th>Has Image</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5].map((i) => (
                <tr key={i} className="admin-goals-row admin-goals-row--skeleton">
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text skeleton-text--wide">Loading...</span></td>
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text">—</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-goals">
        <h2>Goal Management</h2>
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="admin-error__btn"
            onClick={() => fetchGoals(page, debouncedSearch, sortOrder)}
          >
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-goals">
      <h2>Goal Management</h2>
      <div className="admin-goals-toolbar">
        <div className="admin-goals-search">
          <i className="fas fa-search" aria-hidden="true"></i>
          <input
            type="text"
            placeholder="Search goals..."
            value={search}
            onInput={handleSearchChange}
            className="admin-goals-search__input"
            aria-label="Search goals"
          />
        </div>
        <div className="admin-goals-info">
          <span className="admin-goals-info__count">
            {total} goal{total !== 1 ? 's' : ''}
          </span>
        </div>
        <a href="/admin/goals/new" className="admin-btn admin-btn-primary">
          <i className="fas fa-plus" aria-hidden="true"></i> Add New Goal
        </a>
      </div>

      {goals.length === 0 ? (
        <div className="admin-goals-empty">
          {debouncedSearch ? (
            <>
              <i className="fas fa-search" aria-hidden="true"></i>
              <p>No goals match your search</p>
            </>
          ) : (
            <>
              <i className="fas fa-flag-checkered" aria-hidden="true"></i>
              <p>No goals found</p>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="admin-goals-table-wrap">
            <table className="admin-goals-table" role="grid">
              <thead>
                <tr>
                  <th scope="col" className="admin-goals-table__col-id">ID</th>
                  <th scope="col" className="admin-goals-table__col-title">Title</th>
                  <th
                    scope="col"
                    className="admin-goals-table__col-distance admin-goals-sort"
                    onClick={toggleSort}
                    role="columnheader"
                    aria-sort={sortOrder === 'asc' ? 'ascending' : 'descending'}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSort();
                      }
                    }}
                  >
                    Distance
                    <span className="admin-goals-sort-indicator" aria-hidden="true">
                      {sortOrder === 'asc' ? ' ▲' : ' ▼'}
                    </span>
                  </th>
                  <th scope="col" className="admin-goals-table__col-image">Has Image</th>
                </tr>
              </thead>
              <tbody>
                {goals.map((goal) => (
                  <tr
                    key={goal.id}
                    className="admin-goals-row"
                    onClick={() => handleRowClick(goal.id)}
                    role="row"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleRowClick(goal.id);
                      }
                    }}
                  >
                    <td className="admin-goals-cell--id">{goal.id}</td>
                    <td className="admin-goals-cell--title">{goal.title}</td>
                    <td className="admin-goals-cell--distance">{(goal.distance ?? 0).toFixed(1)} km</td>
                    <td className="admin-goals-cell--image">
                      {goal.has_image ? (
                        <span className="admin-goals-has-image admin-goals-has-image--yes" title="Has image">
                          <i className="fas fa-check" aria-hidden="true"></i>
                          <span className="sr-only">Yes</span>
                        </span>
                      ) : (
                        <span className="admin-goals-has-image admin-goals-has-image--no" title="No image">
                          <i className="fas fa-minus" aria-hidden="true"></i>
                          <span className="sr-only">No</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {loading && (
            <div className="admin-goals-loading-overlay">
              <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading...
            </div>
          )}

          <div className="admin-goals-pagination">
            <button
              type="button"
              className="admin-goals-pagination__btn"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <i className="fas fa-chevron-left" aria-hidden="true"></i> Previous
            </button>
            <span className="admin-goals-pagination__info">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="admin-goals-pagination__btn"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <i className="fas fa-chevron-right" aria-hidden="true"></i>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
