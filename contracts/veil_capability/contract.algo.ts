import { arc4, assert, BoxMap, clone, Global, op, Txn } from '@algorandfoundation/algorand-typescript';

/**
 * On-chain capability record.
 * Mirrors the fields from the Veil blueprint: resource_id, action, quota,
 * expiry_round, holder, revoked. credential_id is the box key, not a field.
 */
class Capability extends arc4.Struct<{
  resourceId: arc4.Str;
  action: arc4.Str;
  quota: arc4.Uint64;
  expiryRound: arc4.Uint64;
  holder: arc4.Address;
  revoked: arc4.Bool;
}> {}

/**
 * Veil capability contract.
 *
 * Scope decision (per the hackathon blueprint's MVP cut list): this contract
 * does NOT decrement quota on-chain per resource access, to avoid per-request
 * txn latency/fees during the demo. Quota usage is tracked off-chain in the
 * database; only issuance, validity checks, and revocation are on-chain.
 * If time allows post-MVP, add a consumeCapability() method that decrements
 * `quota` and asserts it stays >= 0.
 */
export class VeilCapability extends arc4.Contract {
  // Box key = "cap_" + credentialId. One box per issued capability.
  capabilities = BoxMap<arc4.Str, Capability>({ keyPrefix: 'cap_' });

  /**
   * Issue a new capability. Only the app creator (the resource provider /
   * Veil backend account) may issue capabilities - this method should be
   * called by your server after a payment has settled, never directly by
   * an agent.
   */
  @arc4.abimethod()
  createCapability(
    credentialId: arc4.Str,
    resourceId: arc4.Str,
    action: arc4.Str,
    quota: arc4.Uint64,
    expiryRound: arc4.Uint64,
    holder: arc4.Address,
  ): void {
    assert(Txn.sender === Global.creatorAddress, 'only admin can issue capabilities');
    assert(!this.capabilities(credentialId).exists, 'credential id already used');

    this.capabilities(credentialId).value = new Capability({
      resourceId,
      action,
      quota,
      expiryRound,
      holder,
      revoked: new arc4.Bool(false),
    });
  }

  /**
   * Read a capability's full record. Used by the dashboard / capability
   * detail page.
   */
  @arc4.abimethod({ readonly: true })
  getCapability(credentialId: arc4.Str): Capability {
    assert(this.capabilities(credentialId).exists, 'unknown credential');
    return clone(this.capabilities(credentialId).value);
  }

  /**
   * Admin/provider revokes a capability. This is the "wow moment" button in
   * the demo - next access attempt must return false from isValid().
   */
  @arc4.abimethod()
  revokeCapability(credentialId: arc4.Str): void {
    assert(Txn.sender === Global.creatorAddress, 'only admin can revoke');
    assert(this.capabilities(credentialId).exists, 'unknown credential');

    const cap = clone(this.capabilities(credentialId).value);
    cap.revoked = new arc4.Bool(true);
    this.capabilities(credentialId).value = clone(cap);
  }

  /**
   * Called by the resource server on every protected-resource request to
   * decide 200 vs 403. Checks: exists, not revoked, not expired, holder
   * matches the caller presenting the capability.
   */
  @arc4.abimethod({ readonly: true })
  isValid(credentialId: arc4.Str, holder: arc4.Address): arc4.Bool {
    if (!this.capabilities(credentialId).exists) {
      return new arc4.Bool(false);
    }

    const cap = clone(this.capabilities(credentialId).value);
    const notRevoked = !cap.revoked.native;
    const notExpired = cap.expiryRound.asUint64() >= op.Global.round;
    const holderMatches = cap.holder.bytes === holder.bytes;

    return new arc4.Bool(notRevoked && notExpired && holderMatches);
  }
}