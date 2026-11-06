import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { SourceBlock } from './document'

pdfjsLib.GlobalWorkerOptions.workerSrc = typeof window === 'undefined'
  ? new URL('../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).href
  : (pdfWorkerUrl as string)

export const MAX_PDF_PAGES = 250
export const MAX_EXTRACTED_CHARS = 1_000_000
export const PDF_PROCESSING_TIMEOUT_MS = 30_000
const MAX_CANVAS_PIXELS = 8_000_000
const MAX_CANVAS_DIMENSION = 4096

export interface PdfExtractResult {
  text: string
  blocks: SourceBlock[]
  pageCount: number
  firstPageDataUrl: string | null
  isScanned?: boolean
}

export type PdfValidationCode = 'INVALID_SIGNATURE' | 'TOO_MANY_PAGES' | 'TOO_MUCH_TEXT' | 'TIMEOUT' | 'ABORTED'

export class PdfValidationError extends Error {
  constructor(
    message: string,
    public readonly code: PdfValidationCode,
  ) {
    super(message)
    this.name = 'PdfValidationError'
  }
}

// Preserve backwards compatibility for any tests importing PdfSafetyError
export class PdfSafetyError extends PdfValidationError {
  constructor(message: string, code: PdfValidationCode = 'TOO_MUCH_TEXT') {
    super(message, code)
    this.name = 'PdfSafetyError'
  }
}

export function hasPdfSignature(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false
  const bytes = new Uint8Array(buffer, 0, 5)
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

function safeViewportScale(width: number, height: number): number {
  const widthScale = 620 / Math.max(width, 1)
  const dimensionScale = MAX_CANVAS_DIMENSION / Math.max(width, height, 1)
  const pixelScale = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(width * height, 1))
  return Math.max(0.05, Math.min(1.6, widthScale, dimensionScale, pixelScale))
}

function assertWithinBudget(startedAt: number, signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('PDF processing was cancelled', 'AbortError')
  if (performance.now() - startedAt > PDF_PROCESSING_TIMEOUT_MS) {
    throw new PdfValidationError('This PDF took too long to process. Try a shorter or simpler document.', 'TIMEOUT')
  }
}

/** Extract bounded text, structured per-page source blocks, and a thumbnail from a PDF buffer. */
export async function extractPdf(buffer: ArrayBuffer, signal?: AbortSignal, docId?: string): Promise<PdfExtractResult> {
  if (!hasPdfSignature(buffer)) {
    throw new PdfValidationError('The file does not have a valid PDF signature.', 'INVALID_SIGNATURE')
  }

  const startedAt = performance.now()
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    enableXfa: false,
    maxImageSize: MAX_CANVAS_PIXELS,
    stopAtErrors: false,
  })

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      void task.destroy().catch(() => undefined)
      reject(new PdfValidationError('PDF processing timed out.', 'TIMEOUT'))
    }, PDF_PROCESSING_TIMEOUT_MS)
  })

  try {
    const doc = await Promise.race([task.promise, timeoutPromise])
    assertWithinBudget(startedAt, signal)

    const pageCount = doc.numPages
    if (pageCount > MAX_PDF_PAGES) {
      throw new PdfValidationError(`PDFs are limited to ${MAX_PDF_PAGES} pages. Found ${pageCount}.`, 'TOO_MANY_PAGES')
    }

    const parts: string[] = []
    const blocks: SourceBlock[] = []
    let extractedChars = 0
    const idPrefix = docId ? `${docId}-p` : 'p'

    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      assertWithinBudget(startedAt, signal)
      const page = await doc.getPage(pageNumber)
      try {
        const content = await page.getTextContent()
        let pageText = ''
        for (const item of content.items) {
          const textItem = item as { str?: string; hasEOL?: boolean }
          if (typeof textItem.str !== 'string') continue
          const addition = textItem.str + (textItem.hasEOL ? '\n' : ' ')
          extractedChars += addition.length
          if (extractedChars > MAX_EXTRACTED_CHARS) {
            throw new PdfValidationError(
              `PDF text exceeds maximum limit of ${MAX_EXTRACTED_CHARS.toLocaleString()} characters.`,
              'TOO_MUCH_TEXT',
            )
          }
          pageText += addition
        }
        const normalized = pageText.replace(/[ \t]+/g, ' ').trim()
        parts.push(normalized)
        blocks.push({
          id: `${idPrefix}${pageNumber}`,
          label: `Page ${pageNumber}`,
          pageNumber,
          text: normalized,
          docId,
        })
      } finally {
        page.cleanup()
      }
    }

    // Render bounded first page thumbnail
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
          // Clean up canvas memory immediately
          canvas.width = 1
          canvas.height = 1
        }
      } finally {
        page.cleanup()
      }
    } catch {
      firstPageDataUrl = null
    }

    const fullText = parts.join('\n\n')
    const isScanned = pageCount > 0 && fullText.replace(/\s/g, '').length < 30

    return {
      text: fullText,
      blocks,
      pageCount,
      firstPageDataUrl,
      isScanned,
    }
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId)
    await task.destroy().catch(() => undefined)
  }
}

/** Render specified PDF page to a base64 JPEG thumbnail for OCR vision or preview */
export async function renderPdfPageToDataUrl(buffer: ArrayBuffer, pageNumber: number, maxDim = 1200): Promise<string | null> {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(buffer.slice(0)),
    enableXfa: false,
    maxImageSize: MAX_CANVAS_PIXELS,
    stopAtErrors: false,
  })

  try {
    const doc = await task.promise
    if (pageNumber < 1 || pageNumber > doc.numPages) return null
    const page = await doc.getPage(pageNumber)
    try {
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(2.0, maxDim / Math.max(base.width, base.height))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const context = canvas.getContext('2d')
      if (!context) return null
      await page.render({ canvas, canvasContext: context, viewport }).promise
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      canvas.width = 1
      canvas.height = 1
      return dataUrl
    } finally {
      page.cleanup()
    }
  } catch {
    return null
  } finally {
    await task.destroy().catch(() => undefined)
  }
}
