import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string

export interface PdfExtractResult {
  text: string
  pageCount: number
  firstPageDataUrl: string | null
}

export class PdfSafetyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PdfSafetyError'
  }
}

const MAX_PDF_PAGES = 250
const MAX_EXTRACTED_CHARS = 1_000_000
const MAX_CANVAS_PIXELS = 8_000_000
const MAX_CANVAS_DIMENSION = 4096
const MAX_PROCESSING_MS = 30_000

function assertWithinBudget(startedAt: number, signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('PDF processing was cancelled', 'AbortError')
  if (performance.now() - startedAt > MAX_PROCESSING_MS) {
    throw new PdfSafetyError('This PDF took too long to process. Try a shorter or simpler document.')
  }
}

function safeViewportScale(width: number, height: number): number {
  const widthScale = 620 / Math.max(width, 1)
  const dimensionScale = MAX_CANVAS_DIMENSION / Math.max(width, height, 1)
  const pixelScale = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(width * height, 1))
  return Math.max(0.05, Math.min(1.6, widthScale, dimensionScale, pixelScale))
}

/** Extract bounded text and a bounded first-page thumbnail from a PDF. */
export async function extractPdf(buffer: ArrayBuffer, signal?: AbortSignal): Promise<PdfExtractResult> {
  const startedAt = performance.now()
  const task = pdfjsLib.getDocument({
    data: buffer.slice(0),
    maxImageSize: MAX_CANVAS_PIXELS,
    stopAtErrors: false,
  })

  try {
    const doc = await task.promise
    assertWithinBudget(startedAt, signal)
    const pageCount = doc.numPages
    if (pageCount > MAX_PDF_PAGES) {
      throw new PdfSafetyError(`This PDF has ${pageCount} pages. The safety limit is ${MAX_PDF_PAGES} pages.`)
    }

    const parts: string[] = []
    let extractedChars = 0
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      assertWithinBudget(startedAt, signal)
      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        let pageText = ''
        for (const item of content.items) {
          const textItem = item as { str?: string; hasEOL?: boolean }
          if (typeof textItem.str !== 'string') continue
          pageText += textItem.str
          pageText += textItem.hasEOL ? '\n' : ' '
          extractedChars += textItem.str.length + 1
          if (extractedChars > MAX_EXTRACTED_CHARS) {
            throw new PdfSafetyError('This PDF contains too much extracted text. The safety limit is 1,000,000 characters.')
          }
        }
        parts.push(pageText.replace(/[ \t]+/g, ' ').trim())
      } finally {
        page.cleanup()
      }
    }

    let firstPageDataUrl: string | null = null
    try {
      assertWithinBudget(startedAt, signal)
      const page = await doc.getPage(1)
      try {
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: safeViewportScale(base.width, base.height) })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const context = canvas.getContext('2d')
        if (context) {
          await page.render({ canvas, canvasContext: context, viewport }).promise
          firstPageDataUrl = canvas.toDataURL('image/jpeg', 0.82)
          canvas.width = 1
          canvas.height = 1
        }
      } finally {
        page.cleanup()
      }
    } catch (error) {
      if (error instanceof PdfSafetyError || (error as Error).name === 'AbortError') throw error
      firstPageDataUrl = null
    }

    return { text: parts.join('\n\n'), pageCount, firstPageDataUrl }
  } finally {
    await task.destroy()
  }
}
