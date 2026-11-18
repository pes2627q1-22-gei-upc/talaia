import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sense `globals`, Testing Library no desmunta sol entre tests.
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});
