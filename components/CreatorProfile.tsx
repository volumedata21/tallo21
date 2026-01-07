import React, { useState, useEffect } from 'react';
import { Board, Pin, UserSettings } from '../types';
import { dataService } from '../services/dataService';
import { PinCard } from './PinCard';
import { Grid, Layers, Calendar, ArrowLeft, Lock, Globe, EyeOff, Layout } from 'lucide-react';

interface CreatorProfileProps {
    userId: string;
    onClose: () => void;
    onPinClick: (pin: Pin) => void;
    onBoardClick: (boardId: string) => void;
    currentUserId?: string; 
}

export const CreatorProfile: React.FC<CreatorProfileProps> = ({ 
    userId, onClose, onPinClick, onBoardClick, currentUserId 
}) => {
    const [profile, setProfile] = useState<any>(null);
    const [boards, setBoards] = useState<Board[]>([]);
    const [pins, setPins] = useState<Pin[]>([]);
    const [activeTab, setActiveTab] = useState<'boards' | 'stems'>('boards');
    const [isLoading, setIsLoading] = useState(true);

    const viewSettings: UserSettings = {
        hideTitles: false,
        hideDescriptions: true,
        showTags: false,
        darkMode: true
    };

    useEffect(() => {
        loadProfile();
    }, [userId]);

    const loadProfile = async () => {
        setIsLoading(true);
        try {
            const userData = await dataService.getPublicProfile(userId);
            setProfile(userData);
            const boardsData = await dataService.getBoards(userId);
            setBoards(boardsData);
            const pinsData = await dataService.getPins({ creatorId: userId });
            setPins(pinsData);
        } catch (e) {
            console.error("Failed to load profile", e);
        }
        setIsLoading(false);
    };

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center h-full bg-[#020408] text-teal-500 gap-4">
            <div className="w-12 h-12 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
            <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Loading Profile...</span>
        </div>
    );
    
    if (!profile) return <div className="flex items-center justify-center h-full text-red-400 bg-[#020408]">User not found</div>;

    const getAvatarUrl = (seed: string) => {
        if (seed && (seed.includes('.') || seed.includes('/'))) return `/api/avatars/image/${seed}`;
        return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
    };

    return (
        <div className="h-full flex flex-col bg-[#020408] overflow-y-auto custom-scrollbar animate-in fade-in duration-500 relative z-10">
            
            {/* --- HERO HEADER --- */}
            <div className="relative shrink-0 overflow-hidden border-b border-white/5">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-teal-900/20 via-[#0B1120]/80 to-[#020408] pointer-events-none" />
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[500px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

                <button 
                    onClick={onClose}
                    className="absolute top-6 left-6 z-20 p-3 bg-black/20 hover:bg-white/10 backdrop-blur-md text-white rounded-full transition-all border border-white/5 group"
                >
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                </button>

                <div className="relative pt-20 pb-10 px-6 flex flex-col items-center text-center z-10">
                    <div className="relative mb-6 group cursor-default">
                        <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-500 to-purple-600 rounded-full opacity-75 blur group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative w-28 h-28 rounded-full border-4 border-[#020408] bg-[#0B1120] overflow-hidden shadow-2xl">
                             <img src={getAvatarUrl(profile.avatarSeed)} className="w-full h-full object-cover" alt="Profile" />
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tight drop-shadow-lg">
                        {profile.username}
                    </h1>
                    
                    <div className="flex items-center gap-6 text-[10px] md:text-xs font-bold uppercase tracking-widest text-slate-400 bg-white/5 px-8 py-3 rounded-full backdrop-blur-md border border-white/5 shadow-xl">
                         <span className="flex items-center gap-2">
                            <span className="text-teal-400 text-sm">{boards.length}</span> Boards
                         </span>
                         <div className="w-1 h-1 bg-slate-600 rounded-full" />
                         <span className="flex items-center gap-2">
                            <span className="text-slate-200 text-sm">{profile.stats.pins}</span> Stems
                         </span>
                         <div className="w-1 h-1 bg-slate-600 rounded-full" />
                         <span className="flex items-center gap-2">
                            <Calendar size={12} className="text-slate-500"/> {new Date(profile.joinedAt).getFullYear()}
                         </span>
                    </div>
                </div>
            </div>

            {/* --- TABS --- */}
            <div className="sticky top-0 bg-[#020408]/80 backdrop-blur-xl z-30 border-b border-white/5">
                <div className="flex justify-center gap-8 md:gap-16">
                    <button 
                        onClick={() => setActiveTab('boards')}
                        className={`py-5 text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeTab === 'boards' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Layout size={16} /> Boards
                    </button>
                    <button 
                        onClick={() => setActiveTab('stems')}
                        className={`py-5 text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 transition-all flex items-center gap-2 ${activeTab === 'stems' ? 'border-teal-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                    >
                        <Grid size={16} /> All Stems
                    </button>
                </div>
            </div>

            {/* --- CONTENT GRID --- */}
            <div className="p-6 md:p-8 lg:p-12 flex-1 max-w-[2000px] mx-auto w-full">
                
                {activeTab === 'boards' ? (
                    /* BOARDS GRID: Max 4 per row */
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                        {boards.map(board => (
                            <div 
                                key={board.id} 
                                onClick={() => onBoardClick(board.id)}
                                className="group cursor-pointer bg-[#0B1120] rounded-2xl overflow-hidden border border-white/5 hover:border-teal-500/50 transition-all hover:shadow-2xl hover:shadow-teal-900/20 hover:-translate-y-1 relative"
                            >
                                <div className="aspect-[3/4] bg-[#151b2b] relative overflow-hidden">
                                    {board.coverImage ? (
                                        <img 
                                            src={board.coverImage} 
                                            alt={board.title} 
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 opacity-80 group-hover:opacity-100"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                                            <Layers size={48} className="text-teal-500 mb-2" />
                                        </div>
                                    )}
                                    
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/20 to-transparent opacity-80" />

                                    {board.ownerId === currentUserId && (
                                        <div className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 shadow-lg">
                                            {board.visibility === 'public' ? <Globe size={12} className="text-teal-400"/> : 
                                             board.visibility === 'unlisted' ? <EyeOff size={12} className="text-slate-400"/> :
                                             <Lock size={12} className="text-red-400"/>}
                                        </div>
                                    )}
                                </div>

                                <div className="absolute bottom-0 left-0 w-full p-5">
                                    {/* FIX: Font size 2xl (1.5rem) */}
                                    <h3 className="font-bold text-white text-2xl leading-tight group-hover:text-teal-400 transition-colors truncate tracking-tight drop-shadow-md">
                                        {board.title}
                                    </h3>
                                    <div className="flex items-center justify-between mt-2">
                                        <p className="text-[10px] font-bold text-slate-300 tracking-wide bg-white/10 px-2 py-1 rounded-md backdrop-blur-sm">
                                            {board.collectionId ? 'Collection' : 'Board'}
                                        </p>
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-teal-500 group-hover:text-white transition-colors backdrop-blur-sm">
                                            <ArrowLeft size={14} className="rotate-180" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {boards.length === 0 && (
                            <div className="col-span-full py-32 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                                <Layers size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="text-sm font-medium uppercase tracking-widest">No public boards yet.</p>
                            </div>
                        )}
                    </div>
                ) : (
                    /* STEMS GRID: Max 3 columns -> Bigger Pins */
                    <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6 mx-auto">
                        {pins.map(pin => (
                            <div key={pin.id} className="break-inside-avoid">
                                <PinCard 
                                    pin={pin} 
                                    settings={viewSettings} 
                                    onClick={() => onPinClick(pin)} 
                                />
                            </div>
                        ))}
                         {pins.length === 0 && (
                            <div className="py-32 text-center text-slate-500 col-span-full w-full border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                                <Grid size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="text-sm font-medium uppercase tracking-widest">No public stems yet.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};