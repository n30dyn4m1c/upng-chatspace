import { useUser } from '../context/UserContext'

export default function Terminal() {
  const { user } = useUser()

  return (
    <div style={{
      height: '100%',
      padding: '1.5rem',
      backgroundColor: 'var(--bg)'
    }}>
      <p style={{ color: 'var(--system)', marginBottom: '0.5rem' }}>
        &gt; SYSTEM READY. AWAITING INPUT.
      </p>
      <p style={{ color: 'var(--text)' }}>
        &gt; CONNECTED AS: <span style={{ color: 'var(--system)' }}>{user?.handle}</span>
      </p>
    </div>
  )
}
