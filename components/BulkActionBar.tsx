import React, { useState } from 'react';
import { X, Layers2, Tag, MapPin, Check, Trash2, Minus, Search, Folder, Loader2 } from 'lucide-react';
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
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [boardSearch, setBoardSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false); // <--- ADDED: Loading state

  // --- Handlers ---

  const handleGroup = async () => {
    if (selectedIds.length < 2) return;
    setIsProcessing(true);
    try {
        await dataService.mergePins(selectedIds);
        onUpdate();
        onClear();
    } catch (e) {
        console.error("Group failed", e);
    } finally {
        setIsProcessing(false);
    }
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
      setIsProcessing(true);
      const state = getBoardState(boardId);
      
      try {
        if (state === 'all') {
            // If all are in, remove from all
            await dataService.bulkRemoveBoard(selectedIds, boardId);
        } else {
            // If none or some are in, add to all (fill the gaps)
            await dataService.bulkAddBoard(selectedIds, boardId);
        }
        onUpdate();
      } catch (e) {
          console.error("Bulk board action failed", e);
      } finally {
          setIsProcessing(false);
      }
  };

  // --- Other Handlers (Tags, etc) ---
  const handleAddTag = async () => {
    if (!tagInput.trim()) return;
    setIsProcessing(true);
    try {
        const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
        await dataService.bulkAddTags(selectedIds, tags);
        setTagInput('');
        onUpdate();
        setActiveAction(null);
    } catch (e) {
        console.error("Add tag failed", e);
    } finally {
        setIsProcessing(false);
    }
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSearching(true);
      const res = await dataService.searchLocation(locQuery);
      setLocResults(res);
      setIsSearching(false);
  };

  const handleLocationSelect = async (loc: LocationData) => {
      setIsProcessing(true);
      try {
          await dataService.bulkSetLocation(selectedIds, loc);
          onUpdate();
          setActiveAction(null);
      } catch (e) {
          console.error("Set location failed", e);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleDelete = () => {
      if (confirm(`Delete ${selectedIds.length} items?`)) {
          if (customDeleteHandler) customDeleteHandler(selectedIds);
      }
  };

  const canGroup = selectedIds.length > 1;

  return (
    // FIX: Docked to bottom on mobile (bottom-0 w-full), Floating on desktop (sm:bottom-8 sm:w-auto)
    <div className="fixed bottom-0 left-0 right-0 sm:bottom-8 sm:left-1/2 sm:-translate-x-1/2 w-full sm:w-auto bg-[#0B1120] border-t sm:border border-slate-700 sm:rounded-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] z-50 flex flex-col items-center animate-in slide-in-from-bottom-4 duration-200 pb-safe sm:pb-0">
        
        {/* Action Panel Content */}
        {activeAction && (
            <div className="w-full sm:w-[400px] border-b border-slate-700 p-4 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto custom-scrollbar bg-[#0B1120]">
                
                {/* 1. BOARD SELECTOR */}
                {activeAction === 'board' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 sticky top-0 z-10">
                            <Search size={14} className="text-slate-500" />
                            <input 
                                value={boardSearch}
                                onChange={e => setBoardSearch(e.target.value)}
                                placeholder="Filter boards..." 
                                // FIX: text-base prevents iOS zoom
                                className="bg-transparent border-none text-base sm:text-sm text-white focus:ring-0 outline-none w-full placeholder-slate-600"
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
                                                        disabled={isProcessing}
                                                        className="w-full text-left px-3 py-3 sm:py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between group transition-colors disabled:opacity-50"
                                                    >
                                                        <span className={`text-sm font-medium ${state !== 'none' ? 'text-teal-400' : 'text-slate-300'}`}>{board.title}</span>
                                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${state === 'all' ? 'bg-teal-500 border-teal-500' : state === 'some' ? 'bg-yellow-500/20 border-yellow-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                                            {isProcessing ? <Loader2 size={12} className="animate-spin text-slate-400"/> : (
                                                                <>
                                                                    {state === 'all' && <Check size={12} className="text-black" strokeWidth={3} />}
                                                                    {state === 'some' && <Minus size={12} className="text-yellow-500" strokeWidth={3} />}
                                                                </>
                                                            )}
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
                                                disabled={isProcessing}
                                                className="w-full text-left px-3 py-3 sm:py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between group transition-colors disabled:opacity-50"
                                            >
                                                <span className={`text-sm font-medium ${state !== 'none' ? 'text-teal-400' : 'text-slate-300'}`}>{board.title}</span>
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${state === 'all' ? 'bg-teal-500 border-teal-500' : state === 'some' ? 'bg-yellow-500/20 border-yellow-500' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                                    {isProcessing ? <Loader2 size={12} className="animate-spin text-slate-400"/> : (
                                                        <>
                                                            {state === 'all' && <Check size={12} className="text-black" strokeWidth={3} />}
                                                            {state === 'some' && <Minus size={12} className="text-yellow-500" strokeWidth={3} />}
                                                        </>
                                                    )}
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
                           className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-white outline-none focus:border-teal-500"
                           autoFocus
                           onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                        />
                        <button onClick={handleAddTag} disabled={isProcessing} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-lg disabled:opacity-50">
                            {isProcessing ? <Loader2 size={18} className="animate-spin"/> : <Check size={18} />}
                        </button>
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
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-base sm:text-sm text-white outline-none focus:border-teal-500"
                                autoFocus
                             />
                             <button type="submit" disabled={isSearching} className="bg-teal-600 hover:bg-teal-500 text-white p-2 rounded-lg disabled:opacity-50">
                                 {isSearching ? <Loader2 size={18} className="animate-spin"/> : <Search size={18} />}
                             </button>
                        </form>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                            {locResults.map((loc, i) => (
                                <button key={i} onClick={() => handleLocationSelect(loc)} disabled={isProcessing} className="w-full text-left px-3 py-3 sm:py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-300 hover:text-white truncate disabled:opacity-50">
                                    {loc.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Main Bar */}
        {/* FIX: justify-between on mobile to spread icons, overflow-x-auto for safety on tiny screens */}
        <div className="flex items-center gap-1 p-2 md:p-2 w-full sm:w-auto justify-between sm:justify-start overflow-x-auto no-scrollbar">
            <div className="px-3 text-xs font-bold text-teal-500 tabular-nums shrink-0">
                {selectedIds.length} <span className="text-slate-500 font-normal hidden sm:inline">selected</span>
            </div>
            
            <div className="w-px h-8 bg-slate-800 mx-1 hidden sm:block"></div>

            <button 
               onClick={() => setActiveAction(activeAction === 'board' ? null : 'board')}
               className={`p-3 sm:p-2.5 rounded-xl transition shrink-0 ${activeAction === 'board' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Organize into Boards"
            >
               <Folder size={20} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <button 
               onClick={() => setActiveAction(activeAction === 'tag' ? null : 'tag')}
               className={`p-3 sm:p-2.5 rounded-xl transition shrink-0 ${activeAction === 'tag' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Add Tags"
            >
               <Tag size={20} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <button 
               onClick={() => setActiveAction(activeAction === 'location' ? null : 'location')}
               className={`p-3 sm:p-2.5 rounded-xl transition shrink-0 ${activeAction === 'location' ? 'bg-teal-500 text-white shadow-lg shadow-teal-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
               title="Set Location"
            >
               <MapPin size={20} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <div className="w-px h-8 bg-slate-800 mx-1 hidden sm:block"></div>

            <button 
               onClick={handleGroup}
               disabled={!canGroup || isProcessing}
               className={`p-3 sm:p-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${canGroup && !isProcessing ? 'text-slate-400 hover:bg-slate-800 hover:text-teal-400' : 'text-slate-700 opacity-50 cursor-not-allowed'}`}
               title="Group Together (Merge)"
            >
               {isProcessing && activeAction === null ? <Loader2 size={20} className="animate-spin sm:w-[18px] sm:h-[18px]"/> : <Layers2 size={20} className="sm:w-[18px] sm:h-[18px]" />}
            </button>

            <button 
              onClick={handleDelete}
              className="ml-1 p-3 sm:p-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-slate-400 rounded-xl transition shrink-0"
              title="Delete Selected"
            >
               <Trash2 size={20} className="sm:w-[18px] sm:h-[18px]" />
            </button>

            <div className="w-px h-8 bg-slate-800 mx-1 hidden sm:block"></div>

            <button 
              onClick={onClear}
              className="p-3 sm:p-2.5 hover:bg-slate-800 text-slate-500 hover:text-white rounded-xl transition shrink-0"
            >
               <X size={20} className="sm:w-[18px] sm:h-[18px]" />
            </button>
        </div>
    </div>
  );
};