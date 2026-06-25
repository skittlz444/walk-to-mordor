import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Context } from 'hono';
import { renderHtml } from "./renderHtml";
import { renderHomePage } from "./renderHomePage";
import { renderAuthPage } from "./renderAuthPage";
import { renderPasswordResetRequestPage, renderPasswordResetPage } from "./renderPasswordResetPage";
import {
  handleProgressPost,
  handleProgressPut,
  handleProgressDelete,
  handleProgressGet
} from "./progress-handlers";
import {
  handleGoalsGet,
  calculateUserStorylineDistance
} from "./goals-handlers";
import {
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
  validateSession,
  validateAdminSession
} from "./auth-handlers";
import { handleMapPage } from "./map-handlers";
import { handleCreateParty, handlePreviewParty, handleJoinParty, handleRegenerateInvite, handleGetUserParties, handlePartyPositions, handlePartyProgress, handlePartyActivity, handleSendPartyMessage, handleLeaveParty, handleKickMember, handleUpdatePartySettings, handleTransferLeadership } from "./party-handlers";
import { handleGetFriends, handleGetPendingFriends, handleSearchUsers, handleResolveFriendCode, handleFriendRequest, handleFriendRequestByCode, handleAcceptFriend, handleRejectFriend, handleUnfriend, handleGetFriendProfile, handleFriendPositions } from "./friends-handlers";
import { handleInviteFriend, handleGetFellowshipInvites, handleAcceptFellowshipInvite, handleRejectFellowshipInvite } from "./fellowship-invite-handlers";
import { renderPartyListPage } from "./renderPartyListPage";
import { renderPartyDetailPage } from "./renderPartyDetailPage";
import { renderPartyManagePage } from "./renderPartyManagePage";
import { renderPartyJoinPage } from "./renderPartyJoinPage";
import { renderFriendsPage } from "./renderFriendsPage";
import { renderStatsPage } from "./renderStatsPage";
import { renderFriendAddPage } from "./renderFriendAddPage";
import { renderFriendProfilePage } from "./renderFriendProfilePage";
import { renderProfilePage } from "./renderProfilePage";
import { renderAdminPage } from "./renderAdminPage";
import { renderAdminGoalsPage } from "./renderAdminGoalsPage";
import {
  handleAdminDashboard,
  handleAdminGoalsList,
  handleAdminGoalGet,
  handleAdminGoalUpdate,
  handleAdminImageInventory,
  handleAdminGoalCreate,
  handleAdminStorylinesList,
  handleAdminStorylineGet,
  handleAdminStorylineCreate,
  handleAdminStorylineUpdate,
  handleAdminStorylineGoalsUpdate,
  handleAdminUsersList,
  handleAdminUserVerify,
  handleAdminUserResetPassword,
  handleAdminUserToggleAdmin,
  handleAdminUserDelete,
  handleAdminMetricsSummary,
  handleAdminMetricsLeaderboard,
  handleAdminMetricsTimeline,
} from "./admin-handlers";
import { renderAdminGoalEditPage } from "./renderAdminGoalEditPage";
import { renderAdminGoalAddPage } from "./renderAdminGoalAddPage";
import { renderAdminUsersPage } from "./renderAdminUsersPage";
import { renderAdminMetricsPage } from "./renderAdminMetricsPage";
import { renderAdminStorylinesPage } from "./renderAdminStorylinesPage";
import { createDbClient, type DbClient } from './db';
import { handleWeeklyStats, handleHeatmap, handleWrappedStats } from './stats-handlers';
import {
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushStatus,
  handlePushSettings,
  handleVapidKey,
} from './push-handlers';
import {
  handleStorylinesList,
  handleUpdatePartyStoryline,
  handleUpdateUserStoryline,
} from './storyline-handlers';
import { handleOneMoreMileCron, handleReengagementCron } from './scheduled-handlers';

// ── Hono Context Variables ────────────────────────────────────────────────
type Variables = {
  db: DbClient;
  userId?: number;
  adminUserId?: number;
};

// ── Hono App ───────────────────────────────────────────────────────────────
export const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ── Method registry for API 405 detection ──────────────────────────────────
// Hono's wildcard middleware prevents automatic 405 generation.
// We check `app.routes` in the notFound handler to return proper 405 responses.

/** Match a concrete URL path against a Hono pattern like /api/party/:id/progress */
function matchApiPattern(pattern: string, pathname: string): boolean {
  const patParts = pattern.split('/');
  const pathParts = pathname.split('/');
  if (patParts.length !== pathParts.length) return false;
  for (let i = 0; i < patParts.length; i++) {
    if (patParts[i].startsWith(':')) continue;
    if (patParts[i] !== pathParts[i]) return false;
  }
  return true;
}

