import { renderHtml } from "./renderHtml";
import { renderHomePage } from "./renderHomePage";
import { renderAuthPage } from "./renderAuthPage";
import { renderPasswordResetRequestPage, renderPasswordResetPage } from "./renderPasswordResetPage";
import { 
  safeJsonParse, 
  createErrorResponse, 
} from "./validators";
import { 
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from "./progress-handlers";
import { 
  handleGoalsGet, 
  calculateTotalDistance 
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
import { createDbClient } from './db';
import { handleWeeklyStats, handleHeatmap, handleWrappedStats } from './stats-handlers';
import {
  handlePushSubscribe,
  handlePushUnsubscribe,
  handlePushStatus,
  handlePushSettings,
  handleVapidKey,
} from './push-handlers';
import { handleOneMoreMileCron, handleReengagementCron } from './scheduled-handlers';
import {
  handleGetStorylines,
  handleSetActiveStoryline,
  handleSetPartyStoryline,
} from './storyline-handlers';

/**
 * Match a URL pathname against a parameterized route pattern.
 * Returns null if no match, or an object with extracted params.
 * E.g., matchRoute('/api/party/join/AbCd1234', '/api/party/join/:inviteCode')
 *   => { inviteCode: 'AbCd1234' }
 */
function matchRoute(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.split('/');
  const patternParts = pattern.split('/');
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':')) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    let body: Record<string, unknown> | undefined;

    // Only serve static assets for GET/HEAD requests
    if (method === "GET" || method === "HEAD") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    const db = createDbClient(env.DB);

    // Validate HTTP method for API endpoints
    if (url.pathname.startsWith("/api/")) {
      const allowedMethods = getAllowedMethods(url.pathname);
      if (!allowedMethods.includes(method)) {
        return new Response(JSON.stringify({ 
          error: `Method ${method} not allowed for ${url.pathname}`,
          allowedMethods
        }), { 
          status: 405,
          headers: { 
            "content-type": "application/json",
            "Allow": allowedMethods.join(", ")
          }
        });
      }
    }

    // Only read body for API endpoints that need it
    if (
      url.pathname.startsWith("/api/") &&
      (method === "POST" || method === "PUT" || method === "DELETE")
    ) {
      const parseResult = await safeJsonParse(request);
      if (!parseResult.success) {
        return new Response(JSON.stringify({ 
          error: parseResult.error || 'Invalid request body' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      body = parseResult.data as Record<string, unknown>;
    }

    // API endpoints
    if (url.pathname.startsWith("/api/")) {
      // Public authentication endpoints (no session required)
      if (url.pathname === "/api/register" && method === "POST") {
        return handleRegister(request, db, body, env);
      } else if (url.pathname === "/api/login" && method === "POST") {
        return handleLogin(request, db, body);
      } else if (url.pathname === "/api/logout" && method === "POST") {
        return handleLogout(request, db, body);
      } else if (url.pathname === "/api/session" && method === "GET") {
        return handleSessionValidation(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/profile" && method === "PUT") {
        return handleUpdateProfile(request, db, body, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/user/preferences" && method === "PUT") {
        return handleUpdatePreferences(request, db, body, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/avatars" && method === "GET") {
        return handleGetAvatars(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/password-reset-request" && method === "POST") {
        return handlePasswordResetRequest(request, db, body, env);
      } else if (url.pathname === "/api/password-reset" && method === "POST") {
        return handlePasswordReset(request, db, body);
      } else if (url.pathname === "/api/auth/confirm-email" && method === "GET") {
        return handleConfirmEmail(request, db);
      } else if (url.pathname === "/api/auth/resend-confirmation" && method === "POST") {
        return handleResendConfirmation(request, db, body, env);
      } else if (url.pathname === "/api/push/vapid-key" && method === "GET") {
        return handleVapidKey(env);
      }
      
      // Protected endpoints (authentication required)
      // Admin API endpoints (admin authentication required)
      if (url.pathname.startsWith("/api/admin/")) {
        const adminValidation = await validateAdminSession(request, db, env.ALLOW_TEST_AUTH);
        if (!adminValidation.valid) return adminValidation.error;

        // Admin API endpoints (Story 4.2+)
        if (url.pathname === "/api/admin/dashboard" && method === "GET") {
          return handleAdminDashboard(request, db);
        }

        if (url.pathname === "/api/admin/users" && method === "GET") {
          return handleAdminUsersList(request, db);
        }

        if (url.pathname === "/api/admin/metrics" && method === "GET") {
          return handleAdminMetricsSummary(request, db);
        }
        if (url.pathname === "/api/admin/metrics/leaderboard" && method === "GET") {
          return handleAdminMetricsLeaderboard(request, db);
        }
        if (url.pathname === "/api/admin/metrics/timeline" && method === "GET") {
          return handleAdminMetricsTimeline(request, db);
        }

        // Admin Goals List (Story 4.3) / Create (Story 4.6)
        if (url.pathname === "/api/admin/goals" && method === "GET") {
          return handleAdminGoalsList(request, db);
        }
        if (url.pathname === "/api/admin/goals" && method === "POST") {
          return handleAdminGoalCreate(request, db, body, adminValidation.userId);
        }

        // Admin Image Inventory (Story 4.5)
        if (url.pathname === "/api/admin/images" && method === "GET") {
          return handleAdminImageInventory(request, db, env.ASSETS);
        }

        // Admin Goal Detail / Update (Story 4.4)
        const adminGoalParams = matchRoute(url.pathname, '/api/admin/goals/:id');
        if (adminGoalParams) {
          const goalId = Number.parseInt(adminGoalParams.id, 10);
          if (!Number.isInteger(goalId) || goalId <= 0 || String(goalId) !== adminGoalParams.id) {
            return createErrorResponse('Invalid goal ID', 400);
          }
          if (method === 'GET') return handleAdminGoalGet(request, db, goalId);
          if (method === 'PUT') return handleAdminGoalUpdate(request, db, goalId, body, adminValidation.userId);
        }

        const adminUserVerifyParams = matchRoute(url.pathname, '/api/admin/users/:id/verify');
        if (adminUserVerifyParams) {
          const userId = Number.parseInt(adminUserVerifyParams.id, 10);
          if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== adminUserVerifyParams.id) {
            return createErrorResponse('Invalid user ID', 400);
          }
          if (method === 'PUT') return handleAdminUserVerify(request, db, userId, adminValidation.userId);
        }

        const adminUserResetParams = matchRoute(url.pathname, '/api/admin/users/:id/reset');
        if (adminUserResetParams) {
          const userId = Number.parseInt(adminUserResetParams.id, 10);
          if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== adminUserResetParams.id) {
            return createErrorResponse('Invalid user ID', 400);
          }
          if (method === 'PUT') return handleAdminUserResetPassword(request, db, userId, adminValidation.userId, env.RESEND_API_KEY);
        }

        const adminUserToggleAdminParams = matchRoute(url.pathname, '/api/admin/users/:id/admin');
        if (adminUserToggleAdminParams) {
          const userId = Number.parseInt(adminUserToggleAdminParams.id, 10);
          if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== adminUserToggleAdminParams.id) {
            return createErrorResponse('Invalid user ID', 400);
          }
          if (method === 'PUT') return handleAdminUserToggleAdmin(request, db, userId, adminValidation.userId);
        }

        const adminUserParams = matchRoute(url.pathname, '/api/admin/users/:id');
        if (adminUserParams) {
          const userId = Number.parseInt(adminUserParams.id, 10);
          if (!Number.isInteger(userId) || userId <= 0 || String(userId) !== adminUserParams.id) {
            return createErrorResponse('Invalid user ID', 400);
          }
          if (method === 'DELETE') return handleAdminUserDelete(request, db, userId, body, adminValidation.userId);
        }

        return new Response(JSON.stringify({ error: 'Admin API endpoint not found' }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      }

      // Party (Fellowship) endpoints
      if (url.pathname === "/api/party" && method === "POST") {
        return handleCreateParty(request, db, body!, env.ALLOW_TEST_AUTH);
      }

      // Storyline endpoints (multi-storyline foundation)
      if (url.pathname === "/api/storylines" && method === "GET") {
        return handleGetStorylines(request, db, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/user/active-storyline" && method === "PUT") {
        return handleSetActiveStoryline(request, db, body, env.ALLOW_TEST_AUTH);
      }
      const partyStorylineParams = matchRoute(url.pathname, '/api/party/:id/storyline');
      if (partyStorylineParams && method === "PUT") {
        const partyId = Number.parseInt(partyStorylineParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== partyStorylineParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleSetPartyStoryline(request, db, partyId, body, env.ALLOW_TEST_AUTH);
      }

      // GET /api/user/parties — list user's party memberships (auth required)
      if (url.pathname === "/api/user/parties" && method === "GET") {
        return handleGetUserParties(request, db, env.ALLOW_TEST_AUTH);
      }

      // GET /api/user/parties/positions — get fellowship positions for map display
      if (url.pathname === "/api/user/parties/positions" && method === "GET") {
        return handlePartyPositions(request, db, env.ALLOW_TEST_AUTH);
      }

      // GET /api/user/fellowship-invites — list pending fellowship invites
      if (url.pathname === "/api/user/fellowship-invites" && method === "GET") {
        return handleGetFellowshipInvites(request, db, env.ALLOW_TEST_AUTH);
      }

      // POST /api/user/fellowship-invites/:inviteId/accept
      const acceptInviteParams = matchRoute(url.pathname, '/api/user/fellowship-invites/:inviteId/accept');
      if (acceptInviteParams && method === "POST") {
        const inviteId = Number.parseInt(acceptInviteParams.inviteId, 10);
        if (
          !Number.isInteger(inviteId) ||
          inviteId <= 0 ||
          String(inviteId) !== acceptInviteParams.inviteId
        ) {
          return createErrorResponse('Invalid invite ID', 400);
        }
        return handleAcceptFellowshipInvite(request, db, inviteId, env.ALLOW_TEST_AUTH);
      }

      // POST /api/user/fellowship-invites/:inviteId/reject
      const rejectInviteParams = matchRoute(url.pathname, '/api/user/fellowship-invites/:inviteId/reject');
      if (rejectInviteParams && method === "POST") {
        const inviteId = Number.parseInt(rejectInviteParams.inviteId, 10);
        if (
          !Number.isInteger(inviteId) ||
          inviteId <= 0 ||
          String(inviteId) !== rejectInviteParams.inviteId
        ) {
          return createErrorResponse('Invalid invite ID', 400);
        }
        return handleRejectFellowshipInvite(request, db, inviteId, env.ALLOW_TEST_AUTH);
      }

      // Parameterized party routes
      const joinParams = matchRoute(url.pathname, '/api/party/join/:inviteCode');
      if (joinParams) {
        if (method === "GET") {
          return handlePreviewParty(request, db, joinParams.inviteCode);
        } else if (method === "POST") {
          return handleJoinParty(request, db, joinParams.inviteCode, env.ALLOW_TEST_AUTH);
        }
      }

      const inviteParams = matchRoute(url.pathname, '/api/party/:id/invite');
      if (inviteParams && method === "POST") {
        const partyId = Number.parseInt(inviteParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== inviteParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleRegenerateInvite(request, db, partyId, env.ALLOW_TEST_AUTH);
      }

      // POST /api/party/:id/invite-friend— invite an accepted friend to a party
      const inviteFriendParams = matchRoute(url.pathname, '/api/party/:id/invite-friend');
      if (inviteFriendParams && method === "POST") {
        const partyId = Number.parseInt(inviteFriendParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== inviteFriendParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleInviteFriend(request, db, partyId, body!, env.ALLOW_TEST_AUTH);
      }

      // GET /api/party/:id/progress — party progress calculation
      const progressParams = matchRoute(url.pathname, '/api/party/:id/progress');
      if (progressParams && method === "GET") {
        const partyId = Number.parseInt(progressParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== progressParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handlePartyProgress(request, db, partyId, env.ALLOW_TEST_AUTH);
      }

      // GET /api/party/:id/activity— party activity feed
      const activityParams = matchRoute(url.pathname, '/api/party/:id/activity');
      if (activityParams && method === "GET") {
        const partyId = Number.parseInt(activityParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== activityParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handlePartyActivity(request, db, partyId, env.ALLOW_TEST_AUTH);
      }

      // POST /api/party/:id/messages— send a message to party feed
      const messagesParams = matchRoute(url.pathname, '/api/party/:id/messages');
      if (messagesParams && method === "POST") {
        const partyId = Number.parseInt(messagesParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== messagesParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleSendPartyMessage(request, db, partyId, body!, env.ALLOW_TEST_AUTH);
      }

      // POST /api/party/:id/leave — leave party
      const leaveParams = matchRoute(url.pathname, '/api/party/:id/leave');
      if (leaveParams && method === "POST") {
        const partyId = Number.parseInt(leaveParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== leaveParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleLeaveParty(request, db, partyId, env.ALLOW_TEST_AUTH);
      }

      // POST /api/party/:id/kick/:userId — kick member (leader only)
      const kickParams = matchRoute(url.pathname, '/api/party/:id/kick/:userId');
      if (kickParams && method === "POST") {
        const partyId = Number.parseInt(kickParams.id, 10);
        const targetUserId = Number.parseInt(kickParams.userId, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== kickParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        if (
          !Number.isInteger(targetUserId) ||
          targetUserId <= 0 ||
          String(targetUserId) !== kickParams.userId
        ) {
          return createErrorResponse('Invalid user ID', 400);
        }
        return handleKickMember(request, db, partyId, targetUserId, body!, env.ALLOW_TEST_AUTH);
      }

      // PUT /api/party/:id/settings — update party settings (leader only)
      const settingsParams = matchRoute(url.pathname, '/api/party/:id/settings');
      if (settingsParams && method === "PUT") {
        const partyId = Number.parseInt(settingsParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== settingsParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleUpdatePartySettings(request, db, partyId, body!, env.ALLOW_TEST_AUTH);
      }

      // POST /api/party/:id/transfer-leadership — transfer leadership (leader only)
      const transferParams = matchRoute(url.pathname, '/api/party/:id/transfer-leadership');
      if (transferParams && method === "POST") {
        const partyId = Number.parseInt(transferParams.id, 10);
        if (
          !Number.isInteger(partyId) ||
          partyId <= 0 ||
          String(partyId) !== transferParams.id
        ) {
          return createErrorResponse('Invalid party ID', 400);
        }
        return handleTransferLeadership(request, db, partyId, body!, env.ALLOW_TEST_AUTH);
      }

      // Friends (Social) endpoints — exact routes first, then parameterized
      if (url.pathname === "/api/friends" && method === "GET") {
        return handleGetFriends(request, db, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/friends/pending" && method === "GET") {
        return handleGetPendingFriends(request, db, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/friends/search" && method === "GET") {
        return handleSearchUsers(request, db, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/friends/request" && method === "POST") {
        return handleFriendRequest(request, db, body!, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/friends/request/code" && method === "POST") {
        return handleFriendRequestByCode(request, db, body!, env.ALLOW_TEST_AUTH);
      }
      if (url.pathname === "/api/friends/positions" && method === "GET") {
        return handleFriendPositions(request, db, env.ALLOW_TEST_AUTH);
      }

      // Parameterized friend routes — resolve before friendshipId routes
      const resolveParams = matchRoute(url.pathname, '/api/friends/resolve/:friendCode');
      if (resolveParams && method === "GET") {
        return handleResolveFriendCode(request, db, resolveParams.friendCode);
      }

      // GET /api/friends/:userId/profile — friend profile (before generic :friendshipId routes)
      const profileParams = matchRoute(url.pathname, '/api/friends/:userId/profile');
      if (profileParams && method === "GET") {
        const profileUserId = Number.parseInt(profileParams.userId, 10);
        if (!Number.isInteger(profileUserId) || profileUserId <= 0 || String(profileUserId) !== profileParams.userId) {
          return createErrorResponse('Invalid user ID', 400);
        }
        return handleGetFriendProfile(request, db, profileUserId, env.ALLOW_TEST_AUTH);
      }

      const acceptParams= matchRoute(url.pathname, '/api/friends/:friendshipId/accept');
      if (acceptParams && method === "POST") {
        const friendshipId = Number.parseInt(acceptParams.friendshipId, 10);
        if (!Number.isInteger(friendshipId) || friendshipId <= 0 || String(friendshipId) !== acceptParams.friendshipId) {
          return createErrorResponse('Invalid friendship ID', 400);
        }
        return handleAcceptFriend(request, db, friendshipId, env.ALLOW_TEST_AUTH);
      }

      const rejectParams= matchRoute(url.pathname, '/api/friends/:friendshipId/reject');
      if (rejectParams && method === "POST") {
        const friendshipId = Number.parseInt(rejectParams.friendshipId, 10);
        if (!Number.isInteger(friendshipId) || friendshipId <= 0 || String(friendshipId) !== rejectParams.friendshipId) {
          return createErrorResponse('Invalid friendship ID', 400);
        }
        return handleRejectFriend(request, db, friendshipId, env.ALLOW_TEST_AUTH);
      }

      // DELETE /api/friends/:friendshipId — unfriend
      const unfriendParams = matchRoute(url.pathname, '/api/friends/:friendshipId');
      if (unfriendParams && method === "DELETE") {
        const friendshipId = Number.parseInt(unfriendParams.friendshipId, 10);
        if (!Number.isInteger(friendshipId) || friendshipId <= 0 || String(friendshipId) !== unfriendParams.friendshipId) {
          return createErrorResponse('Invalid friendship ID', 400);
        }
        return handleUnfriend(request, db, friendshipId, env.ALLOW_TEST_AUTH);
      }

      // CRUD for calendar events
      if (url.pathname === "/api/calendar-progress" && method === "POST") {
        return handleProgressPost(request, db, body!, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/calendar-progress" && method === "PUT") {
        return handleProgressPut(request, db, body!, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/calendar-progress" && method === "DELETE") {
        return handleProgressDelete(request, db, body!, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/calendar-progress") {
        return handleProgressGet(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/goals") {
        return handleGoalsGet(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/stats/weekly" && method === "GET") {
        return handleWeeklyStats(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/stats/heatmap" && method === "GET") {
        return handleHeatmap(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/stats/wrapped" && method === "GET") {
        return handleWrappedStats(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/push/subscribe" && method === "POST") {
        return handlePushSubscribe(request, db, body, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/push/subscribe" && method === "DELETE") {
        return handlePushUnsubscribe(request, db, body, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/push/status" && method === "GET") {
        return handlePushStatus(request, db, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/push/settings" && method === "PUT") {
        return handlePushSettings(request, db, body, env.ALLOW_TEST_AUTH);
      } else if (url.pathname === "/api/total-distance") {
        // Validate session first
        const sessionValidation = await validateSession(request, db, env.ALLOW_TEST_AUTH);
        if (!sessionValidation.valid) {
          return sessionValidation.error;
        }
        
        try {
          const totalDistance = await calculateTotalDistance(db, sessionValidation.userId!);
          return new Response(JSON.stringify({ totalDistance }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error: unknown) {
          console.error('Database error during total distance calculation:', error);
          return new Response(JSON.stringify({ 
            error: 'Internal server error while calculating total distance' 
          }), { 
            status: 500,
            headers: { "content-type": "application/json" }
          });
        }
      }
      
      // Unknown API endpoint
      return new Response(JSON.stringify({ error: 'API endpoint not found' }), {
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    // Main page - serve auth page for /login
    if (url.pathname === "/login") {
      return new Response(renderAuthPage(), {
        headers: {
          "content-type": "text/html",
        },
      });
    }
    
    // Password reset request page
    if (url.pathname === "/password-reset") {
      return new Response(renderPasswordResetRequestPage(), {
        headers: {
          "content-type": "text/html",
        },
      });
    }
    
    // Password reset with token page
    if (url.pathname === "/reset-password") {
      return new Response(renderPasswordResetPage(), {
        headers: {
          "content-type": "text/html",
        },
      });
    }

    if (url.pathname === "/map") {
      return handleMapPage(request, env);
    }

    // Admin page — auth handled client-side by Preact islands
    if (url.pathname === "/admin") {
      return new Response(renderAdminPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    // Admin Goals list page — auth handled client-side by Preact islands
    if (url.pathname === "/admin/goals") {
      return new Response(renderAdminGoalsPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    if (url.pathname === "/admin/users") {
      return new Response(renderAdminUsersPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    if (url.pathname === "/admin/metrics") {
      return new Response(renderAdminMetricsPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    // Admin Goal Add page — auth handled client-side by Preact islands
    // MUST be matched BEFORE /admin/goals/:id to prevent "new" being parsed as an id
    if (url.pathname === "/admin/goals/new") {
      return new Response(renderAdminGoalAddPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    // Admin Goal Edit page — auth handled client-side by Preact islands
    const adminGoalEditParams = matchRoute(url.pathname, '/admin/goals/:id');
    if (adminGoalEditParams) {
      const goalId = Number.parseInt(adminGoalEditParams.id, 10);
      if (!Number.isInteger(goalId) || goalId <= 0 || String(goalId) !== adminGoalEditParams.id) {
        return new Response('Not Found', { status: 404 });
      }
      return new Response(renderAdminGoalEditPage(), {
        headers: { "content-type": "text/html" },
      });
    }

    // Party (Fellowship) pages
    // Must check /party/join/:code before /party/:id to avoid matching "join" as an id
    const partyJoinPageParams = matchRoute(url.pathname, '/party/join/:inviteCode');
    if (partyJoinPageParams) {
      return new Response(renderPartyJoinPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    const partyManagePageParams = matchRoute(url.pathname, '/party/:id/manage');
    if (partyManagePageParams) {
      return new Response(renderPartyManagePage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    const partyDetailPageParams = matchRoute(url.pathname, '/party/:id');
    if (partyDetailPageParams) {
      return new Response(renderPartyDetailPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    if (url.pathname === "/party") {
      return new Response(renderPartyListPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    // Friends pages — exact /friends first, then /friends/add/:friendCode, then /friends/:id
    if (url.pathname === "/friends") {
      return new Response(renderFriendsPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    if (url.pathname === "/stats") {
      return new Response(renderStatsPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    const friendAddPageParams = matchRoute(url.pathname, '/friends/add/:friendCode');
    if (friendAddPageParams) {
      return new Response(renderFriendAddPage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    const friendProfilePageParams = matchRoute(url.pathname, '/friends/:id');
    if (friendProfilePageParams) {
      return new Response(renderFriendProfilePage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    if (url.pathname === "/profile") {
      return new Response(renderProfilePage(), {
        headers: { 'content-type': 'text/html' },
      });
    }

    if (url.pathname === "/") {
      return new Response(renderHomePage(), {
        headers: {
          "content-type": "text/html",
          "cache-control": "no-store, no-cache, must-revalidate",
          "pragma": "no-cache",
        },
      });
    }

    if (url.pathname === "/journey") {
      return new Response(renderHtml(), {
        headers: {
          "content-type": "text/html",
        },
      });
    }
    
    // Main app fallback page
    return new Response(renderHtml(), {
      headers: {
        "content-type": "text/html",
      },
    });
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

// Helper function to get allowed methods for API endpoints
function getAllowedMethods(pathname: string): string[] {
  switch (pathname) {
    case "/api/calendar-progress":
      return ['GET', 'POST', 'PUT', 'DELETE'];
    case "/api/goals":
    case "/api/stats/weekly":
    case "/api/stats/heatmap":
    case "/api/stats/wrapped":
    case "/api/total-distance":
    case "/api/session":
    case "/api/avatars":
    case "/api/push/status":
    case "/api/push/vapid-key":
    case "/api/auth/confirm-email":
    case "/api/user/parties":
    case "/api/user/parties/positions":
    case "/api/user/fellowship-invites":
    case "/api/friends":
    case "/api/friends/pending":
    case "/api/friends/search":
    case "/api/friends/positions":
    case "/api/admin/dashboard":
    case "/api/admin/users":
    case "/api/admin/metrics":
    case "/api/admin/metrics/leaderboard":
    case "/api/admin/metrics/timeline":
    case "/api/admin/images":
    case "/api/storylines":
      return ['GET'];
    case "/api/admin/goals":
      return ['GET', 'POST'];
    case "/api/register":
    case "/api/login":
    case "/api/logout":
    case "/api/password-reset-request":
    case "/api/password-reset":
    case "/api/auth/resend-confirmation":
    case "/api/party":
    case "/api/friends/request":
    case "/api/friends/request/code":
      return ['POST'];
    case "/api/push/subscribe":
      return ['POST', 'DELETE'];
    case "/api/profile":
    case "/api/user/preferences":
    case "/api/push/settings":
    case "/api/user/active-storyline":
      return ['PUT'];
    default:
      // Admin API routes
      if (pathname.startsWith('/api/admin/')) {
        if (matchRoute(pathname, '/api/admin/goals/:id')) return ['GET', 'PUT'];
        if (matchRoute(pathname, '/api/admin/users/:id')) return ['DELETE'];
        if (matchRoute(pathname, '/api/admin/users/:id/verify')) return ['PUT'];
        if (matchRoute(pathname, '/api/admin/users/:id/reset')) return ['PUT'];
        if (matchRoute(pathname, '/api/admin/users/:id/admin')) return ['PUT'];
        // Unknown admin routes — restrict to safe default; the handler will return 404
        return ['GET'];
      }
      // Parameterized routes
      if (matchRoute(pathname, '/api/party/join/:inviteCode')) {
        return ['GET', 'POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/invite')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/invite-friend')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/progress')) {
        return ['GET'];
      }
      if (matchRoute(pathname, '/api/party/:id/activity')) {
        return ['GET'];
      }
      if (matchRoute(pathname, '/api/party/:id/messages')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/leave')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/kick/:userId')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/settings')) {
        return ['PUT'];
      }
      if (matchRoute(pathname, '/api/party/:id/transfer-leadership')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/storyline')) {
        return ['PUT'];
      }
      // Fellowship invite parameterized routes
      if (matchRoute(pathname, '/api/user/fellowship-invites/:inviteId/accept')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/user/fellowship-invites/:inviteId/reject')) {
        return ['POST'];
      }
      // Friend parameterized routes
      if (matchRoute(pathname, '/api/friends/resolve/:friendCode')) {
        return ['GET'];
      }
      if (matchRoute(pathname, '/api/friends/:userId/profile')) {
        return ['GET'];
      }
      if (matchRoute(pathname, '/api/friends/:friendshipId/accept')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/friends/:friendshipId/reject')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/friends/:friendshipId')) {
        return ['DELETE'];
      }
      return ['GET'];
  }
}
