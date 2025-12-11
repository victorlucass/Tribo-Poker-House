'use client';
    
import { useState, useEffect, useContext } from 'react';
import {
  DocumentReference,
  onSnapshot,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { FirebaseContext } from '../provider'; // Import context

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDoc hook.
 * @template T Type of the document data.
 */
export interface UseDocResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  status: 'loading' | 'success' | 'error';
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to subscribe to a single Firestore document in real-time.
 * Handles nullable references.
 * 
 * IMPORTANT! YOU MUST MEMOIZE the inputted memoizedTargetRefOrQuery or BAD THINGS WILL HAPPEN
 * use useMemo to memoize it per React guidence.  Also make sure that it's dependencies are stable
 * references
 *
 *
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference. Waits if null/undefined.
 * @returns {UseDocResult<T>} Object with data, status, error.
 */
export function useDoc<T = any>(
  memoizedDocRef: DocumentReference<DocumentData> | null | undefined,
): UseDocResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const firebaseContext = useContext(FirebaseContext);

  useEffect(() => {
    // Wait until firebase auth is resolved and a docRef is provided
    if (!firebaseContext || firebaseContext.isUserLoading || !memoizedDocRef) {
      setStatus(!memoizedDocRef ? 'success' : 'loading'); // If no ref, not loading. If ref, waiting for auth.
      setData(null);
      setError(null);
      return;
    }

    setStatus('loading');
    setError(null);
    setData(null); // Clear previous data

    const unsubscribe = onSnapshot(
      memoizedDocRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setStatus('success');
        setError(null);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'get',
          path: memoizedDocRef.path,
        });

        setError(contextualError);
        setData(null);
        setStatus('error');
        
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedDocRef, firebaseContext]);

  return { data, status, error };
}
