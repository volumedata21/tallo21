import { PinnedImage, Board, PinGroup, Collection, DiscoverySource } from '../../shared/types';

const API = '/api';

// Helper to log and validate server responses
const fetchAndLog = async (url: string, name: string) => {
  try {
    console.log(`[Storage] Fetching ${name}...`);
    const res = await fetch(url);
    
    if (!res.ok) {
      console.error(`[Storage] Server Error on ${name}: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(`[Storage] Raw Response:`, text);
      return []; // Return empty array on error to prevent crash
    }

    const data = await res.json();
    console.log(`[Storage] Received ${name}:`, data);
    
    // CRITICAL FIX: If server returns null/undefined, force it to []
    if (!Array.isArray(data)) {
      console.warn(`[Storage] WARNING: ${name} expected Array but got:`, typeof data, data);
      return []; 
    }
    
    return data;
  } catch (e) {
    console.error(`[Storage] Network Crash on ${name}:`, e);
    return [];
  }
};

export const storage = {
  async init(): Promise<void> {
    return Promise.resolve();
  },

  // --- Images ---

  async getAllImages(): Promise<PinnedImage[]> {
    return await fetchAndLog(`${API}/images`, 'Images');
  },

  async saveImage(image: PinnedImage, file?: File): Promise<PinnedImage> {
    let res: Response;
    
    console.log("[Storage] Uploading image...", image.id);

    try {
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('data', JSON.stringify(image));
        
        res = await fetch(`${API}/images`, {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch(`${API}/images`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: JSON.stringify(image) })
        });
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("[Storage] Upload Failed:", errText);
        throw new Error(`Upload failed: ${res.statusText}`);
      }

      const data = await res.json();
      console.log("[Storage] Upload Success:", data);
      return data;
    } catch (e) {
      console.error("[Storage] Save Image Error:", e);
      throw e;
    }
  },

  async updateImage(image: PinnedImage): Promise<void> {
    await this.saveImage(image);
  },

  async deleteImage(id: string): Promise<void> {
    await fetch(`${API}/images/${id}`, { method: 'DELETE' });
  },

  // --- Boards ---

  async getAllBoards(): Promise<Board[]> {
    return await fetchAndLog(`${API}/boards`, 'Boards');
  },

  async saveBoard(board: Board): Promise<void> {
    await fetch(`${API}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board)
    });
  },

  async updateBoard(board: Board): Promise<void> {
    await this.saveBoard(board);
  },

  async deleteBoard(id: string): Promise<void> {
    await fetch(`${API}/boards/${id}`, { method: 'DELETE' });
  },

  // --- Groups ---

  async getAllGroups(): Promise<PinGroup[]> {
    return await fetchAndLog(`${API}/groups`, 'Groups');
  },

  async saveGroup(group: PinGroup): Promise<void> {
    await fetch(`${API}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group)
    });
  },

  async deleteGroup(id: string): Promise<void> {
    await fetch(`${API}/groups/${id}`, { method: 'DELETE' });
  },

  // --- Collections ---

  async getAllCollections(): Promise<Collection[]> {
    return await fetchAndLog(`${API}/collections`, 'Collections');
  },

  async saveCollection(collection: Collection): Promise<void> {
    await fetch(`${API}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collection)
    });
  },

  // --- Discovery ---

  async getAllDiscoverySources(): Promise<DiscoverySource[]> {
    return await fetchAndLog(`${API}/discovery`, 'Discovery');
  },

  async saveDiscoverySource(source: DiscoverySource): Promise<void> {
    await fetch(`${API}/discovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    });
  },

  async deleteDiscoverySource(id: string): Promise<void> {
    await fetch(`${API}/discovery/${id}`, { method: 'DELETE' });
  },

  // --- Import/Export ---

  async exportData(): Promise<string> {
    const [images, boards, collections, groups, discovery] = await Promise.all([
        this.getAllImages(),
        this.getAllBoards(),
        this.getAllCollections(),
        this.getAllGroups(),
        this.getAllDiscoverySources()
    ]);
    
    return JSON.stringify({
        version: 5,
        timestamp: Date.now(),
        images,
        boards,
        collections,
        groups,
        discovery
    }, null, 2);
  },

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      if (data.collections) for (const c of data.collections) await this.saveCollection(c);
      if (data.boards) for (const b of data.boards) await this.saveBoard(b);
      if (data.images) for (const img of data.images) await this.saveImage(img);
      if (data.groups) for (const g of data.groups) await this.saveGroup(g);
      if (data.discovery) for (const d of data.discovery) await this.saveDiscoverySource(d);
    } catch (e) {
      console.error("Import failed", e);
      throw new Error('Invalid backup file');
    }
  }
};