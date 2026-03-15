import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // VITE_API_BASE_URL is injected from the Amplify environment variables
  // or from a local .env file during development.
  // Access it in code via: import.meta.env.VITE_API_BASE_URL
});
