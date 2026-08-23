import { config } from 'dotenv';
import path from 'node:path';

// Standalone scripts run via `tsx scripts/foo.ts` are plain Node — they
// don't get Next.js's automatic .env/.env.local loading, so without this
// every process.env.X read in these scripts is undefined even when X is
// set in .env.local. Import this file FIRST in any script that reads env
// vars, e.g.:
//
//   import '../lib/load-env';
//   import algosdk from 'algosdk';
//
// Precedence: a var you set directly in your shell session (e.g.
// `$env:CREATOR_MNEMONIC = "..."` in PowerShell, per deploy-capability.ts's
// own usage comment) always wins — neither call below overrides an
// already-set process.env value. Between the files, .env.local wins over
// .env, since it loads first.
config({ path: path.resolve(process.cwd(), '.env.local') });
config({ path: path.resolve(process.cwd(), '.env') });