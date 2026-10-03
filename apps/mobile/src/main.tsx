// Fonts are bundled (and precached) so every script renders offline.
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-600.css';
import '@fontsource/noto-sans/latin-700.css';
import '@fontsource/noto-sans-devanagari/devanagari-400.css';
import '@fontsource/noto-sans-devanagari/devanagari-600.css';
import '@fontsource/noto-sans-devanagari/devanagari-700.css';
import '@fontsource/noto-sans-ol-chiki/ol-chiki-400.css';
import '@fontsource/noto-sans-ol-chiki/ol-chiki-600.css';
import '@fontsource/noto-sans-ol-chiki/ol-chiki-700.css';
import './design/design.css';
import './design/screens.css';
import './design/certificates.css';
import './engine/hud/hud.css';
import './i18n';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('root');
if (rootElement == null) {
  throw new Error('#root element is missing from index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
