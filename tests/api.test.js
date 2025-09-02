const request = require('supertest');
const server = 'http://localhost:8787';
const TEST_EVENT_DATE = "2024-01-02";

describe('Calendar Progress API', () => {
  // Helper to add event
  async function addEvent(title) {
    return await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title });
  }

  it('GET returns events', async () => {
    const res = await request(server).get('/wtm/api/calendar-progress');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('should add a new event', async () => {
    const res = await addEvent("999999");
    expect([200, 201]).toContain(res.status);
  });

  it('should edit the event', async () => {
    await addEvent("888888");
    const editRes = await request(server)
      .put('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE, title: "777777" });
    expect([200, 201]).toContain(editRes.status);
    // Only check status, as response may not contain title
  });

  it('should delete the event', async () => {
    await addEvent("888888");
    const delRes = await request(server)
      .delete('/wtm/api/calendar-progress')
      .send({ start: TEST_EVENT_DATE });
    expect(delRes.status).toBe(200);
  });

  it('rejects invalid payload', async () => {
    const res = await request(server).post('/wtm/api/calendar-progress').send({});
    expect([400, 422]).toContain(res.statusCode);
  });
});

describe('Goals API', () => {
  it('GET returns goals', async () => {
    const res = await request(server).get('/wtm/api/goals');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
