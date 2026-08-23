# Veil — Algorand x402 AI Agent Capability Layer

Veil is a full-stack Next.js application that bridges the gap between **autonomous AI agents**, the **x402 protocol (Pay-Per-Request)**, and **Algorand Smart Contracts**. 

It implements an economic authorization layer allowing AI agents to pay for premium API resources using cryptocurrency, and subsequently receive an on-chain "Capability" that grants them session-based access without needing to pay for every single subsequent request.

## 🌟 How It Works (The Disposable Address Model)

1. **Discovery & 402:** The Agent requests a protected resource (`/api/premium-data`). The server denies access with an HTTP `402 Payment Required` and an x402 invoice.
2. **Payment & Atomic Minting:** The Agent pays the invoice on the Algorand TestNet. Once the payment clears, the Resource Server (acting as the Issuer) executes an **Atomic Transaction Group**:
   - Generates a fresh "Disposable Keypair".
   - Funds the disposable account with ALGO for basic fees.
   - Calls the `VeilCapability` smart contract to mint an on-chain capability linked to the disposable account.
3. **Delegation:** The server returns the premium data along with a `credentialId` and the disposable private key.
4. **Verified Access:** For future requests, the Agent requests a cryptographic `nonce` from the server, signs it with the disposable key, and sends it via HTTP headers. The server verifies the signature and checks the Algorand blockchain to ensure the capability is valid, active, and not revoked.

---

## 🛠 Prerequisites

- Node.js v18+
- An Algorand TestNet account funded with **TestNet ALGO** and **TestNet USDC** (Asset ID: `10458941`).
- Supabase (for database mirroring and nonces).

---

## 🚀 Environment Setup

Create a `.env.local` file in the root directory. You must configure the following variables for the system to work end-to-end:

```env
# ---- App Configuration ----
APP_BASE_URL=http://localhost:3000

# ---- LLM Configuration (For the Agent) ----
XAI_API_KEY=your_xai_api_key_here

# ---- Supabase ----
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ---- Algorand / x402 Ecosystem ----
ALGOD_TESTNET_URL=https://testnet-api.algonode.cloud
FACILITATOR_URL=https://x402.goplausible.xyz/facilitator

# The account that receives the x402 payments
PAY_TO=YOUR_PAY_TO_ADDRESS
PAY_TO_MNEMONIC="your pay to mnemonic..."

# The AI Agent's wallet (must be funded with USDC to make payments)
ALGORAND_AGENT_MNEMONIC="your agent mnemonic..."
ALGORAND_PAYER_MNEMONIC="your agent mnemonic..."

# The Resource Server / Admin account (must be funded with ALGO to mint capabilities)
CREATOR_MNEMONIC="your creator mnemonic..."
VEIL_CAPABILITY_APP_ID=YOUR_DEPLOYED_APP_ID
```

---

## ⛓️ Smart Contract Deployment

Before the server can mint capabilities, you must deploy the `VeilCapability` smart contract to the Algorand TestNet.

1. Ensure `CREATOR_MNEMONIC` is set in your environment.
2. Run the deployment script (if provided in your setup, e.g., using AlgoKit or a custom script):
   ```bash
   npx tsx scripts/deploy-capability.ts
   ```
3. Copy the resulting **App ID** into your `.env.local` under `VEIL_CAPABILITY_APP_ID`.

---

## 💰 Funding the Agent

The agent requires **TestNet USDC** (Asset `10458941`) to successfully pay for data. 

1. Ensure the Agent account is opted into the USDC asset.
2. Use an Algorand TestNet Dispenser or another funded wallet to send USDC to the address derived from `ALGORAND_AGENT_MNEMONIC`.
3. If you have a funded sender account, you can use the provided script to transfer funds:
   ```bash
   SENDER_MNEMONIC="your funded mnemonic" npx tsx scripts/fund-payer.ts
   ```

*(Note: If the agent has 0 USDC, the orchestrator will fail with an `underflow` error during transaction simulation).*

---

## 💻 Running the Application

Start the development server:

```bash
npm install
npm run dev
```

### 1. The Agent Flow (UI)
- Navigate to `http://localhost:3000/agent` (you may need to login).
- In the chat interface, type a request (e.g., "Get me the premium data").
- Watch the logs as the Agent hits a 402, automatically orchestrates the x402 payment, obtains the on-chain Capability, and returns the summarized data.

### 2. The Admin Dashboard (UI)
- Navigate to `http://localhost:3000/admin`.
- View dynamically updating active capabilities fetched from the database.
- Click **"Revoke"** to authoritatively call the smart contract on Algorand and kill the capability on-chain.

### 3. Command Line Testing
To run the full agent flow headlessly and verify the capability wiring works:
```bash
npx tsx scripts/prove-x402.ts
```
