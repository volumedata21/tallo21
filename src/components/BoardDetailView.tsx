import React, { useState, useEffect, useRef } from 'react';
import { Board, PinnedImage, GridItem, Collection, PinSortOption, PinGroup } from '../../shared/types';
import MasonryGrid from './MasonryGrid';
import MapView from './MapView';
import EditBoardModal from './EditBoardModal';
import { ChevronLeft, Info, Trash2, LayoutGrid, Map as MapIcon, Edit, Globe, Lock, Link as LinkIcon, Folder, ArrowUpDown, Share2, Shuffle } from 'lucide-react';

interface BoardDetailViewProps {
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
  onSelect?: (id: string, isShift?: boolean) => void; // Fixed signature
  onUpdateBoard: (updates: Partial<Board>) => void;
  isOwner?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
  pinSort?: PinSortOption;
  onPinSortChange?: (sort: PinSortOption) => void;
  shuffleSeed?: number;
  onShuffle?: () => void;
}

const getDeterministicScore = (id: string, seed: number) => {
  let h = 0x811c9dc5;
  const str = id + seed.toString();
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const BoardDetailView: React.FC<BoardDetailViewProps> = ({ 
  board, collection, allCollections, images, groups, onDeleteImage, onBack, boards, onTogglePin, onDeleteBoard, onUpdate, onImageClick, onToggleFavorite,
  isSelectionMode, selectedIds, onSelect, onUpdateBoard, isOwner, onLoadMore, hasMore, pinSort = 'newest', onPinSortChange, shuffleSeed = 0, onShuffle
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showShareTooltip, setShowShareTooltip] = useState(false);

  // Filter images to only show ones in this board
  const boardImages = images.filter(img => img.boardIds.includes(board.id));

  // Logic to build the grid items (Group vs Image)
  const getGridItems = () => {
    const gridItems: GridItem[] = [];
    const groupedImageIds = new Set<string>();

    groups.forEach(group => {
       const groupImages = group.imageIds
         .map(id => boardImages.find(img => img.id === id)) // Use boardImages here
         .filter((img): img is PinnedImage => !!img);

       if (groupImages.length > 0) {
         gridItems.push({
           type: 'group',
           data: group,
           images: groupImages
         });
         group.imageIds.forEach(id => groupedImageIds.add(id));
       }
    });

    boardImages.forEach(img => {
      if (!groupedImageIds.has(img.id)) {
         gridItems.push({ type: 'image', data: img });
      }
    });

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

  const handleShare = async () => {
    const url = new URL(window.location.origin);
    url.searchParams.set('board', board.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setShowShareTooltip(true);
      setTimeout(() => setShowShareTooltip(false), 2000);
    } catch (err) { console.error('Failed to copy', err); }
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-rose-500 transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Boards</span>
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

          {isOwner && (
            <>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="text-slate-500 hover:text-slate-200 transition-colors flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-slate-800"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button 
                onClick={onDeleteBoard}
                className="text-slate-500 hover:text-red-500 transition-colors flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </>
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
          
          <p className="text-slate-400 max-w-2xl">{board.description || 'A curated collection of visual inspirations.'}</p>
        </div>

        <div className="flex items-center gap-3">
            {onShuffle && (
              <button
                onClick={onShuffle}
                className={`flex items-center gap-2 px-3 py-1.5 border border-slate-800 rounded-md text-xs font-medium transition-colors ${
                  shuffleSeed > 0 ? 'bg-rose-900/30 text-rose-400 border-rose-900/50' : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Shuffle className="w-3 h-3" />
                <span className="hidden sm:inline">Shuffle</span>
              </button>
            )}
            
            {onPinSortChange && (
                 <button 
                    onClick={() => onPinSortChange(pinSort === 'newest' ? 'oldest' : 'newest')}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {pinSort === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
            )}
            
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
        {gridItems.length > 0 ? (
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
            <MapView images={boardImages} onImageClick={onImageClick} />
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

export default BoardDetailView;