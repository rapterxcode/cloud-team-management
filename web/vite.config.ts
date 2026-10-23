import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const rootEnvDir = fileURLToPath(new URL('..', import.meta.url));
  const env = loadEnv(mode, rootEnvDir, '');
  const apiTarget = env.VITE_API_TARGET || `http://localhost:${env.PORT || 3000}`;

  return {
    envDir: rootEnvDir,
    plugins: [react()],
    css: { postcss: { plugins: [tailwindcss()] } },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { proxy: { '/api': apiTarget } },
  };
});
