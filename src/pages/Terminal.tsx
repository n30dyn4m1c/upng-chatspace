import { useState, useRef, useEffect, useCallback } from 'react'
import { signOut } from 'firebase/auth'
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  runTransaction,
  doc,
  Timestamp,
  serverTimestamp,
  arrayUnion,
  increment
} from 'firebase/firestore'
import { auth, db } from '../firebase'
import { useUser } from '../context/UserContext'
import { parseCommand } from '../utils/commandParser'

interface Message {
  id: string
  uid: string
  text: string
  handle: string
  timestamp: Date
  expiresAt: number
  type: 'user' | 'system'
  reported: boolean
}

interface SystemMessage {
  id: string
  text: string
  timestamp: Date
  type: 'system'
}

interface LocalMessage {
  id: string
  text: string
  timestamp: number
  type: 'system' | 'error'
}

const MAX_CHARS = 140
const TTL_MS = 4 * 60 * 1000

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

function buildPulseBar(signalCount: number): string {
  const filled = Math.min(Math.floor(signalCount / 2), 10)
  const empty = 10 - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

function formatTTL(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function Terminal() {
  const { user } = useUser()
  const [messages, setMessages] = useState<Message[]>([])
  const [systemMessages, setSystemMessages] = useState<SystemMessage[]>([])
  const [input, setInput] = useState('')
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([])
  const [rateLimited, setRateLimited] = useState(false)
  const [ttlDisplay, setTtlDisplay] = useState('--:--')
  const feedEndRef = useRef<HTMLDivElement>(null)
  const lastSendRef = useRef<number>(0)
  const messagesRef = useRef<Message[]>([])

  // Keep messagesRef in sync for use in interval callbacks
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // Auto-scroll on new messages
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, systemMessages, localMessages])

  // Real-time Firestore listener
  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      where('expiresAt', '>', Timestamp.now()),
      orderBy('expiresAt', 'asc'),
      limit(50)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now()
      const docs: Message[] = snapshot.docs
        .map((d) => {
          const data = d.data()
          return {
            id: d.id,
            uid: data.uid,
            text: data.text,
            handle: data.handle,
            timestamp: data.timestamp?.toDate() ?? new Date(),
            expiresAt: data.expiresAt.toMillis(),
            type: data.type as 'user' | 'system',
            reported: data.reported ?? false
          }
        })
        .filter((msg) => msg.expiresAt > now)

      setMessages(docs)
    })

    return () => unsubscribe()
  }, [])

  // Client-side TTL reaper (every 15s)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const current = messagesRef.current
      const alive = current.filter((msg) => msg.expiresAt > now)
      const expiredCount = current.length - alive.length

      if (expiredCount > 0) {
        setMessages(alive)

        const sysMsg: SystemMessage = {
          id: `sys-${Date.now()}`,
          text: `*** ${expiredCount} signal(s) lost to the void ***`,
          timestamp: new Date(),
          type: 'system'
        }
        setSystemMessages((prev) => [...prev, sysMsg])

        // Auto-remove system message after 5 seconds
        setTimeout(() => {
          setSystemMessages((prev) => prev.filter((m) => m.id !== sysMsg.id))
        }, 5000)
      }
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  // TTL countdown (every 1s)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = messagesRef.current
      if (current.length === 0) {
        setTtlDisplay('--:--')
        return
      }

      // Find oldest message (lowest expiresAt)
      let oldest = current[0].expiresAt
      for (const msg of current) {
        if (msg.expiresAt < oldest) oldest = msg.expiresAt
      }

      const remaining = oldest - Date.now()
      setTtlDisplay(remaining > 0 ? formatTTL(remaining) : '0:00')
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleSend = useCallback(async (text: string) => {
    if (!user) return

    const trimmed = text.trim()
    if (trimmed.length < 1 || trimmed.length > MAX_CHARS) return

    // Rate limit: 2 second cooldown
    if (Date.now() - lastSendRef.current < 2000) {
      setRateLimited(true)
      setTimeout(() => setRateLimited(false), 500)
      return
    }

    try {
      await addDoc(collection(db, 'messages'), {
        uid: user.uid,
        handle: user.handle,
        text: trimmed,
        timestamp: serverTimestamp(),
        expiresAt: Timestamp.fromMillis(Date.now() + TTL_MS),
        type: 'user',
        reported: false
      })
      lastSendRef.current = Date.now()
    } catch (err) {
      console.error('Failed to send message:', err)
    }
  }, [user])

  const handleCommand = useCallback((cmd: string) => {
    console.log('[CMD]', cmd)
  }, [])

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

  const handleExit = () => {
    signOut(auth)
  }

  const remaining = MAX_CHARS - input.length
  const signalCount = messages.length

  // Merge Firestore messages with local system messages for rendering
  const allMessages = [
    ...messages.map((m) => ({ ...m, sortKey: m.timestamp.getTime() })),
    ...systemMessages.map((m) => ({
      ...m,
      uid: '',
      expiresAt: 0,
      reported: false,
      sortKey: m.timestamp.getTime()
    }))
  ].sort((a, b) => a.sortKey - b.sortKey)

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
          {allMessages.map((msg) => (
            <div key={msg.id} style={{ marginBottom: '0.25rem' }}>
              {msg.type === 'system' ? (
                <span style={{ color: 'var(--system)' }}>
                  [{formatTime(msg.timestamp)}] {msg.text}
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
        [NOISE] {buildPulseBar(signalCount)} {signalCount} signals | TTL: {ttlDisplay} | CHANNEL: OPEN
      </div>

      {/* Input Bar */}
      <div className={`terminal-input${rateLimited ? ' terminal-input--flash' : ''}`}>
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
