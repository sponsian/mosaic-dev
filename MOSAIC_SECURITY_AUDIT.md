# Mosaic Protocol Security Audit Report

**Protocol:** Mosaic (Liquity v1 Fork)
**Target Chain:** Reef Chain (Post-Deep Current Upgrade)
**Audit Date:** January 2026
**Auditor:** Independent Security Review
**Scope:** All Solidity smart contracts in `packages/contracts/contracts/`
**Solidity Versions:** 0.4.23, 0.5.17, 0.6.11

---

## Executive Summary

Mosaic is a fork of the well-audited Liquity v1 protocol, rebranded to use REEF as collateral instead of ETH, MoUSD as the stablecoin (replacing LUSD), and MSIC as the governance token (replacing LQTY). The audit identified **4 Critical/High**, **6 Medium**, and **8 Low** severity findings. Most critical issues stem from variable naming collisions introduced during the fork renaming process, which would cause compilation failures or severe runtime bugs. Additional concerns exist around oracle compatibility on Reef Chain and hardcoded Ethereum mainnet addresses.

---

## High Severity

### H-01: Duplicate State Variable Declaration in `TroveManager.sol` — Compilation Failure / Token Misrouting

**File:** `TroveManager.sol`, Lines 30-32
**Severity:** HIGH
**Status:** Open

**Description:**
Two state variables share the identical name `msicToken` but are declared with different types:

```solidity
IMoUSDToken public override msicToken;   // Line 30
IMSICToken public override msicToken;    // Line 32
```

The same collision occurs in `setAddresses()` (lines 270-272), where the parameter `_msicTokenAddress` is used twice (lines 243-244), meaning the MoUSD token address and the MSIC token address are the **same parameter name**, and the second assignment silently overwrites the first.

**Impact:**
- This will either fail to compile (Solidity does not allow duplicate state variable names of the same visibility) or, if the compiler allows shadowing, the second declaration overwrites the first. This means `msicToken` would only point to the MSIC token, and the MoUSD token reference would be lost entirely.
- The `_sendGasCompensation()` function on line 798 calls `msicToken.returnFromPool()`, which is a MoUSD-specific function. If `msicToken` points to the MSIC token contract, this call would revert or behave unexpectedly, **breaking all liquidation gas compensation payments**.
- The `redeemCollateral()` function (line 937-1023) uses `contractsCache.msicToken` to check MoUSD balances and burn MoUSD. If this is the MSIC token instead, **all redemptions would fail or burn the wrong token**.

**Recommendation:**
Rename the variables to be distinct:
- `IMoUSDToken public moUSDToken;` for the stablecoin
- `IMSICToken public msicToken;` for the governance token

Update `setAddresses()` to accept separate, distinctly named parameters for each token address.

---

### H-02: Duplicate State Variable Declaration in `MSICStaking.sol` — Staking Rewards Lost

**File:** `MSICStaking.sol`, Lines 35-36
**Severity:** HIGH
**Status:** Open

**Description:**
Same pattern as H-01:

```solidity
IMSICToken public msicToken;    // Line 35
IMoUSDToken public msicToken;   // Line 36
```

The `setAddresses()` function (lines 60-91) also has duplicate parameter names `_msicTokenAddress` on lines 62-63. The second assignment (`msicToken = IMoUSDToken(_msicTokenAddress)`) overwrites the first (`msicToken = IMSICToken(_msicTokenAddress)`).

**Impact:**
- The `stake()` function (line 117) calls `msicToken.sendToMSICStaking()`, which is an MSIC-specific function. If `msicToken` points to MoUSD, this will revert — **users cannot stake MSIC tokens**.
- The `unstake()` function (line 152) calls `msicToken.transfer()` to return MSIC tokens and (line 160) calls `msicToken.transfer()` to send MoUSD gains. Both reference the same variable, so one token type is inaccessible — **either unstaking or MoUSD reward claims will fail**.
- `increaseF_ETH` and `increaseF_MoUSD` would function correctly since they only modify running sums, but actual reward distribution in `stake()`/`unstake()` is broken.

**Recommendation:**
Use distinct variable names: `msicToken` for IMSICToken and `moUSDToken` for IMoUSDToken. Update all function calls to reference the correct variable.

---

### H-03: `setAddresses()` in `TroveManager.sol` Has Duplicate Parameter Names — Wrong Contract Wired

