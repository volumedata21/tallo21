export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  quota: string;
  usedQuota: string;
  inviteCode?: string;
  avatarSeed: string;
  homePagePreference?: 'all' | 'created'; // User home page preference

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
  thumbnail?: string; // <--- NEW: Optimized image
  gallery?: string[];
  boardIds: string[];
  link?: string;
  location?: LocationData;
  aspectRatio: number; // Changed to number to support dynamic ratios
  tags: string[];
  ownerId: string;
  createdAt: number;
  favorite: boolean;
  deletedAt?: number; // <--- NEW: Soft Delete support
}

export interface UserSettings {
  hideTitles: boolean;
  hideDescriptions: boolean;
  showTags: boolean;
  darkMode: boolean;
}

export interface SystemSettings {
  maxUploadSize: string;
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';