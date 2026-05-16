import { google } from 'googleapis';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';

function getDriveClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!email || !key || !folderId) {
    const missing = [
      !email && 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      !key && 'GOOGLE_PRIVATE_KEY',
      !folderId && 'GOOGLE_DRIVE_FOLDER_ID',
    ].filter(Boolean);
    throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return { drive: google.drive({ version: 'v3', auth }), folderId };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    console.log('[upload-image] file:', file.name, file.type, file.size, 'bytes');

    const { drive, folderId } = getDriveClient();
    console.log('[upload-image] Drive client ready, folder:', folderId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const uploaded = await drive.files.create({
      requestBody: {
        name: `expense_${Date.now()}_${file.name}`,
        parents: [folderId],
      },
      media: { mimeType: file.type, body: stream },
      fields: 'id',
    });

    const fileId = uploaded.data.id!;
    console.log('[upload-image] Uploaded, fileId:', fileId);

    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log('[upload-image] Permission set to public');

    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    return NextResponse.json({ url, fileId });
  } catch (err: any) {
    const message = err?.message ?? String(err);
    const details = err?.response?.data ?? null;
    console.error('[upload-image] ERROR:', message);
    if (details) console.error('[upload-image] API response:', JSON.stringify(details, null, 2));
    return NextResponse.json({ error: message, details }, { status: 500 });
  }
}
