import { User, Pin, Board, Collection, LocationData, SystemSettings, SortOption } from '../types';

// Initial Mock Data
const MOCK_USERS: User[] = [
  { id: 'u1', username: 'admin', email: 'admin@dark.io', role: 'admin', quota: '1TB', usedQuota: '5GB', avatarSeed: 'admin', inviteCode: 'DARKMODE' },
  { id: 'u2', username: 'guest', email: 'guest@example.com', role: 'user', quota: '500MB', usedQuota: '100MB', avatarSeed: 'guest' }
];

const MOCK_COLLECTIONS: Collection[] = [];

const MOCK_BOARDS: Board[] = [];

// Mock Pins with some having galleries and favorites
const MOCK_PINS: Pin[] = [];

// In-memory store
let state = {
  users: [...MOCK_USERS],
  collections: [...MOCK_COLLECTIONS],
  boards: [...MOCK_BOARDS],
  pins: [...MOCK_PINS],
  settings: {
    maxUploadSize: '25MB'
  } as SystemSettings
};

export const dataService = {
  getUsers: () => [...state.users],
  
  getCurrentUser: () => state.users[0], // Mock auth

  getCollections: (userId: string) => state.collections.filter(c => c.ownerId === userId),
  
  getBoards: (userId: string) => state.boards.filter(b => b.ownerId === userId),
  
  getPins: (filter?: { collectionId?: string; boardId?: string; tag?: string; favorites?: boolean }, sort: SortOption = 'newest', searchQuery?: string) => {
    let filteredPins = [...state.pins];
    
    // Filtering
    if (filter?.favorites) {
      filteredPins = filteredPins.filter(p => p.favorite);
    } else if (filter?.boardId) {
      filteredPins = filteredPins.filter(p => p.boardIds.includes(filter.boardId!));
    } else if (filter?.collectionId) {
      // Get all boards in this collection
      const boardIds = state.boards
        .filter(b => b.collectionId === filter.collectionId)
        .map(b => b.id);
      // Check if pin is in ANY of the boards belonging to the collection
      filteredPins = filteredPins.filter(p => p.boardIds.some(bid => boardIds.includes(bid)));
    } else if (filter?.tag) {
      filteredPins = filteredPins.filter(p => p.tags.includes(filter.tag!));
    }

    // Search
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filteredPins = filteredPins.filter(p => {
        return (
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          p.link?.toLowerCase().includes(q) ||
          p.location?.name.toLowerCase().includes(q) ||
          p.location?.address?.toLowerCase().includes(q)
        );
      });
    }
    
    // Sorting
    switch (sort) {
      case 'newest':
        filteredPins.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'oldest':
        filteredPins.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'az':
        filteredPins.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'za':
        filteredPins.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'random':
        // Simple shuffle using a stable seed approach per session or just random
        filteredPins.sort(() => Math.random() - 0.5);
        break;
      default:
        filteredPins.sort((a, b) => b.createdAt - a.createdAt);
    }

    return filteredPins;
  },

  getAllPins: () => [...state.pins],

  addPin: (pin: Omit<Pin, 'id' | 'createdAt' | 'favorite'>) => {
    const newPin: Pin = {
      ...pin,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: Date.now(),
      favorite: false,
      gallery: pin.gallery || [],
      boardIds: pin.boardIds || [] 
    };
    state.pins = [newPin, ...state.pins];
    return newPin;
  },

  updatePin: (id: string, updates: Partial<Pin>) => {
    state.pins = state.pins.map(p => p.id === id ? { ...p, ...updates } : p);
  },
  
  addPinToBoard: (pinId: string, boardId: string) => {
    state.pins = state.pins.map(p => {
        if (p.id === pinId && !p.boardIds.includes(boardId)) {
            return { ...p, boardIds: [...p.boardIds, boardId] };
        }
        return p;
    });
  },

  deletePin: (id: string) => {
    state.pins = state.pins.filter(p => p.id !== id);
  },
  
  // For Undo
  restorePin: (pin: Pin) => {
    state.pins = [pin, ...state.pins];
  },

  restorePins: (pins: Pin[]) => {
    state.pins = [...pins, ...state.pins];
  },

  bulkDeletePins: (ids: string[]) => {
    state.pins = state.pins.filter(p => !ids.includes(p.id));
  },

  // Bulk Operations
  bulkAddTags: (pinIds: string[], tags: string[]) => {
      state.pins = state.pins.map(p => {
          if (pinIds.includes(p.id)) {
              // Add new tags, ensuring unique
              const updatedTags = [...new Set([...p.tags, ...tags])];
              return { ...p, tags: updatedTags };
          }
          return p;
      });
  },

  bulkAddBoard: (pinIds: string[], boardId: string) => {
      state.pins = state.pins.map(p => {
          if (pinIds.includes(p.id)) {
              if (!p.boardIds.includes(boardId)) {
                  return { ...p, boardIds: [...p.boardIds, boardId] };
              }
          }
          return p;
      });
  },

  bulkSetLocation: (pinIds: string[], location: LocationData) => {
      state.pins = state.pins.map(p => {
          if (pinIds.includes(p.id)) {
              return { ...p, location };
          }
          return p;
      });
  },

  mergePins: (pinIds: string[]) => {
      // Find all pins to merge
      const pinsToMerge = state.pins.filter(p => pinIds.includes(p.id));
      if (pinsToMerge.length < 2) return;

      // We'll treat the first one found (based on current sort/order) as the primary/container
      const primaryOriginal = pinsToMerge[0];
      const others = pinsToMerge.slice(1);
      
      // Clone primary to update it
      const primary = { ...primaryOriginal };

      // Collect all images (primary image + galleries)
      let allImages = [primary.imageUrl];
      if (primary.gallery) allImages.push(...primary.gallery);
      
      // Collect all tags and boards
      const allTags = new Set(primary.tags);
      const allBoardIds = new Set(primary.boardIds);

      others.forEach(p => {
          allImages.push(p.imageUrl);
          if (p.gallery) allImages.push(...p.gallery);
          p.tags.forEach(t => allTags.add(t));
          p.boardIds.forEach(b => allBoardIds.add(b));
      });
      
      // Dedup images
      allImages = [...new Set(allImages)];
      
      // The first one remains the cover, the rest go to gallery
      const newCover = allImages[0];
      const newGallery = allImages.slice(1);

      // Update Primary properties
      primary.imageUrl = newCover;
      primary.gallery = newGallery;
      primary.tags = Array.from(allTags);
      primary.boardIds = Array.from(allBoardIds);
      
      // Inherit location if missing
      if (!primary.location) {
          const locPin = others.find(p => p.location);
          if (locPin) primary.location = locPin.location;
      }
      
      // Inherit description if missing
      if (!primary.description) {
          const descPin = others.find(p => p.description);
          if (descPin) primary.description = descPin.description;
      }

      // Inherit link if missing
      if (!primary.link) {
          const linkPin = others.find(p => p.link);
          if (linkPin) primary.link = linkPin.link;
      }

      const otherIds = others.map(p => p.id);
      
      // Update state: Replace primary with merged version, remove others
      state.pins = state.pins
        .map(p => p.id === primary.id ? primary : p)
        .filter(p => !otherIds.includes(p.id));
  },

  toggleFavorite: (id: string) => {
    state.pins = state.pins.map(p => p.id === id ? { ...p, favorite: !p.favorite } : p);
    return state.pins.find(p => p.id === id)?.favorite;
  },

  swapHeroImage: (pinId: string, newHeroUrl: string) => {
    const pin = state.pins.find(p => p.id === pinId);
    if (!pin) return;
    
    // Gather all unique images
    let allImages = [pin.imageUrl];
    if (pin.gallery) allImages.push(...pin.gallery);
    allImages = [...new Set(allImages)]; // Dedup
    
    // Ensure newHeroUrl is in the list
    if (!allImages.includes(newHeroUrl)) return;
    
    // Filter out new hero from the gallery list
    const newGallery = allImages.filter(img => img !== newHeroUrl);
    
    // Update pin
    state.pins = state.pins.map(p => p.id === pinId ? { ...p, imageUrl: newHeroUrl, gallery: newGallery } : p);
  },

  createCollection: (title: string, ownerId: string) => {
    const newCollection: Collection = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      ownerId
    };
    state.collections.push(newCollection);
    return newCollection;
  },

  createBoard: (title: string, collectionId: string | undefined, ownerId: string) => {
    const newBoard: Board = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      collectionId,
      ownerId
    };
    state.boards.push(newBoard);
    return newBoard;
  },

  updateBoard: (id: string, updates: Partial<Board>) => {
    state.boards = state.boards.map(b => b.id === id ? { ...b, ...updates } : b);
  },

  deleteBoard: (id: string) => {
    state.boards = state.boards.filter(b => b.id !== id);
    // Remove board ID from pins
    state.pins = state.pins.map(p => ({
        ...p,
        boardIds: p.boardIds.filter(bid => bid !== id)
    }));
  },

  // Tag Logic
  getTrendingTags: () => {
    const tagCounts: Record<string, number> = {};
    state.pins.forEach(pin => {
      pin.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    
    return Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([tag]) => tag);
  },

  getAllTags: () => {
    const tags = new Set<string>();
    state.pins.forEach(pin => {
      pin.tags.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  },

  // Real Geocoding Service via Nominatim (OpenStreetMap)
  searchLocation: async (query: string): Promise<LocationData[]> => {
    try {
      if (!query.trim()) return [];
      
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const data = await response.json();
      
      return data.map((item: any) => ({
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        name: item.display_name.split(',')[0], // Take first part as name
        address: item.display_name // Full address
      }));
    } catch (e) {
      console.error(e);
      // Fallback
      return [];
    }
  },

  sanitizeUrl: (url: string): string => {
    if (!url) return '';
    try {
      let cleanUrl = url.trim();
      if (!/^https?:\/\//i.test(cleanUrl)) {
        cleanUrl = 'https://' + cleanUrl;
      }
      const parsed = new URL(cleanUrl);
      return parsed.href;
    } catch (e) {
      return '';
    }
  },

  getImagesFromUrl: async (url: string): Promise<string[]> => {
    const sanitized = dataService.sanitizeUrl(url);
    if (!sanitized) return [];

    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const isDirectImage = imageExtensions.some(ext => sanitized.toLowerCase().endsWith(ext));
    if (isDirectImage) return [sanitized];

    try {
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sanitized)}`;
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error("Failed to fetch");
      const htmlText = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, 'text/html');
      
      const images = new Set<string>();

      const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
      if (ogImage) images.add(new URL(ogImage, sanitized).href);

      const twitterImage = doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content');
      if (twitterImage) images.add(new URL(twitterImage, sanitized).href);

      const imgTags = doc.querySelectorAll('img');
      imgTags.forEach(img => {
        const src = img.getAttribute('src');
        if (src) {
           try {
             const absoluteUrl = new URL(src, sanitized).href;
             if (!absoluteUrl.includes('pixel') && !absoluteUrl.includes('icon')) {
                images.add(absoluteUrl);
             }
           } catch(e) {}
        }
      });

      const result = Array.from(images);
      
      if (result.length === 0) {
         return Array.from({ length: 6 }).map((_, i) => 
            `https://picsum.photos/seed/${sanitized.replace(/[^a-z0-9]/gi, '')}${i}/500/500`
         );
      }
      
      return result.slice(0, 20);

    } catch (err) {
      return Array.from({ length: 6 }).map((_, i) => 
        `https://picsum.photos/seed/${sanitized.replace(/[^a-z0-9]/gi, '')}${i}/500/500`
      );
    }
  },

  // Admin Functions
  getSystemSettings: () => state.settings,
  updateSystemSettings: (settings: Partial<SystemSettings>) => {
    state.settings = { ...state.settings, ...settings };
  },

  addUser: (user: Omit<User, 'id' | 'usedQuota'>) => {
    const newUser: User = { ...user, id: Math.random().toString(36), usedQuota: '0GB' };
    state.users.push(newUser);
    return newUser;
  },
  
  deleteUser: (id: string) => {
    state.users = state.users.filter(u => u.id !== id);
  },
  
  resetPassword: (id: string) => {
    console.log(`Password reset for user ${id}`);
    return true;
  }
};