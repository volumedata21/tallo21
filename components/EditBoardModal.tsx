import React, { useState } from 'react';
import { Board, Collection } from '../types';
import { dataService } from '../services/dataService';
import { X, ChevronDown, Lock, EyeOff, Globe, Check } from 'lucide-react';

interface EditBoardModalProps {
    board: Board;
    collections: Collection[];
    onClose: () => void;
    onUpdate: () => void;
}

export const EditBoardModal: React.FC<EditBoardModalProps> = ({ board, collections, onClose, onUpdate }) => {
    // These are the state variables we moved out of App.tsx
    const [title, setTitle] = useState(board.title);
    const [visibility, setVisibility] = useState<'private' | 'public' | 'unlisted'>(board.visibility || 'private');
    const [collectionId, setCollectionId] = useState<string>(board.collectionId || '');

    const handleSave = async () => {
        if (!title.trim()) return;
        try {
            await dataService.updateBoard(board.id, {
                title,
                visibility,
                collectionId: collectionId || null
            });
            onUpdate();
            onClose();
        } catch (e: any) {
            alert(e.message || "Update failed");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                    <h3 className="font-bold text-white text-sm">Edit Board</h3>
                    <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-white" /></button>
                </div>

                {/* Form Inputs */}
                <div className="p-6 space-y-4">
                    {/* Title Input */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Board Title</label>
                        <input 
                            autoFocus 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none" 
                        />
                    </div>

                    {/* Collection Select */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Collection</label>
                        <div className="relative">
                            <select
                                value={collectionId}
                                onChange={e => setCollectionId(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-teal-500 outline-none appearance-none cursor-pointer"
                            >
                                <option value="">No Collection (Unorganized)</option>
                                {collections.map(col => (
                                    <option key={col.id} value={col.id}>{col.title}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14} />
                        </div>
                    </div>

                    {/* Visibility Options */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Visibility</label>
                        <div className="grid grid-cols-1 gap-2">
                            {[
                                { id: 'private', label: 'Private', icon: Lock, desc: 'Only you can see this board' },
                                { id: 'unlisted', label: 'Unlisted', icon: EyeOff, desc: 'Anyone with the link can view' },
                                { id: 'public', label: 'Public', icon: Globe, desc: 'Visible on your profile' }
                            ].map((opt) => (
                                <button 
                                    key={opt.id} 
                                    onClick={() => setVisibility(opt.id as any)} 
                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${visibility === opt.id ? 'bg-teal-500/10 border-teal-500/50' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}
                                >
                                    <div className={`p-2 rounded-full ${visibility === opt.id ? 'bg-teal-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                        <opt.icon size={16} />
                                    </div>
                                    <div>
                                        <div className={`text-sm font-medium ${visibility === opt.id ? 'text-white' : 'text-slate-300'}`}>{opt.label}</div>
                                        <div className="text-[10px] text-slate-500">{opt.desc}</div>
                                    </div>
                                    {visibility === opt.id && <Check size={16} className="ml-auto text-teal-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="p-4 bg-[#020617] border-t border-slate-800 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold">Save Changes</button>
                </div>
            </div>
        </div>
    );
};