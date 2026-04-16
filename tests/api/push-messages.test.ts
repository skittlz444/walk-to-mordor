import { getOneMoreMileMessage, ONE_MORE_MILE_MESSAGES } from '../../src/push-messages';

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
});
