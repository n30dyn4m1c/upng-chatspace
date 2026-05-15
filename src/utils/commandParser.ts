export type CommandResult = {
  type: 'firestore' | 'local' | 'error'
  action: string
  payload?: any
}

interface CommandContext {
  uid: string
  handle: string
  email: string
}

const HELP_TEXT = [
  '*** UPNG CHATSPACE COMMAND REFERENCE ***',
  '/poll "Question"     — start a 24hr flash poll',
  '/vote [yes|no]       — cast your vote on active poll',
  '/suggest "Idea"      — submit a feature suggestion',
  '/report @Handle      — flag a user for admin review',
  '/help                — show this reference',
  '*** END REFERENCE ***'
]

function parseQuotedArg(args: string): string | null {
  const match = args.match(/"([^"]+)"/)
  return match ? match[1] : null
}

export function parseCommand(input: string, context: CommandContext): CommandResult {
  const trimmed = input.trim()
  const spaceIdx = trimmed.indexOf(' ')
  const command = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase()
  const args = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim()

  switch (command) {
    case '/help':
      return {
        type: 'local',
        action: 'help',
        payload: { lines: HELP_TEXT }
      }

    case '/report': {
      if (!args) {
        return {
          type: 'local',
          action: 'error',
          payload: { text: '*** ERROR: usage is /report @Handle ***' }
        }
      }
      const targetHandle = args.startsWith('@') ? args.slice(1) : args
      return {
        type: 'firestore',
        action: 'report',
        payload: {
          reporterUid: context.uid,
          reporterHandle: context.handle,
          targetHandle,
          resolved: false,
          messageSnapshot: null
        }
      }
    }

    case '/poll': {
      const question = parseQuotedArg(args)
      if (!question) {
        return {
          type: 'local',
          action: 'error',
          payload: { text: '*** ERROR: usage is /poll "Your question here" ***' }
        }
      }
      return {
        type: 'firestore',
        action: 'poll',
        payload: {
          question,
          creatorUid: context.uid,
          creatorHandle: context.handle
        }
      }
    }

    case '/vote': {
      const choice = args.toLowerCase()
      if (choice !== 'yes' && choice !== 'no') {
        return {
          type: 'local',
          action: 'error',
          payload: { text: '*** ERROR: usage is /vote yes or /vote no ***' }
        }
      }
      return {
        type: 'firestore',
        action: 'vote',
        payload: { choice, voterUid: context.uid }
      }
    }

    case '/suggest': {
      const text = parseQuotedArg(args)
      if (!text) {
        return {
          type: 'local',
          action: 'error',
          payload: { text: '*** ERROR: usage is /suggest "Your idea here" ***' }
        }
      }
      return {
        type: 'firestore',
        action: 'suggest',
        payload: {
          text,
          submitterUid: context.uid,
          submitterHandle: context.handle
        }
      }
    }

    default:
      return {
        type: 'error',
        action: 'unknown',
        payload: { text: `*** UNKNOWN COMMAND: ${command} — type /help for reference ***` }
      }
  }
}
