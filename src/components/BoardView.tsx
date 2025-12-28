
import React, { useState, useEffect, useRef } from 'react';
import { Board, PinnedImage, GridItem, Collection, PinSortOption, PinGroup } from '../types';
import MasonryGrid from './MasonryGrid';
import MapView from './MapView';
import EditBoardModal from './EditBoardModal';
import { ChevronLeft, Info, Trash2, LayoutGrid, Map as MapIcon, Edit, Globe, Lock, Link as LinkIcon, Folder, ArrowUpDown, Share2, Shuffle } from 'lucide-react';

interface BoardViewProps {
  board: Board;
  collection?: Collection; // Optional specific parent context
  allCollections?: Collection[]; // Needed for edit modal
  images: PinnedImage[];
  groups: PinGroup[];
  onDeleteImage: (id: string, isGroup?: boolean) => void;
  onBack: () => void;
  boards: Board[];
  onTogglePin: (imageId: string, boardId: string) => void;
  onDeleteBoard: () => void;
  onUpdate: (image: PinnedImage) => void;
  onImageClick: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string) => void;
  onUpdateBoard?: (updates: Partial<Board>) => void; // New prop for updating board
  isOwner?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  pinSort?: PinSortOption;
  onPinSortChange?: (sort: PinSortOption) => void;
  shuffleSeed?: number;
  onShuffle?: () => void;
}

