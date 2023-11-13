import { Block, BlockTag } from "@ethersproject/abstract-provider";
import { Signer } from "@ethersproject/abstract-signer";

import { Decimal } from "@liquity/lib-base";

import devOrNull from "../deployments/dev.json";
import goerli from "../deployments/goerli.json";
import kovan from "../deployments/kovan.json";
import rinkeby from "../deployments/rinkeby.json";
import ropsten from "../deployments/ropsten.json";
import mainnet from "../deployments/mainnet.json";
import kiln from "../deployments/kiln.json";

import { numberify, panic } from "./_utils";
import { EthersProvider, EthersSigner } from "./types";

import {
  _connectToContracts,
  _MosaicContractAddresses,
  _MosaicContracts,
  _MosaicDeploymentJSON
} from "./contracts";

import { _connectToMulticall, _Multicall } from "./_Multicall";

const dev = devOrNull as _MosaicDeploymentJSON | null;

const deployments: {
  [chainId: number]: _MosaicDeploymentJSON | undefined;
} = {
  [mainnet.chainId]: mainnet,
  [ropsten.chainId]: ropsten,
  [rinkeby.chainId]: rinkeby,
  [goerli.chainId]: goerli,
  [kovan.chainId]: kovan,
  [kiln.chainId]: kiln,

  ...(dev !== null ? { [dev.chainId]: dev } : {})
};

declare const brand: unique symbol;

const branded = <T>(t: Omit<T, typeof brand>): T => t as T;

/**
 * Information about a connection to the Mosaic protocol.
 *
 * @remarks
 * Provided for debugging / informational purposes.
 *
 * Exposed through {@link ReadableEthersMosaic.connection} and {@link EthersMosaic.connection}.
 *
 * @public
 */
export interface EthersMosaicConnection extends EthersMosaicConnectionOptionalParams {
  /** Ethers `Provider` used for connecting to the network. */
  readonly provider: EthersProvider;

  /** Ethers `Signer` used for sending transactions. */
  readonly signer?: EthersSigner;

  /** Chain ID of the connected network. */
  readonly chainId: number;

  /** Version of the Mosaic contracts (Git commit hash). */
  readonly version: string;

  /** Date when the Mosaic contracts were deployed. */
  readonly deploymentDate: Date;

  /** Number of block in which the first Mosaic contract was deployed. */
  readonly startBlock: number;

  /** Time period (in seconds) after `deploymentDate` during which redemptions are disabled. */
  readonly bootstrapPeriod: number;

  /** Total amount of MSIC allocated for rewarding stability depositors. */
  readonly totalStabilityPoolMSICReward: Decimal;

  /** Amount of MSIC collectively rewarded to stakers of the liquidity mining pool per second. */
  readonly liquidityMiningMSICRewardRate: Decimal;

  /** A mapping of Mosaic contracts' names to their addresses. */
  readonly addresses: Record<string, string>;

  /** @internal */
  readonly _priceFeedIsTestnet: boolean;

  /** @internal */
  readonly _isDev: boolean;

  /** @internal */
  readonly [brand]: unique symbol;
}

/** @internal */
export interface _InternalEthersMosaicConnection extends EthersMosaicConnection {
  readonly addresses: _MosaicContractAddresses;
  readonly _contracts: _MosaicContracts;
  readonly _multicall?: _Multicall;
}

const connectionFrom = (
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  _contracts: _MosaicContracts,
  _multicall: _Multicall | undefined,
  {
    deploymentDate,
    totalStabilityPoolMSICReward,
    liquidityMiningMSICRewardRate,
    ...deployment
  }: _MosaicDeploymentJSON,
  optionalParams?: EthersMosaicConnectionOptionalParams
): _InternalEthersMosaicConnection => {
  if (
    optionalParams &&
    optionalParams.useStore !== undefined &&
    !validStoreOptions.includes(optionalParams.useStore)
  ) {
    throw new Error(`Invalid useStore value ${optionalParams.useStore}`);
  }

  return branded({
    provider,
    signer,
    _contracts,
    _multicall,
    deploymentDate: new Date(deploymentDate),
    totalStabilityPoolMSICReward: Decimal.from(totalStabilityPoolMSICReward),
    liquidityMiningMSICRewardRate: Decimal.from(liquidityMiningMSICRewardRate),
    ...deployment,
    ...optionalParams
  });
};

/** @internal */
export const _getContracts = (connection: EthersMosaicConnection): _MosaicContracts =>
  (connection as _InternalEthersMosaicConnection)._contracts;

const getMulticall = (connection: EthersMosaicConnection): _Multicall | undefined =>
  (connection as _InternalEthersMosaicConnection)._multicall;

const getTimestampFromBlock = ({ timestamp }: Block) => timestamp;

/** @internal */
export const _getBlockTimestamp = (
  connection: EthersMosaicConnection,
  blockTag: BlockTag = "latest"
): Promise<number> =>
  // Get the timestamp via a contract call whenever possible, to make it batchable with other calls
  getMulticall(connection)?.getCurrentBlockTimestamp({ blockTag }).then(numberify) ??
  _getProvider(connection).getBlock(blockTag).then(getTimestampFromBlock);

/** @internal */
export const _requireSigner = (connection: EthersMosaicConnection): EthersSigner =>
  connection.signer ?? panic(new Error("Must be connected through a Signer"));

/** @internal */
export const _getProvider = (connection: EthersMosaicConnection): EthersProvider =>
  connection.provider;

// TODO parameterize error message?
/** @internal */
export const _requireAddress = (
  connection: EthersMosaicConnection,
  overrides?: { from?: string }
): string =>
  overrides?.from ?? connection.userAddress ?? panic(new Error("A user address is required"));

