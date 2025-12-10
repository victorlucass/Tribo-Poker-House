"use client";

import * as React from "react";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

import { initializeFirebase, FirebaseProvider } from ".";

type FirebaseClientProviderProps = {
  children: React.ReactNode;
};

// NOTE: We could do this in the `FirebaseProvider` directly, but it's nice to
// have a separate client provider that can be used in other places. This also
// allows the `FirebaseProvider` to be used on the server in the future.
export function FirebaseClientProvider({
  children,
}: FirebaseClientProviderProps) {
  const [firebase, setFirebase] = React.useState<{
    app: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
  } | null>(null);

  React.useEffect(() => {
    const firebaseInstances = initializeFirebase();
    setFirebase(firebaseInstances);
  }, []);

  if (!firebase) {
    return null;
  }

  return (
    <FirebaseProvider
      app={firebase.app}
      auth={firebase.auth}
      firestore={firebase.firestore}
    >
      {children}
    </FirebaseProvider>
  );
}
