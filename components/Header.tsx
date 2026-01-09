import React, { useState } from 'react';
import { User } from '../types';
// FIX 1: Added 'Globe' to imports
import { Search, Hash, Map, Grid, Plus, Menu, Settings, Shield, ChevronDown, LogOut, Globe, LogIn } from 'lucide-react';

interface HeaderProps {
  user: User | null; // Changed to allow null
  viewMode: 'grid' | 'map';
  onToggleView: (mode: 'grid' | 'map') => void;
  onToggleSidebar: () => void;
  onCreatePin: () => void;
  onLogoClick: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenProfile: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
  onOpenSettings: () => void; // Correct
}

export const Header: React.FC<HeaderProps> = ({ 
    user, viewMode, onToggleView, onToggleSidebar, onCreatePin, 
    onLogoClick, searchQuery, onSearchChange, onOpenProfile, 
    onOpenAdmin, onLogout, 
    onOpenSettings // FIX 2: Added this here so it can be used below
}) => {
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

    const getAvatarUrl = (seed: string) => {
        if (seed && (seed.includes('.') || seed.includes('/'))) {
            return `/api/avatars/image/${seed}`;
        }
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
    };

    return (
        <header className="h-16 md:h-20 bg-[#000208]/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 sm:px-8 z-30 sticky top-0 transition-all">
            
            {/* Left: Mobile Menu & Search */}
            <div className="flex items-center gap-2 md:gap-4 flex-1">
                {user && (
                    <button 
                        onClick={onToggleSidebar} 
                        className="p-2 -ml-2 text-slate-400 hover:text-white md:hidden active:scale-95 transition-transform"
                    >
                        <Menu size={24} />
                    </button>
                )}

                {/* Mobile Search Icon (Expandable logic could go here, for now keeping simple) */}
                <div className="relative w-full max-w-md hidden sm:block">
                  
{/* Conditionally render Icon */}
    {searchQuery.startsWith('#') ? (
        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500" size={18} />
    ) : (
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
    )}                    <input 
                        type="text" 
                        placeholder="Search stems..." 
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-teal-500 focus:bg-slate-900 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Right: Actions & Profile */}
            <div className="flex items-center gap-2 sm:gap-4">
                
                {/* View Toggle - Hidden on very small screens if needed, or kept compact */}
                <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                    <button 
                        onClick={() => onToggleView('grid')}
                        className={`p-1.5 md:p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-800 text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Grid size={18} />
                    </button>
                    <button 
                        onClick={() => onToggleView('map')}
                        className={`p-1.5 md:p-2 rounded-md transition-all ${viewMode === 'map' ? 'bg-slate-800 text-teal-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Map size={18} />
                    </button>
                </div>

                {user ? (
                    <>
                        {/* CREATE BUTTON - Now visible on mobile as a small Icon button, full button on desktop */}
                        <button 
                            onClick={onCreatePin}
                            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-500 text-white p-2 md:px-4 md:py-2 rounded-full font-bold transition-all shadow-lg shadow-teal-900/20 active:scale-95"
                            title="Create Stem"
                        >
                            <Plus size={20} />
                            <span className="hidden md:inline">Create</span>
                        </button>

                        <div className="h-8 w-px bg-slate-800 mx-1 hidden sm:block"></div>

                        {/* Profile Dropdown */}
                        <div className="relative">
                            <button 
                                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                                onBlur={() => setTimeout(() => setIsProfileMenuOpen(false), 200)}
                                className="flex items-center gap-2 md:gap-3 pl-1 md:pl-2 pr-1 py-1 rounded-full hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all group"
                            >
                                <div className="text-right hidden md:block">
                                    <div className="text-xs font-bold text-slate-200">{user.username}</div>
                                    <div className="text-[10px] text-teal-500 uppercase font-bold tracking-wider">{user.role}</div>
                                </div>
                                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-800 border-2 border-slate-800 group-hover:border-teal-500/50 overflow-hidden transition-all">
                                    <img src={getAvatarUrl(user.avatarSeed)} alt="Profile" className="w-full h-full object-cover" />
                                </div>
                                <ChevronDown size={14} className="text-slate-500 mr-2 hidden md:block" />
                            </button>

                            {/* Dropdown Menu */}
                            {isProfileMenuOpen && (
                                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-xl shadow-xl py-2 animate-in fade-in slide-in-from-top-2 z-50">
                                    <div className="px-4 py-3 border-b border-slate-800 md:hidden">
                                        <div className="font-bold text-white">{user.username}</div>
                                        <div className="text-xs text-slate-500">{user.email}</div>
                                    </div>
                                    
                                    <button onClick={onOpenProfile} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-3">
                                        <Globe size={16} /> My Public Profile
                                    </button>

                                    <button onClick={onOpenSettings} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-3">
                                        <Settings size={16} /> Account Settings
                                    </button>
                                    
                                    {user.role === 'admin' && (
                                        <button onClick={onOpenAdmin} className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-3">
                                            <Shield size={16} /> Admin Panel
                                        </button>
                                    )}
                                    
                                    <div className="h-px bg-slate-800 my-1"></div>
                                    
                                    <button onClick={onLogout} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-3">
                                        <LogOut size={16} /> Log Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <button 
                        onClick={() => window.location.reload()} // Forcing reload will show login screen if there is no session
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full font-bold transition-all border border-slate-700"
                    >
                        <LogIn size={16} />
                        <span className="hidden sm:inline">Log In</span>
                    </button>
                )}
            </div>
        </header>
    );
};