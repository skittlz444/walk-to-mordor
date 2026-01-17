import {
  getPasswordResetEmailHtml,
  getPasswordResetEmailText,
  getConfirmationEmailHtml,
  getConfirmationEmailText
} from '../../src/email-templates';

describe('Email Templates', () => {
  describe('getPasswordResetEmailHtml', () => {
    it('should generate valid HTML with reset link', () => {
      const resetLink = 'https://example.com/reset-password?token=abc123';
      const html = getPasswordResetEmailHtml(resetLink);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Walk to Mordor');
      expect(html).toContain('Password Reset Request');
      expect(html).toContain(resetLink);
      expect(html).toContain('This link will expire in 1 hour');
    });

    it('should escape HTML entities in reset link', () => {
      const resetLink = 'https://example.com/reset?token=<script>alert("xss")</script>';
      const html = getPasswordResetEmailHtml(resetLink);

      // Should not contain raw script tags
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('</script>');
      
      // Should contain escaped version
      expect(html).toContain('&lt;script&gt;');
      expect(html).toContain('&lt;/script&gt;');
    });

    it('should escape special characters in link', () => {
      const resetLink = 'https://example.com/reset?name="test"&id=<123>';
      const html = getPasswordResetEmailHtml(resetLink);

      expect(html).toContain('&quot;');
      expect(html).toContain('&lt;');
      expect(html).toContain('&gt;');
    });

    it('should include common email styles', () => {
      const html = getPasswordResetEmailHtml('https://example.com/reset');
      
      expect(html).toContain('.container');
      expect(html).toContain('.header');
      expect(html).toContain('.content');
      expect(html).toContain('.button');
      expect(html).toContain('.footer');
    });
  });

  describe('getPasswordResetEmailText', () => {
    it('should generate plain text email with reset link', () => {
      const resetLink = 'https://example.com/reset-password?token=abc123';
      const text = getPasswordResetEmailText(resetLink);

      expect(text).toContain('Password Reset Request - Walk to Mordor');
      expect(text).toContain(resetLink);
      expect(text).toContain('This link will expire in 1 hour');
      expect(text).toContain('Walk to Mordor Team');
    });

    it('should not contain HTML tags', () => {
      const text = getPasswordResetEmailText('https://example.com/reset');
      
      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toContain('<!DOCTYPE');
    });
  });

  describe('getConfirmationEmailHtml', () => {
    it('should generate valid HTML with confirmation link', () => {
      const confirmLink = 'https://example.com/confirm?token=xyz789';
      const html = getConfirmationEmailHtml(confirmLink);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('Walk to Mordor');
      expect(html).toContain('Welcome to Walk to Mordor!');
      expect(html).toContain(confirmLink);
      expect(html).toContain('confirm your email');
    });

    it('should escape HTML entities in confirmation link', () => {
      const confirmLink = 'https://example.com/confirm?token=<img src=x onerror=alert(1)>';
      const html = getConfirmationEmailHtml(confirmLink);

      // Should not contain raw HTML tags that could execute
      expect(html).not.toContain('<img src=x');
      
      // Should contain escaped version
      expect(html).toContain('&lt;img');
      expect(html).toContain('&gt;');
    });

    it('should include common email styles', () => {
      const html = getConfirmationEmailHtml('https://example.com/confirm');
      
      expect(html).toContain('.container');
      expect(html).toContain('.header');
      expect(html).toContain('.content');
      expect(html).toContain('.button');
      expect(html).toContain('.footer');
    });
  });

  describe('getConfirmationEmailText', () => {
    it('should generate plain text email with confirmation link', () => {
      const confirmLink = 'https://example.com/confirm?token=xyz789';
      const text = getConfirmationEmailText(confirmLink);

      expect(text).toContain('Welcome to Walk to Mordor!');
      expect(text).toContain(confirmLink);
      expect(text).toContain('confirm your email');
      expect(text).toContain('Walk to Mordor Team');
    });

    it('should not contain HTML tags', () => {
      const text = getConfirmationEmailText('https://example.com/confirm');
      
      expect(text).not.toContain('<');
      expect(text).not.toContain('>');
      expect(text).not.toContain('<!DOCTYPE');
    });
  });

  describe('Style consistency', () => {
    it('should use consistent styles between password reset and confirmation emails', () => {
      const resetHtml = getPasswordResetEmailHtml('https://example.com/reset');
      const confirmHtml = getConfirmationEmailHtml('https://example.com/confirm');

      // Both should have the same style classes
      const styleClasses = ['.container', '.header', '.content', '.button', '.footer'];
      
      styleClasses.forEach(styleClass => {
        expect(resetHtml).toContain(styleClass);
        expect(confirmHtml).toContain(styleClass);
      });

      // Both should have the same brand colors
      expect(resetHtml).toContain('#0f3460'); // Header color
      expect(confirmHtml).toContain('#0f3460');
      expect(resetHtml).toContain('#e94560'); // Button color
      expect(confirmHtml).toContain('#e94560');
    });
  });
});
