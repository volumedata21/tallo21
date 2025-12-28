import React, { useMemo } from 'react';
import { Collection, Board, PinnedImage, GridItem } from '../../shared/types';
import MasonryGrid from './MasonryGrid';
import { ArrowLeft, Folder, Trash2, Info } from 'lucide-react';

interface CollectionDetailViewProps {
  collection: Collection;
  boards: Board[]; // All boards (we filter inside)
  images: PinnedImage[]; // All images (we filter inside)
  onBack: () => void;
  onDeleteCollection: (id: string) => void;
  
  // Grid Props
  onImageClick: (id: string) => void;
  onTogglePin: (imageId: string, boardId: string) => void;
  onToggleFavorite: (id: string) => void;
  onUpdate: (image: PinnedImage) => void;
  onDeleteImage: (id: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, shift?: boolean) => void;
}

const CollectionDetailView: React.FC<CollectionDetailViewProps> = ({
  collection, boards, images, onBack, onDeleteCollection, 
  onImageClick, onTogglePin, onToggleFavorite, onUpdate, onDeleteImage, isSelectionMode, selectedIds, onSelect
}) => {
  
  // 1. Identify Boards in this Collection
  const collectionBoards = useMemo(() => 
    boards.filter(b => b.collectionIds.includes(collection.id)), 
  [boards, collection.id]);

  const collectionBoardIds = collectionBoards.map(b => b.id);

  // 2. Aggregate Images from those Boards
  const collectionImages = useMemo(() => 
    images.filter(img => img.boardIds.some(bid => collectionBoardIds.includes(bid))),
  [images, collectionBoardIds]);

  // 3. Convert to Grid Items
  const gridItems: GridItem[] = useMemo(() => 
    collectionImages.map(img => ({ type: 'image', data: img })), 
  [collectionImages]);

  return (
    <div className="h-full flex flex-col px-4 sm:px-6 lg:px-8 py-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-slate-900 pb-6 flex-shrink-0">
        <div>
           <button 
             onClick={onBack} 
             className="flex items-center gap-2 text-slate-500 hover:text-white mb-4 transition-colors font-medium text-sm"
           >
             <ArrowLeft className="w-4 h-4" /> Back to Boards
           </button>
           
           <h1 className="text-4xl font-black text-slate-100 mb-3">{collection.name}</h1>
           
           <div className="flex flex-wrap gap-2">
             {collectionBoards.length > 0 ? (
               collectionBoards.map(board => (
                 <div key={board.id} className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-bold text-slate-400">
                   <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                   {board.name}
                 </div>
               ))
             ) : (
                <span className="text-slate-500 text-sm italic">No boards in this collection yet.</span>
             )}
           </div>
        </div>

        <button
          onClick={() => {
            if(confirm('Delete this collection? The boards inside will NOT be deleted.')) {
              onDeleteCollection(collection.id);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-red-950/30 text-slate-400 hover:text-red-500 border border-slate-800 hover:border-red-900/50 rounded-xl transition-all text-sm font-bold"
        >
          <Trash2 className="w-4 h-4" />
          Delete Collection
        </button>
      </div>

      {/* Content Feed */}
      <div className="flex-1 min-h-0">
         {collectionImages.length > 0 ? (
            <MasonryGrid
              items={gridItems}
              boards={boards}
              onImageClick={onImageClick}
              onTogglePin={onTogglePin}
              onToggleFavorite={onToggleFavorite}
              onUpdate={onUpdate}
              onDelete={onDeleteImage}
              isSelectionMode={isSelectionMode}
              selectedIds={selectedIds}
              onSelect={onSelect}
            />
         ) : (
            <div className="flex flex-col items-center justify-center py-20 text-slate-600 border-2 border-dashed border-slate-900 rounded-3xl bg-slate-950/50">
               <Folder className="w-12 h-12 mb-4 opacity-20" />
               <p className="text-lg font-medium text-slate-400">Collection is empty</p>
               <p className="text-sm">Edit your boards to add them to this collection.</p>
            </div>
         )}
      </div>
    </div>
  );
};

export default CollectionDetailView;