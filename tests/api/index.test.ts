import { renderHtml } from '../../src/renderHtml';
import { renderHomePage } from '../../src/renderHomePage';
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod,
  createErrorResponse
} from '../../src/validators';
import { 
  validateSession,
  validateAdminSession,
  handleRegister,
  handleLogin,
  handleLogout,
  handleSessionValidation,
  handleUpdatePreferences
} from '../../src/auth-handlers';

// Mock the modules at module level
jest.mock('../../src/renderHtml');
jest.mock('../../src/renderHomePage');
jest.mock('../../src/validators');
jest.mock('../../src/goals-handlers');
jest.mock('../../src/auth-handlers');
jest.mock('../../src/party-handlers');
jest.mock('../../src/renderPartyListPage');
jest.mock('../../src/renderPartyDetailPage');
jest.mock('../../src/renderPartyManagePage');
jest.mock('../../src/renderPartyJoinPage');
jest.mock('../../src/renderAdminPage');
jest.mock('../../src/admin-handlers');

// Import after mocking
import worker from '../../src/index';
import { calculateTotalDistance, handleGoalsGet } from '../../src/goals-handlers';
import { handleCreateParty, handlePreviewParty, handleJoinParty, handleRegenerateInvite, handleGetUserParties, handleLeaveParty, handleKickMember, handleUpdatePartySettings, handleTransferLeadership } from '../../src/party-handlers';
import { renderPartyListPage } from '../../src/renderPartyListPage';
import { renderPartyDetailPage } from '../../src/renderPartyDetailPage';
import { renderPartyManagePage } from '../../src/renderPartyManagePage';
import { renderPartyJoinPage } from '../../src/renderPartyJoinPage';
import { renderAdminPage } from '../../src/renderAdminPage';
import { handleAdminDashboard } from '../../src/admin-handlers';

const mockRenderHtml = jest.mocked(renderHtml);
const mockRenderHomePage = jest.mocked(renderHomePage);
const mockIsValidDateFormat = jest.mocked(isValidDateFormat);
const mockIsValidDistance = jest.mocked(isValidDistance);
const mockSafeJsonParse = jest.mocked(safeJsonParse);
const mockIsValidMethod = jest.mocked(isValidMethod);
const mockCreateErrorResponse = jest.mocked(createErrorResponse);
const mockCalculateTotalDistance = jest.mocked(calculateTotalDistance);
const mockHandleGoalsGet = jest.mocked(handleGoalsGet);
const mockValidateSession = jest.mocked(validateSession);
const mockValidateAdminSession = jest.mocked(validateAdminSession);
const mockHandleRegister = jest.mocked(handleRegister);
const mockHandleLogin = jest.mocked(handleLogin);
const mockHandleLogout = jest.mocked(handleLogout);
const mockHandleSessionValidation = jest.mocked(handleSessionValidation);
const mockHandleUpdatePreferences = jest.mocked(handleUpdatePreferences);
const mockHandleCreateParty = jest.mocked(handleCreateParty);
const mockHandlePreviewParty = jest.mocked(handlePreviewParty);
const mockHandleJoinParty = jest.mocked(handleJoinParty);
const mockHandleRegenerateInvite = jest.mocked(handleRegenerateInvite);
const mockHandleGetUserParties = jest.mocked(handleGetUserParties);
const mockHandleLeaveParty = jest.mocked(handleLeaveParty);
const mockHandleKickMember = jest.mocked(handleKickMember);
const mockHandleUpdatePartySettings = jest.mocked(handleUpdatePartySettings);
const mockHandleTransferLeadership = jest.mocked(handleTransferLeadership);
const mockRenderPartyListPage = jest.mocked(renderPartyListPage);
const mockRenderPartyDetailPage = jest.mocked(renderPartyDetailPage);
const mockRenderPartyManagePage = jest.mocked(renderPartyManagePage);
const mockRenderPartyJoinPage = jest.mocked(renderPartyJoinPage);
const mockRenderAdminPage = jest.mocked(renderAdminPage);
const mockHandleAdminDashboard = jest.mocked(handleAdminDashboard);

