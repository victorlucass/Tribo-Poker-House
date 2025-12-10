"use client";

import * as React from "react";
import type {
  CollectionReference,
  DocumentData,
  Query,
  QuerySnapshot,
} from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

type CollectionOptions = {
  disabled?: boolean;
};

// NOTE: This is a very basic implementation of a useCollection hook.
// You can add more features like error handling, loading states, etc.
export function useCollection<T = DocumentData>(
  query: Query<T> | CollectionReference<T> | null,
  options: CollectionOptions = {}
) {
  const { disabled } = options;
  const [data, setData] = React.useState<T[] | null>(null);
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!query || disabled) {
      // Set status to idle if the query is disabled. This is useful for when
      // you want to wait for some other data before fetching the collection.
      setStatus("idle");
      setData(null);
      return;
    }

    setStatus("loading");
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<T>) => {
        const docs = snapshot.docs.map((doc) => doc.data());
        setData(docs);
        setStatus("success");
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
  }, [query, disabled]);

  return { data, status, error };
}

    