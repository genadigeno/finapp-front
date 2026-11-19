// Adapted from finapp-admin-panel/src/testing/setup-dom.ts (ADR-F08).
// Test-only setup for jsdom component tests (never imported by the application).
// Mantine reads matchMedia and ResizeObserver, which jsdom does not implement.
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

if (typeof window !== 'undefined') {
  afterEach(() => cleanup());

  // Module pages load lazily (route-level code splitting). When the whole suite runs in parallel,
  // transforming a page's module can take longer than Testing Library's 1 s default for findBy*.
  configure({ asyncUtilTimeout: 10_000 });

  if (!('matchMedia' in window) || typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }

  // Mantine's autosizing Textarea listens for font loading (document.fonts, a FontFaceSet).
  if (!('fonts' in document) || document.fonts === undefined) {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { addEventListener: () => undefined, removeEventListener: () => undefined, ready: Promise.resolve() },
    });
  }

  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = () => undefined;
  }
}
