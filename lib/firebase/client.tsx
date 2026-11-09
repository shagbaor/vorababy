'use client'

import { createContext, useContext } from 'react'
import { getApps, initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth'

// Browser-side Firebase, used only for the Google sign-in popup. The config is
// passed down from the server (the web API key is not a secret), so no
// NEXT_PUBLIC_ variables are needed.

export type FirebaseClientConfig = { apiKey: string; authDomain: string; projectId: string }

const ConfigContext = createContext<FirebaseClientConfig | null>(null)

export function FirebaseClientProvider({ config, children }: { config: FirebaseClientConfig; children: React.ReactNode }) {
  return <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
}

export function useFirebaseConfig() {
  return useContext(ConfigContext)
}

// Opens the Google popup and returns a Firebase ID token for the server. The
// browser's own Firebase session is dropped straight away: the admin session
// is the server's cookie.
export async function googleIdToken(config: FirebaseClientConfig) {
  const app = getApps()[0] ?? initializeApp(config)
  const auth = getAuth(app)
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const { user } = await signInWithPopup(auth, provider)
  const idToken = await user.getIdToken()
  await signOut(auth)
  return idToken
}
