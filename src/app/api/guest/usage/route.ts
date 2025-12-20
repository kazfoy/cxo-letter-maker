import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getGuestUsage } from '@/lib/guest-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
    const cookieStore = await cookies();
    const guestId = cookieStore.get('guest_id')?.value;

    if (!guestId) {
        return NextResponse.json({ count: 0, limit: 3, remaining: 3, isLimitReached: false });
    }

    const usage = await getGuestUsage(guestId);
    return NextResponse.json(usage);
}
