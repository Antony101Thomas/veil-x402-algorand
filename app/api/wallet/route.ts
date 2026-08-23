// app/api/wallet/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { fetchWalletBalance } from '@/lib/algorand'

export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get('handle')?.trim()

  if (!handle) {
    return NextResponse.json({ error: 'handle query param is required' }, { status: 400 })
  }

  // Login handle is expected to match agents.name exactly.
  const { data: agent, error: agentError } = await supabaseServer
    .from('agents')
    .select('agent_id, name, wallet_address, status')
    .eq('name', handle)
    .maybeSingle()

  if (agentError) {
    console.error('[wallet] agent lookup error:', agentError)
    return NextResponse.json(
      { error: 'Database error looking up agent', detail: agentError.message },
      { status: 500 }
    )
  }

  if (!agent) {
    return NextResponse.json({ error: `No agent found for handle "${handle}"` }, { status: 404 })
  }

  // Payment history — this is DB-indexed data, not on-chain-authoritative,
  // per the project's blueprint (DB is for UI/indexing, chain is source of truth).
  const { data: payments, error: paymentsError } = await supabaseServer
    .from('payments')
    .select('payment_id, resource_id, amount, currency, tx_id, status, timestamp')
    .eq('agent_id', agent.agent_id)
    .order('timestamp', { ascending: false })

  if (paymentsError) {
    console.error('[wallet] payments lookup error:', paymentsError)
    return NextResponse.json(
      { error: 'Database error loading statement', detail: paymentsError.message },
      { status: 500 }
    )
  }

  // Live on-chain balance.
  let balance
  try {
    balance = await fetchWalletBalance(agent.wallet_address)
  } catch (err) {
    console.error('[wallet] balance fetch error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch on-chain balance', detail: String(err) },
      { status: 502 }
    )
  }

  return NextResponse.json(
    {
      agent: { name: agent.name, walletAddress: agent.wallet_address, status: agent.status },
      balance,
      statement: payments,
    },
    { status: 200 }
  )
}
