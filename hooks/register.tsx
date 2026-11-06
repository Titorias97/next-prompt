import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/**
 * next-prompt: after each answer, guess the person's next prompt and offer it.
 *
 * Where the prompt box takes a dim suggestion (the terminal) it goes there,
 * Tab to take. The desktop app's box takes none from a mod, so there the guess
 * sits in the band above the box: press it to send it, or dismiss it. A new
 * turn, or anything typed and sent, clears it.
 */

// Change the tag when Suggestion's fields change: it declines what an earlier
// version stored, which outlives a reload.
const current = atom({ plugin: 'next-prompt', key: 'current' } as const, null, {
  shape: 'suggestion-1',
})

/** Asked over the session's own transcript (a fork, served from its cache). */
const FORK_ASK = [
  '[Prompt suggestion request from the next-prompt mod. This is not a message from the person.]',
  "Guess the person's next message in this conversation: what they would most likely type now, right after your last answer.",
  'Write it as they would: their own words, voice and language, addressed to you, as a short instruction, answer or question.',
  'If your last answer asked them something, guess their reply. Prefer the obvious next step over anything new.',
  'At most 12 words, one line, plain text. No quotes, no preamble, no explanation. Do not call any tool.',
  'If no next message is clear, reply with exactly: NONE',
].join('\n')

/** The cheap fallback, when there is no transcript to fork. */
const SOLO_SYSTEM =
  "You guess a person's next message to their coding assistant. Reply with that message alone: at most 12 words, one line, in the person's own voice and language, no quotes. If nothing is clear, reply NONE."

// A reply in the assistant's voice is not a guess at the person's prompt.
const ASSISTANT_VOICE =
  /^(let me|i'll|i've|i'm|i can|i would|i think|i notice|here's|here is|here are|that's|this is|this will|you can|you should|you could|sure,|of course|certainly)\b/i

/** The first line of a reply as a prompt, or null when it is not one. */
export function clean(raw: string): string | null {
  const line =
    raw
      .split('\n')
      .map(part => part.trim())
      .find(part => part.length > 0) ?? ''
  const text = line.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g, '').trim()
  if (text.length === 0 || /^none\.?$/i.test(text)) return null
  if (text.length > 140 || text.split(/\s+/).length > 20) return null
  if (ASSISTANT_VOICE.test(text)) return null
  return text
}

// Each main turn takes a ticket; a guess lands only while its ticket is still
// the latest, so a slow guess never shows over a newer turn. Module variables
// start over on a reload, which only drops a guess in flight.
let ticket = 0
let lastPrompt = ''

async function clear($: EngineInterface) {
  await update($, current, () => null)
}

async function send($: EngineInterface, text: string) {
  ticket += 1
  await clear($)
  await $.prompt.submit({ text, asUser: true })
}

async function guess($: EngineInterface, mine: number, answer: string) {
  let reply = await $.model.fork({ prompt: FORK_ASK })
  if (!reply.isAnswered && reply.reason === 'nothing-to-fork') {
    reply = await $.model.complete({
      model: 'haiku',
      system: SOLO_SYSTEM,
      prompt: `The person's last message:\n${lastPrompt.slice(-2000)}\n\nThe assistant's answer:\n${answer.slice(-6000)}\n\nTheir next message:`,
      maxTokens: 60,
      effort: 'low',
      timeoutMs: 20000,
    })
  }
  if (mine !== ticket || !reply.isAnswered) return
  const text = clean(reply.text)
  if (text === null) return
  const box = await $.prompt.suggest({ text })
  if (mine !== ticket) return
  // Shown in the prompt box: the band stays empty.
  await update($, current, () => (box.isShown ? null : { text }))
}

export const register: Register = on => {
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      ticket += 1
      if (e.text.length > 0) lastPrompt = e.text
      await clear($)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined || e.reason !== 'answer') return done
    const mine = ticket
    const answer = e.answer
    // Guessed on a timer: the turn ends now, the guess follows when ready.
    $.clock.after(0, () => {
      void guess($, mine, answer)
    })
    return done
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const offer = await read($, current)
    if (offer === null) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box>
        <Text dimColor>Next: </Text>
        <Button key="send" plain onPress={() => send($, offer.text)}>
          {offer.text}
        </Button>
        <Text> </Text>
        <Button key="dismiss" label="Dismiss" role="dismiss" dimColor onPress={() => clear($)} />
      </Box>
    )
  })
}
