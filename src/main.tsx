import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'katex/dist/katex.min.css';
import './index.css';
import App from './App';

// Verify the physics layer against known values on every dev boot. Dynamically
// imported so neither the checks nor their console output reach a production
// bundle — `import.meta.env.DEV` is statically false there and the whole branch
// is dropped.
if (import.meta.env.DEV) {
  void import('./physics/sanity').then(({ runSanityChecks, verifyEscapeIntegrator }) => {
    runSanityChecks();
    verifyEscapeIntegrator();
  });
}

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
