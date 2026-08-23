// lib/algorand.ts
//
// Minimal Algorand TestNet client using the public AlgoNode REST endpoint
// directly via fetch — avoids adding the algosdk dependency for a single
// read-only balance lookup.

const ALGOD_BASE_URL =
  process.env.ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud'

// TestNet USDC ASA id. Confirm this matches whatever your team is actually
// using for settlement (AlgoKit config / .env) before demo day — set
// USDC_ASA_ID in your environment to override this default.
const USDC_ASA_ID = Number(process.env.USDC_ASA_ID ?? 10458941)

export type WalletBalance = {
  address: string
  algoBalance: number // in ALGO, not microAlgos
  usdcBalance: number // in USDC, not base units
}

type AlgodAccountAsset = {
  'asset-id': number
  amount: number
}

type AlgodAccountResponse = {
  amount: number // microAlgos
  assets?: AlgodAccountAsset[]
}

export async function fetchWalletBalance(address: string): Promise<WalletBalance> {
  const res = await fetch(`${ALGOD_BASE_URL}/v2/accounts/${address}`, {
    // Algod responses change block-to-block; never cache.
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Algod account lookup failed (${res.status}) for ${address}`)
  }

  const data = (await res.json()) as AlgodAccountResponse

  const algoBalance = data.amount / 1_000_000 // microAlgos -> ALGO

  const usdcAsset = data.assets?.find((a) => a['asset-id'] === USDC_ASA_ID)
  // USDC ASA uses 6 decimal places on Algorand, same as microAlgos scaling.
  const usdcBalance = usdcAsset ? usdcAsset.amount / 1_000_000 : 0

  return { address, algoBalance, usdcBalance }
}
