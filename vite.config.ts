import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    build: {
      target: 'esnext', // Optimization for top-level await support in libraries
      outDir: 'dist',
      sourcemap: false, // Disable sourcemaps in production for security
      minify: 'esbuild'
    },
    define: {
      // Robust polyfill for libraries expecting process.env
      // We prioritize VITE_ prefixed vars for client-side safety
      'process.env': JSON.stringify(env)
    }
  };
});
