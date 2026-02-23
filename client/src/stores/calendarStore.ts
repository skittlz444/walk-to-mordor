/**
 * Calendar State Management Store
 *
 * Centralized reactive state for the calendar component.
 * Uses Preact Signals for reactive updates.
 */

import { signal } from '@preact/signals';

// ============================================================================
// Types
// ============================================================================

export interface CalendarEvent {
  start: string;
  title: string;
}

export type CalendarView = 'week' | 'month';

// ============================================================================
// Signals
// ============================================================================

export const events = signal<CalendarEvent[]>([]);
export const currentDate = signal<Date>(new Date());
export const currentView = signal<CalendarView>('week');
export const loading = signal<boolean>(false);

// ============================================================================
// Utility Functions
// ============================================================================

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDate(dateStr: string): Date {
  const parts = dateStr.split('-');
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function getDateAtMidnight(date: Date): Date {
  const midnight = new Date(date);
  midnight.setHours(0, 0, 0, 0);
  return midnight;
}

export function getEventForDate(date: Date): CalendarEvent | undefined {
  const dateStr = formatDate(date);
  return events.value.find((ev) => formatDate(new Date(ev.start)) === dateStr);
}

// ============================================================================
// Actions
// ============================================================================

interface CalendarProgressResponse {
  start: string;
  title: string;
}

declare global {
  interface Window {
    getAuthHeaders: () => Record<string, string>;
    fetchAndUpdateTotalDistance?: () => void;
  }
}

export async function fetchEvents(): Promise<void> {
  loading.value = true;
  try {
    const headers = typeof window.getAuthHeaders === 'function'
      ? window.getAuthHeaders()
      : {};
    const res = await fetch('/api/calendar-progress', { headers });
    const fetchedEvents = (await res.json()) as CalendarProgressResponse[];
    events.value = fetchedEvents.map((ev) => ({
      ...ev,
      title: ev.title ? `${ev.title} km` : '',
    }));

    if (typeof window.fetchAndUpdateTotalDistance === 'function') {
      window.fetchAndUpdateTotalDistance();
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.message !== 'Authentication required') {
      console.error('Error updating calendar:', error);
    }
  } finally {
    loading.value = false;
  }
}

export function navigateCalendar(direction: number): void {
  const d = new Date(currentDate.value);
  if (currentView.value === 'week') {
    d.setDate(d.getDate() + direction * 7);
  } else {
    d.setMonth(d.getMonth() + direction);
  }
  currentDate.value = d;
}

export function goToToday(): void {
  currentDate.value = new Date();
}

export function setView(view: CalendarView): void {
  currentView.value = view;
}