**File:** `TroveManager.sol`, Lines 234-288
**Severity:** HIGH
**Status:** Open

**Description:**
The `setAddresses()` function declares `_msicTokenAddress` twice in its parameter list (lines 242 and 244):

```solidity
function setAddresses(
    address _borrowerOperationsAddress,
    address _activePoolAddress,
    address _defaultPoolAddress,
    address _stabilityPoolAddress,
    address _gasPoolAddress,
    address _collSurplusPoolAddress,
    address _priceFeedAddress,
    address _msicTokenAddress,       // Line 242 - intended for MoUSD token
    address _sortedTrovesAddress,
    address _msicTokenAddress,       // Line 244 - intended for MSIC token (DUPLICATE!)
    address _msicStakingAddress
)
```

In Solidity 0.6.11, duplicate function parameter names cause a compilation error. If this somehow compiles (e.g., through a toolchain quirk), the second parameter shadows the first, so the deployer would pass two different addresses but only the last one would be used for both token assignments.

**Impact:**
- **Deployment will fail** — the contract cannot be compiled and deployed with duplicate parameter names.
- If it somehow deployed, MoUSD-related operations (minting, burning, balance checks) would incorrectly target the MSIC token contract, breaking the entire borrowing/redemption flow.

**Recommendation:**
Rename parameters distinctly: `_moUSDTokenAddress` and `_msicTokenAddress`.

---

### H-04: `MoUSDUsdToMoUSDReef.sol` Uses Hardcoded Ethereum Mainnet Oracle Addresses

**File:** `Integrations/MoUSDUsdToMoUSDReef.sol`, Lines 11-12
**Severity:** HIGH
**Status:** Open

**Description:**
The contract has hardcoded Chainlink oracle addresses that are Ethereum mainnet addresses:

```solidity
IPriceFeed public constant MoUSD_USD = IPriceFeed(0x3D7aE7E594f2f2091Ad8798313450130d0Aba3a0);
IPriceFeed public constant REEF_USD = IPriceFeed(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
```

The address `0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419` is the **Ethereum mainnet ETH/USD Chainlink feed**, not a REEF/USD feed. Furthermore, neither Chainlink oracle address will exist on Reef Chain.

**Impact:**
- On Reef Chain, calls to these addresses will revert (no contract at those addresses), making the integration contract completely non-functional.
- The `latestAnswer()` function performs division by `REEF_USD.latestAnswer()` — if by some mechanism a zero or near-zero value is returned, this causes a division-by-zero revert or an extremely inflated price.
- The contract lacks any safety checks (no `try/catch`, no staleness checks, no zero-price validation).

**Recommendation:**
- Replace hardcoded addresses with constructor parameters or an upgradeable registry pattern.
- Add zero-price checks and staleness validation.
- Source or deploy appropriate REEF/USD price feeds on Reef Chain before launch. Consider using a Tellor or API3 oracle adapted for Reef Chain if Chainlink is not available.

---

## Medium Severity

### M-01: Chainlink and Tellor Oracle Availability on Reef Chain

**File:** `PriceFeed.sol`
**Severity:** MEDIUM
**Status:** Open

**Description:**
The `PriceFeed.sol` contract relies on Chainlink (`AggregatorV3Interface`) as the primary oracle and Tellor as the fallback oracle. Reef Chain is a Substrate-based chain with EVM compatibility. As of the audit date, neither Chainlink nor Tellor has announced official support for Reef Chain.

The Tellor request ID is hardcoded as `ETHUSD_TELLOR_REQ_ID = 1` (line 35), which is the ETH/USD pair on Tellor — not REEF/USD.

**Impact:**
- If neither oracle is available on Reef Chain, the protocol has no way to fetch prices, rendering the entire system non-functional.
- Even if deployed, the Tellor request ID points to the wrong asset pair.

**Recommendation:**
- Verify oracle availability on Reef Chain before deployment. If Chainlink/Tellor are unavailable, implement an alternative oracle solution (e.g., a custom oracle with multi-sig governance, Pyth Network, or Reef-native oracles).
- Update the Tellor request ID to the correct REEF/USD pair.
- Consider implementing a configurable oracle adapter pattern to support different oracle providers.

---

### M-02: `permit()` in MoUSDToken and MSICToken — Missing Zero-Address Check on `ecrecover`

**Files:** `MoUSDToken.sol` (Line 189), `MSICToken.sol` (Line 257)
**Severity:** MEDIUM
**Status:** Open

