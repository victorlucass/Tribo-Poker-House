"use client";

import * as React from "react";
import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";
import { useUser } from "./auth/use-user";

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
  // NOTE: This is a very basic implementation of a Firebase provider.
  // You can add more features like authentication, etc.
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore }}>
      {children}
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
