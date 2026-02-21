import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from '../firebase'

export interface UserInfo {
  uid: string
  handle: string
  email: string
}

interface UserContextValue {
  user: UserInfo | null
  loading: boolean
  error: string | null
  clearError: () => void
}

const ADJECTIVES = ['Silent', 'Swift', 'Ghost', 'Feral', 'Lone', 'Dark', 'Wild', 'Hidden', 'Quiet', 'Bright']
const ANIMALS    = ['Kapul', 'Muruk', 'Magani', 'Pisin', 'Torosel', 'Rokrok', 'Kindam', 'Pukpuk', 'Sinek']

function generateHandle(): string {
  const adj    = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)]
  const num    = Math.floor(Math.random() * 90) + 10
  return `${adj}_${animal}_${num}`
}

function todayString(): string {
  return new Date().toISOString().split('T')[0]
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  error: null,
  clearError: () => {}
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    // Safety: if onAuthStateChanged never fires, stop loading after 4s
    const timeout = setTimeout(() => {
      setLoading(false)
    }, 4000)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(timeout)

      if (!firebaseUser) {
        setUser(null)
        setLoading(false)
        return
      }

      const email = firebaseUser.email ?? ''

      // Domain whitelist check
      if (!email.endsWith('@student.upng.ac.pg')) {
        await signOut(auth)
        setError('ACCESS DENIED: UPNG student email required.')
        setUser(null)
        setLoading(false)
        return
      }

      try {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const snap    = await getDoc(userRef)
        const today   = todayString()

        if (snap.exists()) {
          const data = snap.data()

          // Banned check
          if (data.banned === true) {
            await signOut(auth)
            setError('ACCESS DENIED: ACCOUNT SUSPENDED.')
            setUser(null)
            setLoading(false)
            return
          }

          let handle = data.handle as string

          // Handle rotation — new handle every day
          if (data.handleDate !== today) {
            handle = generateHandle()
            await updateDoc(userRef, {
              handle,
              handleDate: today,
              lastSeen: serverTimestamp()
            })
          } else {
            await updateDoc(userRef, { lastSeen: serverTimestamp() })
          }

          setError(null)
          setUser({ uid: firebaseUser.uid, handle, email })
        } else {
          // First-time user — create profile
          const handle = generateHandle()
          await setDoc(userRef, {
            handle,
            email,
            createdAt:  serverTimestamp(),
            lastSeen:   serverTimestamp(),
            banned:     false,
            handleDate: today
          })
          setError(null)
          setUser({ uid: firebaseUser.uid, handle, email })
        }
      } catch (err) {
        console.error('Profile error:', err)
        setError('ERROR: Failed to load user profile.')
        setUser(null)
      }

      setLoading(false)
    })

    return () => {
      clearTimeout(timeout)
      unsubscribe()
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, loading, error, clearError: () => setError(null) }}>
      {children}
    </UserContext.Provider>
  )
}

export const useUser = () => useContext(UserContext)
export default UserContext
