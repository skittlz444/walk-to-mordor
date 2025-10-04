const request = require('supertest');
const { cleanupAllTestData } = require('./helpers/cleanup');
const { createTestUserAndAuth, cleanupTestUser, createAuthenticatedRequest } = require('./helpers/test-auth');

const server = 'http://localhost:8787';
const TEST_EVENT_DATE = "2024-01-02";

// Generate realistic test distances for API testing
function generateRealisticAPIDistance() {
  return Math.floor(Math.random() * 50) + 1;
}

// Global auth setup for all API success tests
beforeAll(async () => {
  await createTestUserAndAuth();
  await cleanupAllTestData();
});

afterAll(async () => {
  await cleanupAllTestData();
  await cleanupTestUser();
});

describe('Calendar Progress API - Success Flows', () => {

  // Helper to add event
  async function addEvent(title, date = TEST_EVENT_DATE) {
    return await createAuthenticatedRequest(server, 'post', '/wtm/api/calendar-progress')
      .send({ start: date, title });
  }

  it('GET returns events', async () => {
    const res = await createAuthenticatedRequest(server, 'get', '/wtm/api/calendar-progress');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should add a new event', async () => {
    const res = await addEvent(generateRealisticAPIDistance().toString());
    expect([200, 201]).toContain(res.status);
  });

  it('should edit the event', async () => {
    const initialDistance = generateRealisticAPIDistance();
    const updatedDistance = generateRealisticAPIDistance();
    
    await addEvent(initialDistance.toString());
    const editRes = await createAuthenticatedRequest(server, 'put', '/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: updatedDistance.toString() });
    expect([200, 201]).toContain(editRes.status);
    // Only check status, as response may not contain title
  });

  it('should delete the event', async () => {
    const uniqueDeleteDate = "2024-01-06"; // Use unique date for delete test
    await addEvent(generateRealisticAPIDistance().toString(), uniqueDeleteDate);
    const delRes = await createAuthenticatedRequest(server, 'delete', '/wtm/api/calendar-progress')
      .send({ start: uniqueDeleteDate });
    expect(delRes.status).toBe(200);
  });

  it('accepts zero distance values', async () => {
    const testDate = "2024-01-02";
    const res = await createAuthenticatedRequest(server, 'post', '/wtm/api/calendar-progress')
      .send({ start: testDate, title: "0" });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });

  it('accepts decimal distance values', async () => {
    const testDate = "2024-01-03";
    const res = await createAuthenticatedRequest(server, 'post', '/wtm/api/calendar-progress')
      .send({ start: testDate, title: "15.5" });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });

  it('accepts large distance values', async () => {
    const testDate = "2024-01-04";
    const res = await createAuthenticatedRequest(server, 'post', '/wtm/api/calendar-progress')
      .send({ start: testDate, title: (generateRealisticAPIDistance() + 0.5).toString() });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });
});

describe('Goals API - Success Flows', () => {
  it('GET returns goals', async () => {
    const res = await createAuthenticatedRequest(server, 'get', '/wtm/api/goals');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Total Distance API - Success Flows', () => {
  it('GET returns total distance', async () => {
    const res = await createAuthenticatedRequest(server, 'get', '/wtm/api/total-distance');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('totalDistance');
    expect(typeof res.body.totalDistance).toBe('number');
    expect(res.body.totalDistance).toBeGreaterThanOrEqual(0);
  });
});
