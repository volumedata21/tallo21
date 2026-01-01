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
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create collection");
    }
    
    return res.json();
  },

  updateCollection: async (id: string, updates: Partial<Collection>) => {
    const res = await fetch(`${API_URL}/collections/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update collection");
    }
  },

  deleteCollection: async (id: string) => {
      await fetch(`${API_URL}/collections/${id}`, { method: 'DELETE' });
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
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create board");
    }
    
    return res.json();
  },

  updateBoard: async (id: string, updates: Partial<Board>) => {
    const res = await fetch(`${API_URL}/boards/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(updates)
    });

    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update board");
    }
  },

  deleteBoard: async (id: string) => {
    await fetch(`${API_URL}/boards/${id}`, { method: 'DELETE' });
  },

  // --- PINS (Fixed) ---
  getPins: async (filter: any = {}, sort: SortOption = 'newest', search = '', userId = '', page = 1): Promise<Pin[]> => {
    const params = new URLSearchParams();
    
    // Filters
    if (filter.collectionId) params.append('collectionId', filter.collectionId);
    if (filter.boardId) params.append('boardId', filter.boardId);
    if (filter.favorites) params.append('favorites', 'true');
    if (filter.tag) params.append('tag', filter.tag);
    
    // Search & Sort
    if (sort) params.append('sort', sort);
    if (search) params.append('search', search);
    if (userId) params.append('userId', userId);
    
    // Pagination (Load 50 at a time)
    params.append('page', page.toString());
    params.append('limit', '50'); 

    const res = await fetch(`${API_URL}/pins?${params.toString()}`);
    return res.json();
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

  // --- UPDATED: Return Title ---
  getImagesFromUrl: async (url: string): Promise<{ images: string[], title: string }> => {
     try {
         const res = await fetch(`${API_URL}/scrape`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ url })
         });
         if (!res.ok) throw new Error("Scrape failed");
         const data = await res.json();
         return { 
             images: data.images || [],
             title: data.title || ''
         };
     } catch (e) {
         console.error(e);
         return { images: [], title: '' };
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
  
  // --- LOCATION ---
  searchLocation: async (query: string): Promise<LocationData[]> => {
      try {
        if (!query.trim()) return [];
        const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10`);
        if (!response.ok) throw new Error('Geocoding failed');
        const data = await response.json();
        
        return data.features.map((item: any) => {
            const p = item.properties;
            const addressParts = [
                p.street, p.housenumber, p.city || p.town || p.village, p.state, p.country
            ].filter(Boolean);
            
            return {
              lat: item.geometry.coordinates[1],
              lng: item.geometry.coordinates[0],
              name: p.name || addressParts[0] || 'Unknown Location',
              address: addressParts.join(', ') || p.name
            };
        });
      } catch (e) { return []; }
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

  bulkRemoveBoard: async (ids: string[], boardId: string) => {
    await fetch(`${API_URL}/pins/bulk-boards-remove`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, boardId })
    });
  },

  restorePin: async (pin: Pin) => {
      await fetch(`${API_URL}/pins/restore`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ id: pin.id })
      });
  },

  restorePins: async (pins: Pin[]) => {}, 
  
  swapHeroImage: async (id: string, url: string) => { 
      await dataService.updatePin(id, { imageUrl: url });
  }
};