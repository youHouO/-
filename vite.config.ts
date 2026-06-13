import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'decrypt.html'],
      manifest: {
        name: 'LocalNotes - 本地优先加密笔记',
        short_name: 'LocalNotes',
        description: '本地优先、加密存储的个人笔记软件',
        theme_color: '#3b82f6',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        icons: [
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: [
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/lang-markdown',
      '@codemirror/commands',
      '@codemirror/language',
      '@codemirror/search',
      '@codemirror/autocomplete',
      '@codemirror/lint',
      'react-markdown',
      'remark-gfm',
    ],
    force: true,
  },
  server: {
    port: 5173,
    open: true,
  },
  // Cloudflare Pages 兼容配置
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          codemirror: ['@codemirror/view', '@codemirror/state', '@codemirror/lang-markdown', '@codemirror/commands', '@codemirror/language', '@codemirror/search', '@codemirror/autocomplete', '@codemirror/lint'],
          sql: ['sql.js'],
        },
      },
    },
  },
})
