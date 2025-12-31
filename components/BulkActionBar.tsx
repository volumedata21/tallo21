import React, { useState } from 'react';
// Changed imports: Added 'Folder', removed 'Copy' (unless you want to keep it available)
import { X, Layers, Layers2, Tag, MapPin, Link as LinkIcon, Check, Trash2, Minus, Plus, Search, Folder, Copy } from 'lucide-react';
import { Collection, Board, LocationData, Pin } from '../types';
import { dataService } from '../services/dataService';

interface BulkActionBarProps {
  selectedIds: string[];
  pins: Pin[];
  onClear: () => void;
  onUpdate: () => void;
  collections: Collection[];
  boards: Board[];
  customDeleteHandler?: (ids: string[]) => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedIds, pins, onClear, onUpdate, collections, boards, customDeleteHandler }) => {
  const [activeAction, setActiveAction] = useState<'board' | 'tag' | 'location' | 'link' | null>(null);
  
  // States
  const [tagInput, setTagInput] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');

  // --- Handlers ---

  const handleGroup = async () => {
    if (selectedIds.length < 2) return;
    await dataService.mergePins(selectedIds);
    onUpdate();
    onClear();
  };

  // --- SMART BOARD LOGIC ---
  const getBoardState = (boardId: string): 'all' | 'some' | 'none' => {
      const selectedPins = pins.filter(p => selectedIds.includes(p.id));
      const inBoardCount = selectedPins.filter(p => p.boardIds && p.boardIds.includes(boardId)).length;
      
      if (inBoardCount === selectedPins.length) return 'all';
      if (inBoardCount > 0) return 'some';
      return 'none';
  };

  const toggleBoard = async (boardId: string) => {
      const state = getBoardState(boardId);
      
      if (state === 'all') {
          // If all are in, remove from all
          await dataService.bulkRemoveBoard(selectedIds, boardId);
      } else {
          // If none or some are in, add to all (fill the gaps)
          await dataService.bulkAddBoard(selectedIds, boardId);
      }
      onUpdate();
  };

  // --- Other Handlers (Tags, etc) ---
  const handleAddTag = async () => {
    if (!tagInput.trim()) return;
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    await dataService.bulkAddTags(selectedIds, tags);
    setTagInput('');
    onUpdate();
    setActiveAction(null);
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSearching(true);
      const res = await dataService.searchLocation(locQuery);
      setLocResults(res);
      setIsSearching(false);
  };

  const handleLocationSelect = async (loc: LocationData) => {
      await dataService.bulkSetLocation(selectedIds, loc);
      onUpdate();
      setActiveAction(null);
  };

  const handleDelete = () => {
      if (confirm(`Delete ${selectedIds.length} items?`)) {
          if (customDeleteHandler) customDeleteHandler(selectedIds);
      }
  };

  const canGroup = selectedIds.length > 1;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#0B1120] border border-slate-700 rounded-2xl shadow-2xl z-50 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-200">
        
        {/* Action Panel Content */}
        {activeAction && (
            <div className="w-full sm:w-[400px] border-b border-slate-700 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                
                {/* 1. BOARD SELECTOR */}
                {activeAction === 'board' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 sticky top-0 z-10">
                            <Search size={14} className="text-slate-500" />
                            <input 
                                value={boardSearch}
                                onChange={e => setBoardSearch(e.target.value)}
                                placeholder="Filter boards..." 
                                className="bg-transparent border-none text-sm text-white focus:ring-0 outline-none w-full placeholder-slate-600"
                                autoFocus
                            />
                        </div>
                        
                        <div className="space-y-4">
                            {collections.map(col => {
                                const colBoards = boards.filter(b => b.collectionId === col.id && b.title.toLowerCase().includes(boardSearch.toLowerCase()));
                                if (colBoards.length === 0) return null;
                                return (
                                    <div key={col.id}>
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">{col.title}</div>
                                        <div className="space-y-1">
                                            {colBoards.map(board => {
                                                const state = getBoardState(board.id);
                                                return (
                                                    <button 
                                                        key={board.id} 
                                                        onClick={() => toggleBoard(board.id)} 
                                                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between group transition-colors"
                                                    >
                                                        <span className={`text-sm font-medium ${state !== 'none' ? 'text-teal-400' : 'text-slate-300'}`}>{board.title}</span>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${state === 'all' ? 'bg-teal-500 border-teal-500' : state === 'some' ? 'bg-yellow-500/20 border-yellow-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                                            {state === 'all' && <Check size={12} className="text-black" strokeWidth={3} />}
                                                            {state === 'some' && <Minus size={12} className="text-yellow-500" strokeWidth={3} />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            
                            {/* Unorganized Boards */}
                            <div>
                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-1">Unorganized</div>
                                <div className="space-y-1">
                                    {boards.filter(b => !b.collectionId && b.title.toLowerCase().includes(boardSearch.toLowerCase())).map(board => {
                                        const state = getBoardState(board.id);
                                        return (
                                            <button 
                                                key={board.id} 
                                                onClick={() => toggleBoard(board.id)} 
                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between group transition-colors"
                                            >
                                                <span className={`text-sm font-medium ${state !== 'none' ? 'text-teal-400' : 'text-slate-300'}`}>{board.title}</span>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${state === 'all' ? 'bg-teal-500 border-teal-500' : state === 'some' ? 'bg-yellow-500/20 border-yellow-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                                    {state === 'all' && <Check size={12} className="text-black" strokeWidth={3} />}
                                                    {state === 'some' && <Minus size={12} className="text-yellow-500" strokeWidth={3} />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TAGS */}
                {activeAction === 'tag' && (
                    <div className="flex gap-2">
                        <input 
                           value={tagInput}
                           onChange={e => setTagInput(e.target.value)}
                           placeholder="Enter tags (comma separated)..."
                           className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                           autoFocus
                           onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                        />
                        <button onClick={handleAddTag} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-lg"><Check size={18} /></button>
                    </div>
                )}

                {/* 3. LOCATION */}
                {activeAction === 'location' && (
                    <div className="space-y-3">
                        <form onSubmit={handleLocationSearch} className="flex gap-2">
                             <input 
                                value={locQuery}
                                onChange={e => setLocQuery(e.target.value)}
                                placeholder="Search location..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-teal-500"
                                autoFocus
                             />
                             <button type="submit" disabled={isSearching} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-lg disabled:opacity-50"><Search size={18} /></button>
                        </form>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {locResults.map((loc, i) => (
                                <button key={i} onClick={() => handleLocationSelect(loc)} className="w-full text-left px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-300 hover:text-white truncate">
                                    {loc.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Main Bar */}
        <div className="flex items-center gap-1 p-2">
            <div className="px-3 text-xs font-bold text-teal-500 tabular-nums">
                {selectedIds.length} <span className="text-slate-500 font-normal hidden sm:inline">selected</span>
            </div>
            
            <div className="w-px h-8 bg-slate-800 mx-1"></div>

            <button 
               onClick={() => setActiveAction(activeAction === 'board' ? null : 'board')}
               className={`p-2.5 rounded-xl transition ${activeAction === 'board' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Organize into Boards"
            >
               {/* UPDATED ICON: Folder */}
               <Folder size={18} />
            </button>

            <button 
               onClick={() => setActiveAction(activeAction === 'tag' ? null : 'tag')}
               className={`p-2.5 rounded-xl transition ${activeAction === 'tag' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Add Tags"
            >
               <Tag size={18} />
            </button>

            <button 
               onClick={() => setActiveAction(activeAction === 'location' ? null : 'location')}
               className={`p-2.5 rounded-xl transition ${activeAction === 'location' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Set Location"
            >
               <MapPin size={18} />
            </button>

            <div className="w-px h-8 bg-slate-800 mx-1"></div>

            <button 
               onClick={handleGroup}
               disabled={!canGroup}
               className={`p-2.5 rounded-xl transition flex items-center gap-2 ${canGroup ? 'text-slate-400 hover:bg-slate-800 hover:text-teal-400' : 'text-slate-700 opacity-50 cursor-not-allowed'}`}
               title="Group Together (Merge)"
            >
               {/* UPDATED ICON: Layers */}
               <Layers2 size={18} />
            </button>

            <button 
              onClick={handleDelete}
              className="ml-1 p-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-slate-400 rounded-xl transition"
              title="Delete Selected"
            >
               <Trash2 size={18} />
            </button>

            <div className="w-px h-8 bg-slate-800 mx-1"></div>

            <button 
              onClick={onClear}
              className="p-2.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition"
            >
               <X size={18} />
            </button>
        </div>
    </div>
  );
};