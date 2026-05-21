# CLAUDE.md

## Project Overview

Mosaic is a decentralized borrowing protocol (fork of Liquity) targeting the Reef network, enabling REEF token holders to obtain liquidity via the MEUR stablecoin without paying interest. Key components: MEUR (EUR-pegged stablecoin), MSIC (governance token), Stability Pool, Trove system with 110% min collateralization. Note that REEF uses 12 decimals (not 18) — collateral math must account for this.

## Monorepo Structure

- `packages/contracts/` - Solidity smart contracts (0.6.11 and 0.8.24)
- `packages/lib-base/` - Protocol-agnostic TypeScript SDK interfaces
- `packages/lib-ethers/` - Ethers.js v5 SDK implementation; also hosts the CMC price feed updater bot (`scripts/update-price-feed.ts`)
- `packages/lib-react/` - React hooks for lib-ethers
- `packages/dev-frontend/` - React 17 + Vite + TypeScript web UI
- `packages/subgraph/` - The Graph subgraph definitions
- `packages/fuzzer/` - Property-based testing
- `packages/providers/` - Custom ethers.js providers
- `packages/examples/` - Sample SDK usage

## Build & Development Commands

```bash
# Install dependencies
yarn

# Full build
yarn build

# Compile smart contracts
yarn prepare:contracts

# Start local dev chain + deploy contracts
yarn start-dev-chain

# Start frontend dev server
yarn start-dev-frontend

# Full local demo (chain + frontend)
yarn start-demo

# Stop dev chain
yarn stop-dev-chain

# Mainnet fork for testing
yarn start-fork
```

## Testing

```bash
# Run all tests
yarn test

# Smart contract tests (Hardhat + Truffle5)
yarn test-contracts

# SDK tests
yarn test:lib-base
yarn test:lib-ethers

# Frontend tests
yarn test:dev-frontend

# Smart contract coverage
yarn coverage
```

Tests use Hardhat with 2000 pre-funded accounts. Contract tests need `NODE_OPTIONS=--max_old_space_size=4096`.

## Code Style & Conventions

- **TypeScript**: Strict mode, ESLint + `@typescript-eslint`, Prettier (101 char width, no trailing commas, avoid arrow parens)
- **Solidity**: Hardhat compiler, optimizer enabled (100 runs)
- **Commits**: Conventional commits (Angular preset), enforced by commitlint
- **Package namespace**: `@mosaic/*`
- **Module system**: CommonJS in libraries, ESNext in frontend

## Key Environment Variables

- `ALCHEMY_API_KEY` - RPC provider (Ethereum networks)
- `DEPLOYER_PRIVATE_KEY` - Contract deployment
- `ETHERSCAN_API_KEY` - Contract verification
- `CHANNEL` - Deployment channel (default: "default")
- `REEF_TESTNET_RPC_URL` - Reef Pelagia testnet RPC endpoint (used by the `reefTestnet` Hardhat network)
- Price feed updater bot (`packages/lib-ethers/scripts/update-price-feed.ts`):
  - `CMC_API_KEY` - CoinMarketCap API key
  - `PRICE_FEED_ADDRESS` - Deployed PriceFeedTestnet contract
  - `RPC_URL`, `UPDATER_PRIVATE_KEY`
  - `UPDATE_INTERVAL_MS` (default 300_000), `MAX_PRICE_DEVIATION_PERCENT` (default 50)

## Architecture Notes

- **Smart contracts**: Data silo pattern (ActivePool, DefaultPool, CollSurplusPool), SortedTroves linked list for ICR ordering, dual oracle (Chainlink + Tellor) on Ethereum; CMC-fed `PriceFeedTestnet` on Reef testnet
- **SDK layers**: lib-base (interfaces) -> lib-ethers (implementation) -> lib-react (hooks)
- **Frontend state**: React context (no Redux), wagmi + ConnectKit for wallet connection
- **Deployments**: Stored in `packages/lib-ethers/deployments/{channel}/{network}.json`
- **Reef testnet**: Configured as `reefTestnet` Hardhat network in `packages/lib-ethers/hardhat.config.ts`
