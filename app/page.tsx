"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@clerk/nextjs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { 
  Bell, 
  Search, 
  Plus, 
  FolderPlus, 
  Upload, 
  Trash2, 
  Edit2, 
  Image as ImageIcon, 
  File, 
  MoreVertical, 
  Loader2 
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog"

// Types for our files and folders
interface FileItem {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
  thumbnailUrl?: string;
}

interface FolderItem {
  id: string;
  name: string;
  path: string;
}

function NavItem({ href, icon, children, active }: { 
  href: string; 
  icon: React.ReactNode; 
  children: React.ReactNode; 
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg", active && "bg-gray-100")}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function FileRow({ file, onDelete, onRename }: { 
  file: FileItem; 
  onDelete: (file: FileItem) => void;
  onRename: (file: FileItem, newName: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);

  const handleRename = () => {
    onRename(file, newName);
    setIsRenaming(false);
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4 text-blue-500" />;
    }
    return <File className="h-4 w-4 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="flex items-center justify-between p-3 border-b hover:bg-gray-50">
      <div className="flex items-center gap-3 flex-1">
        {getFileIcon(file.type)}
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <Input 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)}
              className="h-8"
            />
            <Button size="sm" onClick={handleRename}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setIsRenaming(false)}>Cancel</Button>
          </div>
        ) : (
          <a href={file.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {file.name}
          </a>
        )}
      </div>
      <div className="flex items-center gap-12">
        <span className="text-sm text-gray-500 w-24">{formatFileSize(file.size)}</span>
        <span className="text-sm text-gray-500 w-24">{formatDate(file.createdAt)}</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setIsRenaming(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(file)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function FolderRow({ folder, currentPath, onNavigate }: { 
  folder: FolderItem; 
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  return (
    <div 
      className="flex items-center justify-between p-3 border-b hover:bg-gray-50 cursor-pointer"
      onClick={() => onNavigate(folder.path)}
    >
      <div className="flex items-center gap-3 flex-1">
        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span>{folder.name}</span>
      </div>
      <div className="flex-1"></div>
    </div>
  );
}

function ImageCard({ file, onDelete, onRename }: { 
  file: FileItem; 
  onDelete: (file: FileItem) => void;
  onRename: (file: FileItem, newName: string) => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white">
      <div className="aspect-[4/3] overflow-hidden">
        <Image
          src={file.thumbnailUrl || file.url}
          alt={file.name}
          width={400}
          height={300}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4 flex justify-between items-center">
        <h3 className="font-medium text-gray-900 truncate flex-1">{file.name}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => window.open(file.url, '_blank')}>
              View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const newName = prompt("Enter new name:", file.name);
              if (newName) onRename(file, newName);
            }}>
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => onDelete(file)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function CloudDrive() {
  const { isLoaded, userId, isSignedIn } = useAuth();
  const router = useRouter();
  const [currentView, setCurrentView] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [newFolderModalOpen, setNewFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  
  // Redirect if not signed in
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn, router]);

  // Load files and folders when path changes
  useEffect(() => {
    if (isSignedIn && userId) {
      fetchFilesAndFolders();
    }
  }, [isSignedIn, userId, currentPath, currentView]);

  const fetchFilesAndFolders = async () => {
    setIsLoading(true);
    try {
      // Add base path for user bucket
      const bucketPath = `bucket/${userId}${currentPath}`;
      
      // Fetch data from API
      const response = await fetch(`/api/files?path=${encodeURIComponent(bucketPath)}&view=${currentView}`);
      if (!response.ok) throw new Error('Failed to fetch files');
      
      const data = await response.json();
      
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchFilesAndFolders();
      return;
    }
    
    setIsLoading(true);
    try {
      const bucketPath = `bucket/${userId}`;
      const response = await fetch(`/api/search?path=${encodeURIComponent(bucketPath)}&query=${encodeURIComponent(searchQuery)}&view=${currentView}`);
      
      if (!response.ok) throw new Error('Search failed');
      
      const data = await response.json();
      setFiles(data.files || []);
      setFolders(data.folders || []);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const files = Array.from(e.target.files);
    setUploadingFiles(files);
    
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('files', file);
      });
      
      formData.append('path', `bucket/${userId}${currentPath}`);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      fetchFilesAndFolders();
    } catch (error) {
      console.error('Error uploading files:', error);
    } finally {
      setUploadingFiles([]);
      setUploadModalOpen(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: `bucket/${userId}${currentPath}`,
          name: newFolderName,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to create folder');
      
      setNewFolderName("");
      setNewFolderModalOpen(false);
      fetchFilesAndFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleDeleteFile = async (file: FileItem) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    
    try {
      const response = await fetch(`/api/files?fileId=${encodeURIComponent(file.id)}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) throw new Error('Failed to delete file');
      
      fetchFilesAndFolders();
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const handleRenameFile = async (file: FileItem, newName: string) => {
    try {
      const response = await fetch(`/api/files`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: file.id,
          newName
        }),
      });
      
      if (!response.ok) throw new Error('Failed to rename file');
      
      fetchFilesAndFolders();
    } catch (error) {
      console.error('Error renaming file:', error);
    }
  };

  const handleNavigate = (path: string) => {
    setCurrentPath(path);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const newPath = parts.length === 0 ? '/' : '/' + parts.join('/') + '/';
    setCurrentPath(newPath);
  };

  // Get breadcrumb paths
  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const crumbs = [{ name: 'Home', path: '/' }];
    
    let currentPathBuild = '/';
    for (let i = 0; i < parts.length; i++) {
      currentPathBuild += parts[i] + '/';
      crumbs.push({
        name: parts[i],
        path: currentPathBuild
      });
    }
    
    return crumbs;
  };

  if (!isLoaded || !isSignedIn) {
    return <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>;
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar */}
      <div className="w-64 border-r bg-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">Cloud Drive</h1>
        </div>
        <nav className="space-y-1 px-2">
          <NavItem 
            href="#" 
            icon={<File className="h-4 w-4" />} 
            active={currentView === "all"}
            onClick={() => setCurrentView("all")}
          >
            All Files
          </NavItem>
          <NavItem 
            href="#" 
            icon={<ImageIcon className="h-4 w-4" />}
            active={currentView === "images"}
            onClick={() => setCurrentView("images")}
          >
            Images
          </NavItem>
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div className="w-96">
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                type="search" 
                placeholder="Search files..." 
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button variant="ghost" className="ml-2" onClick={handleSearch}>
                Search
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
            <div className="h-8 w-8 overflow-hidden rounded-full">
              <Image
                src="/placeholder.svg"
                alt="Avatar"
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </header>

        <div className="p-6 flex-1 overflow-auto">
          <div className="mb-6 flex items-center gap-4">
            <Dialog open={uploadModalOpen} onOpenChange={setUploadModalOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Files
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Files</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    type="file" 
                    multiple 
                    onChange={handleFileUpload}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  />
                  {uploadingFiles.length > 0 && (
                    <div className="mt-4">
                      <p>Uploading {uploadingFiles.length} file(s)...</p>
                      <div className="w-full h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={newFolderModalOpen} onOpenChange={setNewFolderModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <FolderPlus className="h-4 w-4" />
                  New Folder
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Folder</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    placeholder="Folder name" 
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewFolderModalOpen(false)}>Cancel</Button>
                  <Button onClick={handleCreateFolder}>Create</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-2 mb-6">
            {getBreadcrumbs().map((crumb, index, array) => (
              <div key={crumb.path} className="flex items-center">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-1 h-auto text-blue-600 hover:text-blue-800"
                  onClick={() => handleNavigate(crumb.path)}
                >
                  {crumb.name}
                </Button>
                {index < array.length - 1 && <span className="mx-1">/</span>}
              </div>
            ))}
          </div>

          {/* View selector */}
          <div className="mb-6">
            <Tabs value={currentView} onValueChange={setCurrentView}>
              <TabsList>
                <TabsTrigger value="all">All Files</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <>
              {currentView === "all" ? (
                <div className="border rounded-lg overflow-hidden">
                  {currentPath !== '/' && (
                    <div 
                      className="flex items-center gap-3 p-3 border-b hover:bg-gray-50 cursor-pointer"
                      onClick={navigateUp}
                    >
                      <svg className="w-4 h-4 text-gray-400 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 15l7-7 7 7"
                        />
                      </svg>
                      <span>Parent Directory</span>
                    </div>
                  )}
                  
                  {/* List headers */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 border-b font-medium">
                    <div className="flex-1">Name</div>
                    <div className="flex items-center gap-12">
                      <span className="w-24">Size</span>
                      <span className="w-24">Date</span>
                      <span className="w-8"></span> {/* Actions column */}
                    </div>
                  </div>
                  
                  {/* Folders */}
                  {folders.map(folder => (
                    <FolderRow 
                      key={folder.id} 
                      folder={folder} 
                      currentPath={currentPath}
                      onNavigate={handleNavigate}
                    />
                  ))}
                  
                  {/* Files */}
                  {files.map(file => (
                    <FileRow 
                      key={file.id} 
                      file={file} 
                      onDelete={handleDeleteFile}
                      onRename={handleRenameFile}
                    />
                  ))}
                  
                  {folders.length === 0 && files.length === 0 && (
                    <div className="p-8 text-center text-gray-500">
                      <p>This folder is empty</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {files.length > 0 ? (
                    files.map(file => (
                      <ImageCard 
                        key={file.id} 
                        file={file} 
                        onDelete={handleDeleteFile}
                        onRename={handleRenameFile}
                      />
                    ))
                  ) : (
                    <div className="col-span-full p-8 text-center text-gray-500">
                      <p>No images found</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
