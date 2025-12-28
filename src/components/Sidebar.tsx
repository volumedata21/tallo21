
import React, { useState, useMemo } from 'react';
import { ViewType, Board, Collection, ItemSortOption } from '../types';
import { LayoutGrid, FolderHeart, Heart, ChevronsUp, Plus, Folder, Settings, ChevronDown, ChevronRight, Layers, Users, X, Github, ArrowUpDown, Sparkles, GripVertical } from 'lucide-react';

interface SidebarProps {
  activeView: ViewType;
  setActiveView: (view: ViewType) => void;
  boards: Board[];
  collections: Collection[];
  selectedBoardId: string | null;
  selectedCollectionId: string | null;
  setSelectedBoardId: (id: string | null) => void;
  setSelectedCollectionId: (id: string | null) => void;
  onOpenCreateBoard: () => void;
  onOpenCreateCollection: () => void;
  onDropImageToBoard: (imageId: string, boardId: string) => void;
  onMoveBoardToCollection: (boardId: string, collectionId: string) => void;
  onOpenSettings: () => void;
  onClearSearch: () => void;
  onLogout?: () => void;
  onLogin?: () => void;
  isReadOnly: boolean;
  selectedImageIds: Set<string>;
  onBulkPinToBoard: (boardId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  boardLastUpdated: Record<string, number>;
  collectionLastUpdated: Record<string, number>;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeView, 
  setActiveView, 
  boards,
  collections,
  selectedBoardId,
  selectedCollectionId,
  setSelectedBoardId,
  setSelectedCollectionId,
  onOpenCreateBoard,
  onOpenCreateCollection,
  onDropImageToBoard,
  onMoveBoardToCollection,
  onOpenSettings,
  onClearSearch,
  isReadOnly,
  selectedImageIds,
  onBulkPinToBoard,
  isOpen,
  onClose,
  boardLastUpdated,
  collectionLastUpdated
}) => {
  const [dragOverBoardId, setDragOverBoardId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(true);
  const [isBoardsOpen, setIsBoardsOpen] = useState(true);
  
  // Sort States
  const [collectionSort, setCollectionSort] = useState<ItemSortOption>('alpha');
  const [boardSort, setBoardSort] = useState<ItemSortOption>('alpha');

  const navItems = [
    { id: 'all', label: 'My Tallos', icon: LayoutGrid },
    { id: 'discovery', label: 'Discovery', icon: Sparkles },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'boards', label: 'My Boards', icon: FolderHeart },
    ...(isReadOnly ? [] : [{ id: 'favorites', label: 'Favorites', icon: Heart }]),
  ];

  // Helper to sort items
  const sortItems = <T extends Board | Collection>(items: T[], sortOption: ItemSortOption, lastUpdatedMap: Record<string, number>) => {
    return [...items].sort((a, b) => {
      switch (sortOption) {
        case 'alpha': return a.name.localeCompare(b.name);
        case 'newest-created': return b.createdAt - a.createdAt;
        case 'oldest-created': return a.createdAt - b.createdAt;
        case 'newest-updated': return (lastUpdatedMap[b.id] || 0) - (lastUpdatedMap[a.id] || 0);
        case 'oldest-updated': return (lastUpdatedMap[a.id] || 0) - (lastUpdatedMap[b.id] || 0);
        default: return 0;
      }
    });
  };

  const sortedCollections = useMemo(() => 
    sortItems(collections, collectionSort, collectionLastUpdated), 
  [collections, collectionSort, collectionLastUpdated]);

  const sortedBoards = useMemo(() => 
    sortItems(boards, boardSort, boardLastUpdated), 
  [boards, boardSort, boardLastUpdated]);

  // --- Board Drop Handlers (for images) ---
  const handleBoardDragOver = (e: React.DragEvent, boardId: string) => {
    e.preventDefault();
    if (isReadOnly) return;
    setDragOverBoardId(boardId);
  };

  const handleBoardDragLeave = () => {
    setDragOverBoardId(null);
  };

  const handleBoardDrop = (e: React.DragEvent, boardId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setDragOverBoardId(null);
    
    const imageId = e.dataTransfer.getData('imageId');
    
    if (imageId) {
      if (selectedImageIds.has(imageId)) {
        onBulkPinToBoard(boardId);
      } else {
        onDropImageToBoard(imageId, boardId);
      }
    }
  };

  // --- Collection Drop Handlers (for boards) ---
  const handleCollectionDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    if (isReadOnly) return;
    setDragOverCollectionId(collectionId);
  };

  const handleCollectionDragLeave = () => {
    setDragOverCollectionId(null);
  };

  const handleCollectionDrop = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (isReadOnly) return;
    setDragOverCollectionId(null);

    const boardId = e.dataTransfer.getData('boardId');
    if (boardId) {
      onMoveBoardToCollection(boardId, collectionId);
    }
  };

  // --- Board Drag Start (to move into collection) ---
  const handleBoardDragStart = (e: React.DragEvent, boardId: string) => {
    if (isReadOnly) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('boardId', boardId);
    e.dataTransfer.effectAllowed = 'copy'; 
  };

  const sortOptionsDef: { value: ItemSortOption; label: string }[] = [
    { value: 'alpha', label: 'A-Z' },
    { value: 'newest-created', label: 'Newest Created' },
    { value: 'oldest-created', label: 'Oldest Created' },
    { value: 'newest-updated', label: 'Recently Updated' },
    { value: 'oldest-updated', label: 'Oldest Updated' },
  ];

  const SortToggle = ({ value, onChange }: { value: ItemSortOption, onChange: (v: ItemSortOption) => void }) => {
    const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation();
      const idx = sortOptionsDef.findIndex(o => o.value === value);
      const nextIdx = (idx + 1) % sortOptionsDef.length;
      onChange(sortOptionsDef[nextIdx].value);
    };

    const currentLabel = sortOptionsDef.find(o => o.value === value)?.label || 'Sort';

    return (
      <button 
        onClick={handleToggle}
        className={`p-1.5 rounded-md transition-colors ${
          value !== 'alpha' ? 'text-rose-500 bg-rose-500/10' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
        }`} 
        title={`Current Sort: ${currentLabel} (Click to cycle)`}
      >
        <ArrowUpDown className="w-3 h-3" />
      </button>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        ></div>
      )}

      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 border-r border-slate-900 flex flex-col transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:w-64 md:h-full ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Fixed Header */}
        <div className="p-6 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => {
                setActiveView('all');
                setSelectedBoardId(null);
                setSelectedCollectionId(null);
                onClearSearch();
                onClose();
              }}
              className="flex items-center gap-2 text-rose-500 font-bold text-xl hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-rose-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-rose-900/40">
                <ChevronsUp className="w-5 h-5" />
              </div>
              <span>Tallo</span>
            </button>
            <button onClick={onClose} className="md:hidden text-slate-500 hover:text-white">
              <X className="w-6 h-6" />
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id as ViewType);
                  setSelectedBoardId(null);
                  setSelectedCollectionId(null);
                  onClearSearch();
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                  activeView === item.id && !item.id.includes('board-detail')
                    ? 'bg-slate-900 text-rose-500 shadow-sm ring-1 ring-slate-800' 
                    : 'text-slate-400 hover:bg-slate-900/50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 space-y-6 pb-4">
            {/* Collections Section */}
            <div>
              <div className="flex items-center justify-between mb-2 px-2 group sticky top-0 bg-slate-950 z-10 py-1">
                <button 
                  onClick={() => setIsCollectionsOpen(!isCollectionsOpen)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 uppercase tracking-wider hover:text-slate-400 flex-1 text-left"
                >
                  {isCollectionsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Collections
                </button>
                <div className="flex items-center gap-1">
                    <SortToggle value={collectionSort} onChange={setCollectionSort} />
                    {!isReadOnly && (
                    <button 
                        onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreateCollection();
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors rounded-md hover:bg-slate-900"
                        title="Create Collection"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                    )}
                </div>
              </div>
              
              {isCollectionsOpen && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {sortedCollections.length === 0 && (
                    <div className="px-4 py-2 text-xs text-slate-700 italic">No collections yet.</div>
                  )}
                  {sortedCollections.map(col => (
                    <div key={col.id}>
                      <button
                        onClick={() => {
                          setSelectedCollectionId(col.id);
                          setSelectedBoardId(null);
                          setActiveView('collection-detail');
                          onClose();
                        }}
                        onDragOver={(e) => handleCollectionDragOver(e, col.id)}
                        onDragLeave={handleCollectionDragLeave}
                        onDrop={(e) => handleCollectionDrop(e, col.id)}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all ${
                          activeView === 'collection-detail' && selectedCollectionId === col.id 
                            ? 'text-slate-100 bg-slate-900/30 font-medium' 
                            : 'text-slate-400 hover:bg-slate-900/50'
                        } ${
                          dragOverCollectionId === col.id ? 'bg-rose-900/20 border border-rose-900/50 text-rose-400' : ''
                        }`}
                      >
                        <Layers className="w-4 h-4 text-rose-500/70" />
                        <span className="truncate">{col.name}</span>
                      </button>
                      
                      {/* Render Boards inside Collection */}
                      {((activeView === 'collection-detail' && selectedCollectionId === col.id) || dragOverCollectionId === col.id) && (
                          <div className="ml-4 pl-2 border-l border-slate-800 my-1 space-y-0.5">
                             {sortItems(boards.filter(b => b.collectionIds && b.collectionIds.includes(col.id)), boardSort, boardLastUpdated).map(board => (
                                <div
                                  key={board.id}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs transition-colors group ${
                                    activeView === 'board-detail' && selectedBoardId === board.id 
                                      ? 'bg-rose-900/30 text-rose-400' 
                                      : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'
                                  } ${
                                    dragOverBoardId === board.id ? 'bg-rose-900/30 text-rose-400' : ''
                                  }`}
                                >
                                  {/* Drag Handle */}
                                  {!isReadOnly && (
                                    <div 
                                      draggable 
                                      onDragStart={(e) => handleBoardDragStart(e, board.id)}
                                      className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-0.5"
                                    >
                                      <GripVertical className="w-3 h-3" />
                                    </div>
                                  )}
                                  
                                  {/* Click Target */}
                                  <button
                                    onClick={() => {
                                      setSelectedBoardId(board.id);
                                      setSelectedCollectionId(null);
                                      setActiveView('board-detail');
                                      onClose();
                                    }}
                                    onDragOver={(e) => handleBoardDragOver(e, board.id)}
                                    onDragLeave={handleBoardDragLeave}
                                    onDrop={(e) => handleBoardDrop(e, board.id)}
                                    className="flex-1 text-left flex items-center gap-2 truncate"
                                  >
                                    <Folder className="w-3 h-3 flex-shrink-0" />
                                    <span className="truncate">{board.name}</span>
                                  </button>
                                </div>
                             ))}
                             {boards.filter(b => b.collectionIds && b.collectionIds.includes(col.id)).length === 0 && (
                               <div className="px-3 py-1 text-[10px] text-slate-700 italic">Empty collection</div>
                             )}
                          </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Boards Section (All Boards) */}
            <div>
              <div className="flex items-center justify-between mb-2 px-2 group sticky top-0 bg-slate-950 z-10 py-1">
                <button 
                  onClick={() => setIsBoardsOpen(!isBoardsOpen)}
                  className="flex items-center gap-1 text-xs font-bold text-slate-600 uppercase tracking-wider hover:text-slate-400 flex-1 text-left"
                >
                  {isBoardsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  All Boards
                </button>
                <div className="flex items-center gap-1">
                    <SortToggle value={boardSort} onChange={setBoardSort} />
                    {!isReadOnly && (
                    <button 
                        onClick={(e) => {
                        e.stopPropagation();
                        onOpenCreateBoard();
                        }}
                        className="p-1.5 text-slate-500 hover:text-rose-500 transition-colors rounded-md hover:bg-slate-900"
                        title="Create New Board"
                    >
                        <Plus className="w-3 h-3" />
                    </button>
                    )}
                </div>
              </div>

              {isBoardsOpen && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                  {sortedBoards.map(board => (
                    <div
                      key={board.id}
                      className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm transition-all group ${
                        activeView === 'board-detail' && selectedBoardId === board.id 
                          ? 'text-slate-100 bg-slate-900/30' 
                          : 'text-slate-400 hover:bg-slate-900/50'
                      } ${
                        dragOverBoardId === board.id 
                          ? 'bg-rose-900/30 text-rose-400' 
                          : ''
                      }`}
                    >
                      {/* Drag Handle */}
                      {!isReadOnly && (
                        <div 
                          draggable 
                          onDragStart={(e) => handleBoardDragStart(e, board.id)}
                          className="cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-1 -ml-1"
                        >
                          <GripVertical className="w-3.5 h-3.5" />
                        </div>
                      )}

                      {/* Click Target */}
                      <button
                        onClick={() => {
                          setSelectedBoardId(board.id);
                          setSelectedCollectionId(null);
                          setActiveView('board-detail');
                          onClose();
                        }}
                        onDragOver={(e) => handleBoardDragOver(e, board.id)}
                        onDragLeave={handleBoardDragLeave}
                        onDrop={(e) => handleBoardDrop(e, board.id)}
                        className="flex-1 text-left flex items-center gap-3 truncate"
                      >
                        <Folder className={`w-4 h-4 transition-colors ${dragOverBoardId === board.id ? 'text-rose-500' : 'opacity-30'}`} />
                        <span className="truncate">{board.name}</span>
                      </button>
                    </div>
                  ))}
                  {sortedBoards.length === 0 && (
                    <div className="px-4 py-2 text-xs text-slate-700 italic">No boards yet.</div>
                  )}
                </div>
              )}
            </div>
        </div>

        {/* Fixed Footer */}
        <div className="p-4 border-t border-slate-900 space-y-1 flex-shrink-0 bg-slate-950">
          {!isReadOnly && (
            <button
              onClick={() => {
                onOpenSettings();
                onClose();
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-900/50 hover:text-slate-200 transition-colors"
            >
              <Settings className="w-4 h-4" />
              App Settings
            </button>
          )}
          
          <a
            href="https://github.com/volumedata21/tallo21"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-900/30 transition-colors mt-2"
          >
            <Github className="w-3 h-3" />
            <span className="opacity-80">v1.0.0</span>
          </a>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
