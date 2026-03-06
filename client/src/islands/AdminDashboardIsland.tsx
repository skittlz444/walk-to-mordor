import { useState, useEffect, useCallback } from 'preact/hooks';

interface DashboardStats {
  totalUsers: number;
  totalDistanceKm: number;
  activeParties: number;
  totalGoals: number;
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

export function AdminDashboardIsland() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/dashboard', { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login';
          return;
        }
        if (res.status === 403) {
          window.location.href = '/journey';
          return;
        }
        throw new Error('Failed to load dashboard statistics');
      }
      const data: DashboardStats = await res.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading) {
    return (
      <div className="admin-dashboard">
        <h2>System Overview</h2>
        <div className="admin-stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="admin-stat-card admin-stat-card--skeleton">
              <div className="admin-stat-card__icon" aria-hidden="true"></div>
              <div className="admin-stat-card__value">—</div>
              <div className="admin-stat-card__label">Loading</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <h2>System Overview</h2>
        <div className="admin-error" role="alert">
          <p>{error}</p>
          <button type="button" className="admin-error__btn" onClick={fetchStats}>
            <i className="fas fa-redo" aria-hidden="true"></i> Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      icon: 'fas fa-users',
      iconClass: 'admin-stat-card__icon--users',
      value: stats.totalUsers.toLocaleString(),
      label: 'Registered Users',
    },
    {
      icon: 'fas fa-route',
      iconClass: 'admin-stat-card__icon--distance',
      value: `${stats.totalDistanceKm.toLocaleString()} km`,
      label: 'Total Distance',
    },
    {
      icon: 'fas fa-people-group',
      iconClass: 'admin-stat-card__icon--parties',
      value: stats.activeParties.toLocaleString(),
      label: 'Active Fellowships',
    },
    {
      icon: 'fas fa-flag-checkered',
      iconClass: 'admin-stat-card__icon--goals',
      value: stats.totalGoals.toLocaleString(),
      label: 'Total Goals',
    },
  ];

  return (
    <div className="admin-dashboard">
      <h2>System Overview</h2>
      <div className="admin-stats-grid" role="region" aria-label="System statistics">
        {statCards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <div className={`admin-stat-card__icon ${card.iconClass}`} aria-hidden="true">
              <i className={card.icon}></i>
            </div>
            <div className="admin-stat-card__value">{card.value}</div>
            <div className="admin-stat-card__label">{card.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
