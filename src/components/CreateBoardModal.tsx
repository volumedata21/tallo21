
import React, { useState } from 'react';
import { X, FolderPlus, Globe, Lock, Link as LinkIcon } from 'lucide-react';
import { Visibility } from '../../shared/types';

interface CreateBoardModalProps {
  onClose: () => void;
  onCreate: (name: string, description: string, visibility: Visibility) => void;
}

const CreateBoardModal: React.FC<CreateBoardModalProps> = ({ onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('private');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), description.trim(), visibility);
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FolderPlus className="w-5 h-5 text-rose-500" />
            Create Board
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Board Name</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-700"
              placeholder="e.g., Living Room Ideas"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Visibility</label>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
              {(['private', 'public', 'unlisted'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                    visibility === v 
                      ? 'bg-slate-800 text-rose-500 shadow-sm ring-1 ring-slate-700' 
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {v === 'private' && <Lock className="w-3 h-3" />}
                  {v === 'public' && <Globe className="w-3 h-3" />}
                  {v === 'unlisted' && <LinkIcon className="w-3 h-3" />}
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500 mt-2">
              {visibility === 'private' && "Only you can see this board."}
              {visibility === 'public' && "Anyone using this app on this device can see this board."}
              {visibility === 'unlisted' && "Visible to others only if they have the direct link."}
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description (Optional)</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-all placeholder-slate-700 resize-none h-24"
              placeholder="What's this board about?"
            />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-rose-900/20"
            >
              Create Board
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateBoardModal;
