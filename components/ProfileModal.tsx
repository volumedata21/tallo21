import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { X, User as UserIcon, Lock, Save, LogOut, Check, Loader2 } from 'lucide-react';
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
  
  // Form State
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatarSeed || user.username);
  const [email, setEmail] = useState(user.email || '');
  
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
    }
  }, [isOpen, user]);

  const handleSave = async () => {
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

  const getAvatarUrl = (seed: string) => {
      if (seed && (seed.includes('.') || seed.includes('/'))) {
          // FIX: Use API route to avoid proxy issues
          return `/api/avatars/image/${seed}`;
      }
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl flex flex-col md:flex-row h-[600px] overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 bg-slate-950 border-r border-slate-800 p-6 flex flex-col shrink-0">
          <div className="flex flex-col items-center mb-8">
            <div className="w-24 h-24 rounded-full bg-slate-800 border-4 border-slate-700 overflow-hidden mb-3 shadow-xl relative">
               <img src={getAvatarUrl(selectedAvatar)} className="w-full h-full object-cover" alt="Profile" />
            </div>
            <h2 className="text-white font-bold text-lg truncate w-full text-center">{user.username}</h2>
            <span className="text-xs text-teal-500 uppercase font-bold tracking-wider">{user.role}</span>
          </div>
          
           <nav className="space-y-1 flex-1">
            <button onClick={() => setActiveTab('general')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <UserIcon size={18} /> General
            </button>
            <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'security' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>
                <Lock size={18} /> Security
            </button>
          </nav>
          
          <button onClick={onLogout} className="mt-auto w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <LogOut size={18} /> Sign Out
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-slate-900 relative min-w-0">
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>

          <div className="p-8 overflow-y-auto custom-scrollbar h-full">
            <h2 className="text-2xl font-bold text-white mb-6">
                {activeTab === 'general' ? 'Edit Profile' : 'Security Settings'}
            </h2>

            {activeTab === 'general' ? (
              <div className="space-y-8">
                
                {/* Avatar Selection Grid */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Choose Avatar</label>
                    
                    {isLoadingAvatars ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm"><Loader2 className="animate-spin" size={14} /> Loading avatars...</div>
                    ) : availableAvatars.length === 0 ? (
                        <div className="p-4 border border-dashed border-slate-700 rounded-xl text-slate-500 text-sm text-center">
                            No avatars found in /data/avatars
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
                            {availableAvatars.map(fileName => (
                                <button 
                                    key={fileName}
                                    onClick={() => setSelectedAvatar(fileName)}
                                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all group ${selectedAvatar === fileName ? 'border-teal-500 ring-2 ring-teal-500/20 scale-105' : 'border-slate-800 hover:border-slate-600'}`}
                                >
                                    {/* FIX: Use API route */}
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
                  <button onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50">
                    {isSaving ? <><Loader2 className="animate-spin" size={18} /> Saving...</> : <><Save size={18} /> Save Changes</>}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300 text-sm">
                  Security settings (password changes) are handled by the system administrator in this version.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};