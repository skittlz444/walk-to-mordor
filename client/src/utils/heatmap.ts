import { getAuthHeaders } from './auth';

export interface HeatmapDay {
  date: string;
  distance: number;
}

export interface HeatmapData {
  days: HeatmapDay[];
  currentStreak: number;
  longestStreak: number;
  startDate?: string;
}

export async function fetchHeatmapData(): Promise<HeatmapData> {
  const headers = getAuthHeaders();

  if (!headers.Authorization) {
    throw new Error('Not authenticated');
  }

  const response = await fetch('/api/stats/heatmap', { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<HeatmapData>;
}
