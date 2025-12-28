import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../shared/types'; // Updated import path
import { Lock, ArrowRight, ShieldCheck, AlertCircle, Eye, EyeOff, Globe, Plus, User as UserIcon, KeyRound } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
  onGuestAccess: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onGuestAccess }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [mode, setMode] = useState<'profile-select' | 'login' | 'create'>('profile-select');
  const [serverConfigured, setServerConfigured] = useState(false);
  
  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const init = async () => {
      // 1. Check for legacy migration (await it)
      await authService.migrateLegacyAuth();
      
      // 2. Load users asynchronously
      try {
        const existingUsers = await authService.getUsers();
        setUsers(existingUsers);
        
        // Default to create mode if no users exist
        if (existingUsers.length === 0) {
          setMode('create');
        }
      } catch (e) {
        console.error("Failed to load users", e);
      }

      // 3. Check Server Config
      const config = authService.getServerConfig();
      setServerConfigured(config.isConfigured);
    };

    init();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsSubmitting(true);
    setError('');

    try {
      const success = await authService.login(username, password);
      if (success) {
        onLogin();
      } else {
        setError('Invalid username or password');
      }
    } catch (err) {
      setError('Connection failed. Please check the server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (serverConfigured && !inviteCode) {
       // Only enforce if you have a signup code system, otherwise ignore
    }

    setIsSubmitting(true);
    setError('');

    try {
      await authService.register(username, password);
      onLogin(); // Auto-login after creation
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setUsername(user.username);
    setMode('login');
    setError('');
    setPassword('');
  };

  // --- RENDER HELPERS ---

  const renderProfileSelect = () => (
    <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Welcome Back</h1>
        <p className="text-slate-400">Who is using Tallo?</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {users.map(user => (
          <button
            key={user.id}
            onClick={() => handleUserSelect(user)}
            className="group relative flex flex-col items-center p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-rose-500/50 hover:bg-slate-800 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-xl font-bold text-white mb-3 shadow-lg group-hover:scale-110 transition-transform">
              {user.username.substring(0, 2).toUpperCase()}
            </div>
            <span className="font-medium text-slate-200 group-hover:text-white">{user.username}</span>
            {user.isAdmin && (
              <span className="absolute top-2 right-2 text-rose-500">
                <ShieldCheck className="w-4 h-4" />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => { setMode('create'); setUsername(''); setPassword(''); }}
          className="flex flex-col items-center p-4 bg-slate-900/20 border border-dashed border-slate-800 rounded-2xl hover:border-slate-600 hover:bg-slate-900/40 transition-all text-slate-500 hover:text-slate-300"
        >
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
            <Plus className="w-6 h-6" />
          </div>
          <span className="font-medium">Add Profile</span>
        </button>
      </div>

      <div className="text-center">
         <button onClick={onGuestAccess} className="text-sm text-slate-500 hover:text-slate-300 transition-colors flex items-center justify-center gap-2 mx-auto">
            <Globe className="w-4 h-4" />
            Continue as Guest
         </button>
      </div>
    </div>
  );

  const renderLogin = () => (
    <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto bg-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-900/50 mb-4">
           {selectedUser ? (
             <span className="text-xl font-bold text-white">{selectedUser.username.substring(0, 2).toUpperCase()}</span>
           ) : (
             <Lock className="w-8 h-8 text-white" />
           )}
        </div>
        <h2 className="text-2xl font-bold text-white">{selectedUser ? `Hello, ${selectedUser.username}` : 'Login'}</h2>
        <p className="text-slate-400 text-sm mt-1">{selectedUser ? 'Enter your password to continue' : 'Sign in to your account'}</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        {!selectedUser && (
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
                placeholder="Username"
                autoFocus={!selectedUser}
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
              placeholder="Password"
              autoFocus={!!selectedUser}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 p-3 rounded-lg border border-red-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
            <>
              Enter Tallo <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {users.length > 0 && (
        <button 
          onClick={() => { setMode('profile-select'); setSelectedUser(null); setError(''); }}
          className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Switch Profile
        </button>
      )}
    </div>
  );

  const renderCreate = () => (
    <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-300">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white">Create Profile</h2>
        <p className="text-slate-400 text-sm mt-1">Your data lives here, on this server.</p>
      </div>

      <form onSubmit={handleCreateUser} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Username</label>
          <input 
            type="text" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            placeholder="Choose a username"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Password</label>
          <input 
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            placeholder="Create password"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
          <input 
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all"
            placeholder="Repeat password"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 p-3 rounded-lg border border-red-900/50">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create Profile'}
        </button>
      </form>
      
      {users.length > 0 && (
        <button 
          onClick={() => setMode('profile-select')}
          className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-[100]">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-rose-500/5 rounded-full blur-[100px]"></div>
        <div className="absolute top-1/2 left-1/2 w-full h-full bg-blue-500/5 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full flex justify-center">
        {mode === 'profile-select' && users.length > 0 ? renderProfileSelect() : 
         mode === 'create' ? renderCreate() : renderLogin()}
      </div>
    </div>
  );
};

export default LoginScreen;