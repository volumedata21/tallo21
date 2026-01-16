import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { User } from '../types';
import { Loader2, ArrowRight, ChevronsUp, Ticket, Globe } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false); // NEW STATE
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // --- OIDC State ---
  const [oidcEnabled, setOidcEnabled] = useState(false);
  useEffect(() => {
      fetch('/api/auth/oidc/status')
          .then(res => res.json())
          .then(data => setOidcEnabled(data.enabled))
          .catch(() => setOidcEnabled(false));
  }, []);

  // Form State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [inviteCode, setInviteCode] = useState(''); // NEW FIELD

  useEffect(() => {
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const isSetup = await dataService.checkSystemSetup();
      setIsSetupMode(!isSetup);
    } catch (e) {
      console.error(e);
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      let user: User;
      if (isSetupMode) {
        user = await dataService.setupAdmin({ username, password, email });
      } else if (isRegistering) {
        // REGISTER LOGIC
        user = await dataService.register({ username, password, email, inviteCode });
      } else {
        user = await dataService.login({ username, password });
      }
      
      localStorage.setItem('tallo_user', JSON.stringify(user));
      onLogin(user);
    } catch (e: any) {
      setError(e.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#000208] flex items-center justify-center text-teal-500">
        <Loader2 className="animate-spin w-10 h-10" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden flex items-center justify-center p-4">
      {/* ... Background Effects ... */}
      <div className="absolute inset-0 bg-[#000208] z-0"></div>
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-teal-600/20 rounded-full blur-[120px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-blue-600/20 rounded-full blur-[120px] opacity-40 animate-pulse" style={{ animationDuration: '4s' }}></div>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay"></div>

      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-blue-600 rounded-2xl blur opacity-30"></div>
        
        <div className="relative bg-slate-950/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl p-8 sm:p-10">
          
          <div className="text-center mb-8">
            <div className="relative inline-block mb-6">
               <div className="absolute inset-0 bg-teal-500 blur-xl opacity-20 rounded-full"></div>
               <div className="relative w-20 h-20 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl flex items-center justify-center border border-slate-700 shadow-inner">
                  <ChevronsUp size={40} className="text-teal-500" strokeWidth={3} />
               </div>
            </div>
            
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 mb-2">
              {isSetupMode ? 'Setup Tallo' : isRegistering ? 'Join Tallo' : 'Welcome Back'}
            </h1>
            <p className="text-slate-400 text-sm">
              {isSetupMode ? 'Initialize your admin workspace.' : isRegistering ? 'Enter your invite code to create an account.' : 'Enter your credentials to access the grid.'}
            </p>
          </div>

          {/* --- OIDC Button --- */}
          {oidcEnabled && !isSetupMode && (
            <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                <a 
                    href="/api/auth/oidc/login"
                    className="w-full flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700/80 text-white font-medium py-3 rounded-xl transition-all border border-slate-700 hover:border-slate-600 mb-4 backdrop-blur-sm group"
                >
                    <Globe size={18} className="text-teal-500 group-hover:scale-110 transition-transform" />
                    <span>Continue with Single Sign-On</span>
                </a>
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-slate-600 text-xs uppercase font-bold tracking-widest">Or</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* INVITE CODE FIELD (Only in Register Mode) */}
            {isRegistering && (
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-teal-500/80 uppercase tracking-widest ml-1 flex items-center gap-1">
                        <Ticket size={12} /> Invite Code
                    </label>
                    <input 
                        type="text" 
                        required
                        value={inviteCode}
                        onChange={e => setInviteCode(e.target.value.toUpperCase())}
                        className="w-full bg-teal-900/20 border border-teal-500/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:bg-slate-900 outline-none transition-all duration-200 font-mono tracking-widest"
                        placeholder="XXXX-XXXX"
                    />
                </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-teal-500/80 uppercase tracking-widest ml-1">Username</label>
              <input 
                type="text" 
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-teal-500/50 focus:bg-slate-900 outline-none transition-all duration-200"
                placeholder="username"
              />
            </div>

            {(isSetupMode || isRegistering) && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-teal-500/80 uppercase tracking-widest ml-1">
                  Email <span className="text-slate-600 font-normal lowercase">(optional)</span>
                </label>
                <input 
                  type="email" 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-teal-500/50 focus:bg-slate-900 outline-none transition-all duration-200"
                  placeholder="user@example.com"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-teal-500/80 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="password" 
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3.5 text-white placeholder-slate-600 focus:border-teal-500/50 focus:bg-slate-900 outline-none transition-all duration-200"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs font-medium text-center animate-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={submitting}
              className="group w-full relative overflow-hidden bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-500 hover:to-teal-400 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-teal-900/20 flex items-center justify-center gap-2 mt-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <span className="relative flex items-center gap-2">
                {submitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    {isSetupMode ? 'Initialize System' : isRegistering ? 'Create Account' : 'Enter System'} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </span>
            </button>

            {/* SWITCH MODE BUTTON */}
            {!isSetupMode && (
                <div className="text-center pt-2">
                    <button 
                        type="button"
                        onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
                        className="text-slate-500 hover:text-teal-400 text-sm transition-colors"
                    >
                        {isRegistering ? "Already have an account? Log In" : "Have an invite? Sign Up"}
                    </button>
                </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};