import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { BondViewContext, BondViewContextType } from "./BondViewContext";
import type {
  Stats,
  BondView,
  BondEvent,
  Payload,
  Bond,
  BondTransactionStatuses,
  CreateBondPayload,
  ProtocolInfo,
  OptimisticBond,
  SwapPayload,
  ApprovePressedPayload,
  ManageLiquidityPayload,
  BMousdLpRewards
} from "./transitions";
import { BMousdAmmTokenIndex } from "./transitions";
import { transitions } from "./transitions";
import { Decimal } from "@mosaic/lib-base";
import { useMosaic } from "../../../hooks/MosaicContext";
import { api, _getProtocolInfo } from "./api";
import { useTransaction } from "../../../hooks/useTransaction";
import type { ERC20Faucet } from "@mosaic/chicken-bonds/msic/types";
import { useBondContracts } from "./useBondContracts";
import { useChainId } from "wagmi";
import { useBondAddresses } from "./BondAddressesContext";

// Refresh backend values every 15 seconds
const SYNCHRONIZE_INTERVAL_MS = 15 * 1000;

const isValidEvent = (view: BondView, event: BondEvent): boolean => {
  return transitions[view][event] !== undefined;
};

const transition = (view: BondView, event: BondEvent): BondView => {
  const nextView = transitions[view][event] ?? view;
  return nextView;
};

export const EXAMPLE_NFT = "./bonds/egg-nft.png";

