import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// =============================================================================
// Supabase Auth Token Interception (MUST run before React/HashRouter mounts)
// =============================================================================
// Problem: Supabase password-reset emails redirect to URLs like:
//   https://app.com/#access_token=eyJ...&refresh_token=...&type=recovery
// But the app uses HashRouter, which interprets everything after # as a route.
// This causes HashRouter to try matching "/access_token=eyJ..." — a non-existent route.
//
// Solution: Intercept the hash fragment synchronously, extract the auth tokens,
// store them in sessionStorage for the ResetPassword page, and rewrite the hash
// to a valid route (#/reset-password) before React mounts.
// =============================================================================
(function interceptSupabaseAuthTokens() {
  const hash = window.location.hash;
  if (hash && hash.includes('access_token=') && hash.includes('type=')) {
    // Parse the fragment as URL search params (remove the leading #)
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (accessToken && type === 'recovery') {
      // Store tokens for the ResetPassword page to consume (one-time use)
      sessionStorage.setItem('pspt-recovery-tokens', JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
      }));
      // Rewrite hash to a valid route so HashRouter can process it
      window.location.hash = '#/reset-password';
    }
  }
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
