// components/EditCollectionModal.tsx
import React, { useState } from 'react';
import { Collection } from '../types';
import { dataService } from '../services/dataService';
import { X } from 'lucide-react';

interface EditCollectionModalProps {
    collection: Collection;
    onClose: () => void;
    onUpdate: () => void;
}

export const EditCollectionModal: React.FC<EditCollectionModalProps> = ({ collection, onClose, onUpdate }) => {
    // We moved this state FROM App.tsx TO here. 
    // Now App.tsx doesn't need to care about the text inside the input!
    const [title, setTitle] = useState(collection.title);

    const handleSave = async () => {
        if (!title.trim()) return;
        try {
            await dataService.updateCollection(collection.id, { title });
            onUpdate(); // Tell App.tsx to refresh data
            onClose();
        } catch (e: any) {
            alert(e.message || "Update failed");
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-[#0B1120] border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-[#020617]">
                    <h3 className="font-bold text-white text-sm">Edit Collection</h3>
                    <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-white" /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 block">Collection Title</label>
                        <input 
                            autoFocus 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 outline-none" 
                        />
                    </div>
                </div>
                <div className="p-4 bg-[#020617] border-t border-slate-800 flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-white">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold">Save Changes</button>
                </div>
            </div>
        </div>
    );
};