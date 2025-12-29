import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { PinnedImage, Board, Collection, PinGroup, DiscoverySource } from '../../shared/types';
import { storage } from '../services/storageService';
import { useAuth } from './AuthContext';

interface DataContextType {
  // State
  images: PinnedImage[];
  boards: Board[];
  collections: Collection[];
  groups: PinGroup[];
  discoverySources: DiscoverySource[];
  isLoading: boolean;
  
  // Actions
  refreshData: () => Promise<void>;
  
  // Image Actions
  addImage: (image: PinnedImage) => void;
  updateImage: (image: PinnedImage) => Promise<void>;
  deleteImage: (id: string) => Promise<void>;
  
  // Board Actions
  addBoard: (board: Board) => Promise<void>;
  updateBoard: (board: Board) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  
  // Collection Actions
  addCollection: (collection: Collection) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  
  // Group Actions
  addGroup: (group: PinGroup) => Promise<void>;
  updateGroup: (group: PinGroup) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  
  // Discovery Actions
  addDiscoverySource: (source: DiscoverySource) => Promise<void>;
  deleteDiscoverySource: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [images, setImages] = useState<PinnedImage[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [groups, setGroups] = useState<PinGroup[]>([]);
  const [discoverySources, setDiscoverySources] = useState<DiscoverySource[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // --- Clear Data (Fixes Duplicates on Re-login) ---
  const clearData = () => {
    setImages([]);
    setBoards([]);
    setCollections([]);
    setGroups([]);
    setDiscoverySources([]);
  };

  const refreshData = useCallback(async () => {
    if (!user) {
        clearData();
        return;
    }

    setIsLoading(true);
    try {
      await storage.init();
      const [imgs, brds, cols, grps, disc] = await Promise.all([
        storage.getAllImages(),
        storage.getAllBoards(),
        storage.getAllCollections(),
        storage.getAllGroups(),
        storage.getAllDiscoverySources()
      ]);

      // Filter by OwnerId to prevent seeing other users' data (Access Issues)
      const myImages = Array.isArray(imgs) ? imgs.filter(i => i.ownerId === user.id) : [];
      const myBoards = Array.isArray(brds) ? brds.filter(b => b.ownerId === user.id) : [];
      const myCollections = Array.isArray(cols) ? cols.filter(c => c.ownerId === user.id) : [];
      const myGroups = Array.isArray(grps) ? grps.filter(g => g.ownerId === user.id) : [];
      const myDiscovery = Array.isArray(disc) ? disc.filter(d => d.ownerId === user.id) : [];

      setImages(myImages.sort((a, b) => b.createdAt - a.createdAt));
      
      // Fix Board Collection IDs if legacy data exists
      const cleanBoards = myBoards.map(b => ({
        ...b,
        collectionIds: Array.isArray(b.collectionIds) ? b.collectionIds : []
      }));
      setBoards(cleanBoards);

      setCollections(myCollections);
      setGroups(myGroups);
      setDiscoverySources(myDiscovery);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load data when user changes
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // --- Actions ---

  // Images
  const addImage = (newImage: PinnedImage) => {
    setImages(prev => [newImage, ...prev]);
    // storage.saveImage(newImage) is usually called by the uploader directly, 
    // but if needed we can call it here too.
  };

  const updateImage = async (updated: PinnedImage) => {
    setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
    try { await storage.updateImage(updated); } 
    catch (e) { console.error(e); refreshData(); }
  };

  const deleteImage = async (id: string) => {
    const prevImages = [...images];
    setImages(prev => prev.filter(img => img.id !== id));
    
    // Remove from groups locally
    const impactedGroups = groups.filter(g => g.imageIds.includes(id));
    impactedGroups.forEach(g => {
        const updatedG = { ...g, imageIds: g.imageIds.filter(iId => iId !== id) };
        updateGroup(updatedG);
    });

    try { await storage.deleteImage(id); } 
    catch (e) { setImages(prevImages); }
  };

  // Boards
  const addBoard = async (board: Board) => {
    // Optimistic Add
    setBoards(prev => [...prev, board]);
    try { await storage.saveBoard(board); } 
    catch (e) { 
        console.error("Failed to save board", e); 
        setBoards(prev => prev.filter(b => b.id !== board.id)); // Revert
    }
  };

  const updateBoard = async (board: Board) => {
    // Optimistic Update (Fixes Collection Move Lag)
    setBoards(prev => prev.map(b => b.id === board.id ? board : b));
    try { await storage.updateBoard(board); } 
    catch (e) { console.error(e); refreshData(); }
  };

  const deleteBoard = async (id: string) => {
    setBoards(prev => prev.filter(b => b.id !== id));
    // Remove board reference from images locally
    const imagesToUpdate = images.filter(img => img.boardIds.includes(id));
    imagesToUpdate.forEach(img => {
       const updated = { ...img, boardIds: img.boardIds.filter(bid => bid !== id) };
       // Don't call updateImage here to avoid massive API spam, just local state or rely on refresh
       setImages(prev => prev.map(i => i.id === updated.id ? updated : i));
    });
    await storage.deleteBoard(id);
  };

  // Collections
  const addCollection = async (collection: Collection) => {
    setCollections(prev => [...prev, collection]);
    await storage.saveCollection(collection);
  };

  const deleteCollection = async (id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
    // Also remove collection reference from boards
    const boardsToUpdate = boards.filter(b => b.collectionIds.includes(id));
    boardsToUpdate.forEach(b => {
        const updated = { ...b, collectionIds: b.collectionIds.filter(cid => cid !== id) };
        updateBoard(updated);
    });
    // storageService needs this method
    if ((storage as any).deleteCollection) {
        await (storage as any).deleteCollection(id); 
    }
  };

  // Groups
  const addGroup = async (group: PinGroup) => {
    setGroups(prev => [group, ...prev]);
    await storage.saveGroup(group);
  };

  const updateGroup = async (group: PinGroup) => {
    setGroups(prev => prev.map(g => g.id === group.id ? group : g));
    await storage.saveGroup(group);
  };

  const deleteGroup = async (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
    await storage.deleteGroup(id);
  };

  // Discovery
  const addDiscoverySource = async (source: DiscoverySource) => {
    setDiscoverySources(prev => [...prev, source]);
    await storage.saveDiscoverySource(source);
  };

  const deleteDiscoverySource = async (id: string) => {
    setDiscoverySources(prev => prev.filter(s => s.id !== id));
    await storage.deleteDiscoverySource(id);
  };

  return (
    <DataContext.Provider value={{
      images, boards, collections, groups, discoverySources, isLoading,
      refreshData,
      addImage, updateImage, deleteImage,
      addBoard, updateBoard, deleteBoard,
      addCollection, deleteCollection,
      addGroup, updateGroup, deleteGroup,
      addDiscoverySource, deleteDiscoverySource
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};