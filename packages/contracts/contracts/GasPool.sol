// SPDX-License-Identifier: MIT

pragma solidity 0.6.11;


/**
 * The purpose of this contract is to hold MoUSD tokens for gas compensation:
 * https://github.com/mosaic/dev#gas-compensation
 * When a borrower opens a trove, an additional 50 MoUSD debt is issued,
 * and 50 MoUSD is minted and sent to this contract.
 * When a borrower closes their active trove, this gas compensation is refunded:
 * 50 MoUSD is burned from the this contract's balance, and the corresponding
 * 50 MoUSD debt on the trove is cancelled.
 * See this issue for more context: https://github.com/mosaic/dev/issues/186
 */
contract GasPool {
    // do nothing, as the core contracts have permission to send to and burn from this address
}
