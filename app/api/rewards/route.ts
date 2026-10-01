import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { POINTS_TO_REDEEM, pointsToDollars } from '@/lib/rewards';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ totalPoints: 0, lifetimePoints: 0, transactions: [] });
  }

  try {
    const { data: pts } = await supabaseServer.from('user_points').select('*').eq('user_id', userId).single();
    const { data: txs } = await supabaseServer.from('point_transactions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);

    return NextResponse.json({
      totalPoints: pts?.total_points || 0,
      lifetimePoints: pts?.lifetime_points || 0,
      transactions: txs || []
    });
  } catch (err: any) {
    return NextResponse.json({ totalPoints: 0, lifetimePoints: 0, transactions: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, points } = await req.json();

    if (!points || points < POINTS_TO_REDEEM) {
      return NextResponse.json({ error: `Minimum redemption is ${POINTS_TO_REDEEM} points` }, { status: 400 });
    }

    if (userId) {
      const { data: pts } = await supabaseServer.from('user_points').select('total_points').eq('user_id', userId).single();
      const current = pts?.total_points || 0;

      if (current < points) {
        return NextResponse.json({ error: 'Insufficient points' }, { status: 400 });
      }

      await supabaseServer.from('user_points').update({
        total_points: current - points,
        updated_at: new Date().toISOString()
      }).eq('user_id', userId);

      await supabaseServer.from('point_transactions').insert({
        user_id: userId,
        delta: -points,
        reason: 'Redeemed for Cloud Time Discount',
      });
    }

    const dollarValue = pointsToDollars(points);
    return NextResponse.json({ success: true, dollarValue, pointsRedeemed: points });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Redemption failed' }, { status: 500 });
  }
}
