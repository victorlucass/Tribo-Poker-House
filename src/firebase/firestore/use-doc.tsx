"use client";

import * as React from "react";
import type {
  DocumentData,
  DocumentReference,
  FirestoreError,
} from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

type DocOptions = {
  disabled?: boolean;
};

// NOTE: This is a very basic implementation of a useDoc hook.
// You can add more features like error handling, loading states, etc.
export function useDoc<T = DocumentData>(
  ref: DocumentReference<T> | null,
  options: DocOptions = {}
) {
  const { disabled } = options;
  const [data, setData] = React.useState<T | null>(null);
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = React.useState<FirestoreError | null>(null);

  React.useEffect(() => {
    if (!ref || disabled) {
      // Set status to idle if the ref is disabled. This is useful for when
      // you want to wait for some other data before fetching the document.
      setStatus("idle");
      setData(null);
      return;
    }

    setStatus("loading");
    const unsubscribe = onSnapshot(
      ref,
      (doc) => {
        if (doc.exists()) {
          setData(doc.data());
        } else {
          // Set data to null if the document doesn't exist.
          setData(null);
        }
        setStatus("success");
        setError(null);
      },
      (err) => {
        console.error(err);
        setError(err);
        setStatus("error");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [ref, disabled]);

  return { data, status, error };
}
