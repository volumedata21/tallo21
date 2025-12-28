import React, { useState } from 'react';
import { Board, Collection, Visibility } from '../../shared/types';
import { X, Lock, Globe, Link, Check } from 'lucide-react';

interface EditBoardModalProps {
  board: Board;
  collections: Collection[];
  onClose: () => void;
  onUpdate: (updates: Partial<Board>) => void;
}

const EditBoardModal: React.FC<EditBoardModalProps> = ({ board, collections, onClose, onUpdate }) => {
  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description);
  const [visibility, setVisibility] = useState<Visibility>(board.visibility);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<string>>(new Set(board.collectionIds));

  const toggleCollection = (id: string) => {
    const newSet = new Set(selectedCollectionIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCollectionIds(newSet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdate({
      name,
      description,
      visibility,
      collectionIds: Array.from(selectedCollectionIds)
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-slate-100">Edit Board</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name</label>
            <input 
              type="text" 
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 outline-none focus:border-rose-500 h-24 resize-none"
            />
          </div>

          <div>
             <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Visibility</label>
             <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['private', 'public', 'unlisted'] as const).map((v) => (
                <button
                    key={v}
                    type="button"
                    onClick={() => setVisibility(v)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-all ${
                    visibility === v 
                        ? 'bg-slate-800 text-rose-500 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    {v === 'private' && <Lock className="w-3 h-3" />}
                    {v === 'public' && <Globe className="w-3 h-3" />}
                    {v === 'unlisted' && <Link className="w-3 h-3" />}
                    <span className="capitalize">{v}</span>
                </button>
                ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Collections</label>
            <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto custom-scrollbar">
               {collections.map(col => {
                 const isSelected = selectedCollectionIds.has(col.id);
                 return (
                   <button
                     key={col.id}
                     type="button"
                     onClick={() => toggleCollection(col.id)}
                     className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                        isSelected 
                        ? 'bg-rose-950/20 border-rose-900/50 text-rose-500' 
                        : 'bg-slate-950 border-slate-900 text-slate-500 hover:border-slate-700'
                     }`}
                   >
                     <span className="truncate">{col.name}</span>
                     {isSelected && <Check className="w-3 h-3" />}
                   </button>
                 );
               })}
               {collections.length === 0 && <span className="text-xs text-slate-600 col-span-2">No collections available.</span>}
            </div>
          </div>

          <div className="pt-4">
            <button 
              type="submit"
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-xl transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditBoardModal;