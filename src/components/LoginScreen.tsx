
import React, { useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';
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
    // Check for legacy migration
    authService.migrateLegacyAuth();
    
    // Load users
    const existingUsers = authService.getUsers();
    setUsers(existingUsers);
    
    // Check if server config exists (signup code set)
    const config = authService.getServerConfig();
    setServerConfigured(config.isConfigured);

    if (existingUsers.length === 0) {
      setMode('create');
    }
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim()) {
      setError('Username is required');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.register(username.trim(), password, inviteCode.trim());
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Failed to create profile');
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    setError('');
    setIsSubmitting(true);
    
    const success = await authService.login(selectedUser.id, password);
    if (success) {
      onLogin();
    } else {
      setError('Incorrect password');
      setIsSubmitting(false);
    }
  };

  // UI Components
  const renderProfileSelect = () => (
    <div className="w-full max-w-2xl text-center">
      <h1 className="text-3xl font-black text-slate-100 mb-8 tracking-tight">Who is watching?</h1>
      
      <div className="flex flex-wrap justify-center gap-6 mb-12">
        {users.map(user => (
          <button 
            key={user.id}
            onClick={() => {
              setSelectedUser(user);
              setMode('login');
              setPassword('');
              setError('');
            }}
            className="group flex flex-col items-center gap-3 transition-transform hover:scale-105"
          >
            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-transparent group-hover:border-rose-500 group-hover:bg-slate-800/80 flex items-center justify-center transition-all shadow-xl">
               <UserIcon className="w-10 h-10 text-slate-400 group-hover:text-rose-500 transition-colors" />
            </div>
            <span className="text-slate-300 font-medium group-hover:text-white transition-colors">{user.username}</span>
          </button>
        ))}

        <button 
          onClick={() => {
            setMode('create');
            setUsername('');
            setPassword('');
            setConfirmPassword('');
            setInviteCode('');
            setError('');
          }}
          className="group flex flex-col items-center gap-3 transition-transform hover:scale-105"
        >
          <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-slate-800 group-hover:border-slate-600 flex items-center justify-center transition-all shadow-xl">
             <Plus className="w-10 h-10 text-slate-500 group-hover:text-slate-300 transition-colors" />
          </div>
          <span className="text-slate-500 font-medium group-hover:text-slate-300 transition-colors">Add Profile</span>
        </button>
      </div>

      <button 
        onClick={onGuestAccess}
        className="px-6 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-colors text-sm font-medium inline-flex items-center gap-2 border border-transparent hover:border-slate-800"
      >
        <Globe className="w-4 h-4" />
        Browse Public Gallery
      </button>
    </div>
  );

  const renderLoginForm = () => (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center mb-4 shadow-inner">
          <Lock className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Unlock {selectedUser?.username}</h2>
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div className="relative group">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600 pr-10"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-900/20 animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !password}
          className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-rose-900/20 flex items-center justify-center gap-2 mt-2"
        >
          {isSubmitting ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Unlock'}
        </button>
      </form>

      <button 
        onClick={() => setMode('profile-select')}
        className="w-full mt-4 py-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        Switch Profile
      </button>
    </div>
  );

  const renderCreateForm = () => (
    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-8 relative animate-in fade-in zoom-in duration-300">
      <div className="flex flex-col items-center mb-6">
        <div className="w-16 h-16 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-center mb-4 shadow-inner">
          <ShieldCheck className="w-8 h-8 text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Create Profile</h2>
        <p className="text-slate-500 text-sm mt-2 text-center">
          Create a local profile to keep your tallos organized.
        </p>
      </div>

      <form onSubmit={handleCreateUser} className="space-y-4">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Profile Name"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600"
          autoFocus
        />

        <div className="relative group">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm Password"
          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600"
        />

        {/* Invite Code Logic */}
        <div className="pt-2 border-t border-slate-800 mt-2">
          {users.length === 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <KeyRound className="w-3 h-3" />
                Server Admin Setup
              </div>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Set Invite Code (Optional)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600"
              />
              <p className="text-[10px] text-slate-600 mt-1">If set, other users will need this code to register.</p>
            </div>
          ) : serverConfigured ? (
             <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Invitation</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Server Invite Code"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-600"
              />
            </div>
          ) : null}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/20 p-3 rounded-lg border border-red-900/20 animate-in slide-in-from-top-1">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
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
        {mode === 'profile-select' && renderProfileSelect()}
        {mode === 'login' && renderLoginForm()}
        {mode === 'create' && renderCreateForm()}
      </div>
      
      <div className="absolute bottom-6 text-slate-700 text-xs font-medium">
        Tallo Secure Vault
      </div>
    </div>
  );
};

export default LoginScreen;
