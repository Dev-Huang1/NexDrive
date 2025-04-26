// app/api/files/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Utility function to get files from Misskey
async function getFilesFromMisskey(path: string, view: string = 'all') {
  const baseUrl = process.env.MISSKEY_BASE_URL;
  const token = process.env.MISSKEY_TOKEN;

  if (!baseUrl || !token) {
    throw new Error('Misskey configuration missing');
  }

  // Call Misskey API to list files
  const response = await fetch(`${baseUrl}/api/drive/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      i: token,
      folder_id: null, // You might need to get folder ID from path
      limit: 100,
      type: view === 'images' ? 'image' : null // Filter by type if images view
    }),
  });

  if (!response.ok) {
    throw new Error(`Misskey API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

// GET handler to list files and folders
export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();

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
    const files = missKeyFiles.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl
    }));

    // For folders, you might need another API call to Misskey
    // This is a placeholder
    const folders = []; // Populate from Misskey folder API

    return NextResponse.json({ files, folders });
  } catch (error: any) {
    console.error('Error fetching files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE handler to remove a file
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = auth();

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
  } catch (error: any) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH handler to rename a file
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, newName } = body;

    if (!fileId || !newName) {
      return NextResponse.json({ error: 'File ID and new name are required' }, { status: 400 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

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
  } catch (error: any) {
    console.error('Error renaming file:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}