# next-prompt

A Claude Code mod that guesses your next prompt after each reply and offers it to you, one click (or Tab) to send.

Claude Code's desktop app hides its own prompt suggestions whenever its next-step box is in use. This mod brings them back:

- **Desktop app:** the guess appears in a band above the message box as `Next: <guess>`. Click the text to send it, or click **Dismiss**.
- **Terminal:** the guess goes into the prompt box as the dim suggestion; press Tab to take it.

A new turn, or anything you type and send yourself, clears the guess.

## How it guesses

When a reply ends, the mod asks a fork of the conversation (served mostly from the prompt cache) for the message you would most likely type next: at most 12 words, in your own voice. When there is no conversation to fork it falls back to a short Haiku call over your last prompt and the reply. Replies that are unclear (`NONE`), too long, or written in the assistant's voice are dropped, so sometimes no guess shows.

Each guess is one extra small model request per reply, counted against your usage like any other.

## Install

At the prompt of a terminal session:

```
/plugin install next-prompt --marketplace Titorias97/next-prompt
```

From a shell:

```bash
claude plugin install next-prompt --marketplace Titorias97/next-prompt
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session).

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Titorias97/next-prompt`, then Add plugin.

## Development

```bash
claude plugin validate .
claude plugin test .
```

## License

MIT
