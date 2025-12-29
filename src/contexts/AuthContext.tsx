import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../../shared/types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    setIsLoading(true);
    try {
      // 1. Run migrations if any
      await authService.migrateLegacyAuth();
      
      // 2. Get local user state
      const currentUser = authService.getCurrentUser();
      
      if (currentUser) {
        // 3. Optional: Verify with server to prevent "Ghost Sessions"
        try {
          const serverUsers = await authService.getUsers();
          const isValid = Array.isArray(serverUsers) && serverUsers.find(u => u.id === currentUser.id);
          
          if (isValid) {
            setUser(currentUser);
          } else {
            console.warn("Invalid session detected. Logging out.");
            authService.logout();
            setUser(null);
          }
        } catch (e) {
          console.error("Auth server check failed", e);
          setUser(currentUser); 
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error("Auth initialization failed", e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async () => {
    const u = authService.getCurrentUser();
    setUser(u);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated: !!user, 
      isLoading, 
      login, 
      logout,
      refreshAuth: checkAuth
    }}>
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