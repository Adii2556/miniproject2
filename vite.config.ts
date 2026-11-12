import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { handleAIRequest, type GatewayRequestMetadata, type ProxyBody } from './server/aiProxy'

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

function localAIProxy(): Plugin {
  return {
    name: 'doclense-local-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', (request, response) => {
        if (request.method !== 'POST') {
          response.statusCode = 405
          response.setHeader('Allow', 'POST')
          response.setHeader('Cache-Control', 'no-store')
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.setHeader('X-Content-Type-Options', 'nosniff')
          response.end(JSON.stringify({ error: { category: 'request', message: 'Use POST for AI provider requests.' } }))
          return
        }
        const chunks: Uint8Array[] = []
        let size = 0
        request.on('data', (chunk: Uint8Array) => {
          size += chunk.length
          if (size <= 2_000_000) chunks.push(chunk)
        })
        request.on('end', () => {
          void (async () => {
            if (size > 2_000_000) {
              response.statusCode = 413
              response.setHeader('Content-Type', 'application/json; charset=utf-8')
              response.end(JSON.stringify({ error: { category: 'context', message: 'The provider request is too large.' } }))
              return
            }
            let body: unknown
            try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { body = {} }
            const forwardedFor = request.headers['x-forwarded-for']?.toString().split(',')[0].trim()
            const metadata: GatewayRequestMetadata = {
              apiKey: request.headers['x-doclense-provider-key']?.toString(),
              origin: request.headers.origin,
              host: request.headers.host,
              contentType: request.headers['content-type'],
              fetchSite: request.headers['sec-fetch-site'],
              requestMarker: request.headers['x-doclense-request']?.toString(),
              clientId: request.headers['x-real-ip']?.toString() ?? forwardedFor ?? request.socket.remoteAddress,
            }
            const result = await handleAIRequest(body as ProxyBody, metadata)
            response.statusCode = result.status
            for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value)
            response.end(JSON.stringify(result.body))
          })()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [localAIProxy(), localOcrAssets(), tailwindcss(), react()],
  server: {
    host: '127.0.0.1',
    cors: false,
  },
  preview: {
    host: '127.0.0.1',
    cors: false,
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
