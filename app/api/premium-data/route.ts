import { NextRequest, NextResponse } from "next/server";
import { withX402, x402ResourceServer } from "@x402/next";
import { ExactAvmScheme } from "@x402/avm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ALGORAND_TESTNET_CAIP2 } from "@x402/avm";

const facilitatorClient = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL || "https://x402.org/facilitator",
});

const server = new x402ResourceServer(facilitatorClient)
  .register(ALGORAND_TESTNET_CAIP2, new ExactAvmScheme());

const routeConfig = {
  accepts: {
    scheme: "exact",
    network: ALGORAND_TESTNET_CAIP2,
    payTo: process.env.PAY_TO!,
    price: "$0.05",
  },
  description: "Premium market data resource for demo purposes.",
};

async function handler(request: NextRequest) {
  return NextResponse.json({
    asset: "ALGO",
    price: 0.214,
    change24h: "+4.8%",
    volume: "2.4M",
    marketStatus: "OPEN",
  });
}

export const GET = withX402(handler, routeConfig, server);
