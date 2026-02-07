import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // The third argument '' loads all env vars regardless of prefix on the server side (build time)
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    // Critical: Tell Vite to expose variables starting with NEXT_PUBLIC_ to the client
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'], 
    build: {
      target: 'esnext', 
      outDir: 'dist',
      sourcemap: false, 
      minify: 'esbuild'
    },
    define: {
      // Polyfill process.env for libraries that might need it, but use import.meta.env in app code
      'process.env': JSON.stringify(env)
    }
  };
});