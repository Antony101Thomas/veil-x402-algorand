import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
  try {
    const result = await pool.query('SELECT * FROM resources');
    return NextResponse.json({ ok: true, resources: result.rows });
  } catch (error) {
    console.error('DB query failed:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
