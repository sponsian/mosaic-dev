# MoUSD to MEUR Migration Guide

**Purpose:** Comprehensive inventory of all code, configuration, and documentation that must be updated to rebrand the Mosaic stablecoin from MoUSD (USD-pegged) to MEUR (EUR-pegged).

**Estimated Scope:** ~7,000+ occurrences across ~360 files

---

## Table of Contents

1. [Naming Convention Map](#1-naming-convention-map)
2. [Smart Contracts (Solidity)](#2-smart-contracts-solidity)
3. [Interfaces](#3-interfaces)
4. [Oracle & Price Feed Changes](#4-oracle--price-feed-changes)
5. [TypeScript SDK — lib-base](#5-typescript-sdk--lib-base)
6. [TypeScript SDK — lib-ethers](#6-typescript-sdk--lib-ethers)
7. [TypeScript SDK — lib-react](#7-typescript-sdk--lib-react)
8. [Frontend (dev-frontend)](#8-frontend-dev-frontend)
9. [Subgraph (The Graph)](#9-subgraph-the-graph)
10. [ABI & Generated Type Files](#10-abi--generated-type-files)
11. [Deployment Scripts & Configuration](#11-deployment-scripts--configuration)
12. [Test Files](#12-test-files)
13. [Documentation & Papers](#13-documentation--papers)
14. [Images & Assets](#14-images--assets)
15. [Economic Parameter Review](#15-economic-parameter-review)
16. [Files Requiring Rename](#16-files-requiring-rename)
17. [Recommended Migration Order](#17-recommended-migration-order)

---

## 1. Naming Convention Map

Global find-and-replace mapping. **Order matters** — replace longer strings first to avoid partial matches.

| Current | New | Context |
|---------|-----|---------|
| `MoUSD Stablecoin` | `MEUR Stablecoin` | ERC20 token name (MoUSDToken.sol constructor) |
| `MoUSD` (as token symbol) | `MEUR` | ERC20 symbol |
| `MoUSDToken` | `MEURToken` | Contract name, file name |
| `IMoUSDToken` | `IMEURToken` | Interface name, file name |
| `MoUSDTokenTester` | `MEURTokenTester` | Test contract name |
| `MoUSDTokenCaller` | `MEURTokenCaller` | Test contract name |
| `MoUSDUsdToMoUSDReef` | `MEUREurToMEURReef` | Integration contract |
| `MoUSD_GAS_COMPENSATION` | `MEUR_GAS_COMPENSATION` | Solidity constant |
| `MoUSD_LIQUIDATION_RESERVE` | `MEUR_LIQUIDATION_RESERVE` | SDK constant |
| `MoUSD_MINIMUM_NET_DEBT` | `MEUR_MINIMUM_NET_DEBT` | SDK constant |
| `MoUSD_MINIMUM_DEBT` | `MEUR_MINIMUM_DEBT` | SDK constant |
| `MIN_NET_DEBT` | `MIN_NET_DEBT` | Unchanged (no MoUSD prefix in Solidity) |
| `MoUSDDebt` | `MEURDebt` | Variable names across contracts |
| `MoUSDInStabPool` | `MEURInStabPool` | Local variable names |
| `MoUSDFee` | `MEURFee` | Local variable names |
| `MoUSDGasCompensation` | `MEURGasCompensation` | Struct fields |
| `totalMoUSDDeposits` | `totalMEURDeposits` | State variables |
| `MoUSDLoss` | `MEURLoss` | Variable names |
| `MoUSDLot` | `MEURLot` | Struct fields |
| `getMoUSDDebt` | `getMEURDebt` | Function names |
| `increaseMoUSDDebt` | `increaseMEURDebt` | Function names |
| `decreaseMoUSDDebt` | `decreaseMEURDebt` | Function names |
| `getTotalMoUSDDeposits` | `getTotalMEURDeposits` | Function names |
| `borrowMoUSD` | `borrowMEUR` | SDK method names |
| `repayMoUSD` | `repayMEUR` | SDK method names |
| `sendMoUSD` | `sendMEUR` | SDK method names |
| `withdrawMoUSD` | `withdrawMEUR` | Function names |
| `depositMoUSD` | `depositMEUR` | SDK method names |
| `depositMoUSDInStabilityPool` | `depositMEURInStabilityPool` | SDK method |
| `withdrawMoUSDFromStabilityPool` | `withdrawMEURFromStabilityPool` | SDK method |
| `getMoUSDBalance` | `getMEURBalance` | SDK method |
| `getMoUSDInStabilityPool` | `getMEURInStabilityPool` | SDK method |
| `F_MoUSD` | `F_MEUR` | MSICStaking state variable |
| `increaseF_MoUSD` | `increaseF_MEUR` | MSICStaking function |
| `F_MoUSD_Snapshot` | `F_MEUR_Snapshot` | MSICStaking struct field |
| `MoUSDGain` | `MEURGain` | Variable names |
| `initialMoUSD` | `initialMEUR` | SDK type field |
| `currentMoUSD` | `currentMEUR` | SDK type field |
| `_MoUSDBorrowing` | `_MEURBorrowing` | SDK internal type |
| `_MoUSDRepayment` | `_MEURRepayment` | SDK internal type |
| `_NoMoUSDBorrowing` | `_NoMEURBorrowing` | SDK internal type |
| `_NoMoUSDRepayment` | `_NoMEURRepayment` | SDK internal type |
| `msicToken` (when typed as `IMoUSDToken`) | `meurToken` | Variable references |
| `msicTokenAddress` (for MoUSD) | `meurTokenAddress` | Parameter names |
| `ETHUSD_TELLOR_REQ_ID` | `REEFEUR_TELLOR_REQ_ID` | Oracle constant |
| `MoUSD_USD` | `MEUR_EUR` | Oracle integration |
| `REEF_USD` | `REEF_EUR` | Oracle integration |
| `MoUSD:USD` | `MEUR:EUR` | Comments about peg |
| `REEF:USD` | `REEF:EUR` | Comments about price feed |
| `USD` (in comments about the peg) | `EUR` | Comment text |
| `Dollar` / `dollar` | `Euro` / `euro` | Comment text |
| `bMoUSD` | `bMEUR` | Bonded token references (chicken bonds) |
| `mousd` (directory name) | `meur` | File paths |

---

## 2. Smart Contracts (Solidity)

### Core Contracts (32 files)

#### `packages/contracts/contracts/MoUSDToken.sol` — **HIGH PRIORITY**
- **Rename file** to `MEURToken.sol`
- Contract name: `MoUSDToken` → `MEURToken`
- Token name string: `"MoUSD Stablecoin"` → `"MEUR Stablecoin"`
- Token symbol string: `"MoUSD"` → `"MEUR"`
- All internal references to MoUSD

#### `packages/contracts/contracts/Dependencies/LiquityBase.sol` (MosaicBase)
- Constant: `MoUSD_GAS_COMPENSATION = 200e18` → `MEUR_GAS_COMPENSATION`
- Constant: `MIN_NET_DEBT = 1800e18` (name stays, but value may need EUR adjustment)
- Function: `_getCompositeDebt()` — references `MoUSD_GAS_COMPENSATION`
- Function: `_getNetDebt()` — references `MoUSD_GAS_COMPENSATION`
- Comments referencing "MoUSD" throughout

#### `packages/contracts/contracts/TroveManager.sol`
- Variable: `IMoUSDToken public override msicToken` → `IMEURToken public override meurToken`
- Variable: `L_MoUSDDebt` → `L_MEURDebt`
- Variable: `lastMoUSDDebtError_Redistribution` → `lastMEURDebtError_Redistribution`
- Struct fields: `MoUSDGasCompensation`, `MoUSDLot`, `MoUSDInStabPool`, `remainingMoUSD`, `totalMoUSDToRedeem`, `totalMoUSDSupplyAtStart`
- Events: `MoUSDTokenAddressChanged`
- Functions: All `_requireMoUSDBalanceCoversRedemption`, internal MoUSD references
- Comments: "1 MoUSD:1 USD" → "1 MEUR:1 EUR"

#### `packages/contracts/contracts/BorrowerOperations.sol`
- Variable: `IMoUSDToken public msicToken` → `IMEURToken public meurToken`
- Functions: `withdrawMoUSD()`, `repayMoUSD()`, `_withdrawMoUSD()`, `_repayMoUSD()`
- Events: `MoUSDTokenAddressChanged`, `MoUSDBorrowingFeePaid`
- Internal functions: `_triggerBorrowingFee()` (MoUSD references in comments/params)
- Struct fields: `MoUSDFee`, `netDebtChange` (comments reference MoUSD)

#### `packages/contracts/contracts/StabilityPool.sol`
- Variable: `IMoUSDToken public msicToken` → `IMEURToken public meurToken`
- Variable: `totalMoUSDDeposits` → `totalMEURDeposits`
- Error trackers: `lastMoUSDLossError_Offset`
- Events: `MoUSDTokenAddressChanged`, `StabilityPoolMoUSDBalanceUpdated`
- Functions: `getTotalMoUSDDeposits()`, `getCompoundedMoUSDDeposit()`, `_sendMoUSDtoStabilityPool()`, `_sendMoUSDToDepositor()`, `_decreaseMoUSD()`
- Local variables: `MoUSDLoss`, `MoUSDtoWithdraw`, `MoUSDLossPerUnitStaked`, `MoUSDLossNumerator`

#### `packages/contracts/contracts/ActivePool.sol`
- Variable: `MoUSDDebt` → `MEURDebt`
- Functions: `getMoUSDDebt()`, `increaseMoUSDDebt()`, `decreaseMoUSDDebt()`
- Events: `ActivePoolMoUSDDebtUpdated`

#### `packages/contracts/contracts/DefaultPool.sol`
- Variable: `MoUSDDebt` → `MEURDebt`
- Functions: `getMoUSDDebt()`, `increaseMoUSDDebt()`, `decreaseMoUSDDebt()`
- Events: `DefaultPoolMoUSDDebtUpdated`

#### `packages/contracts/contracts/CollSurplusPool.sol`
- Comments referencing MoUSD

#### `packages/contracts/contracts/GasPool.sol`
- Comments referencing MoUSD gas reserves

#### `packages/contracts/contracts/HintHelpers.sol`
- Variable types and function parameters referencing MoUSD

#### `packages/contracts/contracts/MultiTroveGetter.sol`
- Struct fields referencing MoUSD debt

#### `packages/contracts/contracts/SortedTroves.sol`
- Comments referencing MoUSD (collateral ratio context)

#### `packages/contracts/contracts/MSIC/MSICStaking.sol`
- Variable: `IMoUSDToken public msicToken` → `IMEURToken public meurToken`
- Variable: `F_MoUSD` → `F_MEUR`
- Struct field: `F_MoUSD_Snapshot` → `F_MEUR_Snapshot`
- Function: `increaseF_MoUSD()` → `increaseF_MEUR()`
- Function: `getPendingMoUSDGain()` → `getPendingMEURGain()`
- Events: `MoUSDTokenAddressSet`, `F_MoUSDUpdated`

#### `packages/contracts/contracts/MSIC/CommunityIssuance.sol`
- No direct MoUSD references (MSIC-focused), but check comments

#### `packages/contracts/contracts/Integrations/MoUSDUsdToMoUSDReef.sol` — **MAJOR REWRITE**
- **Rename file** to `MEUREurToMEURReef.sol`
- Contract name: `MoUSDUsdToMoUSDEth` → `MEUREurToMEURReef`
- Oracle feed: `MoUSD_USD` → `MEUR_EUR` (needs EUR Chainlink/oracle address)
- Oracle feed: `REEF_USD` → `REEF_EUR` (needs EUR Chainlink/oracle address)
- Price math: Division logic must use EUR-denominated feeds

### Proxy Scripts (6 files)

- `packages/contracts/contracts/Proxy/BorrowerOperationsScript.sol` — MoUSD function calls
- `packages/contracts/contracts/Proxy/BorrowerWrappersScript.sol` — MoUSD function calls
- `packages/contracts/contracts/Proxy/TokenScript.sol` — MoUSD token references
- `packages/contracts/contracts/Proxy/TroveManagerScript.sol` — MoUSD references
- `packages/contracts/contracts/Proxy/StabilityPoolScript.sol` — MoUSD references
- `packages/contracts/contracts/Proxy/REEFTransferScript.sol` — Check for comments

### LPRewards (1 file)

- `packages/contracts/contracts/LPRewards/Unipool.sol` — MoUSD references

---

## 3. Interfaces

All interfaces in `packages/contracts/contracts/Interfaces/`:

| File | Changes Required |
|------|-----------------|
| `IMoUSDToken.sol` | **Rename file** to `IMEURToken.sol`. Rename interface to `IMEURToken`. |
| `IBorrowerOperations.sol` | Function signatures: `withdrawMoUSD`, `repayMoUSD`, `IMoUSDToken` references |
| `IStabilityPool.sol` | `getTotalMoUSDDeposits()`, `getCompoundedMoUSDDeposit()`, `IMoUSDToken` references |
| `ITroveManager.sol` | `IMoUSDToken` reference, MoUSD-related function signatures |
| `IMSICStaking.sol` | `increaseF_MoUSD()`, `getPendingMoUSDGain()`, `IMoUSDToken` reference |
| `IActivePool.sol` | `getMoUSDDebt()`, `increaseMoUSDDebt()`, `decreaseMoUSDDebt()` |
| `IDefaultPool.sol` | `getMoUSDDebt()`, `increaseMoUSDDebt()`, `decreaseMoUSDDebt()` |
| `IPool.sol` | `getMoUSDDebt()` |
| `IMosaicBase.sol` | Check for MoUSD references |

---

## 4. Oracle & Price Feed Changes

This is the most impactful non-cosmetic change. Switching from USD to EUR peg requires entirely different oracle infrastructure.

### `packages/contracts/contracts/PriceFeed.sol`
- **Constant:** `ETHUSD_TELLOR_REQ_ID = 1` → `REEFEUR_TELLOR_REQ_ID = <new_id>` (new Tellor request ID for REEF/EUR)
- **Comments:** All references to "REEF:USD" → "REEF:EUR"
- **Oracle feeds:** Chainlink aggregator must be configured for REEF/EUR (not REEF/USD)
- **Timeout/deviation constants:** Review whether the same thresholds apply for EUR oracle feeds

### `packages/contracts/contracts/Integrations/MoUSDUsdToMoUSDReef.sol`
- **Complete rewrite required:**
  - `MoUSD_USD` feed → `MEUR_EUR` feed (new address for MEUR/EUR Chainlink oracle)
  - `REEF_USD` feed → `REEF_EUR` feed (new address for REEF/EUR Chainlink oracle)
  - Hardcoded Ethereum mainnet addresses must be replaced with Reef Chain addresses
  - Price conversion math: `MEUR_EUR * 1 ether / REEF_EUR`

### Economic Implications
- The entire protocol assumes a 1:1 peg to a fiat currency. Changing from USD to EUR means:
  - All oracle price feeds return REEF/EUR instead of REEF/USD
  - Redemption math calculates REEF based on EUR value, not USD
  - Liquidation thresholds operate on EUR-denominated collateral ratios
  - All "at face value" comments in TroveManager redemption logic reference EUR

---

## 5. TypeScript SDK — lib-base

**13 files, ~195 occurrences**

### `packages/lib-base/src/constants.ts`
| Current | New |
|---------|-----|
| `MoUSD_LIQUIDATION_RESERVE` | `MEUR_LIQUIDATION_RESERVE` |
| `MoUSD_MINIMUM_NET_DEBT` | `MEUR_MINIMUM_NET_DEBT` |
| `MoUSD_MINIMUM_DEBT` | `MEUR_MINIMUM_DEBT` |
| Comments: "Amount of MoUSD" | "Amount of MEUR" |

### `packages/lib-base/src/Trove.ts` (~47 occurrences)
- Types: `_MoUSDBorrowing`, `_MoUSDRepayment`, `_NoMoUSDBorrowing`, `_NoMoUSDRepayment`
- Properties: `borrowMoUSD`, `repayMoUSD`
- All JSDoc comments mentioning MoUSD

### `packages/lib-base/src/StabilityDeposit.ts` (~32 occurrences)
- Types: `depositMoUSD`, `withdrawMoUSD`, `withdrawAllMoUSD`
- Properties: `initialMoUSD`, `currentMoUSD`
- Methods and JSDoc referencing MoUSD

### `packages/lib-base/src/TransactableLiquity.ts` (~41 occurrences)
- Methods: `borrowMoUSD()`, `repayMoUSD()`, `sendMoUSD()`, `depositMoUSDInStabilityPool()`, `withdrawMoUSDFromStabilityPool()`
- JSDoc throughout

### `packages/lib-base/src/PopulatableLiquity.ts` (~22 occurrences)
- Same method signatures as TransactableLiquity

### `packages/lib-base/src/SendableLiquity.ts` (~12 occurrences)
- Same method signatures

### `packages/lib-base/src/ReadableLiquity.ts` (~9 occurrences)
- Methods: `getMoUSDBalance()`, `getMoUSDInStabilityPool()`, `getTotalRedistributedMoUSD()`

### `packages/lib-base/src/LiquityStore.ts` (~7 occurrences)
- State fields: `mousdBalance`, `mousdInStabilityPool`, etc.

### `packages/lib-base/src/Fees.ts` (~9 occurrences)
- MoUSD fee calculation references

### `packages/lib-base/src/_CachedReadableLiquity.ts` (~6 occurrences)
### `packages/lib-base/src/ObservableLiquity.ts` (~3 occurrences)
### `packages/lib-base/src/Decimal.ts` (~1 occurrence)
### `packages/lib-base/src/MSICStake.ts` (~1 occurrence)

### `packages/lib-base/etc/lib-base.api.md` (~55 occurrences)
- API surface documentation — will be regenerated

---

## 6. TypeScript SDK — lib-ethers

**8 files, ~159 occurrences**

### `packages/lib-ethers/src/contracts.ts`
- Import: `import msicTokenAbi from "../abi/MoUSDToken.json"` → `MEURToken.json`
- Type: `MoUSDToken` → `MEURToken`
- Mapping: `msicToken: MoUSDToken` → `meurToken: MEURToken`

### `packages/lib-ethers/src/PopulatableEthersLiquity.ts` (~78 occurrences)
- All MoUSD transaction builders

### `packages/lib-ethers/src/EthersLiquity.ts` (~24 occurrences)
### `packages/lib-ethers/src/ReadableEthersLiquity.ts` (~18 occurrences)
### `packages/lib-ethers/src/SendableEthersLiquity.ts` (~18 occurrences)
### `packages/lib-ethers/src/ObservableEthersLiquity.ts` (~15 occurrences)
### `packages/lib-ethers/src/BlockPolledLiquityStore.ts` (~2 occurrences)
### `packages/lib-ethers/src/EthersLiquityConnection.ts` (~1 occurrence)

### `packages/lib-ethers/types/index.ts` (~73 occurrences)
- Generated TypeScript types from contract ABIs

---

## 7. TypeScript SDK — lib-react

- `packages/lib-react/src/` — React hooks wrapping lib-ethers methods
- Method names propagate: `useMoUSDBalance()` etc.

---

## 8. Frontend (dev-frontend)

**43+ files, ~308 occurrences**

### Lexicon / Display Strings — **HIGH PRIORITY**

#### `packages/dev-frontend/src/lexicon.ts`
```
STABILITY_POOL_MoUSD → STABILITY_POOL_MEUR
  term: "MoUSD in Stability Pool" → "MEUR in Stability Pool"
  description: "The total MoUSD currently held..." → "The total MEUR currently held..."

MoUSD → MEUR
  term: "MoUSD" → "MEUR"

MoUSD_SUPPLY → MEUR_SUPPLY
  term: "MoUSD supply" → "MEUR supply"
  description: "The total MoUSD minted..." → "The total MEUR minted..."

BORROW_FEE description: "...borrowed amount (in MoUSD)..." → "(in MEUR)"

TVL description: "...given in REEF and USD." → "...given in REEF and EUR."

TCR description: "...the Dollar value..." → "...the Euro value..."
  "...REEF:USD price..." → "...REEF:EUR price..."
```

#### `packages/dev-frontend/src/components/Bonds/lexicon.ts` (~37 occurrences)
- All bond-related display strings referencing MoUSD/bMoUSD → MEUR/bMEUR

#### `packages/dev-frontend/src/strings.ts`
- String literals referencing MoUSD

### Component Files (40+ files)

| Component Category | Files | Key Changes |
|-------------------|-------|-------------|
| **Trove Management** | 10 files | `borrowMoUSD`→`borrowMEUR`, `repayMoUSD`→`repayMEUR`, validation messages, labels |
| **Stability Pool** | 10 files | `depositMoUSD`→`depositMEUR`, `withdrawMoUSD`→`withdrawMEUR`, MoUSD balance displays |
| **Bonds** | 20+ files | `bMoUSD`→`bMEUR`, MoUSD in bond creation/management UI |
| **System Stats** | 3 files | MoUSD supply displays, TVL in USD→EUR |
| **User Account** | 1 file | MoUSD balance display |

### Specific High-Impact Frontend Files

- `src/components/Trove/validation/validateTroveChange.tsx` (27 occurrences) — validation error messages
- `src/components/Bonds/context/api.ts` (72 occurrences) — bond API layer
- `src/components/Bonds/context/BondViewProvider.tsx` (42 occurrences) — bond state
- `src/components/Bonds/lexicon.ts` (37 occurrences) — bond UI strings
- `src/components/Bonds/context/useBondContracts.tsx` (29 occurrences) — contract hooks
- `src/components/BondStats.tsx` (19 occurrences) — bond statistics display
- `src/components/Bonds/views/creating/Details.tsx` (17 occurrences) — bond creation UI
- `src/components/Stability/StabilityDepositEditor.tsx` (12 occurrences) — deposit UI
- `src/components/Stability/StabilityDepositManager.tsx` (10 occurrences) — deposit management

---

## 9. Subgraph (The Graph)

**14 files, ~35 occurrences**

### `packages/subgraph/schema.graphql`
- Comment: `"Total amount of MoUSD paid as borrowing fees"` → `"Total amount of MEUR paid as borrowing fees"`

### Entity Files (`packages/subgraph/src/entities/`)
| File | Changes |
|------|---------|
| `StabilityDeposit.ts` (3) | MoUSD deposit tracking |
| `Global.ts` (4) | System-wide MoUSD stats |
| `Token.ts` (1) | Token entity |
| `Trove.ts` (2) | Trove MoUSD debt |
| `Redemption.ts` (5) | MoUSD redemption amounts |
| `Liquidation.ts` (2) | MoUSD in liquidations |
| `MsicStake.ts` (3) | MoUSD staking gains |

### Mapping Files (`packages/subgraph/src/mappings/`)
| File | Changes |
|------|---------|
| `BorrowerOperations.ts` (4) | MoUSD event handling |
| `TroveManager.ts` (4) | MoUSD event handling |
| `StabilityPool.ts` (1) | MoUSD deposit tracking |
| `Token.ts` (1) | Token event handling |
| `MsicStake.ts` (1) | MoUSD gain tracking |

### `packages/subgraph/subgraph.yaml.js` (3 occurrences)
- Data source configuration referencing MoUSD contracts

---

## 10. ABI & Generated Type Files

### ABI JSON Files (`packages/lib-ethers/abi/`)
| File | Occurrences | Changes |
|------|-------------|---------|
| `MoUSDToken.json` | 1 | **Rename file** to `MEURToken.json` |
| `BorrowerOperations.json` | 2 | Function names in ABI |
| `TroveManager.json` | 3 | Function names and events |
| `StabilityPool.json` | 3 | Function names and events |
| `MSICStaking.json` | 2 | Function names and events |
| `MultiTroveGetter.json` | Multiple | Struct field names |
| `ActivePool.json` | Multiple | Function names and events |
| `DefaultPool.json` | Multiple | Function names and events |
| `HintHelpers.json` | Multiple | Function names |

**Note:** ABI files are auto-generated from contract compilation. After renaming Solidity sources, recompile to regenerate.

### Live Deployment JSON Files (`packages/lib-ethers/live/`)
| File | Action |
|------|--------|
| `IMoUSDToken.json` | **Rename** to `IMEURToken.json` |
| `MoUSDToken.json` | **Rename** to `MEURToken.json` |
| `MoUSDTokenCaller.json` | **Rename** to `MEURTokenCaller.json` |
| `MoUSDTokenTester.json` | **Rename** to `MEURTokenTester.json` |

### Generated Types (`packages/lib-ethers/types/index.ts`)
- ~73 occurrences of MoUSD in auto-generated TypeScript contract types
- **Regenerate after contract compilation**

---

## 11. Deployment Scripts & Configuration

### Deployment Scripts
| File | Occurrences | Changes |
|------|-------------|---------|
| `packages/contracts/mainnetDeployment/mainnetDeployment.js` | 83 | Contract references, deployment variable names |
| `packages/contracts/utils/deploymentHelpers.js` | 10 | Helper references |
| `packages/contracts/utils/mainnetDeploymentHelpers.js` | 3 | Helper references |
| `packages/contracts/utils/truffleDeploymentHelpers.js` | 5 | Helper references |
| `packages/contracts/utils/deploymentGasAndBytecode.js` | 4 | Contract references |
| `packages/lib-ethers/utils/deploy.ts` | 1 | Contract name mapping |
| `packages/contracts/migrations/2_deploy_contracts.js` | 3 | Migration references |
| `packages/contracts/migrations/deploy_contracts_buidler.js` | 3 | Migration references |

### Deployment Output Files
| File | Action |
|------|--------|
| `packages/contracts/mainnetDeployment/mainnetDeploymentOutput.json` | Update contract names |
| `packages/contracts/mainnetDeployment/rinkebyDeploymentOutput.json` | Update contract names |

### Network Deployment Configs (`packages/lib-ethers/deployments/`)
- `default/mainnet.json`, `default/goerli.json`, `default/rinkeby.json`, etc.
- All contain MoUSD contract address mappings
- Will need fresh deployment addresses after contract rename

---

## 12. Test Files

**55+ files, ~4,770+ occurrences**

### JavaScript Tests (`packages/contracts/test/`)
| File | Occurrences | Priority |
|------|-------------|----------|
| `MoUSDTokenTest.js` | 7 | **Rename file** to `MEURTokenTest.js` |
| `BorrowerOperationsTest.js` | 28 | High — core borrowing tests |
| `TroveManagerTest.js` | 3 | High — redemption/liquidation tests |
| `StabilityPoolTest.js` | 2 | High — stability pool tests |
| `MSICStakingFeeRewardsTest.js` | 1 | Medium |
| `ConnectContractsTest.js` | 5 | Medium |
| `GasCompensationTest.js` | Many | Medium |
| `StabilityPool_SPWithdrawalTest.js` | 4 | Medium |
| ~45 more test files | ~4,700+ | Various |

### Gas Test Files (`packages/contracts/gasTest/`)
- Multiple files with MoUSD variable names in gas benchmarking

### Python Test/Simulation Files
| File | Occurrences |
|------|-------------|
| `packages/contracts/tests/simulation_test.py` | 18 |
| `packages/contracts/tests/simulation_helpers.py` | 70 |
| `packages/contracts/macroModel/macro_model.py` | 82 |
| `packages/contracts/tests/helpers.py` | 5 |

### SDK Tests
| File | Occurrences |
|------|-------------|
| `packages/lib-base/test/Trove.test.ts` | 8 |
| `packages/lib-base/test/StabilityDeposit.test.ts` | 2 |
| `packages/lib-ethers/test/` | Multiple files |

### Fuzzer Tests
- `packages/fuzzer/src/` — MoUSD references in fuzz testing

---

## 13. Documentation & Papers

### Core Documentation
| File | Occurrences |
|------|-------------|
| `README.md` | 136 |
| `CLAUDE.md` | 1 |
| `MOSAIC_SECURITY_AUDIT.md` | 36 |
| `SUMMARY.md` | 59+ (contains LUSD references too) |
| `packages/contracts/test-report.md` | 140 |

### Generated API Docs (`docs/sdk/`)
- **155+ files** — auto-generated from SDK source
- All will be regenerated after SDK rename
- Files with `mousd` in filename (62+ files) need file rename

### Academic Papers (`papers/`)
| File | Occurrences |
|------|-------------|
| `whitepaper/Liquity Whitepaper rev. 0.3.tex` | 32 |
| `Scalable_Reward_Distribution_with_Compounding_Stakes.tex` | 12 |
| `Efficient_Order-Preserving_Redistribution_of_Troves.tex` | 3 |

---

## 14. Images & Assets

| File | Action |
|------|--------|
| `images/MoUSD_flows.svg` | **Rename** to `MEUR_flows.svg`, update all text content inside SVG from MoUSD to MEUR |

---

## 15. Economic Parameter Review

Switching from USD to EUR requires reviewing whether protocol parameters remain appropriate:

| Parameter | Current Value | Location | Review Needed |
|-----------|--------------|----------|---------------|
| `MoUSD_GAS_COMPENSATION` | 200 MEUR | `MosaicBase.sol` | EUR equivalent of gas costs on Reef Chain — may need adjustment |
| `MIN_NET_DEBT` | 1,800 MEUR | `MosaicBase.sol` | Minimum debt floor — review for EUR denomination |
| `MoUSD_LIQUIDATION_RESERVE` | 200 MEUR | `lib-base/constants.ts` | Same as gas compensation |
| `MoUSD_MINIMUM_NET_DEBT` | 1,800 MEUR | `lib-base/constants.ts` | Same as MIN_NET_DEBT |
| `REDEMPTION_FEE_FLOOR` | 0.5% | `TroveManager.sol` | Likely unchanged (percentage-based) |
| `MAX_BORROWING_FEE` | 5% | `TroveManager.sol` | Likely unchanged |
| `BOOTSTRAP_PERIOD` | 14 days | `TroveManager.sol` | Likely unchanged |
| Oracle feeds | USD-denominated | `PriceFeed.sol` | **Must change to EUR-denominated feeds** |
| Tellor request ID | `1` (ETH/USD) | `PriceFeed.sol` | **Must change to REEF/EUR ID** |
| Chainlink aggregator | ETH/USD address | `PriceFeed.sol` | **Must change to REEF/EUR aggregator** |

**Note:** As of January 2026, EUR/USD trades at approximately 1.03–1.05. The numeric values of gas compensation and minimum debt should be reviewed but may remain similar since the EUR/USD spread is small.

---

## 16. Files Requiring Rename

| Current Path | New Path |
|-------------|----------|
| `contracts/MoUSDToken.sol` | `contracts/MEURToken.sol` |
| `contracts/Interfaces/IMoUSDToken.sol` | `contracts/Interfaces/IMEURToken.sol` |
| `contracts/Integrations/MoUSDUsdToMoUSDReef.sol` | `contracts/Integrations/MEUREurToMEURReef.sol` |
| `contracts/TestContracts/MoUSDTokenTester.sol` | `contracts/TestContracts/MEURTokenTester.sol` |
| `contracts/TestContracts/MoUSDTokenCaller.sol` | `contracts/TestContracts/MEURTokenCaller.sol` |
| `contracts/test/MoUSDTokenTest.js` | `contracts/test/MEURTokenTest.js` |
| `lib-ethers/abi/MoUSDToken.json` | `lib-ethers/abi/MEURToken.json` |
| `lib-ethers/live/IMoUSDToken.json` | `lib-ethers/live/IMEURToken.json` |
| `lib-ethers/live/MoUSDToken.json` | `lib-ethers/live/MEURToken.json` |
| `lib-ethers/live/MoUSDTokenCaller.json` | `lib-ethers/live/MEURTokenCaller.json` |
| `lib-ethers/live/MoUSDTokenTester.json` | `lib-ethers/live/MEURTokenTester.json` |
| `images/MoUSD_flows.svg` | `images/MEUR_flows.svg` |
| `dev-frontend/.yalc/.../mousd/` | `dev-frontend/.yalc/.../meur/` |

---

## 17. Recommended Migration Order

### Phase 1: Smart Contracts (Critical Path)
1. Rename Solidity files (MoUSDToken.sol → MEURToken.sol, etc.)
2. Update all Solidity contract/interface names, variables, functions, events, and constants
3. Update oracle integration contract for EUR feeds
4. Update PriceFeed.sol Tellor request ID and comments
5. Compile contracts — fix any compilation errors
6. Regenerate ABIs from compilation output

### Phase 2: SDK Layer
7. Update `lib-base/src/constants.ts`
8. Update all type names and method names in lib-base
9. Update lib-ethers contract bindings and method names
10. Update lib-react hooks
11. Rebuild SDK packages

### Phase 3: Frontend
12. Update lexicon files (display strings)
13. Update all React component references
14. Update bond-related components
15. Update validation messages

### Phase 4: Infrastructure
16. Update subgraph schema and mappings
17. Update deployment scripts
18. Update test files (can be done in parallel with SDK/frontend)
19. Regenerate API documentation

### Phase 5: Documentation & Cleanup
20. Update README.md
21. Update CLAUDE.md
22. Update whitepaper references
23. Rename image assets
24. Update any CI/CD configuration referencing MoUSD

---

*This document covers the full scope of the MoUSD → MEUR migration. The total effort spans ~360 files and ~7,000 code locations. A systematic approach following the recommended phase order will minimize cascading errors.*
