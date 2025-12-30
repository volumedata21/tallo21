import React, { useState } from 'react';
import { X, Layers, Tag, MapPin, Copy, Search, Plus, Check, Trash2 } from 'lucide-react';
import { Collection, Board, LocationData } from '../types';
import { dataService } from '../services/dataService';

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
  onUpdate: () => void;
  collections: Collection[];
  boards: Board[];
  customDeleteHandler?: (ids: string[]) => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedIds, onClear, onUpdate, collections, boards, customDeleteHandler }) => {
  const [activeAction, setActiveAction] = useState<'board' | 'tag' | 'location' | null>(null);
  
  // Tag state
  const [tagInput, setTagInput] = useState('');
  
  // Location state
  const [locQuery, setLocQuery] = useState('');
  const [locResults, setLocResults] = useState<LocationData[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Group
  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    dataService.mergePins(selectedIds);
    onUpdate();
    onClear();
  };

  // Boards
  const handleBoardSelect = (boardId: string) => {
    dataService.bulkAddBoard(selectedIds, boardId);
    onUpdate();
    setActiveAction(null);
  };

  // Tags
  const handleAddTag = () => {
    if (!tagInput.trim()) return;
    const tags = tagInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    dataService.bulkAddTags(selectedIds, tags);
    setTagInput('');
    onUpdate();
    setActiveAction(null);
  };

  // Location
  const handleSearchLoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locQuery.trim()) return;
    setIsSearching(true);
    const results = await dataService.searchLocation(locQuery);
    setLocResults(results);
    setIsSearching(false);
  };

  const handleSelectLoc = (loc: LocationData) => {
    dataService.bulkSetLocation(selectedIds, loc);
    onUpdate();
    setActiveAction(null);
    setLocResults([]);
    setLocQuery('');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Removed confirm dialog to rely on Undo Toast
    if (customDeleteHandler) {
        customDeleteHandler(selectedIds);
    } else {
        dataService.bulkDeletePins(selectedIds);
        onUpdate();
    }
    onClear();
  };

  const canGroup = selectedIds.length >= 2;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 w-full max-w-lg px-4 pointer-events-none">
      
      {/* Popups */}
      <div className="pointer-events-auto">
        {activeAction === 'board' && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 w-64 max-h-60 overflow-y-auto mb-2 animate-in slide-in-from-bottom-2 fade-in">
             {collections.map(col => (
                 <div key={col.id}>
                     <div className="px-3 py-1 text-xs font-bold text-slate-500 uppercase">{col.title}</div>
                     {boards.filter(b => b.collectionId === col.id).map(b => (
                         <button 
                             key={b.id}
                             onClick={() => handleBoardSelect(b.id)}
                             className="w-full text-left px-3 py-2 text-sm rounded text-slate-300 hover:bg-slate-800 hover:text-white transition"
                         >
                             {b.title}
                         </button>
                     ))}
                 </div>
             ))}
             <div className="px-3 py-1 text-xs font-bold text-slate-500 uppercase mt-1">New Boards</div>
             {boards.filter(b => !b.collectionId).map(b => (
                 <button 
                     key={b.id}
                     onClick={() => handleBoardSelect(b.id)}
                     className="w-full text-left px-3 py-2 text-sm rounded text-slate-300 hover:bg-slate-800 hover:text-white transition"
                 >
                     {b.title}
                 </button>
             ))}
          </div>
        )}

        {activeAction === 'tag' && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 w-72 mb-2 animate-in slide-in-from-bottom-2 fade-in flex gap-2">
             <input 
               autoFocus
               value={tagInput}
               onChange={e => setTagInput(e.target.value)}
               placeholder="Add tags (comma separated)..."
               className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-teal-500 outline-none"
               onKeyDown={e => e.key === 'Enter' && handleAddTag()}
             />
             <button onClick={handleAddTag} className="bg-teal-600 text-white rounded px-3 py-1 text-xs font-bold">Add</button>
          </div>
        )}

        {activeAction === 'location' && (
           <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 w-80 mb-2 animate-in slide-in-from-bottom-2 fade-in">
              <form onSubmit={handleSearchLoc} className="flex gap-2 mb-2">
                  <input 
                    autoFocus
                    value={locQuery}
                    onChange={e => setLocQuery(e.target.value)}
                    placeholder="Search location..."
                    className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-teal-500 outline-none"
                  />
                  <button type="submit" className="bg-slate-700 text-white rounded px-3 py-1 text-xs font-bold">Find</button>
              </form>
              {locResults.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-1">
                      {locResults.map((loc, i) => (
                          <button key={i} onClick={() => handleSelectLoc(loc)} className="w-full text-left px-2 py-1.5 hover:bg-slate-800 rounded text-xs text-slate-300">
                              <div className="font-bold text-white">{loc.name}</div>
                              {loc.address && <div className="text-slate-500 truncate">{loc.address}</div>}
                          </button>
                      ))}
                  </div>
              )}
           </div>
        )}
      </div>

      {/* Main Bar */}
      <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/50 rounded-full px-4 py-3 shadow-2xl flex items-center gap-2 pointer-events-auto">
        <div className="px-3 text-sm font-bold text-white border-r border-slate-700 mr-1">
          {selectedIds.length} selected
        </div>

        <button 
           onClick={() => setActiveAction(activeAction === 'board' ? null : 'board')}
           className={`p-2 rounded-full transition ${activeAction === 'board' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
           title="Add to Board"
        >
           <Layers size={18} />
        </button>

        <button 
           onClick={() => setActiveAction(activeAction === 'tag' ? null : 'tag')}
           className={`p-2 rounded-full transition ${activeAction === 'tag' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
           title="Add Tags"
        >
           <Tag size={18} />
        </button>

        <button 
           onClick={() => setActiveAction(activeAction === 'location' ? null : 'location')}
           className={`p-2 rounded-full transition ${activeAction === 'location' ? 'bg-teal-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
           title="Set Location"
        >
           <MapPin size={18} />
        </button>

        <div className="w-px h-6 bg-slate-700 mx-1"></div>

        <button 
           onClick={handleGroup}
           disabled={!canGroup}
           className={`p-2 rounded-full transition flex items-center gap-2 ${canGroup ? 'text-slate-400 hover:bg-slate-800 hover:text-teal-400' : 'text-slate-600 opacity-50 cursor-not-allowed'}`}
           title="Group Together (Merge)"
        >
           <Copy size={18} />
        </button>

        <button 
          onClick={handleDelete}
          className="ml-2 p-2 bg-slate-800 hover:bg-red-500/20 hover:text-red-500 text-slate-400 rounded-full transition"
          title="Delete Items"
        >
          <Trash2 size={18} />
        </button>

        <button 
          onClick={onClear} 
          className="ml-2 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-full transition"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};