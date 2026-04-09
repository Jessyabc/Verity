/**
 * Afaqi assistant TTS via Edge Function (OpenAI Cedar / gpt-4o-mini-tts).
 * Plays through expo-audio; writes a short-lived mp3 in the app cache.
 */

import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioStatus,
} from 'expo-audio'
import {
  cacheDirectory,
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

/** Strip model source footer and cap length for the speech API. */
export function textForAfaqiSpeech(displayText: string): string {
  let t = displayText.replace(/SOURCES_JSON:\s*\[.*\]\s*$/s, '').trim()
  if (t.length > TTS_INPUT_CAP) t = t.slice(0, TTS_INPUT_CAP)
  return t
}

export async function stopAfaqiSpeech(): Promise<void> {
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

type SpeakOptions = { onPlaybackEnd?: () => void }

/** Fetches mp3 from `afaqi-tts` and plays it (stops any prior Afaqi playback). */
export async function speakAfaqiMessage(
  displayText: string,
  options?: SpeakOptions,
): Promise<void> {
  await stopAfaqiSpeech()
  const input = textForAfaqiSpeech(displayText)
  if (!input.trim()) throw new Error('Nothing to speak')

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

  const baseDir = cacheDirectory
  if (!baseDir) throw new Error('Cache unavailable')

  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    allowsRecording: false,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
  })

  const path = `${baseDir}afaqi-tts-${Date.now()}.mp3`
  await writeAsStringAsync(path, data.audioBase64, {
    encoding: EncodingType.Base64,
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
}
