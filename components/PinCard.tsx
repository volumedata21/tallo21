import React, { useState, useEffect } from 'react';
import { MapPin, Maximize2, Heart, Copy, CheckCircle, ExternalLink } from 'lucide-react';
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

  const handleExternalLink = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (pin.link) window.open(pin.link, '_blank');
  };

  // Hide title if it's "untitled" (case insensitive) or if settings say hide
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
        
        {/* Selection Checkbox - Visible in mode or on hover/selected */}
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
        
        {/* Hover Overlay - Hidden when in selection mode to avoid clutter */}
        {!isSelectionMode && (
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
             <div className="absolute top-3 right-3 flex gap-2">
                {pin.link && (
                    <button 
                        onClick={handleExternalLink}
                        className="p-2 bg-slate-900/80 backdrop-blur rounded-full text-white hover:bg-teal-600 transition-colors"
                        title="Open Source Link"
                    >
                        <ExternalLink size={16} />
                    </button>
                )}
                <button 
                  onClick={toggleFav}
                  className={`p-2 backdrop-blur rounded-full transition-colors ${isFavorite ? 'bg-red-500 text-white' : 'bg-slate-900/80 text-white hover:bg-slate-800'}`}
                >
                  <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
                </button>
                <button className="p-2 bg-slate-900/80 backdrop-blur rounded-full text-white hover:bg-teal-600 transition-colors">
                  <Maximize2 size={16} />
                </button>
             </div>
             
             {pin.location && (
               <div className="inline-flex items-center gap-1 text-xs font-medium text-slate-300 mb-2">
                 <MapPin size={12} className="text-teal-500" />
                 <span className="truncate max-w-[150px]">{pin.location.name}</span>
               </div>
             )}
          </div>
        )}
      </div>

      {/* Info */}
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