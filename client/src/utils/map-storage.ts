export const LAST_OPENED_DISTANCE_KEY = 'mapLastOpenedDistanceMiles';

export function readLastOpenedDistanceMiles(storage: Storage): number | null {
  const raw = storage.getItem(LAST_OPENED_DISTANCE_KEY);
  if (raw === null) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function writeLastOpenedDistanceMiles(storage: Storage, distanceMiles: number): void {
  if (!Number.isFinite(distanceMiles)) return;
  storage.setItem(LAST_OPENED_DISTANCE_KEY, String(distanceMiles));
}
