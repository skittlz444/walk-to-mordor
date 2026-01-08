import { sendPasswordResetEmail } from '../../src/email-utils';

// Virtual Mock for the cloudflare:email module
jest.mock('cloudflare:email', () => {
  return {
    EmailMessage: jest.fn().mockImplementation((from, to, raw) => {
      return { from, to, raw };
    })
  };
}, { virtual: true });

describe('Email Utilities', () => {
  const mockEnv = {
    EMAIL: {
      send: jest.fn()
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.EMAIL.send.mockResolvedValue(undefined);
  });

  describe('sendPasswordResetEmail', () => {
    it('should return error if EMAIL binding is missing', async () => {
      const result = await sendPasswordResetEmail(
        {}, // Empty env
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ 
        success: false, 
        error: 'Email service not configured' 
      });
    });

    it('should send email successfully with valid parameters', async () => {
      const result = await sendPasswordResetEmail(
        mockEnv,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ success: true });
      expect(mockEnv.EMAIL.send).toHaveBeenCalledTimes(1);
      
      // Verify correct parameters were used using the mock
      const { EmailMessage } = await import('cloudflare:email');
      expect(EmailMessage).toHaveBeenCalledWith(
        'noreply@haydencarson.com',
        'test@example.com',
        expect.stringContaining('Hello Test User')
      );
    });

    it('should include reset URL in email body', async () => {
      await sendPasswordResetEmail(
        mockEnv,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      const { EmailMessage } = await import('cloudflare:email');
      const call = (EmailMessage as jest.Mock).mock.calls[0];
      const rawMessage = call[2]; // 3rd argument is raw content

      expect(rawMessage).toContain('https://example.com/reset-password?token=token123');
    });

    it('should handle errors from EMAIL.send', async () => {
      mockEnv.EMAIL.send.mockRejectedValue(new Error('Send failed'));

      const result = await sendPasswordResetEmail(
        mockEnv,
        'test@example.com',
        'Test User',
        'token123',
        'https://example.com'
      );

      expect(result).toEqual({ 
        success: false, 
        error: 'Send failed' 
      });
    });
  });
});
