import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { requirePublicEnv } from './env'

const firebaseConfig = {
  apiKey: requirePublicEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requirePublicEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requirePublicEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requirePublicEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requirePublicEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requirePublicEnv('VITE_FIREBASE_APP_ID'),
}

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig)
export const firebaseAuth = getAuth(firebaseApp)
export const googleAuthProvider = new GoogleAuthProvider()
