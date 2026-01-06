import React, { useState, useEffect, useRef } from 'react';
import { Heart, Copy, CheckCircle, ExternalLink, ChevronLeft, ChevronRight, Play, MapPin } from 'lucide-react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [imgSrc, setImgSrc] = useState(pin.thumbnail || pin.imageUrl);
  const [currentIndex, setCurrentIndex] = useState(0);

  const allImages = [pin.imageUrl, ...(pin.gallery || [])];
  const hasGallery = allImages.length > 1;

  const isVideo = imgSrc?.match(/\.(mp4|webm|ogg|mov)$/i);
  const isVideoLink = pin.link && (pin.link.includes('youtube') || pin.link.includes('vimeo') || pin.link.includes('youtu.be'));

  const getAvatarUrl = (seed: string) => {
      if (seed && (seed.includes('.') || seed.includes('/'))) {
          return `/api/avatars/image/${seed}`;
      }
      return `https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}`;
  };

  useEffect(() => {
    const checkDraggable = () => {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const isSmallScreen = window.innerWidth < 768;
        setIsDraggable(!isTouch && !isSmallScreen);
    };
    checkDraggable();
    window.addEventListener('resize', checkDraggable);
    return () => window.removeEventListener('resize', checkDraggable);
  }, []);

  useEffect(() => {
      setCurrentIndex(0);
      setImgSrc(pin.thumbnail || pin.imageUrl);
  }, [pin.id, pin.thumbnail, pin.imageUrl]);

  useEffect(() => {
    if (!isHovering) {
        if (currentIndex !== 0) {
            setImgSrc(pin.thumbnail || pin.imageUrl);
            setCurrentIndex(0);
        }
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    } else {
        if (isVideo && videoRef.current) {
            videoRef.current.play().catch(() => {}); 
        }
    }
  }, [isHovering, pin.thumbnail, pin.imageUrl, currentIndex, isVideo]);

  const handleImageError = () => {
      if (imgSrc === pin.thumbnail && pin.imageUrl) {
          setImgSrc(pin.imageUrl);
          return;
      }
      if (pin.link) {
          const ytMatch = pin.link.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
          if (ytMatch && imgSrc !== `https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`) {
              setImgSrc(`https://img.youtube.com/vi/${ytMatch[1]}/maxresdefault.jpg`);
              return;
          }
      }
  };

  const toggleFav = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
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

  const handleNext = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const nextIndex = (currentIndex + 1) % allImages.length;
      setCurrentIndex(nextIndex);
      setImgSrc(allImages[nextIndex]);
  };

  const handlePrev = (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const prevIndex = (currentIndex - 1 + allImages.length) % allImages.length;
      setCurrentIndex(prevIndex);
      setImgSrc(allImages[prevIndex]);
  };

  const getDomainInfo = (url: string) => {
      try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          const parts = hostname.split('.');
          if (parts.length > 1) parts.pop();
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
      className={`break-inside-avoid relative group cursor-pointer active:cursor-grabbing transition-transform duration-200 ${isSelected ? 'scale-95' : 'active:scale-95'}`}
    >
      <div className={`relative overflow-hidden rounded-xl bg-slate-800 shadow-xl border transition-all duration-300 ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-slate-800 group-hover:border-slate-700 group-hover:-translate-y-1'}`}>
        
        {/* MEDIA CONTENT */}
        {isVideo ? (
            <video
                ref={videoRef}
                src={imgSrc}
                muted 
                loop 
                playsInline
                className={`w-full h-auto block object-cover transition-opacity ${isSelected ? 'opacity-75' : 'opacity-100'}`}
                onError={handleImageError}
            />
        ) : (
            <img
                src={imgSrc}
                alt={pin.title}
                className={`w-full h-auto block object-cover transition-opacity ${isSelected ? 'opacity-75' : 'opacity-100'}`}
                loading="lazy"
                onError={handleImageError}
            />
        )}
        
        {/* --- MOBILE ACTION ROW (Bottom Right) --- */}
        <div className="md:hidden absolute bottom-2 right-2 z-30 flex items-center gap-2">
            
            {/* 1. Link (if exists) */}
            {domainInfo && (
                <a 
                    href={pin.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white shadow-sm"
                >
                    <ExternalLink size={14} />
                </a>
            )}

            {/* 2. Map (if exists) */}
            {pin.location && (
                 <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${pin.location.lat},${pin.location.lng}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white shadow-sm"
                >
                    <MapPin size={14} />
                </a>
            )}

            {/* 3. Heart (Rightmost for easiest access) */}
            <button 
                onClick={toggleFav}
                className={`p-2 rounded-full backdrop-blur-md transition-colors shadow-sm ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
            >
                <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
            </button>
        </div>

        {/* --- OTHER BADGES --- */}

        {/* Gallery Indicator - MOVED TO BOTTOM LEFT to avoid overlap */}
        {hasGallery && (
           <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded-md flex items-center gap-1.5 z-20 pointer-events-none">
              <Copy size={10} className="text-white" />
              <span className="text-[10px] font-bold text-white">
                  {currentIndex === 0 ? `+${pin.gallery!.length}` : `${currentIndex + 1}/${allImages.length}`}
              </span>
           </div>
        )}

        {/* Video Badge - Top Right */}
        {(isVideo || isVideoLink) && (
            <div className="absolute top-3 right-3 z-20 w-6 h-6 bg-black/50 backdrop-blur rounded-full flex items-center justify-center pointer-events-none shadow-lg">
                <Play size={10} className="text-white fill-white" />
            </div>
        )}

        {/* Selection Checkbox (Top Left) */}
        {(isSelectionMode || isSelected) && (
            <div className={`absolute top-3 left-3 z-30 transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-100 scale-100'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-teal-500 border-teal-500' : 'bg-black/50 border-white/50'}`}>
                    {isSelected && <CheckCircle size={16} className="text-white" />}
                </div>
            </div>
        )}

        {/* Desktop Hover Nav Buttons */}
        {hasGallery && !isSelectionMode && (
            <>
                <button onClick={handlePrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 hidden md:flex"><ChevronLeft size={16} /></button>
                <button onClick={handleNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-30 hidden md:flex"><ChevronRight size={16} /></button>
            </>
        )}
        
        {/* DESKTOP HOVER OVERLAY (Unchanged) */}
        {!isSelectionMode && (
          <div className="hidden md:flex absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex-col p-4 z-20 pointer-events-none">
             <div className="flex justify-between items-start pointer-events-auto">
                {domainInfo ? (
                    <a href={pin.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full pl-1 pr-3 py-1 transition-colors max-w-[75%]">
                        <img src={domainInfo.favicon} alt="" className="w-5 h-5 rounded-full bg-white/10" />
                        <span className="text-[10px] font-bold text-white truncate">{domainInfo.displayName}</span>
                        <ExternalLink size={10} className="text-slate-400 -ml-1" />
                    </a>
                ) : <div />}
                <button onClick={toggleFav} className={`p-2 backdrop-blur rounded-full transition-colors ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}>
                  <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                </button>
             </div>
             
             <div className="mt-auto pt-4 flex flex-col gap-2 items-start pointer-events-auto">
               {pin.location && (
                   <a href={`https://www.google.com/maps/search/?api=1&query=${pin.location.lat},${pin.location.lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full px-2.5 py-1 transition-colors max-w-full group/location">
                       <div className="w-1.5 h-1.5 rounded-full bg-teal-500 group-hover/location:scale-125 transition-transform"></div>
                       <span className="text-[10px] font-bold text-white truncate">{pin.location.name}</span>
                   </a>
               )}
               {pin.tags && pin.tags.length > 0 && (
                   <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[3.6em] relative w-full">
                       {pin.tags.map(tag => (
                           <span key={tag} className="text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border-slate-700/50 truncate max-w-[100px]">#{tag}</span>
                       ))}
                   </div>
               )}
             </div>
          </div>
        )}
      </div>

      <div className="mt-3 px-1">
        {shouldShowTitle && (
            <h3 className={`font-semibold text-sm leading-tight mb-1 ${isSelected ? 'text-teal-400' : 'text-slate-200'}`}>
                {pin.title}
            </h3>
        )}

        {!settings.hideDescriptions && (
          <p className="text-xs text-slate-500 line-clamp-2">{pin.description}</p>
        )}
        
        <div className="flex items-center gap-2 mt-2 opacity-70">
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 overflow-hidden shrink-0">
               <img src={getAvatarUrl(pin.ownerAvatar || pin.ownerId)} className="w-full h-full object-cover" />
            </div>
            <span className="text-xs text-slate-400 font-medium truncate max-w-[150px]">{pin.ownerName || 'Unknown'}</span>
        </div>
      </div>
    </div>
  );
};