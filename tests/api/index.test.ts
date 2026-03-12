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
jest.mock('../../src/renderFriendsPage');
jest.mock('../../src/renderFriendAddPage');
jest.mock('../../src/renderFriendProfilePage');
jest.mock('../../src/renderAdminPage');
jest.mock('../../src/renderAdminGoalsPage');
jest.mock('../../src/renderAdminGoalEditPage');
jest.mock('../../src/renderAdminGoalAddPage');
jest.mock('../../src/admin-handlers');
jest.mock('../../src/friends-handlers');
jest.mock('../../src/fellowship-invite-handlers');

// Import after mocking
import worker from '../../src/index';
import { calculateTotalDistance, handleGoalsGet } from '../../src/goals-handlers';
import { handleCreateParty, handlePreviewParty, handleJoinParty, handleRegenerateInvite, handleGetUserParties, handleLeaveParty, handleKickMember, handleUpdatePartySettings, handleTransferLeadership } from '../../src/party-handlers';
import { renderPartyListPage } from '../../src/renderPartyListPage';
import { renderPartyDetailPage } from '../../src/renderPartyDetailPage';
import { renderPartyManagePage } from '../../src/renderPartyManagePage';
import { renderPartyJoinPage } from '../../src/renderPartyJoinPage';
import { renderFriendsPage } from '../../src/renderFriendsPage';
import { renderFriendAddPage } from '../../src/renderFriendAddPage';
import { renderFriendProfilePage } from '../../src/renderFriendProfilePage';
import { renderAdminPage } from '../../src/renderAdminPage';
import { renderAdminGoalsPage } from '../../src/renderAdminGoalsPage';
import { renderAdminGoalAddPage } from '../../src/renderAdminGoalAddPage';
import { renderAdminGoalEditPage } from '../../src/renderAdminGoalEditPage';
import { handleAdminDashboard, handleAdminGoalsList, handleAdminGoalCreate } from '../../src/admin-handlers';
import { handleGetFriends, handleGetPendingFriends, handleSearchUsers, handleResolveFriendCode, handleFriendRequest, handleFriendRequestByCode, handleAcceptFriend, handleRejectFriend, handleUnfriend, handleGetFriendProfile } from '../../src/friends-handlers';
import { handleInviteFriend, handleGetFellowshipInvites, handleAcceptFellowshipInvite, handleRejectFellowshipInvite } from '../../src/fellowship-invite-handlers';

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
const mockRenderFriendsPage = jest.mocked(renderFriendsPage);
const mockRenderFriendAddPage = jest.mocked(renderFriendAddPage);
const mockRenderFriendProfilePage = jest.mocked(renderFriendProfilePage);
const mockRenderAdminPage = jest.mocked(renderAdminPage);
const mockRenderAdminGoalsPage = jest.mocked(renderAdminGoalsPage);
const mockRenderAdminGoalAddPage = jest.mocked(renderAdminGoalAddPage);
const mockRenderAdminGoalEditPage = jest.mocked(renderAdminGoalEditPage);
const mockHandleAdminDashboard = jest.mocked(handleAdminDashboard);
const mockHandleAdminGoalsList = jest.mocked(handleAdminGoalsList);
const mockHandleAdminGoalCreate = jest.mocked(handleAdminGoalCreate);
const mockHandleGetFriends = jest.mocked(handleGetFriends);
const mockHandleGetPendingFriends = jest.mocked(handleGetPendingFriends);
const mockHandleSearchUsers = jest.mocked(handleSearchUsers);
const mockHandleResolveFriendCode = jest.mocked(handleResolveFriendCode);
const mockHandleFriendRequest = jest.mocked(handleFriendRequest);
const mockHandleFriendRequestByCode = jest.mocked(handleFriendRequestByCode);
const mockHandleAcceptFriend = jest.mocked(handleAcceptFriend);
const mockHandleRejectFriend = jest.mocked(handleRejectFriend);
const mockHandleUnfriend = jest.mocked(handleUnfriend);
const mockHandleGetFriendProfile = jest.mocked(handleGetFriendProfile);
const mockHandleInviteFriend = jest.mocked(handleInviteFriend);
const mockHandleGetFellowshipInvites = jest.mocked(handleGetFellowshipInvites);
const mockHandleAcceptFellowshipInvite = jest.mocked(handleAcceptFellowshipInvite);
const mockHandleRejectFellowshipInvite = jest.mocked(handleRejectFellowshipInvite);

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
    mockRenderFriendsPage.mockReturnValue('<html>Friends</html>');
    mockRenderFriendAddPage.mockReturnValue('<html>Friend Add</html>');
    mockRenderFriendProfilePage.mockReturnValue('<html>Friend Profile</html>');
    mockRenderAdminPage.mockReturnValue('<html>Admin Dashboard</html>');
    mockRenderAdminGoalsPage.mockReturnValue('<html>Admin Goals</html>');
    mockRenderAdminGoalAddPage.mockReturnValue('<html>Admin Goal Add</html>');
    mockRenderAdminGoalEditPage.mockReturnValue('<html>Admin Goal Edit</html>');
    mockHandleAdminDashboard.mockResolvedValue(new Response(JSON.stringify({
      totalUsers: 42, totalDistanceKm: 12345.6, activeParties: 5, totalGoals: 171
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleAdminGoalsList.mockResolvedValue(new Response(JSON.stringify({
      goals: [], total: 0, page: 1, pageSize: 25, totalPages: 1
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    // Friends handler mocks
    mockHandleGetFriends.mockResolvedValue(new Response(JSON.stringify({ friends: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleGetPendingFriends.mockResolvedValue(new Response(JSON.stringify({ pending: [], count: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleSearchUsers.mockResolvedValue(new Response(JSON.stringify({ results: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleResolveFriendCode.mockResolvedValue(new Response(JSON.stringify({ username: 'alice', avatar_id: 'gandalf-grey' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleFriendRequest.mockResolvedValue(new Response(JSON.stringify({ friendship_id: 1, status: 'pending' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    mockHandleFriendRequestByCode.mockResolvedValue(new Response(JSON.stringify({ friendship_id: 1, status: 'pending' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    mockHandleAcceptFriend.mockResolvedValue(new Response(JSON.stringify({ status: 'accepted' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleRejectFriend.mockResolvedValue(new Response(JSON.stringify({ status: 'rejected' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleUnfriend.mockResolvedValue(new Response(JSON.stringify({ status: 'removed' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleGetFriendProfile.mockResolvedValue(new Response(JSON.stringify({ username: 'alice', total_distance: 100 }), { status: 200, headers: { 'content-type': 'application/json' } }));

    // Fellowship invite handler mocks
    mockHandleInviteFriend.mockResolvedValue(new Response(JSON.stringify({ id: 1, party_id: 1, party_name: 'Party', invitee_id: 2, status: 'pending' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    mockHandleGetFellowshipInvites.mockResolvedValue(new Response(JSON.stringify({ invites: [], count: 0 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleAcceptFellowshipInvite.mockResolvedValue(new Response(JSON.stringify({ party_id: 1, party_name: 'Party', rejoined: false }), { status: 200, headers: { 'content-type': 'application/json' } }));
    mockHandleRejectFellowshipInvite.mockResolvedValue(new Response(JSON.stringify({ status: 'rejected' }), { status: 200, headers: { 'content-type': 'application/json' } }));

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

    // ===== Friends (Social) route tests =====

    // GET /api/friends
    it('should route GET /api/friends to handleGetFriends', async () => {
      const request = createRequest('http://localhost/api/friends', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleGetFriends).toHaveBeenCalledWith(expect.anything(), mockEnv);
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/friends', async () => {
      const request = createRequest('http://localhost/api/friends', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('GET');
    });

    // GET /api/friends/pending
    it('should route GET /api/friends/pending to handleGetPendingFriends', async () => {
      const request = createRequest('http://localhost/api/friends/pending', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleGetPendingFriends).toHaveBeenCalledWith(expect.anything(), mockEnv);
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/friends/pending', async () => {
      const request = createRequest('http://localhost/api/friends/pending', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    // GET /api/friends/search
    it('should route GET /api/friends/search to handleSearchUsers', async () => {
      const request = createRequest('http://localhost/api/friends/search?q=test', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleSearchUsers).toHaveBeenCalledWith(expect.anything(), mockEnv);
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/friends/search', async () => {
      const request = createRequest('http://localhost/api/friends/search', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    // POST /api/friends/request
    it('should route POST /api/friends/request to handleFriendRequest', async () => {
      const request = createRequest('http://localhost/api/friends/request', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleFriendRequest).toHaveBeenCalledWith(expect.anything(), mockEnv, expect.anything());
      expect(response.status).toBe(201);
    });

    it('should return 405 for GET on /api/friends/request', async () => {
      const request = createRequest('http://localhost/api/friends/request', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    // POST /api/friends/request/code
    it('should route POST /api/friends/request/code to handleFriendRequestByCode', async () => {
      const request = createRequest('http://localhost/api/friends/request/code', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleFriendRequestByCode).toHaveBeenCalledWith(expect.anything(), mockEnv, expect.anything());
      expect(response.status).toBe(201);
    });

    it('should return 405 for GET on /api/friends/request/code', async () => {
      const request = createRequest('http://localhost/api/friends/request/code', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    // GET /api/friends/resolve/:friendCode
    it('should route GET /api/friends/resolve/:friendCode to handleResolveFriendCode', async () => {
      const request = createRequest('http://localhost/api/friends/resolve/AbCd1234', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleResolveFriendCode).toHaveBeenCalledWith(expect.anything(), mockEnv, 'AbCd1234');
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/friends/resolve/:friendCode', async () => {
      const request = createRequest('http://localhost/api/friends/resolve/AbCd1234', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    // POST /api/friends/:friendshipId/accept
    it('should route POST /api/friends/:friendshipId/accept to handleAcceptFriend', async () => {
      const request = createRequest('http://localhost/api/friends/5/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleAcceptFriend).toHaveBeenCalledWith(expect.anything(), mockEnv, 5);
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/friends/:friendshipId/accept', async () => {
      const request = createRequest('http://localhost/api/friends/5/accept', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    it('should return 400 for invalid friendship ID in /api/friends/:friendshipId/accept', async () => {
      const request = createRequest('http://localhost/api/friends/abc/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid friendship ID');
    });

    it('should return 400 for negative friendship ID in /api/friends/-1/accept', async () => {
      const request = createRequest('http://localhost/api/friends/-1/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
    });

    it('should return 400 for float friendship ID in /api/friends/1.5/accept', async () => {
      const request = createRequest('http://localhost/api/friends/1.5/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
    });

    // POST /api/friends/:friendshipId/reject
    it('should route POST /api/friends/:friendshipId/reject to handleRejectFriend', async () => {
      const request = createRequest('http://localhost/api/friends/5/reject', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleRejectFriend).toHaveBeenCalledWith(expect.anything(), mockEnv, 5);
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/friends/:friendshipId/reject', async () => {
      const request = createRequest('http://localhost/api/friends/5/reject', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    it('should return 400 for invalid friendship ID in /api/friends/:friendshipId/reject', async () => {
      const request = createRequest('http://localhost/api/friends/abc/reject', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid friendship ID');
    });

    // DELETE /api/friends/:friendshipId
    it('should route DELETE /api/friends/:friendshipId to handleUnfriend', async () => {
      const request = createRequest('http://localhost/api/friends/5', 'DELETE');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleUnfriend).toHaveBeenCalledWith(expect.anything(), mockEnv, 5);
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/friends/:friendshipId (not exact /api/friends)', async () => {
      const request = createRequest('http://localhost/api/friends/5', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
    });

    it('should return 400 for invalid friendship ID in DELETE /api/friends/:friendshipId', async () => {
      const request = createRequest('http://localhost/api/friends/abc', 'DELETE');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid friendship ID');
    });

    it('should return 400 for zero friendship ID in DELETE /api/friends/0', async () => {
      const request = createRequest('http://localhost/api/friends/0', 'DELETE');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
    });

    // ===== Fellowship Invite route tests =====

    // POST /api/party/:id/invite-friend
    it('should route POST /api/party/:id/invite-friend to handleInviteFriend', async () => {
      const request = createRequest('http://localhost/api/party/1/invite-friend', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleInviteFriend).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 1, expect.anything()
      );
      expect(response.status).toBe(201);
    });

    it('should return 405 for GET on /api/party/:id/invite-friend', async () => {
      const request = createRequest('http://localhost/api/party/1/invite-friend', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid party ID in /api/party/:id/invite-friend', async () => {
      const request = createRequest('http://localhost/api/party/abc/invite-friend', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should return 400 for non-integer party ID like 1.5 in /api/party/:id/invite-friend', async () => {
      const request = createRequest('http://localhost/api/party/1.5/invite-friend', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    it('should return 400 for scientific notation party ID like 1e2 in /api/party/:id/invite-friend', async () => {
      const request = createRequest('http://localhost/api/party/1e2/invite-friend', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid party ID');
    });

    // GET /api/user/fellowship-invites
    it('should route GET /api/user/fellowship-invites to handleGetFellowshipInvites', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleGetFellowshipInvites).toHaveBeenCalledWith(
        expect.anything(), mockEnv
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for POST on /api/user/fellowship-invites', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('GET');
    });

    // POST /api/user/fellowship-invites/:inviteId/accept
    it('should route POST /api/user/fellowship-invites/:inviteId/accept to handleAcceptFellowshipInvite', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/5/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleAcceptFellowshipInvite).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 5
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/user/fellowship-invites/:inviteId/accept', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/5/accept', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid invite ID in /api/user/fellowship-invites/:inviteId/accept', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/abc/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid invite ID');
    });

    it('should return 400 for negative invite ID in /api/user/fellowship-invites/-1/accept', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/-1/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
    });

    it('should return 400 for float invite ID in /api/user/fellowship-invites/1.5/accept', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/1.5/accept', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
    });

    // POST /api/user/fellowship-invites/:inviteId/reject
    it('should route POST /api/user/fellowship-invites/:inviteId/reject to handleRejectFellowshipInvite', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/5/reject', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(mockHandleRejectFellowshipInvite).toHaveBeenCalledWith(
        expect.anything(), mockEnv, 5
      );
      expect(response.status).toBe(200);
    });

    it('should return 405 for GET on /api/user/fellowship-invites/:inviteId/reject', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/5/reject', 'GET');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(405);
      const data = await response.json();
      expect(data.allowedMethods).toContain('POST');
    });

    it('should return 400 for invalid invite ID in /api/user/fellowship-invites/:inviteId/reject', async () => {
      const request = createRequest('http://localhost/api/user/fellowship-invites/abc/reject', 'POST');
      const response = await worker.fetch(request as any, mockEnv, {} as any);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid invite ID');
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

  // Friends page routing tests
  it('should render friends page for /friends route', async () => {
    const request = createRequest('https://example.com/friends');
    const response = await worker.fetch(request, mockEnv);

    expect(mockRenderFriendsPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should render friend add page for /friends/add/:friendCode route', async () => {
    const request = createRequest('https://example.com/friends/add/AbCd1234');
    const response = await worker.fetch(request, mockEnv);

    expect(mockRenderFriendAddPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should render friend profile page for /friends/:id route', async () => {
    const request = createRequest('https://example.com/friends/42');
    const response = await worker.fetch(request, mockEnv);

    expect(mockRenderFriendProfilePage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should not shadow /friends/add/:friendCode with /friends/:id', async () => {
    const request = createRequest('https://example.com/friends/add/Test1234');
    const response = await worker.fetch(request, mockEnv);

    // /friends/add/:friendCode should match, NOT /friends/:id
    expect(mockRenderFriendAddPage).toHaveBeenCalled();
    expect(mockRenderFriendProfilePage).not.toHaveBeenCalled();
  });

  // Friend profile API route tests
  it('should route GET /api/friends/:userId/profile to handleGetFriendProfile', async () => {
    const request = createRequest('http://localhost/api/friends/5/profile', 'GET');
    const response = await worker.fetch(request as any, mockEnv, {} as any);
    expect(mockHandleGetFriendProfile).toHaveBeenCalledWith(expect.anything(), mockEnv, 5);
    expect(response.status).toBe(200);
  });

  it('should return 405 for POST on /api/friends/:userId/profile', async () => {
    const request = createRequest('http://localhost/api/friends/5/profile', 'POST');
    const response = await worker.fetch(request as any, mockEnv, {} as any);
    expect(response.status).toBe(405);
  });

  it('should return 400 for invalid user ID in /api/friends/:userId/profile', async () => {
    const request = createRequest('http://localhost/api/friends/abc/profile', 'GET');
    const response = await worker.fetch(request as any, mockEnv, {} as any);
    expect(response.status).toBe(400);
    const data = await response.json() as { error: string };
    expect(data.error).toBe('Invalid user ID');
  });

  it('should return 400 for float user ID in /api/friends/1.5/profile', async () => {
    const request = createRequest('http://localhost/api/friends/1.5/profile', 'GET');
    const response = await worker.fetch(request as any, mockEnv, {} as any);
    expect(response.status).toBe(400);
  });

  // Admin route tests
  it('should render admin page for /admin route without server-side auth', async () => {
    const request = createRequest('https://example.com/admin');
    const response = await worker.fetch(request, mockEnv);
    
    expect(mockValidateAdminSession).not.toHaveBeenCalled();
    expect(mockRenderAdminPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
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

  it('should return 405 for POST /api/admin/dashboard (only GET supported)', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    const request = createRequest('https://example.com/api/admin/dashboard', 'POST');
    const response = await worker.fetch(request, mockEnv);

    // POST to dashboard should be rejected by method validation (GET-only)
    expect(mockHandleAdminDashboard).not.toHaveBeenCalled();
    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.error).toContain('Method POST not allowed');
  });

  // Admin Goals List route tests (Story 4.3)
  it('should render admin goals page for /admin/goals route without server-side auth', async () => {
    const request = createRequest('https://example.com/admin/goals');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).not.toHaveBeenCalled();
    expect(mockRenderAdminGoalsPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  // Admin Goal Add page route tests (Story 4.6)
  it('should render admin goal add page for /admin/goals/new route without server-side auth', async () => {
    const request = createRequest('https://example.com/admin/goals/new');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).not.toHaveBeenCalled();
    expect(mockRenderAdminGoalAddPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  // Admin Goal Edit page route tests (Story 4.4)
  it('should render admin goal edit page for /admin/goals/:id with valid id without server-side auth', async () => {
    const request = createRequest('https://example.com/admin/goals/42');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).not.toHaveBeenCalled();
    expect(mockRenderAdminGoalEditPage).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('text/html');
  });

  it('should return 404 for /admin/goals/:id with non-numeric id', async () => {
    const request = createRequest('https://example.com/admin/goals/abc');
    const response = await worker.fetch(request, mockEnv);

    expect(mockRenderAdminGoalEditPage).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it('should return 404 for /admin/goals/:id with zero id', async () => {
    const request = createRequest('https://example.com/admin/goals/0');
    const response = await worker.fetch(request, mockEnv);

    expect(mockRenderAdminGoalEditPage).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
  });

  it('should route GET /api/admin/goals to handleAdminGoalsList when admin', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    const request = createRequest('https://example.com/api/admin/goals');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(mockHandleAdminGoalsList).toHaveBeenCalledWith(request, mockEnv);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('goals');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('pageSize');
    expect(body).toHaveProperty('totalPages');
  });

  it('should return 403 for /api/admin/goals when not admin', async () => {
    mockValidateAdminSession.mockResolvedValue({
      valid: false,
      error: new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { 'content-type': 'application/json' }
      })
    });
    const request = createRequest('https://example.com/api/admin/goals');
    const response = await worker.fetch(request, mockEnv);

    expect(mockValidateAdminSession).toHaveBeenCalled();
    expect(mockHandleAdminGoalsList).not.toHaveBeenCalled();
    expect(response.status).toBe(403);
  });

  it('should route POST /api/admin/goals to handleAdminGoalCreate when admin (Story 4.6)', async () => {
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1, isAdmin: true });
    mockSafeJsonParse.mockResolvedValue({ success: true, data: { title: 'Test', distance_miles: 100 } });
    mockHandleAdminGoalCreate.mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 201 }));
    const request = createRequest('https://example.com/api/admin/goals', 'POST');
    const response = await worker.fetch(request, mockEnv);

    expect(mockHandleAdminGoalCreate).toHaveBeenCalled();
    expect(response.status).toBe(201);
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