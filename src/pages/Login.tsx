import { useEffect, useState } from 'react'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '../firebase'
import { useUser } from '../context/UserContext'

const BOOT_LINES = [
  'UPNG CHATSPACE v1.0',
  'UNIVERSITY OF PAPUA NEW GUINEA',
  'ANONYMOUS LIVE CHAT TERMINAL',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  'INITIALIZING ENCRYPTION LAYER... OK',
  'CHECKING DOMAIN WHITELIST......... OK',
  'ESTABLISHING SECURE CHANNEL....... OK',
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  'AUTHENTICATE TO CONTINUE.',
]

const SEPARATOR_COLOR = 'var(--system)'
const TEXT_COLOR      = 'var(--text)'

export default function Login() {
  const { error: ctxError, clearError } = useUser()

  const [displayedLines, setDisplayedLines] = useState<string[]>([])
  const [done, setDone]           = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [busy, setBusy]           = useState(false)

  const visibleError = ctxError ?? localError

  // Typewriter boot sequence — setInterval so cleanup is one clearInterval call
  useEffect(() => {
    const state = { lineIdx: 0, charIdx: 0, pause: 6 }
    const displayed: string[] = []

    const id = setInterval(() => {
      // Inter-line pause countdown
      if (state.pause > 0) {
        state.pause--
        return
      }

      if (state.lineIdx >= BOOT_LINES.length) {
        clearInterval(id)
        setDone(true)
        return
      }

      const target      = BOOT_LINES[state.lineIdx]
      const isSeparator = target.startsWith('━')

      if (isSeparator) {
        displayed[state.lineIdx] = target
        setDisplayedLines([...displayed])
        state.lineIdx++
        state.charIdx = 0
        state.pause   = 6          // ~72ms gap after separator
      } else if (state.charIdx < target.length) {
        state.charIdx++
        displayed[state.lineIdx] = target.slice(0, state.charIdx)
        setDisplayedLines([...displayed])
      } else {
        state.lineIdx++
        state.charIdx = 0
        state.pause   = 6          // ~72ms gap after each line
      }
    }, 12)

    return () => clearInterval(id)
  }, [])

  async function handleAuth() {
    setLocalError(null)
    clearError()
    setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (
        code !== 'auth/popup-closed-by-user' &&
        code !== 'auth/cancelled-popup-request'
      ) {
        setLocalError('ERROR: Authentication failed. Try again.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      paddingTop: '15vh',
      backgroundColor: 'var(--bg)'
    }}>
      <div style={{ maxWidth: '520px', width: '100%', padding: '0 1.5rem' }}>

        {/* Boot lines */}
        {displayedLines.map((line, i) => (
          <p
            key={i}
            style={{
              color: line.startsWith('━') ? SEPARATOR_COLOR : TEXT_COLOR,
              marginBottom: '0.15rem',
              whiteSpace: 'pre',
              lineHeight: '1.7'
            }}
          >
            {line}
            {/* Blinking cursor trails the last typed line */}
            {i === displayedLines.length - 1 && !done && (
              <span className="cursor" />
            )}
          </p>
        ))}

        {/* Post-sequence UI */}
        {done && (
          <>
            {visibleError && (
              <p style={{
                color: 'var(--warn)',
                marginTop: '1rem',
                letterSpacing: '0.03em',
                lineHeight: '1.5'
              }}>
                {visibleError}
              </p>
            )}

            <button
              onClick={handleAuth}
              disabled={busy}
              style={{
                marginTop: '1.5rem',
                display: 'block',
                width: '100%',
                padding: '0.65rem 1rem',
                background: 'transparent',
                color: 'var(--text)',
                border: '1px solid var(--text)',
                borderRadius: 0,
                boxShadow: 'none',
                fontFamily: 'inherit',
                fontSize: '1rem',
                letterSpacing: '0.08em',
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.5 : 1,
                transition: 'opacity 0.15s'
              }}
            >
              {busy ? '[ AUTHENTICATING... ]' : '[ AUTHENTICATE WITH UPNG EMAIL ]'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
