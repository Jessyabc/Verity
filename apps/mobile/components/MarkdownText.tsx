/**
 * Lightweight markdown renderer for Afaqi assistant replies.
 *
 * Supports the subset Afaqi actually uses, no native dependency:
 *   - `# / ## / ###` headings
 *   - `- ` and `* ` bullet lists
 *   - `1. ` ordered lists
 *   - `**bold**`
 *   - `*italic*` and `_italic_`
 *   - inline `` `code` ``
 *   - blank line → paragraph break
 *
 * Anything else (tables, images, blockquotes…) falls through as plain text.
 * This keeps us far from a real markdown parser but covers the visual
 * cleanup users have asked for without adding a native module.
 */
import { StyleSheet, Text, type TextStyle, View } from 'react-native'

import { font, space } from '@/constants/theme'

type Block =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; index: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'spacer' }

function classifyBlock(line: string): Block {
  const trimmed = line.trimStart()
  const hMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
  if (hMatch) {
    const level = hMatch[1].length as 1 | 2 | 3
    return { type: 'heading', level, text: hMatch[2].trim() }
  }
  const bMatch = trimmed.match(/^[-*]\s+(.+)$/)
  if (bMatch) return { type: 'bullet', text: bMatch[1].trim() }
  const nMatch = trimmed.match(/^(\d+)\.\s+(.+)$/)
  if (nMatch) return { type: 'numbered', index: nMatch[1], text: nMatch[2].trim() }
  return { type: 'paragraph', text: trimmed }
}

function parseBlocks(content: string): Block[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const out: Block[] = []
  for (const raw of lines) {
    if (raw.trim() === '') {
      // collapse multiple blanks into a single spacer
      if (out.length > 0 && out[out.length - 1].type !== 'spacer') {
        out.push({ type: 'spacer' })
      }
      continue
    }
    out.push(classifyBlock(raw))
  }
  // Trim leading/trailing spacers
  while (out.length > 0 && out[0].type === 'spacer') out.shift()
  while (out.length > 0 && out[out.length - 1].type === 'spacer') out.pop()
  return out
}

type Span = { text: string; bold?: boolean; italic?: boolean; mono?: boolean }

/**
 * Tokenise inline emphasis. We walk the string and pull out `**bold**`,
 * `*italic*`, `_italic_`, and `` `code` `` runs. Nested emphasis is not
 * supported — Afaqi never produces it in practice.
 */
function parseInline(input: string): Span[] {
  const spans: Span[] = []
  let i = 0
  let buf = ''
  const flush = () => {
    if (buf.length > 0) {
      spans.push({ text: buf })
      buf = ''
    }
  }
  while (i < input.length) {
    const ch = input[i]
    const next = input[i + 1]
    // **bold**
    if (ch === '*' && next === '*') {
      const end = input.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        spans.push({ text: input.slice(i + 2, end), bold: true })
        i = end + 2
        continue
      }
    }
    // *italic* or _italic_
    if ((ch === '*' || ch === '_') && next !== ch && next !== ' ') {
      const end = input.indexOf(ch, i + 1)
      if (end > i + 1 && input[end - 1] !== ' ') {
        flush()
        spans.push({ text: input.slice(i + 1, end), italic: true })
        i = end + 1
        continue
      }
    }
    // `code`
    if (ch === '`') {
      const end = input.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        spans.push({ text: input.slice(i + 1, end), mono: true })
        i = end + 1
        continue
      }
    }
    buf += ch
    i++
  }
  flush()
  return spans
}

function spanStyle(span: Span, palette: { mono: string }): TextStyle | undefined {
  const styles: TextStyle = {}
  if (span.bold && span.italic) {
    styles.fontFamily = font.bold
    styles.fontStyle = 'italic'
  } else if (span.bold) {
    styles.fontFamily = font.semi
  } else if (span.italic) {
    styles.fontStyle = 'italic'
  }
  if (span.mono) {
    styles.backgroundColor = palette.mono
  }
  return Object.keys(styles).length > 0 ? styles : undefined
}

type Props = {
  content: string
  ink: string
  inkMuted?: string
  monoBg: string
  baseSize?: number
}

export function MarkdownText({ content, ink, inkMuted, monoBg, baseSize = 15 }: Props) {
  const blocks = parseBlocks(content)
  return (
    <View>
      {blocks.map((block, idx) => {
        if (block.type === 'spacer') {
          return <View key={idx} style={{ height: space.xs }} />
        }
        if (block.type === 'heading') {
          const sizes = { 1: 18, 2: 16, 3: 15 } as const
          return (
            <Text
              key={idx}
              style={[
                blockStyles.heading,
                {
                  color: ink,
                  fontSize: sizes[block.level],
                  marginTop: idx === 0 ? 0 : space.sm,
                },
              ]}
            >
              {renderInline(block.text, ink, monoBg)}
            </Text>
          )
        }
        if (block.type === 'bullet') {
          return (
            <View key={idx} style={blockStyles.bulletRow}>
              <Text style={[blockStyles.bulletGlyph, { color: inkMuted ?? ink, fontSize: baseSize }]}>
                {'•'}
              </Text>
              <Text style={[blockStyles.bulletText, { color: ink, fontSize: baseSize }]}>
                {renderInline(block.text, ink, monoBg)}
              </Text>
            </View>
          )
        }
        if (block.type === 'numbered') {
          return (
            <View key={idx} style={blockStyles.bulletRow}>
              <Text style={[blockStyles.numberedGlyph, { color: inkMuted ?? ink, fontSize: baseSize }]}>
                {block.index}.
              </Text>
              <Text style={[blockStyles.bulletText, { color: ink, fontSize: baseSize }]}>
                {renderInline(block.text, ink, monoBg)}
              </Text>
            </View>
          )
        }
        return (
          <Text key={idx} style={[blockStyles.paragraph, { color: ink, fontSize: baseSize }]}>
            {renderInline(block.text, ink, monoBg)}
          </Text>
        )
      })}
    </View>
  )
}

function renderInline(text: string, ink: string, monoBg: string) {
  const spans = parseInline(text)
  return spans.map((span, i) => (
    <Text key={i} style={[{ color: ink }, spanStyle(span, { mono: monoBg })]}>
      {span.text}
    </Text>
  ))
}

const blockStyles = StyleSheet.create({
  heading: {
    fontFamily: font.bold,
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  paragraph: {
    fontFamily: font.regular,
    lineHeight: 22,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  bulletGlyph: {
    fontFamily: font.medium,
    lineHeight: 22,
    width: 14,
    textAlign: 'center',
  },
  numberedGlyph: {
    fontFamily: font.medium,
    lineHeight: 22,
    minWidth: 18,
  },
  bulletText: {
    flex: 1,
    fontFamily: font.regular,
    lineHeight: 22,
  },
})