// Deterministic hash for shuffling (copy from App.tsx or utils)
const getDeterministicScore = (id: string, seed: number) => {
  let h = 0x811c9dc5;
  const str = id + seed.toString();
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const BoardView: React.FC<BoardViewProps> = ({ 
  board, collection, allCollections, images, groups, onDeleteImage, onBack, boards, onTogglePin, onDeleteBoard, onUpdate, onImageClick, onToggleFavorite,
  isSelectionMode, selectedIds, onSelect, onUpdateBoard, isOwner, onLoadMore, hasMore, pinSort = 'newest', onPinSortChange, shuffleSeed = 0, onShuffle
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  // Group pins logic (similar to App.tsx)
  const getGridItems = () => {
    const gridItems: GridItem[] = [];
    const groupedImageIds = new Set<string>();

    // Process groups first
    groups.forEach(group => {
       // Find images in this board/view that belong to this group
       const groupImages = group.imageIds
         .map(id => images.find(img => img.id === id))
         .filter((img): img is PinnedImage => !!img);

       // If this group has images in the current view, create a group card
       if (groupImages.length > 0) {
         gridItems.push({
           type: 'group',
           data: group,
           images: groupImages
         });
         // Mark these images as handled
         group.imageIds.forEach(id => groupedImageIds.add(id));
       }
    });

    // Process remaining individual images
    images.forEach(img => {
      if (!groupedImageIds.has(img.id)) {
         gridItems.push({
           type: 'image',
           data: img
         });
      }
    });

    // Sort items
    return gridItems.sort((a, b) => {
       if (shuffleSeed > 0) {
         const idA = a.type === 'image' ? a.data.id : a.data.id;
         const idB = b.type === 'image' ? b.data.id : b.data.id;
         return getDeterministicScore(idA, shuffleSeed) - getDeterministicScore(idB, shuffleSeed);
       }

       const timeA = a.type === 'image' ? a.data.createdAt : a.data.createdAt;
       const timeB = b.type === 'image' ? b.data.createdAt : b.data.createdAt;
       return pinSort === 'newest' ? timeB - timeA : timeA - timeB;
    });
  };

  const gridItems = getGridItems();

  // Identify all collections this board belongs to if we have the full list
  const parentCollections = allCollections 
    ? allCollections.filter(c => board.collectionIds?.includes(c.id)) 
    : (collection ? [collection] : []);

  const handleShare = async () => {
    // Explicitly construct URL to ensure it points to this board
    const url = new URL(window.location.origin);
    url.searchParams.set('board', board.id);
    
    try {
      await navigator.clipboard.writeText(url.toString());
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const SortDropdown = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
      <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors"
          >
              <ArrowUpDown className="w-3 h-3" />
              <span className="hidden sm:inline">Sort</span>
          </button>
          {isOpen && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <button 
                    onClick={() => {
                      onPinSortChange && onPinSortChange('newest');
                      setIsOpen(false);
                    }} 
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${pinSort === 'newest' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
                >
                    Newest First
                </button>
                <button 
                    onClick={() => {
                      onPinSortChange && onPinSortChange('oldest');
                      setIsOpen(false);
                    }} 
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 transition-colors ${pinSort === 'oldest' ? 'text-rose-500 font-bold' : 'text-slate-400'}`}
                >
                    Oldest First
                </button>
            </div>
          )}
      </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-rose-500 transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back</span>
        </button>

        <div className="flex gap-2">
           <div className="relative">
             <button 
                onClick={handleShare}
                className="text-slate-500 hover:text-blue-400 transition-colors flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-slate-800"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              {showShareTooltip && (
                <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-blue-500 text-white text-xs rounded shadow-lg whitespace-nowrap z-50">
                  Link Copied!
                </div>
              )}
           </div>

          {isOwner && onUpdateBoard && (
            <button 
              onClick={() => setIsEditModalOpen(true)}
              className="text-slate-500 hover:text-slate-200 transition-colors flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-slate-800"
            >
              <Edit className="w-4 h-4" />
              Edit Board
            </button>
          )}
          {isOwner && (
            <button 
              onClick={onDeleteBoard}
              className="text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-900 pb-6 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-black text-slate-100">{board.name}</h1>
            <div className="flex items-center gap-2">
               {board.visibility === 'public' && <span title="Public"><Globe className="w-5 h-5 text-slate-600" /></span>}
               {board.visibility === 'unlisted' && <span title="Unlisted"><LinkIcon className="w-5 h-5 text-slate-600" /></span>}
               {board.visibility === 'private' && <span title="Private"><Lock className="w-5 h-5 text-slate-600" /></span>}
            </div>
          </div>
          
          {parentCollections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {parentCollections.map(col => (
                <div key={col.id} className="flex items-center gap-2 text-rose-500 text-sm font-medium bg-rose-950/20 px-2 py-1 rounded-md border border-rose-900/30">
                  <Folder className="w-3 h-3" />
                  <span>{col.name}</span>
                </div>
              ))}
            </div>
          )}
          
          <p className="text-slate-400 max-w-2xl">{board.description || 'A curated collection of visual inspirations.'}</p>
        </div>

        <div className="flex items-center gap-3">
            {onShuffle && (
              <button
                onClick={onShuffle}
                className={`flex items-center gap-2 px-3 py-1.5 border border-slate-800 rounded-md text-xs font-medium transition-colors ${
                  shuffleSeed > 0 ? 'bg-rose-900/30 text-rose-400 border-rose-900/50' : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
                title="Shuffle Items"
              >
                <Shuffle className="w-3 h-3" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            )}
            
            {onPinSortChange && <SortDropdown />}
            
            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
            <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'grid' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
                <LayoutGrid className="w-4 h-4" />
                Grid
            </button>
            <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                viewMode === 'map' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
            >
                <MapIcon className="w-4 h-4" />
                Map
            </button>
            </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {images.length > 0 ? (
          viewMode === 'grid' ? (
            <MasonryGrid 
              items={gridItems} 
              onDelete={onDeleteImage} 
              boards={boards}
              onTogglePin={onTogglePin}
              onUpdate={onUpdate}
              onImageClick={onImageClick}
              onToggleFavorite={onToggleFavorite}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onSelect={onSelect}
              onLoadMore={onLoadMore}
              hasMore={hasMore}
            />
          ) : (
            <MapView images={images} onImageClick={onImageClick} />
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-900 rounded-3xl bg-slate-950/50">
            <Info className="w-10 h-10 mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-400">This board is empty</p>
            <p className="text-sm">Go to "All Tallos" and add some inspirations here.</p>
          </div>
        )}
      </div>

      {isEditModalOpen && onUpdateBoard && allCollections && (
        <EditBoardModal 
          board={board}
          collections={allCollections}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={onUpdateBoard}
        />
      )}
    </div>
  );
};

export default BoardView;
