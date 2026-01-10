import React from 'react';
import { Collection } from '../types';
import { Settings, Share2, Trash2, Layers } from 'lucide-react';

interface CollectionHeaderProps {
    collection: Collection;
    pinCount: number;
    isOwner: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onShare: () => void;
}

export const CollectionHeader: React.FC<CollectionHeaderProps> = ({ 
    collection, pinCount, isOwner, onEdit, onDelete, onShare 
}) => {
    
    return (
        <div className="mb-6 relative group">
            {/* Main Card */}
            <div className="relative bg-gradient-to-r from-[#0B1120] to-blue-950/30 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8 shadow-2xl overflow-hidden">
                
                {/* Ambient Title Glow */}
                <div className="absolute top-0 left-0 w-96 h-full bg-purple-500/5 blur-3xl pointer-events-none" />

                {/* Left: Title & Info */}
                <div className="flex flex-col relative z-10">
                    <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-3 drop-shadow-[0_0_15px_rgba(168,85,247,0.25)]">
                        {collection.title}
                    </h1>
                    
                    <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5 backdrop-blur-sm">
                            <Layers size={12} className="text-purple-400" />
                            Collection
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-700" />
                        <span>{pinCount} {pinCount === 1 ? 'Stem' : 'Stems'}</span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 relative z-10">
                    <button 
                        onClick={onShare}
                        className="h-10 px-4 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 border border-white/5 hover:border-white/10 transition-all flex items-center gap-2 uppercase tracking-wider"
                    >
                        <Share2 size={16} />
                        <span className="inline">Share</span>
                    </button>
                    
                    {isOwner && (
                        <>
                            <button 
                                onClick={onEdit}
                                className="h-10 w-10 rounded-xl text-slate-300 hover:text-purple-400 hover:bg-purple-500/10 border border-white/5 hover:border-purple-500/20 transition-all flex items-center justify-center"
                                title="Edit Collection"
                            >
                                <Settings size={18} />
                            </button>
                            
                            <button 
                                onClick={onDelete}
                                className="h-10 w-10 rounded-xl text-slate-300 hover:text-red-400 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 transition-all flex items-center justify-center"
                                title="Delete Collection"
                            >
                                <Trash2 size={18} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};