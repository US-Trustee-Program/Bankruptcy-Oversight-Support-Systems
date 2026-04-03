import { defineConfig } from 'vite';

// E2E-only vite config override used by `vite preview` in Dockerfile.frontend.
// Adds a preview proxy so the browser calls localhost:3000/api/... (same-origin)
// and vite forwards to localhost:7071/api/... — eliminates CORS preflights entirely.
// Azure Functions host routing rejects OPTIONS before CORS middleware runs, so
// this proxy approach matches what the Azure platform layer does in production.
export default defineConfig({
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:7071',
        changeOrigin: false,
      },
    },
  },
});
