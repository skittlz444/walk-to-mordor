import { renderHtml } from '../src/renderHtml';

describe('renderHtml', () => {
  it('should render HTML with provided total distance', () => {
    const result = renderHtml(42.5);
    
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Walk to Mordor</title>');
    expect(result).toContain('42.5');
  });

  it('should render HTML with zero distance', () => {
    const result = renderHtml(0);
    
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Walk to Mordor</title>');
    expect(result).toContain('0');
  });

  it('should render HTML without distance parameter', () => {
    const result = renderHtml();
    
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<title>Walk to Mordor</title>');
    expect(result).toContain('<html lang="en">');
  });

  it('should include PWA meta tags', () => {
    const result = renderHtml(10);
    
    expect(result).toContain('manifest.json');
    expect(result).toContain('theme-color');
    expect(result).toContain('mobile-web-app-capable');
    expect(result).toContain('apple-mobile-web-app-capable');
  });

  it('should include JavaScript files', () => {
    const result = renderHtml(10);
    
    expect(result).toContain('main.js');
  });

  it('should include CSS files', () => {
    const result = renderHtml(10);
    
    expect(result).toContain('main.css');
  });

  it('should handle large numbers', () => {
    const result = renderHtml(999999.99);
    
    expect(result).toContain('999999.99');
  });

  it('should handle decimal numbers', () => {
    const result = renderHtml(123.456);
    
    expect(result).toContain('123.456');
  });
});
