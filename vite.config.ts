import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/yahoo/, '/v8/finance/chart')
      }
    }
  }
})
