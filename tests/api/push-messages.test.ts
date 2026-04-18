import {
  getOneMoreMileMessage,
  getReengageMessage,
  ONE_MORE_MILE_MESSAGES,
  REENGAGE_MESSAGES,
} from '../../src/push-messages';

describe('Push Messages', () => {
  describe('ONE_MORE_MILE_MESSAGES', () => {
    it('contains at least 8 message variants', () => {
      expect(ONE_MORE_MILE_MESSAGES.length).toBeGreaterThanOrEqual(8);
    });

    it.each(ONE_MORE_MILE_MESSAGES.map((m, i) => [i, m]))(
      'variant %i has non-empty title and bodyTemplate',
      (_index, template) => {
        const msg = template as { title: string; bodyTemplate: string };
        expect(msg.title.length).toBeGreaterThan(0);
        expect(msg.bodyTemplate.length).toBeGreaterThan(0);
      },
    );
  });

  describe('getOneMoreMileMessage', () => {
    it('interpolates goalTitle and remainingKm into the message', () => {
      const result = getOneMoreMileMessage('Weathertop', 1.234);

      expect(result.title).toBeDefined();
      expect(result.body).toBeDefined();
      expect(typeof result.title).toBe('string');
      expect(typeof result.body).toBe('string');

      // At least the body should mention the goal or distance
      const combined = result.title + result.body;
      expect(combined).toContain('Weathertop');
      expect(combined).toContain('1.2');
    });

    it('formats remainingKm to one decimal place', () => {
      const result = getOneMoreMileMessage('Rivendell', 0.7);
      const combined = result.title + result.body;
      expect(combined).toContain('0.7');
    });

    it('does not leave unresolved placeholders', () => {
      const result = getOneMoreMileMessage('Moria', 1.5);
      expect(result.title).not.toContain('{goalTitle}');
      expect(result.title).not.toContain('{remainingKm}');
      expect(result.body).not.toContain('{goalTitle}');
      expect(result.body).not.toContain('{remainingKm}');
    });

    it('selects from the message pool (not always the same)', () => {
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const msg = getOneMoreMileMessage('Helm\'s Deep', 0.5);
        results.add(msg.title);
      }
      // With 8+ variants and 100 iterations, statistically we should see more than 1
      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('REENGAGE_MESSAGES', () => {
    it('has entries for all 4 tiers', () => {
      expect(REENGAGE_MESSAGES.has(1)).toBe(true);
      expect(REENGAGE_MESSAGES.has(2)).toBe(true);
      expect(REENGAGE_MESSAGES.has(3)).toBe(true);
      expect(REENGAGE_MESSAGES.has(4)).toBe(true);
    });

    it.each([1, 2, 3, 4])('tier %i has at least 4 message variants', (tier) => {
      const messages = REENGAGE_MESSAGES.get(tier);
      expect(messages).toBeDefined();
      expect(messages!.length).toBeGreaterThanOrEqual(4);
    });

    it.each([1, 2, 3, 4])('tier %i variants all have non-empty title and bodyTemplate', (tier) => {
      const messages = REENGAGE_MESSAGES.get(tier)!;
      for (const msg of messages) {
        expect(msg.title.length).toBeGreaterThan(0);
        expect(msg.bodyTemplate.length).toBeGreaterThan(0);
      }
    });

    it.each([1, 2, 3, 4])('tier %i variants all contain {goalTitle} placeholder in bodyTemplate', (tier) => {
      const messages = REENGAGE_MESSAGES.get(tier)!;
      for (const msg of messages) {
        expect(msg.bodyTemplate).toContain('{goalTitle}');
      }
    });
  });

  describe('getReengageMessage', () => {
    it('interpolates goalTitle into the message', () => {
      const result = getReengageMessage(1, 'Weathertop');
      const combined = result.title + result.body;
      expect(combined).toContain('Weathertop');
    });

    it('does not leave unresolved {goalTitle} placeholders', () => {
      const result = getReengageMessage(2, 'Rivendell');
      expect(result.title).not.toContain('{goalTitle}');
      expect(result.body).not.toContain('{goalTitle}');
    });

    it('throws for invalid tier 0', () => {
      expect(() => getReengageMessage(0, 'Moria')).toThrow('Invalid re-engagement tier: 0');
    });

    it('throws for invalid tier 5', () => {
      expect(() => getReengageMessage(5, 'Moria')).toThrow('Invalid re-engagement tier: 5');
    });

    it('selects from the message pool (not always the same)', () => {
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const msg = getReengageMessage(1, 'Mordor');
        results.add(msg.title);
      }
      expect(results.size).toBeGreaterThan(1);
    });
  });
});
