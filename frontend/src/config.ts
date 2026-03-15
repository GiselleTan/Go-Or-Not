// Central config — reads the API base URL injected by Vite at build time.
// Set VITE_API_BASE_URL in your .env (local) or Amplify environment variables (cloud).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001';
