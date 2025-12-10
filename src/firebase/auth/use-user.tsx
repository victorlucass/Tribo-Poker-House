"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { useAuth } from "../provider";

export function useUser() {
  const auth = useAuth();
  const [user, setUser] = React.useState<User | null>(null);
  const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    setStatus("loading");
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setStatus("success");
      },
      (error) => {
        setError(error);
        setStatus("error");
      }
    );

    return () => {
      unsubscribe();
    };
  }, [auth]);

  return { user, status, error };
}
