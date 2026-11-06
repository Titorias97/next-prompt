import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import { clean } from '../hooks/register'

const BAND = {
  plugin: 'next-prompt',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

// Stands for the engine's own band: what shows when the mod has nothing.
function engineBand(on: On) {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
}

const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_read_input_tokens: 1000,
  cache_creation_input_tokens: 0,
}

test('clean keeps a prompt and drops what is not one', async () => {
  expect(clean('"Yes, deploy"')).toBe('Yes, deploy')
  expect(clean('\n  run the tests  \nextra line')).toBe('run the tests')
  expect(clean('NONE')).toBeNull()
  expect(clean('none.')).toBeNull()
  expect(clean("I'll deploy it now")).toBeNull()
  expect(clean('Here is what I would type')).toBeNull()
  expect(clean('word '.repeat(25))).toBeNull()
})

test('a guess the box cannot show sits in the band; a press sends it', async ($, on) => {
  const clock = mock.clock(on)
  engineBand(on)
  const sent: string[] = []
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.fork', () => ({
    value: { isAnswered: true, text: '"Yes, deploy"', usage: USAGE },
  }))
  on('prompt.suggest', () => ({ isShown: false }))
  on('prompt.submit', (_, e) => {
    sent.push(e.text)
    return { text: e.text }
  })

  await $.turn.start({ text: 'fix the phone layout', turnId: 't1' })
  await $.turn.complete({
    answer: 'Fixed. Deploy?',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })
  await clock.settle()

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ key: 'send' }))?.text).toBe('Yes, deploy')

  await ui.press({ key: 'send' })
  expect(sent).toEqual(['Yes, deploy'])
  expect(await ui.find({ key: 'send' })).toBeUndefined()
  await ui.unmount()
})

test('a guess the box shows leaves the band empty', async ($, on) => {
  const clock = mock.clock(on)
  engineBand(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.fork', () => ({
    value: { isAnswered: true, text: 'run the tests', usage: USAGE },
  }))
  on('prompt.suggest', () => ({ isShown: true }))

  await $.turn.start({ text: 'write tests', turnId: 't1' })
  await $.turn.complete({
    answer: 'Done.',
    durationMs: 1,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
  })
  await clock.settle()

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ key: 'send' })).toBeUndefined()
  await ui.unmount()
})

test('dismiss clears the band, and a new turn clears a guess', async ($, on) => {
  const clock = mock.clock(on)
  engineBand(on)
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('model.fork', () => ({
    value: { isAnswered: true, text: 'commit it', usage: USAGE },
  }))
  on('prompt.suggest', () => ({ isShown: false }))

  const turn = async (id: string) => {
    await $.turn.start({ text: 'go', turnId: id })
    await $.turn.complete({
      answer: 'ok',
      durationMs: 1,
      isAborted: false,
      turnId: id,
      reason: 'answer',
    })
    await clock.settle()
  }

  await turn('t1')
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ key: 'send' }))?.text).toBe('commit it')
  await ui.press({ key: 'dismiss' })
  expect(await ui.find({ key: 'send' })).toBeUndefined()

  await turn('t2')
  expect((await ui.find({ key: 'send' }))?.text).toBe('commit it')
  await $.turn.start({ text: 'something else', turnId: 't3' })
  expect(await ui.find({ key: 'send' })).toBeUndefined()
  await ui.unmount()
})
