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

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path') || `bucket/${userId}`;
    const query = searchParams.get('query') || '';
    const view = searchParams.get('view') || 'all';

    // 验证用户只能搜索他们自己的文件夹
    if (!path.startsWith(`bucket/${userId}`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 获取用户bucket的根文件夹ID
    const bucketFolderId = await getBucketFolderId(userId);

    // 调用Misskey API搜索文件
    const response = await fetch(`${baseUrl}/api/drive/files/search-by-name`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        query: query,
        folderId: bucketFolderId,
        limit: 100
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    const data = await response.json() as MisskeyFile[];

    // 处理文件，根据视图类型进行过滤
    let files = data.map((file: MisskeyFile) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl
    }));

    // 如果是图片视图，只保留图片类型的文件
    if (view === 'images') {
      files = files.filter(file => file.type.startsWith('image/'));
    }

    // 由于搜索API中可能不支持直接获取文件夹，这里返回空文件夹数组
    const folders: { id: string; name: string; path: string }[] = []; 

    return NextResponse.json({ files, folders });
  } catch (error) {
    console.error('Error searching files:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 获取用户bucket根文件夹ID的辅助函数
async function getBucketFolderId(userId: string): Promise<string | null> {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // 首先尝试找到"bucket"文件夹
  let bucketFolderId: string | null = null;
  
  // 查找bucket文件夹
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

  if (!bucketResponse.ok && bucketResponse.status !== 404) {
    throw new Error(`Misskey API error: ${bucketResponse.statusText}`);
  }

  const bucketFolders = await bucketResponse.json() as MisskeyFolder[];
  
  if (bucketFolders.length === 0) {
    // 创建bucket文件夹
    const createBucketResponse = await fetch(`${baseUrl}/api/drive/folders/create`, {
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

    if (!createBucketResponse.ok) {
      throw new Error('Failed to create bucket folder');
    }

    const bucketFolder = await createBucketResponse.json() as MisskeyFolder;
    bucketFolderId = bucketFolder.id;
  } else {
    bucketFolderId = bucketFolders[0].id;
  }

  // 然后找到用户ID的文件夹
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

  if (!userResponse.ok && userResponse.status !== 404) {
    throw new Error(`Misskey API error: ${userResponse.statusText}`);
  }

  const userFolders = await userResponse.json() as MisskeyFolder[];
  
  if (userFolders.length === 0) {
    // 创建用户ID文件夹
    const createUserResponse = await fetch(`${baseUrl}/api/drive/folders/create`, {
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

    if (!createUserResponse.ok) {
      throw new Error(`Failed to create user folder for ${userId}`);
    }

    const userFolder = await createUserResponse.json() as MisskeyFolder;
    return userFolder.id;
  } else {
    return userFolders[0].id;
  }
}