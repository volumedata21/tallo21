export interface User {
  id: string;
  username: string;
  email?: string;
  profileImage?: string;
  isAdmin: boolean;
  usedQuota: string;
  maxQuota: string;
  createdAt?: number;
}

export interface Pin {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  gallery: string[]; // Stores additional images for carousel pins
  boardIds: string[]; // Array of Board IDs this pin belongs to
  link?: string;
  location?: LocationData;
  aspectRatio: number; // e.g., 1.5 for 3:2 images
  tags: string[];
  ownerId: string;
  createdAt: number;
  favorite: boolean;
  deletedAt?: number;
}

export interface Board {
  id: string;
  title: string;
  collectionId?: string; // Optional: Boards can belong to a collection
  ownerId: string;
}

export interface Collection {
  id: string;
  title: string;
  ownerId: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

export interface SystemSettings {
  maxUploadSize: string;
  allowedFileTypes?: string[];
  maintenanceMode?: boolean;
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';