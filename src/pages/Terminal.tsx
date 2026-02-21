import { useState, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../context/UserContext'

interface Message {
  id: string
  text: string
  handle: string
  timestamp: Date
  type: 'user' | 'system'
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    text: 'anyone else having trouble with the CS201 assignment?',
    handle: 'Ghost_Muruk_42',
    timestamp: new Date(Date.now() - 120000),
    type: 'user'
  },
  {
    id: '2',
    text: 'yeah the recursion part is tricky, try drawing the call stack',
    handle: 'Swift_Kapul_17',
    timestamp: new Date(Date.now() - 60000),
    type: 'user'
  },
  {
    id: '3',
    text: 'Welcome to UPNG ChatSpace. Be respectful. Handles rotate daily.',
    handle: '',
    timestamp: new Date(),
    type: 'system'
  }
]

const MAX_CHARS = 140

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function buildPulseBar(signalCount: number): string {
  const filled = Math.round((signalCount / 20) * 10)
  const empty = 10 - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

export default function Terminal() {
  const { user } = useUser()
  const [messages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const feedEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()

    const trimmed = input.trim()
    if (!trimmed) return

    if (trimmed.startsWith('/')) {
      handleCommand(trimmed)
    } else {
      handleSend(trimmed)
    }
    setInput('')
  }

  const handleSend = (text: string) => {
    console.log('[SEND]', text)
  }

  const handleCommand = (cmd: string) => {
    console.log('[CMD]', cmd)
  }

  const handleExit = () => {
    signOut(auth)
  }

  const remaining = MAX_CHARS - input.length
  const signalCount = 3

  return (
    <div className="terminal-container">
      {/* Header */}
      <div className="terminal-header">
        <span>UPNG CHATSPACE v1.0 | SECURE CHANNEL ACTIVE</span>
        <span>
          {user?.handle}{' '}
          <span
            onClick={handleExit}
            style={{ cursor: 'pointer', color: 'var(--warn)' }}
          >
            [EXIT]
          </span>
        </span>
      </div>

      {/* Message Feed */}
      <div className="terminal-feed">
        <div className="terminal-feed-inner">
          {messages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: '0.25rem' }}>
              {msg.type === 'system' ? (
                <span style={{ color: 'var(--system)' }}>
                  [{formatTime(msg.timestamp)}] *** {msg.text} ***
                </span>
              ) : (
                <span style={{ color: 'var(--text)' }}>
                  [{formatTime(msg.timestamp)}] {msg.handle} &gt; {msg.text}
                </span>
              )}
            </div>
          ))}
          <div ref={feedEndRef} />
        </div>
      </div>

      {/* Pulse Bar */}
      <div className="terminal-pulse">
        [NOISE] {buildPulseBar(signalCount)} {signalCount} signals | TTL: 4:00 | CHANNEL: OPEN
      </div>

      {/* Input Bar */}
      <div className="terminal-input">
        <span>{user?.handle} &gt;&nbsp;</span>
        <input
          type="text"
          value={input}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) {
              setInput(e.target.value)
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          autoFocus
        />
        <span style={{ color: remaining < 10 ? 'var(--warn)' : 'var(--text)' }}>
          {remaining}/{MAX_CHARS}
        </span>
      </div>
    </div>
  )
}
