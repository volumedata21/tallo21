import { useState, useEffect, useCallback } from 'react';
import { ViewType } from '../../shared/types';

export const useAppNavigation = () => {
  const [activeView, setActiveView] = useState<ViewType>('all');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  // Sync state with URL parameters on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get('pin');
    const board = params.get('board');
    
    if (pin) setSelectedImageId(pin);
    if (board) {
      setSelectedBoardId(board);
      setActiveView('board-detail');
    }
  }, []);

  const clearParams = useCallback(() => {
    setSelectedBoardId(null);
    setSelectedCollectionId(null);
    setSelectedImageId(null);
    setActiveView('all');
    window.history.pushState({}, '', window.location.pathname);
  }, []);

  return {
    activeView, setActiveView,
    selectedBoardId, setSelectedBoardId,
    selectedCollectionId, setSelectedCollectionId,
    selectedImageId, setSelectedImageId,
    clearParams
  };
};