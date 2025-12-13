import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // Map the .env variable API_KEY to process.env.API_KEY for the app code
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  };
});