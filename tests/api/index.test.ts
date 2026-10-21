/**
 * Hono Router Tests
 *
 * Tests the new Hono-based routing in src/index.ts.
 * Uses app.request() for proper Request/Response handling.
 */
import { app } from '../../src/index';

// Mock handler modules before importing anything that uses them
jest.mock('../../src/renderHtml');
jest.mock('../../src/renderHomePage');
jest.mock('../../src/renderAuthPage');
jest.mock('../../src/renderPasswordResetPage');
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
jest.mock('../../src/renderStatsPage');
jest.mock('../../src/renderProfilePage');
jest.mock('../../src/renderAdminPage');
jest.mock('../../src/renderAdminGoalsPage');
jest.mock('../../src/renderAdminGoalEditPage');
jest.mock('../../src/renderAdminGoalAddPage');
jest.mock('../../src/renderAdminUsersPage');
jest.mock('../../src/renderAdminMetricsPage');
jest.mock('../../src/renderAdminStorylinesPage');
jest.mock('../../src/admin-handlers');
jest.mock('../../src/friends-handlers');
jest.mock('../../src/fellowship-invite-handlers');
jest.mock('../../src/stats-handlers');
jest.mock('../../src/push-handlers');
jest.mock('../../src/storyline-handlers');
jest.mock('../../src/map-handlers');
jest.mock('../../src/progress-handlers');

import { renderHtml } from '../../src/renderHtml';
import { renderHomePage } from '../../src/renderHomePage';
import { renderAuthPage } from '../../src/renderAuthPage';
import { renderPasswordResetPage } from '../../src/renderPasswordResetPage';
import {
  validateSession,
  validateAdminSession,
  handleRegister,
  handleLogin,
  handleLogout,
  handleSessionValidation,
  handleUpdateProfile,
  handleUpdatePreferences,
  handleGetAvatars,
  handlePasswordResetRequest,
  handlePasswordReset,
  handleConfirmEmail,
  handleResendConfirmation,
} from '../../src/auth-handlers';
import { handleCreateParty, handlePreviewParty, handleJoinParty, handleGetUserParties, handlePartyProgress } from '../../src/party-handlers';
import { renderPartyListPage } from '../../src/renderPartyListPage';
import { renderPartyDetailPage } from '../../src/renderPartyDetailPage';
import { renderPartyManagePage } from '../../src/renderPartyManagePage';
import { renderPartyJoinPage } from '../../src/renderPartyJoinPage';
import { renderFriendsPage } from '../../src/renderFriendsPage';
import { renderFriendAddPage } from '../../src/renderFriendAddPage';
import { renderFriendProfilePage } from '../../src/renderFriendProfilePage';
import { renderStatsPage } from '../../src/renderStatsPage';
import { renderProfilePage } from '../../src/renderProfilePage';
import { renderAdminPage } from '../../src/renderAdminPage';
import { renderAdminGoalsPage } from '../../src/renderAdminGoalsPage';
import { renderAdminGoalAddPage } from '../../src/renderAdminGoalAddPage';
import { renderAdminGoalEditPage } from '../../src/renderAdminGoalEditPage';
import { renderAdminStorylinesPage } from '../../src/renderAdminStorylinesPage';
import { renderAdminUsersPage } from '../../src/renderAdminUsersPage';
import { renderAdminMetricsPage } from '../../src/renderAdminMetricsPage';
import {
  handleAdminDashboard,
  handleAdminGoalsList,
  handleAdminGoalCreate,
  handleAdminGoalGet,
} from '../../src/admin-handlers';
import { handleGetFriends, handleGetPendingFriends, handleSearchUsers, handleResolveFriendCode, handleFriendRequest, handleAcceptFriend } from '../../src/friends-handlers';
import { handleInviteFriend, handleGetFellowshipInvites, handleAcceptFellowshipInvite } from '../../src/fellowship-invite-handlers';
import { handleWeeklyStats, handleHeatmap } from '../../src/stats-handlers';
import { handlePushSubscribe, handlePushStatus, handleVapidKey } from '../../src/push-handlers';
import { handleStorylinesList } from '../../src/storyline-handlers';
import { handleMapPage } from '../../src/map-handlers';
import { handleProgressGet } from '../../src/progress-handlers';
import { calculateUserStorylineDistance, handleGoalsGet } from '../../src/goals-handlers';

