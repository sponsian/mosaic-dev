import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface BMoUSDLPZapInterface extends utils.Interface {
    functions: {
        "addLiquidity(uint256,uint256,uint256)": FunctionFragment;
        "addLiquidityAndStake(uint256,uint256,uint256)": FunctionFragment;
        "bMoUSDGauge()": FunctionFragment;
        "bMoUSDMoUSD3CRVLPToken()": FunctionFragment;
        "bMoUSDMoUSD3CRVPool()": FunctionFragment;
        "bMoUSDToken()": FunctionFragment;
        "getMinLPTokens(uint256,uint256)": FunctionFragment;
        "getMinWithdrawBalanced(uint256)": FunctionFragment;
        "getMinWithdrawMoUSD(uint256)": FunctionFragment;
        "msic3CRVPool()": FunctionFragment;
        "msicToken()": FunctionFragment;
        "removeLiquidityBalanced(uint256,uint256,uint256)": FunctionFragment;
        "removeLiquidityMoUSD(uint256,uint256)": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "addLiquidity" | "addLiquidityAndStake" | "bMoUSDGauge" | "bMoUSDMoUSD3CRVLPToken" | "bMoUSDMoUSD3CRVPool" | "bMoUSDToken" | "getMinLPTokens" | "getMinWithdrawBalanced" | "getMinWithdrawMoUSD" | "msic3CRVPool" | "msicToken" | "removeLiquidityBalanced" | "removeLiquidityMoUSD"): FunctionFragment;
    encodeFunctionData(functionFragment: "addLiquidity", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "addLiquidityAndStake", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "bMoUSDGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMoUSDMoUSD3CRVLPToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMoUSDMoUSD3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMoUSDToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "getMinLPTokens", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawBalanced", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawMoUSD", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "msic3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "msicToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "removeLiquidityBalanced", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "removeLiquidityMoUSD", values: [BigNumberish, BigNumberish]): string;
    decodeFunctionResult(functionFragment: "addLiquidity", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "addLiquidityAndStake", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMoUSDGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMoUSDMoUSD3CRVLPToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMoUSDMoUSD3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMoUSDToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinLPTokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawMoUSD", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "msic3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "msicToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityMoUSD", data: BytesLike): Result;
    events: {};
}
export interface BMoUSDLPZap extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: BMoUSDLPZapInterface;
    queryFilter<TEvent extends TypedEvent>(event: TypedEventFilter<TEvent>, fromBlockOrBlockhash?: string | number | undefined, toBlock?: string | number | undefined): Promise<Array<TEvent>>;
    listeners<TEvent extends TypedEvent>(eventFilter?: TypedEventFilter<TEvent>): Array<TypedListener<TEvent>>;
    listeners(eventName?: string): Array<Listener>;
    removeAllListeners<TEvent extends TypedEvent>(eventFilter: TypedEventFilter<TEvent>): this;
    removeAllListeners(eventName?: string): this;
    off: OnEvent<this>;
    on: OnEvent<this>;
    once: OnEvent<this>;
    removeListener: OnEvent<this>;
    functions: {
        addLiquidity(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        addLiquidityAndStake(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        bMoUSDGauge(overrides?: CallOverrides): Promise<[string]>;
        bMoUSDMoUSD3CRVLPToken(overrides?: CallOverrides): Promise<[string]>;
        bMoUSDMoUSD3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        bMoUSDToken(overrides?: CallOverrides): Promise<[string]>;
        getMinLPTokens(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            bMoUSDMoUSD3CRVTokens: BigNumber;
        }>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bMoUSDAmount: BigNumber;
            msicAmount: BigNumber;
        }>;
        getMinWithdrawMoUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            msicAmount: BigNumber;
        }>;
        msic3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        msicToken(overrides?: CallOverrides): Promise<[string]>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMoUSD: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityMoUSD(_lpAmount: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
    };
    addLiquidity(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    addLiquidityAndStake(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    bMoUSDGauge(overrides?: CallOverrides): Promise<string>;
    bMoUSDMoUSD3CRVLPToken(overrides?: CallOverrides): Promise<string>;
    bMoUSDMoUSD3CRVPool(overrides?: CallOverrides): Promise<string>;
    bMoUSDToken(overrides?: CallOverrides): Promise<string>;
    getMinLPTokens(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber
    ] & {
        bMoUSDAmount: BigNumber;
        msicAmount: BigNumber;
    }>;
    getMinWithdrawMoUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    msic3CRVPool(overrides?: CallOverrides): Promise<string>;
    msicToken(overrides?: CallOverrides): Promise<string>;
    removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMoUSD: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityMoUSD(_lpAmount: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    callStatic: {
        addLiquidity(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        addLiquidityAndStake(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        bMoUSDGauge(overrides?: CallOverrides): Promise<string>;
        bMoUSDMoUSD3CRVLPToken(overrides?: CallOverrides): Promise<string>;
        bMoUSDMoUSD3CRVPool(overrides?: CallOverrides): Promise<string>;
        bMoUSDToken(overrides?: CallOverrides): Promise<string>;
        getMinLPTokens(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bMoUSDAmount: BigNumber;
            msicAmount: BigNumber;
        }>;
        getMinWithdrawMoUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        msic3CRVPool(overrides?: CallOverrides): Promise<string>;
        msicToken(overrides?: CallOverrides): Promise<string>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMoUSD: BigNumberish, _minMoUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
        removeLiquidityMoUSD(_lpAmount: BigNumberish, _minMoUSD: BigNumberish, overrides?: CallOverrides): Promise<void>;
    };
    filters: {};
    estimateGas: {
        addLiquidity(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        addLiquidityAndStake(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        bMoUSDGauge(overrides?: CallOverrides): Promise<BigNumber>;
        bMoUSDMoUSD3CRVLPToken(overrides?: CallOverrides): Promise<BigNumber>;
        bMoUSDMoUSD3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        bMoUSDToken(overrides?: CallOverrides): Promise<BigNumber>;
        getMinLPTokens(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawMoUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        msic3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        msicToken(overrides?: CallOverrides): Promise<BigNumber>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMoUSD: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        removeLiquidityMoUSD(_lpAmount: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
    };
    populateTransaction: {
        addLiquidity(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        addLiquidityAndStake(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        bMoUSDGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMoUSDMoUSD3CRVLPToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMoUSDMoUSD3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMoUSDToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinLPTokens(_bMoUSDAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawMoUSD(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        msic3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        msicToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMoUSD: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityMoUSD(_lpAmount: BigNumberish, _minMoUSD: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
    };
}
