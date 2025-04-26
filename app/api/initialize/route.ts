// app/api/initialize/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 步骤1: 检查是否存在bucket文件夹
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

    if (!bucketResponse.ok && bucketResponse.status !== 404) {
      throw new Error(`Misskey API error: ${bucketResponse.statusText}`);
    }

    const bucketFolders = await bucketResponse.json();
    
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

      const bucketFolder = await createBucketResponse.json();
      bucketFolderId = bucketFolder.id;
    } else {
      bucketFolderId = bucketFolders[0].id;
    }

    // 步骤2: 检查是否存在用户文件夹
    let userFolderId: string | null = null;
    
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

    const userFolders = await userResponse.json();
    
    if (userFolders.length === 0) {
      // 创建用户文件夹
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

      const userFolder = await createUserResponse.json();
      userFolderId = userFolder.id;
    } else {
      userFolderId = userFolders[0].id;
    }

    // 步骤3: 返回用户根文件夹ID
    return NextResponse.json({ 
      rootFolderId: userFolderId,
      bucketFolderId: bucketFolderId
    });
  } catch (error) {
    console.error('Error initializing user drive:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}