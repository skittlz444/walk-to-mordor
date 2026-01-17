// Ensure Preact is ready for testing
import { cleanup } from '@testing-library/preact';
import { afterEach } from 'vitest';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});
