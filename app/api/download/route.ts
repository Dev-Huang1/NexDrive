import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get('fileId');
    const url = searchParams.get('url');

    if (!fileId && !url) {
      return NextResponse.json({ error: 'File ID or URL is required' }, { status: 400 });
    }

    const baseUrl = process.env.MISSKEY_BASE_URL;
    const token = process.env.MISSKEY_TOKEN;

    if (!baseUrl || !token) {
      throw new Error('Misskey configuration missing');
    }

    // 如果提供了fileId，则获取文件信息
    if (fileId) {
      const response = await fetch(`${baseUrl}/api/drive/files/show`, {
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

      const fileInfo = await response.json();
      
      // 重定向到文件URL，并设置Content-Disposition头以指示下载
      const fileResponse = await fetch(fileInfo.url);
      const blob = await fileResponse.blob();
      
      // 创建新的响应，并设置Content-Disposition头
      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileInfo.name)}"`);
      headers.set('Content-Type', fileInfo.type || 'application/octet-stream');
      headers.set('Content-Length', blob.size.toString());
      
      return new NextResponse(blob, {
        status: 200,
        headers
      });
    } 
    // 如果提供了URL，则直接使用
    else if (url) {
      const fileName = url.split('/').pop() || 'download';
      
      const fileResponse = await fetch(url);
      const blob = await fileResponse.blob();
      
      // 创建新的响应，并设置Content-Disposition头
      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      headers.set('Content-Type', blob.type || 'application/octet-stream');
      headers.set('Content-Length', blob.size.toString());
      
      return new NextResponse(blob, {
        status: 200,
        headers
      });
    }
  } catch (error) {
    console.error('Error downloading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}