/**
 * Progress/Distance State Management Store
 *
 * Manages the distance-logging modal lifecycle, API calls for CRUD on
 * /api/calendar-progress, and total-distance updates.
 * Uses Preact Signals for reactive state.
 */

import { signal } from '@preact/signals';
import { formatDate } from './calendarStore';
import type { CalendarEvent } from './calendarStore';

// ============================================================================
// Types
// ============================================================================

export interface WalkAction {
  action: 'save' | 'update' | 'delete';
  date: string;
  distance?: number;
}

type WalkSavedCallback = (action: WalkAction) => void;
type DismissCallback = () => void;

// ============================================================================
// Global declarations
// ============================================================================

declare global {
  interface Window {
    getAuthHeaders: () => Record<string, string>;
    updateCalendarAndTotal?: () => Promise<void>;
    goalsModule?: {
      showGoalModal: (
        goal: unknown,
        dist: number,
        isCongratulations?: boolean
      ) => void;
      renderGoals: (dist: number) => void;
      checkForNewlyPassedGoals: (
        previousTotal: number,
        newTotal: number
      ) => Promise<unknown>;
    };
    calendarModule?: {
      events: () => CalendarEvent[];
      setEvents: (newEvents: CalendarEvent[]) => void;
      formatDate: (date: Date) => string;
      [key: string]: unknown;
    };
  }
}

// ============================================================================
// Signals
// ============================================================================

export const isModalOpen = signal<boolean>(false);
export const currentEvent = signal<CalendarEvent | null>(null);
export const currentDate = signal<Date | null>(null);
export const totalDistance = signal<number>(0);

// ============================================================================
// Callback holders
// ============================================================================

let onWalkSavedCallback: WalkSavedCallback | null = null;
let onDismissCallback: DismissCallback | null = null;

export function setOnWalkSaved(callback: WalkSavedCallback): void {
  onWalkSavedCallback = callback;
}

export function setOnDismiss(callback: DismissCallback): void {
  onDismissCallback = callback;
}

// ============================================================================
// Helpers
// ============================================================================

function formatDateWithFallback(date: Date): string {
  if (window.calendarModule?.formatDate) {
    return window.calendarModule.formatDate(date);
  }
  return formatDate(date);
}

function getAuthHeaders(): Record<string, string> {
  return typeof window.getAuthHeaders === 'function'
    ? window.getAuthHeaders()
    : {};
}

function getCurrentEvents(): CalendarEvent[] {
  return window.calendarModule?.events?.() ?? [];
}

function getCurrentTotal(evts: CalendarEvent[]): number {
  return evts.reduce(
    (acc, ev) => acc + Number(ev.title.replace(/\s*km$/, '')),
    0
  );
}

interface GoalLike {
  distance: number;
  [key: string]: unknown;
}

async function checkGoalsAfterChange(
  previousTotal: number,
  projectedNewTotal: number
): Promise<void> {
  if (window.goalsModule?.checkForNewlyPassedGoals) {
    const newlyPassedGoal = (await window.goalsModule.checkForNewlyPassedGoals(
      previousTotal,
      projectedNewTotal
    )) as GoalLike | null;
    if (newlyPassedGoal && window.goalsModule.showGoalModal) {
      setTimeout(
        () =>
          window.goalsModule!.showGoalModal(
            newlyPassedGoal,
            projectedNewTotal,
            true
          ),
        500
      );
    }
  }
}

// ============================================================================
// Actions
// ============================================================================

export function showDistanceModal(
  event: CalendarEvent | undefined | null,
  date: Date | null
): void {
  currentEvent.value = event ?? null;
  currentDate.value = date;
  isModalOpen.value = true;
}

export function closeModal(wasDismissed = true): void {
  isModalOpen.value = false;
  currentEvent.value = null;
  currentDate.value = null;
  if (wasDismissed && onDismissCallback) {
    onDismissCallback();
  }
}

export async function saveDistance(distance: number): Promise<void> {
  if (!currentDate.value) return;

  const selectedDate = formatDateWithFallback(currentDate.value);
  const isEdit = !!currentEvent.value;
  const events = getCurrentEvents();
  const currentTotal = getCurrentTotal(events);

  if (isEdit && currentEvent.value) {
    const oldDistance = Number(
      currentEvent.value.title.replace(/\s*km$/, '')
    );
    const previousTotal = currentTotal - oldDistance;
    const projectedNewTotal = previousTotal + distance;

    currentEvent.value.title = String(distance);

    await fetch('/api/calendar-progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ start: selectedDate, title: String(distance) }),
    });

    if (window.updateCalendarAndTotal) {
      window.updateCalendarAndTotal();
    }

    if (onWalkSavedCallback) {
      onWalkSavedCallback({
        action: 'update',
        date: selectedDate,
        distance,
      });
    }

    await checkGoalsAfterChange(previousTotal, projectedNewTotal);
  } else {
    const projectedNewTotal = currentTotal + distance;

    if (window.calendarModule?.setEvents) {
      const currentEvents = getCurrentEvents();
      currentEvents.push({ start: selectedDate, title: String(distance) });
      window.calendarModule.setEvents(currentEvents);
    }

    await fetch('/api/calendar-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ start: selectedDate, title: String(distance) }),
    });

    if (window.updateCalendarAndTotal) {
      window.updateCalendarAndTotal();
    }

    if (onWalkSavedCallback) {
      onWalkSavedCallback({
        action: 'save',
        date: selectedDate,
        distance,
      });
    }

    await checkGoalsAfterChange(currentTotal, projectedNewTotal);
  }

  closeModal(false);
}

export async function deleteDistance(): Promise<void> {
  if (!currentDate.value) return;

  const selectedDate = formatDateWithFallback(currentDate.value);

  try {
    await fetch('/api/calendar-progress', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ start: selectedDate }),
    });

    if (window.updateCalendarAndTotal) {
      window.updateCalendarAndTotal();
    }

    if (onWalkSavedCallback) {
      onWalkSavedCallback({ action: 'delete', date: selectedDate });
    }
  } catch (error: unknown) {
    console.error('Error deleting progress:', error);
  }

  closeModal(false);
}

export async function fetchTotalDistance(): Promise<void> {
  try {
    const response = await fetch('/api/total-distance', {
      headers: getAuthHeaders(),
    });
    if (response.ok) {
      const data = (await response.json()) as { totalDistance: number };
      totalDistance.value = data.totalDistance;
      const el = document.getElementById('total-distance-value');
      if (el) el.textContent = `${data.totalDistance} km`;
      if (window.goalsModule?.renderGoals) {
        window.goalsModule.renderGoals(data.totalDistance);
      }
    } else if (response.status !== 401) {
      console.error('Failed to fetch total distance:', response.status);
      const el = document.getElementById('total-distance-value');
      if (el) el.textContent = '0 km';
    }
  } catch (error: unknown) {
    console.error('Error fetching total distance:', error);
    const el = document.getElementById('total-distance-value');
    if (el) el.textContent = '0 km';
  }
}
