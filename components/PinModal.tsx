import React, { useState, useRef, useEffect } from 'react';
import { Pin, Board, Collection, LocationData } from '../types';
import { X, MapPin, Layers, Trash2, Heart, ChevronLeft, ChevronRight, Calendar, Tag as TagIcon, Plus, Check, Image as ImageIcon, Link as LinkIcon, ExternalLink, Share2, PanelRightClose, PanelRightOpen, Split } from 'lucide-react';
import { dataService } from '../services/dataService';

declare const L: any;

interface PinModalProps {
  pin: Pin | null;
  onClose: () => void;
  collections: Collection[];
  boards: Board[];
  onUpdate: () => void;
  onDelete: (pin: Pin) => void;
  pinList: Pin[];
  onNavigate: (pin: Pin) => void;
}

export const PinModal: React.FC<PinModalProps> = ({ pin, onClose, collections, boards, onUpdate, onDelete, pinList, onNavigate }) => {
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [showInfo, setShowInfo] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [link, setLink] = useState('');
  
  const [isAddingBoard, setIsAddingBoard] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [viewingUrl, setViewingUrl] = useState('');
  
  // FIX: Local state for immediate cover button feedback
  const [activeHeroUrl, setActiveHeroUrl] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [locationResults, setLocationResults] = useState<LocationData[]>([]);

  const touchStartRef = useRef<number | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const prevPinId = useRef<string | null>(null);

  useEffect(() => {
    if (pin) {
        if (prevPinId.current !== pin.id) {
            setTitle(pin.title);
            setDescription(pin.description);
            setTags(pin.tags || []);
            setSelectedBoardIds(pin.boardIds || []);
            setLink(pin.link || '');
            setIsFavorite(pin.favorite);
            
            setIsEditingLocation(false);
            setSearchQuery('');
            setLocationResults([]);
            
            // Set viewing AND active hero state
            setViewingUrl(pin.imageUrl);
            setActiveHeroUrl(pin.imageUrl);
            
            setIsDrawerOpen(false);
            setIsAddingBoard(false);
            
            prevPinId.current = pin.id;
        }
    }
  }, [pin]);

  useEffect(() => {
    if (!pin) return;
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowLeft') handlePrev();
        if (e.key === 'ArrowRight') handleNext();
        if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, pinList]);

  useEffect(() => {
    if (!pin) return;
    if (isEditingLocation && mapContainer.current) {
       if (mapInstance.current) {
         mapInstance.current.off();
         mapInstance.current.remove();
         mapInstance.current = null;
       }
       const lat = pin.location?.lat || 38.2527; 
       const lng = pin.location?.lng || -85.7585;
       const map = L.map(mapContainer.current).setView([lat, lng], 13);
       mapInstance.current = map;
       L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
         attribution: '© CARTO',
         subdomains: 'abcd',
         maxZoom: 19
       }).addTo(map);
       if (pin.location) L.marker([pin.location.lat, pin.location.lng]).addTo(map);
       setTimeout(() => { map.invalidateSize(); }, 100);
    }
  }, [isEditingLocation, pin]);

  if (!pin) return null;

  const currentIndex = pinList.findIndex(p => p.id === pin.id);
  const hasNext = currentIndex < pinList.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = () => { handleSave(false); if (hasNext) onNavigate(pinList[currentIndex + 1]); };
  const handlePrev = () => { handleSave(false); if (hasPrev) onNavigate(pinList[currentIndex - 1]); };

  const getAllImages = () => [pin.imageUrl, ...(pin.gallery || [])];
  const galleryImages = getAllImages();
  
  // FIX: Helper for cycling images (Used by Click and Touch)
  const cycleImage = (direction: 'next' | 'prev') => {
      const images = getAllImages();
      const idx = images.indexOf(viewingUrl);
      if (idx === -1) return;

      let newIdx;
      if (direction === 'next') {
          newIdx = (idx + 1) % images.length;
      } else {
          newIdx = (idx - 1 + images.length) % images.length;
      }
      setViewingUrl(images[newIdx]);
  };

  const handleNextImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      cycleImage('next');
  };

  const handlePrevImage = (e: React.MouseEvent) => {
      e.stopPropagation();
      cycleImage('prev');
  };

  // FIX: Updated Touch Handler for Mobile Gallery
  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    
    if (Math.abs(diff) > 50) { // Threshold
        if (galleryImages.length > 1) {
            // Priority: Cycle Images within the gallery
            if (diff > 0) cycleImage('next'); // Swipe Left -> Next Image
            else cycleImage('prev');          // Swipe Right -> Prev Image
        } else {
            // Fallback: Cycle through Pins if it's a single image
            if (diff > 0) handleNext();
            else handlePrev();
        }
    }
    touchStartRef.current = null;
  };

  const handleSave = async (shouldRefresh = true) => {
     const sanitizedLink = dataService.sanitizeUrl(link);
     await dataService.updatePin(pin.id, { 
         title, description, tags, boardIds: selectedBoardIds, link: sanitizedLink 
     });
     if (shouldRefresh) onUpdate();
  };
  
  const handleClose = () => { 
      handleSave(false); 
      onClose(); 
  };

  const handleDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onDelete(pin);
  };

  const handleUngroup = async () => {
      if (confirm("Ungroup these photos? They will become separate stems.")) {
          await dataService.ungroupPin(pin.id);
          onUpdate();
          onClose(); 
      }
  };

  const handleShare = () => {
     const url = `${window.location.origin}?pinId=${pin.id}`;
     navigator.clipboard.writeText(url);
     setIsCopying(true);
     setTimeout(() => setIsCopying(false), 2000);
  };

  const handleToggleFavorite = async () => {
      setIsFavorite(!isFavorite);
      await dataService.toggleFavorite(pin.id);
  };

  // FIX: Updated to use local state for instant feedback
  const handleSetAsCover = async () => {
      if (viewingUrl === activeHeroUrl) return;
      
      const oldHero = activeHeroUrl; 
      const newHero = viewingUrl;
      
      // Update local state IMMEDIATELY
      setActiveHeroUrl(newHero);

      const currentGallery = pin.gallery || [];
      const newGallery = currentGallery.filter(url => url !== newHero);
      newGallery.push(oldHero);
      
      await dataService.updatePin(pin.id, { imageUrl: newHero, gallery: newGallery });
      onUpdate();
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setIsSearching(true);
      const results = await dataService.searchLocation(searchQuery);
      setIsSearching(false);
      setLocationResults(results);
  };

  const selectLocation = async (loc: LocationData) => {
      await dataService.updatePin(pin.id, { location: loc });
      if (mapInstance.current) {
          mapInstance.current.setView([loc.lat, loc.lng], 13);
          mapInstance.current.eachLayer((layer: any) => {
              if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer);
          });
          L.marker([loc.lat, loc.lng]).addTo(mapInstance.current);
      }
      onUpdate();
      setLocationResults([]);
      setSearchQuery('');
  };

  const handleClearLocation = async () => {
      if(confirm("Remove location from this stem?")) {
          await dataService.updatePin(pin.id, { location: null as any });
          
          if (mapInstance.current) {
             mapInstance.current.remove();
             mapInstance.current = null;
          }
          onUpdate();
      }
  };
  
  const handleAddTag = async (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (!tags.includes(newTag)) {
          const newTags = [...tags, newTag];
          setTags(newTags);
          await dataService.updatePin(pin.id, { tags: newTags });
      }
      setTagInput('');
    }
  };

  const removeTag = async (tag: string) => {
      const newTags = tags.filter(t => t !== tag);
      setTags(newTags);
      await dataService.updatePin(pin.id, { tags: newTags });
  };
  
  const toggleBoard = async (boardId: string) => {
      const isRemoving = selectedBoardIds.includes(boardId);
      let newBoardIds;
      if (isRemoving) {
          newBoardIds = selectedBoardIds.filter(id => id !== boardId);
      } else {
          newBoardIds = [...selectedBoardIds, boardId];
      }
      
      let autoAddedNewStems = false;
      const newStemsBoard = boards.find(b => b.title === 'New Stems');
      
      if (newBoardIds.length === 0 && newStemsBoard) {
          newBoardIds.push(newStemsBoard.id);
          autoAddedNewStems = true;
      }
      
      setSelectedBoardIds(newBoardIds);

      if (isRemoving) {
          await dataService.bulkRemoveBoard([pin.id], boardId);
      } else {
          await dataService.addPinToBoard(pin.id, boardId);
      }
      
      if (autoAddedNewStems && newStemsBoard) {
          await dataService.addPinToBoard(pin.id, newStemsBoard.id);
      }
  };
  
  const visibleUncollectedBoards = boards.filter(b => !b.collectionId && b.title !== 'New Stems');

  const renderContent = () => {
    if (viewingUrl.endsWith('.mp4') || viewingUrl.endsWith('.mov')) {
        return (
            <video 
                src={viewingUrl} 
                controls 
                autoPlay 
                loop 
                className="max-w-full max-h-full object-contain relative z-10"
            />
        );
    }

    const isMainImage = viewingUrl === activeHeroUrl; // Check against local state
    
    if (isMainImage && pin.link) {
        const ytMatch = pin.link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        if (ytMatch) {
            return (
                <iframe 
                    className="w-full h-full aspect-video z-10"
                    src={`https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            );
        }

        const vimeoMatch = pin.link.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/);
        if (vimeoMatch) {
            return (
                 <iframe 
                    src={`https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1`} 
                    className="w-full h-full aspect-video z-10" 
                    frameBorder="0" 
                    allow="autoplay; fullscreen; picture-in-picture" 
                    allowFullScreen 
                  />
            );
        }
    }

    return (
        <img src={viewingUrl} className="max-w-full max-h-full object-contain relative z-10" alt={pin.title} />
    );
  };

  // FIX: Compare viewing URL to local active hero state
  const isCover = viewingUrl === activeHeroUrl;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 sm:bg-slate-950/95 sm:backdrop-blur-md sm:p-8 overflow-x-hidden" onClick={handleClose}>
       {hasPrev && (
           <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/50 hover:bg-slate-700 text-white transition hidden md:flex z-50">
               <ChevronLeft size={32} />
           </button>
       )}
       {hasNext && (
           <button onClick={(e) => { e.stopPropagation(); handleNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-slate-800/50 hover:bg-slate-700 text-white transition hidden md:flex z-50">
               <ChevronRight size={32} />
           </button>
       )}

       <div className="bg-[#000208] w-full h-full sm:max-w-6xl sm:h-[90vh] sm:rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-white/10 relative transition-all duration-300" onClick={e => e.stopPropagation()}>
          
          <div className={`${showInfo ? 'md:w-3/5' : 'md:w-full'} w-full h-full md:h-auto bg-black flex flex-col relative group transition-all duration-300`} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
             <div className="absolute top-4 left-4 z-20 flex gap-2 pointer-events-auto">
                 <button onClick={handleShare} className="p-2.5 bg-black/40 hover:bg-black/80 backdrop-blur rounded-full text-white transition-colors relative" title="Share">
                     <Share2 size={20} />
                     {isCopying && <span className="absolute top-full left-0 mt-2 text-[10px] bg-teal-500 text-white px-2 py-1 rounded whitespace-nowrap">Copied!</span>}
                 </button>
                 <button onClick={handleToggleFavorite} className={`p-2.5 backdrop-blur rounded-full transition-colors ${isFavorite ? 'bg-red-500/80 hover:bg-red-500 text-white' : 'bg-black/40 hover:bg-black/80 text-white'}`} title="Like">
                     <Heart size={20} fill={isFavorite ? "currentColor" : "none"} />
                 </button>
                 
                 {/* Premium Cover Button */}
                 <button 
                    onClick={isCover ? undefined : handleSetAsCover} 
                    className={`
                        px-4 py-2 backdrop-blur-md text-xs font-bold rounded-full transition-all duration-300 flex items-center gap-2 border
                        ${isCover 
                            ? 'bg-gradient-to-r from-teal-700 to-emerald-950 text-white border-teal-400/50 shadow-[0_0_15px_rgba(20,184,166,0.4)] cursor-default scale-105' 
                            : 'bg-black/40 text-slate-200 border-white/10 hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                        }
                    `}
                 >
                    {isCover ? <Check size={14} strokeWidth={3} /> : <ImageIcon size={14} />} 
                    {isCover ? 'Cover' : 'Set Cover'}
                 </button>
             </div>

             {!showInfo && (
                <button onClick={() => setShowInfo(true)} className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/80 backdrop-blur rounded-full text-white transition-colors hidden md:block">
                   <PanelRightOpen size={20} />
                </button>
             )}
             
             <button onClick={handleClose} className="absolute top-4 right-4 z-20 p-2 bg-black/40 hover:bg-black/80 backdrop-blur rounded-full text-white transition-colors md:hidden">
                 <X size={20} />
             </button>

             <div className="flex-1 relative flex items-center justify-center overflow-hidden bg-[#050505]">
                 <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#1e293b 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                 
                 {renderContent()}

                 {galleryImages.length > 1 && (
                    <>
                       <button onClick={handlePrevImage} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white transition opacity-0 group-hover:opacity-100 hidden md:block z-20">
                          <ChevronLeft size={24} />
                       </button>
                       <button onClick={handleNextImage} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white transition opacity-0 group-hover:opacity-100 hidden md:block z-20">
                          <ChevronRight size={24} />
                       </button>
                    </>
                 )}
             </div>

             {galleryImages.length > 1 && (
                <div className={`h-20 md:h-24 bg-[#050505] border-t border-slate-800 flex items-center gap-2 px-4 overflow-x-auto custom-scrollbar shrink-0 transition-all ${isDrawerOpen ? 'hidden md:flex' : 'flex'}`}>
                    {galleryImages.map((url, idx) => (
                        <button key={idx} onClick={() => setViewingUrl(url)} className={`h-12 w-12 md:h-16 md:w-16 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${viewingUrl === url ? 'border-teal-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
                            <img src={url} className="w-full h-full object-cover" />
                        </button>
                    ))}
                </div>
             )}
          </div>

          <div className={`bg-[#000208] border-l border-slate-800 transition-all duration-300 flex flex-col fixed bottom-0 left-0 right-0 z-30 rounded-t-3xl shadow-[0_-10px_50px_rgba(0,0,0,0.8)] ${isDrawerOpen ? 'h-[85vh]' : 'h-24'} md:relative md:rounded-none md:shadow-none md:h-auto md:w-2/5 md:flex ${showInfo ? 'md:w-2/5' : 'md:w-0 md:border-none md:overflow-hidden'}`}>
                <div className="md:hidden w-full h-8 flex justify-center items-center cursor-pointer active:bg-slate-900 rounded-t-3xl shrink-0" onClick={() => setIsDrawerOpen(!isDrawerOpen)}>
                    <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
                </div>

                <div className="flex justify-between items-start px-6 pt-2 md:pt-6 md:mb-2 shrink-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowInfo(false)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-full hidden md:block" title="Hide Info">
                            <PanelRightClose size={20} />
                        </button>
                    </div>
                    
                    {!isDrawerOpen && (
                        <div className="md:hidden flex-1 px-4 truncate" onClick={() => setIsDrawerOpen(true)}>
                            <div className="font-bold text-white truncate">{pin.title || 'Untitled'}</div>
                            <div className="text-xs text-slate-500">Tap for details</div>
                        </div>
                    )}

                    <div className="hidden md:flex">
                        <button onClick={handleClose} className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-900 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className={`flex-1 overflow-y-auto px-6 pb-6 space-y-6 custom-scrollbar ${!isDrawerOpen ? 'hidden md:block' : ''}`}>
                    <div>
                        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => handleSave(true)} placeholder="Add a title" className="w-full bg-transparent border-none text-2xl sm:text-3xl font-bold text-white placeholder-slate-700 focus:ring-0 px-0 mb-1 tracking-tight" />
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                            <Calendar size={12} />
                            <span>Added {new Date(pin.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 items-center group">
                        <div className="relative flex-1">
                            <input value={link} onChange={e => setLink(e.target.value)} onBlur={() => handleSave(true)} placeholder="Add a website link" className="w-full bg-transparent border-b border-slate-800 rounded-none pl-7 pr-3 py-2 text-sm text-white focus:border-teal-600 outline-none transition-colors" />
                            <LinkIcon className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-teal-500 transition-colors" size={14} />
                        </div>
                        {link && (
                            <a href={dataService.sanitizeUrl(link)} target="_blank" rel="noopener noreferrer" className="p-2 bg-slate-900 hover:bg-teal-600 hover:text-white text-slate-400 rounded-lg transition-colors border border-slate-800 hover:border-teal-600">
                                <ExternalLink size={16} />
                            </a>
                        )}
                    </div>

                    <textarea value={description} onChange={e => setDescription(e.target.value)} onBlur={() => handleSave(true)} placeholder="Add a description" className="w-full bg-slate-900/30 hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-slate-800 rounded-xl p-4 text-slate-300 placeholder-slate-600 focus:ring-0 outline-none transition-all resize-none h-32 text-sm leading-relaxed" />

                    <div>
                        <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2"><TagIcon size={12} /> Keywords</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {tags.map(tag => (
                                <span key={tag} className="flex items-center gap-1 text-xs font-medium text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-md border border-teal-500/20">
                                    #{tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-teal-200 ml-1"><X size={10} /></button>
                                </span>
                            ))}
                        </div>
                        <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleAddTag} placeholder="Add tags..." className="w-full bg-transparent border-b border-slate-800 px-0 py-2 text-sm text-white focus:border-teal-600 outline-none placeholder-slate-700" />
                    </div>

                    <div className="space-y-6 pt-6">
                        <div>
                            <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2"><Layers size={12} /> Saved to Boards</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {selectedBoardIds.map(bid => {
                                    const board = boards.find(b => b.id === bid);
                                    if (!board || board.title === 'New Stems') return null; 
                                    return (
                                        <span key={bid} className="flex items-center gap-1 text-xs bg-slate-900 text-slate-200 px-3 py-1.5 rounded-full border border-slate-800">
                                            {board.title}
                                            <button onClick={() => toggleBoard(bid)} className="hover:text-white ml-1"><X size={12} /></button>
                                        </span>
                                    );
                                })}
                                <button onClick={() => setIsAddingBoard(!isAddingBoard)} className="flex items-center gap-1 text-xs bg-slate-900 hover:bg-slate-800 text-teal-500 px-3 py-1.5 rounded-full border border-slate-800 dashed border-2">
                                    <Plus size={12} /> Add
                                </button>
                            </div>
                            {isAddingBoard && (
                                <div className="bg-slate-900 border border-slate-800 rounded-lg max-h-40 overflow-y-auto p-1 shadow-xl">
                                    {collections.map(col => (
                                        <div key={col.id}>
                                            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">{col.title}</div>
                                            {boards.filter(b => b.collectionId === col.id).map(b => (
                                                <button key={b.id} onClick={() => toggleBoard(b.id)} className={`w-full text-left px-4 py-2 text-xs rounded flex items-center justify-between ${selectedBoardIds.includes(b.id) ? 'bg-teal-500/20 text-teal-400' : 'text-slate-300 hover:bg-slate-800'}`}>
                                                    {b.title} {selectedBoardIds.includes(b.id) && <Check size={12} />}
                                                </button>
                                            ))}
                                        </div>
                                    ))}
                                    {visibleUncollectedBoards.length > 0 && (
                                        <>
                                            <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase mt-1">New Boards</div>
                                            {visibleUncollectedBoards.map(b => (
                                                <button key={b.id} onClick={() => toggleBoard(b.id)} className={`w-full text-left px-4 py-2 text-xs rounded flex items-center justify-between ${selectedBoardIds.includes(b.id) ? 'bg-teal-500/20 text-teal-400' : 'text-slate-300 hover:bg-slate-800'}`}>
                                                    {b.title} {selectedBoardIds.includes(b.id) && <Check size={12} />}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><MapPin size={12} /> Location</label>
                                <div className="flex gap-2">
                                    {pin.location && (
                                        <button onClick={handleClearLocation} className="text-red-500 text-[10px] font-bold uppercase hover:text-red-400 tracking-widest">Clear</button>
                                    )}
                                    <button onClick={() => setIsEditingLocation(!isEditingLocation)} className="text-teal-500 text-[10px] font-bold uppercase hover:text-teal-400 tracking-widest">{isEditingLocation ? 'Done' : 'Edit'}</button>
                                </div>
                            </div>
                            
                            {isEditingLocation ? (
                                <div className="space-y-3 relative">
                                    <form onSubmit={handleLocationSearch} className="flex gap-2">
                                        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search place..." className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-teal-600" />
                                        <button type="submit" disabled={isSearching} className="bg-teal-600 text-white px-3 py-2 rounded-lg font-bold text-xs">{isSearching ? '...' : 'Find'}</button>
                                    </form>
                                    {locationResults.length > 0 && (
                                        <div className="absolute z-20 w-full bg-slate-900 border border-slate-800 rounded-lg shadow-xl max-h-40 overflow-y-auto top-10">
                                            {locationResults.map((loc, i) => (
                                                <button key={i} onClick={() => selectLocation(loc)} className="w-full text-left px-3 py-2 hover:bg-slate-800 border-b border-slate-800/50 flex flex-col">
                                                    <span className="text-sm font-medium text-white">{loc.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                    <div className="w-full h-48 rounded-xl bg-slate-900 z-10 overflow-hidden relative border border-slate-800">
                                        <div ref={mapContainer} className="w-full h-full" />
                                    </div>
                                </div>
                            ) : (
                                <a href={pin.location ? `https://www.google.com/maps/search/?api=1&query=${pin.location.lat},${pin.location.lng}` : '#'} target="_blank" rel="noopener noreferrer" className={`bg-slate-900/50 p-3 rounded-lg border border-slate-800 text-slate-300 text-sm flex items-center gap-3 transition-colors ${pin.location ? 'hover:bg-slate-900 hover:border-teal-500/50 cursor-pointer group' : ''}`} onClick={e => !pin.location && e.preventDefault()}>
                                    <div className="p-2 bg-slate-800 rounded-full text-slate-400 group-hover:text-teal-500 transition-colors"><MapPin size={14} /></div>
                                    <div>
                                        <div className="font-medium text-xs text-white group-hover:text-teal-400 transition-colors">{pin.location?.name || 'No location set'}</div>
                                        {pin.location?.address && <div className="text-[10px] text-slate-500 mt-0.5">{pin.location.address}</div>}
                                    </div>
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <div className={`p-6 border-t border-slate-800 bg-[#000208] mt-auto ${!isDrawerOpen ? 'hidden md:block' : ''}`}>
                    {(pin.gallery && pin.gallery.length > 0) && (
                        <button 
                            onClick={handleUngroup}
                            className="w-full mb-3 py-3 rounded-xl border border-slate-800 text-slate-500 hover:text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest"
                        >
                            <Split size={14} /> Ungroup Photos
                        </button>
                    )}
                    <button onClick={handleDelete} className="w-full py-3 rounded-xl border border-slate-800 text-slate-500 hover:text-red-500 hover:border-red-500/30 hover:bg-red-500/5 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest">
                        <Trash2 size={14} /> Delete Stem
                    </button>
                </div>
             </div>
       </div>
    </div>
  );
};