// ── Middleware: DbClient injection ─────────────────────────────────────────
app.use('*', createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  c.set('db', createDbClient(c.env.DB));
  return next();
}));

// ── Helper: validate integer param ─────────────────────────────────────────
function intParam(value: string, name: string): number | Response {
  const num = Number.parseInt(value, 10);
  if (!Number.isInteger(num) || num <= 0 || String(num) !== value) {
    return new Response(JSON.stringify({ error: `Invalid ${name}` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  return num;
}

// ── Helper: safe JSON body parsing ────────────────────────────────────────
async function safeJsonBody(c: Context<{ Bindings: Env; Variables: Variables }>): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return (body as Record<string, unknown>) || {};
  } catch (e) {
    console.warn('Failed to parse JSON request body:', e);
    return {};
  }
}

// ── Auth Guards ────────────────────────────────────────────────────────────
const authGuard = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const db = c.get('db');
  const result = await validateSession(c.req.raw, db, c.env.ALLOW_TEST_AUTH);
  if (!result.valid) return result.error;
  c.set('userId', result.userId!);
  await next();
});

const adminGuard = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const db = c.get('db');
  const result = await validateAdminSession(c.req.raw, db, c.env.ALLOW_TEST_AUTH);
  if (!result.valid) return result.error;
  c.set('userId', result.userId!);
  c.set('adminUserId', result.userId!);
  await next();
});

// ═══════════════════════════════════════════════════════════════════════════
// SSR PAGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/login', (c) => c.html(renderAuthPage()));
app.get('/password-reset', (c) => c.html(renderPasswordResetRequestPage()));
app.get('/reset-password', (c) => c.html(renderPasswordResetPage()));

app.get('/map', (c) => handleMapPage(c.req.raw, c.env));

app.get('/admin', (c) => c.html(renderAdminPage()));
app.get('/admin/goals', (c) => c.html(renderAdminGoalsPage()));
app.get('/admin/goals/new', (c) => c.html(renderAdminGoalAddPage()));
app.get('/admin/goals/:id', (c) => c.html(renderAdminGoalEditPage()));
app.get('/admin/storylines', (c) => c.html(renderAdminStorylinesPage()));
app.get('/admin/users', (c) => c.html(renderAdminUsersPage()));
app.get('/admin/metrics', (c) => c.html(renderAdminMetricsPage()));

app.get('/profile', (c) => c.html(renderProfilePage()));
app.get('/friends', (c) => c.html(renderFriendsPage()));
app.get('/friends/add/:friendCode', (c) => c.html(renderFriendAddPage()));
app.get('/friends/:id', (c) => c.html(renderFriendProfilePage()));
app.get('/stats', (c) => c.html(renderStatsPage()));

app.get('/party', (c) => c.html(renderPartyListPage()));
app.get('/party/join/:inviteCode', (c) => c.html(renderPartyJoinPage()));
app.get('/party/:id/manage', (c) => c.html(renderPartyManagePage()));
app.get('/party/:id', (c) => c.html(renderPartyDetailPage()));

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API ROUTES (no auth required)
// ═══════════════════════════════════════════════════════════════════════════

// ── Auth ──
app.post('/api/register', async (c) =>
  handleRegister(c.req.raw, c.get('db'), await c.req.json(), c.env));
app.post('/api/login', async (c) =>
  handleLogin(c.req.raw, c.get('db'), await c.req.json()));
app.post('/api/logout', async (c) =>
  handleLogout(c.req.raw, c.get('db'), await c.req.json()));
