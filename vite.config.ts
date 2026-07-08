import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(async () => {
  const plugins = [react()]

  // Only load Tailwind plugin when not running tests to prevent ESM loading issues in node
  if (!process.env.VITEST) {
    const tailwindcss = (await import('@tailwindcss/vite')).default
    plugins.push(tailwindcss())
  }

  return {
    plugins,
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: './src/test/setup.ts',
    },
  }
})