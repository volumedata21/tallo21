import React, { useEffect, useRef, useState } from 'react';
import { Pin } from '../types';
import { Maximize2, Map as MapIcon, Image as ImageIcon } from 'lucide-react';

interface MapViewProps {
  pins: Pin[];
  onPinClick: (pin: Pin) => void;
}

export const MapView: React.FC<MapViewProps> = ({ pins, onPinClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  // Toggle state: 'pin' (simple dots) or 'card' (image + title)
  const [markerMode, setMarkerMode] = useState<'pin' | 'card'>('pin');

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize Map (Same as before)
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([20, 0], 2);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstance.current);
    }

    // Force invalidation
    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 100);

    // Clear existing markers
    mapInstance.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        mapInstance.current.removeLayer(layer);
      }
    });

    // --- MARKER GENERATION LOGIC ---
    const markers: any[] = [];

    pins.forEach(pin => {
      if (pin.location) {
        let icon;

        if (markerMode === 'card') {
          // RICH MARKER: Image + Title
          icon = L.divIcon({
            className: 'custom-card-icon',
            html: `
              <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                transform: translate(-50%, -50%);
                width: 120px;
              ">
                <div style="
                  width: 48px; 
                  height: 48px; 
                  border-radius: 12px; 
                  border: 2px solid white; 
                  overflow: hidden; 
                  box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                  background: #0f172a;
                  margin-bottom: 4px;
                ">
                  <img src="${pin.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div style="
                  background: rgba(0,0,0,0.7); 
                  backdrop-filter: blur(4px);
                  color: white; 
                  padding: 2px 8px; 
                  border-radius: 4px; 
                  font-size: 10px; 
                  font-weight: bold;
                  text-align: center;
                  max-width: 100%;
                  white-space: nowrap; 
                  overflow: hidden; 
                  text-overflow: ellipsis;
                ">
                  ${pin.title}
                </div>
              </div>
            `,
            iconSize: [0, 0], // Size handled by CSS/HTML
          });
        } else {
          // TALLO MARKER: Green Circle + Double Chevron
          icon = L.divIcon({
            className: 'custom-pin-icon',
            html: `
              <div style="
                background-color: rgba(13, 148, 136, 0.95);
                width: 30px; 
                height: 30px; 
                border-radius: 50%; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                box-shadow: 0 4px 6px rgba(0,0,0,0.3);
              ">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m17 11-5-5-5 5"/>
                  <path d="m17 18-5-5-5 5"/>
                </svg>
              </div>
            `,
            iconSize: [30, 30],
            iconAnchor: [15, 15], // Half of width/height to center it
          });
        }

        const marker = L.marker([pin.location.lat, pin.location.lng], { icon })
          .addTo(mapInstance.current)
          .on('click', () => onPinClick(pin));

        // Add standard popup mainly for 'simple' mode, but works for both
        if (markerMode === 'pin') {
            marker.bindTooltip(pin.title, { 
                direction: 'top', 
                offset: [0, -10],
                className: 'bg-slate-900 text-white border-0 px-2 py-1 rounded text-xs font-bold'
            });
        }

        markers.push(marker);
      }
    });

    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      mapInstance.current.fitBounds(group.getBounds().pad(0.1));
    }

  }, [pins, markerMode]); // Re-run when mode changes

  return (
    <div className="w-full h-full relative z-0">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '100%' }} />
      
      {/* TOGGLE CONTROLS */}
      <div className="absolute top-4 right-4 z-[400] flex flex-col gap-2 bg-slate-900/90 backdrop-blur border border-slate-700 p-1 rounded-lg shadow-xl">
        <button 
            onClick={() => setMarkerMode('pin')}
            className={`p-2 rounded-md transition-colors ${markerMode === 'pin' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Simple Pins"
        >
            <MapIcon size={18} />
        </button>
        <button 
            onClick={() => setMarkerMode('card')}
            className={`p-2 rounded-md transition-colors ${markerMode === 'card' ? 'bg-teal-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title="Image Cards"
        >
            <ImageIcon size={18} />
        </button>
      </div>
    </div>
  );
};