app.get('/api/session', (c) =>
  handleSessionValidation(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.post('/api/password-reset-request', async (c) =>
  handlePasswordResetRequest(c.req.raw, c.get('db'), await c.req.json(), c.env));
app.post('/api/password-reset', async (c) =>
  handlePasswordReset(c.req.raw, c.get('db'), await c.req.json()));
app.get('/api/auth/confirm-email', (c) =>
  handleConfirmEmail(c.req.raw, c.get('db')));
app.post('/api/auth/resend-confirmation', async (c) =>
  handleResendConfirmation(c.req.raw, c.get('db'), await c.req.json(), c.env));
app.get('/api/push/vapid-key', (c) =>
  handleVapidKey(c.env));

// ── Public party preview (no auth required) ──
app.get('/api/party/join/:inviteCode', (c) =>
  handlePreviewParty(c.req.raw, c.get('db'), c.req.param('inviteCode')));

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATED API ROUTES (session required)
// ═══════════════════════════════════════════════════════════════════════════

// ── Profile & Preferences ──
app.put('/api/profile', authGuard, async (c) =>
  handleUpdateProfile(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.put('/api/user/preferences', authGuard, async (c) =>
  handleUpdatePreferences(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.put('/api/user/storyline', authGuard, async (c) =>
  handleUpdateUserStoryline(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));

// ── Avatars & Storylines ──
app.get('/api/avatars', authGuard, (c) =>
  handleGetAvatars(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/storylines', authGuard, (c) =>
  handleStorylinesList(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));

// ── Progress ──
app.post('/api/calendar-progress', authGuard, async (c) =>
  handleProgressPost(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.put('/api/calendar-progress', authGuard, async (c) =>
  handleProgressPut(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.delete('/api/calendar-progress', authGuard, async (c) =>
  handleProgressDelete(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.get('/api/calendar-progress', authGuard, (c) =>
  handleProgressGet(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));

// ── Goals & Stats ──
app.get('/api/goals', authGuard, (c) =>
  handleGoalsGet(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/stats/weekly', authGuard, (c) =>
  handleWeeklyStats(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/stats/heatmap', authGuard, (c) =>
  handleHeatmap(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/stats/wrapped', authGuard, (c) =>
  handleWrappedStats(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/total-distance', authGuard, async (c) => {
  try {
    const distance = await calculateUserStorylineDistance(c.get('db'), c.get('userId')!);
    return new Response(JSON.stringify(distance), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Database error during total distance calculation:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error while calculating total distance'
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
});

// ── Push Notifications ──
app.post('/api/push/subscribe', authGuard, async (c) =>
  handlePushSubscribe(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.delete('/api/push/subscribe', authGuard, async (c) =>
  handlePushUnsubscribe(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.get('/api/push/status', authGuard, (c) =>
  handlePushStatus(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.put('/api/push/settings', authGuard, async (c) =>
  handlePushSettings(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));

// ── Party (Fellowship) ──
app.post('/api/party', authGuard, async (c) =>
  handleCreateParty(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.get('/api/user/parties', authGuard, (c) =>
  handleGetUserParties(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/user/parties/positions', authGuard, (c) =>
  handlePartyPositions(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/user/fellowship-invites', authGuard, (c) =>
  handleGetFellowshipInvites(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));

// ── Fellowship Invite Actions ──
app.post('/api/user/fellowship-invites/:inviteId/accept', authGuard, async (c) => {
  const id = intParam(c.req.param('inviteId'), 'invite ID');
  if (id instanceof Response) return id;
  return handleAcceptFellowshipInvite(c.req.raw, c.get('db'), id, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/user/fellowship-invites/:inviteId/reject', authGuard, async (c) => {
  const id = intParam(c.req.param('inviteId'), 'invite ID');
  if (id instanceof Response) return id;
  return handleRejectFellowshipInvite(c.req.raw, c.get('db'), id, c.env.ALLOW_TEST_AUTH);
});

// ── Party Param Routes ──
app.post('/api/party/join/:inviteCode', authGuard, (c) =>
  handleJoinParty(c.req.raw, c.get('db'), c.req.param('inviteCode'), c.env.ALLOW_TEST_AUTH));

app.post('/api/party/:id/invite', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleRegenerateInvite(c.req.raw, c.get('db'), partyId, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/party/:id/invite-friend', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleInviteFriend(c.req.raw, c.get('db'), partyId, await c.req.json(), c.env.ALLOW_TEST_AUTH);
});
app.get('/api/party/:id/progress', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handlePartyProgress(c.req.raw, c.get('db'), partyId, c.env.ALLOW_TEST_AUTH);
});
app.get('/api/party/:id/activity', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handlePartyActivity(c.req.raw, c.get('db'), partyId, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/party/:id/messages', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleSendPartyMessage(c.req.raw, c.get('db'), partyId, await c.req.json(), c.env.ALLOW_TEST_AUTH);
});
app.post('/api/party/:id/leave', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleLeaveParty(c.req.raw, c.get('db'), partyId, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/party/:id/kick/:userId', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  const targetUserId = intParam(c.req.param('userId'), 'user ID');
  if (targetUserId instanceof Response) return targetUserId;
  const body = await safeJsonBody(c);
  return handleKickMember(c.req.raw, c.get('db'), partyId, targetUserId, body, c.env.ALLOW_TEST_AUTH);
});
app.put('/api/party/:id/settings', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleUpdatePartySettings(c.req.raw, c.get('db'), partyId, await c.req.json(), c.env.ALLOW_TEST_AUTH);
});
app.put('/api/party/:id/storyline', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleUpdatePartyStoryline(c.req.raw, c.get('db'), partyId, await c.req.json(), c.env.ALLOW_TEST_AUTH);
});
app.post('/api/party/:id/transfer-leadership', authGuard, async (c) => {
  const partyId = intParam(c.req.param('id'), 'party ID');
  if (partyId instanceof Response) return partyId;
  return handleTransferLeadership(c.req.raw, c.get('db'), partyId, await c.req.json(), c.env.ALLOW_TEST_AUTH);
});

// ── Friends (Social) ──
app.get('/api/friends', authGuard, (c) =>
  handleGetFriends(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/friends/pending', authGuard, (c) =>
  handleGetPendingFriends(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.get('/api/friends/search', authGuard, (c) =>
  handleSearchUsers(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));
app.post('/api/friends/request', authGuard, async (c) =>
  handleFriendRequest(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.post('/api/friends/request/code', authGuard, async (c) =>
  handleFriendRequestByCode(c.req.raw, c.get('db'), await c.req.json(), c.env.ALLOW_TEST_AUTH));
app.get('/api/friends/positions', authGuard, (c) =>
  handleFriendPositions(c.req.raw, c.get('db'), c.env.ALLOW_TEST_AUTH));

// ── Friend Param Routes ──
app.get('/api/friends/resolve/:friendCode', authGuard, (c) =>
  handleResolveFriendCode(c.req.raw, c.get('db'), c.req.param('friendCode')));

app.get('/api/friends/:userId/profile', authGuard, async (c) => {
  const userId = intParam(c.req.param('userId'), 'user ID');
  if (userId instanceof Response) return userId;
  return handleGetFriendProfile(c.req.raw, c.get('db'), userId, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/friends/:friendshipId/accept', authGuard, async (c) => {
  const friendshipId = intParam(c.req.param('friendshipId'), 'friendship ID');
  if (friendshipId instanceof Response) return friendshipId;
  return handleAcceptFriend(c.req.raw, c.get('db'), friendshipId, c.env.ALLOW_TEST_AUTH);
});
app.post('/api/friends/:friendshipId/reject', authGuard, async (c) => {
  const friendshipId = intParam(c.req.param('friendshipId'), 'friendship ID');
  if (friendshipId instanceof Response) return friendshipId;
  return handleRejectFriend(c.req.raw, c.get('db'), friendshipId, c.env.ALLOW_TEST_AUTH);
});
app.delete('/api/friends/:friendshipId', authGuard, async (c) => {
  const friendshipId = intParam(c.req.param('friendshipId'), 'friendship ID');
  if (friendshipId instanceof Response) return friendshipId;
  return handleUnfriend(c.req.raw, c.get('db'), friendshipId, c.env.ALLOW_TEST_AUTH);
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN API ROUTES (admin session required)
// ═══════════════════════════════════════════════════════════════════════════

// ── Dashboard & Users ──
app.get('/api/admin/dashboard', adminGuard, (c) =>
  handleAdminDashboard(c.req.raw, c.get('db')));
app.get('/api/admin/users', adminGuard, (c) =>
  handleAdminUsersList(c.req.raw, c.get('db')));

app.put('/api/admin/users/:id/verify', adminGuard, async (c) => {
  const userId = intParam(c.req.param('id'), 'user ID');
  if (userId instanceof Response) return userId;
  return handleAdminUserVerify(c.req.raw, c.get('db'), userId, c.get('adminUserId')!);
});
app.put('/api/admin/users/:id/reset', adminGuard, async (c) => {
  const userId = intParam(c.req.param('id'), 'user ID');
  if (userId instanceof Response) return userId;
  return handleAdminUserResetPassword(c.req.raw, c.get('db'), userId, c.get('adminUserId')!, c.env.RESEND_API_KEY);
});
app.put('/api/admin/users/:id/admin', adminGuard, async (c) => {
  const userId = intParam(c.req.param('id'), 'user ID');
  if (userId instanceof Response) return userId;
  return handleAdminUserToggleAdmin(c.req.raw, c.get('db'), userId, c.get('adminUserId')!);
});
app.delete('/api/admin/users/:id', adminGuard, async (c) => {
  const userId = intParam(c.req.param('id'), 'user ID');
  if (userId instanceof Response) return userId;
  return handleAdminUserDelete(c.req.raw, c.get('db'), userId, await c.req.json(), c.get('adminUserId')!);
});

// ── Metrics ──
app.get('/api/admin/metrics', adminGuard, (c) =>
  handleAdminMetricsSummary(c.req.raw, c.get('db')));
app.get('/api/admin/metrics/leaderboard', adminGuard, (c) =>
  handleAdminMetricsLeaderboard(c.req.raw, c.get('db')));
app.get('/api/admin/metrics/timeline', adminGuard, (c) =>
  handleAdminMetricsTimeline(c.req.raw, c.get('db')));

// ── Goals ──
app.get('/api/admin/goals', adminGuard, (c) =>
  handleAdminGoalsList(c.req.raw, c.get('db')));
app.post('/api/admin/goals', adminGuard, async (c) =>
  handleAdminGoalCreate(c.req.raw, c.get('db'), await c.req.json(), c.get('adminUserId')!));
app.get('/api/admin/goals/:id', adminGuard, async (c) => {
  const goalId = intParam(c.req.param('id'), 'goal ID');
  if (goalId instanceof Response) return goalId;
  return handleAdminGoalGet(c.req.raw, c.get('db'), goalId);
});
app.put('/api/admin/goals/:id', adminGuard, async (c) => {
  const goalId = intParam(c.req.param('id'), 'goal ID');
  if (goalId instanceof Response) return goalId;
  return handleAdminGoalUpdate(c.req.raw, c.get('db'), goalId, await c.req.json(), c.get('adminUserId')!);
});

// ── Storylines ──
app.get('/api/admin/storylines', adminGuard, (c) =>
  handleAdminStorylinesList(c.req.raw, c.get('db')));
app.post('/api/admin/storylines', adminGuard, async (c) =>
  handleAdminStorylineCreate(c.req.raw, c.get('db'), await c.req.json(), c.get('adminUserId')!));
app.get('/api/admin/storylines/:id', adminGuard, async (c) => {
  const id = intParam(c.req.param('id'), 'storyline ID');
  if (id instanceof Response) return id;
  return handleAdminStorylineGet(c.req.raw, c.get('db'), id);
});
app.put('/api/admin/storylines/:id', adminGuard, async (c) => {
  const id = intParam(c.req.param('id'), 'storyline ID');
  if (id instanceof Response) return id;
  return handleAdminStorylineUpdate(c.req.raw, c.get('db'), id, await c.req.json(), c.get('adminUserId')!);
});
app.put('/api/admin/storylines/:id/goals', adminGuard, async (c) => {
  const id = intParam(c.req.param('id'), 'storyline ID');
  if (id instanceof Response) return id;
  return handleAdminStorylineGoalsUpdate(c.req.raw, c.get('db'), id, await c.req.json(), c.get('adminUserId')!);
});

// ── Image Inventory ──
app.get('/api/admin/images', adminGuard, (c) =>
  handleAdminImageInventory(c.req.raw, c.get('db'), c.env.ASSETS));

// ── SPA fallback ──
app.get('/', (_c) => new Response(renderHomePage(), {
  headers: {
    'content-type': 'text/html',
    'cache-control': 'no-store, no-cache, must-revalidate',
    'pragma': 'no-cache',
  },
}));
app.get('/journey', (c) => c.html(renderHtml()));

// notFound handles SPA fallback, API 404s, and API 405s.
// Hono's wildcard middleware prevents automatic 405 generation,
// so we check registered routes manually.
app.notFound((c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname.startsWith('/api/')) {
    // Check registered routes for this path (any method).
    // If found with a different method → 405; otherwise → 404.
    const routes: Array<{ path: string; method: string }> = (app as unknown as { routes: Array<{ path: string; method: string }> }).routes;
    const allowed = new Set<string>();
    for (const r of routes) {
      if (r.method === 'ALL') continue;
      if (matchApiPattern(r.path, pathname)) {
        allowed.add(r.method);
      }
    }
    if (allowed.size > 0 && !allowed.has(c.req.method)) {
      const methods = [...allowed].join(', ');
      return new Response(JSON.stringify({
        error: `Method ${c.req.method} not allowed for ${pathname}`,
        allowedMethods: [...allowed],
      }), {
        status: 405,
        headers: { 'content-type': 'application/json', 'Allow': methods },
      });
    }
    return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  // All other paths get the SPA HTML shell
  return c.html(renderHtml());
});

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    // Serve static assets first (GET/HEAD only)
    if (request.method === 'GET' || request.method === 'HEAD') {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    return app.fetch(request, env, _ctx);
  },

  async scheduled(_event: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Run both independently — failure in one should not block the other
    try {
      await handleOneMoreMileCron(env);
    } catch (error: unknown) {
      console.error("Scheduled one-more-mile cron failed", error);
    }

    try {
      await handleReengagementCron(env);
    } catch (error: unknown) {
      console.error("Scheduled re-engagement cron failed", error);
    }
  },
} satisfies ExportedHandler<Env>;