**Description:**
The `permit()` function uses `ecrecover` to recover the signer address from the signature, then checks `require(recoveredAddress == owner)`. However, `ecrecover` returns `address(0)` for invalid signatures. If `owner` is `address(0)`, the check passes, allowing anyone to set arbitrary allowances for the zero address.

```solidity
address recoveredAddress = ecrecover(digest, v, r, s);
require(recoveredAddress == owner, 'MoUSD: invalid signature');
```

**Impact:**
While the zero address cannot hold tokens in normal operation (minting to address(0) is blocked by an assert), if tokens somehow end up at the zero address (e.g., through a direct `_transfer` call from a privileged contract), an attacker could use `permit()` to approve themselves to spend those tokens.

**Recommendation:**
Add an explicit check: `require(recoveredAddress != address(0), "MoUSD: invalid signature");`

---

### M-03: REEF Collateral Assumed as Native Token — EVM Gas Semantics May Differ

**Files:** All pool contracts, `BorrowerOperations.sol`
**Severity:** MEDIUM
**Status:** Open

**Description:**
The protocol treats REEF as the native gas token (using `msg.value`, `payable` functions, and low-level `.call{value: _amount}("")` for transfers), mirroring how Liquity v1 handles ETH. On Reef Chain post-Deep Current, REEF is indeed the native token for gas, but:

1. **Gas costs differ**: Reef Chain may have different gas costs for opcodes, particularly `CALL` with value transfer. The 2300 gas stipend assumption from Ethereum does not apply universally.
2. **Low-level call behavior**: The contracts use `.call{value: amount}("")` (not `.transfer()` or `.send()`), which forwards all available gas. This is generally safe but needs validation that Reef Chain's EVM implementation handles this identically.
3. **`receive()` functions**: Multiple contracts (ActivePool, DefaultPool, StabilityPool, CollSurplusPool, MSICStaking) rely on `receive()` external payable functions. These must work correctly with Reef Chain's native token transfer mechanics.

**Impact:**
If Reef Chain's EVM has any deviations in how native token transfers work (e.g., different gas forwarding, precompile interactions), pool operations could fail silently or revert unexpectedly.

**Recommendation:**
- Conduct thorough integration testing on Reef Chain's testnet (post-Deep Current) before mainnet deployment.
- Verify that `.call{value: amount}("")` behaves identically to Ethereum's implementation.
- Monitor Reef Chain's Deep Current release notes for any EVM-level deviations.

---

### M-04: `console.sol` Import Left in Production Contracts

**Files:** `TroveManager.sol`, `BorrowerOperations.sol`, `StabilityPool.sol`, `ActivePool.sol`, `DefaultPool.sol`, `CollSurplusPool.sol`, `PriceFeed.sol`, `MSICStaking.sol`, `CommunityIssuance.sol`, `MSICToken.sol`
**Severity:** MEDIUM
**Status:** Open

**Description:**
All major contracts import `./Dependencies/console.sol`, which is a Hardhat development utility for `console.log()` debugging. This import should not be present in production deployments.

**Impact:**
- Increases deployed contract bytecode size, raising deployment gas costs.
- On Reef Chain, if the console precompile address is not handled, calls to `console.log` could have unpredictable behavior (though they typically become no-ops on non-Hardhat chains).
- Signals code maturity concerns — production contracts should not contain development dependencies.

**Recommendation:**
Remove all `import "./Dependencies/console.sol";` statements and any `console.log()` calls from production contracts before deployment.

---

### M-05: `BorrowerOperations.msicToken` Variable Naming Mismatch with Type

**File:** `BorrowerOperations.sol`, Line 32
**Severity:** MEDIUM
**Status:** Open

**Description:**
```solidity
IMoUSDToken public msicToken;
```

The variable is named `msicToken` but has type `IMoUSDToken`. While this is not a duplicate declaration like H-01/H-02 (BorrowerOperations only needs MoUSD, not MSIC directly), the naming is misleading and error-prone. Developers interacting with this contract or building integrations may assume `msicToken` refers to the MSIC governance token.

The same misleading naming appears in `StabilityPool.sol` line 157 and in `ContractsCache` structs throughout the codebase.

**Impact:**
- Developer confusion leading to incorrect integrations.
- Increased audit surface and maintenance burden.
- Future contributors may introduce bugs by assuming `msicToken` is the MSIC token.

