import 'dotenv/config';
import '../lib/load-env';
import algosdk from 'algosdk';

const mnemonic = process.env.ALGORAND_AGENT_MNEMONIC;
if (!mnemonic) {
  throw new Error('Set ALGORAND_AGENT_MNEMONIC in your environment first.');
}

const account = algosdk.mnemonicToSecretKey(mnemonic);
console.log('Address:', account.addr.toString());