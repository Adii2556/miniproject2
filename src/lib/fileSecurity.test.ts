import { describe, expect, it } from 'vitest'
import { FileSafetyError, validatePdfSignature, validatePlainText } from './fileSecurity'

describe('file safety', () => {
  it('accepts a PDF header near the start of the file', async () => {
    const file = new File(['\n%PDF-1.7\n'], 'safe.pdf', { type: 'application/pdf' })
    await expect(validatePdfSignature(file)).resolves.toBeUndefined()
  })

  it('rejects extension-spoofed PDFs', async () => {
    const file = new File(['not actually a pdf'], 'spoofed.pdf', { type: 'application/pdf' })
    await expect(validatePdfSignature(file)).rejects.toBeInstanceOf(FileSafetyError)
  })

  it('rejects binary and excessively long text', () => {
    expect(() => validatePlainText('hello\u0000world')).toThrow(FileSafetyError)
    expect(() => validatePlainText('a'.repeat(1_000_001))).toThrow(FileSafetyError)
  })
})
