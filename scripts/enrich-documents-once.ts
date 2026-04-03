/**
 * Phase 4 — enrich tracked_documents with OpenAI summaries + lenses.
 * PDFs: Responses API + file upload (native PDF; no LlamaParse). Fallback: pdf-parse + text model.
 * HTML/text: stripped text + OPENAI_TEXT_MODEL. Images: GPT vision (OPENAI_DOCUMENT_MODEL).
 *
 * Run: npm run enrich:once
 * Requires: OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see .env.example)
 */
import './load-env.ts'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  enrichFromImageBuffer,
  enrichFromPdfBuffer,
  enrichFromPlainText,
  extractPdfTextWithPdfParse,
  fetchUrlBody,
  stripHtml,
} from './lib/enrichment-openai.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TrackedRow = {
  id: string
  canonical_url: string
  content_hash: string | null
  enrichment_status: string | null
  enrichment_input_hash: string | null
}

async function readUserAgent(): Promise<string> {
  const raw = await readFile(join(__dirname, 'pilot-urls.json'), 'utf-8')
  const pilot = JSON.parse(raw) as { userAgent: string }
  return pilot.userAgent
}

function isProbablyPdf(ct: string, buf: Buffer): boolean {
  if (ct.includes('pdf')) return true
  return buf.slice(0, 5).toString('ascii') === '%PDF-'
}

function isProbablyImage(ct: string): boolean {
  return /^image\/(png|jpeg|jpg|webp|gif)$/i.test(ct)
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const apiKey = process.env.OPENAI_API_KEY?.trim()

  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!apiKey) {
    console.error('Missing OPENAI_API_KEY')
    process.exit(1)
  }

  const textModel = process.env.OPENAI_TEXT_MODEL?.trim() || 'gpt-4o-mini'
  const documentModel =
    process.env.OPENAI_DOCUMENT_MODEL?.trim() ||
    process.env.OPENAI_VISION_MODEL?.trim() ||
    'gpt-4o'
  const limit = Math.min(25, Math.max(1, Number(process.env.VERITY_ENRICH_BATCH) || 8))

  const openai = new OpenAI({ apiKey })
  const supabase = createClient(supabaseUrl.trim(), serviceKey.trim())
  const ua = await readUserAgent()

  const { data: rows, error: qErr } = await supabase
    .from('tracked_documents')
    .select('id, canonical_url, content_hash, enrichment_status, enrichment_input_hash')
    .not('content_hash', 'is', null)
    .order('last_checked_at', { ascending: false })
    .limit(200)

  if (qErr) {
    console.error(qErr)
    process.exit(1)
  }

  const pending = (rows ?? []).filter((r: TrackedRow) => {
    if (!r.content_hash) return false
    if (r.enrichment_status === 'skipped') return false
    if (r.enrichment_input_hash === r.content_hash && r.enrichment_status === 'ok')
      return false
    return true
  })

  const batch = pending.slice(0, limit)
  if (batch.length === 0) {
    console.log('Nothing to enrich (all rows match content_hash or missing hashes).')
    return
  }

  console.log(`Enriching ${batch.length} document(s)…`)

  for (const row of batch) {
    const url = row.canonical_url
    console.log('—', row.id, url)

    await supabase
      .from('tracked_documents')
      .update({
        enrichment_status: 'pending',
        enrichment_detail: null,
      })
      .eq('id', row.id)

    try {
      const { contentType, buffer } = await fetchUrlBody(url, ua)
      let payload: { summary: string; lenses: string[] }
      let method: string

      if (isProbablyPdf(contentType, buffer)) {
        try {
          payload = await enrichFromPdfBuffer(openai, documentModel, buffer)
          method = 'pdf_responses'
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          console.warn('  PDF Responses failed, trying pdf-parse fallback:', msg)
          const extracted = await extractPdfTextWithPdfParse(buffer)
          if (extracted.length < 80) {
            throw new Error(`PDF fallback text too short (${extracted.length} chars)`)
          }
          payload = await enrichFromPlainText(openai, textModel, extracted)
          method = 'pdf_parse_fallback'
        }
      } else if (isProbablyImage(contentType)) {
        payload = await enrichFromImageBuffer(openai, documentModel, buffer, contentType)
        method = 'image_vision'
      } else if (contentType.includes('html') || contentType.includes('xml')) {
        const text = stripHtml(buffer.toString('utf8'))
        if (text.length < 60) throw new Error('HTML body too short after strip')
        payload = await enrichFromPlainText(openai, textModel, text)
        method = 'text_responses'
      } else {
        const asText = buffer.toString('utf8')
        if (asText.length > 60 && !asText.includes('\0')) {
          payload = await enrichFromPlainText(openai, textModel, asText.slice(0, 100_000))
          method = 'text_responses'
        } else {
          throw new Error(`Unsupported content-type for enrichment: ${contentType}`)
        }
      }

      const modelLabel =
        method === 'pdf_responses' || method === 'image_vision' ? documentModel : textModel

      const { error: upErr } = await supabase
        .from('tracked_documents')
        .update({
          summary_text: payload.summary,
          lenses_json: payload.lenses,
          enrichment_status: 'ok',
          enrichment_detail: null,
          enrichment_model: modelLabel,
          enrichment_method: method,
          enriched_at: new Date().toISOString(),
          enrichment_input_hash: row.content_hash,
        })
        .eq('id', row.id)

      if (upErr) throw upErr
      console.log('  ok', method, payload.summary.slice(0, 80) + '…')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('  error', msg)
      await supabase
        .from('tracked_documents')
        .update({
          enrichment_status: 'error',
          enrichment_detail: msg.slice(0, 2000),
        })
        .eq('id', row.id)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
