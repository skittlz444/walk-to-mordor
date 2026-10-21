import { renderPartyListPage } from '../../src/renderPartyListPage';
import { renderPartyDetailPage } from '../../src/renderPartyDetailPage';
import { renderPartyManagePage } from '../../src/renderPartyManagePage';
import { renderPartyJoinPage } from '../../src/renderPartyJoinPage';

interface PartyPageFixture {
  renderer: () => string;
  title: string;
  stylesheet: string;
  mountId: string;
}

const partyPages: PartyPageFixture[] = [
  {
    renderer: renderPartyListPage,
    title: 'Walk to Mordor - Fellowships',
    stylesheet: '/css/party.css',
    mountId: 'PartyListIsland',
  },
  {
    renderer: renderPartyDetailPage,
    title: 'Walk to Mordor - Fellowship',
    stylesheet: '/css/party.css',
    mountId: 'PartyDetailIsland',
  },
  {
    renderer: renderPartyManagePage,
    title: 'Walk to Mordor - Manage Fellowship',
    stylesheet: '/css/party.css',
    mountId: 'PartyManageIsland',
  },
  {
    renderer: renderPartyJoinPage,
    title: 'Walk to Mordor - Join Fellowship',
    stylesheet: '/css/party.css',
    mountId: 'PartyJoinIsland',
  },
];

describe('Party SSR Shells', () => {
  // Shared layout behavior — asserted once, applies to every party page shell
  it('renders a valid HTML document with the common shell', () => {
    const result = partyPages[0].renderer();
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('</body>');
    // Common layout mounts and hydration/PWA wiring
    expect(result).toContain('data-island="DrawerIsland"');
    expect(result).toContain('islands.js');
    expect(result).toContain('manifest.json');
    expect(result).toContain('theme-color');
  });

  it.each(partyPages)(
    '$mountId renders shell with title, stylesheet, and mount point',
    ({ renderer, title, stylesheet, mountId }) => {
      const result = renderer();
      expect(result).toContain(`<title>${title}</title>`);
      expect(result).toContain(`href="${stylesheet}"`);
      expect(result).toContain(`data-island="${mountId}"`);
    }
  );
});
