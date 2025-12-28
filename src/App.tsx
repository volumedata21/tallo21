import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
// FIXED IMPORT: Point to shared types
import { PinnedImage, Board, ViewType, PinGroup, GridItem, User, Visibility, Collection, PinSortOption, DiscoverySource } from '../shared/types';
import { storage } from './services/storageService';
import { authService } from './services/authService';
import { discoveryService } from './services/discoveryService';

import Sidebar from './components/Sidebar';
import MasonryGrid from './components/MasonryGrid';
import BoardView from './components/BoardView';
import MapView from './components/MapView';
import DiscoveryView from './components/DiscoveryView';
import UploadModal from './components/UploadModal';
import CreateBoardModal from './components/CreateBoardModal';
import CreateCollectionModal from './components/CreateCollectionModal';
import SettingsModal from './components/SettingsModal';
import ImageDetailModal from './components/ImageDetailModal';
import BulkActionModal from './components/BulkActionModal';
import LoginScreen from './components/LoginScreen';
import { DebugTools } from './components/DebugTools';

// FIXED IMPORT: Added 'Eye'
import { Plus, Search, LayoutGrid, Map as MapIcon, CheckSquare, Trash2, X, Heart, FolderPlus, Hash, MapPin, Layers, Folder, LogOut, Users, ArrowLeft, Shuffle, ArrowUpDown, Menu, Eye } from 'lucide-react';

const ITEMS_PER_PAGE = 30;

// --- INLINE HELPERS ---
const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const getDeterministicScore = (id: string, seed: number) => {
  let h = 0x811c9dc5;
  const str = id + seed.toString();
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

// --- INLINE COMPONENT: Simple Toast ---
const SimpleToast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-xl z-[100] text-white ${type === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
      {message}
    </div>
  );
};

