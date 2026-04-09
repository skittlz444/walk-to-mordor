import { getAuthHeaders } from './auth';

export interface FellowshipContrib {
  party_id: number;
  party_name: string;
  contribution_pct: number;
}

export interface ProjectionData {
  title: string;
  distance: number;
  km_to_next?: number;
  days_away: number;
}

export interface WeeklyStatsData {
  has_activity: boolean;
  no_walks_this_week?: boolean;
  this_week_km?: number;
  prev_week_km?: number;
  pace_trend?: 'up' | 'down' | 'same';
  pace_change_pct?: number | null;
  projection?: ProjectionData | null;
  fellowships?: FellowshipContrib[];
}

export async function fetchPalantirWeeklyStats(): Promise<WeeklyStatsData> {
  const headers = getAuthHeaders();

  if (!headers.Authorization) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/stats/weekly', { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<WeeklyStatsData>;
}