import { User, Pin, Board, Collection, LocationData, SystemSettings, SortOption } from '../types';

const API_URL = '/api'; 

export const dataService = {
  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`);
    return res.json();
  },
  
  getCurrentUser: async (): Promise<User> => {
    const res = await fetch(`${API_URL}/users/current`);
    return res.json();
  },

  addUser: async (user: Omit<User, 'id' | 'usedQuota'>): Promise<User> => {
    return { ...user, id: Math.random().toString(), usedQuota: '0GB' } as User;
  },

  deleteUser: async (id: string) => { /* Implement in server */ },
  resetPassword: async (id: string) => { return true; },

  // --- COLLECTIONS ---
  getCollections: async (userId: string): Promise<Collection[]> => {
    const res = await fetch(`${API_URL}/collections?userId=${userId}`);
    return res.json();
  },

  createCollection: async (title: string, ownerId: string): Promise<Collection> => {
    const res = await fetch(`${API_URL}/collections`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, ownerId })
    });
    return res.json();
  },

  // --- BOARDS ---
  getBoards: async (userId: string): Promise<Board[]> => {
    const res = await fetch(`${API_URL}/boards?userId=${userId}`);
    return res.json();
  },

  createBoard: async (title: string, collectionId: string | undefined, ownerId: string): Promise<Board> => {
    const res = await fetch(`${API_URL}/boards`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, collectionId, ownerId })
    });
    return res.json();
  },

  updateBoard: async (id: string, updates: Partial<Board>) => {
    await fetch(`${API_URL}/boards/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });
  },

  updateCollection: async (id: string, updates: Partial<Collection>) => {
    await fetch(`${API_URL}/collections/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });
  },

  deleteBoard: async (id: string) => {
    await fetch(`${API_URL}/boards/${id}`, { method: 'DELETE' });
  },

  // --- PINS ---
  getPins: async (filter?: { collectionId?: string; boardId?: string; tag?: string; favorites?: boolean }, sort: SortOption = 'newest', searchQuery?: string, userId?: string): Promise<Pin[]> => {
    
    const res = await fetch(`${API_URL}/pins`);
    let pins: Pin[] = await res.json();

    if (filter?.favorites) {
      pins = pins.filter(p => p.favorite);
    } else if (filter?.boardId) {
      pins = pins.filter(p => p.boardIds.includes(filter.boardId!));
    
    } else if (filter?.collectionId && userId) { 
       const boards = await dataService.getBoards(userId); 
       
       const colBoardIds = boards.filter(b => b.collectionId === filter.collectionId).map(b => b.id);
       pins = pins.filter(p => p.boardIds.some(bid => colBoardIds.includes(bid)));
    } else if (filter?.tag) {
      pins = pins.filter(p => p.tags.includes(filter.tag!));
    }

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      pins = pins.filter(p => 
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    
    if (sort === 'newest') pins.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === 'oldest') pins.sort((a, b) => a.createdAt - b.createdAt);
    if (sort === 'az') pins.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'za') pins.sort((a, b) => b.title.localeCompare(a.title));
    if (sort === 'random') pins.sort(() => Math.random() - 0.5);

    return pins;
  },

  getAllPins: async (): Promise<Pin[]> => {
    const res = await fetch(`${API_URL}/pins`);
    return res.json();
  },

  addPin: async (pin: Omit<Pin, 'id' | 'createdAt' | 'favorite'>): Promise<Pin> => {
    const res = await fetch(`${API_URL}/pins`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(pin)
    });
    return res.json();
  },

  deletePin: async (id: string) => {
    await fetch(`${API_URL}/pins/${id}`, { method: 'DELETE' });
  },

  updatePin: async (id: string, updates: Partial<Pin>) => {
    await fetch(`${API_URL}/pins/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });
  },
  
  bulkDeletePins: async (ids: string[]) => {
    await fetch(`${API_URL}/pins/bulk-delete`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids })
    });
  },

  // --- UPLOAD & SCRAPE ---
  uploadImage: async (file: File): Promise<string> => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_URL}/upload`, {
          method: 'POST',
          body: formData
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      return data.url; 
  },

  getImagesFromUrl: async (url: string): Promise<string[]> => {
     try {
         const res = await fetch(`${API_URL}/scrape`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ url })
         });
         if (!res.ok) throw new Error("Scrape failed");
         const data = await res.json();
         return data.images || [];
     } catch (e) {
         console.error(e);
         return [];
     }
  },

  // --- INTERACTIONS ---
  toggleFavorite: async (id: string) => {
    const pins = await dataService.getAllPins();
    const pin = pins.find(p => p.id === id);
    if (pin) {
        await dataService.updatePin(id, { favorite: !pin.favorite });
        return !pin.favorite;
    }
    return false;
  },
  
  // --- IMPROVED LOCATION SEARCH ---
  searchLocation: async (query: string): Promise<LocationData[]> => {
      try {
        if (!query.trim()) return [];
        
        // We switch from Nominatim to Photon (Komoot) for better "fuzzy" search
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`);
        if (!response.ok) throw new Error('Geocoding failed');
        
        const data = await response.json();
        
        // Photon returns GeoJSON, so we map it differently
        return data.features.map((item: any) => {
            const p = item.properties;
            
            // Build a nice address string from available parts
            const addressParts = [
                p.street, 
                p.housenumber,
                p.city || p.town || p.village,
                p.state,
                p.country
            ].filter(Boolean); // Removes undefined/null parts
            
            return {
              lat: item.geometry.coordinates[1], // GeoJSON is [Lng, Lat]
              lng: item.geometry.coordinates[0],
              name: p.name || addressParts[0] || 'Unknown Location',
              address: addressParts.join(', ') || p.name
            };
        });
      } catch (e) { 
          console.error(e);
          return []; 
      }
  },
  
  sanitizeUrl: (url: string) => { 
    if (!url) return '';
    try {
      let cleanUrl = url.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = 'https://' + cleanUrl;
      return new URL(cleanUrl).href;
    } catch { return ''; }
  },

  getTrendingTags: async () => {
     const pins = await dataService.getAllPins();
     const tagCounts: Record<string, number> = {};
     pins.forEach(pin => pin.tags.forEach(tag => tagCounts[tag] = (tagCounts[tag] || 0) + 1));
     return Object.entries(tagCounts).sort(([,a], [,b]) => b - a).slice(0, 8).map(([t]) => t);
  },

  getAllTags: async () => {
    const pins = await dataService.getAllPins();
    const tags = new Set<string>();
    pins.forEach(p => p.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  },
  
  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await fetch(`${API_URL}/settings`);
    return res.json();
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>) => {
    await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(settings)
    });
  },
  
  // --- BULK ACTIONS ---
  bulkUpdatePins: async (ids: string[], updates: Partial<Pin>) => {
    await fetch(`${API_URL}/pins/bulk-update`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, updates })
    });
  },

  bulkAddTags: async (ids: string[], tags: string[]) => {
    await fetch(`${API_URL}/pins/bulk-tags`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, tags })
    });
  },

  bulkAddBoard: async (ids: string[], boardId: string) => {
    await fetch(`${API_URL}/pins/bulk-boards`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, boardId })
    });
  },

  addPinToBoard: async (pinId: string, boardId: string) => {
    await dataService.bulkAddBoard([pinId], boardId);
  },

  bulkSetLocation: async (ids: string[], location: LocationData) => {
    await dataService.bulkUpdatePins(ids, { location });
  },

  mergePins: async (ids: string[]) => {
     await fetch(`${API_URL}/pins/merge`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids })
    });
  },

  ungroupPin: async (id: string) => {
    await fetch(`${API_URL}/pins/ungroup`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ id })
    });
  },

  restorePin: async (pin: Pin) => {}, 
  restorePins: async (pins: Pin[]) => {}, 
  
  swapHeroImage: async (id: string, url: string) => { 
      await dataService.updatePin(id, { imageUrl: url });
  }
};