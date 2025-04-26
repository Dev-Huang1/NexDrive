// app/api/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const path = formData.get('path') as string;

    // Validate that user can only upload to their own folder
    if (!path.startsWith(`bucket/${userId}/`)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    const uploadResults = [];

    for (const file of files) {
      // Create a new FormData for each file
      const fileFormData = new FormData();
      fileFormData.append('i', token);
      fileFormData.append('file', file);
      
      // Extract folder ID from path if needed
      // fileFormData.append('folderId', folderId);

      // Upload to Misskey
      const response = await fetch(`${baseUrl}/api/drive/files/create`, {
        method: 'POST',
        body: fileFormData,
      });

      if (!response.ok) {
        throw new Error(`Failed to upload file ${file.name}: ${response.statusText}`);
      }

      const result = await response.json();
      uploadResults.push(result);
    }

    return NextResponse.json({ success: true, files: uploadResults });
  } catch (error: any) {
    console.error('Error uploading files:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}