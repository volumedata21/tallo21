import React, { useMemo } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import CollectionDetailView from '../components/CollectionDetailView';

// Interface for the context passed from Layout
interface OutletContextType {
  isSelectionMode: boolean;
  selectedIds: Set<string>;
  setSelectedIds: (ids: Set<string>) => void;
}

export const CollectionPage: React.FC = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const navigate = useNavigate();
  const { 
    collections, 
    boards, 
    images, 
    deleteCollection, 
    updateImage, 
    deleteImage 
  } = useData();
  const { user } = useAuth();
  
  // Get selection state from Layout
  const { isSelectionMode, selectedIds, setSelectedIds } = useOutletContext<OutletContextType>();

  const collection = collections.find(c => c.id === collectionId);

  // Redirect if not found
  if (!collection) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <p className="text-xl font-bold mb-2">Collection not found</p>
        <button onClick={() => navigate('/boards')} className="text-rose-500 hover:underline">
          Return to Boards
        </button>
      </div>
    );
  }

  // Filter boards that belong to this collection
  const collectionBoards = useMemo(() => 
    boards.filter(b => b.collectionIds.includes(collection.id)),
  [boards, collection.id]);

  // Filter images that are in those boards
  const collectionImages = useMemo(() => {
    const boardIds = collectionBoards.map(b => b.id);
    return images.filter(img => img.boardIds.some(id => boardIds.includes(id)));
  }, [images, collectionBoards]);

  return (
    <CollectionDetailView
      collection={collection}
      boards={collectionBoards}
      images={collectionImages}
      
      // Navigation
      onBack={() => navigate('/boards')}
      onImageClick={(id) => {
         // Update URL to open modal via Layout
         const params = new URLSearchParams(window.location.search);
         params.set('pin', id);
         navigate(`?${params.toString()}`, { replace: true });
      }}
      
      // Actions
      onDeleteCollection={async (id) => {
        await deleteCollection(id);
        navigate('/boards');
      }}
      onUpdate={updateImage}
      onDeleteImage={deleteImage}
      
      // These handlers might need implementation in DataContext if not already present
      onTogglePin={() => {}} 
      onToggleFavorite={() => {}}
      
      // Selection Prop Drilling
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