**Recommendation:**
Rename to `moUSDToken` throughout the codebase for clarity. This should be a comprehensive find-and-replace across all contracts, interfaces, and test files.

---

### M-06: StabilityPool `receive()` Function Calls Event Without `emit` Keyword

**File:** `StabilityPool.sol`, Line 996
**Severity:** MEDIUM
**Status:** Open

**Description:**
```solidity
receive() external payable {
    _requireCallerIsActivePool();
    REEF = REEF.add(msg.value);
    StabilityPoolETHBalanceUpdated(REEF);  // Missing 'emit' keyword
}
```

In Solidity 0.6.x, calling an event without the `emit` keyword is deprecated but still compiles. However, it creates ambiguity — it looks like a function call rather than an event emission.

**Impact:**
The event will still be emitted (backward compatible in 0.6.x), but this is a code quality issue that may confuse auditors and developers. In future Solidity versions, this syntax will be removed entirely.

**Recommendation:**
Add the `emit` keyword: `emit StabilityPoolETHBalanceUpdated(REEF);`

Also review `ActivePool.sol` lines 96 and 102 where `ActivePoolMoUSDDebtUpdated(MoUSDDebt)` similarly lacks the `emit` keyword.

---

## Low Severity

### L-01: Solidity Version 0.6.11 Is Outdated — Missing Security Patches

**Files:** All contracts
**Severity:** LOW
**Status:** Open

**Description:**
All contracts use `pragma solidity 0.6.11`, released in 2020. Multiple security patches have been released in later versions (0.8.x series), including:
- Built-in overflow/underflow protection (eliminating need for SafeMath)
- ABI encoder v2 improvements
- Custom error types for gas-efficient reverts
- Numerous compiler bug fixes

**Impact:**
While the original Liquity v1 was audited with this version and is considered safe with SafeMath, deploying outdated Solidity on a new chain increases the attack surface for any compiler-level bugs discovered since 2020.

**Recommendation:**
Consider upgrading to Solidity 0.8.x for the deployment. This would require removing SafeMath usage (replaced by built-in checks), updating syntax, and re-running the full test suite. If upgrading is not feasible, ensure the known compiler bugs for 0.6.11 do not affect the contracts.

---

### L-02: Missing `emit` Keywords on Multiple Event Emissions

**Files:** `ActivePool.sol` (Lines 96, 102)
**Severity:** LOW
**Status:** Open

**Description:**
```solidity
// ActivePool.sol
ActivePoolMoUSDDebtUpdated(MoUSDDebt);  // Line 96 - missing emit
ActivePoolMoUSDDebtUpdated(MoUSDDebt);  // Line 102 - missing emit
```

Same issue as M-06 but in a different contract.

**Recommendation:**
Add `emit` keyword to all event emissions.

---

### L-03: `_1_MILLION` Is Not Declared as `constant` in MSICToken

**File:** `MSICToken.sol`, Line 86
**Severity:** LOW
**Status:** Open

**Description:**
```solidity
uint internal _1_MILLION = 1e24;    // 1e6 * 1e18 = 1e24
```

This value is used only in the constructor and never modified, but it is declared as a regular state variable rather than a `constant`. This wastes a storage slot and costs additional gas on deployment.

**Impact:**
Minor gas inefficiency. No functional impact since ownership is renounced after initialization in dependent contracts, and the value is only used in the constructor.

**Recommendation:**
Declare as `uint internal constant _1_MILLION = 1e24;`

---

### L-04: `ETHUSD_TELLOR_REQ_ID` Still References ETH Naming

**File:** `PriceFeed.sol`, Line 35
**Severity:** LOW
**Status:** Open

**Description:**
```solidity
uint constant public ETHUSD_TELLOR_REQ_ID = 1;
```

The constant is still named `ETHUSD_TELLOR_REQ_ID` despite the protocol using REEF as collateral. Additionally, request ID `1` is the ETH/USD pair on Tellor, not REEF/USD.

**Impact:**
If Tellor is deployed on Reef Chain, the wrong price feed would be queried. Combined with M-01, this creates a complete oracle failure scenario.

**Recommendation:**
Rename to `REEFUSD_TELLOR_REQ_ID` and update the value to the correct Tellor request ID for REEF/USD once available.

---

### L-05: Incomplete Event Naming — Still References "ETH" Instead of "REEF"

**Files:** Multiple contracts
**Severity:** LOW
**Status:** Open

