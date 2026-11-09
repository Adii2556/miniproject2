import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string

export const OCR_MAX_PAGES = 10
export const OCR_MAX_PIXELS = 2_500_000
export const OCR_TIMEOUT_MS = 180_000

export interface OcrProgress {
  page: number
  totalPages: number
  stage: string
  percent: number
}

export interface OcrResult {
  pageTexts: string[]
  pageCount: number
  processedPages: number
  limited: boolean
}

export class OcrError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrError'
  }
}

/**
 * Runs bounded English OCR in-browser. Tesseract's core and English language
 * data are fetched only after an explicit user action and may be cached by the
 * browser. Document pixels are not uploaded to an OCR service.
 */
export async function extractScannedPdfText(
  buffer: ArrayBuffer,
  signal?: AbortSignal,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0), maxImageSize: OCR_MAX_PIXELS, stopAtErrors: false })
  let worker: Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>> | null = null
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const abort = async () => {
    await worker?.terminate().catch(() => undefined)
    await task.destroy().catch(() => undefined)
  }
  signal?.addEventListener('abort', abort, { once: true })
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = globalThis.setTimeout(() => {
      void abort()
      reject(new OcrError('OCR exceeded the three-minute safety limit. Try a shorter scan or split the PDF.'))
    }, OCR_TIMEOUT_MS)
  })

  try {
    const document = await Promise.race([task.promise, timeout])
    const processedPages = Math.min(document.numPages, OCR_MAX_PAGES)
    let activePage = 1
    const { createWorker } = await import('tesseract.js')
    onProgress?.({ page: 0, totalPages: processedPages, stage: 'Loading local OCR engine…', percent: 0 })
    worker = await Promise.race([
      createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core-lstm.wasm.js',
        langPath: '/ocr',
        logger: message => {
          const localProgress = typeof message.progress === 'number' ? message.progress : 0
          onProgress?.({
            page: activePage,
            totalPages: processedPages,
            stage: message.status || 'Recognizing text…',
            percent: Math.round((((activePage - 1) + localProgress) / processedPages) * 100),
          })
        },
      }),
      timeout,
    ])

    const pageTexts: string[] = []
    for (let pageNumber = 1; pageNumber <= processedPages; pageNumber += 1) {
      if (signal?.aborted) throw new DOMException('OCR was cancelled', 'AbortError')
      activePage = pageNumber
      const page = await document.getPage(pageNumber)
      try {
        const base = page.getViewport({ scale: 1 })
        const scale = Math.min(1.8, Math.sqrt(OCR_MAX_PIXELS / Math.max(base.width * base.height, 1)))
        const viewport = page.getViewport({ scale })
        const canvas = window.document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d', { alpha: false })
        if (!context) throw new OcrError('This browser could not create a safe OCR canvas.')
        await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise
        const recognition = await Promise.race([worker.recognize(canvas), timeout])
        pageTexts.push(recognition.data.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim())
        canvas.width = 1
        canvas.height = 1
      } finally {
        page.cleanup()
      }
    }
    return { pageTexts, pageCount: document.numPages, processedPages, limited: document.numPages > processedPages }
  } finally {
    if (timeoutId !== undefined) globalThis.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abort)
    await worker?.terminate().catch(() => undefined)
    await task.destroy().catch(() => undefined)
  }
}
