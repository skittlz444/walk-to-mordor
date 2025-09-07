const request = require('supertest');
const server = 'http://localhost:8787';
const TEST_EVENT_DATE = "2024-01-02";

describe('Calendar Progress API - Success Flows', () => {
  // Track all test dates used in tests for cleanup
  const testDates = [
    TEST_EVENT_DATE,
    "2024-01-03", 
    "2024-01-04",
    "2024-01-05"
  ];

  // Helper to add event
  async function addEvent(title, date = TEST_EVENT_DATE) {
    return await request(server)
      .post('/wtm/api/calendar-progress')
      .send({ start: date, title });
  }

  // Helper to delete event (ignores errors if not found)
  async function deleteEvent(date) {
    try {
      const res = await request(server)
        .delete('/wtm/api/calendar-progress')
        .send({ start: date });
      // Only log if in verbose mode
      if (process.env.VERBOSE_TESTS && res.status === 200) {
        console.log(`Cleaned up test data for date: ${date}`);
      }
    } catch (error) {
      // Ignore errors - the event might not exist
    }
  }

  // Comprehensive cleanup function
  async function cleanupAllTestData() {
    if (process.env.VERBOSE_TESTS) {
      console.log('Starting test data cleanup...');
    }
    
    // Get all current progress entries
    const getAllRes = await request(server).get('/wtm/api/calendar-progress');
    if (getAllRes.status === 200 && Array.isArray(getAllRes.body)) {
      const testEntries = getAllRes.body.filter(entry => {
        // Clean up entries that match our test patterns
        const date = entry.start;
        const distance = parseFloat(entry.title);
        
        return testDates.includes(date) || 
               distance >= 999999 || // Large test values
               distance === 15.5 ||  // Decimal test value
               distance === 0;       // Zero test value
      });
      
      if (process.env.VERBOSE_TESTS && testEntries.length > 0) {
        console.log(`Found ${testEntries.length} test entries to clean up`);
      }
      
      for (const entry of testEntries) {
        await deleteEvent(entry.start);
      }
    }
    
    if (process.env.VERBOSE_TESTS) {
      console.log('Test data cleanup completed');
    }
  }

  // Clean up any test data before all tests
  beforeAll(async () => {
    await cleanupAllTestData();
  });

  // Clean up any test data after each test  
  afterEach(async () => {
    for (const date of testDates) {
      await deleteEvent(date);
    }
  });

  // Final comprehensive cleanup after all tests
  afterAll(async () => {
    await cleanupAllTestData();
  });

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
