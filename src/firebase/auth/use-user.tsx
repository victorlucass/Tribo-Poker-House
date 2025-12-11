"use client";

import * as React from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";

import { useAuth as useFirebaseAuth } from "../provider";

export interface UseUserResult {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

export function useUser(): UseUserResult {
  const auth = useFirebaseAuth();
  const [user, setUser] = React.useState<User | null>(null);
  const [isUserLoading, setIsUserLoading] = React.useState<boolean>(true);
  const [userError, setUserError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (!auth) {
      setIsUserLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        setUser(user);
        setIsUserLoading(false);
      },
      (error) => {
        setUserError(error);
        setIsUserLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [auth]);

  return { user, isUserLoading, userError };
}
