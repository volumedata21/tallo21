import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { X, User as UserIcon, Lock, Save, LogOut, Check, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { dataService } from '../services/dataService';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onLogout: () => void;
  onUpdate: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, user, onLogout, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'security'>('general');
  const [availableAvatars, setAvailableAvatars] = useState<string[]>([]);
  
  // General Form State
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatarSeed || user.username);
  const [email, setEmail] = useState(user.email || '');
  
  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);

  // Load avatars when modal opens
  useEffect(() => {
    if (isOpen) {
        setIsLoadingAvatars(true);
        dataService.getAvatars()
            .then(files => setAvailableAvatars(files))
            .catch(err => console.error("Failed to load avatars", err))
            .finally(() => setIsLoadingAvatars(false));
            
        setSelectedAvatar(user.avatarSeed || user.username);
        setEmail(user.email || '');
        // Reset password fields
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setPassMsg(null);
    }
  }, [isOpen, user]);

  const handleSaveProfile = async () => {
      setIsSaving(true);
      try {
          await dataService.updateProfile(user.id, { 
              email, 
              avatarSeed: selectedAvatar 
          });
          onUpdate(); // Refresh app data
          onClose();
      } catch (e) {
          alert("Failed to save profile");
      } finally {
          setIsSaving(false);
      }
  };

  const handleUpdatePassword = async () => {
      setPassMsg(null);
      
      // Validation
      if (!currentPassword || !newPassword || !confirmPassword) {
          return setPassMsg({ type: 'error', text: 'All fields are required.' });
      }
      if (newPassword !== confirmPassword) {
          return setPassMsg({ type: 'error', text: 'New passwords do not match.' });
      }
      if (newPassword.length < 8) {
          return setPassMsg({ type: 'error', text: 'Password must be at least 8 characters.' });
      }

      setIsSaving(true);
      try {
          // Verify we have the method before calling
          if (typeof dataService.changePassword !== 'function') {
              throw new Error("Service method not implemented");
          }

          await dataService.changePassword(user.id, currentPassword, newPassword);
          setPassMsg({ type: 'success', text: 'Password updated successfully.' });
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
      } catch (e: any) {
          console.error(e);
          // Backend should return 401/403 if current password is wrong
          const errorText = e.message || 'Failed to update password. Check your current password.';
          setPassMsg({ type: 'error', text: errorText });
      } finally {
          setIsSaving(false);
      }
  };

  const getAvatarUrl = (seed: string) => {
      if (seed && (seed.includes('.') || seed.includes('/'))) {
          return `/api/avatars/image/${seed}`;
      }
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full h-full sm:h-[600px] sm:max-w-4xl sm:rounded-2xl border-0 sm:border border-slate-800 shadow-2xl flex flex-col md:flex-row overflow-hidden">
        
        {/* SIDEBAR */}
        <div className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 p-4 md:p-6 flex flex-row md:flex-col items-center md:shrink-0 gap-4 md:gap-0 relative">
          
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white md:hidden">
            <X size={24} />
          </button>

          {/* Profile Summary */}
          <div className="flex flex-row md:flex-col items-center gap-4 md:gap-0 md:mb-8 flex-1 md:flex-none">
            <div className="w-16 h-16 md:w-24 md:h-24 rounded-full bg-slate-800 border-2 md:border-4 border-slate-700 overflow-hidden md:mb-3 shadow-xl relative shrink-0">
               <img src={getAvatarUrl(selectedAvatar)} className="w-full h-full object-cover" alt="Profile" />
            </div>
            <div className="text-left md:text-center">
                <h2 className="text-white font-bold text-lg truncate max-w-[150px] md:max-w-full">{user.username}</h2>
                <span className="text-xs text-teal-500 uppercase font-bold tracking-wider block">{user.role}</span>
            </div>
          </div>
          
           {/* Navigation */}
           <nav className="hidden md:block space-y-1 flex-1 w-full">
            <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <UserIcon size={18} /> General
            </button>
            <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Lock size={18} /> Security
            </button>
          </nav>
          
          <button onClick={onLogout} className="hidden md:flex mt-auto w-full items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-slate-900 relative min-w-0 h-full overflow-hidden">
          
          {/* Mobile Tabs */}
          <div className="flex md:hidden border-b border-slate-800 shrink-0">
              <button onClick={() => setActiveTab('general')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'general' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500'}`}>
                  General
              </button>
              <button onClick={() => setActiveTab('security')} className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'security' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500'}`}>
                  Security
              </button>
          </div>

          <button onClick={onClose} className="hidden md:block absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-10">
            <X size={24} />
          </button>

          <div className="p-4 md:p-8 overflow-y-auto custom-scrollbar h-full pb-20 md:pb-8">
            <h2 className="hidden md:block text-2xl font-bold text-white mb-6">
                {activeTab === 'general' ? 'Edit Profile' : 'Security Settings'}
            </h2>

            {activeTab === 'general' ? (
              <div className="space-y-6 md:space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
                
                {/* Avatar Selection */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Choose Avatar</label>
                    {isLoadingAvatars ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="animate-spin" size={14} /> Loading avatars...</div>
                    ) : availableAvatars.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm text-center">
                            No avatars found in /data/avatars
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 gap-3">
                            {availableAvatars.map(fileName => (
                                <button 
                                    key={fileName}
                                    onClick={() => setSelectedAvatar(fileName)}
                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${selectedAvatar === fileName ? 'border-teal-500 ring-2 ring-teal-500/20 scale-105' : 'border-slate-800 hover:border-slate-600'}`}
                                >
                                    <img src={`/api/avatars/image/${fileName}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={fileName} />
                                    {selectedAvatar === fileName && (
                                        <div className="absolute inset-0 bg-teal-500/40 flex items-center justify-center">
                                            <Check size={20} className="text-white drop-shadow-md" strokeWidth={3} />
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                  <input 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    placeholder="Enter your email"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none transition-colors" 
                  />
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button onClick={handleSaveProfile} disabled={isSaving} className="w-full md:w-auto bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {isSaving ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : <><Save size={18} /> Save Changes</>}
                  </button>
                  
                  <button onClick={onLogout} className="md:hidden mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl border border-red-500/20">
                     <LogOut size={18} /> Sign Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 max-w-lg animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 text-slate-400 text-sm mb-6">
                    To change your password, you must enter your current password first to verify your identity.
                </div>

                {passMsg && (
                    <div className={`p-4 rounded-xl flex items-start gap-3 text-sm ${passMsg.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'}`}>
                        {passMsg.type === 'error' ? <AlertCircle size={18} className="shrink-0 mt-0.5" /> : <CheckCircle2 size={18} className="shrink-0 mt-0.5" />}
                        <span>{passMsg.text}</span>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current Password</label>
                    <input 
                        type="password"
                        value={currentPassword} 
                        onChange={e => setCurrentPassword(e.target.value)} 
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none transition-colors"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">New Password</label>
                        <input 
                            type="password"
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Confirm New</label>
                        <input 
                            type="password"
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:border-teal-500 outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button onClick={handleUpdatePassword} disabled={isSaving} className="w-full md:w-auto bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50">
                    {isSaving ? <><Loader2 className="animate-spin" size={18} /> Updating...</> : <><Lock size={18} /> Update Password</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};