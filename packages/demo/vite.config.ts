import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/holochain-playground/',
  build: {
    sourcemap: true,
  },
  plugins: [
    checker({
      typescript: true,
    }),
  ],
});
