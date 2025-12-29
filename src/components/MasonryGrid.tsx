import React, { useState, useEffect, useRef } from 'react';
import { PinnedImage, Board, GridItem, PinGroup, User } from '../../shared/types';
import { Trash2, ChevronsUp, Info, Heart, Check, Circle, Layers, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';
import { authService } from '../services/authService';

interface MasonryGridProps {
  items: GridItem[];
  onDelete: (id: string, isGroup?: boolean) => void;
  boards: Board[];
  onTogglePin: (imageId: string, boardId: string) => void;
  onUpdate: (image: PinnedImage) => void;
  onImageClick: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelect?: (id: string, isShift?: boolean) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

const getFaviconUrl = (urlString: string) => {
  try {
    const url = new URL(urlString);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch (e) {
    return null;
  }
};

// --- GROUP CARD COMPONENT ---
const GroupCard: React.FC<{
  group: PinGroup;
  images: PinnedImage[];
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (isShift?: boolean) => void;
  onDelete: () => void;
  onImageClick: (id: string) => void;
  isMobile: boolean;
}> = ({ group, images, isSelectionMode, isSelected, onSelect, onDelete, onImageClick, isMobile }) => {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onSelect(e.shiftKey);
    } else {
      if (images.length > 0) onImageClick(images[0].id);
    }
  };

  if (images.length === 0) return null;

  const activeImage = images[activeIndex];
  const heroImage = images[0]; 

  const activeImageUrl = activeImage.mediaType === 'video' && activeImage.thumbnailUrl ? activeImage.thumbnailUrl : activeImage.url;
  const heroImageUrl = heroImage.mediaType === 'video' && heroImage.thumbnailUrl ? heroImage.thumbnailUrl : heroImage.url;

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev + 1) % images.length);
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className="group relative w-full masonry-item">
      <div 
        className={`relative rounded-2xl overflow-hidden bg-slate-900 border shadow-sm transition-all duration-300 ${
          isSelectionMode 
            ? 'cursor-pointer hover:border-slate-500' 
            : 'hover:shadow-xl hover:-translate-y-1 cursor-zoom-in hover:border-slate-700'
        } ${
          isSelected 
            ? 'ring-4 ring-rose-500 border-rose-500' 
            : 'border-slate-800'
        }`}
        onClick={handleClick}
        draggable={!isMobile} 
        style={{ 
            touchAction: 'pan-y',       // FIX: Force vertical scroll
            WebkitUserDrag: 'none',     // FIX: Stop iOS/Android drag ghost
            userSelect: 'none',         // FIX: Stop selection highlighting
            WebkitTouchCallout: 'none'  // FIX: Stop iOS Magnifier
        }}
      >
        <div className="relative">
           <div className="absolute top-0 left-0 right-0 h-full bg-slate-800 rounded-2xl transform translate-x-1 -translate-y-1 -z-10 border border-slate-700"></div>
           <div className="absolute top-0 left-0 right-0 h-full bg-slate-800 rounded-2xl transform translate-x-2 -translate-y-2 -z-20 border border-slate-700 opacity-50"></div>

          <img 
            src={heroImageUrl} 
            alt="spacer" 
            className="w-full h-auto block opacity-0 pointer-events-none"
            aria-hidden="true"
          />

          <img 
            src={activeImageUrl} 
            alt={group.title} 
            className={`absolute inset-0 w-full h-full object-cover transform transition-transform duration-500 ${
              !isSelectionMode ? 'group-hover:scale-105' : ''
            } ${isSelected ? 'opacity-80' : ''}`}
          />

          {activeImage.mediaType === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:bg-rose-600 group-hover:border-rose-500 transition-colors">
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
            </div>
          )}

          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-slate-200 text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 border border-slate-700 z-10">
            <Layers className="w-3 h-3" />
            {images.length}
          </div>

          {!isSelectionMode && !isMobile && images.length > 1 && (
            <>
              <button 
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                {images.slice(0, 5).map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`w-1.5 h-1.5 rounded-full shadow-sm ${idx === activeIndex ? 'bg-white' : 'bg-white/40'}`}
                  ></div>
                ))}
                {images.length > 5 && <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>}
              </div>
            </>
          )}
        </div>

        <div className={`absolute top-2 right-2 z-20 transition-all duration-200 ${isSelected || isSelectionMode ? 'scale-100 opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {isSelected ? (
              <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center shadow-md border-2 border-white scale-110">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
              </div>
            ) : (
              <div 
                onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-sm border-2 border-white/50 rounded-full p-0.5 shadow-sm cursor-pointer"
              >
                <Circle className="w-5 h-5 text-transparent" />
              </div>
            )}
        </div>

        {!isSelectionMode && !isMobile && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
             <div className="flex justify-between items-end">
                <div className="text-white">
                  <h3 className="font-bold text-sm truncate">{group.title}</h3>
                  <p className="text-[10px] text-slate-300">{images.length} items</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-2 bg-white/10 hover:bg-red-600 backdrop-blur-md rounded-full text-white transition-colors"
                  title="Delete Group"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
          </div>
        )}
      </div>
      <div className="mt-2 px-1 flex items-start justify-between text-xs text-slate-500">
        <span className="line-clamp-2 font-medium text-rose-400 leading-tight flex-1 pr-2">{group.title}</span>
      </div>
    </div>
  );
};

// --- MASONRY ITEM COMPONENT ---
const MasonryItem: React.FC<{
  img: PinnedImage;
  isSelectionMode: boolean;
  isSelected: boolean;
  onSelect: (isShift?: boolean) => void;
  onImageClick: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  currentUser: User | null;
  ownerName: string;
  isLiked: boolean;
  faviconUrl: string | null;
  likeCount: number;
  isMobile: boolean;
  handleDragStart: (e: React.DragEvent) => void;
}> = ({ img, isSelectionMode, isSelected, onSelect, onImageClick, onToggleFavorite, onDelete, currentUser, ownerName, isLiked, faviconUrl, likeCount, isMobile, handleDragStart }) => {
  
  const displayUrl = (img.mediaType === 'video' && img.thumbnailUrl) ? img.thumbnailUrl : (img.thumbnailUrl || img.url);
  const isOwner = currentUser && img.ownerId === currentUser.id;
  
  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode) {
        e.preventDefault();
        e.stopPropagation();
        onSelect(e.shiftKey);
    } else {
        onImageClick();
    }
  };

  return (
    <div className="group relative w-full masonry-item">
        <div 
        className={`relative rounded-2xl overflow-hidden bg-slate-900 border shadow-sm transition-all duration-300 ${
            isSelectionMode 
            ? 'cursor-pointer hover:border-slate-500' 
            : 'hover:shadow-xl hover:-translate-y-1 cursor-zoom-in hover:border-slate-700'
        } ${
            isSelected 
            ? 'ring-4 ring-rose-500 border-rose-500' 
            : 'border-slate-800'
        }`}
        onClick={handleClick}
        draggable={!isMobile}
        onDragStart={handleDragStart}
        style={{ 
            touchAction: 'pan-y',       // FIX: Force vertical scroll
            WebkitUserDrag: 'none',     // FIX: Stop iOS/Android drag ghost
            userSelect: 'none',         // FIX: Stop selection highlighting
            WebkitTouchCallout: 'none'  // FIX: Stop iOS Magnifier
        }}
        >
        <img 
            src={displayUrl} 
            alt={img.title} 
            className={`w-full h-auto block transform transition-transform duration-500 ${
            !isSelectionMode ? 'group-hover:scale-105' : ''
            } ${isSelected ? 'opacity-80' : ''}`}
            loading="lazy"
        />

        {img.mediaType === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:bg-rose-600 group-hover:border-rose-500 transition-colors">
                    <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </div>
            </div>
        )}
        
        <div className={`absolute top-2 right-2 z-20 transition-all duration-200 ${isSelected || isSelectionMode ? 'scale-100 opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {isSelected ? (
            <div className="w-6 h-6 rounded-full bg-rose-600 flex items-center justify-center shadow-md border-2 border-white scale-110">
                <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
            </div>
            ) : (
            <div 
                onClick={(e) => { e.stopPropagation(); onSelect(e.shiftKey); }}
                className="bg-black/40 hover:bg-black/60 backdrop-blur-sm border-2 border-white/50 rounded-full p-0.5 shadow-sm cursor-pointer"
            >
                <Circle className="w-5 h-5 text-transparent" />
            </div>
            )}
        </div>

        {!isSelectionMode && !isMobile && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-4 pointer-events-none">
            <div className="flex justify-end gap-2 pointer-events-auto">
                {isOwner && (
                <button 
                    onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite();
                    }}
                    className={`p-2 backdrop-blur-md rounded-full transition-colors ${
                    img.isFavorite 
                        ? 'bg-rose-600 text-white' 
                        : 'bg-white/10 hover:bg-white/20 text-white hover:text-rose-500'
                    }`}
                >
                    <Heart className={`w-4 h-4 ${img.isFavorite ? 'fill-current' : ''}`} />
                </button>
                )}
                {!isOwner && (
                <button 
                    onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(); 
                    }}
                    className={`p-2 backdrop-blur-md rounded-full transition-colors ${
                    isLiked
                        ? 'bg-rose-600 text-white' 
                        : 'bg-white/10 hover:bg-white/20 text-white hover:text-rose-500'
                    }`}
                >
                    <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
                )}

                {isOwner && (
                <button 
                    onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                    }}
                    className="p-2 bg-white/10 hover:bg-red-600 backdrop-blur-md rounded-full text-white transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                )}
            </div>
            
            <div className="space-y-2">
                <div className="flex items-center gap-2 mb-1">
                {faviconUrl ? (
                    <img src={faviconUrl} alt="Source" className="w-5 h-5 rounded-full bg-white/90 p-0.5" />
                ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-900 flex items-center justify-center text-[10px] font-bold">
                    {ownerName.substring(0, 2).toUpperCase()}
                    </div>
                )}
                <span className="text-white/80 text-xs font-medium truncate">
                    {faviconUrl ? (new URL(img.sourceUrl!).hostname.replace('www.', '')) : ownerName}
                </span>
                </div>
                <h3 className="text-white font-medium truncate text-sm">{img.title}</h3>
                <div className="flex flex-wrap gap-1">
                {img.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-[10px] bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">
                    {tag}
                    </span>
                ))}
                </div>
            </div>
            </div>
        )}
        </div>
        
        <div className="mt-2 px-1 flex items-start justify-between text-xs text-slate-500">
        <span className="line-clamp-2 leading-tight group-hover:text-slate-300 transition-colors flex-1 pr-2">
            {img.title || 'Untitled'}
        </span>
        {!isSelectionMode && (
            <div className="flex gap-3 items-center shrink-0 pt-0.5">
            {likeCount > 0 && (
                <span className="flex items-center gap-1 text-slate-400 group-hover:text-rose-400 transition-colors">
                    <Heart className="w-3 h-3 fill-current" />
                    {likeCount}
                </span>
            )}
            <span className="flex items-center gap-1">
                <ChevronsUp className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                {img.boardIds.length}
            </span>
            </div>
        )}
        </div>
    </div>
  );
};

