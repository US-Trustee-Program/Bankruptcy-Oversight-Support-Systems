import { defineConfig } from 'vite';

// E2E-specific vite preview config.
// COPYed into /app/user-interface/vite.config.mts at image build time by Dockerfile.frontend.
// Only purpose: serve the built React app with the correct outDir.
export default defineConfig({
  build: {
    outDir: 'build',
  },
});
