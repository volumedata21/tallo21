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
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
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

      setImages(Array.isArray(imgs) ? imgs.sort((a, b) => b.createdAt - a.createdAt) : []);
      
      const cleanBoards = Array.isArray(brds) ? brds.map(b => ({
        ...b,
        collectionIds: b.collectionIds || (b.collectionId ? [b.collectionId] : [])
      })) : [];
      setBoards(cleanBoards);

      setCollections(Array.isArray(cols) ? cols : []);
      setGroups(Array.isArray(grps) ? grps : []);
      setDiscoverySources(Array.isArray(disc) ? disc : []);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [user, refreshData]);

  // --- Actions ---

  const addImage = (newImage: PinnedImage) => {
    setImages(prev => [newImage, ...prev]);
  };

  const updateImage = async (updated: PinnedImage) => {
    setImages(prev => prev.map(img => img.id === updated.id ? updated : img));
    try { await storage.updateImage(updated); } 
    catch (e) { console.error(e); refreshData(); }
  };

  const deleteImage = async (id: string) => {
    const prevImages = [...images];
    setImages(prev => prev.filter(img => img.id !== id));
    
    const impactedGroups = groups.filter(g => g.imageIds.includes(id));
    impactedGroups.forEach(g => {
        const updatedG = { ...g, imageIds: g.imageIds.filter(iId => iId !== id) };
        updateGroup(updatedG);
    });

    try { await storage.deleteImage(id); } 
    catch (e) { setImages(prevImages); }
  };

  const addBoard = async (board: Board) => {
    setBoards(prev => [...prev, board]);
    await storage.saveBoard(board);
  };

  const updateBoard = async (board: Board) => {
    setBoards(prev => prev.map(b => b.id === board.id ? board : b));
    await storage.updateBoard(board);
  };

  const deleteBoard = async (id: string) => {
    setBoards(prev => prev.filter(b => b.id !== id));
    const imagesToUpdate = images.filter(img => img.boardIds.includes(id));
    imagesToUpdate.forEach(img => {
       const updated = { ...img, boardIds: img.boardIds.filter(bid => bid !== id) };
       updateImage(updated);
    });
    await storage.deleteBoard(id);
  };

  const addCollection = async (collection: Collection) => {
    setCollections(prev => [...prev, collection]);
    await storage.saveCollection(collection);
  };

  const deleteCollection = async (id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
    // Assumes storage service has this method, if not, you might need to add it or ignore for now
    if ((storage as any).deleteCollection) {
        await (storage as any).deleteCollection(id); 
    }
  };

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