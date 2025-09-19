// Helper function to validate date format (yyyy-MM-dd)
export function isValidDateFormat(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }
  
  // Check basic format with regex
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  // Parse the date components
  const [year, month, day] = dateString.split('-').map(Number);
  
  // Basic range checks
  if (year < 1000 || year > 9999) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  
  // Create date and verify it's valid (handles leap years, month lengths, etc.)
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && 
         date.getMonth() === month - 1 && 
         date.getDate() === day;
}

// Reasonable upper limit for distance values
const MAX_DISTANCE_VALUE = 999999999;

// Helper function to validate distance value
export function isValidDistance(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  
  const num = Number(value);
  return !isNaN(num) && isFinite(num) && num >= 0 && num <= MAX_DISTANCE_VALUE;
}

// Helper function to safely parse JSON
export async function safeJsonParse(request: Request): Promise<{success: boolean, data?: any, error?: string}> {
  try {
    const text = await request.text();
    if (!text || text.trim() === '') {
      return { success: false, error: 'Request body is empty' };
    }
    
    const data = JSON.parse(text);
    
    // Additional validation for request structure
    if (typeof data !== 'object' || data === null) {
      return { success: false, error: 'Request body must be a JSON object' };
    }
    
    return { success: true, data };
  } catch (error) {
    return { success: false, error: 'Invalid JSON format' };
  }
}

// Helper function to validate HTTP method for endpoint
export function isValidMethod(pathname: string, method: string): boolean {
  if (pathname === "/wtm/api/calendar-progress") {
    return ['GET', 'POST', 'PUT', 'DELETE'].includes(method);
  }
  if (pathname === "/wtm/api/goals") {
    return method === 'GET';
  }
  // OAuth endpoints
  if (pathname === "/wtm/api/auth/google" || pathname === "/wtm/api/auth/facebook") {
    return method === 'GET';
  }
  if (pathname === "/wtm/api/auth/callback" || 
      pathname === "/wtm/api/auth/logout" || 
      pathname === "/wtm/api/auth/refresh") {
    return method === 'POST';
  }
  // Samsung Health endpoints
  if (pathname === "/wtm/api/samsung-health/link") {
    return method === 'GET';
  }
  if (pathname === "/wtm/api/samsung-health/callback" || 
      pathname === "/wtm/api/sync/samsung-health") {
    return method === 'POST';
  }
  return false;
}

// Helper function to create error response
export function createErrorResponse(error: string, status: number = 400) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" }
  });
}

// Helper function to create success response
export function createSuccessResponse(data: any, status: number = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" }
  });
}
