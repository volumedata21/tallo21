import React, { useEffect, useRef } from 'react';
import { Pin } from '../types';
import { Maximize2 } from 'lucide-react';

interface MapViewProps {
  pins: Pin[];
  onPinClick: (pin: Pin) => void;
}

export const MapView: React.FC<MapViewProps> = ({ pins, onPinClick }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize Map
    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([20, 0], 2);

      // Dark Matter Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstance.current);
    }

    // Force map invalidation on mount to fix sizing issues
    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 100);

    // Clear existing markers
    mapInstance.current.eachLayer((layer: any) => {
      if (layer instanceof L.Marker) {
        mapInstance.current.removeLayer(layer);
      }
    });

    // Custom Icon Definition
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: #0d9488; width: 30px; height: 30px; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>
             </div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });

    // Add markers for pins with location
    const markers: any[] = [];
    pins.forEach(pin => {
      if (pin.location) {
        const marker = L.marker([pin.location.lat, pin.location.lng], { icon: customIcon })
          .addTo(mapInstance.current)
          .bindPopup(`
            <div class="font-sans min-w-[150px]">
              <div class="w-full h-24 mb-2 rounded overflow-hidden">
                <img src="${pin.imageUrl}" class="w-full h-full object-cover" />
              </div>
              <h3 class="font-bold text-slate-900 text-sm mb-1">${pin.title}</h3>
              <p class="text-xs text-slate-600 truncate mb-2">${pin.location.name}</p>
              <button id="btn-${pin.id}" class="w-full bg-teal-600 text-white text-xs font-semibold py-1.5 px-2 rounded hover:bg-teal-700 transition">View Pin</button>
            </div>
          `);
        
        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-${pin.id}`);
          if (btn) btn.onclick = () => onPinClick(pin);
        });

        markers.push(marker);
      }
    });

    // Fit bounds if markers exist
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      mapInstance.current.fitBounds(group.getBounds().pad(0.1));
    }

  }, [pins]);

  return (
    <div className="w-full h-full relative z-0">
      <div ref={mapRef} className="w-full h-full" style={{ minHeight: '100%' }} />
    </div>
  );
};