export const BondViewProvider: React.FC = props => {
  const { children } = props;
  const [view, setView] = useState<BondView>("IDLE");
  const viewRef = useRef<BondView>(view);
  const [selectedBondId, setSelectedBondId] = useState<string>();
  const [optimisticBond, setOptimisticBond] = useState<OptimisticBond>();
  const [shouldSynchronize, setShouldSynchronize] = useState<boolean>(true);
  const [bonds, setBonds] = useState<Bond[]>();
  const [stats, setStats] = useState<Stats>();
  const [protocolInfo, setProtocolInfo] = useState<ProtocolInfo>();
  const [simulatedProtocolInfo, setSimulatedProtocolInfo] = useState<ProtocolInfo>();
  const [isInfiniteBondApproved, setIsInfiniteBondApproved] = useState(false);
  const [lpRewards, setLpRewards] = useState<BMousdLpRewards>();
  const [isMousdApprovedWithBmsicAmm, setIsMousdApprovedWithBmsicAmm] = useState(false);
  const [isBMousdApprovedWithBmsicAmm, setIsBMousdApprovedWithBmsicAmm] = useState(false);
  const [isMousdApprovedWithAmmZapper, setIsMousdApprovedWithAmmZapper] = useState(false);
  const [isBMousdApprovedWithAmmZapper, setIsBMousdApprovedWithAmmZapper] = useState(false);
  const [isBMousdLpApprovedWithAmmZapper, setIsBMousdLpApprovedWithAmmZapper] = useState(false);
  const [isBMousdLpApprovedWithGauge, setIsBMousdLpApprovedWithGauge] = useState(false);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [inputToken, setInputToken] = useState<BMousdAmmTokenIndex.BMoUSD | BMousdAmmTokenIndex.MoUSD>(
    BMousdAmmTokenIndex.BMoUSD
  );
  const [statuses, setStatuses] = useState<BondTransactionStatuses>({
    APPROVE: "IDLE",
    CREATE: "IDLE",
    CANCEL: "IDLE",
    CLAIM: "IDLE",
    APPROVE_AMM: "IDLE",
    APPROVE_SPENDER: "IDLE",
    SWAP: "IDLE",
    MANAGE_LIQUIDITY: "IDLE"
  });
  const [bMousdBalance, setBMousdBalance] = useState<Decimal>();
  const [msicBalance, setMousdBalance] = useState<Decimal>();
  const [lpTokenBalance, setLpTokenBalance] = useState<Decimal>();
  const [stakedLpTokenBalance, setStakedLpTokenBalance] = useState<Decimal>();

  const [lpTokenSupply, setLpTokenSupply] = useState<Decimal>();
  const [bMousdAmmBMousdBalance, setBMousdAmmBMousdBalance] = useState<Decimal>();
  const [bMousdAmmMousdBalance, setBMousdAmmMousdBalance] = useState<Decimal>();
  const [isBootstrapPeriodActive, setIsBootstrapPeriodActive] = useState<boolean>();
  const { account, mosaic } = useMosaic();
  const {
    MoUSD_OVERRIDE_ADDRESS,
    BMoUSD_AMM_ADDRESS,
    BMoUSD_LP_ZAP_ADDRESS,
    BMoUSD_AMM_STAKING_ADDRESS
  } = useBondAddresses();
  const contracts = useBondContracts();
  const chainId = useChainId();
  const isMainnet = chainId === 1;

  const setSimulatedMarketPrice = useCallback(
    (marketPrice: Decimal) => {
      if (protocolInfo === undefined) return;
      const simulatedProtocolInfo = _getProtocolInfo(
        marketPrice,
        protocolInfo.floorPrice,
        protocolInfo.claimBondFee,
        protocolInfo.alphaAccrualFactor
      );

      setSimulatedProtocolInfo({
        ...protocolInfo,
        ...simulatedProtocolInfo,
        simulatedMarketPrice: marketPrice
      });
    },
    [protocolInfo]
  );

  const resetSimulatedMarketPrice = useCallback(() => {
    if (protocolInfo === undefined) return;

    setSimulatedProtocolInfo({ ...protocolInfo });
  }, [protocolInfo]);

  const removeBondFromList = useCallback(
    (bondId: string) => {
      if (bonds === undefined) return;
      const idx = bonds.findIndex(bond => bond.id === bondId);
      const nextBonds = bonds.slice(0, idx).concat(bonds.slice(idx + 1));
      setBonds(nextBonds);
    },
    [bonds]
  );

  const changeBondStatusToClaimed = useCallback(
    (bondId: string) => {
      if (bonds === undefined) return;
      const idx = bonds.findIndex(bond => bond.id === bondId);
      const updatedBond: Bond = { ...bonds[idx], status: "CLAIMED" };
      const nextBonds = bonds
        .slice(0, idx)
        .concat(updatedBond)
        .concat(bonds.slice(idx + 1));
      setBonds(nextBonds);
    },
    [bonds]
  );

  const getMousdFromFaucet = useCallback(async () => {
    if (contracts.msicToken === undefined || mosaic.connection.signer === undefined) return;

    if (
      MoUSD_OVERRIDE_ADDRESS !== null &&
      (await contracts.msicToken.balanceOf(account)).eq(0) &&
      "tap" in contracts.msicToken
    ) {
      await (
        await ((contracts.msicToken as unknown) as ERC20Faucet)
          .connect(mosaic.connection.signer)
          .tap()
      ).wait();
      setShouldSynchronize(true);
    }
  }, [contracts.msicToken, account, MoUSD_OVERRIDE_ADDRESS, mosaic.connection.signer]);

  useEffect(() => {
    (async () => {
      if (
        contracts.msicToken === undefined ||
        contracts.chickenBondManager === undefined ||
        account === undefined ||
        isInfiniteBondApproved
      )
        return;
      const isApproved = await api.isInfiniteBondApproved(
        account,
        contracts.msicToken,
        contracts.chickenBondManager
      );
      setIsInfiniteBondApproved(isApproved);
    })();
  }, [contracts.msicToken, contracts.chickenBondManager, account, isInfiniteBondApproved]);

  useEffect(() => {
    (async () => {
      if (
        BMoUSD_AMM_ADDRESS === null ||
        contracts.msicToken === undefined ||
        isMousdApprovedWithBmsicAmm
      ) {
        return;
      }
      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBMousdAmmMainnet(account, contracts.msicToken)
        : api.isTokenApprovedWithBMousdAmm(account, contracts.msicToken, BMoUSD_AMM_ADDRESS));

      setIsMousdApprovedWithBmsicAmm(isApproved);
    })();
  }, [contracts.msicToken, account, isMousdApprovedWithBmsicAmm, isMainnet, BMoUSD_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMoUSD_AMM_ADDRESS === null ||
        contracts.bMousdToken === undefined ||
        isBMousdApprovedWithBmsicAmm
      ) {
        return;
      }

      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBMousdAmmMainnet(account, contracts.bMousdToken)
        : api.isTokenApprovedWithBMousdAmm(account, contracts.bMousdToken, BMoUSD_AMM_ADDRESS));

      setIsBMousdApprovedWithBmsicAmm(isApproved);
    })();
  }, [contracts.bMousdToken, account, isBMousdApprovedWithBmsicAmm, isMainnet, BMoUSD_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMoUSD_LP_ZAP_ADDRESS === null ||
        contracts.msicToken === undefined ||
        isMousdApprovedWithAmmZapper
      ) {
        return;
      }

      const isMousdApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.msicToken,
        BMoUSD_LP_ZAP_ADDRESS
      );

      setIsMousdApprovedWithAmmZapper(isMousdApproved);
    })();
  }, [contracts.msicToken, account, isMousdApprovedWithAmmZapper, BMoUSD_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (contracts.bMousdAmm === undefined || isBMousdLpApprovedWithAmmZapper) return;
      const lpToken = await api.getLpToken(contracts.bMousdAmm);
      const isLpApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        lpToken,
        BMoUSD_LP_ZAP_ADDRESS
      );

      setIsBMousdLpApprovedWithAmmZapper(isLpApproved);
    })();
  }, [contracts.bMousdAmm, account, isBMousdLpApprovedWithAmmZapper, BMoUSD_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMoUSD_LP_ZAP_ADDRESS === null ||
        contracts.bMousdToken === undefined ||
        isBMousdApprovedWithAmmZapper
      ) {
        return;
      }

      const isBMousdApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.bMousdToken,
        BMoUSD_LP_ZAP_ADDRESS
      );

      setIsMousdApprovedWithAmmZapper(isBMousdApproved);
    })();
  }, [contracts.bMousdToken, account, isBMousdApprovedWithAmmZapper, BMoUSD_LP_ZAP_ADDRESS]);

  useEffect(() => {
    if (isSynchronizing) return;
    const timer = setTimeout(() => setShouldSynchronize(true), SYNCHRONIZE_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [isSynchronizing]);

  useEffect(() => {
    (async () => {
      try {
        if (
          contracts.msicToken === undefined ||
          contracts.bondNft === undefined ||
          contracts.chickenBondManager === undefined ||
          contracts.bMousdToken === undefined ||
          contracts.bMousdAmm === undefined ||
          contracts.bMousdGauge === undefined ||
          !shouldSynchronize ||
          isSynchronizing
        ) {
          return;
        }
        setIsSynchronizing(true);

        const latest = await contracts.getLatestData(account, api);
        if (latest === undefined) {
          setIsSynchronizing(false);
          return;
        }

        const {
          protocolInfo,
          bonds,
          stats,
          bMousdBalance,
          msicBalance,
          lpTokenBalance,
          stakedLpTokenBalance,
          lpTokenSupply,
          bMousdAmmBMousdBalance,
          bMousdAmmMousdBalance,
          lpRewards
        } = latest;

        setProtocolInfo(protocolInfo);

        // Don't change the simualted price if we already have one since only the user should change it
        if (simulatedProtocolInfo === undefined) {
          const simulatedProtocolInfo = _getProtocolInfo(
            protocolInfo.simulatedMarketPrice,
            protocolInfo.floorPrice,
            protocolInfo.claimBondFee,
            protocolInfo.alphaAccrualFactor
          );
          setSimulatedProtocolInfo({
            ...protocolInfo,
            ...simulatedProtocolInfo,
            simulatedMarketPrice: protocolInfo.simulatedMarketPrice
          });
        }

        setShouldSynchronize(false);
        setLpRewards(lpRewards);
        setBMousdBalance(bMousdBalance);
        setMousdBalance(msicBalance);
        setLpTokenBalance(lpTokenBalance);
        setStakedLpTokenBalance(stakedLpTokenBalance);
        setLpTokenSupply(lpTokenSupply);
        setBMousdAmmBMousdBalance(bMousdAmmBMousdBalance);
        setBMousdAmmMousdBalance(bMousdAmmMousdBalance);
        setStats(stats);
        setBonds(bonds);
        setOptimisticBond(undefined);
      } catch (error: unknown) {
        console.error("Synchronising effect exception", error);
      }

      setIsSynchronizing(false);
    })();
  }, [isSynchronizing, shouldSynchronize, account, contracts, simulatedProtocolInfo]);

  const [approveInfiniteBond, approveStatus] = useTransaction(async () => {
    await api.approveInfiniteBond(
      contracts.msicToken,
      contracts.chickenBondManager,
      mosaic.connection.signer
    );
    setIsInfiniteBondApproved(true);
  }, [contracts.msicToken, contracts.chickenBondManager, mosaic.connection.signer]);

  const [approveAmm, approveAmmStatus] = useTransaction(
    async (tokensNeedingApproval: BMousdAmmTokenIndex[]) => {
      for (const token of tokensNeedingApproval) {
        if (token === BMousdAmmTokenIndex.BMoUSD) {
          await (isMainnet
            ? api.approveTokenWithBMousdAmmMainnet(contracts.bMousdToken, mosaic.connection.signer)
            : api.approveTokenWithBMousdAmm(
                contracts.bMousdToken,
                BMoUSD_AMM_ADDRESS,
                mosaic.connection.signer
              ));

          setIsBMousdApprovedWithBmsicAmm(true);
        } else {
          await (isMainnet
            ? api.approveTokenWithBMousdAmmMainnet(contracts.msicToken, mosaic.connection.signer)
            : api.approveTokenWithBMousdAmm(
                contracts.msicToken,
                BMoUSD_AMM_ADDRESS,
                mosaic.connection.signer
              ));

          setIsMousdApprovedWithBmsicAmm(true);
        }
      }
    },
    [
      contracts.bMousdToken,
      contracts.msicToken,
      isMainnet,
      BMoUSD_AMM_ADDRESS,
      mosaic.connection.signer
    ]
  );

  const [approveTokens, approveTokensStatus] = useTransaction(
    async ({ tokensNeedingApproval }: ApprovePressedPayload) => {
      if (contracts.bMousdAmm === undefined) return;
      for (const [token, spender] of Array.from(tokensNeedingApproval)) {
        if (token === BMousdAmmTokenIndex.BMoUSD) {
          await api.approveToken(contracts.bMousdToken, spender, mosaic.connection.signer);
          if (spender === BMoUSD_AMM_ADDRESS) {
            setIsBMousdApprovedWithBmsicAmm(true);
          } else if (spender === BMoUSD_LP_ZAP_ADDRESS) {
            setIsBMousdApprovedWithAmmZapper(true);
          }
        } else if (token === BMousdAmmTokenIndex.MoUSD) {
          await api.approveToken(
            contracts.msicToken,
            BMoUSD_LP_ZAP_ADDRESS,
            mosaic.connection.signer
          );
          setIsMousdApprovedWithAmmZapper(true);
        } else if (token === BMousdAmmTokenIndex.BMoUSD_MoUSD_LP && spender === undefined) {
          const lpToken = await api.getLpToken(contracts.bMousdAmm);
          await api.approveToken(lpToken, BMoUSD_LP_ZAP_ADDRESS, mosaic.connection.signer);
          setIsBMousdLpApprovedWithAmmZapper(true);
        } else if (token === BMousdAmmTokenIndex.BMoUSD_MoUSD_LP) {
          const lpToken = await api.getLpToken(contracts.bMousdAmm);
          await api.approveToken(lpToken, spender, mosaic.connection.signer);
          if (spender === BMoUSD_LP_ZAP_ADDRESS) {
            setIsBMousdLpApprovedWithAmmZapper(true);
          } else if (spender === BMoUSD_AMM_STAKING_ADDRESS) {
            setIsBMousdLpApprovedWithGauge(true);
          }
        }
      }
    },
    [
      contracts.bMousdAmm,
      contracts.bMousdToken,
      contracts.msicToken,
      BMoUSD_LP_ZAP_ADDRESS,
      BMoUSD_AMM_STAKING_ADDRESS,
      BMoUSD_AMM_ADDRESS,
      mosaic.connection.signer
    ]
  );

  const [createBond, createStatus] = useTransaction(
    async (msicAmount: Decimal) => {
      await api.createBond(
        msicAmount,
        account,
        contracts.chickenBondManager,
        mosaic.connection.signer
      );
      const optimisticBond: OptimisticBond = {
        id: "OPTIMISTIC_BOND",
        deposit: msicAmount,
        startTime: Date.now(),
        status: "PENDING"
      };
      setOptimisticBond(optimisticBond);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, mosaic.connection.signer, account]
  );

  const [cancelBond, cancelStatus] = useTransaction(
    async (bondId: string, minimumMousd: Decimal) => {
      await api.cancelBond(
        bondId,
        minimumMousd,
        account,
        contracts.chickenBondManager,
        mosaic.connection.signer
      );
      removeBondFromList(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, removeBondFromList, mosaic.connection.signer, account]
  );

  const [claimBond, claimStatus] = useTransaction(
    async (bondId: string) => {
      await api.claimBond(bondId, account, contracts.chickenBondManager, mosaic.connection.signer);
      changeBondStatusToClaimed(bondId);
      setShouldSynchronize(true);
    },
    [contracts.chickenBondManager, changeBondStatusToClaimed, mosaic.connection.signer, account]
  );

  const getExpectedSwapOutput = useCallback(
    async (inputToken: BMousdAmmTokenIndex, inputAmount: Decimal) =>
      contracts.bMousdAmm
        ? (isMainnet ? api.getExpectedSwapOutputMainnet : api.getExpectedSwapOutput)(
            inputToken,
            inputAmount,
            contracts.bMousdAmm
          )
        : Decimal.ZERO,
    [contracts.bMousdAmm, isMainnet]
  );

  const [swapTokens, swapStatus] = useTransaction(
    async (inputToken: BMousdAmmTokenIndex, inputAmount: Decimal, minOutputAmount: Decimal) => {
      await (isMainnet ? api.swapTokensMainnet : api.swapTokens)(
        inputToken,
        inputAmount,
        minOutputAmount,
        contracts.bMousdAmm,
        mosaic.connection.signer,
        account
      );
      setShouldSynchronize(true);
    },
    [contracts.bMousdAmm, isMainnet, mosaic.connection.signer, account]
  );

  const getExpectedLpTokens = useCallback(
    async (bMousdAmount: Decimal, msicAmount: Decimal) => {
      return contracts.bMousdAmmZapper
        ? api.getExpectedLpTokens(bMousdAmount, msicAmount, contracts.bMousdAmmZapper)
        : Decimal.ZERO;
    },
    [contracts.bMousdAmmZapper]
  );

  const [manageLiquidity, manageLiquidityStatus] = useTransaction(
    async (params: ManageLiquidityPayload) => {
      if (params.action === "addLiquidity") {
        await api.addLiquidity(
          params.bMousdAmount,
          params.msicAmount,
          params.minLpTokens,
          params.shouldStakeInGauge,
          contracts.bMousdAmmZapper,
          mosaic.connection.signer,
          account
        );
      } else if (params.action === "removeLiquidity") {
        await api.removeLiquidity(
          params.burnLpTokens,
          params.minBMousdAmount,
          params.minMousdAmount,
          contracts.bMousdAmmZapper,
          mosaic.connection.signer
        );
      } else if (params.action === "removeLiquidityOneCoin") {
        await api.removeLiquidityOneCoin(
          params.burnLpTokens,
          params.output,
          params.minAmount,
          contracts.bMousdAmmZapper,
          contracts.bMousdAmm,
          mosaic.connection.signer,
          account
        );
      } else if (params.action === "stakeLiquidity") {
        await api.stakeLiquidity(
          params.stakeAmount,
          contracts.bMousdGauge,
          mosaic.connection.signer
        );
      } else if (params.action === "unstakeLiquidity") {
        await api.unstakeLiquidity(
          params.unstakeAmount,
          contracts.bMousdGauge,
          mosaic.connection.signer
        );
      } else if (params.action === "claimLpRewards") {
        await api.claimLpRewards(contracts.bMousdGauge, mosaic.connection.signer);
      }
      setShouldSynchronize(true);
    },
    [
      contracts.bMousdAmmZapper,
      contracts.bMousdGauge,
      contracts.bMousdAmm,
      mosaic.connection.signer,
      account
    ]
  );

  const getExpectedWithdrawal = useCallback(
    async (
      burnLp: Decimal,
      output: BMousdAmmTokenIndex | "both"
    ): Promise<Map<BMousdAmmTokenIndex, Decimal>> => {
      if (contracts.bMousdAmm === undefined)
        return new Map([
          [BMousdAmmTokenIndex.MoUSD, Decimal.ZERO],
          [BMousdAmmTokenIndex.BMoUSD, Decimal.ZERO]
        ]);

      return contracts.bMousdAmmZapper
        ? api.getExpectedWithdrawal(burnLp, output, contracts.bMousdAmmZapper, contracts.bMousdAmm)
        : new Map();
    },
    [contracts.bMousdAmmZapper, contracts.bMousdAmm]
  );

  const selectedBond = useMemo(() => bonds?.find(bond => bond.id === selectedBondId), [
    bonds,
    selectedBondId
  ]);

  const dispatchEvent = useCallback(
    async (event: BondEvent, payload?: Payload) => {
      if (!isValidEvent(viewRef.current, event)) {
        console.error("invalid event", event, payload, "in view", viewRef.current);
        return;
      }

      const nextView = transition(viewRef.current, event);
      setView(nextView);

      if (payload && "bondId" in payload && payload.bondId !== selectedBondId) {
        setSelectedBondId(payload.bondId);
      }

      if (payload && "inputToken" in payload && payload.inputToken !== inputToken) {
        setInputToken(payload.inputToken);
      }

      const isCurrentViewEvent = (_view: BondView, _event: BondEvent) =>
        viewRef.current === _view && event === _event;

      try {
        if (isCurrentViewEvent("CREATING", "APPROVE_PRESSED")) {
          await approveInfiniteBond();
        } else if (isCurrentViewEvent("CREATING", "CONFIRM_PRESSED")) {
          await createBond((payload as CreateBondPayload).deposit);
          await dispatchEvent("CREATE_BOND_CONFIRMED");
        } else if (isCurrentViewEvent("CANCELLING", "CONFIRM_PRESSED")) {
          if (selectedBond === undefined) {
            console.error(
              "dispatchEvent() handler: attempted to cancel a bond without selecting a bond"
            );
            return;
          }
          await cancelBond(selectedBond.id, selectedBond.deposit);
          await dispatchEvent("CANCEL_BOND_CONFIRMED");
        } else if (isCurrentViewEvent("CLAIMING", "CONFIRM_PRESSED")) {
          if (selectedBond === undefined) {
            console.error(
              "dispatchEvent() handler: attempted to claim a bond without selecting a bond"
            );
            return;
          }
          await claimBond(selectedBond.id);
          await dispatchEvent("CLAIM_BOND_CONFIRMED");
        } else if (isCurrentViewEvent("SWAPPING", "APPROVE_PRESSED")) {
          await approveAmm([inputToken]);
        } else if (isCurrentViewEvent("SWAPPING", "CONFIRM_PRESSED")) {
          const { inputAmount, minOutputAmount } = payload as SwapPayload;
          await swapTokens(inputToken, inputAmount, minOutputAmount);
          await dispatchEvent("SWAP_CONFIRMED");
        } else if (isCurrentViewEvent("MANAGING_LIQUIDITY", "APPROVE_PRESSED")) {
          await approveTokens(payload as ApprovePressedPayload);
        } else if (isCurrentViewEvent("MANAGING_LIQUIDITY", "CONFIRM_PRESSED")) {
          await manageLiquidity(payload as ManageLiquidityPayload);
          await dispatchEvent("MANAGE_LIQUIDITY_CONFIRMED");
        }
      } catch (error: unknown) {
        console.error("dispatchEvent(), event handler failed\n\n", error);
      }
    },
    [
      selectedBondId,
      approveInfiniteBond,
      cancelBond,
      createBond,
      claimBond,
      selectedBond,
      approveAmm,
      approveTokens,
      swapTokens,
      inputToken,
      manageLiquidity
    ]
  );

  useEffect(() => {
    setStatuses(statuses => ({
      ...statuses,
      APPROVE: approveStatus,
      CREATE: createStatus,
      CANCEL: cancelStatus,
      CLAIM: claimStatus,
      APPROVE_AMM: approveAmmStatus,
      APPROVE_SPENDER: approveTokensStatus,
      SWAP: swapStatus,
      MANAGE_LIQUIDITY: manageLiquidityStatus
    }));
  }, [
    approveStatus,
    createStatus,
    cancelStatus,
    claimStatus,
    approveAmmStatus,
    approveTokensStatus,
    swapStatus,
    manageLiquidityStatus
  ]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    (async () => {
      if (
        bonds === undefined ||
        protocolInfo === undefined ||
        contracts.chickenBondManager === undefined
      )
        return;

      if (protocolInfo.bMousdSupply.gt(0)) {
        setIsBootstrapPeriodActive(false);
        return;
      }

      const bootstrapPeriodMs =
        (await contracts.chickenBondManager.BOOTSTRAP_PERIOD_CHICKEN_IN()).toNumber() * 1000;

      const anyBondOlderThanBootstrapPeriod =
        bonds.find(bond => Date.now() - bond.startTime > bootstrapPeriodMs) !== undefined;

      setIsBootstrapPeriodActive(!anyBondOlderThanBootstrapPeriod);
    })();
  }, [bonds, protocolInfo, contracts.chickenBondManager]);

  const provider: BondViewContextType = {
    view,
    dispatchEvent,
    selectedBondId,
    optimisticBond,
    protocolInfo,
    stats,
    bonds,
    statuses,
    selectedBond,
    bMousdBalance,
    msicBalance,
    lpTokenBalance,
    stakedLpTokenBalance,
    lpTokenSupply,
    bMousdAmmBMousdBalance,
    bMousdAmmMousdBalance,
    isInfiniteBondApproved,
    isSynchronizing,
    getMousdFromFaucet,
    setSimulatedMarketPrice,
    resetSimulatedMarketPrice,
    simulatedProtocolInfo,
    hasFoundContracts: contracts.hasFoundContracts,
    isBMousdApprovedWithBmsicAmm,
    isMousdApprovedWithBmsicAmm,
    isMousdApprovedWithAmmZapper,
    isBMousdApprovedWithAmmZapper,
    isBMousdLpApprovedWithAmmZapper,
    isBMousdLpApprovedWithGauge,
    inputToken,
    isInputTokenApprovedWithBMousdAmm:
      inputToken === BMousdAmmTokenIndex.BMoUSD
        ? isBMousdApprovedWithBmsicAmm
        : isMousdApprovedWithBmsicAmm,
    getExpectedSwapOutput,
    getExpectedLpTokens,
    getExpectedWithdrawal,
    isBootstrapPeriodActive,
    hasLoaded: protocolInfo !== undefined && bonds !== undefined,
    addresses: contracts.addresses,
    lpRewards
  };

  // window.__LIQUITY_BONDS__ = provider.current;

  return <BondViewContext.Provider value={provider}>{children}</BondViewContext.Provider>;
};
