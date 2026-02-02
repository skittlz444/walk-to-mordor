/**
 * Shared Goal type used across components
 */
export interface Goal {
  id: number;
  distance: number;
  title: string;
  special?: string | null;
  description?: string | null;
  image_id?: string | null;
}
