export type RigTier = 'rig-starter' | 'rig-pro' | 'rig-beast';

export interface Rig {
  id: RigTier;
  name: string;
  gpu: string;
  cpu: string;
  ram: string;
  storage: string;
  useCases: string[];
  pricePerHour: number; // USDC
  totalSlots: number;
  availableSlots: number;
  avgRating: number;
  ratingCount: number;
  active: boolean;
}

export const DURATION_OPTIONS = [
  { label: '1 hour', hours: 1 },
  { label: '2 hours', hours: 2 },
  { label: '4 hours', hours: 4 },
  { label: '8 hours', hours: 8 },
  { label: '24 hours', hours: 24 },
];

export const RIG_CONFIGS: Rig[] = [
  {
    id: 'rig-starter',
    name: 'Starter Rig',
    gpu: 'RTX 3060 12GB',
    cpu: 'AMD Ryzen 5 5600X',
    ram: '16 GB DDR4',
    storage: '256 GB SSD',
    useCases: ['Gaming', 'Light Editing', 'Streaming'],
    pricePerHour: 0.50,
    totalSlots: 10,
    availableSlots: 8,
    avgRating: 4.2,
    ratingCount: 45,
    active: true,
  },
  {
    id: 'rig-pro',
    name: 'Pro Rig',
    gpu: 'RTX 4070 Ti 12GB',
    cpu: 'Intel Core i9-13900K',
    ram: '32 GB DDR5',
    storage: '512 GB NVMe',
    useCases: ['4K Editing', 'AI / ML', 'Heavy Gaming'],
    pricePerHour: 1.50,
    totalSlots: 5,
    availableSlots: 3,
    avgRating: 4.7,
    ratingCount: 128,
    active: true,
  },
  {
    id: 'rig-beast',
    name: 'Beast Rig',
    gpu: 'RTX 4090 24GB',
    cpu: 'AMD Ryzen 9 7950X',
    ram: '64 GB DDR5',
    storage: '1 TB NVMe',
    useCases: ['8K Rendering', 'AAA Gaming', 'AI Training', 'VFX'],
    pricePerHour: 3.00,
    totalSlots: 3,
    availableSlots: 1,
    avgRating: 4.9,
    ratingCount: 67,
    active: true,
  },
];

export function calcSessionPrice(pricePerHour: number, hours: number): number {
  return parseFloat((pricePerHour * hours).toFixed(4));
}

export function calcPointsEarned(totalPriceUsd: number): number {
  return Math.floor(totalPriceUsd * 10);
}
