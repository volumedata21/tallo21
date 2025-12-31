import React, { useState, useEffect } from 'react';
import { Heart, Copy, CheckCircle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Pin, UserSettings } from '../types';
import { dataService } from '../services/dataService';

interface PinCardProps {
  pin: Pin;
  settings: UserSettings;
  onClick: (pin: Pin, e: React.MouseEvent) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (id: string, e: React.MouseEvent) => void;
}

export const PinCard: React.FC<PinCardProps> = ({ 
  pin, 
  settings, 
  onClick, 
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection
}) => {
  const [isFavorite, setIsFavorite] = useState(pin.favorite);
  const [isDraggable, setIsDraggable] = useState(true);
  const [isHovering, setIsHovering] = useState(false);
  
  // --- OPTIMIZATION: Determine cover image ---
  // If a thumbnail exists, use it by default. Fallback to full image.
  const coverImage = pin.thumbnail || pin.imageUrl;
  
  // Gallery Cycling State
  // Initialize with the cover image (optimized or full)
  const [currentImage, setCurrentImage] = useState(coverImage);
  const [currentIndex, setCurrentIndex] = useState(0);

  // The full gallery list always uses high-res images for consistency when cycling
  const allImages = [pin.imageUrl, ...(pin.gallery || [])];
  const hasGallery = allImages.length > 1;

  useEffect(() => {
    // Disable drag on touch devices or small screens
    const checkDraggable = () => {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 768;
        setIsDraggable(!isTouch && !isSmallScreen);
    };
    checkDraggable();
    window.addEventListener('resize', checkDraggable);
    return () => window.removeEventListener('resize', checkDraggable);
  }, []);

  // Reset index and image if the pin prop changes
  useEffect(() => {
      setCurrentIndex(0);
      setCurrentImage(coverImage);
  }, [pin.id, coverImage]);

  // --- OPTIMIZATION: Reset to thumbnail when not hovering ---
  useEffect(() => {
    if (!isHovering && currentIndex === 0) {
        setCurrentImage(coverImage);
    } else if (isHovering && currentIndex === 0 && !pin.thumbnail) {
         // Optional: If we don't have a thumbnail, we are already using full res.
         // If we DID have a thumbnail, we might want to swap to full res on hover?
         // For now, let's keep it simple: Stay on thumbnail until user cycles.
    }
  }, [isHovering, coverImage, currentIndex, pin.thumbnail]);

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = dataService.toggleFavorite(pin.id);
    setIsFavorite(!!newState);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isSelectionMode && onToggleSelection) {
      e.preventDefault();
      onToggleSelection(pin.id, e);
    } else {
      onClick(pin, e);
    }
  };

  // --- GALLERY HANDLERS ---
  const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % allImages.length;
      setCurrentIndex(nextIndex);
      setCurrentImage(allImages[nextIndex]); // Load full res when cycling
  };

  const handlePrev = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
      setCurrentIndex(prevIndex);
      setCurrentImage(allImages[prevIndex]); // Load full res when cycling
  };

  // --- SMART URL FORMATTER ---
  const getDomainInfo = (url: string) => {
      try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          const parts = hostname.split('.');
          if (parts.length > 1) parts.pop(); // Remove TLD
          
          const nameRaw = parts.join(' '); 
          const displayName = nameRaw.split(/[-_.]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');

          return {
              displayName, 
              hostname,    
              favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
          };
      } catch { return null; }
  };

  const domainInfo = pin.link ? getDomainInfo(pin.link) : null;
  const shouldShowTitle = !settings.hideTitles && pin.title && pin.title.toLowerCase().trim() !== 'untitled';

  return (
    <div 
      draggable={!isSelectionMode && isDraggable}
      onDragStart={(e) => {
          if (!isSelectionMode && isDraggable) e.dataTransfer.setData('pinId', pin.id);
      }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className={`break-inside-avoid relative group cursor-pointer active:cursor-grabbing transition-transform duration-200 ${isSelected ? 'scale-95' : ''}`}
    >
      <div className={`relative overflow-hidden rounded-xl bg-slate-800 shadow-xl border transition-all duration-300 ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-slate-800 group-hover:border-slate-700 group-hover:-translate-y-1'}`}>
        
        {/* Main Image (Thumbnail or Full) */}
        <img
          src={currentImage}
          alt={pin.title}
          className={`w-full h-auto block object-cover transition-opacity ${isSelected ? 'opacity-75' : 'opacity-100'}`}
          loading="lazy"
        />
        
        {/* Selection Checkbox */}
        {(isSelectionMode || isSelected) && (
            <div className={`absolute top-3 right-3 z-30 transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-100 scale-100'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-teal-500 border-teal-500' : 'bg-black/50 border-white/50'}`}>
                    {isSelected && <CheckCircle size={16} className="text-white" />}
                </div>
            </div>
        )}

        {/* Gallery Cycle Buttons (Visible on Hover) */}
        {hasGallery && !isSelectionMode && (
            <>
                <button 
                    onClick={handlePrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
                >
                    <ChevronLeft size={16} />
                </button>
                <button 
                    onClick={handleNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-30"
                >
                    <ChevronRight size={16} />
                </button>
            </>
        )}

        {/* Gallery Indicator (Updates when cycling) */}
        {hasGallery && (
           <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/60 backdrop-blur rounded-md flex items-center gap-1.5 z-20 pointer-events-none">
              <Copy size={10} className="text-white" />
              <span className="text-[10px] font-bold text-white">
                  {currentIndex === 0 ? `+${pin.gallery!.length}` : `${currentIndex + 1}/${allImages.length}`}
              </span>
           </div>
        )}
        
        {/* --- HOVER OVERLAY --- */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col p-4 z-20 pointer-events-none">
             
             {/* Top Row: URL & Like */}
             <div className="flex justify-between items-start pointer-events-auto">
                {domainInfo ? (
                    <a 
                        href={pin.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full pl-1 pr-3 py-1 transition-colors max-w-[75%]"
                    >
                        <img src={domainInfo.favicon} alt="" className="w-5 h-5 rounded-full bg-white/10" />
                        <span className="text-[10px] font-bold text-white truncate">{domainInfo.displayName}</span>
                        <ExternalLink size={10} className="text-slate-400 -ml-1" />
                    </a>
                ) : (
                    <div />
                )}

                <button 
                  onClick={toggleFav}
                  className={`p-2 backdrop-blur rounded-full transition-colors ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
                >
                  <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                </button>
             </div>
             
             {/* Bottom Section: Location & Tags */}
             <div className="mt-auto pt-4 flex flex-col gap-2 items-start pointer-events-auto">
               
               {/* Location */}
               {pin.location && (
                   <a 
                     href={`https://www.google.com/maps/search/?api=1&query=${pin.location.lat},${pin.location.lng}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     onClick={(e) => e.stopPropagation()}
                     className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full px-2.5 py-1 transition-colors max-w-full group/location"
                   >
                       <div className="w-1.5 h-1.5 rounded-full bg-teal-500 group-hover/location:scale-125 transition-transform"></div>
                       <span className="text-[10px] font-bold text-white truncate">{pin.location.name}</span>
                   </a>
               )}

               {/* Tags */}
               {pin.tags && pin.tags.length > 0 && (
                   <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[3.6em] relative w-full">
                       {pin.tags.map(tag => (
                           <span key={tag} className="text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border-slate-700/50 truncate max-w-[100px]">
                               #{tag}
                           </span>
                       ))}
                   </div>
               )}
             </div>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="mt-3 px-1">
        {shouldShowTitle && (
          <div className="flex justify-between items-start gap-2">
             <h3 className={`font-semibold text-sm leading-tight mb-1 ${isSelected ? 'text-teal-400' : 'text-slate-200'}`}>{pin.title}</h3>
             {isFavorite && <Heart size={12} className="text-red-500 shrink-0 mt-0.5" fill="currentColor" />}
          </div>
        )}
        {!settings.hideDescriptions && (
          <p className="text-xs text-slate-500 line-clamp-2">{pin.description}</p>
        )}
      </div>
    </div>
  );
};