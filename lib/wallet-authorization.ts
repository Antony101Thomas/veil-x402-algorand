// lib/wallet-authorization.ts
//
// Builds a real Algorand TestNet transaction that the user signs via Pera
// to authorize the Veil agent. This is a zero-value self-payment carrying
// an authorization note — a real, verifiable, on-chain signature, without
// requiring a rekey or a deployed "authorize" contract method to exist yet.
//
// If you already have a deployed capability contract with a real
// authorize() app-call method, replace buildAuthorizationTxn with an
// ApplicationCallTxn targeting that app id instead — the signing/submit
// flow below stays the same.

import algosdk from 'algosdk'
import { peraWallet } from './pera-wallet'

const ALGOD_BASE_URL =
  process.env.NEXT_PUBLIC_ALGOD_TESTNET_URL ?? 'https://testnet-api.algonode.cloud'

const algodClient = new algosdk.Algodv2('', ALGOD_BASE_URL, '')

export type AuthScope = {
  resourceId: string
  maxPerPayment: number // in ALGO
}

async function buildAuthorizationTxn(address: string, scope: AuthScope) {
  const suggestedParams = await algodClient.getTransactionParams().do()

  const note = new TextEncoder().encode(
    JSON.stringify({
      type: 'veil-authorize',
      resource: scope.resourceId,
      maxPerPayment: scope.maxPerPayment,
      ts: Date.now(),
    })
  )

  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address, // self-payment — no funds move, only the signature + note matter
    amount: 0,
    note,
    suggestedParams,
  })
}

async function buildRevocationTxn(address: string) {
  const suggestedParams = await algodClient.getTransactionParams().do()
  const note = new TextEncoder().encode(
    JSON.stringify({ type: 'veil-revoke', ts: Date.now() })
  )
  return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: address,
    receiver: address,
    amount: 0,
    note,
    suggestedParams,
  })
}

async function signAndSubmit(address: string, txn: algosdk.Transaction): Promise<string> {
  const signedTxns = await peraWallet.signTransaction([[{ txn, signers: [address] }]])
  const { txid } = await algodClient.sendRawTransaction(signedTxns).do()
  await algosdk.waitForConfirmation(algodClient, txid, 8)
  return txid
}

export async function signAuthorization(address: string, scope: AuthScope): Promise<string> {
  const txn = await buildAuthorizationTxn(address, scope)
  return signAndSubmit(address, txn)
}

export async function signRevocation(address: string): Promise<string> {
  const txn = await buildRevocationTxn(address)
  return signAndSubmit(address, txn)
}
