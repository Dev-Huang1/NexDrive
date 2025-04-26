export interface MisskeyFile {
    id: string;
    name: string;
    type: string;
    size: number;
    createdAt: string;
    url: string;
    thumbnailUrl?: string;
  }
  
  export interface MisskeyFolder {
    id: string;
    name: string;
    parentId?: string | null;
    createdAt: string;
  }
  
  export interface MisskeyFileUploadResult {
    id: string;
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: string;
    size: number;
    createdAt: string;
  }
  
  export interface DriveSession {
    currentFolderId: string;
    folderPath: string;
    folderHistory: { id: string; name: string }[];
  }