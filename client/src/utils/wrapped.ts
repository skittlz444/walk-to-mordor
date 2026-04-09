import { getAuthHeaders } from './auth';

export interface WrappedMilestone {
  id: number;
  title: string;
  distance: number;
  special: string | null;
  image_id: string | null;
}

export interface FellowshipHighlight {
  party_name: string;
  party_year_km: number;
}

export interface FavoriteMonth {
  month: number;
  name: string;
  total_km: number;
}

export interface WrappedData {
  year: number;
  total_distance_km: number;
  journey_pct: number;
  walk_count: number;
  active_days: number;
  best_streak: number;
  favorite_month: FavoriteMonth | null;
  milestones: WrappedMilestone[];
  fellowship_highlights: FellowshipHighlight[];
  first_walk_date: string | null;
  narrative: string;
}

export async function fetchWrappedStats(year?: number): Promise<WrappedData> {
  const headers = getAuthHeaders();

  if (!headers.Authorization) {
    throw new Error('Not authenticated');
  }

  const params = year ? `?year=${year}` : '';
  const response = await fetch(`/api/stats/wrapped${params}`, { headers });

  if (response.status === 403) {
    throw new Error('Admin access required');
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<WrappedData>;
}
