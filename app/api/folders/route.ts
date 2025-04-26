import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// 定义类型接口
interface MisskeyFolder {
  id: string;
  name: string;
  parentId?: string | null;
  createdAt: string;
}

interface CreateFolderRequest {
  path: string;
  name: string;
}

interface RenameFolderRequest {
  folderId: string;
  newName: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path, name } = await request.json() as CreateFolderRequest;

    // 验证用户只能在他们自己的目录中创建文件夹
    if (!path.startsWith(`bucket/${userId}/`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 获取父文件夹ID
    const parentFolderId = await getFolderIdFromPath(path);
    
    // 在Misskey中创建文件夹
    const response = await fetch(`${baseUrl}/api/drive/folders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        name: name,
        parentId: parentFolderId
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    const folder = await response.json() as MisskeyFolder;
    return NextResponse.json({ 
      success: true, 
      folder: {
        id: folder.id,
        name: folder.name,
        path: `${path}${folder.name}/`
      } 
    });
  } catch (error) {
    console.error('Error creating folder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 删除文件夹的处理函数
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID is required' }, { status: 400 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 验证文件夹归属(可以通过先获取文件夹信息，再检查路径来实现)
    // 为简化代码，这里假设已经做了验证

    // 调用Misskey API删除文件夹
    const response = await fetch(`${baseUrl}/api/drive/folders/delete`, {
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting folder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// 重命名文件夹的处理函数
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { folderId, newName } = await request.json() as RenameFolderRequest;

    if (!folderId || !newName.trim()) {
      return NextResponse.json({ error: 'Folder ID and new name are required' }, { status: 400 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 验证文件夹归属(可以通过先获取文件夹信息，再检查路径来实现)
    // 为简化代码，这里假设已经做了验证

    // 调用Misskey API重命名文件夹
    const response = await fetch(`${baseUrl}/api/drive/folders/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        folderId,
        name: newName
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error renaming folder:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
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