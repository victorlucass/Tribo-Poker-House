'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  login: (user: string, pass: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_USER = 'victorlucas.ao';
const ADMIN_PASS = 'flamengo-tetra';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check localStorage on component mount to see if user was already logged in
    const storedIsAdmin = localStorage.getItem('isAdmin');
    if (storedIsAdmin === 'true') {
      setIsAdmin(true);
    }
  }, []);

  const login = (user: string, pass: string): boolean => {
    if (user === ADMIN_USER && pass === ADMIN_PASS) {
      localStorage.setItem('isAdmin', 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem('isAdmin');
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
