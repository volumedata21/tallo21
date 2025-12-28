import { User } from '../shared/types';

const API = '/api/auth';
const SESSION_KEY = 'tallo_session_user';

export const authService = {
  // REMOVED: hashPassword function is no longer needed here

  async register(username: string, password: string): Promise<User> {
    // Send raw password to server
    const newUserPayload = {
      id: crypto.randomUUID(),
      username,
      password, // CHANGED: Sending raw password
      createdAt: Date.now(),
      isAdmin: false 
    };

    // Check if this is the first user (Admin)
    const existingUsers = await this.getUsers();
    if (existingUsers.length === 0) {
      newUserPayload.isAdmin = true;
    }

    const res = await fetch(`${API}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUserPayload)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Registration failed');
    }

    // The server doesn't return the password, so we construct the session user without it
    const newUser: User = {
        id: newUserPayload.id,
        username: newUserPayload.username,
        passwordHash: '', // Don't keep this in session storage
        createdAt: newUserPayload.createdAt,
        isAdmin: newUserPayload.isAdmin
    };

    this.startSession(newUser);
    return newUser;
  },

  async login(username: string, password: string): Promise<boolean> {
    // CHANGED: Send raw password, no hashing
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    if (res.ok) {
      const user = await res.json();
      this.startSession(user);
      return true;
    }
    return false;
  },

  // ... keep getUsers, startSession, logout, getCurrentUser, migrateLegacyAuth, getServerConfig as they were
  
  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch('/api/users');
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  startSession(user: User) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  getCurrentUser(): User | null {
    const stored = sessionStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  },

  async migrateLegacyAuth() {},
  
  getServerConfig() {
     return { isConfigured: true };
  }
};