import { google } from 'googleapis';
import { Readable } from 'stream';
import { NextRequest, NextResponse } from 'next/server';

const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!;

function getDriveClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
  return google.drive({ version: 'v3', auth });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const stream = Readable.from(buffer);

    const drive = getDriveClient();

    const uploaded = await drive.files.create({
      requestBody: {
        name: `expense_${Date.now()}_${file.name}`,
        parents: [FOLDER_ID],
      },
      media: {
        mimeType: file.type,
        body: stream,
      },
      fields: 'id',
    });

    const fileId = uploaded.data.id!;

    // Make file publicly readable
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    const url = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    return NextResponse.json({ url, fileId });
  } catch (err) {
    console.error('Drive upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
