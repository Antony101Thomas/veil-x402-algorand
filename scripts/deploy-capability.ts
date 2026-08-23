/**
 * Deploys VeilCapability to Algorand TestNet and runs an end-to-end
 * smoke test proving out the blueprint's M6 milestone:
 *   createCapability -> getCapability -> isValid(true)
 *   -> revokeCapability -> isValid(false)
 *
 * Usage (PowerShell):
 *   $env:CREATOR_MNEMONIC = "ribbon sunny amazing ... quick"   # AQ3AE4... account
 *   npx tsx scripts/deploy-capability.ts
 *
 * On success, copy the printed VEIL_CAPABILITY_APP_ID into your .env —
 * the resource server, dashboard, and orchestrator all need to point at
 * this same app id.
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils'
import algosdk from 'algosdk'
import { VeilCapabilityFactory } from '../contracts/veil_capability/client'

async function main() {
  const mnemonic = process.env.CREATOR_MNEMONIC
  if (!mnemonic) {
    throw new Error('Set CREATOR_MNEMONIC to the admin/creator account mnemonic (AQ3AE4... in your setup) before running this script.')
  }

  // Connect to Algorand TestNet (public AlgoNode endpoints, no API key needed).
  const algorand = AlgorandClient.testNet()

  // Register the creator/admin account as a signer from its mnemonic.
  const creatorAccount = algosdk.mnemonicToSecretKey(mnemonic)
  const creator = algorand.account.fromMnemonic(mnemonic)
  console.log(`Deploying as creator/admin: ${creator.addr.toString()}`)

  // Build the factory. No appSpec needed - it's embedded in the generated client.
  const factory = new VeilCapabilityFactory({
    algorand,
    defaultSender: creator.addr.toString(),
  })

  console.log('Deploying VeilCapability to TestNet (idempotent create-or-update)...')
  const { appClient, result } = await factory.deploy({
    onUpdate: 'append', // no update logic defined; safe default for the hackathon
    onSchemaBreak: 'append',
  })

  console.log('----------------------------------------')
  console.log(`Deployed. App ID:      ${appClient.appId}`)
  console.log(`App Address:           ${appClient.appAddress}`)
  console.log(`Deploy operation:      ${result.operationPerformed}`)
  console.log('----------------------------------------')
  console.log('Add this to your .env:')
  console.log(`VEIL_CAPABILITY_APP_ID=${appClient.appId}`)
  console.log('----------------------------------------')

  // Make sure the app account can pay for its own box storage MBR.
  // Boxes cost real ALGO to create; fund the app account with a small buffer
  // if this is a fresh deploy (idempotent - safe to run every time).
  console.log('Ensuring app account is funded for box storage (0.5 ALGO buffer)...')
  await algorand.send.payment({
    sender: creator.addr.toString(),
    receiver: appClient.appAddress,
    amount: (500_000).microAlgo(),
  })

  // ---- Smoke test: create -> get -> isValid(true) -> revoke -> isValid(false) ----

  const credentialId = `CRED-${Date.now()}`
  const holder = creator.addr.toString() // for the smoke test, admin and holder are the same account

  console.log(`\nSmoke test starting. credentialId = ${credentialId}`)

  console.log('1) createCapability...')
  await appClient.send.createCapability({
    args: {
      credentialId,
      resourceId: 'premium-data',
      action: 'READ',
      quota: BigInt(5),
      expiryRound: BigInt((await algorand.client.algod.status().do()).lastRound) + BigInt(10000),
      holder,
    },
  })
  console.log('   OK')

  console.log('2) getCapability...')
  const cap = await appClient.send.getCapability({ args: { credentialId } })
  console.log('   ', cap.return)

  console.log('3) isValid (expect true)...')
  const validBefore = await appClient.send.isValid({ args: { credentialId, holder } })
  console.log(`    isValid = ${validBefore.return}`)
  if (validBefore.return !== true) {
    throw new Error('Expected isValid to be true before revocation - something is wrong.')
  }

  console.log('4) revokeCapability (the demo\'s "wow moment" button)...')
  await appClient.send.revokeCapability({ args: { credentialId } })
  console.log('   OK')

  console.log('5) isValid (expect false)...')
  const validAfter = await appClient.send.isValid({ args: { credentialId, holder } })
  console.log(`    isValid = ${validAfter.return}`)
  if (validAfter.return !== false) {
    throw new Error('Expected isValid to be false after revocation - something is wrong.')
  }

  console.log('\nSmoke test passed. M6 confirmed: capability created, read, validated, and revoked on Algorand TestNet.')
}

main().catch((err) => {
  console.error('\nDeploy/smoke-test failed:')
  console.error(err)
  process.exit(1)
})