const mockRenderHtml = jest.mocked(renderHtml);
const mockRenderHomePage = jest.mocked(renderHomePage);
const mockRenderAuthPage = jest.mocked(renderAuthPage);
const mockRenderPasswordResetPage = jest.mocked(renderPasswordResetPage);
const mockValidateSession = jest.mocked(validateSession);
const mockValidateAdminSession = jest.mocked(validateAdminSession);
const mockHandleRegister = jest.mocked(handleRegister);
const mockHandleLogin = jest.mocked(handleLogin);
const mockHandleLogout = jest.mocked(handleLogout);
const mockHandleSessionValidation = jest.mocked(handleSessionValidation);
const mockHandleUpdateProfile = jest.mocked(handleUpdateProfile);
const mockHandleUpdatePreferences = jest.mocked(handleUpdatePreferences);
const mockHandleGetAvatars = jest.mocked(handleGetAvatars);
const mockHandlePasswordResetRequest = jest.mocked(handlePasswordResetRequest);
const mockHandlePasswordReset = jest.mocked(handlePasswordReset);
const mockHandleConfirmEmail = jest.mocked(handleConfirmEmail);
const mockHandleResendConfirmation = jest.mocked(handleResendConfirmation);
const mockHandleCreateParty = jest.mocked(handleCreateParty);
const mockHandlePreviewParty = jest.mocked(handlePreviewParty);
const mockHandleJoinParty = jest.mocked(handleJoinParty);
const mockHandleGetUserParties = jest.mocked(handleGetUserParties);
const mockHandlePartyProgress = jest.mocked(handlePartyProgress);
const mockRenderPartyListPage = jest.mocked(renderPartyListPage);
const mockRenderPartyDetailPage = jest.mocked(renderPartyDetailPage);
const mockRenderPartyManagePage = jest.mocked(renderPartyManagePage);
const mockRenderPartyJoinPage = jest.mocked(renderPartyJoinPage);
const mockRenderFriendsPage = jest.mocked(renderFriendsPage);
const mockRenderFriendAddPage = jest.mocked(renderFriendAddPage);
const mockRenderFriendProfilePage = jest.mocked(renderFriendProfilePage);
const mockRenderStatsPage = jest.mocked(renderStatsPage);
const mockRenderProfilePage = jest.mocked(renderProfilePage);
const mockRenderAdminPage = jest.mocked(renderAdminPage);
const mockRenderAdminGoalsPage = jest.mocked(renderAdminGoalsPage);
const mockRenderAdminGoalAddPage = jest.mocked(renderAdminGoalAddPage);
const mockRenderAdminGoalEditPage = jest.mocked(renderAdminGoalEditPage);
const mockRenderAdminStorylinesPage = jest.mocked(renderAdminStorylinesPage);
const mockRenderAdminUsersPage = jest.mocked(renderAdminUsersPage);
const mockRenderAdminMetricsPage = jest.mocked(renderAdminMetricsPage);
const mockHandleAdminDashboard = jest.mocked(handleAdminDashboard);
const mockHandleAdminGoalsList = jest.mocked(handleAdminGoalsList);
const mockHandleAdminGoalCreate = jest.mocked(handleAdminGoalCreate);
const mockHandleAdminGoalGet = jest.mocked(handleAdminGoalGet);
const mockHandleGetFriends = jest.mocked(handleGetFriends);
const mockHandleGetPendingFriends = jest.mocked(handleGetPendingFriends);
const mockHandleSearchUsers = jest.mocked(handleSearchUsers);
const mockHandleResolveFriendCode = jest.mocked(handleResolveFriendCode);
const mockHandleFriendRequest = jest.mocked(handleFriendRequest);
const mockHandleAcceptFriend = jest.mocked(handleAcceptFriend);
const mockHandleInviteFriend = jest.mocked(handleInviteFriend);
const mockHandleGetFellowshipInvites = jest.mocked(handleGetFellowshipInvites);
const mockHandleAcceptFellowshipInvite = jest.mocked(handleAcceptFellowshipInvite);
const mockHandleWeeklyStats = jest.mocked(handleWeeklyStats);
const mockHandleHeatmap = jest.mocked(handleHeatmap);
const mockHandlePushSubscribe = jest.mocked(handlePushSubscribe);
const mockHandlePushStatus = jest.mocked(handlePushStatus);
const mockHandleVapidKey = jest.mocked(handleVapidKey);
const mockHandleStorylinesList = jest.mocked(handleStorylinesList);
const mockHandleMapPage = jest.mocked(handleMapPage);
const mockHandleProgressGet = jest.mocked(handleProgressGet);
const mockCalculateUserStorylineDistance = jest.mocked(calculateUserStorylineDistance);
const mockHandleGoalsGet = jest.mocked(handleGoalsGet);

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    headers: { 'content-type': 'text/html' },
  });
}

