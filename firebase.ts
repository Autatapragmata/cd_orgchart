// Fix: Use Firebase v8 compat imports for app and auth to resolve export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore'; // Fix: Import compat firestore

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Fix: Initialize the default app instance using the compat API.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Fix: Use the v8-style namespaced auth and firestore objects.
export const auth = firebase.auth();
export const db = firebase.firestore();
// Fix: Export the User type from the namespaced firebase object, as it's not a named export in the modular/compat SDK.
export type User = firebase.User;