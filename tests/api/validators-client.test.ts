import '../../src/validators-client';

/**
 * src/validators-client.ts assigns `validators` onto globalThis as its public
 * browser API (bundled into public/js/validators.js). Tests reach it through
 * a narrow cast rather than a typed global declaration.
 */
interface ValidatorsGlobal {
  validators: Record<string, (...args: any[]) => any>;
}

describe('client validators (globalThis.validators)', () => {
  const globalWithValidators = globalThis as unknown as ValidatorsGlobal;
  const { validators } = globalWithValidators;

  it('registers the validators global as a side effect of the import', () => {
    expect(validators).toBeDefined();
    expect(typeof validators).toBe('object');
  });

  it('isValidDateFormat accepts a real ISO date', () => {
    expect(validators.isValidDateFormat('2024-01-15')).toBe(true);
  });

  it('isValidDateFormat rejects an impossible calendar date', () => {
    expect(validators.isValidDateFormat('2024-02-30')).toBe(false);
  });

  it('isValidDistance accepts a positive numeric string', () => {
    expect(validators.isValidDistance('12.5')).toBe(true);
  });

  it('isValidDistance rejects negative distances', () => {
    expect(validators.isValidDistance(-1)).toBe(false);
  });

  it('isValidDistance rejects an empty string', () => {
    expect(validators.isValidDistance('')).toBe(false);
  });

  it('validateProgressInput accepts a valid date and distance', () => {
    const result = validators.validateProgressInput('2024-01-15', 5);
    expect(result.isValid).toBe(true);
  });

  it('validateProgressInput reports errors for missing date and distance', () => {
    const result = validators.validateProgressInput('', '');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('sanitizeInput escapes HTML markup', () => {
    const sanitized = validators.sanitizeInput('<b>x</b>') as string;
    expect(sanitized).not.toContain('<b>');
    expect(sanitized).toBe('&lt;b&gt;x&lt;&#x2F;b&gt;');
  });

  it('formatDistanceDisplay renders two decimal places', () => {
    expect(validators.formatDistanceDisplay(3.14159)).toBe('3.14');
  });

  it('formatDateDisplay returns a non-empty display string for a valid date', () => {
    const display = validators.formatDateDisplay('2024-01-15');
    expect(typeof display).toBe('string');
    expect(display.length).toBeGreaterThan(0);
  });
});