// --- HELPER: User Menu ---
const UserMenu = ({ user, onLogout }: { user: User | null, onLogout: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative z-50" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 mr-2 outline-none">
         <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center text-xs font-bold text-white border-2 border-transparent hover:border-rose-400">
           {user?.username?.substring(0, 2).toUpperCase() || 'U'}
         </div>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50">
            <div className="px-4 py-3 border-b border-slate-800">
              <p className="text-xs text-slate-500 font-bold uppercase">Signed in as</p>
              <p className="text-sm font-medium text-white truncate">{user?.username}</p>
            </div>
            <button onClick={() => { onLogout(); setIsOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:text-white flex items-center gap-2 hover:bg-slate-800 transition-colors">
              <LogOut className="w-4 h-4" /> Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// --- HELPER: Sort Dropdown ---
const SortDropdown = ({ value, onChange, options }: { value: string, onChange: (v: any) => void, options: { label: string, value: string }[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200">
        <ArrowUpDown className="w-3 h-3" /> <span className="hidden sm:inline">Sort</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 overflow-hidden">
          {options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setIsOpen(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-800 ${value === opt.value ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// --- MAIN CONTENT ---
const AppContent: React.FC = () => {
  // Navigation State (Restored from Hook)
  const [activeView, setActiveView] = useState<ViewType>('all');
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);

  const clearParams = useCallback(() => {
    setSelectedBoardId(null);
    setSelectedCollectionId(null);
    setSelectedImageId(null);
    setActiveView('all');
    window.history.pushState({}, '', window.location.pathname);
  }, []);

  // Data State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allImages, setAllImages] = useState<PinnedImage[]>([]);
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [allGroups, setAllGroups] = useState<PinGroup[]>([]);
  const [allCollections, setAllCollections] = useState<Collection[]>([]);
  const [discoverySources, setDiscoverySources] = useState<DiscoverySource[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<PinnedImage[]>([]);
  const [isDiscoveryLoading, setIsDiscoveryLoading] = useState(false);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pinSort, setPinSort] = useState<PinSortOption>('newest');
  const [shuffleSeed, setShuffleSeed] = useState<number>(0);
  const [mainViewMode, setMainViewMode] = useState<'grid' | 'map'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals & Overlays
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCreateBoardOpen, setIsCreateBoardOpen] = useState(false);
  const [isCreateCollectionOpen, setIsCreateCollectionOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  // Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState<'board' | 'tags' | 'location' | 'group' | 'visibility' | null>(null);

  // Initial Auth Check
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Toast State
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handlePinSortChange = (sort: PinSortOption) => {
    setPinSort(sort);
    setShuffleSeed(0); 
  };

  useEffect(() => {
    const checkAuth = async () => {
      // 1. Migrate legacy data
      await authService.migrateLegacyAuth();
      
      const user = authService.getCurrentUser();
      
      try {
        // 2. Fetch users safely
        const response = await authService.getUsers();
        // Fallback: If response is null/undefined, make it an empty array
        const serverUsers = Array.isArray(response) ? response : [];
        
        // 3. Check for Ghost Session
        if (user) {
          // If server has users, check if WE are valid.
          // If server has 0 users (fresh install), we are definitely invalid.
          const isValidUser = serverUsers.length > 0 && serverUsers.find(u => u.id === user.id);
          
          if (!isValidUser) {
            console.warn("Ghost session detected (User invalid or DB empty). Logging out.");
            authService.logout();
            setCurrentUser(null);
            setShowLoginModal(true);
            setIsAuthChecking(false);
            return;
          }
        }
        
        setCurrentUser(user);
        
        // Show login if needed
        if (!user && serverUsers.length > 0) {
           const params = new URLSearchParams(window.location.search);
           const hasDeepLink = params.has('pin') || params.has('board');
           if (!hasDeepLink) {
             setShowLoginModal(true);
           }
        } else if (serverUsers.length === 0) {
            // Fresh install: Let LoginScreen handle the "Create Admin" flow
            setShowLoginModal(true);
        }

      } catch (e) {
        console.error("Auth check failed:", e);
        // If server is down, don't lock the app, just let it load in read-only/offline mode
        setCurrentUser(user); 
      } finally {
        setIsAuthChecking(false);
      }
    };
    
    checkAuth();
  }, []);

  const loadData = async () => {
    try {
      await storage.init();
      
      // Fetch raw data
      const rawImages = await storage.getAllImages();
      const rawBoards = await storage.getAllBoards();
      const rawGroups = await storage.getAllGroups();
      const rawCollections = await storage.getAllCollections();
      const rawDiscovery = await storage.getAllDiscoverySources();
      
      // Validate arrays (Defensive Coding)
      const storedImages = Array.isArray(rawImages) ? rawImages : [];
      const storedBoards = Array.isArray(rawBoards) ? rawBoards : [];
      const storedGroups = Array.isArray(rawGroups) ? rawGroups : [];
      const storedCollections = Array.isArray(rawCollections) ? rawCollections : [];
      const discovery = Array.isArray(rawDiscovery) ? rawDiscovery : [];

      const migratedBoards = storedBoards.map((b: any) => ({
        ...b,
        collectionIds: b.collectionIds || (b.collectionId ? [b.collectionId] : [])
      }));

      setAllImages(storedImages.sort((a, b) => b.createdAt - a.createdAt));
      setAllBoards(migratedBoards);
      setAllGroups(storedGroups);
      setAllCollections(storedCollections);
      setDiscoverySources(discovery);

      // Handle Deep Links safely
      const params = new URLSearchParams(window.location.search);
      const pinId = params.get('pin');
      const boardId = params.get('board');
      const user = authService.getCurrentUser();

      if (pinId && !pinId.startsWith('discovery-')) {
          // Now safe because storedImages is guaranteed to be an array
          const exists = storedImages.find(i => i.id === pinId);
          if (exists) {
            if (exists.visibility === 'public' || exists.visibility === 'unlisted' || (user && exists.ownerId === user.id)) {
                setSelectedImageId(pinId);
                setShowLoginModal(false); 
            } else if (!user) {
                setShowLoginModal(true);
            }
          }
      } else if (boardId) {
        const board = migratedBoards.find(b => b.id === boardId);
        if (board) {
            if (board.visibility === 'public' || board.visibility === 'unlisted' || (user && board.ownerId === user.id)) {
                setSelectedBoardId(boardId);
                setActiveView('board-detail');
                setShowLoginModal(false); 
            } else if (!user) {
                setShowLoginModal(true);
            }
        }
      }

    } catch (err) {
      console.error("Failed to load data", err);
      showToast("Failed to connect to server", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthChecking) {
      loadData();
    }
    
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const pinId = params.get('pin');
      const boardId = params.get('board');
      
      if (pinId) {
          setSelectedImageId(pinId);
      } else {
          setSelectedImageId(null);
      }
      
      if (boardId) {
          setSelectedBoardId(boardId);
          setActiveView('board-detail');
      } else if (pinId) {
          if (activeView === 'board-detail') {
               // keep view
          }
      } else {
          setSelectedBoardId(null);
          setActiveView('all');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isAuthChecking]);

  useEffect(() => {
      if (activeView === 'discovery' && discoveryItems.length === 0 && !isDiscoveryLoading) {
          refreshDiscoveryFeed();
      }
  }, [activeView, discoverySources]);

  const refreshDiscoveryFeed = async () => {
      if (discoverySources.length === 0) return;
      setIsDiscoveryLoading(true);
      const userSources = discoverySources.filter(s => currentUser && s.ownerId === currentUser.id);
      try {
        const fetchedItems = await discoveryService.getDiscoveryStream(userSources);
        setDiscoveryItems(fetchedItems);
      } catch (e) {
        showToast("Failed to refresh feed", "error");
      } finally {
        setIsDiscoveryLoading(false);
      }
  };

  const { boardLastUpdated, collectionLastUpdated } = useMemo(() => {
    const bMap: Record<string, number> = {};
    const cMap: Record<string, number> = {};

    allBoards.forEach(b => {
      bMap[b.id] = b.createdAt;
    });

    allImages.forEach(img => {
      img.boardIds.forEach(bid => {
        if (!bMap[bid] || img.createdAt > bMap[bid]) {
          bMap[bid] = img.createdAt;
        }
      });
    });

    allCollections.forEach(c => {
      cMap[c.id] = c.createdAt;
      const boardsInCollection = allBoards.filter(b => b.collectionIds.includes(c.id));
      boardsInCollection.forEach(b => {
        if (bMap[b.id] && bMap[b.id] > cMap[c.id]) {
          cMap[c.id] = bMap[b.id];
        }
      });
    });

    return { boardLastUpdated: bMap, collectionLastUpdated: cMap };
  }, [allImages, allBoards, allCollections]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isCreateBoardOpen) setIsCreateBoardOpen(false);
        else if (isUploadOpen) {
          setIsUploadOpen(false);
          setDroppedFiles([]);
        }
        else if (isCreateCollectionOpen) setIsCreateCollectionOpen(false);
        else if (isSettingsOpen) setIsSettingsOpen(false);
        else if (selectedImageId) setSelectedImageId(null);
        else if (bulkAction) setBulkAction(null);
        else if (isSelectionMode) {
          setIsSelectionMode(false);
          setSelectedIds(new Set());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUploadOpen, isCreateBoardOpen, isCreateCollectionOpen, isSettingsOpen, selectedImageId, bulkAction, isSelectionMode]);

  useEffect(() => {
    setPage(1);
  }, [activeView, selectedBoardId, selectedCollectionId, searchTerm, pinSort, shuffleSeed]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.relatedTarget === null) {
      setIsDraggingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    
    if (!currentUser) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const validFiles = files.filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
      
      if (validFiles.length > 0) {
        setDroppedFiles(validFiles);
        setIsUploadOpen(true);
      }
    }
  };

  const handleLogin = () => {
    const user = authService.getCurrentUser();
    setCurrentUser(user);
    setShowLoginModal(false);
    loadData();
    showToast(`Welcome back, ${user?.username}!`, 'success');
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setShowLoginModal(true);
    setAllImages([]); 
    setAllBoards([]);
    setDiscoveryItems([]);
    showToast("Logged out successfully", "success");
  };

  const handleGuestAccess = () => {
    setShowLoginModal(false);
  };

  const displayImages = useMemo(() => {
    let imgs = allImages;
    // Filter logic
    imgs = imgs.filter(img => {
      const isOwner = currentUser && (img.ownerId === currentUser.id);
      const isLegacy = !img.ownerId; 
      const isPublic = img.visibility === 'public';
      const isUnlistedAndSelected = img.visibility === 'unlisted' && img.id === selectedImageId;
      const isInPublicBoard = selectedBoardId ? allBoards.some(b => b.id === selectedBoardId && b.id === img.boardIds.find(bid => bid === selectedBoardId) && (b.visibility === 'public' || b.visibility === 'unlisted')) : false;
      return isOwner || isLegacy || isPublic || isUnlistedAndSelected || isInPublicBoard;
    });
    
    // Search logic
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        imgs = imgs.filter(img => 
            img.title.toLowerCase().includes(lower) || 
            img.tags.some(t => t.toLowerCase().includes(lower)) ||
            (img.location && img.location.toLowerCase().includes(lower))
        );
    }
    
    // View logic
    if (activeView === 'boards' && selectedBoardId) {
        imgs = imgs.filter(img => img.boardIds.includes(selectedBoardId));
    } else if (activeView === 'favorites') {
        imgs = imgs.filter(img => currentUser ? (img.ownerId === currentUser.id ? img.isFavorite : (img.likedBy || []).includes(currentUser.id)) : false);
    } else if (activeView === 'collection-detail' && selectedCollectionId) {
         // Collection view mainly shows boards, but if we wanted all images in collection:
         const boardIdsInCol = allBoards.filter(b => b.collectionIds.includes(selectedCollectionId)).map(b => b.id);
         imgs = imgs.filter(img => img.boardIds.some(bid => boardIdsInCol.includes(bid)));
    }

    return imgs;
  }, [allImages, currentUser, selectedImageId, selectedBoardId, allBoards, activeView, selectedCollectionId, searchTerm]);

  const displayBoards = useMemo(() => {
    return allBoards.filter(b => {
      const isOwner = currentUser && (b.ownerId === currentUser.id);
      const isLegacy = !b.ownerId;
      const isPublic = b.visibility === 'public';
      const isUnlistedAndSelected = b.visibility === 'unlisted' && b.id === selectedBoardId;
      return isOwner || isLegacy || isPublic || isUnlistedAndSelected;
    });
  }, [allBoards, currentUser, selectedBoardId]);
  
  const displayCollections = useMemo(() => {
    return allCollections.filter(c => currentUser && c.ownerId === currentUser.id);
  }, [allCollections, currentUser]);

  // Grid Items (Images + Groups)
  const gridItems = useMemo(() => {
    const items: GridItem[] = [];
    const groupedIds = new Set<string>();
    
    if (!searchTerm && activeView === 'all') {
        const relevantGroups = allGroups.filter(g => 
            g.imageIds.some(id => displayImages.some(img => img.id === id))
        );
        relevantGroups.forEach(g => {
            const groupImgs = g.imageIds.map(id => allImages.find(i => i.id === id)).filter((i): i is PinnedImage => !!i);
            if (groupImgs.length) {
                items.push({ type: 'group', data: g, images: groupImgs });
                g.imageIds.forEach(id => groupedIds.add(id));
            }
        });
    }

    displayImages.forEach(img => {
        if (!groupedIds.has(img.id)) {
            items.push({ type: 'image', data: img });
        }
    });

    return items.sort((a, b) => {
        const idA = a.type === 'image' ? a.data.id : a.data.id;
        const idB = b.type === 'image' ? b.data.id : b.data.id;
        
        if (shuffleSeed > 0) return getDeterministicScore(idA, shuffleSeed) - getDeterministicScore(idB, shuffleSeed);
        
        const timeA = a.data.createdAt;
        const timeB = b.data.createdAt;
        
        return pinSort === 'newest' ? timeB - timeA : timeA - timeB;
    });
  }, [displayImages, allGroups, allImages, searchTerm, shuffleSeed, pinSort, activeView]);

  const pagedItems = useMemo(() => gridItems.slice(0, page * ITEMS_PER_PAGE), [gridItems, page]);
  const hasMore = pagedItems.length < gridItems.length;

  // --- ACTIONS ---

  const handleUploadComplete = (newImages: PinnedImage[]) => {
    setAllImages(prev => [...prev, ...newImages]);
    setIsUploadOpen(false);
    setDroppedFiles([]);
    showToast(`Successfully uploaded ${newImages.length} items`, 'success');
  };

  const handleUpdateImage = async (updatedImage: PinnedImage) => {
    try {
      await storage.updateImage(updatedImage);
      setAllImages(prev => prev.map(img => img.id === updatedImage.id ? updatedImage : img));
      showToast("Updated successfully", "success");
    } catch (err) { 
        console.error("Failed to update image", err); 
        showToast("Failed to update details", "error"); 
    }
  };

  const handleCreateBoard = async (name: string, description: string, visibility: Visibility) => {
    const user = currentUser;
    if (!user) return;
    try {
        const newBoard: Board = {
            id: generateId(),
            name,
            description,
            visibility,
            ownerId: user.id,
            createdAt: Date.now(),
            collectionIds: []
        };
        await storage.saveBoard(newBoard);
        setAllBoards(prev => [...prev, newBoard]);
        showToast(`Board "${name}" created`, 'success');

        // Check for bulk action context (if creating board from bulk modal)
        if (selectedIds.size > 0 && isSelectionMode) {
             const targetBoardId = newBoard.id;
             const newImagesToAdd: PinnedImage[] = [];
             const updatedImages = allImages.map(img => {
              if (selectedIds.has(img.id)) {
                if (img.ownerId === currentUser.id) {
                   if (!img.boardIds.includes(targetBoardId)) {
                     const updated = { ...img, boardIds: [...img.boardIds, targetBoardId] };
                     storage.saveImage(updated);
                     return updated;
                   }
                } else {
                   const newImage: PinnedImage = { ...img, id: generateId(), ownerId: currentUser.id, boardIds: [targetBoardId], isFavorite: false, likedBy: [], createdAt: Date.now(), sourceUrl: img.sourceUrl || img.url };
                   storage.saveImage(newImage);
                   newImagesToAdd.push(newImage);
                   return img;
                }
              }
              return img;
            });
            setAllImages([...updatedImages, ...newImagesToAdd]);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            setBulkAction(null);
            showToast(`${selectedIds.size} items added to ${name}`, 'success');
        }
    } catch (err) { 
        console.error("Error creating board:", err); 
        showToast("Failed to create board", "error"); 
    }
  };

  const handleCreateCollection = async (name: string) => {
    const user = currentUser;
    if (!user) return;
    try {
      const existingCollection = allCollections.find(c => c.ownerId === currentUser.id && c.name.toLowerCase() === name.trim().toLowerCase());
      if (existingCollection) { showToast(`Collection "${existingCollection.name}" already exists`, "error"); return; }
      const newCollection: Collection = { id: generateId(), name: name.trim(), ownerId: currentUser.id, createdAt: Date.now() };
      await storage.saveCollection(newCollection);
      setAllCollections(prev => [...prev, newCollection]);
      showToast(`Collection "${name}" created`, "success");
    } catch (err) { 
        console.error(err); 
        showToast("Failed to create collection", "error"); 
    }
  };

  const handleUpdateBoard = async (updates: Partial<Board>) => {
    if (!selectedBoardId) return;
    const board = allBoards.find(b => b.id === selectedBoardId);
    if (!board) return;
    const updatedBoard = { ...board, ...updates };
    try { 
        await storage.updateBoard(updatedBoard); 
        setAllBoards(prev => prev.map(b => b.id === selectedBoardId ? updatedBoard : b));
        showToast("Board updated", "success");
    } catch (err) { 
        console.error(err); 
        showToast("Failed to update board", "error"); 
    }
  };

  const handleSetGroupHero = async (groupId: string, imageId: string) => {
    const group = allGroups.find(g => g.id === groupId);
    if (!group) return;
    const newImageIds = [imageId, ...group.imageIds.filter(id => id !== imageId)];
    const updatedGroup = { ...group, imageIds: newImageIds };
    await storage.saveGroup(updatedGroup);
    setAllGroups(prev => prev.map(g => g.id === groupId ? updatedGroup : g));
    showToast("Group cover updated", "success");
  };

  const handleDeleteBoard = async () => {
    const boardId = selectedBoardId;
    if (!boardId) return;
    const board = allBoards.find(b => b.id === boardId);
    if (currentUser && board?.ownerId && board.ownerId !== currentUser.id) { showToast("You cannot delete this board.", "error"); return; }
    if (!confirm('Are you sure you want to delete this board? The tallos will remain in "All Tallos".')) return;
    try { 
        await storage.deleteBoard(boardId); 
        setAllBoards(prev => prev.filter(b => b.id !== boardId)); 
        const updatedImages = allImages.map(img => { 
            if (img.boardIds.includes(boardId)) { 
                const newBoardIds = img.boardIds.filter(id => id !== boardId); 
                const updatedImg = { ...img, boardIds: newBoardIds }; 
                storage.saveImage(updatedImg); 
                return updatedImg; 
            } 
            return img; 
        }); 
        setAllImages(updatedImages); 
        setSelectedBoardId(null); 
        setActiveView('boards'); 
        showToast("Board deleted", "success");
    } catch (err) { 
        console.error("Error deleting board:", err); 
        showToast("Failed to delete board", "error"); 
    }
  };

  const handleDeleteItem = async (id: string, isGroup?: boolean) => {
    if (isGroup) {
      const group = allGroups.find(g => g.id === id);
      if (currentUser && group?.ownerId && group.ownerId !== currentUser.id) { showToast("You cannot delete this group.", "error"); return; }
      if (confirm('Are you sure you want to delete this group? The tallos inside will remain in your library.')) { 
          await storage.deleteGroup(id); 
          setAllGroups(prev => prev.filter(g => g.id !== id)); 
          showToast("Group deleted", "success");
      }
    } else {
      const img = allImages.find(i => i.id === id);
      if (currentUser && img?.ownerId && img.ownerId !== currentUser.id) { showToast("You cannot delete this tallo.", "error"); return; }
      if (confirm('Are you sure you want to remove this tallo?')) { 
          await storage.deleteImage(id); 
          setAllImages(prev => prev.filter(img => img.id !== id)); 
          const updatedGroups = allGroups.map(g => { 
              if (g.imageIds.includes(id)) { 
                  const newIds = g.imageIds.filter(imgId => imgId !== id); 
                  const updatedG = { ...g, imageIds: newIds }; 
                  storage.saveGroup(updatedG); 
                  return updatedG; 
              } 
              return g; 
          }); 
          setAllGroups(updatedGroups); 
          if (selectedImageId === id) setSelectedImageId(null); 
          showToast("Tallo removed", "success");
      }
    }
  };

  const toggleSelectionMode = () => { if (!currentUser) return; setIsSelectionMode(!isSelectionMode); setSelectedIds(new Set()); setLastSelectedId(null); setBulkAction(null); };

  const handleSelectImage = (id: string, isShift?: boolean) => {
    const img = allImages.find(i => i.id === id);
    if (img && img.ownerId && currentUser && img.ownerId !== currentUser.id) return;
    let newSelected = new Set(selectedIds);
    if (isShift && lastSelectedId) {
      const visibleItems = getDisplayItems(); // Use helper to get current flat list
      const flatIds: string[] = [];
      visibleItems.forEach(item => { if (item.type === 'group') { flatIds.push(item.data.id); } else { flatIds.push(item.data.id); } });
      const startIdx = flatIds.indexOf(lastSelectedId);
      const endIdx = flatIds.indexOf(id);
      if (startIdx !== -1 && endIdx !== -1) { const min = Math.min(startIdx, endIdx); const max = Math.max(startIdx, endIdx); const range = flatIds.slice(min, max + 1); range.forEach(rid => newSelected.add(rid)); }
    } else { if (newSelected.has(id)) { newSelected.delete(id); } else { newSelected.add(id); } }
    setLastSelectedId(id);
    setSelectedIds(newSelected);
  };
  
  // Helper for shift-select
  const getDisplayItems = () => gridItems;

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Are you sure you want to delete ${selectedIds.size} items?`)) { 
        for (const id of selectedIds) { 
            const group = allGroups.find(g => g.id === id); 
            if (group) { await storage.deleteGroup(id); } else { await storage.deleteImage(id); } 
        } 
        setAllImages(prev => prev.filter(img => !selectedIds.has(img.id))); 
        setAllGroups(prev => prev.filter(g => !selectedIds.has(g.id))); 
        setSelectedIds(new Set()); 
        setIsSelectionMode(false); 
        showToast("Items deleted", "success");
    }
  };

  const executeBulkAction = async (data: any) => {
    if (!bulkAction || !currentUser) return;
    try {
        if (bulkAction === 'group') {
            const newGroup: PinGroup = { id: generateId(), title: data.groupName, imageIds: Array.from(selectedIds), createdAt: Date.now(), boardIds: [], ownerId: currentUser.id };
            await storage.saveGroup(newGroup); setAllGroups(prev => [newGroup, ...prev]);
        } else {
            const updatedImages = allImages.map(img => {
                if (selectedIds.has(img.id)) {
                let updated = { ...img };
                if (bulkAction === 'board') { if (!updated.boardIds.includes(data.boardId)) { updated.boardIds = [...updated.boardIds, data.boardId]; } } else if (bulkAction === 'tags') { const mergedTags = new Set([...updated.tags, ...data.tags]); updated.tags = Array.from(mergedTags); } else if (bulkAction === 'location') { updated.location = data.location; updated.latitude = data.latitude; updated.longitude = data.longitude; } else if (bulkAction === 'visibility') { updated.visibility = data.visibility; }
                storage.saveImage(updated); return updated;
                } return img;
            });
            setAllImages(updatedImages);
        }
        setBulkAction(null); setSelectedIds(new Set()); setIsSelectionMode(false);
        showToast("Bulk action completed", "success");
    } catch (e) {
        showToast("Action failed", "error");
    }
  };

  const handleBulkPinToBoard = async (boardId: string) => {
    if (selectedIds.size === 0) return;
    const updatedImages = allImages.map(img => { if (selectedIds.has(img.id)) { if (currentUser && img.ownerId && img.ownerId !== currentUser.id) return img; if (img.boardIds.includes(boardId)) return img; const boardIds = [...img.boardIds, boardId]; const updatedImg = { ...img, boardIds }; storage.saveImage(updatedImg); return updatedImg; } return img; });
    setAllImages(updatedImages); setSelectedIds(new Set()); setIsSelectionMode(false);
    showToast("Items added to board", "success");
  };

  const togglePinToBoard = async (imageId: string, boardId: string) => {
    if (!currentUser) return;

    // Handle Discovery Items
    if (imageId.startsWith('discovery-')) {
        const item = discoveryItems.find(i => i.id === imageId);
        if (item) {
             const newImage: PinnedImage = {
                ...item,
                id: generateId(),
                boardIds: [boardId],
                ownerId: currentUser.id,
                createdAt: Date.now(),
                tags: [...item.tags]
            };
            await storage.saveImage(newImage);
            setAllImages(prev => [newImage, ...prev]);
            showToast("Saved from discovery!", "success");
        }
        return;
    }

    const image = allImages.find(img => img.id === imageId); if (!image) return;
    if (currentUser && image.ownerId && image.ownerId !== currentUser.id) { 
        const newImage: PinnedImage = { ...image, id: generateId(), ownerId: currentUser.id, boardIds: [boardId], isFavorite: false, likedBy: [], createdAt: Date.now(), sourceUrl: image.sourceUrl || image.url }; 
        try { 
            await storage.saveImage(newImage); 
            setAllImages(prev => [newImage, ...prev]); 
            showToast("Saved copy to your board!", "success"); 
        } catch (err) { 
            console.error("Failed to copy tallo", err); 
            showToast("Failed to save copy", "error");
        } 
        return; 
    }
    const updatedImages = allImages.map(img => { if (img.id === imageId) { const boardIds = img.boardIds.includes(boardId) ? img.boardIds.filter(id => id !== boardId) : [...img.boardIds, boardId]; const updatedImg = { ...img, boardIds }; storage.saveImage(updatedImg); return updatedImg; } return img; }); setAllImages(updatedImages);
    
    // Check if added or removed to show appropriate toast
    const isNowPinned = updatedImages.find(i => i.id === imageId)?.boardIds.includes(boardId);
    if (isNowPinned) showToast("Saved to board", "success");
  };

  const handleAddDiscoverySource = async (url: string, name: string) => {
    if (!currentUser) return;
    try {
        const normalized = discoveryService.normalizeSourceUrl(url);
        const newSource: DiscoverySource = {
        id: generateId(),
        name: name.trim() || normalized.name,
        type: 'rss',
        feedUrl: normalized.url,
        enabled: true,
        ownerId: currentUser.id,
        createdAt: Date.now()
        };
        await storage.saveDiscoverySource(newSource);
        setDiscoverySources(prev => [...prev, newSource]);
        showToast("Feed added successfully", "success");
    } catch (e) {
        showToast("Failed to add feed", "error");
    }
  };

  const handleRemoveDiscoverySource = async (id: string) => {
    try {
        await storage.deleteDiscoverySource(id);
        setDiscoverySources(prev => prev.filter(s => s.id !== id));
        showToast("Feed removed", "info");
    } catch (e) {
        showToast("Failed to remove feed", "error");
    }
  };

  const handleToggleFavorite = async (imageId: string) => {
    if (!currentUser) return;

    // Handle Discovery Items
    if (imageId.startsWith('discovery-')) {
        const item = discoveryItems.find(i => i.id === imageId);
        if (item && !item.isFavorite) {
            // Persist as new favorite
             const newImage: PinnedImage = {
                ...item,
                id: generateId(),
                boardIds: [],
                ownerId: currentUser.id,
                createdAt: Date.now(),
                tags: [...item.tags],
                isFavorite: true
            };
            await storage.saveImage(newImage);
            setAllImages(prev => [newImage, ...prev]);
            
            setDiscoveryItems(prev => prev.map(i => 
                i.id === imageId ? { ...i, isFavorite: true } : i
            ));
            showToast("Added to favorites", "success");
        }
        return;
    }
    const image = allImages.find(i => i.id === imageId);
    if (!image) return;
    if (image.ownerId !== currentUser.id) {
       let likedBy = image.likedBy || [];
       if (likedBy.includes(currentUser.id)) likedBy = likedBy.filter(id => id !== currentUser.id);
       else likedBy = [...likedBy, currentUser.id];
       const updated = { ...image, likedBy };
       await storage.updateImage(updated);
       setAllImages(prev => prev.map(img => img.id === imageId ? updated : img));
    } else {
       const updated = { ...image, isFavorite: !image.isFavorite };
       await storage.saveImage(updated);
       setAllImages(prev => prev.map(img => img.id === imageId ? updated : img));
    }
  };

  // --- RENDER ---
  
  if (isAuthChecking) return <div className="flex h-screen items-center justify-center bg-black text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-rose-500"></div></div>;

  return (
    <div className="flex h-screen w-full bg-black text-slate-100 overflow-hidden" 
         onDragOver={handleDragOver} 
         onDragLeave={handleDragLeave}
         onDrop={handleDrop}>
      
      <Sidebar 
        activeView={activeView} setActiveView={setActiveView} 
        boards={displayBoards} collections={displayCollections}
        selectedBoardId={selectedBoardId} selectedCollectionId={selectedCollectionId}
        setSelectedBoardId={setSelectedBoardId} setSelectedCollectionId={setSelectedCollectionId}
        onOpenCreateBoard={() => setIsCreateBoardOpen(true)} onOpenCreateCollection={() => setIsCreateCollectionOpen(true)}
        isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)}
        boardLastUpdated={boardLastUpdated} collectionLastUpdated={collectionLastUpdated}
        isReadOnly={!currentUser} selectedImageIds={selectedIds}
        onDropImageToBoard={togglePinToBoard} onMoveBoardToCollection={() => {}}
        onOpenSettings={() => setIsSettingsOpen(true)} onClearSearch={() => setSearchTerm('')}
        onBulkPinToBoard={handleBulkPinToBoard}
      />

      <main className="flex-1 flex flex-col h-full min-w-0 bg-black relative">
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-4 md:px-8 gap-4 flex-shrink-0 z-20 bg-black/80 backdrop-blur-md">
          <div className="flex items-center gap-4 flex-1">
            <button className="md:hidden text-slate-400" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <div className={`relative flex-1 max-w-md group ${isMobileSearchOpen ? 'block absolute left-0 right-0 top-0 h-16 bg-slate-900 z-50 px-4 flex items-center' : 'hidden md:block'}`}>
               {isMobileSearchOpen && (
                  <button onClick={() => setIsMobileSearchOpen(false)} className="mr-3 text-slate-400">
                     <ArrowLeft className="w-5 h-5" />
                  </button>
               )}
               <Search className="absolute left-3 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
               <input 
                  type="text" 
                  placeholder="Search..." 
                  className="w-full bg-slate-900 md:bg-slate-900 border border-slate-800 rounded-full pl-10 pr-4 py-2 text-sm text-slate-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  autoFocus={isMobileSearchOpen}
               />
               {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
             {currentUser ? (
              <>
                <button onClick={() => setIsMobileSearchOpen(true)} className="md:hidden text-slate-400 p-2">
                    <Search className="w-5 h-5" />
                </button>
                 {!isSelectionMode ? (
                  <button 
                    onClick={toggleSelectionMode}
                    className="p-2 text-slate-500 hover:text-slate-200 hover:bg-slate-900 rounded-full transition-colors"
                    title="Select Multiple"
                  >
                    <CheckSquare className="w-5 h-5" />
                  </button>
                 ) : (
                   <div className="flex items-center gap-2 animate-in slide-in-from-right-4 fade-in">
                      <span className="text-sm font-bold text-rose-500 mr-2">{selectedIds.size} Selected</span>
                      <button 
                        onClick={() => setBulkAction('board')}
                        disabled={selectedIds.size === 0}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 rounded-full transition-colors disabled:opacity-30"
                        title="Add to Board"
                      >
                        <FolderPlus className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setBulkAction('tags')}
                        disabled={selectedIds.size === 0}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 rounded-full transition-colors disabled:opacity-30"
                        title="Add Tags"
                      >
                        <Hash className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setBulkAction('location')}
                        disabled={selectedIds.size === 0}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 rounded-full transition-colors disabled:opacity-30"
                        title="Set Location"
                      >
                        <MapPin className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setBulkAction('group')}
                        disabled={selectedIds.size === 0}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 rounded-full transition-colors disabled:opacity-30"
                        title="Group Items"
                      >
                        <Layers className="w-5 h-5" />
                      </button>
                       <button 
                        onClick={() => setBulkAction('visibility')}
                        disabled={selectedIds.size === 0}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-950/30 rounded-full transition-colors disabled:opacity-30"
                        title="Set Visibility"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button 
                         onClick={handleBulkDelete}
                         disabled={selectedIds.size === 0}
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-950/30 rounded-full transition-colors disabled:opacity-30"
                         title="Delete Selected"
                      >
                         <Trash2 className="w-5 h-5" />
                      </button>
                      <button onClick={toggleSelectionMode} className="ml-2 text-xs font-bold text-slate-500 hover:text-slate-300">Cancel</button>
                   </div>
                 )}
                 <button 
                  onClick={() => setIsUploadOpen(true)}
                  className="bg-rose-600 hover:bg-rose-500 text-white p-2 rounded-full transition-all shadow-lg shadow-rose-900/40 hover:scale-105 active:scale-95"
                  title="Upload New Tallo"
                >
                  <Plus className="w-5 h-5" />
                </button>
                <UserMenu user={currentUser} onLogout={handleLogout} />
              </>
             ) : (
               <button 
                 onClick={() => setShowLoginModal(true)}
                 className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
               >
                 Log In
               </button>
             )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 relative pb-24 md:pb-8">
          {isLoading ? (
             <div className="flex h-full items-center justify-center">
               <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-rose-500"></div>
             </div>
          ) : (
            <>
              {activeView === 'board-detail' && selectedBoardId ? (
                <BoardView 
                    board={allBoards.find(b => b.id === selectedBoardId)!}
                    collection={undefined} allCollections={displayCollections}
                    images={displayImages} groups={[]} 
                    onBack={clearParams} 
                    onDeleteImage={handleDeleteItem}
                    boards={displayBoards} 
                    onTogglePin={togglePinToBoard}
                    onDeleteBoard={handleDeleteBoard}
                    onUpdate={handleUpdateImage}
                    onUpdateBoard={handleUpdateBoard}
                    onImageClick={setSelectedImageId} 
                    onToggleFavorite={handleToggleFavorite}
                    isOwner={true}
                    isSelectionMode={isSelectionMode} selectedIds={selectedIds}
                    onSelect={(id) => { const newSet = new Set(selectedIds); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); setSelectedIds(newSet); }}
                />
            ) : activeView === 'collection-detail' && selectedCollectionId ? (
                 <div className="h-full">
                    <div className="flex items-center gap-2 mb-6">
                      <button onClick={clearParams} className="p-1 hover:bg-slate-800 rounded-full"><ArrowUpDown className="rotate-90 w-5 h-5" /></button>
                      <h1 className="text-3xl font-black text-slate-100">{allCollections.find(c => c.id === selectedCollectionId)?.name}</h1>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {displayBoards.filter(b => b.collectionIds.includes(selectedCollectionId)).map(board => {
                             const coverImg = allImages.find(i => i.id === board.coverImageId) || allImages.find(i => i.boardIds.includes(board.id));
                             return (
                                <div 
                                  key={board.id} 
                                  onClick={() => { setSelectedBoardId(board.id); }}
                                  className="group cursor-pointer bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-600 transition-all hover:shadow-xl"
                                >
                                    <div className="aspect-video bg-slate-950 relative overflow-hidden">
                                        {coverImg ? (
                                            <img src={coverImg.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-700">
                                                <Folder className="w-12 h-12 opacity-20" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="font-bold text-slate-200 group-hover:text-rose-500 transition-colors">{board.name}</h3>
                                        <p className="text-xs text-slate-500 mt-1">{allImages.filter(i => i.boardIds.includes(board.id)).length} items</p>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                 </div>
            ) : activeView === 'discovery' ? (
                <DiscoveryView 
                    sources={discoverySources} items={discoveryItems} isLoading={isDiscoveryLoading} onRefresh={refreshDiscoveryFeed}
                    onAddSource={handleAddDiscoverySource} onRemoveSource={handleRemoveDiscoverySource}
                    boards={displayBoards} onPinToBoard={togglePinToBoard} onToggleFavorite={handleToggleFavorite}
                />
              ) : (
                <div className="h-full flex flex-col">
                   <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 md:gap-0 flex-shrink-0">
                      <div className="min-w-0 max-w-full">
                        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2 leading-tight">
                           {activeView === 'favorites' && <Heart className="w-6 h-6 text-rose-500 fill-rose-500 flex-shrink-0" />}
                           {activeView === 'community' && <Users className="w-6 h-6 text-blue-500 flex-shrink-0" />}
                           {activeView === 'all' && <LayoutGrid className="w-6 h-6 text-rose-500 flex-shrink-0" />}
                           
                           <span className="break-words line-clamp-2">
                             {activeView === 'all' ? 'My Tallos' : activeView === 'favorites' ? 'Favorites' : 'Community'}
                           </span>
                        </h1>
                        {searchTerm && <p className="text-slate-500 text-sm mt-1 truncate">Searching for "{searchTerm}"</p>}
                      </div>
                      
                      <div className="flex items-center gap-3 self-start md:self-auto overflow-x-auto max-w-full pb-1 md:pb-0 scrollbar-hide">
                        <button
                           onClick={() => setShuffleSeed(Math.random())}
                           className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-md text-xs font-medium text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-colors flex-shrink-0"
                           title="Shuffle View"
                        >
                           <Shuffle className="w-3 h-3" />
                           <span className="hidden sm:inline">Shuffle</span>
                        </button>
                        
                        <div className="flex-shrink-0">
                          <SortDropdown 
                             value={pinSort}
                             onChange={handlePinSortChange}
                             options={[
                               { label: 'Newest First', value: 'newest' },
                               { label: 'Oldest First', value: 'oldest' }
                             ]}
                          />
                        </div>

                        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800 flex-shrink-0">
                          <button
                            onClick={() => setMainViewMode('grid')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                              mainViewMode === 'grid' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="hidden sm:inline">Grid</span>
                          </button>
                          <button
                            onClick={() => setMainViewMode('map')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-2 transition-colors ${
                              mainViewMode === 'map' ? 'bg-slate-800 text-rose-500 shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <MapIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Map</span>
                          </button>
                        </div>
                      </div>
                   </div>

                   <div className="flex-1 min-h-0">
                      {mainViewMode === 'grid' ? (
                        <>
                          {/* TrendingBar Removed for stability */}
                          <MasonryGrid 
                            items={pagedItems}
                            onDelete={handleDeleteItem}
                            boards={displayBoards}
                            onTogglePin={togglePinToBoard}
                            onUpdate={handleUpdateImage}
                            onImageClick={setSelectedImageId}
                            onToggleFavorite={handleToggleFavorite}
                            isSelectionMode={isSelectionMode}
                            selectedIds={selectedIds}
                            onSelect={handleSelectImage}
                            onLoadMore={() => setPage(p => p + 1)}
                            hasMore={hasMore}
                          />
                        </>
                      ) : (
                        <MapView images={displayImages} onImageClick={setSelectedImageId} />
                      )}
                   </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Mobile Nav removed for stability */}

      {/* Render Toast Container */}
      {toast && (
        <SimpleToast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
        />
      )}

      {showLoginModal && (
        <LoginScreen 
          onLogin={handleLogin} 
          onGuestAccess={handleGuestAccess} 
        />
      )}

      {isDraggingFile && (
        <div className="fixed inset-0 z-[100] bg-rose-500/90 backdrop-blur-sm flex items-center justify-center pointer-events-none animate-in fade-in duration-200">
          <div className="text-white text-center">
            {/* Upload Icon */}
            <h2 className="text-4xl font-black">Drop to Upload</h2>
          </div>
        </div>
      )}

      {selectedImageId && (
        <ImageDetailModal 
          image={allImages.find(i => i.id === selectedImageId) || discoveryItems.find(i => i.id === selectedImageId) || { id: '0', url: '', title: '', description: '', tags: [], boardIds: [], createdAt: 0, ownerId: '', visibility: 'private' }}
          boards={displayBoards}
          onClose={() => setSelectedImageId(null)}
          onTogglePin={togglePinToBoard}
          onUpdate={handleUpdateImage}
          onToggleFavorite={handleToggleFavorite}
          groupImages={
             activeView === 'board-detail' 
               ? displayImages 
               : activeView === 'discovery' 
                 ? discoveryItems 
                 : allGroups.find(g => g.imageIds.includes(selectedImageId))?.imageIds.map(id => allImages.find(i => i.id === id)!)
          }
          onSelectImage={setSelectedImageId}
          onSetHero={(id) => {
             const grp = allGroups.find(g => g.imageIds.includes(selectedImageId));
             if (grp) handleSetGroupHero(grp.id, id);
          }}
        />
      )}

      {isUploadOpen && currentUser && (
        <UploadModal 
            onClose={() => { setIsUploadOpen(false); setDroppedFiles([]); }} 
            onUpload={handleUploadComplete} 
            ownerId={currentUser.id} 
            boards={displayBoards} 
            initialBoardId={selectedBoardId}
            onCreateBoard={() => setIsCreateBoardOpen(true)}
            initialFiles={droppedFiles} 
        />
      )}
      
      {isCreateBoardOpen && (
        <CreateBoardModal 
            onClose={() => setIsCreateBoardOpen(false)} 
            onCreate={handleCreateBoard}
        />
      )}
      
      {isCreateCollectionOpen && (
        <CreateCollectionModal 
          onClose={() => setIsCreateCollectionOpen(false)}
          onCreate={handleCreateCollection}
        />
      )}

      {bulkAction && (
        <BulkActionModal 
          action={bulkAction} 
          count={selectedIds.size} 
          onClose={() => setBulkAction(null)} 
          onSubmit={executeBulkAction}
          boards={displayBoards}
          onCreateBoard={() => setIsCreateBoardOpen(true)}
        />
      )}
      
      {isSettingsOpen && (
        <SettingsModal 
           onClose={() => setIsSettingsOpen(false)} 
           onDataImported={() => {
              loadData();
              showToast("Data imported successfully", "success");
           }}
        />
      )}
      <DebugTools />
    </div>
  );
};

// --- APP ROOT ---
const App: React.FC = () => {
  return (
    <AppContent />
  );
};

export default App;