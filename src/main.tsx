import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ClinicalErrorBoundary } from './components/ClinicalErrorBoundary.tsx';
import './index.css';

// A leftover production PWA SW on localhost serves dist/ JS, where dynamic
// import.meta.env access used to drop VITE_* even with a valid .env.local.
if (import.meta.env.DEV && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClinicalErrorBoundary>
      <App />
    </ClinicalErrorBoundary>
  </StrictMode>,
);
