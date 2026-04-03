/** One news / research item from Perplexity (structured JSON in model output). */

export type ResearchNewsItem = {
  title: string
  url: string
  source?: string | null
  snippet?: string | null
  published_at?: string | null
}
