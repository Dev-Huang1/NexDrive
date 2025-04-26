import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// 定义类型接口
interface MisskeyFolder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
}

interface MisskeyFileUploadResult {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  size: number;
  createdAt: string;
}

// app/api/upload/route.ts
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

// 根据路径获取文件夹ID的辅助函数
async function getFolderIdFromPath(path: string): Promise<string | null> {
  // 如果是根路径，返回null（表示Misskey的根目录）
  if (path === '/' || !path) return null;

  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // 分解路径
  const parts = path.split('/').filter(Boolean);
  let currentFolderId: string | null = null;

  // 递归查找文件夹
  for (const part of parts) {
    const response = await fetch(`${baseUrl}/api/drive/folders/find`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        name: part,
        parentId: currentFolderId
      }),
    });

    if (!response.ok) {
      // 如果找不到文件夹，尝试创建它
      if (response.status === 404) {
        const createResponse = await fetch(`${baseUrl}/api/drive/folders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            i: token,
            name: part,
            parentId: currentFolderId
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create folder '${part}'`);
        }

        const folder = await createResponse.json() as MisskeyFolder;
        currentFolderId = folder.id;
      } else {
        throw new Error(`Misskey API error: ${response.statusText}`);
      }
    } else {
      const folders = await response.json() as MisskeyFolder[];
      if (folders.length === 0) {
        // 找不到文件夹，创建一个
        const createResponse = await fetch(`${baseUrl}/api/drive/folders/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            i: token,
            name: part,
            parentId: currentFolderId
          }),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create folder '${part}'`);
        }

        const folder = await createResponse.json() as MisskeyFolder;
        currentFolderId = folder.id;
      } else {
        currentFolderId = folders[0].id;
      }
    }
  }

  return currentFolderId;
}