/** @internal */
export const _requireFrontendAddress = (connection: EthersMosaicConnection): string =>
  connection.frontendTag ?? panic(new Error("A frontend address is required"));

/** @internal */
export const _usingStore = (
  connection: EthersMosaicConnection
): connection is EthersMosaicConnection & { useStore: EthersMosaicStoreOption } =>
  connection.useStore !== undefined;

/**
 * Thrown when trying to connect to a network where Mosaic is not deployed.
 *
 * @remarks
 * Thrown by {@link ReadableEthersMosaic.(connect:2)} and {@link EthersMosaic.(connect:2)}.
 *
 * @public
 */
export class UnsupportedNetworkError extends Error {
  /** Chain ID of the unsupported network. */
  readonly chainId: number;

  /** @internal */
  constructor(chainId: number) {
    super(`Unsupported network (chainId = ${chainId})`);
    this.name = "UnsupportedNetworkError";
    this.chainId = chainId;
  }
}

const getProviderAndSigner = (
  signerOrProvider: EthersSigner | EthersProvider
): [provider: EthersProvider, signer: EthersSigner | undefined] => {
  const provider: EthersProvider = Signer.isSigner(signerOrProvider)
    ? signerOrProvider.provider ?? panic(new Error("Signer must have a Provider"))
    : signerOrProvider;

  const signer = Signer.isSigner(signerOrProvider) ? signerOrProvider : undefined;

  return [provider, signer];
};

/** @internal */
export const _connectToDeployment = (
  deployment: _MosaicDeploymentJSON,
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersMosaicConnectionOptionalParams
): EthersMosaicConnection =>
  connectionFrom(
    ...getProviderAndSigner(signerOrProvider),
    _connectToContracts(signerOrProvider, deployment),
    undefined,
    deployment,
    optionalParams
  );

/**
 * Possible values for the optional
 * {@link EthersMosaicConnectionOptionalParams.useStore | useStore}
 * connection parameter.
 *
 * @remarks
 * Currently, the only supported value is `"blockPolled"`, in which case a
 * {@link BlockPolledMosaicStore} will be created.
 *
 * @public
 */
export type EthersMosaicStoreOption = "blockPolled";

const validStoreOptions = ["blockPolled"];

/**
 * Optional parameters of {@link ReadableEthersMosaic.(connect:2)} and
 * {@link EthersMosaic.(connect:2)}.
 *
 * @public
 */
export interface EthersMosaicConnectionOptionalParams {
  /**
   * Address whose Trove, Stability Deposit, MSIC Stake and balances will be read by default.
   *
   * @remarks
   * For example {@link EthersMosaic.getTrove | getTrove(address?)} will return the Trove owned by
   * `userAddress` when the `address` parameter is omitted.
   *
   * Should be omitted when connecting through a {@link EthersSigner | Signer}. Instead `userAddress`
   * will be automatically determined from the `Signer`.
   */
  readonly userAddress?: string;

  /**
   * Address that will receive MSIC rewards from newly created Stability Deposits by default.
   *
   * @remarks
   * For example
   * {@link EthersMosaic.depositMoUSDInStabilityPool | depositMoUSDInStabilityPool(amount, frontendTag?)}
   * will tag newly made Stability Deposits with this address when its `frontendTag` parameter is
   * omitted.
   */
  readonly frontendTag?: string;

  /**
   * Create a {@link @liquity/lib-base#MosaicStore} and expose it as the `store` property.
   *
   * @remarks
   * When set to one of the available {@link EthersMosaicStoreOption | options},
   * {@link ReadableEthersMosaic.(connect:2) | ReadableEthersMosaic.connect()} will return a
   * {@link ReadableEthersMosaicWithStore}, while
   * {@link EthersMosaic.(connect:2) | EthersMosaic.connect()} will return an
   * {@link EthersMosaicWithStore}.
   *
   * Note that the store won't start monitoring the blockchain until its
   * {@link @liquity/lib-base#MosaicStore.start | start()} function is called.
   */
  readonly useStore?: EthersMosaicStoreOption;
}

/** @internal */
export function _connectByChainId<T>(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams: EthersMosaicConnectionOptionalParams & { useStore: T }
): EthersMosaicConnection & { useStore: T };

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersMosaicConnectionOptionalParams
): EthersMosaicConnection;

/** @internal */
export function _connectByChainId(
  provider: EthersProvider,
  signer: EthersSigner | undefined,
  chainId: number,
  optionalParams?: EthersMosaicConnectionOptionalParams
): EthersMosaicConnection {
  const deployment: _MosaicDeploymentJSON =
    deployments[chainId] ?? panic(new UnsupportedNetworkError(chainId));

  return connectionFrom(
    provider,
    signer,
    _connectToContracts(provider, deployment),
    _connectToMulticall(provider, chainId),
    deployment,
    optionalParams
  );
}

/** @internal */
export const _connect = async (
  signerOrProvider: EthersSigner | EthersProvider,
  optionalParams?: EthersMosaicConnectionOptionalParams
): Promise<EthersMosaicConnection> => {
  const [provider, signer] = getProviderAndSigner(signerOrProvider);

  if (signer) {
    if (optionalParams?.userAddress !== undefined) {
      throw new Error("Can't override userAddress when connecting through Signer");
    }

    optionalParams = {
      ...optionalParams,
      userAddress: await signer.getAddress()
    };
  }

  return _connectByChainId(provider, signer, (await provider.getNetwork()).chainId, optionalParams);
};
