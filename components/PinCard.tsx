import React, { useState, useEffect } from 'react';
import { Heart, Copy, CheckCircle, ExternalLink } from 'lucide-react';
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

  // --- SMART URL FORMATTER ---
  const getDomainInfo = (url: string) => {
      try {
          const hostname = new URL(url).hostname.replace(/^www\./, '');
          
          // 1. Remove TLD (e.g. .com, .co.uk)
          // We split by dot and remove the last part. 
          // If it's a short TLD like .co.uk, this rudimentary check might leave '.co', 
          // but for display purposes 'Newbalance' looks much better than 'newbalance.com'
          const parts = hostname.split('.');
          if (parts.length > 1) {
              parts.pop(); // Remove 'com'
              // specific edge case check for 2-letter second parts (like co.uk) could go here
          }
          
          // 2. Clean up dashes/dots remaining
          const nameRaw = parts.join(' '); 

          // 3. Capitalize First Letter of each word (e.g. "the-verge" -> "The Verge")
          // We split by non-alphanumeric chars to handle dashes elegantly
          const displayName = nameRaw
            .split(/[-_.]/)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');

          return {
              displayName, // e.g. "Newbalance" or "TheVerge"
              hostname,    // Keep original hostname for favicon
              favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
          };
      } catch {
          return null;
      }
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
      className={`break-inside-avoid relative group cursor-pointer active:cursor-grabbing transition-transform duration-200 ${isSelected ? 'scale-95' : ''}`}
    >
      <div className={`relative overflow-hidden rounded-xl bg-slate-800 shadow-xl border transition-all duration-300 ${isSelected ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-slate-800 group-hover:border-slate-700 group-hover:-translate-y-1'}`}>
        <img
          src={pin.imageUrl}
          alt={pin.title}
          className={`w-full h-auto block object-cover transition-opacity ${isSelected ? 'opacity-75' : 'opacity-100'}`}
          loading="lazy"
        />
        
        {/* Selection Checkbox */}
        {(isSelectionMode || isSelected) && (
            <div className={`absolute top-3 right-3 z-20 transition-all ${isSelected ? 'opacity-100 scale-100' : 'opacity-100 scale-100'}`}>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-teal-500 border-teal-500' : 'bg-black/50 border-white/50'}`}>
                    {isSelected && <CheckCircle size={16} className="text-white" />}
                </div>
            </div>
        )}

        {/* Gallery Indicator */}
        {pin.gallery && pin.gallery.length > 0 && (
           <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur rounded-md flex items-center gap-1.5 z-10">
              <Copy size={12} className="text-white" />
              <span className="text-[10px] font-bold text-white">+{pin.gallery.length}</span>
           </div>
        )}
        
        {/* --- HOVER OVERLAY --- */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col p-4">
             
             {/* Top Row: URL & Like */}
             <div className="flex justify-between items-start">
                {domainInfo ? (
                    <a 
                        href={pin.link}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2 bg-black/40 hover:bg-black/60 backdrop-blur rounded-full pl-1 pr-3 py-1 transition-colors max-w-[75%]"
                    >
                        <img src={domainInfo.favicon} alt="" className="w-5 h-5 rounded-full bg-white/10" />
                        {/* UPDATED: Uses the sanitized displayName */}
                        <span className="text-[10px] font-bold text-white truncate">{domainInfo.displayName}</span>
                        <ExternalLink size={10} className="text-slate-400 -ml-1" />
                    </a>
                ) : (
                    <div /> /* Spacer if no link */
                )}

                <button 
                  onClick={toggleFav}
                  className={`p-2 backdrop-blur rounded-full transition-colors ${isFavorite ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}
                >
                  <Heart size={14} fill={isFavorite ? "currentColor" : "none"} />
                </button>
             </div>
             
             {/* Bottom Row: Tags */}
             <div className="mt-auto pt-4">
               {pin.tags && pin.tags.length > 0 ? (
                   <div className="flex flex-wrap gap-1.5 overflow-hidden max-h-[3.6em] relative">
                       {pin.tags.map(tag => (
                           <span key={tag} className="text-[10px] font-medium text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded-full border-slate-700/50 truncate max-w-[100px]">
                               #{tag}
                           </span>
                       ))}
                   </div>
               ) : (
                   /* Fallback to Location if no tags */
                   pin.location && (
                       <div className="text-[10px] font-medium text-slate-300 flex items-center gap-1.5">
                           <div className="w-1 h-1 rounded-full bg-teal-500"></div>
                           <span className="truncate">{pin.location.name}</span>
                       </div>
                   )
               )}
             </div>
          </div>
        )}
      </div>

      {/* Info Footer (Outside Image) */}
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