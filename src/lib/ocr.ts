import { renderPdfPageToDataUrl } from './pdfExtract'
import type { SourceBlock } from './document'

export interface OcrProgress {
  currentPage: number
  totalPages: number
  status: string
}

export interface OcrResult {
  text: string
  blocks: SourceBlock[]
  pageCount: number
  accuracyNote: string
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const MAX_OCR_PAGES = 5 // Safe bounding to prevent rate limit / memory exhaustion

/**
 * Perform safe, bounded OCR on scanned PDF pages using Groq Vision API
 * with explicit page limits, timeouts, and transparent accuracy disclosures.
 */
export async function performBoundedOcr(
  pdfBuffer: ArrayBuffer,
  pageCount: number,
  apiKey: string,
  signal?: AbortSignal,
  onProgress?: (progress: OcrProgress) => void,
  docId?: string,
): Promise<OcrResult> {
  const pagesToProcess = Math.min(pageCount, MAX_OCR_PAGES)
  const blocks: SourceBlock[] = []
  const textParts: string[] = []
  const idPrefix = docId ? `${docId}-p` : 'p'

  for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
    if (signal?.aborted) throw new DOMException('OCR process was cancelled', 'AbortError')

    onProgress?.({
      currentPage: pageNum,
      totalPages: pagesToProcess,
      status: `Rendering page ${pageNum} for OCR…`,
    })

    const dataUrl = await renderPdfPageToDataUrl(pdfBuffer, pageNum, 1200)
    if (!dataUrl) {
      blocks.push({
        id: `${idPrefix}${pageNum}`,
        label: `Page ${pageNum} (Scanned)`,
        pageNumber: pageNum,
        text: `[Page ${pageNum}: Image render failed]`,
        docId,
      })
      continue
    }

    onProgress?.({
      currentPage: pageNum,
      totalPages: pagesToProcess,
      status: `Transcribing text from page ${pageNum} via OCR…`,
    })

    let extractedText = ''
    try {
      if (!apiKey.trim()) {
        throw new Error('Groq API key required for Vision OCR')
      }

      const response = await fetch(GROQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          temperature: 0.1,
          max_tokens: 1500,
          messages: [
            {
              role: 'system',
              content: 'You are an accurate OCR document transcription assistant. Transcribe ALL readable text from this scanned document page exactly as shown. Do not add conversational commentary, introductory notes, or markdown code blocks. Output plain transcribed text only.',
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Transcribe the text in this scanned document page accurately:',
                },
                {
                  type: 'image_url',
                  image_url: { url: dataUrl },
                },
              ],
            },
          ],
        }),
        signal,
      })

      if (response.ok) {
        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
        extractedText = data.choices?.[0]?.message?.content?.trim() ?? ''
      } else {
        extractedText = `[Page ${pageNum}: OCR service returned status ${response.status}]`
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      extractedText = `[Page ${pageNum}: OCR transcription unavailable]`
    }

    const cleanText = extractedText || `[Page ${pageNum}: No text detected]`
    textParts.push(cleanText)
    blocks.push({
      id: `${idPrefix}${pageNum}`,
      label: `Page ${pageNum} (OCR)`,
      pageNumber: pageNum,
      text: cleanText,
      docId,
    })
  }

  const accuracyNote = pageCount > MAX_OCR_PAGES
    ? `Scanned PDF processed via Vision OCR (bounded to first ${MAX_OCR_PAGES} of ${pageCount} pages to respect rate limits). OCR text accuracy depends on original scan resolution.`
    : `Scanned PDF processed via Vision OCR (${pagesToProcess} page${pagesToProcess === 1 ? '' : 's'}). OCR text accuracy depends on original scan resolution.`

  return {
    text: textParts.join('\n\n'),
    blocks,
    pageCount: pagesToProcess,
    accuracyNote,
  }
}
