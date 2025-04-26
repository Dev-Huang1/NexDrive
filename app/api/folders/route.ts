// app/api/folders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { path, name } = await request.json();

    // Validate that user can only create folders in their own directory
    if (!path.startsWith(`bucket/${userId}/`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // Get parent folder ID if needed
    // This may require additional API calls to navigate the folder structure
    // let parentFolderId = null;
    
    // Create folder in Misskey
    const response = await fetch(`${baseUrl}/api/drive/folders/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        i: token,
        name: name,
        // parentId: parentFolderId
      }),
    });

    if (!response.ok) {
      throw new Error(`Misskey API error: ${response.statusText}`);
    }

    const folder = await response.json();
    return NextResponse.json({ success: true, folder });
  } catch (error: any) {
    console.error('Error creating folder:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}