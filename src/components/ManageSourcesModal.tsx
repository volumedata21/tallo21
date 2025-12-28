
import React, { useState } from 'react';
import { X, Plus, Trash2, Rss, Loader2 } from 'lucide-react';
import { DiscoverySource } from '../types';

interface ManageSourcesModalProps {
  sources: DiscoverySource[];
  onAdd: (url: string, name: string) => Promise<void>;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const ManageSourcesModal: React.FC<ManageSourcesModalProps> = ({ sources, onAdd, onRemove, onClose }) => {
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl || !newName) return;

    setIsAdding(true);
    try {
      await onAdd(newUrl, newName);
      setNewUrl('');
      setNewName('');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Rss className="w-5 h-5 text-rose-500" />
            Manage Discovery Sources
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Add New Form */}
          <form onSubmit={handleAdd} className="space-y-3 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Add New Feed</h3>
            <input 
              type="text" 
              placeholder="Source Name (e.g. Design Milk)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm"
            />
            <div className="flex gap-2">
              <input 
                type="url" 
                placeholder="RSS Feed URL"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:border-rose-500 outline-none text-sm"
              />
              <button 
                type="submit"
                disabled={isAdding || !newUrl || !newName}
                className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center min-w-[3rem]"
              >
                {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </form>

          {/* List */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Active Sources</h3>
            {sources.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-2">No sources added yet.</p>
            ) : (
              <div className="space-y-2">
                {sources.map(source => (
                  <div key={source.id} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-800">
                    <div className="min-w-0 flex-1 mr-4">
                      <div className="font-medium text-slate-200 truncate">{source.name}</div>
                      <div className="text-xs text-slate-500 truncate">{source.feedUrl}</div>
                    </div>
                    <button 
                      onClick={() => onRemove(source.id)}
                      className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-950/30 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManageSourcesModal;
