import { User, Pin, Board, Collection, LocationData, SystemSettings, SortOption } from '../types';

const API_URL = '/api';

// --- HELPER: Get Auth Headers ---
const getHeaders = () => {
  const stored = localStorage.getItem('tallo_user');
  const user = stored ? JSON.parse(stored) : null;
  return {
    'Content-Type': 'application/json',
    'x-user-id': user ? user.id : ''
  };
};

export const dataService = {
  // --- AUTH & SYSTEM ---

  checkSystemSetup: async (): Promise<boolean> => {
    const res = await fetch(`${API_URL}/system/status`);
    const data = await res.json();
    return data.isSetup;
  },

  // FIX: Added this method so App.tsx can check if login is required
  getServerStatus: async (): Promise<{ isSetup: boolean, isServerOpen: boolean }> => {
    const res = await fetch(`${API_URL}/system/status`);
    return res.json();
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
    // Authenticated to allow seeing private details if needed
    const res = await fetch(`${API_URL}/users/${id}`, {
      headers: getHeaders()
    });
    if (!res.ok) {
      throw new Error("User not found");
    }
    return res.json();
  },

  // --- ADMIN TOOLS ---

  getInvites: async (): Promise<any[]> => {
    const res = await fetch(`${API_URL}/admin/invites`, {
      headers: getHeaders()
    });
    return res.json();
  },

  generateInvite: async (quota: string): Promise<any> => {
    const res = await fetch(`${API_URL}/admin/invites`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ quota })
    });
    return res.json();
  },

  deleteInvite: async (id: string) => {
    await fetch(`${API_URL}/admin/invites/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  updateUserQuota: async (id: string, maxQuota: string) => {
    await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ maxQuota })
    });
  },

  // --- USERS ---
  getUsers: async (): Promise<User[]> => {
    const res = await fetch(`${API_URL}/users`, {
      headers: getHeaders()
    });
    return res.json();
  },

  getCurrentUser: async (): Promise<User | null> => {
    const res = await fetch(`${API_URL}/users/current`, {
      headers: getHeaders()
    });
    return res.json();
  },

  deleteUser: async (id: string) => {
    await fetch(`${API_URL}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  // --- AVATARS & PROFILE ---
  getAvatars: async (): Promise<string[]> => {
    const res = await fetch(`${API_URL}/avatars`);
    return res.json();
  },

  updateProfile: async (id: string, data: Partial<User>): Promise<User> => {
    const res = await fetch(`${API_URL}/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to update profile");
    return res.json();
  },

  // --- COLLECTIONS ---
  getCollections: async (userId: string): Promise<Collection[]> => {
    const res = await fetch(`${API_URL}/collections?userId=${userId}`, {
      headers: getHeaders() // FIX: Added headers so owner is recognized
    });
    return res.json();
  },

  createCollection: async (title: string, ownerId: string): Promise<Collection> => {
    const res = await fetch(`${API_URL}/collections`, {
      method: 'POST',
      headers: getHeaders(),
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
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update collection");
    }
  },

  deleteCollection: async (id: string) => {
    await fetch(`${API_URL}/collections/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  // --- BOARDS ---
  getBoards: async (userId: string): Promise<Board[]> => {
    const res = await fetch(`${API_URL}/boards?userId=${userId}`, {
      headers: getHeaders() // FIX: Added headers so owner is recognized
    });
    return res.json();
  },

  createBoard: async (title: string, collectionId: string | undefined, ownerId: string): Promise<Board> => {
    const res = await fetch(`${API_URL}/boards`, {
      method: 'POST',
      headers: getHeaders(),
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
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to update board");
    }
  },

  deleteBoard: async (id: string) => {
    await fetch(`${API_URL}/boards/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  // --- PINS ---
  getPin: async (id: string): Promise<Pin> => {
    const res = await fetch(`${API_URL}/pins/${id}`, {
      headers: getHeaders()
    });
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

    const res = await fetch(`${API_URL}/pins?${params.toString()}`, {
      headers: getHeaders() // FIX: Added headers
    });
    return res.json();
  },

  getAllPins: async (): Promise<Pin[]> => {
    const res = await fetch(`${API_URL}/pins`, {
      headers: getHeaders() // FIX: Added headers so trending tags sees private content
    });
    return res.json();
  },

  addPin: async (pin: Omit<Pin, 'id' | 'createdAt' | 'favorite'>): Promise<Pin> => {
    const res = await fetch(`${API_URL}/pins`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(pin)
    });
    return res.json();
  },

  deletePin: async (id: string) => {
    await fetch(`${API_URL}/pins/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
  },

  updatePin: async (id: string, updates: Partial<Pin>) => {
    await fetch(`${API_URL}/pins/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(updates)
    });
  },

  bulkDeletePins: async (ids: string[]) => {
    await fetch(`${API_URL}/pins/bulk-delete`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids })
    });
  },

  // --- INTERACTIONS ---
  toggleFavorite: async (id: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return false;
    const user = JSON.parse(stored);

    const res = await fetch(`${API_URL}/pins/toggle-favorite`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ pinId: id, userId: user.id })
    });
    const data = await res.json();
    return data.favorited;
  },

  // --- USER SELF-MANAGEMENT ---
  changePassword: async (id: string, currentPass: string, newPass: string): Promise<void> => {
    const res = await fetch(`${API_URL}/users/${id}/password`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ currentPass, newPass })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || err.message || "Failed to update password");
    }
  },

  generateApiToken: async (userId: string): Promise<string> => {
    const res = await fetch(`${API_URL}/users/${userId}/token`, {
      method: 'POST',
      headers: getHeaders()
    });
    if (!res.ok) throw new Error("Failed to generate token");
    const data = await res.json();
    return data.token;
  },

  generateResetToken: async (userId: string): Promise<string> => {
    const res = await fetch(`${API_URL}/admin/generate-reset-token`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ userId })
    });
    if (!res.ok) throw new Error("Failed to generate token");
    const data = await res.json();
    return data.token;
  },

  completePasswordReset: async (token: string, newPass: string) => {
    const res = await fetch(`${API_URL}/auth/complete-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: newPass })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Reset failed");
    }
    return res.json();
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
        
        // FIX: Prioritize House Number + Street construction
        let displayName = p.name;
        
        if (!displayName) {
            if (p.housenumber && p.street) {
                // If we have "123" and "Main St", combine them
                displayName = `${p.housenumber} ${p.street}`;
            } else {
                // Fallbacks
                displayName = p.street || p.city || p.country || 'Unknown Location';
            }
        }

        const addressParts = [
          p.street !== displayName ? p.street : null, // Avoid repeating street if it's the main name
          p.city || p.town || p.village, 
          p.state, 
          p.country
        ].filter(Boolean);

        return {
          lat: item.geometry.coordinates[1],
          lng: item.geometry.coordinates[0],
          name: displayName,
          address: addressParts.join(', ')
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
    return Object.entries(tagCounts).sort(([, a], [, b]) => b - a).slice(0, 8).map(([t]) => t);
  },

  getAllTags: async () => {
    const pins = await dataService.getAllPins();
    const tags = new Set<string>();
    pins.forEach(p => p.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  },

  getSystemSettings: async (): Promise<SystemSettings> => {
    const res = await fetch(`${API_URL}/settings`, {
      headers: getHeaders()
    });
    return res.json();
  },

  updateSystemSettings: async (settings: Partial<SystemSettings>) => {
    await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(settings)
    });
  },

  // --- BULK ACTIONS ---
  bulkUpdatePins: async (ids: string[], updates: Partial<Pin>) => {
    await fetch(`${API_URL}/pins/bulk-update`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids, updates })
    });
  },

  bulkAddTags: async (ids: string[], tags: string[]) => {
    await fetch(`${API_URL}/pins/bulk-tags`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids, tags })
    });
  },

  bulkAddBoard: async (ids: string[], boardId: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    await fetch(`${API_URL}/pins/bulk-boards`, {
      method: 'POST',
      headers: getHeaders(),
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
      headers: getHeaders(),
      body: JSON.stringify({ ids })
    });
  },

  ungroupPin: async (id: string) => {
    await fetch(`${API_URL}/pins/ungroup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id })
    });
  },

  bulkRemoveBoard: async (ids: string[], boardId: string) => {
    const stored = localStorage.getItem('tallo_user');
    if (!stored) return;
    const user = JSON.parse(stored);

    await fetch(`${API_URL}/pins/bulk-boards-remove`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ ids, boardId, userId: user.id })
    });
  },

  restorePin: async (pin: Pin) => {
    await fetch(`${API_URL}/pins/restore`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ id: pin.id })
    });
  },

  restorePins: async (pins: Pin[]) => { },

  async getPublicProfile(userId: string) {
    const headers = getHeaders(); // FIX: Used 'getHeaders()' correctly
    const response = await fetch(`${API_URL}/users/${userId}/public`, { headers });
    if (!response.ok) throw new Error("Failed to load profile");
    return response.json();
  },

  // --- UPLOAD & SCRAPE ---
  uploadImage: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const stored = localStorage.getItem('tallo_user');
    const user = stored ? JSON.parse(stored) : null;

    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      headers: {
        'x-user-id': user ? user.id : ''
      },
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
        headers: getHeaders(),
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

  swapHeroImage: async (id: string, newUrl: string) => {
    // 1. Fetch current state to get the old URL and Gallery
    const pin = await dataService.getPin(id);
    const oldUrl = pin.imageUrl;
    let gallery = pin.gallery || [];

    // 2. Remove the NEW hero image from the gallery (avoid duplication)
    gallery = gallery.filter(img => img !== newUrl);

    // 3. Add the OLD hero image to the gallery (preserve it)
    if (oldUrl && oldUrl !== newUrl) {
        gallery.push(oldUrl);
    }

    // 4. Send the update
    await dataService.updatePin(id, { 
        imageUrl: newUrl, 
        gallery: gallery 
    });
  }
};