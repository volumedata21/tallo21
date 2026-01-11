export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  usedQuota: string;
  maxQuota: string; // Updated to match Server response
  inviteCode?: string;
  avatarSeed: string;
  apiToken?: string; // For Browser Extension Auth
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
  visibility?: 'private' | 'public'; // <--- NEW: Board Visibility support
  coverImage?: string; // <--- NEW

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
  thumbnail?: string; 
  gallery?: string[];
  boardIds: string[];
  link?: string;
  location?: LocationData;
  aspectRatio: number; 
  tags: string[];
  ownerId: string;
  ownerName?: string;   // <--- NEW: For displaying "Created by..."
  ownerAvatar?: string; // <--- NEW: For displaying owner avatar
  createdAt: number;
  favorite: boolean;
  deletedAt?: number; 
}

export interface UserSettings {
  hideTitles: boolean;
  hideDescriptions: boolean;
  showTags: boolean;
  darkMode: boolean;
}

export interface SystemSettings {
  maxUploadSize: string;
  maxUsers: number; // For limiting signups
  isServerOpen: boolean;
  ssrfWhitelist?: string;
}

export type SortOption = 'newest' | 'oldest' | 'az' | 'za' | 'random';