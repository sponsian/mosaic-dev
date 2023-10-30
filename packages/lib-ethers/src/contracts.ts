import { JsonFragment, LogDescription } from "@ethersproject/abi";
import { BigNumber } from "@ethersproject/bignumber";
import { Log } from "@ethersproject/abstract-provider";

import {
  Contract,
  ContractInterface,
  ContractFunction,
  Overrides,
  CallOverrides,
  PopulatedTransaction,
  ContractTransaction
} from "@ethersproject/contracts";

import activePoolAbi from "../abi/ActivePool.json";
import borrowerOperationsAbi from "../abi/BorrowerOperations.json";
import troveManagerAbi from "../abi/TroveManager.json";
import msicTokenAbi from "../abi/MoUSDToken.json";
import collSurplusPoolAbi from "../abi/CollSurplusPool.json";
import communityIssuanceAbi from "../abi/CommunityIssuance.json";
import defaultPoolAbi from "../abi/DefaultPool.json";
import msicTokenAbi from "../abi/MSICToken.json";
import hintHelpersAbi from "../abi/HintHelpers.json";
import lockupContractFactoryAbi from "../abi/LockupContractFactory.json";
import msicStakingAbi from "../abi/MSICStaking.json";
import multiTroveGetterAbi from "../abi/MultiTroveGetter.json";
import priceFeedAbi from "../abi/PriceFeed.json";
import priceFeedTestnetAbi from "../abi/PriceFeedTestnet.json";
import sortedTrovesAbi from "../abi/SortedTroves.json";
import stabilityPoolAbi from "../abi/StabilityPool.json";
import gasPoolAbi from "../abi/GasPool.json";
import unipoolAbi from "../abi/Unipool.json";
import iERC20Abi from "../abi/IERC20.json";
import erc20MockAbi from "../abi/ERC20Mock.json";

import {
  ActivePool,
  BorrowerOperations,
  TroveManager,
  MoUSDToken,
  CollSurplusPool,
  CommunityIssuance,
  DefaultPool,
  MSICToken,
  HintHelpers,
  LockupContractFactory,
  MSICStaking,
  MultiTroveGetter,
  PriceFeed,
  PriceFeedTestnet,
  SortedTroves,
  StabilityPool,
  GasPool,
  Unipool,
  ERC20Mock,
  IERC20
} from "../types";

import { EthersProvider, EthersSigner } from "./types";

export interface _TypedLogDescription<T> extends Omit<LogDescription, "args"> {
  args: T;
}

type BucketOfFunctions = Record<string, (...args: unknown[]) => never>;

// Removes unsafe index signatures from an Ethers contract type
export type _TypeSafeContract<T> = Pick<
  T,
  {
    [P in keyof T]: BucketOfFunctions extends T[P] ? never : P;
  } extends {
    [_ in keyof T]: infer U;
  }
    ? U
    : never
>;

type EstimatedContractFunction<R = unknown, A extends unknown[] = unknown[], O = Overrides> = (
  overrides: O,
  adjustGas: (gas: BigNumber) => BigNumber,
  ...args: A
) => Promise<R>;

type CallOverridesArg = [overrides?: CallOverrides];

type TypedContract<T extends Contract, U, V> = _TypeSafeContract<T> &
  U &
  {
    [P in keyof V]: V[P] extends (...args: infer A) => unknown
      ? (...args: A) => Promise<ContractTransaction>
      : never;
  } & {
    readonly callStatic: {
      [P in keyof V]: V[P] extends (...args: [...infer A, never]) => infer R
        ? (...args: [...A, ...CallOverridesArg]) => R
        : never;
    };

    readonly estimateGas: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<BigNumber>
        : never;
    };

    readonly populateTransaction: {
      [P in keyof V]: V[P] extends (...args: infer A) => unknown
        ? (...args: A) => Promise<PopulatedTransaction>
        : never;
    };

    readonly estimateAndPopulate: {
      [P in keyof V]: V[P] extends (...args: [...infer A, infer O | undefined]) => unknown
        ? EstimatedContractFunction<PopulatedTransaction, A, O>
        : never;
    };
  };

const buildEstimatedFunctions = <T>(
  estimateFunctions: Record<string, ContractFunction<BigNumber>>,
  functions: Record<string, ContractFunction<T>>
): Record<string, EstimatedContractFunction<T>> =>
  Object.fromEntries(
    Object.keys(estimateFunctions).map(functionName => [
      functionName,
      async (overrides, adjustEstimate, ...args) => {
        if (overrides.gasLimit === undefined) {
          const estimatedGas = await estimateFunctions[functionName](...args, overrides);

          overrides = {
            ...overrides,
            gasLimit: adjustEstimate(estimatedGas)
          };
        }

        return functions[functionName](...args, overrides);
      }
    ])
  );