**Description:**
Many event names still reference "ETH" despite the collateral being REEF:
- `ActivePoolETHBalanceUpdated` (ActivePool.sol)
- `DefaultPoolETHBalanceUpdated` (DefaultPool.sol)
- `StabilityPoolETHBalanceUpdated` (StabilityPool.sol)
- `ETHGainWithdrawn` (StabilityPool.sol)
- `EtherSent` (multiple contracts)

Function names also retain ETH references: `getETH()`, `sendETH()`, `sendETHToActivePool()`, `increaseF_ETH()`, etc.

**Impact:**
No functional impact — events and function names do not affect runtime behavior. However, this creates confusion for indexers, subgraphs, and frontend integrations that parse event names. Off-chain systems expecting "REEF" in event names will not find them.

**Recommendation:**
Rename all events and public/external function names to use "REEF" terminology for consistency. Update corresponding interfaces, subgraph mappings, and frontend code.

---

### L-06: `SortedTroves` Linked List Traversal Skips First User in Recovery Mode Liquidation

**File:** `TroveManager.sol`, Line 566
**Severity:** LOW
**Status:** Open

**Description:**
In `_getTotalsFromLiquidateTrovesSequence_RecoveryMode()`:

```solidity
vars.user = _contractsCache.sortedTroves.getLast();
address firstUser = _contractsCache.sortedTroves.getFirst();
for (vars.i = 0; vars.i < _n && vars.user != firstUser; vars.i++) {
```

The loop condition `vars.user != firstUser` means the trove with the highest collateral ratio (first in the sorted list) is never liquidated in the recovery mode sequence. This is inherited from Liquity v1 and is by design (protecting the healthiest trove), but it is worth noting for awareness.

**Impact:**
The highest-ICR trove is protected from sequential liquidation. This is intentional behavior from Liquity's design but may surprise users unfamiliar with the protocol.

**Recommendation:**
Document this behavior clearly in user-facing documentation. No code change needed.

---

### L-07: Ownership Renounced in `setAddresses()` — No Upgrade Path

**Files:** All core contracts
**Severity:** LOW
**Status:** Open

**Description:**
Every core contract calls `_renounceOwnership()` at the end of its `setAddresses()` function. This means:
- Contract addresses cannot be updated after initial setup.
- If a bug is found post-deployment, there is no admin mechanism to pause, upgrade, or fix.
- Oracle addresses cannot be changed if oracles become unavailable.

This is inherited from Liquity v1's design philosophy of full immutability, which is a deliberate tradeoff.

**Impact:**
If any dependency contract (oracle, pool, etc.) needs to be replaced, the entire protocol must be redeployed. On a newer chain like Reef where the ecosystem is still maturing, this inflexibility poses a higher risk than on Ethereum mainnet.

**Recommendation:**
Consider adding a time-locked governance mechanism or a minimal proxy upgrade pattern for critical components (particularly the PriceFeed oracle), while maintaining immutability for the core economic logic. Alternatively, implement an emergency multisig with a timelock for oracle updates only.

---

### L-08: `MoUSD_GAS_COMPENSATION` Set to 200 MoUSD — May Not Suit REEF Economics

**File:** `LiquityBase.sol` (`MosaicBase`), Line 28
**Severity:** LOW
**Status:** Open

**Description:**
```solidity
uint constant public MoUSD_GAS_COMPENSATION = 200e18;
uint constant public MIN_NET_DEBT = 1800e18;
```

These constants are inherited directly from Liquity v1, which was tuned for Ethereum's gas costs. The 200 MoUSD gas compensation is designed to incentivize liquidators to cover their gas costs. On Reef Chain, gas costs are likely significantly lower than on Ethereum mainnet.

**Impact:**
- A 200 MoUSD gas compensation may be excessively generous relative to actual gas costs on Reef Chain, creating unnecessary protocol overhead.
- The 1800 MoUSD minimum net debt may be too high or too low depending on REEF's value and Reef Chain's typical user base.

**Recommendation:**
Model the expected gas costs on Reef Chain and adjust `MoUSD_GAS_COMPENSATION` and `MIN_NET_DEBT` accordingly. These values should reflect the economic reality of the target chain.

---

## Informational / Best Practices

### I-01: Inconsistent Naming Convention Across Codebase

