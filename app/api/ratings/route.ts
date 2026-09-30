import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { FIVE_STAR_BONUS } from '@/lib/rewards';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rigId = searchParams.get('rigId');

  try {
    let query = supabaseServer.from('ratings').select('*').order('created_at', { ascending: false });
    if (rigId) {
      query = query.eq('rig_id', rigId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ ratings: data || [] });
  } catch (err: any) {
    return NextResponse.json({ ratings: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, rigId, stars, review, userId } = await req.json();

    if (!sessionId || !rigId || !stars) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Insert rating
    const { error: ratingErr } = await supabaseServer.from('ratings').insert({
      session_id: sessionId,
      rig_id: rigId,
      stars,
      review: review || '',
      user_id: userId || null,
    });

    if (ratingErr) console.warn('Rating insert warning:', ratingErr);

    let pointsAwarded = 0;
    if (stars === 5 && userId) {
      pointsAwarded += FIVE_STAR_BONUS;
      await supabaseServer.from('point_transactions').insert({
        user_id: userId,
        delta: FIVE_STAR_BONUS,
        reason: 'five_star_rating_bonus',
        ref_id: sessionId,
      });

      const { data: userPts } = await supabaseServer.from('user_points').select('total_points, lifetime_points').eq('user_id', userId).single();
      const currentPts = userPts?.total_points || 0;
      const lifetime = userPts?.lifetime_points || 0;

      await supabaseServer.from('user_points').upsert({
        user_id: userId,
        total_points: currentPts + FIVE_STAR_BONUS,
        lifetime_points: lifetime + FIVE_STAR_BONUS,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, pointsAwarded });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Rating failed' }, { status: 500 });
  }
}
