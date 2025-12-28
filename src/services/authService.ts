
import { User } from '../types';

const SALT = 'pinspire-secure-salt'; 
const USERS_KEY = 'pinspire_users';
const SESSION_KEY = 'pinspire_session_user';
const CONFIG_KEY = 'pinspire_server_config';

interface ServerConfig {
  signupCodeHash: string | null;
  isConfigured: boolean;
  maxFileSize?: number; // Size in bytes
}

export const authService = {
  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  getUsers(): User[] {
    const usersStr = localStorage.getItem(USERS_KEY);
    return usersStr ? JSON.parse(usersStr) : [];
  },

  getCurrentUser(): User | null {
    const userId = sessionStorage.getItem(SESSION_KEY);
    if (!userId) return null;
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  },

  getServerConfig(): ServerConfig {
    const configStr = localStorage.getItem(CONFIG_KEY);
    const defaults: ServerConfig = { 
      signupCodeHash: null, 
      isConfigured: false, 
      maxFileSize: 2 * 1024 * 1024 * 1024 // Default 2GB
    };
    
    if (configStr) {
      const stored = JSON.parse(configStr);
      return { ...defaults, ...stored };
    }
    return defaults;
  },

  async updateServerConfig(updates: Partial<ServerConfig>): Promise<void> {
    const current = this.getServerConfig();
    const newConfig = { ...current, ...updates };
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
  },

  async setSignupCode(code: string): Promise<void> {
    const hash = await this.hashPassword(code);
    await this.updateServerConfig({ signupCodeHash: hash, isConfigured: true });
  },

  async verifySignupCode(code: string): Promise<boolean> {
    const config = this.getServerConfig();
    // If no code is set, allow (first run scenario handled by register logic usually)
    if (!config.signupCodeHash) return true;
    
    const inputHash = await this.hashPassword(code);
    return inputHash === config.signupCodeHash;
  },

  async register(username: string, password: string, inviteCode?: string): Promise<User> {
    const users = this.getUsers();
    const config = this.getServerConfig();

    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      throw new Error('Username already exists');
    }

    // If it's NOT the first user, and a code is configured, check it
    if (config.isConfigured && users.length > 0) {
      if (!inviteCode) throw new Error('Invite code is required to join this server');
      const validCode = await this.verifySignupCode(inviteCode);
      if (!validCode) throw new Error('Invalid invite code');
    }

    // If it IS the first user, and they provided a code, set it as the server code
    if (users.length === 0 && inviteCode) {
      await this.setSignupCode(inviteCode);
    }

    const passwordHash = await this.hashPassword(password);
    const newUser: User = {
      id: crypto.randomUUID(),
      username,
      passwordHash,
      createdAt: Date.now(),
      isAdmin: users.length === 0 // First user is Admin
    };

    users.push(newUser);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    
    // Auto login
    this.startSession(newUser.id);
    return newUser;
  },

  async login(userId: string, password: string): Promise<boolean> {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) return false;
    
    const inputHash = await this.hashPassword(password);
    if (inputHash === user.passwordHash) {
      this.startSession(user.id);
      return true;
    }
    return false;
  },

  startSession(userId: string) {
    sessionStorage.setItem(SESSION_KEY, userId);
  },

  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  migrateLegacyAuth() {
    const legacyHash = localStorage.getItem('pinspire_auth_hash');
    const users = this.getUsers();
    
    if (legacyHash && users.length === 0) {
      const defaultUser: User = {
        id: crypto.randomUUID(),
        username: 'Admin',
        passwordHash: legacyHash,
        createdAt: Date.now(),
        isAdmin: true // Legacy user is Admin
      };
      localStorage.setItem(USERS_KEY, JSON.stringify([defaultUser]));
      localStorage.removeItem('pinspire_auth_hash'); 
      return defaultUser;
    }
    return null;
  }
};