The fork's renaming from Liquity terminology to Mosaic terminology is incomplete and inconsistent:
- Contract base class: `MosaicBase` (renamed) but file is still `LiquityBase.sol`
- Library: `MosaicMath` (renamed) but file is still `LiquityMath.sol`
- SafeMath: `MosaicSafeMath128` (renamed) but file is still `LiquitySafeMath128.sol`
- Variable names mix "ETH" and "REEF" freely
- `msicToken` is used for both MSIC and MoUSD tokens in different contracts

**Recommendation:** Perform a complete, consistent renaming pass across all files, variables, events, and comments.

### I-02: No Reentrancy Guards

The protocol follows the checks-effects-interactions pattern and uses SafeMath, but does not employ explicit reentrancy guards (`ReentrancyGuard` from OpenZeppelin). While the Liquity v1 design has been proven safe against reentrancy, the native token transfer semantics on Reef Chain should be verified to ensure they don't introduce new reentrancy vectors.

### I-03: Test Coverage Gap for Fork-Specific Changes

The test suite appears to be inherited from Liquity v1. Any fork-specific changes (particularly the naming collisions in H-01, H-02, H-03) should have dedicated tests. The presence of compilation-breaking bugs suggests the test suite has not been run against the current codebase.

---

## Summary of Findings

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| H-01 | HIGH | Duplicate `msicToken` variable in TroveManager | Open |
| H-02 | HIGH | Duplicate `msicToken` variable in MSICStaking | Open |
| H-03 | HIGH | Duplicate parameter names in TroveManager.setAddresses() | Open |
| H-04 | HIGH | Hardcoded Ethereum mainnet oracle addresses in MoUSDUsdToMoUSDReef | Open |
| M-01 | MEDIUM | Chainlink/Tellor oracle availability on Reef Chain | Open |
| M-02 | MEDIUM | Missing zero-address check on ecrecover in permit() | Open |
| M-03 | MEDIUM | Native token transfer semantics may differ on Reef Chain | Open |
| M-04 | MEDIUM | console.sol import in production contracts | Open |
| M-05 | MEDIUM | Misleading variable naming (msicToken for MoUSD) | Open |
| M-06 | MEDIUM | Missing `emit` keyword on event emissions | Open |
| L-01 | LOW | Outdated Solidity version 0.6.11 | Open |
| L-02 | LOW | Additional missing `emit` keywords in ActivePool | Open |
| L-03 | LOW | `_1_MILLION` not declared as constant | Open |
| L-04 | LOW | ETHUSD_TELLOR_REQ_ID references wrong asset | Open |
| L-05 | LOW | Incomplete event/function renaming from ETH to REEF | Open |
| L-06 | LOW | SortedTroves traversal skips first user in Recovery Mode | Open |
| L-07 | LOW | No upgrade path after ownership renouncement | Open |
| L-08 | LOW | Gas compensation constants not tuned for Reef Chain | Open |

---

## Critical Deployment Blockers

The following issues **must** be resolved before deployment:

1. **H-01, H-02, H-03**: The duplicate variable/parameter declarations will prevent compilation. These are showstopper bugs that indicate the codebase has not been successfully compiled in its current state.
2. **H-04**: The integration contract is non-functional on Reef Chain due to hardcoded Ethereum addresses.
3. **M-01**: Without a working oracle solution on Reef Chain, the protocol cannot function.

---

## Recommendations Summary

1. **Immediate**: Fix all duplicate variable names and parameter names (H-01, H-02, H-03). This is a prerequisite for compilation.
2. **Pre-deployment**: Establish a working oracle solution for REEF/USD on Reef Chain (M-01, H-04, L-04).
3. **Pre-deployment**: Remove all `console.sol` imports (M-04).
4. **Pre-deployment**: Run the full test suite and ensure all tests pass on the corrected codebase (I-03).
5. **Pre-deployment**: Conduct integration testing on Reef Chain testnet post-Deep Current upgrade (M-03).
6. **Recommended**: Perform complete naming consistency pass (M-05, L-05, I-01).
7. **Recommended**: Tune economic parameters for Reef Chain (L-08).
8. **Recommended**: Add `emit` keywords to all event emissions (M-06, L-02).
9. **Recommended**: Consider adding minimal upgradeability for oracle contracts (L-07).

---

*This audit report is provided for informational purposes. Smart contract security is a continuous process and this report does not guarantee the absence of vulnerabilities. A follow-up audit is recommended after all findings are addressed.*
