/**
 * Afaqi assistant TTS via Edge Function (OpenAI Cedar / gpt-4o-mini-tts).
 *
 * Generation is module-scoped: leaving the chat screen does not cancel an in-flight
 * request. Audio is cached on disk for the session (keyed by text). Autoplay is
 * suppressed when the chat screen unmounts so voice does not start on another page.
 */

import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioStatus,
} from 'expo-audio'
import {
  cacheDirectory,
  getInfoAsync,
  writeAsStringAsync,
  EncodingType,
} from 'expo-file-system/legacy'
import { FunctionsHttpError } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase'

const TTS_INPUT_CAP = 3800

/** Matches expo-audio native event name (see PLAYBACK_STATUS_UPDATE in expo-audio). */
const PLAYBACK_STATUS_UPDATE = 'playbackStatusUpdate' as const

let lastPlayer: ReturnType<typeof createAudioPlayer> | null = null
let lastStatusSub: { remove: () => void } | null = null

/** When false, finished generations stay cached but do not start playback. */
let autoplayAllowed = true

/** Bumped whenever the user explicitly stops or starts a new speak request. */
let speakEpoch = 0

/** In-memory path cache for this JS session (disk files use the same key). */
const pathByKey = new Map<string, string>()

/** Deduplicate concurrent generates for the same text. */
const inflightByKey = new Map<string, Promise<string>>()

/** Strip model source footer and cap length for the speech API. */
export function textForAfaqiSpeech(displayText: string): string {
  let t = displayText.replace(/SOURCES_JSON:\s*\[.*\]\s*$/s, '').trim()
  if (t.length > TTS_INPUT_CAP) t = t.slice(0, TTS_INPUT_CAP)
  return t
}

/** Stable short key for cache file names (not cryptographic). */
function speechCacheKey(input: string): string {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/**
 * Chat screen should call this on mount/unmount.
 * Leaving the conversation disables autoplay but does not cancel generation.
 */
export function setAfaqiSpeechAutoplay(allowed: boolean): void {
  autoplayAllowed = allowed
  if (!allowed) {
    void stopAfaqiSpeech()
  }
}

/** Stops playback only — never aborts an in-flight TTS generate/cache write. */
export async function stopAfaqiSpeech(): Promise<void> {
  speakEpoch += 1
  lastStatusSub?.remove()
  lastStatusSub = null
  if (!lastPlayer) return
  try {
    lastPlayer.pause()
    lastPlayer.remove()
  } catch {
    /* already released */
  }
  lastPlayer = null
}

async function parseFunctionsError(err: unknown): Promise<string | null> {
  if (!(err instanceof FunctionsHttpError)) return null
  const res = err.context
  if (!res || typeof res !== 'object' || !('json' in res) || typeof res.json !== 'function') {
    return null
  }
  try {
    const body = (await (res as Response).clone().json()) as { error?: string; message?: string }
    if (typeof body.error === 'string') return body.error
    if (typeof body.message === 'string') return body.message
  } catch {
    /* ignore */
  }
  return null
}

async function fetchAndWriteSpeechFile(input: string, path: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{
    audioBase64?: string
    mimeType?: string
    error?: string
  }>('afaqi-tts', { body: { text: input } })

  if (error) {
    const parsed = await parseFunctionsError(error)
    throw new Error(parsed ?? error.message ?? 'Could not load audio')
  }
  if (data?.error) throw new Error(data.error)
  if (!data?.audioBase64) throw new Error('No audio returned')

  await writeAsStringAsync(path, data.audioBase64, {
    encoding: EncodingType.Base64,
  })
}

/**
 * Ensures TTS audio for this text is on disk. Safe to call after leaving chat —
 * work continues at module scope and results are cached for the session.
 */
export async function ensureAfaqiSpeechCached(displayText: string): Promise<string> {
  const input = textForAfaqiSpeech(displayText)
  if (!input.trim()) throw new Error('Nothing to speak')

  const key = speechCacheKey(input)
  const cached = pathByKey.get(key)
  if (cached) {
    const info = await getInfoAsync(cached)
    if (info.exists) return cached
    pathByKey.delete(key)
  }

  const inflight = inflightByKey.get(key)
  if (inflight) return inflight

  const baseDir = cacheDirectory
  if (!baseDir) throw new Error('Cache unavailable')

  const path = `${baseDir}afaqi-tts-${key}.mp3`
  const job = (async () => {
    const existing = await getInfoAsync(path)
    if (!existing.exists) {
      await fetchAndWriteSpeechFile(input, path)
    }
    pathByKey.set(key, path)
    return path
  })()

  inflightByKey.set(key, job)
  try {
    return await job
  } finally {
    inflightByKey.delete(key)
  }
}

type SpeakOptions = {
  onPlaybackEnd?: () => void
  /** Called when audio is ready but autoplay was disabled (e.g. user left chat). */
  onCachedWithoutPlay?: () => void
}

/**
 * Generates (or reuses cached) audio, then plays if autoplay is still allowed.
 * Leaving the chat screen mid-generate finishes the cache write and skips play.
 */
export async function speakAfaqiMessage(
  displayText: string,
  options?: SpeakOptions,
): Promise<'played' | 'cached'> {
  const epochAtStart = speakEpoch
  // Stop any current playback before starting a new speak, but keep epoch aligned
  // so this request remains valid.
  lastStatusSub?.remove()
  lastStatusSub = null
  if (lastPlayer) {
    try {
      lastPlayer.pause()
      lastPlayer.remove()
    } catch {
      /* ignore */
    }
    lastPlayer = null
  }

  const path = await ensureAfaqiSpeechCached(displayText)

  // User tapped stop, or a newer speak superseded this one.
  if (epochAtStart !== speakEpoch) {
    options?.onCachedWithoutPlay?.()
    return 'cached'
  }

  if (!autoplayAllowed) {
    options?.onCachedWithoutPlay?.()
    return 'cached'
  }

  await setAudioModeAsync({
    playsInSilentMode: true,
    // Keep playing if the user backgrounds the app while listening.
    shouldPlayInBackground: true,
    allowsRecording: false,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
  })

  const player = createAudioPlayer({ uri: path })
  lastPlayer = player

  lastStatusSub = player.addListener(
    PLAYBACK_STATUS_UPDATE,
    (status: AudioStatus) => {
      if (!status.didJustFinish) return
      lastStatusSub?.remove()
      lastStatusSub = null
      options?.onPlaybackEnd?.()
      try {
        player.remove()
      } catch {
        /* ignore */
      }
      if (lastPlayer === player) lastPlayer = null
    },
  )

  player.play()
  return 'played'
}
