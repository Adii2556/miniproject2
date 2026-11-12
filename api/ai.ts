import { handleAIRequest, type GatewayRequestMetadata, type ProxyBody } from '../server/aiProxy.js'

interface VercelRequestLike {
  method?: string
  body?: unknown
  headers?: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
}

interface VercelResponseLike {
  status: (code: number) => VercelResponseLike
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
}

function header(request: VercelRequestLike, name: string): string | undefined {
  const value = request.headers?.[name]
  return Array.isArray(value) ? value[0] : value
}

function requestMetadata(request: VercelRequestLike): GatewayRequestMetadata {
  const forwardedFor = header(request, 'x-forwarded-for')?.split(',')[0].trim()
  return {
    apiKey: header(request, 'x-doclense-provider-key'),
    origin: header(request, 'origin'),
    host: header(request, 'x-forwarded-host') ?? header(request, 'host'),
    contentType: header(request, 'content-type'),
    fetchSite: header(request, 'sec-fetch-site'),
    requestMarker: header(request, 'x-doclense-request'),
    clientId: header(request, 'x-real-ip') ?? forwardedFor ?? request.socket?.remoteAddress,
  }
}

export default async function handler(request: VercelRequestLike, response: VercelResponseLike) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.status(405).json({ error: { category: 'request', message: 'Use POST for AI provider requests.' } })
    return
  }
  const body = request.body
  const result = await handleAIRequest((body && typeof body === 'object' ? body : {}) as ProxyBody, requestMetadata(request))
  for (const [name, value] of Object.entries(result.headers)) response.setHeader(name, value)
  response.status(result.status).json(result.body)
}
