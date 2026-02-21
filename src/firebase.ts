import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyB8XvISguety_zD7vscfKdd5nqCDa6Hyg8',
  authDomain: 'upng-chatspace.firebaseapp.com',
  projectId: 'upng-chatspace',
  storageBucket: 'upng-chatspace.firebasestorage.app',
  messagingSenderId: '569892735853',
  appId: '1:569892735853:web:74a32f97efca6e521fa864'
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
