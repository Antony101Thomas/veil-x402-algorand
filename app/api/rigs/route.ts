import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { RIG_CONFIGS, Rig } from '@/lib/rigs';

export async function GET() {
  try {
    const { data, error } = await supabaseServer
      .from('rigs')
      .select('*')
      .eq('active', true)
      .order('price_per_hour', { ascending: true });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ rigs: RIG_CONFIGS });
    }

    const rigs: Rig[] = data.map((r: any) => ({
      id: r.id,
      name: r.name,
      gpu: r.gpu,
      cpu: r.cpu,
      ram: r.ram,
      storage: r.storage,
      useCases: r.use_cases || [],
      pricePerHour: Number(r.price_per_hour),
      totalSlots: r.total_slots,
      availableSlots: r.available_slots,
      avgRating: Number(r.avg_rating),
      ratingCount: r.rating_count,
      active: r.active,
    }));

    return NextResponse.json({ rigs });
  } catch (err) {
    return NextResponse.json({ rigs: RIG_CONFIGS });
  }
}
