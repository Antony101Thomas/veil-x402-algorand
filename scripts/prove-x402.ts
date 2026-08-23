import 'dotenv/config';
import { discover_resource, request_resource_with_payment } from '../agent/orchestrator';

async function main() {
  console.log('--- Module 1 proof: 402 -> pay -> 200 ---');

  const resource = await discover_resource();
  console.log('Resource:', resource);

  console.log('\nSending request (will auto-pay on 402)...');
  const result = await request_resource_with_payment(resource);

  console.log('\nFinal status:', result.status);
  console.log('Body:', JSON.stringify(result.body, null, 2));

  console.log('\nAll response headers:');
  for (const [key, value] of result.headers.entries()) {
    console.log(`  ${key}: ${value}`);
  }

  // x402 responses typically echo payment confirmation in a header
  const paymentResponseHeader = result.headers.get('x-payment-response') ?? result.headers.get('payment-response');
  if (paymentResponseHeader) {
    console.log('\nPayment response header (raw):', paymentResponseHeader);
    try {
      const decoded = Buffer.from(paymentResponseHeader, 'base64').toString('utf-8');
      console.log('Payment response header (decoded):', decoded);
    } catch {
      // not base64, ignore
    }
  }

  if (result.status === 200) {
    console.log('\n✅ MODULE 1 PROVEN: real 402 -> pay -> 200 on TestNet.');
  } else {
    console.log('\n❌ Did not reach 200. Status was:', result.status);
  }
}

main().catch((err) => {
  console.error('Proof script failed:', err);
  process.exit(1);
});