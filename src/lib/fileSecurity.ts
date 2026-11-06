const PDF_HEADER = '%PDF-'
const MAX_TEXT_CHARS = 1_000_000

export class FileSafetyError extends Error {}

export async function validatePdfSignature(file: File): Promise<void> {
  const headerBytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  const header = new TextDecoder('latin1').decode(headerBytes)
  if (!header.includes(PDF_HEADER)) {
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