export class _MosaicContract extends Contract {
  readonly estimateAndPopulate: Record<string, EstimatedContractFunction<PopulatedTransaction>>;

  constructor(
    addressOrName: string,
    contractInterface: ContractInterface,
    signerOrProvider?: EthersSigner | EthersProvider
  ) {
    super(addressOrName, contractInterface, signerOrProvider);

    // this.estimateAndCall = buildEstimatedFunctions(this.estimateGas, this);
    this.estimateAndPopulate = buildEstimatedFunctions(this.estimateGas, this.populateTransaction);
  }

  extractEvents(logs: Log[], name: string): _TypedLogDescription<unknown>[] {
    return logs
      .filter(log => log.address === this.address)
      .map(log => this.interface.parseLog(log))
      .filter(e => e.name === name);
  }
}

/** @internal */
export type _TypedMosaicContract<T = unknown, U = unknown> = TypedContract<_MosaicContract, T, U>;

/** @internal */
export interface _MosaicContracts {
  activePool: ActivePool;
  borrowerOperations: BorrowerOperations;
  troveManager: TroveManager;
  msicToken: MoUSDToken;
  collSurplusPool: CollSurplusPool;
  communityIssuance: CommunityIssuance;
  defaultPool: DefaultPool;
  msicToken: MSICToken;
  hintHelpers: HintHelpers;
  lockupContractFactory: LockupContractFactory;
  msicStaking: MSICStaking;
  multiTroveGetter: MultiTroveGetter;
  priceFeed: PriceFeed | PriceFeedTestnet;
  sortedTroves: SortedTroves;
  stabilityPool: StabilityPool;
  gasPool: GasPool;
  unipool: Unipool;
  uniToken: IERC20 | ERC20Mock;
}

/** @internal */
export const _priceFeedIsTestnet = (
  priceFeed: PriceFeed | PriceFeedTestnet
): priceFeed is PriceFeedTestnet => "setPrice" in priceFeed;

/** @internal */
export const _uniTokenIsMock = (uniToken: IERC20 | ERC20Mock): uniToken is ERC20Mock =>
  "mint" in uniToken;

type MosaicContractsKey = keyof _MosaicContracts;

/** @internal */
export type _MosaicContractAddresses = Record<MosaicContractsKey, string>;

type MosaicContractAbis = Record<MosaicContractsKey, JsonFragment[]>;

const getAbi = (priceFeedIsTestnet: boolean, uniTokenIsMock: boolean): MosaicContractAbis => ({
  activePool: activePoolAbi,
  borrowerOperations: borrowerOperationsAbi,
  troveManager: troveManagerAbi,
  msicToken: msicTokenAbi,
  communityIssuance: communityIssuanceAbi,
  defaultPool: defaultPoolAbi,
  msicToken: msicTokenAbi,
  hintHelpers: hintHelpersAbi,
  lockupContractFactory: lockupContractFactoryAbi,
  msicStaking: msicStakingAbi,
  multiTroveGetter: multiTroveGetterAbi,
  priceFeed: priceFeedIsTestnet ? priceFeedTestnetAbi : priceFeedAbi,
  sortedTroves: sortedTrovesAbi,
  stabilityPool: stabilityPoolAbi,
  gasPool: gasPoolAbi,
  collSurplusPool: collSurplusPoolAbi,
  unipool: unipoolAbi,
  uniToken: uniTokenIsMock ? erc20MockAbi : iERC20Abi
});

const mapMosaicContracts = <T, U>(
  contracts: Record<MosaicContractsKey, T>,
  f: (t: T, key: MosaicContractsKey) => U
) =>
  Object.fromEntries(
    Object.entries(contracts).map(([key, t]) => [key, f(t, key as MosaicContractsKey)])
  ) as Record<MosaicContractsKey, U>;

/** @internal */
export interface _MosaicDeploymentJSON {
  readonly chainId: number;
  readonly addresses: _MosaicContractAddresses;
  readonly version: string;
  readonly deploymentDate: number;
  readonly startBlock: number;
  readonly bootstrapPeriod: number;
  readonly totalStabilityPoolMSICReward: string;
  readonly liquidityMiningMSICRewardRate: string;
  readonly _priceFeedIsTestnet: boolean;
  readonly _uniTokenIsMock: boolean;
  readonly _isDev: boolean;
}

/** @internal */
export const _connectToContracts = (
  signerOrProvider: EthersSigner | EthersProvider,
  { addresses, _priceFeedIsTestnet, _uniTokenIsMock }: _MosaicDeploymentJSON
): _MosaicContracts => {
  const abi = getAbi(_priceFeedIsTestnet, _uniTokenIsMock);

  return mapMosaicContracts(
    addresses,
    (address, key) =>
      new _MosaicContract(address, abi[key], signerOrProvider) as _TypedMosaicContract
  ) as _MosaicContracts;
};
