import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystemProvider } from '../src/design-system/DesignSystemProvider.tsx';
import { AppIntlProvider } from '../src/platform/i18n/IntlProvider.tsx';
import { Catalogue } from './Catalogue.tsx';

const root = document.getElementById('root');
if (root === null) throw new Error('The #root element is missing.');

// ?scheme=light|dark pins the colour scheme, so axe judges both themes; the locale is pinned so the
// figures are the same on every machine.
const scheme = new URLSearchParams(window.location.search).get('scheme');
createRoot(root).render(
  <StrictMode>
    <AppIntlProvider locale="en-GB">
      <DesignSystemProvider forceColorScheme={scheme === 'dark' ? 'dark' : 'light'}>
        <Catalogue />
      </DesignSystemProvider>
    </AppIntlProvider>
  </StrictMode>,
);
