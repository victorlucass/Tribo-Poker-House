'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

let firebaseApp: FirebaseApp;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    firebaseApp = initializeApp(firebaseConfig);
  } else {
    firebaseApp = getApp();
  }

  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // NOTE: In a real-world scenario, you'd want to use a condition like
  // process.env.NODE_ENV === 'development' to ensure emulators are only
  // used in development.
  // connectAuthEmulator(auth, 'http://localhost:9099');
  // connectFirestoreEmulator(firestore, 'localhost', 8080);
  
  return {
    firebaseApp,
    auth,
    firestore
  };
}


export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './auth/use-user';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';