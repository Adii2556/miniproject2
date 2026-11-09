const PDF_HEADER = '%PDF-'
const MAX_TEXT_CHARS = 1_000_000

export class FileSafetyError extends Error {}

export function hasPdfSignature(buffer: ArrayBuffer): boolean {
  const header = new TextDecoder('latin1').decode(new Uint8Array(buffer.slice(0, 32)))
  return header.replace(/^[\t\r\n ]{0,16}/, '').startsWith(PDF_HEADER)
}

export async function validatePdfSignature(file: File): Promise<void> {
  const header = await file.slice(0, 32).arrayBuffer()
  if (!hasPdfSignature(header)) {
    throw new FileSafetyError('This file has a .pdf extension but does not contain a valid PDF header.')
  }
}

export function validatePlainText(text: string): string {
  if (text.includes('\u0000')) {
    throw new FileSafetyError('This file contains binary data and is not plain text.')
  }
  if (text.length > MAX_TEXT_CHARS) {
    throw new FileSafetyError('This text document is too long. Keep it under 1,000,000 characters.')
  }
  return text
}
