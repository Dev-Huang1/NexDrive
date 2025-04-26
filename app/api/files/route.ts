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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('drive-session');
    
    // 获取查询参数
    const searchParams = request.nextUrl.searchParams;
    const view = searchParams.get('view') || 'all';
    const folderId = searchParams.get('folderId');
    const navigateUp = searchParams.get('navigateUp') === 'true';
    
    let session: DriveSession;
    
    // 如果没有会话，初始化一个新会话
    if (!sessionCookie) {
      // 获取用户根文件夹ID
      const rootFolderId = await getUserRootFolderId(userId);
      
      // 初始化会话
      session = {
        currentFolderId: rootFolderId,
        folderPath: '/',
        folderHistory: [{ id: rootFolderId, name: 'Home' }]
      };
    } else {
      session = JSON.parse(sessionCookie.value) as DriveSession;
    }
    
    // 如果指定了文件夹ID，更新当前文件夹
    if (folderId) {
      // 获取文件夹信息
      const folderInfo = await getFolderInfo(folderId);
      
      // 更新会话
      session.currentFolderId = folderId;
      session.folderPath = session.folderPath === '/' 
        ? `/${folderInfo.name}` 
        : `${session.folderPath}/${folderInfo.name}`;
      session.folderHistory.push({ id: folderId, name: folderInfo.name });
    }
    
    // 如果需要导航到上级
    if (navigateUp && session.folderHistory.length > 1) {
      // 移除当前文件夹
      session.folderHistory.pop();
      
      // 设置当前文件夹为历史中的最后一个
      const parentFolder = session.folderHistory[session.folderHistory.length - 1];
      session.currentFolderId = parentFolder.id;
      
      // 更新路径
      if (session.folderHistory.length === 1) {
        session.folderPath = '/';
      } else {
        // 从路径中移除最后一个文件夹名
        const pathParts = session.folderPath.split('/').filter(Boolean);
        pathParts.pop();
        session.folderPath = '/' + pathParts.join('/');
      }
    }
    
    // 保存会话状态到cookie
    cookieStore.set('drive-session', JSON.stringify(session), {
      path: '/',
      maxAge: 24 * 60 * 60, // 1天
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production'
    });
    
    // 获取当前文件夹的文件和子文件夹
    const files = await getFolderFiles(session.currentFolderId);
    const folders = await getFolderSubfolders(session.currentFolderId);
    
    // 格式化响应数据
    const formattedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl
    }));
    
    const formattedFolders = folders.map(folder => ({
      id: folder.id,
      name: folder.name,
      path: folder.name // 客户端会使用这个ID调用API来导航
    }));
    
    return NextResponse.json({
      files: formattedFiles,
      folders: formattedFolders,
      currentPath: session.folderPath
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
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