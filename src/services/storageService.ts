import { PinnedImage, Board, PinGroup, Collection, DiscoverySource } from '../types';

const API = '/api'; // Proxied by Nginx to the backend container

class StorageService {
  async init(): Promise<void> {
    // Backend handles database initialization automatically.
    return Promise.resolve();
  }

  // --- Images ---

  async getAllImages(): Promise<PinnedImage[]> {
    const res = await fetch(`${API}/images`);
    if (!res.ok) throw new Error('Failed to fetch images');
    return res.json();
  }

  async saveImage(image: PinnedImage, file?: File): Promise<PinnedImage> {
    let res;
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      // We send the metadata as a JSON string field named 'data'
      formData.append('data', JSON.stringify(image));
      
      res = await fetch(`${API}/images`, {
        method: 'POST',
        body: formData,
      });
    } else {
      // For metadata-only updates (like pinning to a board, changing description)
      const res = await fetch(`${API}/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: JSON.stringify(image) })
      });
    }

    if (!res.ok) throw new Error('Failed to save image');
    return await res.json();
  }

  async updateImage(image: PinnedImage): Promise<void> {
    // Our backend UPSERT logic handles updates via the same POST endpoint
    return this.saveImage(image);
  }

  async deleteImage(id: string): Promise<void> {
    const res = await fetch(`${API}/images/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete image');
  }

  // --- Boards ---

  async getAllBoards(): Promise<Board[]> {
    const res = await fetch(`${API}/boards`);
    if (!res.ok) throw new Error('Failed to fetch boards');
    return res.json();
  }

  async saveBoard(board: Board): Promise<void> {
    const res = await fetch(`${API}/boards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board)
    });
    if (!res.ok) throw new Error('Failed to save board');
  }

  async updateBoard(board: Board): Promise<void> {
    return this.saveBoard(board);
  }

  async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`${API}/boards/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete board');
  }

  // --- Groups (Pin Groups) ---

  async getAllGroups(): Promise<PinGroup[]> {
    const res = await fetch(`${API}/groups`);
    if (!res.ok) throw new Error('Failed to fetch groups');
    return res.json();
  }

  async saveGroup(group: PinGroup): Promise<void> {
    const res = await fetch(`${API}/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(group)
    });
    if (!res.ok) throw new Error('Failed to save group');
  }

  async deleteGroup(id: string): Promise<void> {
    const res = await fetch(`${API}/groups/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete group');
  }

  // --- Collections ---

  async getAllCollections(): Promise<Collection[]> {
    const res = await fetch(`${API}/collections`);
    if (!res.ok) throw new Error('Failed to fetch collections');
    return res.json();
  }

  async saveCollection(collection: Collection): Promise<void> {
    const res = await fetch(`${API}/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collection)
    });
    if (!res.ok) throw new Error('Failed to save collection');
  }

  async deleteCollection(id: string): Promise<void> {
    const res = await fetch(`${API}/collections/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete collection');
  }

  // --- Discovery Sources ---

  async getAllDiscoverySources(): Promise<DiscoverySource[]> {
    const res = await fetch(`${API}/discovery`);
    if (!res.ok) throw new Error('Failed to fetch discovery sources');
    return res.json();
  }

  async saveDiscoverySource(source: DiscoverySource): Promise<void> {
    const res = await fetch(`${API}/discovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(source)
    });
    if (!res.ok) throw new Error('Failed to save discovery source');
  }

  async deleteDiscoverySource(id: string): Promise<void> {
    const res = await fetch(`${API}/discovery/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete discovery source');
  }

  // --- Backup & Restore (Restored for Build) ---

  async exportData(): Promise<string> {
    // Client-side aggregation
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
  }

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      
      // We process serially to avoid overloading the backend
      if (data.collections) {
          for (const c of data.collections) await this.saveCollection(c);
      }
      if (data.boards) {
          for (const b of data.boards) await this.saveBoard(b);
      }
      if (data.images) {
          // Note: This only restores metadata. Actual files must be manually migrated in Docker.
          for (const img of data.images) await this.saveImage(img);
      }
      if (data.groups) {
          for (const g of data.groups) await this.saveGroup(g);
      }
      if (data.discovery) {
          for (const d of data.discovery) await this.saveDiscoverySource(d);
      }
    } catch (e) {
      console.error("Import failed", e);
      throw new Error("Failed to parse backup file");
    }
  }
}

export const storage = new StorageService();