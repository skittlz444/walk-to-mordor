const request = require('supertest');
const server = 'http://localhost:8787';
const TEST_EVENT_DATE = "2024-01-02";

describe('Calendar Progress API - Error Handling & Edge Cases', () => {
  // Track all test dates used in tests for cleanup
  const testDates = [
    TEST_EVENT_DATE,
    "2024-01-05", // For duplicate entry test
    "2099-12-31"  // Used in some error tests
  ];

  // Helper to delete event (ignores errors if not found)
  async function deleteEvent(date) {
    try {
      const res = await request(server)
        .delete('/wtm/api/calendar-progress')
        .send({ start: date });
      if (process.env.VERBOSE_TESTS && res.status === 200) {
        console.log(`Cleaned up test data for date: ${date}`);
      }
    } catch (error) {
      // Ignore errors - the event might not exist
    }
  }

  // Clean up any test data after each test  
  afterEach(async () => {
    for (const date of testDates) {
      await deleteEvent(date);
    }
  });

  describe('Error Handling', () => {
    it('rejects empty payload', async () => {
      const res = await request(server).post('/wtm/api/calendar-progress').send({});
      expect([400, 422]).toContain(res.statusCode);
      expect(res.body.error).toBeDefined();
    });

    it('rejects missing date field', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ title: "100" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('start');
    });

    it('rejects missing title field', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: TEST_EVENT_DATE });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('title');
    });

    it('rejects invalid date format - wrong format', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: "01/02/2024", title: "100" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('date format');
    });

    it('rejects invalid date format - incomplete date', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: "2024-01", title: "100" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('date format');
    });

    it('rejects invalid date format - invalid date', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: "2024-02-30", title: "100" }); // Feb 30th doesn't exist
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('date format');
    });

    it('rejects invalid date format - non-date string', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: "not-a-date", title: "100" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('date format');
    });

    it('rejects negative distance values', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: TEST_EVENT_DATE, title: "-50" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('distance');
    });

    it('rejects non-numeric distance values', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: TEST_EVENT_DATE, title: "abc" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('distance');
    });

    it('rejects extremely large distance values', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: TEST_EVENT_DATE, title: "9999999999" }); // 10 billion
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('distance');
    });

    it('rejects non-object JSON request body', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send("string")
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('JSON');
    });

    it('rejects invalid HTTP methods', async () => {
      const res = await request(server)
        .patch('/wtm/api/calendar-progress')
        .send({ start: TEST_EVENT_DATE, title: "100" });
      expect(res.statusCode).toBe(405);
      expect(res.body.error).toContain('Method PATCH not allowed');
      expect(res.headers.allow).toContain('GET, POST, PUT, DELETE');
    });

    it('rejects invalid JSON in request body', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('JSON');
    });

    it('rejects empty request body', async () => {
      const res = await request(server)
        .post('/wtm/api/calendar-progress')
        .send('')
        .set('Content-Type', 'application/json');
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    // PUT-specific error tests
    it('PUT returns 404 for non-existent entry', async () => {
      const nonExistentDate = "2099-12-31";
      const res = await request(server)
        .put('/wtm/api/calendar-progress')
        .send({ start: nonExistentDate, title: "100" });
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('No entry found');
    });

    // DELETE-specific error tests  
    it('DELETE returns 404 for non-existent entry', async () => {
      const nonExistentDate = "2099-12-31";
      const res = await request(server)
        .delete('/wtm/api/calendar-progress')
        .send({ start: nonExistentDate });
      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain('No entry found');
    });

    it('DELETE rejects missing date field', async () => {
      const res = await request(server)
        .delete('/wtm/api/calendar-progress')
        .send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('start');
    });

    it('DELETE rejects invalid date format', async () => {
      const res = await request(server)
        .delete('/wtm/api/calendar-progress')
        .send({ start: "invalid-date" });
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('date format');
    });

    it('POST returns 409 for duplicate entries', async () => {
      const uniqueTestDate = "2024-01-05";
      
      // First create an entry
      const firstRes = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: uniqueTestDate, title: "100" });
      expect([200, 201]).toContain(firstRes.status);
      
      // Try to create another entry with the same date (without cleanup in between)
      const duplicateRes = await request(server)
        .post('/wtm/api/calendar-progress')
        .send({ start: uniqueTestDate, title: "200" });
      expect(duplicateRes.status).toBe(409);
      expect(duplicateRes.body.error).toContain('already exists');
      
      // Clean up the test entry
      await deleteEvent(uniqueTestDate);
    });
  });
});
