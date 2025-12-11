"use client";

import * as React from "react";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from "./error-emitter";
import { FirestorePermissionError } from "./errors";

// This is a global listener for Firestore permission errors.
// It is used to display a toast message when a permission error occurs.
const FirebaseErrorListener = () => {
    const { toast } = useToast();
    React.useEffect(() => {
        const unsubscribe = errorEmitter.on('permission-error', (error: FirestorePermissionError) => {
            console.error("Firestore Permission Error caught by global listener:", error);
            toast({
                variant: 'destructive',
                title: 'Erro de Permissão do Firestore',
                description: (
                    <div className="mt-2 w-full">
                        <p className="text-xs">{error.message}</p>
                        <pre className="mt-2 w-full rounded-md bg-slate-950 p-2">
                            <code className="text-white text-xs">
                                {JSON.stringify(error.context, null, 2)}
                            </code>
                        </pre>
                    </div>
                ),
                duration: 20000,
            })
        });

        return () => {
            errorEmitter.off('permission-error', unsubscribe);
        }
    }, [toast]);

    return null;
}


type FirebaseContextValue = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

const FirebaseContext = React.createContext<FirebaseContextValue | null>(null);

type FirebaseProviderProps = {
  children: React.ReactNode;
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
};

export function FirebaseProvider({
  children,
  app,
  auth,
  firestore,
}: FirebaseProviderProps) {
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore }}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  const context = React.useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider");
  }
  return context;
}

export function useFirebaseApp() {
  const context = React.useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirebaseApp must be used within a FirebaseProvider");
  }
  return context.app;
}

export function useAuth() {
  const context = React.useContext(FirebaseContext);
  if (!context) {
    throw new Error("useAuth must be used within a FirebaseProvider");
  }
  return context.auth;
}

export function useFirestore() {
  const context = React.useContext(FirebaseContext);
  if (!context) {
    throw new Error("useFirestore must be used within a FirebaseProvider");
  }
  return context.firestore;
}

    