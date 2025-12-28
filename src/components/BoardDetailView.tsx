import React, { useState } from 'react';
import { Board, PinnedImage, GridItem, Collection, PinSortOption, PinGroup } from '../../shared/types';
import MasonryGrid from './MasonryGrid';
import MapView from './MapView';
import EditBoardModal from './EditBoardModal';
import { ChevronLeft, Info, Trash2, LayoutGrid, Map as MapIcon, Edit, Globe, Lock, Link as LinkIcon, ArrowUpDown, Share2, Shuffle, MoreHorizontal } from 'lucide-react';

interface BoardDetailViewProps {
  board: Board;
  collection?: Collection; 
  allCollections?: Collection[]; 
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
  onSelect?: (id: string, isShift?: boolean) => void; 
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
         .map(id => boardImages.find(img => img.id === id)) 
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

  const SortDropdown = () => {
    // ... (Simple dropdown implementation for this view)
    return (
       <div className="flex items-center gap-1">
          <button 
            onClick={() => onPinSortChange && onPinSortChange(pinSort === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {pinSort === 'newest' ? 'Newest' : 'Oldest'}
          </button>
       </div>
    );
  };

  return (
    <div className="animate-in fade-in duration-500 h-full flex flex-col px-4 sm:px-6 lg:px-8 py-8">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-6 mb-8">
        
        {/* Left: Title & Info */}
        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-4xl md:text-5xl font-black text-slate-100 tracking-tight leading-none">{board.name}</h1>
            
            {/* Visibility Badge */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
               {board.visibility === 'public' && <Globe className="w-4 h-4" title="Public" />}
               {board.visibility === 'unlisted' && <LinkIcon className="w-4 h-4" title="Unlisted" />}
               {board.visibility === 'private' && <Lock className="w-4 h-4" title="Private" />}
            </div>
          </div>
          
          <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-4">
            {board.description || 'A curated collection of visual inspirations.'}
          </p>

          <button 
            onClick={onBack}
            className="group flex items-center gap-2 text-sm font-bold text-rose-500 hover:text-rose-400 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Boards
          </button>
        </div>

        {/* Right: Action Pill */}
        <div className="flex-shrink-0">
          <div className="flex items-center gap-1 bg-slate-900 p-1.5 rounded-full border border-slate-800 shadow-lg shadow-black/20">
             
             {/* Share Button */}
             <div className="relative">
               <button 
                  onClick={handleShare}
                  className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative"
                  title="Share Board"
                >
                  <Share2 className="w-4 h-4" />
                  {showShareTooltip && (
                    <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-blue-500 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-50">
                      Link Copied!
                    </div>
                  )}
               </button>
             </div>

            {isOwner && (
              <>
                <div className="w-px h-4 bg-slate-800 mx-1"></div>
                
                <button 
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-full transition-colors"
                  title="Edit Details"
                >
                  <Edit className="w-4 h-4" />
                </button>
                
                <button 
                  onClick={onDeleteBoard}
                  className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-slate-800 rounded-full transition-colors"
                  title="Delete Board"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* VIEW CONTROLS (Secondary Toolbar) */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-6">
         <div className="text-sm font-bold text-slate-500">
            {images.length} Pins
         </div>

         <div className="flex items-center gap-2">
            {onShuffle && (
              <button
                onClick={onShuffle}
                className={`p-2 rounded-lg transition-colors ${
                  shuffleSeed > 0 ? 'text-rose-500 bg-rose-500/10' : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Shuffle View"
              >
                <Shuffle className="w-4 h-4" />
              </button>
            )}
            
            {onPinSortChange && <SortDropdown />}
            
            <div className="w-px h-4 bg-slate-800 mx-2"></div>

            <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                <button
                    onClick={() => setViewMode('grid')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-colors ${
                    viewMode === 'grid' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <LayoutGrid className="w-4 h-4" />
                    Grid
                </button>
                <button
                    onClick={() => setViewMode('map')}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-2 transition-colors ${
                    viewMode === 'map' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                    <MapIcon className="w-4 h-4" />
                    Map
                </button>
            </div>
         </div>
      </div>

      {/* CONTENT GRID */}
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