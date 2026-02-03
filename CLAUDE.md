# CLAUDE.md

## Project Overview

Mosaic is a decentralized borrowing protocol (fork of Liquity) enabling REEF token holders to obtain liquidity via the MEUR stablecoin without paying interest. Key components: MEUR (EUR-pegged stablecoin), MSIC (governance token), Stability Pool, Trove system with 110% min collateralization.

## Monorepo Structure

- `packages/contracts/` - Solidity smart contracts (0.4.23, 0.5.17, 0.6.11)
- `packages/lib-base/` - Protocol-agnostic TypeScript SDK interfaces
- `packages/lib-ethers/` - Ethers.js v5 SDK implementation
- `packages/lib-react/` - React hooks for lib-ethers
- `packages/lib-subgraph/` - The Graph subgraph types
- `packages/dev-frontend/` - React 17 + Vite + TypeScript web UI
- `packages/subgraph/` - The Graph subgraph definitions
- `packages/fuzzer/` - Property-based testing
- `packages/providers/` - Custom ethers.js providers
- `dev-chain/` - Local OpenEthereum dev blockchain (Docker)

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

- `ALCHEMY_API_KEY` - RPC provider
- `DEPLOYER_PRIVATE_KEY` - Contract deployment
- `ETHERSCAN_API_KEY` - Contract verification
- `CHANNEL` - Deployment channel (default: "default")

## Architecture Notes

- **Smart contracts**: Data silo pattern (ActivePool, DefaultPool, CollSurplusPool), SortedTroves linked list for ICR ordering, dual oracle (Chainlink + Tellor)
- **SDK layers**: lib-base (interfaces) -> lib-ethers (implementation) -> lib-react (hooks)
- **Frontend state**: React context (no Redux), wagmi + ConnectKit for wallet connection
- **Deployments**: Stored in `packages/lib-ethers/deployments/{channel}/{network}.json`
