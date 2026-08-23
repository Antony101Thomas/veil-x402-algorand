import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { USDC_TESTNET_ASA_ID } from "@x402/avm";
import { ALGORAND_TESTNET_NETWORK } from "@/lib/constants";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
});

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: ALGORAND_TESTNET_NETWORK,
    payTo: process.env.PAY_TO!,
    price: "$0.05",
    extra: { asset: USDC_TESTNET_ASA_ID },
  },
  description: "Premium market data resource for demo purposes.",
} as const;

// memoized so we don't re-initialize on every request in the same runtime
let serverPromise: Promise<x402ResourceServer> | null = null;
function getServer() {
  if (!serverPromise) {
    const server = new x402ResourceServer(facilitatorClient)
      .register(ALGORAND_TESTNET_NETWORK, new ExactAvmScheme());
    serverPromise = server.initialize().then(() => server); // ← the missing call
  }
  return serverPromise;
}

async function handler(request: NextRequest) {
  return NextResponse.json({
    asset: "ALGO",
    price: 0.214,
    change24h: "+4.8%",
    volume: "2.4M",
    marketStatus: "OPEN",
  });
}

export async function GET(request: NextRequest) {
  try {
    const server = await getServer();
    return withX402(handler, routeConfig, server)(request);
  } catch (err) {
    console.error("x402 route init failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}