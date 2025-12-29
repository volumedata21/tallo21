import React, { useMemo } from 'react';
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import BoardDetailView from '../components/BoardDetailView';
import { OutletContextType } from '../components/Layout';

export const BoardPage: React.FC = () => {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { boards, images, groups, collections, updateBoard, deleteBoard, updateImage, deleteImage } = useData();
  const { user } = useAuth();
  
  const { isSelectionMode, selectedIds, setSelectedIds } = useOutletContext<OutletContextType>();

  const board = boards.find(b => b.id === boardId);

  // --- FIX: Filter images for this specific board ---
  const boardImages = useMemo(() => {
    if (!boardId) return [];
    return images.filter(img => img.boardIds.includes(boardId));
  }, [images, boardId]);
  // -------------------------------------------------

  if (!board) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p className="text-xl font-bold mb-2">Board not found</p>
        <button onClick={() => navigate('/boards')} className="text-rose-500 hover:underline">
          Return to Boards
        </button>
      </div>
    );
  }

  const isOwner = user?.id === board.ownerId;

  return (
    <BoardDetailView
      board={board}
      allCollections={collections}
      
      // Pass the filtered list, not all images
      images={boardImages} 
      
      groups={groups}
      boards={boards}
      isOwner={isOwner}
      onBack={() => navigate('/boards')}
      onDeleteBoard={() => {
         deleteBoard(board.id);
         navigate('/boards');
      }}
      onUpdateBoard={updateBoard}
      onDeleteImage={(id) => deleteImage(id)}
      onUpdate={updateImage}
      onImageClick={(id) => {
         setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            next.set('pin', id);
            return next;
         });
      }}
      onTogglePin={() => {}}
      onToggleFavorite={async (id) => {
         const img = images.find(i => i.id === id);
         if (img) await updateImage({ ...img, isFavorite: !img.isFavorite });
      }}
      isSelectionMode={isSelectionMode}
      selectedIds={selectedIds}
      onSelect={(id) => {
         const newSet = new Set(selectedIds);
         if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
         setSelectedIds(newSet);
      }}
    />
  );
};