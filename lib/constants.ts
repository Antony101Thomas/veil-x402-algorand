export const ALGORAND_TESTNET_NETWORK = "algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=";

// HyperDesk — Cloud PC Rental Platform
export const APP_NAME = 'HyperDesk';

// Rig IDs
export const RIG_IDS = {
  STARTER: 'rig-starter',
  PRO: 'rig-pro',
  BEAST: 'rig-beast',
} as const;

// Pricing (USDC per hour)
export const RIG_PRICES: Record<string, number> = {
  'rig-starter': 0.50,
  'rig-pro': 1.50,
  'rig-beast': 3.00,
};

// Duration options (hours)
export const SESSION_DURATIONS = [1, 2, 4, 8, 24] as const;

// Rewards
export const POINTS_PER_DOLLAR = 10;
export const POINTS_REDEEM_THRESHOLD = 100; // 100 pts = $1
export const FIRST_SESSION_BONUS_PTS = 50;
export const FIVE_STAR_BONUS_PTS = 20;

// x402 price for MVP (the smart-contract enforced price)
export const SESSION_X402_PRICE = '$0.05';