import { User, Pin, Board, Collection, LocationData, SystemSettings, SortOption } from '../types';

const API_URL = '/api'; 

export const dataService = {
  // --- AUTH & SYSTEM ---
  
  checkSystemSetup: async (): Promise<boolean> => {
      const res = await fetch(`${API_URL}/system/status`);
      const data = await res.json();
      return data.isSetup;
  },

  setupAdmin: async (data: any): Promise<User> => {
      const res = await fetch(`${API_URL}/setup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Setup failed");
      }
      return res.json();
  },

  login: async (credentials: any): Promise<User> => {
      const res = await fetch(`${API_URL}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(credentials)
      });
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Login failed");
      }
      return res.json();
  },

  register: async (data: any): Promise<User> => {
      const res = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Registration failed");
      }
      return res.json();
  },

  getUserById: async (id: string): Promise<User> => {
      const res = await fetch(`${API_URL}/users/${id}`);
      if (!res.ok) {
          throw new Error("User not found");
      }
      return res.json();
  },

  // --- ADMIN TOOLS ---
  
  getInvites: async (): Promise<any[]> => {
      const res = await fetch(`${API_URL}/admin/invites`);
      return res.json();
  },

  generateInvite: async (quota: string): Promise<any> => {
      const res = await fetch(`${API_URL}/admin/invites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quota })
      });
      return res.json();
  },

  deleteInvite: async (id: string) => {
      await fetch(`${API_URL}/admin/invites/${id}`, { method: 'DELETE' });
  },

  updateUserQuota: async (id: string, maxQuota: string) => {
      await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxQuota })
      });
  },

  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`);
    return res.json();
  },
  
  getCurrentUser: async (): Promise<User | null> => {
    const res = await fetch(`${API_URL}/users/current`);
    return res.json();
  },

  deleteUser: async (id: string) => { 
      await fetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
  },

  // --- AVATARS & PROFILE ---
  getAvatars: async (): Promise<string[]> => {
      const res = await fetch(`${API_URL}/avatars`);
      return res.json();
  },

  updateProfile: async (id: string, data: Partial<User>): Promise<User> => {
      const res = await fetch(`${API_URL}/users/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update profile");
      return res.json();
  },

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

  // --- PINS ---
  getPin: async (id: string): Promise<Pin> => {
    const res = await fetch(`${API_URL}/pins/${id}`);
    if (!res.ok) throw new Error("Pin not found");
    return res.json();
  },

  getPins: async (filter: any = {}, sort: SortOption = 'newest', search = '', userId = '', page = 1): Promise<Pin[]> => {
    const params = new URLSearchParams();
    if (filter.collectionId) params.append('collectionId', filter.collectionId);
    if (filter.boardId) params.append('boardId', filter.boardId);
    if (filter.favorites) params.append('favorites', 'true');
    if (filter.tag) params.append('tag', filter.tag);
    if (sort) params.append('sort', sort);
    if (search) params.append('search', search);
    if (userId) params.append('userId', userId);
    if (filter.creatorId) params.append('creatorId', filter.creatorId);
    
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

  // --- INTERACTIONS (UPDATED) ---
  toggleFavorite: async (id: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return false;
    const user = JSON.parse(stored);

    const res = await fetch(`${API_URL}/pins/toggle-favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinId: id, userId: user.id })
    });
    const data = await res.json();
    return data.favorited;
  },
  
  // --- USER SELF-MANAGEMENT ---
  changePassword: async (id: string, currentPass: string, newPass: string) => {
      return true;
  },

  logout: () => {
      localStorage.removeItem('tallo_user');
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
  
  // --- BULK ACTIONS (UPDATED FOR USER CONTEXT) ---
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

  // FIX: Pass userId here
  bulkAddBoard: async (ids: string[], boardId: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    await fetch(`${API_URL}/pins/bulk-boards`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, boardId, userId: user.id })
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

  // FIX: Pass userId here
  bulkRemoveBoard: async (ids: string[], boardId: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    await fetch(`${API_URL}/pins/bulk-boards-remove`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ ids, boardId, userId: user.id })
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
     } catch (e) { return { images: [], title: '' }; }
  },

  swapHeroImage: async (id: string, url: string) => { 
      await dataService.updatePin(id, { imageUrl: url });
  }
};