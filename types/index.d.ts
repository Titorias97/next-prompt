/** The guessed next prompt the band offers. */
export type Suggestion = { text: string }

declare module 'claude-code' {
  interface PluginState {
    'next-prompt': { current: Shaped<Suggestion | null> }
  }
}
