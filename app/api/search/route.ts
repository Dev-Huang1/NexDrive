// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

interface MisskeyFile {
  id: string;
  name: string;
  type: string;
  size: number;
  createdAt: string;
  url: string;
  thumbnailUrl: string;
}

interface MisskeyFolder {
  id: string;
  name: string;
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

    // Validate that user can only search in their own folder
    if (!path.startsWith(`bucket/${userId}`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // Call Misskey API to search files
    const response = await fetch(`${baseUrl}/api/drive/files/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        query: query,
        type: view === 'images' ? 'image' : undefined,
        limit: 100
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Process files
    const files = data.map((file: any) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: file.createdAt,
      url: file.url,
      thumbnailUrl: file.thumbnailUrl
    }));

    // For searching folders, you might need another API call
    const folders: MisskeyFolder[] = []; // Populate from Misskey folder search API if available

    return NextResponse.json({ files, folders });
  } catch (error: any) {
    console.error('Error searching files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}