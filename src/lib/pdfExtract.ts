import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl as string

export interface PdfExtractResult {
  text: string
  pageCount: number
  firstPageDataUrl: string | null
}

const MAX_PAGES_RENDERED = 1

/** Extract raw text and a first-page thumbnail from a PDF ArrayBuffer. */
export async function extractPdf(buffer: ArrayBuffer): Promise<PdfExtractResult> {
  const task = pdfjsLib.getDocument({ data: buffer.slice(0) })
  const doc = await task.promise
  const pageCount = doc.numPages

  const parts: string[] = []
  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let pageText = ''
    for (const item of content.items) {
      const t = item as { str?: string; hasEOL?: boolean }
      if (typeof t.str === 'string') {
        pageText += t.str
        pageText += t.hasEOL ? '\n' : ' '
      }
    }
    parts.push(pageText.replace(/[ \t]+/g, ' ').trim())
    page.cleanup()
  }

  let firstPageDataUrl: string | null = null
  try {
    const page = await doc.getPage(MAX_PAGES_RENDERED)
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.6, 620 / base.width)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    if (ctx) {
      await page.render({ canvas, canvasContext: ctx, viewport }).promise
      firstPageDataUrl = canvas.toDataURL('image/jpeg', 0.82)
    }
  } catch {
    firstPageDataUrl = null
  }

  await task.destroy()
  return { text: parts.join('\n\n'), pageCount, firstPageDataUrl }
}
