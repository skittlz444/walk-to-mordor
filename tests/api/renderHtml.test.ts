import { renderHtml } from '../../src/renderHtml';

describe('renderHtml', () => {
  it('should render HTML with standard structure', () => {
    const result = renderHtml();
    
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Walk to Mordor</title>');
    expect(result).toContain('<html lang="en">');
  });

  it('should include loading placeholder for total distance', () => {
    const result = renderHtml();
    
    expect(result).toContain('<div id="total-distance-value">Loading...</div>');
  });

  it('should include PWA meta tags', () => {
    const result = renderHtml();
    
    expect(result).toContain('manifest.json');
    expect(result).toContain('theme-color');
    expect(result).toContain('mobile-web-app-capable');
    expect(result).toContain('apple-mobile-web-app-capable');
  });

  it('should include Preact islands bundle', () => {
    const result = renderHtml();
    
    expect(result).toContain('islands.js');
    expect(result).toContain('islands.css');
  });

  it('should include CSS files', () => {
    const result = renderHtml();
    
    expect(result).toContain('main.css');
  });

  it('should include required HTML structure elements', () => {
    const result = renderHtml();
    
    expect(result).toContain('<header>');
    expect(result).toContain('<section id="goals-section">');
    expect(result).toContain('data-island="GoalsSectionIsland"');
    expect(result).toContain('data-island="CalendarIsland"');
    expect(result).toContain('data-island="DistanceModalIsland"');
    expect(result).toContain('data-island="AppBootstrapIsland"');
  });

  it('should include service worker registration script', () => {
    const result = renderHtml();
    
    expect(result).toContain('serviceWorker');
    expect(result).toContain('/sw.js');
  });
  
  it('should not include auth.js script', () => {
    const result = renderHtml();
    
    expect(result).not.toContain('auth.js');
  });
  
  it('should not include auth.css stylesheet', () => {
    const result = renderHtml();
    
    expect(result).not.toContain('auth.css');
  });
});
