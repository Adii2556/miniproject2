import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ocrAssets = new Map([
  ['/ocr/worker.min.js', resolve('node_modules/tesseract.js/dist/worker.min.js')],
  ['/ocr/tesseract-core-lstm.wasm.js', resolve('node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js')],
  ['/ocr/tesseract-core-lstm.wasm', resolve('node_modules/tesseract.js-core/tesseract-core-lstm.wasm')],
  ['/ocr/eng.traineddata.gz', resolve('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')],
])

function localOcrAssets(): Plugin {
  return {
    name: 'doclense-local-ocr-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0]
        const source = path ? ocrAssets.get(path) : undefined
        if (!source) return next()
        response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        if (path?.endsWith('.wasm')) response.setHeader('Content-Type', 'application/wasm')
        else if (path?.endsWith('.gz')) response.setHeader('Content-Type', 'application/gzip')
        else response.setHeader('Content-Type', 'text/javascript; charset=utf-8')
        response.end(readFileSync(source))
      })
    },
    generateBundle() {
      for (const [publicPath, sourcePath] of ocrAssets) {
        this.emitFile({ type: 'asset', fileName: publicPath.slice(1), source: readFileSync(sourcePath) })
      }
    },
  }
}

export default defineConfig({
  plugins: [localOcrAssets(), tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
  },
  preview: {
    host: '127.0.0.1',
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-zod': ['zod'],
        },
      },
    },
  },
})
