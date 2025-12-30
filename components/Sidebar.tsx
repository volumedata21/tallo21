import React, { useState } from 'react';
import { Layout, Plus, Layers, Folder, Tag, Trash2, Heart, Link as LinkIcon, Settings, Shield, ArrowDownAZ, ArrowUpNarrowWide, Github } from 'lucide-react';
import { Collection, Board, User } from '../types';
import { dataService } from '../services/dataService';

interface SidebarProps {
  isOpen: boolean;
  activeFilter: { type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string };
  onFilterChange: (filter: { type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string }) => void;
  collections: Collection[];
  boards: Board[];
  allTags: string[];
  currentUser: User;
  onUpdate: () => void;
  onCloseMobile: () => void;
  onOpenSettings: () => void;
  onOpenAdmin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  activeFilter,
  onFilterChange,
  collections,
  boards,
  currentUser,
  onUpdate,
  onCloseMobile,
  onOpenSettings,
  onOpenAdmin
}) => {
  const [creationMode, setCreationMode] = useState<'collection' | 'board' | null>(null);
  const [creationName, setCreationName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  // Local Sort State for lists
  const [sortList, setSortList] = useState<'az' | 'newest'>('az');

  const sortedCollections = [...collections].sort((a, b) => {
      if (sortList === 'az') return a.title.localeCompare(b.title);
      return b.id.localeCompare(a.id);
  });

  const sortedBoards = (list: Board[]) => {
      return [...list].sort((a, b) => {
        if (sortList === 'az') return a.title.localeCompare(b.title);
        return b.id.localeCompare(a.id);
      });
  };

  const handleCreateItem = () => {
    if (!creationName.trim()) {
        setCreationMode(null);
        return;
    }
    
    if (creationMode === 'collection') {
        dataService.createCollection(creationName, currentUser.id);
    } else if (creationMode === 'board') {
        dataService.createBoard(creationName, undefined, currentUser.id);
    }
    
    setCreationName('');
    setCreationMode(null);
    onUpdate();
  };

  const handlePinDropOnBoard = (pinId: string, boardId: string) => {
    // Add pin to board instead of moving it
    dataService.addPinToBoard(pinId, boardId);
    onUpdate();
    setDragOverId(null);
  };

  const handleBoardDropOnCollection = (boardId: string, collectionId: string) => {
    dataService.updateBoard(boardId, { collectionId });
    onUpdate();
    setDragOverId(null);
  };

  const handleDragEnter = (id: string) => {
      setDragOverId(id);
  };

  const handleDragLeave = (id: string) => {
      if (dragOverId === id) setDragOverId(null);
  };

  const handleDeleteBoard = (e: React.MouseEvent, boardId: string) => {
    e.stopPropagation();
    if (confirm('Delete this board? Pins will remain but will be uncategorized.')) {
        dataService.deleteBoard(boardId);
        onUpdate();
    }
  };

  const handleFilterClick = (type: 'all' | 'collection' | 'board' | 'tag' | 'favorites', id: string) => {
    onFilterChange({ type, id });
    if (window.innerWidth < 768) onCloseMobile();
  };

  const handleShare = (e: React.MouseEvent, type: string, id: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}?${type}=${id}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard');
  };

  return (
    <aside 
      className={`
        flex flex-col border-r border-slate-800 bg-slate-950 overflow-y-auto custom-scrollbar shrink-0 transition-all duration-300 ease-in-out
        fixed md:relative z-50 top-16 bottom-0 md:top-auto md:bottom-auto md:h-full
        ${isOpen 
            ? 'w-64 translate-x-0' 
            : 'w-64 -translate-x-full md:w-0 md:opacity-0 md:overflow-hidden md:translate-x-0'
        }
      `}
    >
      <div className="p-6 min-w-[16rem] flex flex-col h-full">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Library</h3>
        <ul className="space-y-1 mb-6">
           <li>
              <button 
                onClick={() => handleFilterClick('all', '')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'all' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <Layout size={18} strokeWidth={1.5} />
                <span className="font-medium">Tallos</span>
              </button>
           </li>
           <li>
              <button 
                onClick={() => handleFilterClick('favorites', '')}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'favorites' ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
              >
                <Heart size={18} strokeWidth={1.5} />
                <span className="font-medium">Favorites</span>
              </button>
           </li>
        </ul>

        {/* Collections */}
        <div>
          <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                 <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Collections</h3>
                 <button onClick={() => setSortList(prev => prev === 'az' ? 'newest' : 'az')} title="Sort" className="text-slate-600 hover:text-teal-500">
                    {sortList === 'az' ? <ArrowDownAZ size={14} /> : <ArrowUpNarrowWide size={14} />}
                 </button>
              </div>
              <button 
                onClick={() => { setCreationMode('collection'); setCreationName(''); }}
                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
              >
                  <Plus size={16} />
              </button>
          </div>
          
          {creationMode === 'collection' && (
              <div className="mb-2 px-1">
                  <input
                      autoFocus
                      value={creationName}
                      onChange={e => setCreationName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateItem()}
                      onBlur={handleCreateItem}
                      placeholder="Name..."
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none placeholder-slate-600"
                  />
              </div>
          )}

          <ul className="space-y-1">
            {sortedCollections.map(col => (
              <li 
                key={col.id}
                onDragOver={(e) => { e.preventDefault(); handleDragEnter(col.id); }}
                onDragLeave={() => handleDragLeave(col.id)}
                onDrop={(e) => {
                    const boardId = e.dataTransfer.getData('boardId');
                    if (boardId) handleBoardDropOnCollection(boardId, col.id);
                    setDragOverId(null);
                }}
                className="group relative"
              >
                <button 
                   onClick={() => handleFilterClick('collection', col.id)}
                   className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'collection' && activeFilter.id === col.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${dragOverId === col.id ? 'bg-slate-800 ring-1 ring-teal-500' : ''}`}
                >
                  <Layers size={18} strokeWidth={1.5} />
                  <span className="font-medium truncate pr-6">{col.title}</span>
                </button>
                <button
                    onClick={(e) => handleShare(e, 'collection', col.id)}
                    className="absolute right-2 top-2 p-1 text-slate-600 hover:text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Copy Link"
                >
                    <LinkIcon size={12} />
                </button>

                {/* Nested Boards */}
                {(activeFilter.id === col.id || activeFilter.type === 'board') && (
                   <ul className="ml-6 mt-1 space-y-1 border-l border-slate-800 pl-2">
                      {sortedBoards(boards.filter(b => b.collectionId === col.id)).map(board => (
                         <li 
                           key={board.id}
                           draggable
                           onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)}
                           onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragEnter(board.id); }}
                           onDragLeave={(e) => { e.stopPropagation(); handleDragLeave(board.id); }}
                           onDrop={(e) => {
                             e.stopPropagation(); // Prevent bubbling to collection
                             const pinId = e.dataTransfer.getData('pinId');
                             if (pinId) handlePinDropOnBoard(pinId, board.id);
                             setDragOverId(null);
                           }}
                           className="group/board relative"
                         >
                            <button 
                              onClick={() => handleFilterClick('board', board.id)}
                              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'} ${dragOverId === board.id ? 'bg-slate-800 text-teal-400' : ''}`}
                            >
                               <Folder size={14} strokeWidth={1.5} />
                               <span className="truncate pr-10">{board.title}</span>
                            </button>
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover/board:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => handleShare(e, 'board', board.id)}
                                    className="p-1 text-slate-600 hover:text-teal-400"
                                    title="Copy Link"
                                >
                                    <LinkIcon size={10} />
                                </button>
                                <button
                                    onClick={(e) => handleDeleteBoard(e, board.id)}
                                    className="p-1 text-slate-600 hover:text-red-500"
                                    title="Delete Board"
                                >
                                    <Trash2 size={10} />
                                </button>
                            </div>
                         </li>
                      ))}
                   </ul>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* New Boards */}
         <div className="mt-8 mb-auto">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">New Boards</h3>
              <button 
                onClick={() => { setCreationMode('board'); setCreationName(''); }}
                className="text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
              >
                  <Plus size={16} />
              </button>
          </div>

          {creationMode === 'board' && (
              <div className="mb-2 px-1">
                  <input
                      autoFocus
                      value={creationName}
                      onChange={e => setCreationName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateItem()}
                      onBlur={handleCreateItem}
                      placeholder="Name..."
                      className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-teal-500 outline-none placeholder-slate-600"
                  />
              </div>
          )}

          <ul className="space-y-1">
              {sortedBoards(boards.filter(b => !b.collectionId)).map(board => (
                 <li 
                    key={board.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('boardId', board.id)}
                    onDragOver={(e) => { e.preventDefault(); handleDragEnter(board.id); }}
                    onDragLeave={() => handleDragLeave(board.id)}
                    onDrop={(e) => {
                        const pinId = e.dataTransfer.getData('pinId');
                        if (pinId) handlePinDropOnBoard(pinId, board.id);
                        setDragOverId(null);
                    }}
                    className="group relative"
                 >
                    <button 
                        onClick={() => handleFilterClick('board', board.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${activeFilter.type === 'board' && activeFilter.id === board.id ? 'bg-teal-500/10 text-teal-500' : 'text-slate-400 hover:text-white hover:bg-slate-900'} ${dragOverId === board.id ? 'bg-slate-800 ring-1 ring-teal-500' : ''}`}
                    >
                        <Folder size={18} strokeWidth={1.5} />
                        <span className="font-medium truncate pr-10">{board.title}</span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => handleShare(e, 'board', board.id)}
                            className="p-1 text-slate-600 hover:text-teal-400"
                            title="Copy Link"
                        >
                            <LinkIcon size={12} />
                        </button>
                        <button
                            onClick={(e) => handleDeleteBoard(e, board.id)}
                            className="p-1 text-slate-600 hover:text-red-500"
                            title="Delete Board"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                 </li>
              ))}
          </ul>
         </div>

         {/* Sidebar Footer Controls */}
         <div className="mt-6 pt-6 border-t border-slate-800 space-y-2">
             <button onClick={onOpenSettings} className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors">
                 <Settings size={18} strokeWidth={1.5} />
                 <span className="font-medium text-sm">Settings</span>
             </button>
             
             {currentUser.role === 'admin' && (
                <button onClick={onOpenAdmin} className="w-full flex items-center gap-3 px-3 py-2 text-teal-500 hover:bg-teal-500/10 rounded-lg transition-colors">
                    <Shield size={18} strokeWidth={1.5} />
                    <span className="font-medium text-sm">Admin Panel</span>
                </button>
             )}

             <div className="pt-4 flex items-center gap-4 text-xs text-slate-600 px-3">
                 <a href="https://github.com/volumedata21/tallo21/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-slate-400 transition-colors">
                     <Github size={12} />
                     GitHub
                 </a>
                 <span>v1.0</span>
             </div>
         </div>
      </div>
    </aside>
  );
};