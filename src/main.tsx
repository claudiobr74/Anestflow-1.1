import {StrictMode, useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import AdminApp from './admin/AdminApp.tsx';
import { isAdminPathname } from './admin/routes.ts';
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

function Root() {
  const [admin, setAdmin] = useState(() => isAdminPathname(window.location.pathname));
  useEffect(() => {
    const sync = () => setAdmin(isAdminPathname(window.location.pathname));
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return (
    <ClinicalErrorBoundary>
      {admin ? <AdminApp /> : <App />}
    </ClinicalErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
