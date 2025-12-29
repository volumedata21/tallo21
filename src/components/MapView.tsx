import React, { useEffect, useRef, useState } from 'react';
import { PinnedImage } from '../../shared/types';
import { MapPin, X, ChevronRight, Calendar } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- LEAFLET ICON FIX ---
// This ensures that if you ever use a default marker, it won't be broken.
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;
// ------------------------

interface MapViewProps {
  images: PinnedImage[];
  onImageClick?: (id: string) => void;
}

const MapView: React.FC<MapViewProps> = ({ images, onImageClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  
  // State for handling clusters
  const [activeCluster, setActiveCluster] = useState<{
    location: string;
    images: PinnedImage[];
  } | null>(null);

  // Filter images that have coordinates
  const validImages = images.filter(img => img.latitude && img.longitude);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not exists
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([20, 0], 2);

      // Add Zoom control to bottom right
      L.control.zoom({
        position: 'bottomright'
      }).addTo(mapInstanceRef.current);

      // Add Dark Matter Tiles (CartoDB)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapInstanceRef.current);
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    if (validImages.length === 0) {
      return;
    }

    // 1. Group images by location (lat,lng key)
    const groupedImages: Record<string, PinnedImage[]> = {};
    
    validImages.forEach(img => {
      // Create a precision key to group identical locations
      const key = `${img.latitude!.toFixed(6)},${img.longitude!.toFixed(6)}`;
      if (!groupedImages[key]) {
        groupedImages[key] = [];
      }
      groupedImages[key].push(img);
    });

    const bounds = L.latLngBounds([]);

    // 2. Create Markers for groups
    Object.values(groupedImages).forEach(group => {
      // Sort by newest first to use as the cover image
      group.sort((a, b) => b.createdAt - a.createdAt);
      const coverImage = group[0];
      const count = group.length;

      // Custom HTML for the marker
      const markerHtml = `
        <div class="relative w-[40px] h-[40px] group transition-transform hover:scale-110">
          <div class="w-full h-full rounded-lg overflow-hidden border-2 border-white shadow-lg bg-slate-900">
            <img src="${coverImage.thumbnailUrl || coverImage.url}" class="w-full h-full object-cover" />
          </div>
          ${count > 1 ? `
            <div class="absolute -top-2 -right-2 bg-rose-600 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-slate-950 shadow-md z-50">
              ${count}
            </div>
          ` : ''}
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white"></div>
        </div>
      `;

      const icon = L.divIcon({
        className: 'custom-map-marker-container', // Empty class to avoid default styles
        html: markerHtml,
        iconSize: [40, 40],
        iconAnchor: [20, 45], // Adjusted anchor for the "pin" effect
        popupAnchor: [0, -45]
      });

      const marker = L.marker([coverImage.latitude!, coverImage.longitude!], { icon })
        .addTo(map);

      // Tooltip
      const tooltipText = count > 1 
        ? `${count} pins at ${coverImage.location || 'this location'}`
        : coverImage.title;

      marker.bindTooltip(tooltipText, { 
        direction: 'top',
        offset: [0, -40],
        className: 'bg-slate-900 text-slate-100 border-slate-800 px-2 py-1 rounded text-xs shadow-xl font-medium'
      });
      
      // Click Handler
      marker.on('click', () => {
        if (count > 1) {
          // Open local gallery for this cluster
          setActiveCluster({
            location: coverImage.location || 'Unknown Location',
            images: group
          });
          map.setView([coverImage.latitude!, coverImage.longitude!], Math.max(map.getZoom(), 12));
        } else {
          // Open global detail modal directly
          if (onImageClick) {
            onImageClick(coverImage.id);
          }
        }
      });
      
      markersRef.current.push(marker);
      bounds.extend([coverImage.latitude!, coverImage.longitude!]);
    });

    // Fit bounds if we have markers and aren't currently focusing on a cluster
    if (validImages.length > 0 && !activeCluster) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

  }, [validImages, onImageClick]);

  if (validImages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-900/50 rounded-2xl border border-slate-800">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4 border border-slate-800">
          <MapPin className="w-8 h-8 text-slate-600" />
        </div>
        <p className="text-lg font-medium text-slate-400">No locations pinned</p>
        <p className="text-sm text-slate-500 mt-1">Add a location to your pins to see them here.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[calc(100vh-200px)] min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative group">
      <div ref={mapContainerRef} className="w-full h-full bg-slate-950 z-0 cursor-grab active:cursor-grabbing" />
      
      {/* Map Stats Overlay */}
      <div className="absolute top-4 right-4 z-[400] bg-slate-900/80 backdrop-blur-md border border-slate-800 px-4 py-2 rounded-lg shadow-lg pointer-events-none transition-opacity group-hover:opacity-100 opacity-60">
        <p className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <MapPin className="w-3 h-3 text-rose-500" />
          {markersRef.current.length} Locations ({validImages.length} Pins)
        </p>
      </div>

      {/* Cluster Gallery Overlay */}
      {activeCluster && (
        <div className="absolute top-4 left-4 bottom-4 w-80 z-[500] bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
          <div className="p-4 border-b border-slate-800 flex items-start justify-between bg-slate-950/50 rounded-t-2xl">
            <div>
              <h3 className="text-sm font-bold text-slate-100 line-clamp-2">{activeCluster.location}</h3>
              <p className="text-xs text-rose-500 font-medium mt-1">{activeCluster.images.length} Pins Here</p>
            </div>
            <button 
              onClick={() => setActiveCluster(null)}
              className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
            {activeCluster.images.map(img => (
              <div 
                key={img.id}
                onClick={() => onImageClick && onImageClick(img.id)}
                className="group flex gap-3 p-2 rounded-xl hover:bg-slate-800/50 cursor-pointer transition-colors border border-transparent hover:border-slate-700"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex-shrink-0">
                  <img src={img.thumbnailUrl || img.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <h4 className="text-sm font-medium text-slate-200 truncate group-hover:text-rose-400 transition-colors">{img.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(img.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex items-center text-slate-600 group-hover:text-rose-500">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;