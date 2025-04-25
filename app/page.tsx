"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Bell, Grid, LayoutGrid, Plus, Search, Trash2, Download, Share2, RefreshCw } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import type React from "react"

// Misskey API 类型定义
interface MisskeyFile {
  id: string
  createdAt: string
  name: string
  type: string
  size: number
  thumbnailUrl: string | null
  url: string
  folderId: string | null
  folder?: MisskeyFolder
  isSensitive: boolean
}

interface MisskeyFolder {
  id: string
  createdAt: string
  name: string
  parentId: string | null
  foldersCount: number
  filesCount: number
}

// API 客户端
class MisskeyDriveClient {
  private baseUrl: string;
  private token: string;

  constructor(baseUrl: string, token: string) {
    // Remove trailing slashes from baseUrl for consistency
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.token = token;
    console.log('Initializing MisskeyDriveClient with:', { baseUrl, token });
  }

  async request<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    try {
      // Make sure we're including the token properly as Misskey expects it
      const fullParams = {
        i: this.token,  // Misskey uses 'i' for the API token
        ...params
      };
      
      const response = await fetch(`${this.baseUrl}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fullParams)
      });

      // Enhanced error handling
      if (!response.ok) {
        const errorText = await response.text();
        let errorJson;
        try {
          errorJson = JSON.parse(errorText);
          console.error("API Error Details:", errorJson);
        } catch {
          console.error("API Error Response:", errorText);
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      console.error(`API request to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // 获取文件列表
  async getFiles(folderId?: string, limit: number = 30): Promise<MisskeyFile[]> {
    return this.request<MisskeyFile[]>('drive/files', {
      folderId: folderId || null,
      limit
    });
  }

  // 获取文件夹列表
  async getFolders(parentId?: string): Promise<MisskeyFolder[]> {
    return this.request<MisskeyFolder[]>('drive/folders', {
      folderId: parentId || null
    });
  }

  // 创建文件夹
  async createFolder(name: string, parentId?: string): Promise<MisskeyFolder> {
    return this.request<MisskeyFolder>('drive/folders/create', {
      name,
      parentId: parentId || null
    });
  }

  // 上传文件
  async uploadFile(file: File, folderId?: string): Promise<MisskeyFile> {
    const formData = new FormData();
    // Ensure the token is included properly
    formData.append('i', this.token);
    formData.append('file', file);
    
    if (folderId) {
      formData.append('folderId', folderId);
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/drive/files/create`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error("Upload error details:", errorJson);
          if (errorJson.error) {
            errorMessage += ` - ${errorJson.error}`;
          }
        } catch {
          console.error("Upload error response:", errorText);
        }
        
        throw new Error(errorMessage);
      }

      return response.json() as Promise<MisskeyFile>;
    } catch (error) {
      console.error("Upload error:", error);
      throw error;
    }
  }

  // 删除文件
  async deleteFile(fileId: string): Promise<void> {
    await this.request('drive/files/delete', { fileId });
  }

  // 删除文件夹
  async deleteFolder(folderId: string): Promise<void> {
    await this.request('drive/folders/delete', { folderId });
  }

  // 获取收藏的文件
  async getFavoriteFiles(): Promise<MisskeyFile[]> {
    // 注意：这假设 Misskey 有类似功能，可能需要根据实际 API 调整
    return this.request<MisskeyFile[]>('drive/files', { 
      type: 'favorite',
      limit: 30
    });
  }

  // 搜索文件
  async searchFiles(query: string): Promise<MisskeyFile[]> {
    return this.request<MisskeyFile[]>('drive/files/find', { 
      name: query,
      limit: 30 
    });
  }
}

// 组件 Props 定义
interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon, children, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2 px-3 py-2 text-sm text-gray-700 rounded-lg", active && "bg-gray-100")}
      onClick={onClick}
    >
      {icon}
      <span>{children}</span>
    </Link>
  )
}

function FolderItem({ 
  folder, 
  onSelect 
}: { 
  folder: MisskeyFolder; 
  onSelect: (folder: MisskeyFolder) => void; 
}) {
  return (
    <div 
      onClick={() => onSelect(folder)} 
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
    >
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span>{folder.name}</span>
      <span className="ml-auto text-xs text-gray-400">
        {folder.filesCount} 文件
      </span>
    </div>
  )
}

function FileCard({ 
  file, 
  onAction 
}: { 
  file: MisskeyFile; 
  onAction: (action: string, file: MisskeyFile) => void; 
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-white">
      <div className="aspect-[4/3] overflow-hidden">
        <Image
          src={file.thumbnailUrl || "/placeholder.svg"}
          alt={file.name}
          width={400}
          height={300}
          className="h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 truncate">{file.name}</h3>
        <p className="text-sm text-gray-500">
          {new Date(file.createdAt).toLocaleDateString()} • {formatFileSize(file.size)}
        </p>
        <div className="mt-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            onClick={() => onAction('download', file)}
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            onClick={() => onAction('share', file)}
          >
            <Share2 className="h-4 w-4" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0" 
            onClick={() => onAction('delete', file)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// 辅助函数：格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function FileManager() {
  // API 客户端
  const [client, setClient] = useState<MisskeyDriveClient | null>(null);
  
  // 状态
  const [files, setFiles] = useState<MisskeyFile[]>([]);
  const [folders, setFolders] = useState<MisskeyFolder[]>([]);
  const [currentFolder, setCurrentFolder] = useState<MisskeyFolder | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [tabValue, setTabValue] = useState("recent");
  const [isConfigured, setIsConfigured] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // 从环境变量获取 API 配置
  // Add this to your useEffect in the FileManager component
useEffect(() => {
  const newClient = new MisskeyDriveClient(
    process.env.MISSKEY_BASE_URL || 'https://skhvsvsoisc.io',
    process.env.MISSKEY_TOKEN || 'sdhkhvsvjksvksvskbvbkjsd'
  );
  
  setClient(newClient);
  setIsConfigured(true);
}, []);

  // 加载文件和文件夹
  useEffect(() => {
    if (!client || !isConfigured) return;
    
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (tabValue === "recent") {
          const filesData = await client.getFiles(currentFolder?.id);
          setFiles(filesData);
          
          if (currentFolder === null) {
            const foldersData = await client.getFolders();
            setFolders(foldersData);
          } else {
            const foldersData = await client.getFolders(currentFolder.id);
            setFolders(foldersData);
          }
        } else if (tabValue === "starred") {
          const starredFiles = await client.getFavoriteFiles();
          setFiles(starredFiles);
          setFolders([]);
        } else if (tabValue === "shared") {
          // 假设这个功能存在，实际上可能需要调整
          const sharedFiles = await client.getFiles(undefined, 30);
          setFiles(sharedFiles.filter(f => f.isSensitive === false));
          setFolders([]);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [client, currentFolder, tabValue, isConfigured]);

  // 处理搜索
  useEffect(() => {
    if (!client || !searchQuery.trim() || !isConfigured) return;
    
    const searchTimeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await client.searchFiles(searchQuery);
        setFiles(results);
        setFolders([]);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsLoading(false);
      }
    }, 500);
    
    return () => clearTimeout(searchTimeout);
  }, [searchQuery, client, isConfigured]);

  // 处理文件操作
  const handleFileAction = async (action: string, file: MisskeyFile) => {
    if (!client) return;
    
    try {
      if (action === 'download') {
        window.open(file.url, '_blank');
      } else if (action === 'share') {
        navigator.clipboard.writeText(file.url);
      } else if (action === 'delete') {
        if (confirm(`确定要删除 "${file.name}" 吗？`)) {
          await client.deleteFile(file.id);
          setFiles(files.filter(f => f.id !== file.id));
        }
      }
    } catch (error) {
      console.error(`Failed to ${action} file:`, error);
    }
  };

  // 选择文件夹
  const handleFolderSelect = (folder: MisskeyFolder) => {
    setCurrentFolder(folder);
    setSearchQuery("");
  };

  // 返回上一级文件夹
  const navigateUp = async () => {
    if (!client || !currentFolder) return;
    
    try {
      if (currentFolder.parentId) {
        const parentFolder = await client.request<MisskeyFolder>(
          'drive/folders/show', 
          { folderId: currentFolder.parentId }
        );
        setCurrentFolder(parentFolder);
      } else {
        setCurrentFolder(null);
      }
    } catch (error) {
      console.error("Failed to navigate up:", error);
    }
  };

  // 创建新文件夹
  const createNewFolder = async () => {
    if (!client) return;
    
    const name = prompt("请输入文件夹名称");
    if (!name) return;
    
    try {
      const newFolder = await client.createFolder(name, currentFolder?.id);
      setFolders([...folders, newFolder]);
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  // 上传文件
  const uploadFile = async () => {
    if (!client) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      setIsLoading(true);
      
      try {
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          await client.uploadFile(file, currentFolder?.id);
        }
        
        // 重新加载文件列表
        const updatedFiles = await client.getFiles(currentFolder?.id);
        setFiles(updatedFiles);
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    input.click();
  };

  // 刷新数据
  const refreshData = async () => {
    if (!client) return;
    
    setIsLoading(true);
    try {
      const filesData = await client.getFiles(currentFolder?.id);
      setFiles(filesData);
      
      if (currentFolder === null) {
        const foldersData = await client.getFolders();
        setFolders(foldersData);
      } else {
        const foldersData = await client.getFolders(currentFolder.id);
        setFolders(foldersData);
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (configError) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">配置错误</h1>
          <p className="mb-6 text-gray-600">{configError}</p>
          <p className="text-sm text-gray-500">
            请确保在环境变量或配置文件中设置了 MISSKEY_BASE_URL 和 MISSKEY_TOKEN
          </p>
        </div>
      </div>
    );
  }

  if (!isConfigured) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center p-8 max-w-md">
          <h1 className="text-2xl font-bold mb-4">加载中</h1>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
          <p className="mt-4 text-gray-600">正在连接到 Misskey Drive...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-white">
      {/* 侧边栏 */}
      <div className="w-64 border-r bg-white">
        <div className="p-4">
          <h1 className="text-xl font-bold">NexDrive</h1>
        </div>
        <nav className="space-y-1 px-2">
          <NavItem 
            href="#" 
            icon={<LayoutGrid className="h-4 w-4" />} 
            active={tabValue === "recent" && !currentFolder}
            onClick={() => {
              setTabValue("recent");
              setCurrentFolder(null);
            }}
          >
            全部文件
          </NavItem>
          <NavItem
            href="#"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M15 3v18M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            }
            onClick={() => {
              setTabValue("starred");
              setCurrentFolder(null);
            }}
            active={tabValue === "starred"}
          >
            收藏文件
          </NavItem>
          <NavItem
            href="#"
            icon={
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5h6m-3 4v6m-3-3h6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            onClick={() => {
              setTabValue("shared");
              setCurrentFolder(null);
            }}
            active={tabValue === "shared"}
          >
            公开文件
          </NavItem>
          <div className="py-3">
            <div className="px-3 text-xs font-medium uppercase text-gray-500">文件夹</div>
            <div className="mt-2 max-h-48 overflow-y-auto">
              {folders.map(folder => (
                <FolderItem 
                  key={folder.id} 
                  folder={folder} 
                  onSelect={handleFolderSelect} 
                />
              ))}
            </div>
          </div>
        </nav>
      </div>

      {/* 主内容 */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div className="w-96">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input 
                type="search" 
                placeholder="搜索文件..." 
                className="pl-9" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={refreshData} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon">
              <Bell className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="mb-6 flex items-center gap-4">
            {currentFolder && (
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <button onClick={() => setCurrentFolder(null)} className="hover:underline">根目录</button>
                <span className="mx-2">/</span>
                <span className="font-medium text-gray-700">{currentFolder.name}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="ml-2" 
                  onClick={navigateUp}
                >
                  上级目录
                </Button>
              </div>
            )}
          </div>

          <div className="mb-6 flex items-center gap-4">
            <Button className="gap-2" onClick={uploadFile}>
              <Plus className="h-4 w-4" />
              上传文件
            </Button>
            <Button variant="outline" className="gap-2" onClick={createNewFolder}>
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              新建文件夹
            </Button>
          </div>

          <div className="mb-6">
            <Tabs value={tabValue} onValueChange={setTabValue}>
              <TabsList>
                <TabsTrigger value="recent">最近</TabsTrigger>
                <TabsTrigger value="starred">收藏</TabsTrigger>
                <TabsTrigger value="shared">公开</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              {folders.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-medium mb-3">文件夹</h2>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {folders.map(folder => (
                      <div 
                        key={folder.id}
                        onClick={() => handleFolderSelect(folder)}
                        className="group cursor-pointer flex items-center p-3 rounded-lg border bg-white hover:bg-gray-50"
                      >
                        <svg className="w-8 h-8 text-blue-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                        <div>
                          <h3 className="font-medium text-gray-900">{folder.name}</h3>
                          <p className="text-sm text-gray-500">
                            {folder.filesCount} 文件 • {new Date(folder.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h2 className="text-lg font-medium mb-3">文件</h2>
                {files.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {files.map(file => (
                      <FileCard 
                        key={file.id} 
                        file={file}
                        onAction={handleFileAction} 
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <svg 
                      className="mx-auto h-12 w-12 text-gray-400" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={1.5}
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                      />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">没有文件</h3>
                    <p className="mt-1 text-sm text-gray-500">开始上传文件或创建新文件夹</p>
                    <div className="mt-6">
                      <Button onClick={uploadFile}>
                        <Plus className="h-4 w-4 mr-2" />
                        上传文件
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
