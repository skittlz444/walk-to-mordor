const request = require('supertest');
// Replace with your server import or setup
const server = 'http://localhost:8787';

// Use a fixed test date in 2024 for all API event tests
const TEST_EVENT_DATE = "2024-01-02"; // Jan 2, 2024

describe('Calendar Progress API', () => {
  it('GET /wtm/api/calendar-progress returns events', async () => {
    const res = await request(server).get('/wtm/api/calendar-progress');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should add a new event', async () => {
    const res = await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: "999999" });
    expect(res.status).toBe(201);
  });

  it('should edit the event', async () => {
    // Add event first
    const addRes = await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: "888888" });
    // Edit event
    const editRes = await request(server)
      .put('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: "888888" });
    expect(editRes.status).toBe(200);
  });

  it('should delete the event', async () => {
    // Add event first
    await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: "888888" });
    // Delete event
    const delRes = await request(server)
      .delete('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE });
    expect(delRes.status).toBe(200);
    // Optionally check response body shape if needed
  });

  it('POST /wtm/api/calendar-progress rejects invalid payload', async () => {
    const res = await request(server).post('/wtm/api/calendar-progress').send({});
    expect([400, 422]).toContain(res.statusCode);
  });
});

describe('Goals API', () => {
  it('GET /wtm/api/goals returns goals', async () => {
    const res = await request(server).get('/wtm/api/goals');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
  // Optionally add more edge cases
});