const MasonryGrid: React.FC<MasonryGridProps> = ({ 
  items, onDelete, boards, onTogglePin, onUpdate, onImageClick, onToggleFavorite,
  isSelectionMode = false, selectedIds = new Set(), onSelect, onLoadMore, hasMore
}) => {
  const [columnCount, setColumnCount] = useState(2);
  const [users, setUsers] = useState<User[]>([]); 
  const currentUser = authService.getCurrentUser();
  const observerTarget = useRef(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const fetchedUsers = await authService.getUsers();
        if (Array.isArray(fetchedUsers)) {
          setUsers(fetchedUsers);
        }
      } catch (error) {
        console.error("Failed to load users for grid:", error);
      }
    };
    fetchUsers();
  }, []);

  const getOwnerName = (ownerId: string) => {
    const user = users.find(u => u.id === ownerId);
    return user ? user.username : 'Unknown';
  };

  useEffect(() => {
    const updateLayout = () => {
      const width = window.innerWidth;
      if (width >= 1280) setColumnCount(4); 
      else if (width >= 1024) setColumnCount(4);
      else if (width >= 768) setColumnCount(3);
      else setColumnCount(1); // Mobile: 1 column
      setIsMobile(width < 768);
    };

    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  useEffect(() => {
    if (!onLoadMore) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore) onLoadMore(); },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => { if (observerTarget.current) observer.unobserve(observerTarget.current); };
  }, [onLoadMore, hasMore]);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, imageId: string) => {
    if (isMobile) { e.preventDefault(); return; }
    e.dataTransfer.setData('imageId', imageId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
          <Info className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium text-slate-400">No tallos found</p>
        <p className="text-sm">Start uploading images to create your board.</p>
      </div>
    );
  }

  const columns: GridItem[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((item, index) => {
    columns[index % columnCount].push(item);
  });

  return (
    <>
      <div className="flex gap-5 w-full items-start">
        {columns.map((colItems, colIndex) => (
          <div key={colIndex} className="flex-1 flex flex-col gap-5 min-w-0">
            {colItems.map((item) => {
              if (item.type === 'group') {
                return (
                  <GroupCard 
                    key={item.data.id}
                    group={item.data}
                    images={item.images}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(item.data.id)}
                    onSelect={(isShift) => onSelect && onSelect(item.data.id, isShift)}
                    onDelete={() => onDelete(item.data.id, true)}
                    onImageClick={onImageClick}
                    isMobile={isMobile}
                  />
                );
              }

              const img = item.data;
              const isDiscoveryItem = img.id.startsWith('discovery-');
              const isLiked = (currentUser && (img.likedBy || []).includes(currentUser.id)) || (isDiscoveryItem && img.isFavorite);
              const likeCount = (img.likedBy || []).length;

              return (
                <MasonryItem 
                    key={img.id}
                    img={img}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedIds.has(img.id)}
                    onSelect={(isShift) => onSelect && onSelect(img.id, isShift)}
                    onImageClick={() => onImageClick(img.id)}
                    onToggleFavorite={() => onToggleFavorite(img.id)}
                    onDelete={() => onDelete(img.id, false)}
                    currentUser={currentUser}
                    ownerName={getOwnerName(img.ownerId)}
                    isLiked={isLiked}
                    faviconUrl={img.sourceUrl ? getFaviconUrl(img.sourceUrl) : null}
                    likeCount={likeCount}
                    isMobile={isMobile}
                    handleDragStart={(e) => handleDragStart(e, img.id)}
                />
              );
            })}
          </div>
        ))}
      </div>
      {hasMore && (
        <div ref={observerTarget} className="py-8 flex justify-center w-full">
          <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
        </div>
      )}
    </>
  );
};

export default MasonryGrid;