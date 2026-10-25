import { NextResponse } from 'next/server'
import { getVerifiedUid } from '@/backend/auth/verify-token'
import { apiError, readJson } from '@/backend/http'

export const dynamic = 'force-dynamic'

/**
 * SafeHer Safety Assistant: a server-side proxy to Google Gemini.
 *
 * The API key lives only in the server environment (GEMINI_API_KEY) and is never sent to the
 * browser or the Android app. Requests require a verified Firebase ID token.
 *
 *   POST /api/assistant   { messages: [{ role: 'user' | 'assistant', content: string }, ...] }
 *   ->                    { reply: string, urgent: boolean, model: string }
 */

const MAX_MESSAGES = 20
const MAX_CONTENT = 2000
const REQUEST_TIMEOUT_MS = 25_000
const PER_USER_PER_MINUTE = 15

const SYSTEM_PROMPT = `You are SafeHer's Safety Assistant inside a personal-safety app for women.
Give practical, calm, concise general safety guidance: situational awareness, safe travel, dealing with harassment or being followed, digital safety, preparing a safety plan, supporting a friend, and how to use SafeHer's features (hold-to-activate SOS, power-button trigger, trusted circle, live location, SOS drills).
Rules:
- You are an AI. You CANNOT call or message anyone, contact emergency services, track location, or send alerts. Never claim or imply that you did or can. Say so plainly if asked.
- If the user describes immediate danger, an assault, or a medical emergency, put first: tell them to call their local emergency number now (112 in India; 100 police, 1091 women helpline, 181 women helpline, 108 ambulance) or use SafeHer's SOS button, and move to a safe public place if they can. Keep that reply short.
- Do not give legal, medical or psychological diagnosis; suggest professional help where appropriate. Never encourage confronting an attacker or any violent retaliation; prefer escape, attracting attention and getting help.
- Do not ask for or store personal data such as exact addresses or passwords.
- Keep answers under about 180 words, use short paragraphs or bullets, and be kind and non-judgemental.`

/** Rule-based (not AI) keyword check so the UI can foreground the emergency call button. */
const URGENT_PATTERN =
  /\b(following me|being followed|attack(ed|ing)?|assault(ed)?|rape[dr]?|kidnap|stalker|unsafe right now|in danger|help me|grabbed|threaten(ed|ing)? (me|to)|hurt me|forced me|ambulance|bleeding)\b/i

type Role = 'user' | 'assistant'
const buckets = new Map<string, { count: number; resetAt: number }>()

function allowed(uid: string): boolean {
  const now = Date.now()
  const bucket = buckets.get(uid)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(uid, { count: 1, resetAt: now + 60_000 })
    return true
  }
  bucket.count += 1
  return bucket.count <= PER_USER_PER_MINUTE
}

export async function GET(request: Request) {
  const { errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse
  return NextResponse.json({ configured: Boolean(process.env.GEMINI_API_KEY) })
}

export async function POST(request: Request) {
  const { uid, errorResponse } = await getVerifiedUid(request)
  if (errorResponse) return errorResponse

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return apiError(
      503,
      'The Safety Assistant is not configured on this server (GEMINI_API_KEY is missing).',
      'ASSISTANT_NOT_CONFIGURED'
    )
  }
  if (!allowed(uid)) return apiError(429, 'You are sending messages too quickly. Please wait a moment.', 'RATE_LIMITED')

  const body = await readJson(request)
  const raw = body?.messages
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return apiError(400, `messages must be an array of 1 to ${MAX_MESSAGES} items.`)
  }

  const messages: { role: Role; content: string }[] = []
  for (const item of raw) {
    const m = item as { role?: unknown; content?: unknown }
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return apiError(400, 'Each message needs a role (user/assistant) and text content.')
    }
    const content = m.content.trim()
    if (!content || content.length > MAX_CONTENT) return apiError(400, `Messages must be 1 to ${MAX_CONTENT} characters.`)
    messages.push({ role: m.role, content })
  }
  if (messages[messages.length - 1].role !== 'user') return apiError(400, 'The last message must be from the user.')

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const urgent = URGENT_PATTERN.test(messages[messages.length - 1].content)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.4, maxOutputTokens: 600 },
        }),
      }
    )

    if (!response.ok) {
      console.error('[assistant] Gemini HTTP', response.status)
      if (response.status === 429) return apiError(429, 'The assistant is busy right now. Please try again shortly.', 'UPSTREAM_BUSY')
      if (response.status === 400 || response.status === 403) {
        return apiError(502, 'The assistant could not be reached with the configured credentials.', 'UPSTREAM_AUTH')
      }
      return apiError(502, 'The assistant is temporarily unavailable.', 'UPSTREAM_ERROR')
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[]
      promptFeedback?: { blockReason?: string }
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim()
    if (!text) {
      const blocked = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason === 'SAFETY'
      return apiError(
        502,
        blocked
          ? 'The assistant could not answer that message. If you are in danger, call your emergency number now.'
          : 'The assistant returned an empty answer. Please try again.',
        'EMPTY_REPLY'
      )
    }
    return NextResponse.json({ reply: text, urgent, model })
  } catch (error) {
    const timedOut = (error as { name?: string }).name === 'AbortError'
    console.error('[assistant] request failed:', timedOut ? 'timeout' : (error as Error).message)
    return apiError(
      timedOut ? 504 : 502,
      timedOut ? 'The assistant took too long to answer. Please try again.' : 'Could not reach the assistant service.',
      timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE'
    )
  } finally {
    clearTimeout(timer)
  }
}
