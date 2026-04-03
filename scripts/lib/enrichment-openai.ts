/**
 * OpenAI enrichment for tracked URLs — PDFs via Responses API + uploaded file (native PDF
 * understanding; no LlamaParse). HTML/text via cheaper text model. Images via vision.
 */
import OpenAI, { toFile } from 'openai'

const MAX_TEXT_CHARS = 100_000
const MAX_FETCH_BYTES = 25 * 1024 * 1024

const ENRICH_INSTRUCTIONS =
  'You help equity research analysts. Stay factual; do not invent figures. ' +
  'If the source is incomplete, say so. Lenses are research questions — not trading advice.'

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: '2–5 sentences grounded in the source.' },
    lenses: {
      type: 'array',
      items: { type: 'string' },
      description: '3–6 concise research questions; not stock price predictions.',
    },
  },
  required: ['summary', 'lenses'],
} as const

export type EnrichmentPayload = {
  summary: string
  lenses: string[]
}

function parseEnrichmentJson(raw: string): EnrichmentPayload {
  const trimmed = raw.trim()
  const parsed = JSON.parse(trimmed) as unknown
  if (!parsed || typeof parsed !== 'object') throw new Error('Invalid JSON from model')
  const o = parsed as Record<string, unknown>
  if (typeof o.summary !== 'string' || !Array.isArray(o.lenses))
    throw new Error('Invalid enrichment shape')
  const lenses = o.lenses.filter((x): x is string => typeof x === 'string')
  return { summary: o.summary.trim(), lenses: lenses.slice(0, 8) }
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchUrlBody(
  url: string,
  userAgent: string,
): Promise<{ contentType: string; buffer: Buffer }> {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  })
  const len = res.headers.get('content-length')
  if (len && Number(len) > MAX_FETCH_BYTES) {
    throw new Error(`Body too large (${len} bytes)`)
  }
  const ab = await res.arrayBuffer()
  if (ab.byteLength > MAX_FETCH_BYTES) throw new Error('Body too large')
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream'
  return { contentType, buffer: Buffer.from(ab) }
}

async function responsesJsonEnrichment(
  openai: OpenAI,
  model: string,
  input: unknown,
): Promise<EnrichmentPayload> {
  const response = await openai.responses.create({
    model,
    instructions: ENRICH_INSTRUCTIONS,
    input: input as never,
    text: {
      format: {
        type: 'json_schema',
        name: 'verity_enrichment',
        strict: true,
        schema: jsonSchema as unknown as Record<string, unknown>,
      },
    },
  })
  const raw = response.output_text?.trim()
  if (!raw) throw new Error('Empty model output')
  return parseEnrichmentJson(raw)
}

export async function enrichFromPlainText(
  openai: OpenAI,
  model: string,
  text: string,
): Promise<EnrichmentPayload> {
  const body = text.slice(0, MAX_TEXT_CHARS)
  return responsesJsonEnrichment(openai, model, [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            'Summarize the following primary source material. Return JSON only per schema.\n\n' +
            body,
        },
      ],
    },
  ])
}

export async function enrichFromPdfBuffer(
  openai: OpenAI,
  documentModel: string,
  pdfBuffer: Buffer,
): Promise<EnrichmentPayload> {
  const uploaded = await openai.files.create({
    file: await toFile(pdfBuffer, 'source.pdf', { type: 'application/pdf' }),
    purpose: 'user_data',
  })
  try {
    return await responsesJsonEnrichment(openai, documentModel, [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              'This is an investor relations / regulatory PDF. Summarize it and propose research lenses. Return JSON only per schema.',
          },
          { type: 'input_file', file_id: uploaded.id },
        ],
      },
    ])
  } finally {
    await openai.files.delete(uploaded.id).catch(() => undefined)
  }
}

export async function enrichFromImageBuffer(
  openai: OpenAI,
  visionModel: string,
  buffer: Buffer,
  mime: string,
): Promise<EnrichmentPayload> {
  const b64 = buffer.toString('base64')
  const dataUrl = `data:${mime};base64,${b64}`
  return responsesJsonEnrichment(openai, visionModel, [
    {
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            'Describe and summarize this image of a document or slide. Return JSON only per schema.',
        },
        {
          type: 'input_image',
          image_url: dataUrl,
          detail: 'high',
        },
      ],
    },
  ])
}

/** Fallback when PDF Responses path fails: extract text with pdf-parse (v2 API). */
export async function extractPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse')
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return result.text?.trim() ?? ''
  } finally {
    await parser.destroy()
  }
}
