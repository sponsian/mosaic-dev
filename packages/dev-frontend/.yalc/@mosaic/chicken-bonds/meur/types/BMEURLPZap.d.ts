import type { BaseContract, BigNumber, BigNumberish, BytesLike, CallOverrides, ContractTransaction, Overrides, PopulatedTransaction, Signer, utils } from "ethers";
import type { FunctionFragment, Result } from "@ethersproject/abi";
import type { Listener, Provider } from "@ethersproject/providers";
import type { TypedEventFilter, TypedEvent, TypedListener, OnEvent } from "./common";
export interface BMEURLPZapInterface extends utils.Interface {
    functions: {
        "addLiquidity(uint256,uint256,uint256)": FunctionFragment;
        "addLiquidityAndStake(uint256,uint256,uint256)": FunctionFragment;
        "bMEURGauge()": FunctionFragment;
        "bMEURMEUR3CRVLPToken()": FunctionFragment;
        "bMEURMEUR3CRVPool()": FunctionFragment;
        "bMEURToken()": FunctionFragment;
        "getMinLPTokens(uint256,uint256)": FunctionFragment;
        "getMinWithdrawBalanced(uint256)": FunctionFragment;
        "getMinWithdrawMEUR(uint256)": FunctionFragment;
        "msic3CRVPool()": FunctionFragment;
        "msicToken()": FunctionFragment;
        "removeLiquidityBalanced(uint256,uint256,uint256)": FunctionFragment;
        "removeLiquidityMEUR(uint256,uint256)": FunctionFragment;
    };
    getFunction(nameOrSignatureOrTopic: "addLiquidity" | "addLiquidityAndStake" | "bMEURGauge" | "bMEURMEUR3CRVLPToken" | "bMEURMEUR3CRVPool" | "bMEURToken" | "getMinLPTokens" | "getMinWithdrawBalanced" | "getMinWithdrawMEUR" | "msic3CRVPool" | "msicToken" | "removeLiquidityBalanced" | "removeLiquidityMEUR"): FunctionFragment;
    encodeFunctionData(functionFragment: "addLiquidity", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "addLiquidityAndStake", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "bMEURGauge", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMEURMEUR3CRVLPToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMEURMEUR3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "bMEURToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "getMinLPTokens", values: [BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawBalanced", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "getMinWithdrawMEUR", values: [BigNumberish]): string;
    encodeFunctionData(functionFragment: "msic3CRVPool", values?: undefined): string;
    encodeFunctionData(functionFragment: "msicToken", values?: undefined): string;
    encodeFunctionData(functionFragment: "removeLiquidityBalanced", values: [BigNumberish, BigNumberish, BigNumberish]): string;
    encodeFunctionData(functionFragment: "removeLiquidityMEUR", values: [BigNumberish, BigNumberish]): string;
    decodeFunctionResult(functionFragment: "addLiquidity", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "addLiquidityAndStake", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMEURGauge", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMEURMEUR3CRVLPToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMEURMEUR3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "bMEURToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinLPTokens", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "getMinWithdrawMEUR", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "msic3CRVPool", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "msicToken", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityBalanced", data: BytesLike): Result;
    decodeFunctionResult(functionFragment: "removeLiquidityMEUR", data: BytesLike): Result;
    events: {};
}
export interface BMEURLPZap extends BaseContract {
    connect(signerOrProvider: Signer | Provider | string): this;
    attach(addressOrName: string): this;
    deployed(): Promise<this>;
    interface: BMEURLPZapInterface;
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
        addLiquidity(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        addLiquidityAndStake(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        bMEURGauge(overrides?: CallOverrides): Promise<[string]>;
        bMEURMEUR3CRVLPToken(overrides?: CallOverrides): Promise<[string]>;
        bMEURMEUR3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        bMEURToken(overrides?: CallOverrides): Promise<[string]>;
        getMinLPTokens(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            bMEURMEUR3CRVTokens: BigNumber;
        }>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bMEURAmount: BigNumber;
            msicAmount: BigNumber;
        }>;
        getMinWithdrawMEUR(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[BigNumber] & {
            msicAmount: BigNumber;
        }>;
        msic3CRVPool(overrides?: CallOverrides): Promise<[string]>;
        msicToken(overrides?: CallOverrides): Promise<[string]>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMEUR: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
        removeLiquidityMEUR(_lpAmount: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<ContractTransaction>;
    };
    addLiquidity(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    addLiquidityAndStake(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    bMEURGauge(overrides?: CallOverrides): Promise<string>;
    bMEURMEUR3CRVLPToken(overrides?: CallOverrides): Promise<string>;
    bMEURMEUR3CRVPool(overrides?: CallOverrides): Promise<string>;
    bMEURToken(overrides?: CallOverrides): Promise<string>;
    getMinLPTokens(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
        BigNumber,
        BigNumber
    ] & {
        bMEURAmount: BigNumber;
        msicAmount: BigNumber;
    }>;
    getMinWithdrawMEUR(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
    msic3CRVPool(overrides?: CallOverrides): Promise<string>;
    msicToken(overrides?: CallOverrides): Promise<string>;
    removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMEUR: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    removeLiquidityMEUR(_lpAmount: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
        from?: string | Promise<string>;
    }): Promise<ContractTransaction>;
    callStatic: {
        addLiquidity(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        addLiquidityAndStake(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        bMEURGauge(overrides?: CallOverrides): Promise<string>;
        bMEURMEUR3CRVLPToken(overrides?: CallOverrides): Promise<string>;
        bMEURMEUR3CRVPool(overrides?: CallOverrides): Promise<string>;
        bMEURToken(overrides?: CallOverrides): Promise<string>;
        getMinLPTokens(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<[
            BigNumber,
            BigNumber
        ] & {
            bMEURAmount: BigNumber;
            msicAmount: BigNumber;
        }>;
        getMinWithdrawMEUR(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        msic3CRVPool(overrides?: CallOverrides): Promise<string>;
        msicToken(overrides?: CallOverrides): Promise<string>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMEUR: BigNumberish, _minMEUR: BigNumberish, overrides?: CallOverrides): Promise<void>;
        removeLiquidityMEUR(_lpAmount: BigNumberish, _minMEUR: BigNumberish, overrides?: CallOverrides): Promise<void>;
    };
    filters: {};
    estimateGas: {
        addLiquidity(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        addLiquidityAndStake(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        bMEURGauge(overrides?: CallOverrides): Promise<BigNumber>;
        bMEURMEUR3CRVLPToken(overrides?: CallOverrides): Promise<BigNumber>;
        bMEURMEUR3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        bMEURToken(overrides?: CallOverrides): Promise<BigNumber>;
        getMinLPTokens(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        getMinWithdrawMEUR(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<BigNumber>;
        msic3CRVPool(overrides?: CallOverrides): Promise<BigNumber>;
        msicToken(overrides?: CallOverrides): Promise<BigNumber>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMEUR: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
        removeLiquidityMEUR(_lpAmount: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<BigNumber>;
    };
    populateTransaction: {
        addLiquidity(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        addLiquidityAndStake(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, _minLPTokens: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        bMEURGauge(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMEURMEUR3CRVLPToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMEURMEUR3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        bMEURToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinLPTokens(_bMEURAmount: BigNumberish, _msicAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawBalanced(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        getMinWithdrawMEUR(_lpAmount: BigNumberish, overrides?: CallOverrides): Promise<PopulatedTransaction>;
        msic3CRVPool(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        msicToken(overrides?: CallOverrides): Promise<PopulatedTransaction>;
        removeLiquidityBalanced(_lpAmount: BigNumberish, _minBMEUR: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
        removeLiquidityMEUR(_lpAmount: BigNumberish, _minMEUR: BigNumberish, overrides?: Overrides & {
            from?: string | Promise<string>;
        }): Promise<PopulatedTransaction>;
    };
}
