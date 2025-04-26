// app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { cookies } from 'next/headers';

// 定义类型
interface MisskeyFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
  thumbnailUrl?: string;
}

interface MisskeyFolder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
}

// 定义会话状态接口
interface DriveSession {
  currentFolderId: string;
  folderPath: string;
  folderHistory: { id: string; name: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    
    // 从cookie中获取当前文件夹ID
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = parseCookies(cookieHeader);
    const sessionValue = cookies['drive-session'];
    
    let currentFolderId: string;
    
    if (!sessionValue) {
      // 如果没有会话，获取用户根文件夹ID
      currentFolderId = await getUserRootFolderId(userId);
    } else {
      try {
        const session = JSON.parse(sessionValue) as DriveSession;
        currentFolderId = session.currentFolderId;
      } catch (e) {
        // 如果解析失败，获取用户根文件夹ID
        currentFolderId = await getUserRootFolderId(userId);
      }
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    const uploadResults: MisskeyFileUploadResult[] = [];

    for (const file of files) {
      // 为每个文件创建一个新的FormData
      const fileFormData = new FormData();
      fileFormData.append('i', token);
      fileFormData.append('file', file);
      fileFormData.append('folderId', currentFolderId);

      // 上传到Misskey
      const response = await fetch(`${baseUrl}/api/drive/files/create`, {
        method: 'POST',
        body: fileFormData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file ${file.name}: ${response.statusText}`);
      }

      const result = await response.json() as MisskeyFileUploadResult;
      uploadResults.push(result);
    }

    return NextResponse.json({ success: true, files: uploadResults });
  } catch (error) {
    console.error('Error uploading files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 解析cookie字符串的辅助函数
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

// 获取用户根文件夹ID (bucket/userId)
async function getUserRootFolderId(userId: string): Promise<string> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // 先获取bucket文件夹
  let bucketFolderId: string | null = null;
  
  const bucketResponse = await fetch(`${baseUrl}/api/drive/folders/find`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      name: 'bucket',
      parentId: null
    }),
  });

  if (!bucketResponse.ok) {
    throw new Error(`Misskey API error: ${bucketResponse.statusText}`);
  }

  const bucketFolders = await bucketResponse.json();
  
  if (bucketFolders.length === 0) {
    throw new Error('Bucket folder not found. Please initialize first.');
  }
  
  bucketFolderId = bucketFolders[0].id;

  // 然后获取用户文件夹
  const userResponse = await fetch(`${baseUrl}/api/drive/folders/find`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      name: userId,
      parentId: bucketFolderId
    }),
  });

  if (!userResponse.ok) {
    throw new Error(`Misskey API error: ${userResponse.statusText}`);
  }

  const userFolders = await userResponse.json();
  
  if (userFolders.length === 0) {
    throw new Error('User folder not found. Please initialize first.');
  }
  
  return userFolders[0].id;
}

// 获取文件夹信息
async function getFolderInfo(folderId: string): Promise<MisskeyFolder> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  const response = await fetch(`${baseUrl}/api/drive/folders/show`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      folderId
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  return await response.json();
}

// 获取文件夹内的文件
async function getFolderFiles(folderId: string): Promise<MisskeyFile[]> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  const response = await fetch(`${baseUrl}/api/drive/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      folderId,
      limit: 100
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  return await response.json();
}

// 获取文件夹内的子文件夹
async function getFolderSubfolders(folderId: string): Promise<MisskeyFolder[]> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  const response = await fetch(`${baseUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      folderId,
      limit: 100
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  return await response.json();
}