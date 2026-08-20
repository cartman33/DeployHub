import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_PROXY_TARGET || 'http://localhost:8080';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    preview: {
      proxy: {
        '/api': {
          target: target,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})