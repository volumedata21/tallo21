import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext'; 
import DiscoveryView from '../components/DiscoveryView';
import { discoveryService } from '../services/discoveryService';
import { PinnedImage } from '../../shared/types';

export const DiscoveryPage: React.FC = () => {
  const { 
    discoverySources, 
    addDiscoverySource, 
    deleteDiscoverySource, 
    addImage, 
    boards 
  } = useData();
  const { user } = useAuth();

  const [items, setItems] = useState<PinnedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Function to fetch content from all sources
  const loadDiscoveryFeed = useCallback(async () => {
    if (discoverySources.length === 0) {
      setItems([]);
      return;
    }

    setIsLoading(true);
    try {
      // Use the service to fetch and merge all RSS feeds
      const feedImages = await discoveryService.getDiscoveryStream(discoverySources);
      setItems(feedImages);
    } catch (error) {
      console.error("Failed to load discovery feed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [discoverySources]);

  // Reload feed when sources change (or on mount)
  useEffect(() => {
    loadDiscoveryFeed();
  }, [loadDiscoveryFeed]);

  const handlePinToBoard = async (image: PinnedImage, boardId: string) => {
    if (!user) return;

    // 1. Create a simplified copy of the image for saving
    const newImage: PinnedImage = {
      ...image,
      id: crypto.randomUUID(), // New ID for your database
      boardIds: [boardId],
      ownerId: user.id,
      createdAt: Date.now(),
      visibility: 'public', // Default to public or private preference
      // Ensure we don't save ephemeral 'discovery' IDs
    };

    // 2. Add to local state (optimistic UI) and Server
    addImage(newImage); 
    
    // 3. Persist to DB (addImage in DataContext should ideally handle this, 
    //    but if it only updates State, we might need to call storage here.
    //    Based on our DataContext, addImage() is State-Only, so let's check).
    
    // Check DataContext.tsx: addImage is likely just state. 
    // We should probably save it properly via the storage service 
    // OR update DataContext to handle the save.
    
    // For now, let's assume we need to trigger the save:
    try {
        const { storage } = await import('../services/storageService');
        await storage.saveImage(newImage);
    } catch(e) {
        console.error("Failed to save discovery pin", e);
    }
  };

  return (
    <DiscoveryView 
      sources={discoverySources}
      items={items} 
      isLoading={isLoading}
      onRefresh={loadDiscoveryFeed}
      onAddSource={addDiscoverySource}
      onRemoveSource={deleteDiscoverySource}
      boards={boards}
      onPinToBoard={handlePinToBoard} 
      onToggleFavorite={() => {}} // Favorites in discovery are usually temporary unless saved
    />
  );
};