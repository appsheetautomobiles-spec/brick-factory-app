import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function extractPublicId(url: string): string {
  // https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext}
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) throw new Error('Invalid Cloudinary URL');
  return match[1].replace(/\.[^/.]+$/, ''); // strip extension
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl } = await req.json();
    if (!imageUrl) return NextResponse.json({ ok: true });

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!;
    const apiKey = process.env.CLOUDINARY_API_KEY!;
    const apiSecret = process.env.CLOUDINARY_API_SECRET!;

    if (!apiKey || !apiSecret) {
      console.warn('[delete-image] Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET');
      return NextResponse.json({ ok: true });
    }

    const publicId = extractPublicId(imageUrl);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHash('sha1')
      .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const fd = new FormData();
    fd.append('public_id', publicId);
    fd.append('timestamp', String(timestamp));
    fd.append('api_key', apiKey);
    fd.append('signature', signature);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
      method: 'POST',
      body: fd,
    });

    const data = await res.json();
    console.log('[delete-image]', publicId, '→', data.result);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[delete-image] ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
