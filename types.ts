
export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  quota: string; // Changed to string for "20GB" etc.
  usedQuota: string;
  inviteCode?: string;
  avatarSeed: string;
}

export interface Collection {
  id: string;
  title: string;
  ownerId: string;
}

export interface Board {
  id: string;
  title: string;
  collectionId?: string;
  ownerId: string;
}

export interface LocationData {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

export interface Pin {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  gallery?: string[]; // For grouped images
  boardIds: string[]; // Changed to support multiple boards
  link?: string; // Website / Source URL
  location?: LocationData;
  aspectRatio: '1:1' | '3:4' | '9:16';
  tags: string[];
  ownerId: string;
  createdAt: number;
  favorite: boolean;
}

export interface UserSettings {
  hideTitles: boolean;
  hideDescriptions: boolean;
  showTags: boolean;
  darkMode: boolean;
}

export interface SystemSettings {
  maxUploadSize: string; // e.g. "50MB"
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';

// Global declaration for Leaflet to avoid TS errors without specific types
declare global {
  const L: any;
}
