import { renderPartyListPage } from '../../src/renderPartyListPage';
import { renderPartyDetailPage } from '../../src/renderPartyDetailPage';
import { renderPartyManagePage } from '../../src/renderPartyManagePage';
import { renderPartyJoinPage } from '../../src/renderPartyJoinPage';

describe('Party SSR Shells', () => {
  describe('renderPartyListPage', () => {
    it('should render valid HTML document', () => {
      const result = renderPartyListPage();
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
    });

    it('should include party.css stylesheet', () => {
      const result = renderPartyListPage();
      expect(result).toContain('party.css');
    });

    it('should include PartyListIsland mount point', () => {
      const result = renderPartyListPage();
      expect(result).toContain('data-island="PartyListIsland"');
    });

    it('should include page title', () => {
      const result = renderPartyListPage();
      expect(result).toContain('<title>Walk to Mordor - Fellowships</title>');
    });

    it('should include PWA meta tags', () => {
      const result = renderPartyListPage();
      expect(result).toContain('manifest.json');
      expect(result).toContain('theme-color');
    });

    it('should include DrawerIsland mount point', () => {
      const result = renderPartyListPage();
      expect(result).toContain('data-island="DrawerIsland"');
    });

    it('should include islands.js for Preact hydration', () => {
      const result = renderPartyListPage();
      expect(result).toContain('islands.js');
    });
  });

  describe('renderPartyDetailPage', () => {
    it('should render valid HTML document', () => {
      const result = renderPartyDetailPage();
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should include PartyDetailIsland mount point', () => {
      const result = renderPartyDetailPage();
      expect(result).toContain('data-island="PartyDetailIsland"');
    });

    it('should include party.css stylesheet', () => {
      const result = renderPartyDetailPage();
      expect(result).toContain('party.css');
    });

    it('should include page title', () => {
      const result = renderPartyDetailPage();
      expect(result).toContain('<title>Walk to Mordor - Fellowship</title>');
    });
  });

  describe('renderPartyManagePage', () => {
    it('should render valid HTML document', () => {
      const result = renderPartyManagePage();
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should include PartyManageIsland mount point', () => {
      const result = renderPartyManagePage();
      expect(result).toContain('data-island="PartyManageIsland"');
    });

    it('should include party.css stylesheet', () => {
      const result = renderPartyManagePage();
      expect(result).toContain('party.css');
    });

    it('should include page title', () => {
      const result = renderPartyManagePage();
      expect(result).toContain('<title>Walk to Mordor - Manage Fellowship</title>');
    });
  });

  describe('renderPartyJoinPage', () => {
    it('should render valid HTML document', () => {
      const result = renderPartyJoinPage();
      expect(result).toContain('<!DOCTYPE html>');
    });

    it('should include PartyJoinIsland mount point', () => {
      const result = renderPartyJoinPage();
      expect(result).toContain('data-island="PartyJoinIsland"');
    });

    it('should include party.css stylesheet', () => {
      const result = renderPartyJoinPage();
      expect(result).toContain('party.css');
    });

    it('should include page title', () => {
      const result = renderPartyJoinPage();
      expect(result).toContain('<title>Walk to Mordor - Join Fellowship</title>');
    });
  });
});
