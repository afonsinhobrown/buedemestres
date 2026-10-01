import { NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { jobId, lat, lng, status } = body;

    if (!jobId || lat === undefined || lng === undefined) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    // Dispara o evento de localização pelo Pusher no canal específico deste serviço
    await pusherServer.trigger(`job-${jobId}`, 'location-update', {
      lat,
      lng,
      status: status || 'driving',
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error broadcasting location:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
