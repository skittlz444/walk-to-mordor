import { renderLayout } from './renderLayout';

function renderMapPage() {
  return renderLayout({
    title: 'Walk to Mordor - Middle Earth',
    description: 'Explore your journey across Middle-earth',
    stylesheets: ['/css/map.css', '/css/calendar.css', '/css/progress.css'],
    scripts: ['/js/calendar.js', '/js/progress.js'],  // Required for MapWalkIsland FAB
    inlineStyles: `          body.map-page { opacity: 0; transition: opacity 0.15s ease; }
          body.map-page.authenticated { opacity: 1; }`,
    bodyClass: 'map-page',
    headerClass: 'map-header',
    headerContent: '<h1>Middle Earth</h1>',
    mainClass: 'map-main',
    mainContent: '<div class="map-shell" data-island="MapIsland"></div>',
  });
}

export async function handleMapPage(request: Request, env: any): Promise<Response> {
  return new Response(renderMapPage(), {
    headers: {
      'content-type': 'text/html',
    },
  });
}
