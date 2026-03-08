import { useCallback, useEffect, useState } from 'preact/hooks';

interface UserRow {
  id: number;
  username: string;
  email: string;
  email_verified: boolean;
  is_admin: boolean;
  total_distance_km: number;
  last_active_date: string | null;
  fellowship_names: string[];
}

interface UsersListResponse {
  users: UserRow[];
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

function formatLastActive(date: string | null): string {
  if (!date) return 'No walks yet';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}

function formatDistance(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function AdminUsersListIsland() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const loadUsers = useCallback(async (nextPage: number, nextSearch: string) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
      });
      if (nextSearch) {
        params.set('search', nextSearch);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
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
        throw new Error('Failed to load users');
      }

      const data: UsersListResponse = await res.json();
      setUsers(data.users);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setPage(data.page);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    loadUsers(page, search);
  }, [loadUsers, page, search]);

  const runUserAction = useCallback(async (
    user: UserRow,
    action: 'verify' | 'reset' | 'admin' | 'delete',
    init: RequestInit,
    successMessage: string,
  ) => {
    setActiveAction(`${action}-${user.id}`);
    setNotice(null);
    setError(null);

    try {
      const actionPath = action === 'delete'
        ? `/api/admin/users/${user.id}`
        : `/api/admin/users/${user.id}/${action === 'admin' ? 'admin' : action}`;
      const res = await fetch(actionPath, {
        ...init,
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
        const response = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(
          typeof response.error === 'string' ? response.error : 'Request failed'
        );
      }

      setNotice(successMessage);
      await loadUsers(page, search);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Request failed');
    } finally {
      setActiveAction(null);
    }
  }, [loadUsers, page, search]);

  const handleDelete = useCallback(async (user: UserRow) => {
    const confirmation = window.prompt(
      `Type ${user.username} to permanently delete this account and its progress.`
    );
    if (confirmation === null) return;

    await runUserAction(user, 'delete', {
      method: 'DELETE',
      body: JSON.stringify({ confirmation }),
    }, `${user.username} has been deleted.`);
  }, [runUserAction]);

  if (loading && users.length === 0) {
    return (
      <section className="admin-users">
        <div className="admin-section-heading">
          <div>
            <h2>User Support Hub</h2>
            <p>Loading account health, fellowship membership, and journey activity…</p>
          </div>
        </div>
        <div className="admin-goals-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Role</th>
                <th>Journey</th>
                <th>Fellowship</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((row) => (
                <tr key={row} className="admin-goals-row admin-goals-row--skeleton">
                  <td><span className="skeleton-text skeleton-text--wide">Loading user…</span></td>
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text">—</span></td>
                  <td><span className="skeleton-text">—</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-users">
      <div className="admin-section-heading">
        <div>
          <h2>User Support Hub</h2>
          <p>Help walkers recover access, verify email, and keep the fellowship moving.</p>
        </div>
        <form
          className="admin-users-search"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
        >
          <input
            type="search"
            value={searchInput}
            onInput={(event) => setSearchInput((event.target as HTMLInputElement).value)}
            placeholder="Search by username, email, or fellowship"
            aria-label="Search users"
          />
          <button type="submit" className="admin-btn admin-btn-secondary">Search</button>
        </form>
      </div>

      <div className="admin-users-toolbar">
        <span className="admin-goals-info__count">{total} user{total !== 1 ? 's' : ''}</span>
        {notice ? <p className="admin-users-notice" role="status">{notice}</p> : null}
      </div>

      {error ? (
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <button type="button" className="admin-error__btn" onClick={() => loadUsers(page, search)}>
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      ) : null}

      {!loading && users.length === 0 ? (
        <div className="admin-goals-empty">
          <i className="fas fa-users" aria-hidden="true"></i>
          <p>{search ? 'No users match your search.' : 'No users found.'}</p>
        </div>
      ) : (
        <div className="admin-goals-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th scope="col">User Details</th>
                <th scope="col">Status</th>
                <th scope="col">Role</th>
                <th scope="col">Journey Stats</th>
                <th scope="col">Fellowship</th>
                <th scope="col">Support Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="User Details">
                    <div className="admin-user-card">
                      <div className="admin-user-avatar" aria-hidden="true">
                        {user.username.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <strong>{user.username}</strong>
                        <div className="admin-user-email">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Status">
                    <span className={`admin-badge ${user.email_verified ? 'admin-badge--success' : 'admin-badge--warning'}`}>
                      {user.email_verified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td data-label="Role">
                    <span className={`admin-badge ${user.is_admin ? 'admin-badge--gold' : 'admin-badge--neutral'}`}>
                      {user.is_admin ? 'Admin' : 'Walker'}
                    </span>
                  </td>
                  <td data-label="Journey Stats">
                    <div className="admin-user-journey-stat">
                      <strong>{formatDistance(user.total_distance_km)}</strong>
                      <span>
                        {user.last_active_date
                          ? `Last active ${formatLastActive(user.last_active_date)}`
                          : 'No walks yet'}
                      </span>
                    </div>
                  </td>
                  <td data-label="Fellowship">
                    <div className="admin-fellowship-tags">
                      {user.fellowship_names.length > 0
                        ? user.fellowship_names.map((name) => (
                            <span key={name} className="admin-fellowship-tag">
                              <i className="fas fa-users" aria-hidden="true"></i>
                              {name}
                            </span>
                          ))
                        : <span className="admin-fellowship-tag admin-fellowship-tag--solo">Solo trail</span>
                      }
                    </div>
                  </td>
                  <td data-label="Support Actions">
                    <div className="admin-user-actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={user.email_verified || activeAction === `verify-${user.id}`}
                        onClick={() => runUserAction(user, 'verify', { method: 'PUT' }, `${user.username} is now verified.`)}
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={activeAction === `reset-${user.id}`}
                        onClick={() => runUserAction(user, 'reset', { method: 'PUT' }, `Sent a password reset email to ${user.username}.`)}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-secondary"
                        disabled={activeAction === `admin-${user.id}`}
                        onClick={() => runUserAction(
                          user,
                          'admin',
                          { method: 'PUT' },
                          `${user.username} is now ${user.is_admin ? 'a walker' : 'an admin'}.`
                        )}
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        disabled={activeAction === `delete-${user.id}`}
                        onClick={() => handleDelete(user)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