describe('Hono Router', () => {
  // Mock environment with D1 database binding
  const mockEnv = {
    DB: {
      prepare: jest.fn(() => ({
        bind: jest.fn(() => ({
          run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
          all: jest.fn(() => Promise.resolve({ results: [] })),
          first: jest.fn(() => Promise.resolve(null)),
        })),
        all: jest.fn(() => Promise.resolve({ results: [] })),
        first: jest.fn(() => Promise.resolve(null)),
        run: jest.fn(() => Promise.resolve({ meta: { changes: 1 } })),
      })),
    },
    ASSETS: {
      fetch: jest.fn(() => Promise.resolve(new Response(null, { status: 404 }))),
    },
    ALLOW_TEST_AUTH: 'true',
  } as any;

  // Helper to make requests through the Hono app with mock env
  async function request(path: string, init?: RequestInit): Promise<Response> {
    return app.request(path, init, mockEnv);
  }

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock returns
    mockRenderHtml.mockReturnValue('<html>Mock HTML</html>');
    mockRenderHomePage.mockReturnValue('<html>Mock Home</html>');
    mockRenderAuthPage.mockReturnValue('<html>Login</html>');
    mockRenderPasswordResetPage.mockReturnValue('<html>Reset Password</html>');
    mockValidateSession.mockResolvedValue({ valid: true, userId: 1 });
    mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1 });
    mockHandleRegister.mockResolvedValue(jsonResponse({ ok: true }, 201));
    mockHandleLogin.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleLogout.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleSessionValidation.mockResolvedValue(jsonResponse({ valid: true }));
    mockHandleUpdateProfile.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleUpdatePreferences.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleGetAvatars.mockResolvedValue(jsonResponse({ avatars: [] }));
    mockHandlePasswordResetRequest.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandlePasswordReset.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleConfirmEmail.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleResendConfirmation.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandleVapidKey.mockReturnValue(jsonResponse({ key: 'test-key' }));
    mockHandleCreateParty.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    mockHandlePreviewParty.mockResolvedValue(jsonResponse({ name: 'Party' }));
    mockHandleJoinParty.mockResolvedValue(jsonResponse({ party_id: 1 }));
    mockHandleGetUserParties.mockResolvedValue(jsonResponse({ parties: [] }));
    mockHandlePartyProgress.mockResolvedValue(jsonResponse({ progress: 0 }));
    mockRenderPartyListPage.mockReturnValue('<html>Party List</html>');
    mockRenderPartyDetailPage.mockReturnValue('<html>Party Detail</html>');
    mockRenderPartyManagePage.mockReturnValue('<html>Party Manage</html>');
    mockRenderPartyJoinPage.mockReturnValue('<html>Party Join</html>');
    mockRenderFriendsPage.mockReturnValue('<html>Friends</html>');
    mockRenderFriendAddPage.mockReturnValue('<html>Friend Add</html>');
    mockRenderFriendProfilePage.mockReturnValue('<html>Friend Profile</html>');
    mockRenderStatsPage.mockReturnValue('<html>Stats</html>');
    mockRenderProfilePage.mockReturnValue('<html>Profile</html>');
    mockRenderAdminPage.mockReturnValue('<html>Admin</html>');
    mockRenderAdminGoalsPage.mockReturnValue('<html>Admin Goals</html>');
    mockRenderAdminGoalAddPage.mockReturnValue('<html>Admin Goal Add</html>');
    mockRenderAdminGoalEditPage.mockReturnValue('<html>Admin Goal Edit</html>');
    mockRenderAdminStorylinesPage.mockReturnValue('<html>Admin Storylines</html>');
    mockRenderAdminUsersPage.mockReturnValue('<html>Admin Users</html>');
    mockRenderAdminMetricsPage.mockReturnValue('<html>Admin Metrics</html>');
    mockHandleAdminDashboard.mockResolvedValue(jsonResponse({ totalUsers: 42 }));
    mockHandleAdminGoalsList.mockResolvedValue(jsonResponse({ goals: [] }));
    mockHandleAdminGoalCreate.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    mockHandleAdminGoalGet.mockResolvedValue(jsonResponse({ id: 42, title: 'Test' }));
    mockHandleGetFriends.mockResolvedValue(jsonResponse({ friends: [] }));
    mockHandleGetPendingFriends.mockResolvedValue(jsonResponse({ pending: [] }));
    mockHandleSearchUsers.mockResolvedValue(jsonResponse({ results: [] }));
    mockHandleResolveFriendCode.mockResolvedValue(jsonResponse({ username: 'alice' }));
    mockHandleFriendRequest.mockResolvedValue(jsonResponse({ friendship_id: 1 }, 201));
    mockHandleAcceptFriend.mockResolvedValue(jsonResponse({ status: 'accepted' }));
    mockHandleInviteFriend.mockResolvedValue(jsonResponse({ id: 1 }, 201));
    mockHandleGetFellowshipInvites.mockResolvedValue(jsonResponse({ invites: [] }));
    mockHandleAcceptFellowshipInvite.mockResolvedValue(jsonResponse({ party_id: 1 }));
    mockHandleWeeklyStats.mockResolvedValue(jsonResponse({ stats: {} }));
    mockHandleHeatmap.mockResolvedValue(jsonResponse({ heatmap: [] }));
    mockHandlePushSubscribe.mockResolvedValue(jsonResponse({ ok: true }));
    mockHandlePushStatus.mockResolvedValue(jsonResponse({ subscribed: false }));
    mockHandleStorylinesList.mockResolvedValue(jsonResponse({ storylines: [] }));
    mockHandleMapPage.mockResolvedValue(htmlResponse('<html>Map</html>'));
    mockHandleProgressGet.mockResolvedValue(jsonResponse({ entries: [] }));
    mockCalculateUserStorylineDistance.mockResolvedValue({ totalDistance: 10, rawTotalDistance: 10, activeStoryline: null });
    mockHandleGoalsGet.mockResolvedValue(jsonResponse({ goals: [] }));
  });

  // ── SSR Page Routes ────────────────────────────────────────────────────

  describe('SSR pages', () => {
    it('renders login page at /login', async () => {
      const res = await request('/login');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Login</html>');
    });

    it('renders home page at /', async () => {
      const res = await request('/');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Mock Home</html>');
    });

    it('renders journey page at /journey', async () => {
      const res = await request('/journey');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Mock HTML</html>');
    });

    it('renders profile page at /profile', async () => {
      const res = await request('/profile');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Profile</html>');
    });

    it('renders friends page at /friends', async () => {
      const res = await request('/friends');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Friends</html>');
    });

    it('renders friend add page at /friends/add/:code', async () => {
      const res = await request('/friends/add/ABC123');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Friend Add</html>');
    });

    it('renders friend profile page at /friends/:id', async () => {
      const res = await request('/friends/42');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Friend Profile</html>');
    });

    it('does not shadow /friends/add/:code with /friends/:id', async () => {
      const res = await request('/friends/add/Test1234');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Friend Add</html>');
    });

    it('renders stats page at /stats', async () => {
      const res = await request('/stats');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Stats</html>');
    });

    it('renders party list at /party', async () => {
      const res = await request('/party');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Party List</html>');
    });

    it('renders party detail at /party/:id', async () => {
      const res = await request('/party/42');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Party Detail</html>');
    });

    it('renders party manage at /party/:id/manage', async () => {
      const res = await request('/party/42/manage');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Party Manage</html>');
    });

    it('renders party join at /party/join/:code', async () => {
      const res = await request('/party/join/ABC123');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Party Join</html>');
    });

    it('renders admin page at /admin', async () => {
      const res = await request('/admin');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin</html>');
    });

    it('renders admin goals at /admin/goals', async () => {
      const res = await request('/admin/goals');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Goals</html>');
    });

    it('renders admin goal new at /admin/goals/new', async () => {
      const res = await request('/admin/goals/new');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Goal Add</html>');
    });

    it('renders admin goal edit at /admin/goals/:id', async () => {
      const res = await request('/admin/goals/42');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Goal Edit</html>');
    });

    it('renders admin storylines at /admin/storylines', async () => {
      const res = await request('/admin/storylines');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Storylines</html>');
    });

    it('renders admin users at /admin/users', async () => {
      const res = await request('/admin/users');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Users</html>');
    });

    it('renders admin metrics at /admin/metrics', async () => {
      const res = await request('/admin/metrics');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Admin Metrics</html>');
    });

    it('falls back to renderHtml for unknown pages', async () => {
      const res = await request('/nonexistent-page');
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('<html>Mock HTML</html>');
    });
  });

  // ── Public API Routes ──────────────────────────────────────────────────

  describe('Public API routes', () => {
    it('routes POST /api/register to handleRegister', async () => {
      const res = await request('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'test', password: 'Test1234!', email: 'test@example.com' }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('routes POST /api/login to handleLogin', async () => {
      const res = await request('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com', password: 'Test1234!' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('routes POST /api/logout to handleLogout', async () => {
      const res = await request('/api/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('routes GET /api/session to handleSessionValidation', async () => {
      const res = await request('/api/session');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ valid: true });
    });

    it('routes GET /api/push/vapid-key to handleVapidKey', async () => {
      const res = await request('/api/push/vapid-key');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ key: 'test-key' });
    });

    it('returns 405 for unsupported method on public endpoint', async () => {
      const res = await request('/api/register', { method: 'GET' });
      expect(res.status).toBe(405);
    });
  });

  // ── Authenticated API Routes ───────────────────────────────────────────

  describe('Auth middleware', () => {
    it('rejects unauthenticated requests to authenticated endpoints', async () => {
      mockValidateSession.mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const res = await request('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
      expect(await res.text()).toBe(JSON.stringify({ error: 'Unauthorized' }));
    });

    it('allows authenticated requests to authenticated endpoints', async () => {
      mockValidateSession.mockResolvedValue({ valid: true, userId: 1 });

      const res = await request('/api/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'test' }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });
  });

  describe('Authenticated API routes', () => {
    it('routes GET /api/avatars', async () => {
      const res = await request('/api/avatars');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ avatars: [] });
    });

    it('routes GET /api/storylines', async () => {
      const res = await request('/api/storylines');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ storylines: [] });
    });

    it('routes GET /api/goals', async () => {
      const res = await request('/api/goals');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ goals: [] });
    });

    it('routes GET /api/calendar-progress', async () => {
      const res = await request('/api/calendar-progress');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ entries: [] });
    });

    it('routes GET /api/stats/weekly', async () => {
      const res = await request('/api/stats/weekly');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ stats: {} });
    });

    it('routes GET /api/stats/heatmap', async () => {
      const res = await request('/api/stats/heatmap');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ heatmap: [] });
    });

    it('routes POST /api/push/subscribe', async () => {
      const res = await request('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ endpoint: 'test', keys: {} }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
    });

    it('routes GET /api/push/status', async () => {
      const res = await request('/api/push/status');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ subscribed: false });
    });

    it('routes GET /api/total-distance', async () => {
      const res = await request('/api/total-distance');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ totalDistance: 10, rawTotalDistance: 10, activeStoryline: null });
    });

    // Party routes
    it('routes POST /api/party to handleCreateParty', async () => {
      const res = await request('/api/party', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: 1 });
    });

    it('routes GET /api/user/parties', async () => {
      const res = await request('/api/user/parties');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ parties: [] });
    });

    it('routes GET /api/party/join/:inviteCode', async () => {
      const res = await request('/api/party/join/ABC123');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'Party' });
    });

    it('routes POST /api/party/join/:inviteCode', async () => {
      const res = await request('/api/party/join/ABC123', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ party_id: 1 });
    });

    it('routes GET /api/party/:id/progress', async () => {
      const res = await request('/api/party/42/progress');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ progress: 0 });
    });

    it('returns 400 for invalid party ID in parameterized routes', async () => {
      const res = await request('/api/party/abc/progress');
      expect(res.status).toBe(400);
    });

    // Friends routes
    it('routes GET /api/friends', async () => {
      const res = await request('/api/friends');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ friends: [] });
    });

    it('routes GET /api/friends/pending', async () => {
      const res = await request('/api/friends/pending');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ pending: [] });
    });

    it('routes GET /api/friends/search', async () => {
      const res = await request('/api/friends/search?q=test');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ results: [] });
    });

    it('routes POST /api/friends/request', async () => {
      const res = await request('/api/friends/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ friendship_id: 1 });
    });

    it('routes GET /api/friends/resolve/:friendCode', async () => {
      const res = await request('/api/friends/resolve/ABC123');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ username: 'alice' });
    });

    it('routes POST /api/friends/:id/accept', async () => {
      const res = await request('/api/friends/5/accept', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'accepted' });
    });

    it('returns 400 for invalid friendship ID', async () => {
      const res = await request('/api/friends/abc/accept', { method: 'POST' });
      expect(res.status).toBe(400);
    });

    // Fellowship invite routes
    it('routes GET /api/user/fellowship-invites', async () => {
      const res = await request('/api/user/fellowship-invites');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ invites: [] });
    });

    it('routes POST /api/party/:id/invite-friend', async () => {
      const res = await request('/api/party/1/invite-friend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ friend_id: 2 }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: 1 });
    });

    it('routes POST /api/user/fellowship-invites/:id/accept', async () => {
      const res = await request('/api/user/fellowship-invites/5/accept', { method: 'POST' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ party_id: 1 });
    });

    it('returns 400 for invalid goal id on public content route', async () => {
      const res = await request('/api/goals/abc/content');
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid goalId' });
    });
  });

  // ── Admin API Routes ───────────────────────────────────────────────────

  describe('Admin middleware', () => {
    it('rejects non-admin requests to admin endpoints', async () => {
      mockValidateAdminSession.mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: 'Admin access required' }), {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }),
      });

      const res = await request('/api/admin/dashboard');
      expect(res.status).toBe(403);
      expect(await res.text()).toEqual(JSON.stringify({ error: 'Admin access required' }));
    });

    it('allows admin requests to admin endpoints', async () => {
      mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1 });

      const res = await request('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ totalUsers: 42 });
    });
  });

  describe('Admin API routes', () => {
    beforeEach(() => {
      mockValidateAdminSession.mockResolvedValue({ valid: true, userId: 1 });
    });

    it('routes GET /api/admin/dashboard', async () => {
      const res = await request('/api/admin/dashboard');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ totalUsers: 42 });
    });

    it('routes GET /api/admin/goals', async () => {
      const res = await request('/api/admin/goals');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ goals: [] });
    });

    it('routes POST /api/admin/goals', async () => {
      const res = await request('/api/admin/goals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Test', distance_miles: 10 }),
      });
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ id: 1 });
    });

    it('routes GET /api/admin/goals/:id', async () => {
      const res = await request('/api/admin/goals/42');
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: 42, title: 'Test' });
    });

    it('returns 400 for invalid goal ID', async () => {
      const res = await request('/api/admin/goals/abc');
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'Invalid goal ID' });
    });

    it('returns 404 for unknown admin API endpoint', async () => {
      const res = await request('/api/admin/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  describe('Admin guard matrix (every /api/admin/* route)', () => {
    // Every admin route registered in src/index.ts (dashboard, users, metrics,
    // goals, goal content, storylines, image inventory).
    const adminRoutes: Array<{ method: string; path: string }> = [
      { method: 'GET', path: '/api/admin/dashboard' },
      { method: 'GET', path: '/api/admin/users' },
      { method: 'PUT', path: '/api/admin/users/1/verify' },
      { method: 'PUT', path: '/api/admin/users/1/reset' },
      { method: 'PUT', path: '/api/admin/users/1/admin' },
      { method: 'DELETE', path: '/api/admin/users/1' },
      { method: 'GET', path: '/api/admin/metrics' },
      { method: 'GET', path: '/api/admin/metrics/leaderboard' },
      { method: 'GET', path: '/api/admin/metrics/timeline' },
      { method: 'GET', path: '/api/admin/goals' },
      { method: 'POST', path: '/api/admin/goals' },
      { method: 'GET', path: '/api/admin/goals/1' },
      { method: 'PUT', path: '/api/admin/goals/1' },
      { method: 'GET', path: '/api/admin/goals/1/content' },
      { method: 'POST', path: '/api/admin/goals/1/content' },
      { method: 'PUT', path: '/api/admin/goals/1/content/1' },
      { method: 'DELETE', path: '/api/admin/goals/1/content/1' },
      { method: 'GET', path: '/api/admin/storylines' },
      { method: 'POST', path: '/api/admin/storylines' },
      { method: 'GET', path: '/api/admin/storylines/1' },
      { method: 'PUT', path: '/api/admin/storylines/1' },
      { method: 'PUT', path: '/api/admin/storylines/1/goals' },
      { method: 'GET', path: '/api/admin/images' },
    ];

    function denyWith(status: number, message: string) {
      mockValidateAdminSession.mockResolvedValue({
        valid: false,
        error: new Response(JSON.stringify({ error: message }), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
      });
    }

    it.each(adminRoutes)(
      'rejects $method $path with 403 and a JSON error for non-admin sessions',
      async ({ method, path }) => {
        denyWith(403, 'Admin access required');
        const res = await request(path, { method });
        expect(res.status).toBe(403);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ error: 'Admin access required' });
      },
    );

    it.each(adminRoutes)(
      'rejects $method $path with 401 and a JSON error when no session',
      async ({ method, path }) => {
        denyWith(401, 'Unauthorized');
        const res = await request(path, { method });
        expect(res.status).toBe(401);
        expect(res.headers.get('content-type')).toContain('application/json');
        expect(await res.json()).toEqual({ error: 'Unauthorized' });
      },
    );
  });

  // ── Method validation ──────────────────────────────────────────────────

  describe('Method validation', () => {
    it('returns 405 for POST on GET-only endpoint', async () => {
      const res = await request('/api/session', { method: 'POST' });
      expect(res.status).toBe(405);
    });

    it('returns 405 for GET on POST-only endpoint', async () => {
      const res = await request('/api/login', { method: 'GET' });
      expect(res.status).toBe(405);
    });

    it('returns 405 for unsupported method on parameterized route', async () => {
      const res = await request('/api/party/42/progress', { method: 'POST' });
      expect(res.status).toBe(405);
    });
  });

  // ── 404 handling ──────────────────────────────────────────────────────

  describe('404 handling', () => {
    it('returns 404 for unknown API endpoint', async () => {
      const res = await request('/api/nonexistent');
      expect(res.status).toBe(404);
    });
  });
});
