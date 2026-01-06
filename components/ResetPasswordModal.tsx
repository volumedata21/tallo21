import React, { useState } from 'react';
import { Lock, Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ResetPasswordModalProps {
  token: string;
  onClose: () => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({ token, onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async () => {
      if (newPassword !== confirm) {
          setStatus('error');
          setErrorMsg("Passwords do not match");
          return;
      }
      if (newPassword.length < 8) {
          setStatus('error');
          setErrorMsg("Password must be at least 8 characters");
          return;
      }

      setStatus('saving');
      try {
          await dataService.completePasswordReset(token, newPassword);
          setStatus('success');
          // Clear the URL param so refreshing doesn't re-trigger
          window.history.replaceState({}, '', '/');
      } catch (e: any) {
          setStatus('error');
          setErrorMsg(e.message || "Invalid link");
      }
  };

  if (status === 'success') {
      return (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-teal-500/50 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl">
                <div className="mx-auto w-16 h-16 bg-teal-500/20 text-teal-500 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Password Reset!</h2>
                <p className="text-slate-400 mb-6">You can now log in with your new password.</p>
                <button onClick={() => window.location.reload()} className="w-full bg-teal-600 hover:bg-teal-500 text-white py-3 rounded-xl font-bold transition">
                    Go to Login
                </button>
            </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-2xl max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl">
                    <Lock size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-white">Reset Password</h2>
                    <p className="text-xs text-slate-500">Enter a new secure password.</p>
                </div>
            </div>

            {status === 'error' && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
                    <AlertCircle size={16} /> {errorMsg}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">New Password</label>
                    <input 
                        type="password" 
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">Confirm Password</label>
                    <input 
                        type="password" 
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                </div>
                
                <button 
                    onClick={handleSubmit} 
                    disabled={status === 'saving'}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all mt-4"
                >
                    {status === 'saving' ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    Set New Password
                </button>
            </div>
        </div>
    </div>
  );
};