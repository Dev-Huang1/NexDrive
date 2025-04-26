import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// 定义类型接口
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

// GET handler to list files and folders
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || `bucket/${userId}/`;
    const view = searchParams.get('view') || 'all';

    // Validate that user can only access their own folder
    if (!path.startsWith(`bucket/${userId}/`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get files from Misskey
    const missKeyFiles = await getFilesFromMisskey(path, view);

    // Process files and folders
    const files = missKeyFiles.map((file: MisskeyFile) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl
    }));

    // 获取文件夹信息
    const missFolders = await getMissFolders(path);
    const folders = missFolders.map((folder: MisskeyFolder) => ({
      id: folder.id,
      name: folder.name,
      path: folder.parentId ? `${path}${folder.name}/` : `/${folder.name}/`
    }));

    return NextResponse.json({ files, folders });
  } catch (error) {
    console.error('Error fetching files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 获取Misskey文件的辅助函数
async function getFilesFromMisskey(path: string, view: string = 'all'): Promise<MisskeyFile[]> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // 解析路径以获取正确的文件夹ID
  const folderId = await getFolderIdFromPath(path);

  // 调用Misskey API获取文件列表
  const response = await fetch(`${baseUrl}/api/drive/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      folderId: folderId,
      limit: 100,
      type: view === 'images' ? 'image' : undefined // 如果是图片视图则按类型过滤
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data as MisskeyFile[];
}

// 获取Misskey文件夹的辅助函数
async function getMissFolders(path: string): Promise<MisskeyFolder[]> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // 解析路径以获取正确的父文件夹ID
  const parentFolderId = await getFolderIdFromPath(path);

  // 调用Misskey API获取文件夹列表
  const response = await fetch(`${baseUrl}/api/drive/folders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      parentId: parentFolderId,
      limit: 100
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data as MisskeyFolder[];
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

// DELETE handler to remove a file
export async function DELETE(request: NextRequest) {
  try {
    const { userId } =await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Call Misskey API to delete file
    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    const response = await fetch(`${baseUrl}/api/drive/files/delete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        fileId
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH handler to rename a file
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, newName } = body as { fileId: string; newName: string };

    if (!fileId || !newName) {
      return NextResponse.json({ error: 'File ID and new name are required' }, { status: 400 });
    }

    // Call Misskey API to rename file
    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    const response = await fetch(`${baseUrl}/api/drive/files/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        fileId,
        name: newName
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}