import { renderHtml } from "./renderHtml";
import { renderHomePage } from "./renderHomePage";
import { renderAuthPage } from "./renderAuthPage";
import { renderPasswordResetRequestPage, renderPasswordResetPage } from "./renderPasswordResetPage";
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod, 
  createErrorResponse, 
  createSuccessResponse 
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
  handlePasswordResetRequest,
  handlePasswordReset,
  handleConfirmEmail,
  handleResendConfirmation,
  validateSession,
  validateAdminSession
} from "./auth-handlers";
import { handleMapPage } from "./map-handlers";
import { handleCreateParty, handlePreviewParty, handleJoinParty, handleRegenerateInvite, handleGetUserParties, handlePartyProgress, handlePartyActivity, handleLeaveParty, handleKickMember, handleUpdatePartySettings, handleTransferLeadership } from "./party-handlers";
import { renderPartyListPage } from "./renderPartyListPage";
import { renderPartyDetailPage } from "./renderPartyDetailPage";
import { renderPartyManagePage } from "./renderPartyManagePage";
import { renderPartyJoinPage } from "./renderPartyJoinPage";
import { renderAdminPage } from "./renderAdminPage";
import { handleAdminDashboard } from "./admin-handlers";

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
    let body: any = undefined;

    // Only serve static assets for GET/HEAD requests
    if (method === "GET" || method === "HEAD") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

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
      body = parseResult.data;
    }

    // API endpoints
    if (url.pathname.startsWith("/api/")) {
      // Public authentication endpoints (no session required)
      if (url.pathname === "/api/register" && method === "POST") {
        return handleRegister(request, env, body);
      } else if (url.pathname === "/api/login" && method === "POST") {
        return handleLogin(request, env, body);
      } else if (url.pathname === "/api/logout" && method === "POST") {
        return handleLogout(request, env, body);
      } else if (url.pathname === "/api/session" && method === "GET") {
        return handleSessionValidation(request, env);
      } else if (url.pathname === "/api/profile" && method === "PUT") {
        return handleUpdateProfile(request, env, body);
      } else if (url.pathname === "/api/user/preferences" && method === "PUT") {
        return handleUpdatePreferences(request, env, body);
      } else if (url.pathname === "/api/password-reset-request" && method === "POST") {
        return handlePasswordResetRequest(request, env, body);
      } else if (url.pathname === "/api/password-reset" && method === "POST") {
        return handlePasswordReset(request, env, body);
      } else if (url.pathname === "/api/auth/confirm-email" && method === "GET") {
        return handleConfirmEmail(request, env);
      } else if (url.pathname === "/api/auth/resend-confirmation" && method === "POST") {
        return handleResendConfirmation(request, env, body);
      }
      
      // Protected endpoints (authentication required)
      // Admin API endpoints (admin authentication required)
      if (url.pathname.startsWith("/api/admin/")) {
        const adminValidation = await validateAdminSession(request, env);
        if (!adminValidation.valid) return adminValidation.error;

        // Admin API endpoints (Story 4.2+)
        if (url.pathname === "/api/admin/dashboard" && method === "GET") {
          return handleAdminDashboard(request, env);
        }

        return new Response(JSON.stringify({ error: 'Admin API endpoint not found' }), {
          status: 404,
          headers: { "content-type": "application/json" }
        });
      }

      // Party (Fellowship) endpoints
      if (url.pathname === "/api/party" && method === "POST") {
        return handleCreateParty(request, env, body);
      }

      // GET /api/user/parties — list user's party memberships (auth required)
      if (url.pathname === "/api/user/parties" && method === "GET") {
        return handleGetUserParties(request, env);
      }

      // Parameterized party routes
      const joinParams = matchRoute(url.pathname, '/api/party/join/:inviteCode');
      if (joinParams) {
        if (method === "GET") {
          return handlePreviewParty(request, env, joinParams.inviteCode);
        } else if (method === "POST") {
          return handleJoinParty(request, env, joinParams.inviteCode);
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
        return handleRegenerateInvite(request, env, partyId);
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
        return handlePartyProgress(request, env, partyId);
      }

      // GET /api/party/:id/activity — party activity feed
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
        return handlePartyActivity(request, env, partyId);
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
        return handleLeaveParty(request, env, partyId);
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
        return handleKickMember(request, env, partyId, targetUserId, body);
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
        return handleUpdatePartySettings(request, env, partyId, body);
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
        return handleTransferLeadership(request, env, partyId, body);
      }

      // CRUD for calendar events
      if (url.pathname === "/api/calendar-progress" && method === "POST") {
        return handleProgressPost(request, env, body);
      } else if (url.pathname === "/api/calendar-progress" && method === "PUT") {
        return handleProgressPut(request, env, body);
      } else if (url.pathname === "/api/calendar-progress" && method === "DELETE") {
        return handleProgressDelete(request, env, body);
      } else if (url.pathname === "/api/calendar-progress") {
        return handleProgressGet(request, env);
      } else if (url.pathname === "/api/goals") {
        return handleGoalsGet(request, env);
      } else if (url.pathname === "/api/total-distance") {
        // Validate session first
        const sessionValidation = await validateSession(request, env);
        if (!sessionValidation.valid) {
          return sessionValidation.error;
        }
        
        try {
          const totalDistance = await calculateTotalDistance(env, sessionValidation.userId!);
          return new Response(JSON.stringify({ totalDistance }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error: any) {
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

    // Admin page (admin authentication required)
    if (url.pathname === "/admin") {
      const adminValidation = await validateAdminSession(request, env);
      if (!adminValidation.valid) return adminValidation.error;
      return new Response(renderAdminPage(), {
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
} satisfies ExportedHandler<Env>;

// Helper function to get allowed methods for API endpoints
function getAllowedMethods(pathname: string): string[] {
  switch (pathname) {
    case "/api/calendar-progress":
      return ['GET', 'POST', 'PUT', 'DELETE'];
    case "/api/goals":
    case "/api/total-distance":
    case "/api/session":
    case "/api/auth/confirm-email":
    case "/api/user/parties":
    case "/api/admin/dashboard":
      return ['GET'];
    case "/api/register":
    case "/api/login":
    case "/api/logout":
    case "/api/password-reset-request":
    case "/api/password-reset":
    case "/api/auth/resend-confirmation":
    case "/api/party":
      return ['POST'];
    case "/api/profile":
    case "/api/user/preferences":
      return ['PUT'];
    default:
      // Admin API routes
      if (pathname.startsWith('/api/admin/')) {
        return ['GET', 'POST', 'PUT', 'DELETE'];
      }
      // Parameterized routes
      if (matchRoute(pathname, '/api/party/join/:inviteCode')) {
        return ['GET', 'POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/invite')) {
        return ['POST'];
      }
      if (matchRoute(pathname, '/api/party/:id/progress')) {
        return ['GET'];
      }
      if (matchRoute(pathname, '/api/party/:id/activity')) {
        return ['GET'];
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
      return ['GET'];
  }
}
