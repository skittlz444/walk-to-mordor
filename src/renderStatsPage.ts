import { renderLayout } from './renderLayout';

export function renderStatsPage(): string {
  return renderLayout({
    title: 'Walk to Mordor – Stats',
    description: 'Weekly insights and walking statistics for your journey to Mordor',
    headerContent: '<h1>Stats</h1>',
    mainContent: '<div data-island="StatsIsland"></div>',
  });
}
