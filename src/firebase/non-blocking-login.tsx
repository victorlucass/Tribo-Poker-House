'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  // Assume getAuth and app are initialized elsewhere
} from 'firebase/auth';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call createUserWithEmailAndPassword directly. Do NOT use 'await createUserWithEmailAndPassword(...)'.
  createUserWithEmailAndPassword(authInstance, email, password).catch(error => {
    // This catch is a fallback for initial validation errors (e.g., weak password, invalid email format)
    // that happen before the onAuthStateChanged listener can even fire.
    // The UI should ideally handle this via a toast. We can log it here too.
    console.error("Signup Initiation Error:", error);
    // Note: We don't re-throw or emit here as the UI's `useToast` is the primary feedback mechanism.
    // The onAuthStateChanged listener in AuthProvider will handle success/failure from the backend.
  });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  signInWithEmailAndPassword(authInstance, email, password).catch(error => {
    // This catch is for client-side validation errors like invalid email format.
    console.error("Signin Initiation Error:", error);
  });
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}
