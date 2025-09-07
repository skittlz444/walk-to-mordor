const request = require('supertest');
const { TEST_VALUES, cleanupAllTestData } = require('./helpers/cleanup');

const server = 'http://localhost:8787';
const TEST_EVENT_DATE = "2024-01-02";

describe('Calendar Progress API - Success Flows', () => {
  // Enhanced cleanup using our centralized system
  beforeAll(async () => {
    await cleanupAllTestData();
  });

  afterAll(async () => {
    await cleanupAllTestData();
  });

  // Helper to add event
  async function addEvent(title, date = TEST_EVENT_DATE) {
    return await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: date, title });
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
    const uniqueDeleteDate = "2024-01-06"; // Use unique date for delete test
    await addEvent("888888", uniqueDeleteDate);
    const delRes = await request(server)
      .delete('/wtm/api/calendar-progress')
      .send({ start: uniqueDeleteDate });
    expect(delRes.status).toBe(200);
  });

  it('accepts zero distance values', async () => {
    const testDate = "2024-01-02";
    const res = await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: testDate, title: "0" });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });

  it('accepts decimal distance values', async () => {
    const testDate = "2024-01-03";
    const res = await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: testDate, title: "15.5" });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });

  it('accepts large distance values', async () => {
    const testDate = "2024-01-04";
    const res = await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: testDate, title: "999999.99" });
    expect([200, 201, 409]).toContain(res.status); // 409 if already exists
  });
});

describe('Goals API - Success Flows', () => {
  it('GET returns goals', async () => {
    const res = await request(server).get('/wtm/api/goals');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
