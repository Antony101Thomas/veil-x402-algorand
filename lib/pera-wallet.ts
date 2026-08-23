// lib/pera-wallet.ts
//
// Thin wrapper around @perawallet/connect. Pera's SDK internally handles
// the QR / deep-link / in-page-popup branching described in the UX doc
// (State 3) based on the environment it's running in — we don't need to
// detect that ourselves.

import { PeraWalletConnect } from '@perawallet/connect'

// Single shared instance — required by the SDK, don't instantiate more than
// one or session state gets out of sync.
export const peraWallet = new PeraWalletConnect({
  chainId: 416002, // Algorand TestNet. Mainnet is 416001.
})

export async function connectWallet(): Promise<string> {
  const accounts = await peraWallet.connect()
  peraWallet.connector?.on('disconnect', () => {
    // Caller should listen for this via onDisconnect below; this just
    // ensures the SDK's internal state clears.
  })
  return accounts[0]
}

export async function reconnectWalletSession(): Promise<string | null> {
  try {
    const accounts = await peraWallet.reconnectSession()
    return accounts[0] ?? null
  } catch {
    return null
  }
}

export function onWalletDisconnect(handler: () => void) {
  peraWallet.connector?.on('disconnect', handler)
}

export function disconnectWallet() {
  peraWallet.disconnect()
}
