
import { sendPasswordResetEmail, sendConfirmationEmail } from '../../src/email-utils';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Email Utilities', () => {
  const mockEnv = {
    RESEND_API_KEY: 'mock_resend_api_key'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('sendPasswordResetEmail', () => {
    it('should return error if RESEND_API_KEY is missing', async () => {
      // Create env without API key
      const envWithoutKey = { ...mockEnv, RESEND_API_KEY: undefined };
      
      const result = await sendPasswordResetEmail(
        envWithoutKey as any,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ 
        success: false, 
        error: 'Email service not configured. Please contact administrator.' 
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should send email successfully with valid parameters', async () => {
      // Mock successful response from Resend
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg_1234567890' })
      });

      const result = await sendPasswordResetEmail(
        mockEnv as any,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      // Verify correct API URL
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.any(Object)
      );

      // Verify Headers
      const fetchCallArgs = mockFetch.mock.calls[0];
      const fetchOptions = fetchCallArgs[1];
      expect(fetchOptions.headers).toEqual({
        'Authorization': `Bearer ${mockEnv.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      });

      // Verify Body
      const body = JSON.parse(fetchOptions.body);
      expect(body.to).toEqual(['test@example.com']);
      expect(body.subject).toBe('Password Reset Request - Walk to Mordor');
      expect(body.html).toContain('https://example.com/reset-password?token=token123');
    });

    it('should handle Resend API errors (non-200 response)', async () => {
      // Mock error response from Resend
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ 
          name: 'invalid_request_error', 
          message: 'Invalid email address' 
        })
      });

      const result = await sendPasswordResetEmail(
        mockEnv as any,
        'invalid-email',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ 
        success: false, 
        error: 'Invalid email address'
      });
    });

    it('should handle fetch failures (network error)', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await sendPasswordResetEmail(
        mockEnv as any,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ 
        success: false, 
        error: 'Failed to send email. Please try again later.'
      });
    });
    
    it('should handle rate limits (429)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({})
      });
      
      const result = await sendPasswordResetEmail(
          mockEnv as any,
          'test@example.com',
          'Test User',
          'token123',
          'https://example.com'
        );
        
      expect(result).toEqual({
        success: false,
        error: 'Too many email requests. Please try again later.'
      });
    });
  });

  describe('sendConfirmationEmail', () => {
    it('should send email successfully with valid parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'msg_confirm_123' })
      });

      const result = await sendConfirmationEmail(
        mockEnv as any,
        'newuser@example.com',
        'https://example.com/confirm?token=xyz'
      );

      expect(result).toEqual({ success: true });
      
      const fetchCallArgs = mockFetch.mock.calls[0];
      const fetchOptions = fetchCallArgs[1];
      const body = JSON.parse(fetchOptions.body);
      
      expect(body.to).toEqual(['newuser@example.com']);
      expect(body.subject).toBe('Confirm Your Email - Walk to Mordor');
      expect(body.html).toContain('https://example.com/confirm?token=xyz');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Invalid email' })
      });

      const result = await sendConfirmationEmail(
        mockEnv as any,
        'invalid@example.com',
        'link'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });
  });
});
