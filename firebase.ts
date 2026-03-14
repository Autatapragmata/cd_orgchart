// Fix: Use Firebase v8 compat imports for app and auth to resolve export errors.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore'; // Fix: Import compat firestore

const firebaseConfig = {
  apiKey: "AIzaSyCymoIyag5xOf4PqUE_7iEakKW41uKQNuE",
  authDomain: "mta-cd-orgchart.firebaseapp.com",
  projectId: "mta-cd-orgchart",
  storageBucket: "mta-cd-orgchart.firebasestorage.app",
  messagingSenderId: "374142422499",
  appId: "1:374142422499:web:fbf06c7c27d0dd036ea4d6",
  measurementId: "G-VYT051ZLYJ"
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