describe('Cloudflare Worker Index', () => {
  let mockEnv: any;
  let mockRequest: any;
  let originalConsoleError: typeof console.error;
  let originalConsoleLog: typeof console.log;

  // Helper function to create a request
  const createRequest = (url: string, method: string = 'GET') => {
    return {
      ...mockRequest,
      url,
      method,
      headers: {
        get: jest.fn((name: string) => {
          if (name === 'content-type' || name === 'Content-Type') {
            return 'application/json';
          }
          return null;
        }),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        append: jest.fn(),
        entries: jest.fn(),
        forEach: jest.fn(),
        keys: jest.fn(),
        values: jest.fn(),
        [Symbol.iterator]: jest.fn()
      }
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Suppress console outputs during tests to reduce noise from expected scenarios
    originalConsoleError = console.error;
    originalConsoleLog = console.log;
    console.error = jest.fn();
    console.log = jest.fn();
    
    // Setup default mock returns
    mockRenderHtml.mockReturnValue('<html>Mock HTML</html>');
    mockRenderHomePage.mockReturnValue('<html>Mock Home HTML</html>');
    mockIsValidDateFormat.mockReturnValue(true);
    mockIsValidDistance.mockReturnValue(true);
    mockIsValidMethod.mockReturnValue(true);
    mockSafeJsonParse.mockResolvedValue({ success: true, data: {} });
    mockValidateSession.mockResolvedValue({ valid: true, userId: 1 });
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    mockCreateErrorResponse.mockImplementation((error: string, status: number = 400) => {
      return new Response(JSON.stringify({ error }), {
        status,
        headers: { 'content-type': 'application/json' }
      });
    });

    // Setup handler mocks
    mockCalculateTotalDistance.mockResolvedValue(10);
    mockHandleGoalsGet.mockResolvedValue(new Response(JSON.stringify({ goals: [] }), { 
      status: 200, 
      headers: { 'content-type': 'application/json' } 
    }));

    mockHandleRegister.mockResolvedValue(new Response('Registered', { status: 201 }));
    mockHandleLogin.mockResolvedValue(new Response('Logged In', { status: 200 }));
    mockHandleLogout.mockResolvedValue(new Response('Logged Out', { status: 200 }));
    mockHandleSessionValidation.mockResolvedValue(new Response('Valid Session', { status: 200 }));
    mockHandleUpdatePreferences.mockResolvedValue(new Response(JSON.stringify({ showFutureGoalsUnlocked: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleCreateParty.mockResolvedValue(new Response(JSON.stringify({ id: 1, name: 'Test Party' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    mockHandlePreviewParty.mockResolvedValue(new Response(JSON.stringify({ name: 'Party', member_count: 3 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleJoinParty.mockResolvedValue(new Response(JSON.stringify({ party_id: 1, rejoined: false }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleRegenerateInvite.mockResolvedValue(new Response(JSON.stringify({ inviteCode: 'NewCode1', inviteUrl: 'https://example.com/party/join/NewCode1' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleGetUserParties.mockResolvedValue(new Response(JSON.stringify({ parties: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleLeaveParty.mockResolvedValue(new Response(JSON.stringify({ message: 'You have left the party' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleKickMember.mockResolvedValue(new Response(JSON.stringify({ message: 'Member has been kicked from the party' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleUpdatePartySettings.mockResolvedValue(new Response(JSON.stringify({ id: 1, name: 'Updated Party' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleTransferLeadership.mockResolvedValue(new Response(JSON.stringify({ message: 'Leadership transferred successfully', new_leader_id: 2 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockRenderPartyListPage.mockReturnValue('<html>Party List</html>');
    mockRenderPartyDetailPage.mockReturnValue('<html>Party Detail</html>');
    mockRenderPartyManagePage.mockReturnValue('<html>Party Manage</html>');
    mockRenderPartyJoinPage.mockReturnValue('<html>Party Join</html>');
    mockRenderAdminPage.mockReturnValue('<html>Admin Dashboard</html>');
    mockHandleAdminDashboard.mockResolvedValue(new Response(JSON.stringify({
      totalUsers: 42, totalDistanceKm: 12345.6, activeParties: 5, totalGoals: 171
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    // Create simple mock environment
    mockEnv = {
      DB: {
        prepare: jest.fn(() => ({
          bind: jest.fn(() => ({
            run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
            all: jest.fn(() => Promise.resolve({ results: [] }))
          })),
          all: jest.fn(() => Promise.resolve({ results: [] }))
        }))
      },
      ASSETS: {
        fetch: jest.fn(() => Promise.resolve({ status: 404 }))
      }
    };

    // Create a more complete mock Request object with proper headers support
    mockRequest = {
      url: 'https://example.com/',
      method: 'GET',
      headers: {
        get: jest.fn((name: string) => {
          const headerMap = new Map([
            ['content-type', 'application/json']
          ]);
          return headerMap.get(name) || null;
        }),
        set: jest.fn(),
        has: jest.fn(),
        delete: jest.fn(),
        append: jest.fn(),
        entries: jest.fn(),
        forEach: jest.fn(),
        keys: jest.fn(),
        values: jest.fn(),
        [Symbol.iterator]: jest.fn()
      }
    };
  });

  afterEach(() => {
    // Restore console methods after each test
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });
    it('should route to handleRegister', async () => {
      const request = createRequest('http://localhost/api/register', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleRegister).toHaveBeenCalled();
      expect(response.status).toBe(201);
    });

    it('should route to handleLogin', async () => {
      const request = createRequest('http://localhost/api/login', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleLogin).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should route to handleLogout', async () => {
      const request = createRequest('http://localhost/api/logout', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleLogout).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should route to handleSessionValidation', async () => {
      const request = createRequest('http://localhost/api/session', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleSessionValidation).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should route to handleUpdatePreferences', async () => {
      const request = createRequest('http://localhost/api/user/preferences', 'PUT');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleUpdatePreferences).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return 405 for invalid method on preferences endpoint', async () => {
      const request = createRequest('http://localhost/api/user/preferences', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('PUT');
    });

    it('should return 405 for invalid method on auth endpoints', async () => {
      const request = createRequest('http://localhost/api/login', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should route POST /api/party to handleCreateParty', async () => {
      const request = createRequest('http://localhost/api/party', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleCreateParty).toHaveBeenCalled();
      expect(response.status).toBe(201);
    });

    it('should return 405 for GET on /api/party', async () => {
      const request = createRequest('http://localhost/api/party', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should route GET /api/party/join/:inviteCode to handlePreviewParty', async () => {
      const request = createRequest('http://localhost/api/party/join/AbCd1234', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandlePreviewParty).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 'AbCd1234'
      );
      expect(response.status).toBe(200);
    });

    it('should route POST /api/party/join/:inviteCode to handleJoinParty', async () => {
      const request = createRequest('http://localhost/api/party/join/AbCd1234', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleJoinParty).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 'AbCd1234'
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for PUT on /api/party/join/:inviteCode', async () => {
      const request = createRequest('http://localhost/api/party/join/AbCd1234', 'PUT');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('GET');
      expect(data.allowedMethods).toContain('POST');
    });

    it('should route POST /api/party/:id/invite to handleRegenerateInvite', async () => {
      const request = createRequest('http://localhost/api/party/1/invite', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleRegenerateInvite).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/party/:id/invite', async () => {
      const request = createRequest('http://localhost/api/party/1/invite', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid party ID in /api/party/:id/invite', async () => {
      const request = createRequest('http://localhost/api/party/abc/invite', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should return 400 for non-integer party ID like 1.5 in /api/party/:id/invite', async () => {
      const request = createRequest('http://localhost/api/party/1.5/invite', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should return 400 for scientific notation party ID like 1e2 in /api/party/:id/invite', async () => {
      const request = createRequest('http://localhost/api/party/1e2/invite', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should route GET /api/user/parties to handleGetUserParties', async () => {
      const request = createRequest('http://localhost/api/user/parties', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleGetUserParties).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/user/parties', async () => {
      const request = createRequest('http://localhost/api/user/parties', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('GET');
    });

    it('should route POST /api/party/:id/leave with empty body', async () => {
      mockSafeJsonParse.mockRestore();
      const { safeJsonParse: realSafeJsonParse } = jest.requireActual('../../src/validators');
      mockSafeJsonParse.mockImplementation(realSafeJsonParse);

      const request = createRequest('http://localhost/api/party/1/leave', 'POST');
      request.text = jest.fn().mockResolvedValue('');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleLeaveParty).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1
      );
      expect(response.status).toBe(200);
    });

    it('should route POST /api/party/:id/kick/:userId with empty body', async () => {
      mockSafeJsonParse.mockRestore();
      const { safeJsonParse: realSafeJsonParse } = jest.requireActual('../../src/validators');
      mockSafeJsonParse.mockImplementation(realSafeJsonParse);

      const request = createRequest('http://localhost/api/party/1/kick/2', 'POST');
      request.text = jest.fn().mockResolvedValue('');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleKickMember).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1, 2, {}
      );
      expect(response.status).toBe(200);
    });

    it('should route POST /api/party/:id/leave to handleLeaveParty', async () => {
      const request = createRequest('http://localhost/api/party/1/leave', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleLeaveParty).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/party/:id/leave', async () => {
      const request = createRequest('http://localhost/api/party/1/leave', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid party ID in /api/party/:id/leave', async () => {
      const request = createRequest('http://localhost/api/party/abc/leave', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should route POST /api/party/:id/kick/:userId to handleKickMember', async () => {
      const request = createRequest('http://localhost/api/party/1/kick/2', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleKickMember).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1, 2, expect.anything()
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/party/:id/kick/:userId', async () => {
      const request = createRequest('http://localhost/api/party/1/kick/2', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid party ID in /api/party/:id/kick/:userId', async () => {
      const request = createRequest('http://localhost/api/party/abc/kick/2', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should return 400 for invalid user ID in /api/party/:id/kick/:userId', async () => {
      const request = createRequest('http://localhost/api/party/1/kick/abc', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid user ID');
    });

    it('should route PUT /api/party/:id/settings to handleUpdatePartySettings', async () => {
      const request = createRequest('http://localhost/api/party/1/settings', 'PUT');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleUpdatePartySettings).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1, expect.anything()
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/party/:id/settings', async () => {
      const request = createRequest('http://localhost/api/party/1/settings', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('PUT');
    });

    it('should return 400 for invalid party ID in /api/party/:id/settings', async () => {
      const request = createRequest('http://localhost/api/party/abc/settings', 'PUT');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should route POST /api/party/:id/transfer-leadership to handleTransferLeadership', async () => {
      const request = createRequest('http://localhost/api/party/1/transfer-leadership', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleTransferLeadership).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1, expect.anything()
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/party/:id/transfer-leadership', async () => {
      const request = createRequest('http://localhost/api/party/1/transfer-leadership', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid party ID in /api/party/:id/transfer-leadership', async () => {
      const request = createRequest('http://localhost/api/party/abc/transfer-leadership', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });
  it('should call renderHomePage for root page', async () => {
    const request = createRequest('https://example.com/');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderHomePage).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it('should render journey page for /journey route', async () => {
    const request = createRequest('https://example.com/journey');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderHtml).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  // Party page routing tests
  it('should render party list page for /party route', async () => {
    const request = createRequest('https://example.com/party');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderPartyListPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should render party detail page for /party/:id route', async () => {
    const request = createRequest('https://example.com/party/42');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderPartyDetailPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should render party manage page for /party/:id/manage route', async () => {
    const request = createRequest('https://example.com/party/42/manage');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderPartyManagePage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should render party join page for /party/join/:inviteCode route', async () => {
    const request = createRequest('https://example.com/party/join/AbCd1234');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockRenderPartyJoinPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  // Admin route tests
  it('should render admin page for /admin route when admin', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    const request = createRequest('https://example.com/admin');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(mockRenderAdminPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should return 403 for /admin route when not admin', async () => {
    mockValidateAdminSession.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' }
      })
    });
    const request = createRequest('https://example.com/admin');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(mockRenderAdminPage).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it('should return 401 for /admin route when unauthenticated', async () => {
    mockValidateAdminSession.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Missing or invalid authorization header' }), {
        status: 401,
        headers: { 'content-type': 'application/json' }
      })
    });
    const request = createRequest('https://example.com/admin');
    const response = await worker.fetch(request, mockEnv);
    
    expect(response.status).toBe(401);
  });

  it('should return 403 for /api/admin/* routes when not admin', async () => {
    mockValidateAdminSession.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' }
      })
    });
    const request = createRequest('https://example.com/api/admin/dashboard');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it('should return 404 for unknown /api/admin/* routes when admin', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    const request = createRequest('https://example.com/api/admin/nonexistent');
    const response = await worker.fetch(request, mockEnv);
    
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error).toBe('Admin API endpoint not found');
  });

  it('should route GET /api/admin/dashboard to handleAdminDashboard when admin', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    const request = createRequest('https://example.com/api/admin/dashboard');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(mockHandleAdminDashboard).toHaveBeenCalledWith(request, mockEnv);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totalUsers).toBe(42);
  });

  it('should validate method for API endpoints', async () => {
    // Use PATCH method which is not allowed for calendar-progress endpoint
    const authRequest = createRequest('https://example.com/api/calendar-progress', 'PATCH');

    const response = await worker.fetch(authRequest, mockEnv);
    
    expect(response.status).toBe(405);
    const data = await response.json();
    expect(data.error).toContain('Method PATCH not allowed');
  });

  it('should parse JSON for POST requests', async () => {
    const authRequest = createRequest('https://example.com/api/calendar-progress', 'POST');
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    await worker.fetch(authRequest, mockEnv);
    
    expect(mockSafeJsonParse).toHaveBeenCalledWith(authRequest);
    expect(mockIsValidDateFormat).toHaveBeenCalledWith('2024-01-15');
    expect(mockIsValidDistance).toHaveBeenCalledWith('5.5');
  });

  it('should handle invalid JSON', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: false,
      error: 'Invalid JSON'
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate date format', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date', title: '5.5' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate distance', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should serve static assets when available', async () => {
    const assetResponse = { status: 200, body: 'asset' };
    mockEnv.ASSETS.fetch.mockResolvedValue(assetResponse);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response).toBe(assetResponse);
  });

  it('should handle missing required fields in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { title: '5.5' } // missing start
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should return calendar data for GET requests', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'GET';

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should return goals data', async () => {
    const authRequest = createRequest('https://example.com/api/goals', 'GET');

    const response = await worker.fetch(authRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle PUT requests successfully', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '7.5' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle PUT with missing fields', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' } // missing title
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle PUT when entry not found', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '7.5' }
    });

    // Mock no changes in database
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 0 } }))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(404);
  });

  it('should handle DELETE requests successfully', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(200);
  });

  it('should handle DELETE with missing start field', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: {}
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle DELETE when entry not found', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    // Mock no changes in database
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.resolve({ meta: { changes: 0 } }))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(404);
  });

  it('should handle DELETE with invalid date', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should handle database errors in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle UNIQUE constraint error in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock UNIQUE constraint error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('UNIQUE constraint failed')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(409);
  });

  it('should handle database errors in PUT', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '5.5' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in DELETE', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'DELETE';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      bind: jest.fn(() => ({
        run: jest.fn(() => Promise.reject(new Error('Database error')))
      }))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in GET calendar-progress', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'GET';

    // Mock database error
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should handle database errors in GET goals', async () => {
    const authRequest = createRequest('https://example.com/api/goals', 'GET');

    // Mock database error in goals handler
    mockHandleGoalsGet.mockResolvedValue(new Response(JSON.stringify({ 
      error: 'Database error' 
    }), { 
      status: 500, 
      headers: { 'content-type': 'application/json' } 
    }));

    const response = await worker.fetch(authRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should calculate total distance correctly via API endpoint', async () => {
    const authRequest = createRequest('https://example.com/api/total-distance', 'GET');

    // Mock multiple entries with distances
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.resolve({
        results: [
          { distance: 5.5 },
          { distance: 3.2 },
          { distance: 1.3 }
        ]
      }))
    });

    const response = await worker.fetch(authRequest, mockEnv);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.totalDistance).toBe(10); // 5.5 + 3.2 + 1.3 = 10
  });

  it('should handle database errors in total distance API', async () => {
    const authRequest = createRequest('https://example.com/api/total-distance', 'GET');

    // Mock calculateTotalDistance to throw an error
    mockCalculateTotalDistance.mockRejectedValue(new Error('Database error'));

    const response = await worker.fetch(authRequest, mockEnv);
    
    expect(response.status).toBe(500);
  });

  it('should render main page even with database errors', async () => {
    const authRequest = createRequest('https://example.com/', 'GET');

    // Mock database error (this won't affect main page rendering in new architecture)
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.reject(new Error('Database error')))
    });

    const response = await worker.fetch(authRequest, mockEnv);
    
    expect(mockRenderHomePage).toHaveBeenCalledWith();
    expect(response.status).toBe(200);
  });

  it('should render main page without server-side distance calculation', async () => {
    const authRequest = createRequest('https://example.com/', 'GET');

    // Database data doesn't affect main page rendering in new architecture
    mockEnv.DB.prepare.mockReturnValue({
      all: jest.fn(() => Promise.resolve({
        results: [
          { distance: 5.5 },
          { distance: 3.2 },
          { distance: 1.3 }
        ]
      }))
    });

    await worker.fetch(authRequest, mockEnv);
    
    expect(mockRenderHomePage).toHaveBeenCalledWith();
  });

  it('should handle HEAD requests for assets', async () => {
    mockRequest.method = 'HEAD';
    
    const assetResponse = { status: 200, body: 'asset' };
    mockEnv.ASSETS.fetch.mockResolvedValue(assetResponse);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response).toBe(assetResponse);
  });

  it('should validate distance for specific error types in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    
    expect(response.status).toBe(400);
  });

  it('should validate distance for NaN values in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'not-a-number' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be a valid number');
  });

  it('should validate distance for negative values in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '-5' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be non-negative (0 or greater)');
  });

  it('should validate distance for too large values in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: '1000000000' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be less than 1 billion');
  });

  it('should validate missing title field in POST', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'POST';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Missing required field: title (distance)');
  });

  it('should validate missing title field in PUT', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15' }
    });

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Missing required field: title (distance)');
  });

  it('should validate date format in PUT', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: 'invalid-date', title: '5.5' }
    });
    mockIsValidDateFormat.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)');
  });

  it('should validate distance in PUT', async () => {
    mockRequest.url = 'https://example.com/api/calendar-progress';
    mockRequest.method = 'PUT';
    
    mockSafeJsonParse.mockResolvedValue({
      success: true,
      data: { start: '2024-01-15', title: 'invalid' }
    });
    mockIsValidDistance.mockReturnValue(false);

    const response = await worker.fetch(mockRequest, mockEnv);
    const result = await response.json();
    
    expect(response.status).toBe(400);
    expect(result.error).toBe('Invalid distance value. Must be a non-negative number');
  });
});