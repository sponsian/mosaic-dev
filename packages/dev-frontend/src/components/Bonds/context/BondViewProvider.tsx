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
  BMeurLpRewards
} from "./transitions";
import { BMeurAmmTokenIndex } from "./transitions";
import { transitions } from "./transitions";
import { Decimal } from "@mosaic/lib-base";
import { useMosaic } from "../../../hooks/MosaicContext";
import { api, _getProtocolInfo } from "./api";
import { useTransaction } from "../../../hooks/useTransaction";
import type { ERC20Faucet } from "@mosaic/chicken-bonds/meur/types";
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
  const [lpRewards, setLpRewards] = useState<BMeurLpRewards>();
  const [isMeurApprovedWithBmsicAmm, setIsMeurApprovedWithBmsicAmm] = useState(false);
  const [isBMeurApprovedWithBmsicAmm, setIsBMeurApprovedWithBmsicAmm] = useState(false);
  const [isMeurApprovedWithAmmZapper, setIsMeurApprovedWithAmmZapper] = useState(false);
  const [isBMeurApprovedWithAmmZapper, setIsBMeurApprovedWithAmmZapper] = useState(false);
  const [isBMeurLpApprovedWithAmmZapper, setIsBMeurLpApprovedWithAmmZapper] = useState(false);
  const [isBMeurLpApprovedWithGauge, setIsBMeurLpApprovedWithGauge] = useState(false);
  const [isSynchronizing, setIsSynchronizing] = useState(false);
  const [inputToken, setInputToken] = useState<BMeurAmmTokenIndex.BMEUR | BMeurAmmTokenIndex.MEUR>(
    BMeurAmmTokenIndex.BMEUR
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
  const [bMeurBalance, setBMeurBalance] = useState<Decimal>();
  const [meurBalance, setMeurBalance] = useState<Decimal>();
  const [lpTokenBalance, setLpTokenBalance] = useState<Decimal>();
  const [stakedLpTokenBalance, setStakedLpTokenBalance] = useState<Decimal>();

  const [lpTokenSupply, setLpTokenSupply] = useState<Decimal>();
  const [bMeurAmmBMeurBalance, setBMeurAmmBMeurBalance] = useState<Decimal>();
  const [bMeurAmmMeurBalance, setBMeurAmmMeurBalance] = useState<Decimal>();
  const [isBootstrapPeriodActive, setIsBootstrapPeriodActive] = useState<boolean>();
  const { account, mosaic } = useMosaic();
  const {
    MEUR_OVERRIDE_ADDRESS,
    BMEUR_AMM_ADDRESS,
    BMEUR_LP_ZAP_ADDRESS,
    BMEUR_AMM_STAKING_ADDRESS
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

  const getMeurFromFaucet = useCallback(async () => {
    if (contracts.meurToken === undefined || mosaic.connection.signer === undefined) return;

    if (
      MEUR_OVERRIDE_ADDRESS !== null &&
      (await contracts.meurToken.balanceOf(account)).eq(0) &&
      "tap" in contracts.meurToken
    ) {
      await (
        await ((contracts.meurToken as unknown) as ERC20Faucet)
          .connect(mosaic.connection.signer)
          .tap()
      ).wait();
      setShouldSynchronize(true);
    }
  }, [contracts.meurToken, account, MEUR_OVERRIDE_ADDRESS, mosaic.connection.signer]);

  useEffect(() => {
    (async () => {
      if (
        contracts.meurToken === undefined ||
        contracts.chickenBondManager === undefined ||
        account === undefined ||
        isInfiniteBondApproved
      )
        return;
      const isApproved = await api.isInfiniteBondApproved(
        account,
        contracts.meurToken,
        contracts.chickenBondManager
      );
      setIsInfiniteBondApproved(isApproved);
    })();
  }, [contracts.meurToken, contracts.chickenBondManager, account, isInfiniteBondApproved]);

  useEffect(() => {
    (async () => {
      if (
        BMEUR_AMM_ADDRESS === null ||
        contracts.meurToken === undefined ||
        isMeurApprovedWithBmsicAmm
      ) {
        return;
      }
      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBMeurAmmMainnet(account, contracts.meurToken)
        : api.isTokenApprovedWithBMeurAmm(account, contracts.meurToken, BMEUR_AMM_ADDRESS));

      setIsMeurApprovedWithBmsicAmm(isApproved);
    })();
  }, [contracts.meurToken, account, isMeurApprovedWithBmsicAmm, isMainnet, BMEUR_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMEUR_AMM_ADDRESS === null ||
        contracts.bMeurToken === undefined ||
        isBMeurApprovedWithBmsicAmm
      ) {
        return;
      }

      const isApproved = await (isMainnet
        ? api.isTokenApprovedWithBMeurAmmMainnet(account, contracts.bMeurToken)
        : api.isTokenApprovedWithBMeurAmm(account, contracts.bMeurToken, BMEUR_AMM_ADDRESS));

      setIsBMeurApprovedWithBmsicAmm(isApproved);
    })();
  }, [contracts.bMeurToken, account, isBMeurApprovedWithBmsicAmm, isMainnet, BMEUR_AMM_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMEUR_LP_ZAP_ADDRESS === null ||
        contracts.meurToken === undefined ||
        isMeurApprovedWithAmmZapper
      ) {
        return;
      }

      const isMeurApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.meurToken,
        BMEUR_LP_ZAP_ADDRESS
      );

      setIsMeurApprovedWithAmmZapper(isMeurApproved);
    })();
  }, [contracts.meurToken, account, isMeurApprovedWithAmmZapper, BMEUR_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (contracts.bMeurAmm === undefined || isBMeurLpApprovedWithAmmZapper) return;
      const lpToken = await api.getLpToken(contracts.bMeurAmm);
      const isLpApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        lpToken,
        BMEUR_LP_ZAP_ADDRESS
      );

      setIsBMeurLpApprovedWithAmmZapper(isLpApproved);
    })();
  }, [contracts.bMeurAmm, account, isBMeurLpApprovedWithAmmZapper, BMEUR_LP_ZAP_ADDRESS]);

  useEffect(() => {
    (async () => {
      if (
        BMEUR_LP_ZAP_ADDRESS === null ||
        contracts.bMeurToken === undefined ||
        isBMeurApprovedWithAmmZapper
      ) {
        return;
      }

      const isBMeurApproved = await api.isTokenApprovedWithAmmZapper(
        account,
        contracts.bMeurToken,
        BMEUR_LP_ZAP_ADDRESS
      );

      setIsMeurApprovedWithAmmZapper(isBMeurApproved);
    })();
  }, [contracts.bMeurToken, account, isBMeurApprovedWithAmmZapper, BMEUR_LP_ZAP_ADDRESS]);

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
          contracts.meurToken === undefined ||
          contracts.bondNft === undefined ||
          contracts.chickenBondManager === undefined ||
          contracts.bMeurToken === undefined ||
          contracts.bMeurAmm === undefined ||
          contracts.bMeurGauge === undefined ||
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
          bMeurBalance,
          meurBalance,
          lpTokenBalance,
          stakedLpTokenBalance,
          lpTokenSupply,
          bMeurAmmBMeurBalance,
          bMeurAmmMeurBalance,
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
        setBMeurBalance(bMeurBalance);
        setMeurBalance(meurBalance);
        setLpTokenBalance(lpTokenBalance);
        setStakedLpTokenBalance(stakedLpTokenBalance);
        setLpTokenSupply(lpTokenSupply);
        setBMeurAmmBMeurBalance(bMeurAmmBMeurBalance);
        setBMeurAmmMeurBalance(bMeurAmmMeurBalance);
        setStats(stats);
        setBonds(bonds);
        setOptimisticBond(undefined);
      } catch (error: unknown) {
        console.error("Synchronising effect exception", error);
      }

      setIsSynchronizing(false);
    })();
  }, [isSynchronizing, shouldSynchronize, account, contracts, simulatedProtocolInfo]);

  const [approveBond, approveStatus] = useTransaction(async (bondAmount: Decimal) => {
    await api.approveBond(
      bondAmount,
      contracts.meurToken,
      contracts.chickenBondManager,
      mosaic.connection.signer
    );
    setIsInfiniteBondApproved(true);
  }, [contracts.meurToken, contracts.chickenBondManager, mosaic.connection.signer]);

  const [approveAmm, approveAmmStatus] = useTransaction(
    async (tokensNeedingApproval: BMeurAmmTokenIndex[]) => {
      for (const token of tokensNeedingApproval) {
        if (token === BMeurAmmTokenIndex.BMEUR) {
          await (isMainnet
            ? api.approveTokenWithBMeurAmmMainnet(contracts.bMeurToken, mosaic.connection.signer)
            : api.approveTokenWithBMeurAmm(
                contracts.bMeurToken,
                BMEUR_AMM_ADDRESS,
                mosaic.connection.signer
              ));

          setIsBMeurApprovedWithBmsicAmm(true);
        } else {
          await (isMainnet
            ? api.approveTokenWithBMeurAmmMainnet(contracts.meurToken, mosaic.connection.signer)
            : api.approveTokenWithBMeurAmm(
                contracts.meurToken,
                BMEUR_AMM_ADDRESS,
                mosaic.connection.signer
              ));

          setIsMeurApprovedWithBmsicAmm(true);
        }
      }
    },
    [
      contracts.bMeurToken,
      contracts.meurToken,
      isMainnet,
      BMEUR_AMM_ADDRESS,
      mosaic.connection.signer
    ]
  );

  const [approveTokens, approveTokensStatus] = useTransaction(
    async ({ tokensNeedingApproval }: ApprovePressedPayload) => {
      if (contracts.bMeurAmm === undefined) return;
      for (const [token, spender] of Array.from(tokensNeedingApproval)) {
        if (token === BMeurAmmTokenIndex.BMEUR) {
          await api.approveToken(contracts.bMeurToken, spender, mosaic.connection.signer);
          if (spender === BMEUR_AMM_ADDRESS) {
            setIsBMeurApprovedWithBmsicAmm(true);
          } else if (spender === BMEUR_LP_ZAP_ADDRESS) {
            setIsBMeurApprovedWithAmmZapper(true);
          }
        } else if (token === BMeurAmmTokenIndex.MEUR) {
          await api.approveToken(
            contracts.meurToken,
            BMEUR_LP_ZAP_ADDRESS,
            mosaic.connection.signer
          );
          setIsMeurApprovedWithAmmZapper(true);
        } else if (token === BMeurAmmTokenIndex.BMEUR_MEUR_LP && spender === undefined) {
          const lpToken = await api.getLpToken(contracts.bMeurAmm);
          await api.approveToken(lpToken, BMEUR_LP_ZAP_ADDRESS, mosaic.connection.signer);
          setIsBMeurLpApprovedWithAmmZapper(true);
        } else if (token === BMeurAmmTokenIndex.BMEUR_MEUR_LP) {
          const lpToken = await api.getLpToken(contracts.bMeurAmm);
          await api.approveToken(lpToken, spender, mosaic.connection.signer);
          if (spender === BMEUR_LP_ZAP_ADDRESS) {
            setIsBMeurLpApprovedWithAmmZapper(true);
          } else if (spender === BMEUR_AMM_STAKING_ADDRESS) {
            setIsBMeurLpApprovedWithGauge(true);
          }
        }
      }
    },
    [
      contracts.bMeurAmm,
      contracts.bMeurToken,
      contracts.meurToken,
      BMEUR_LP_ZAP_ADDRESS,
      BMEUR_AMM_STAKING_ADDRESS,
      BMEUR_AMM_ADDRESS,
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
    async (bondId: string, minimumMeur: Decimal) => {
      await api.cancelBond(
        bondId,
        minimumMeur,
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
    async (inputToken: BMeurAmmTokenIndex, inputAmount: Decimal) =>
      contracts.bMeurAmm
        ? (isMainnet ? api.getExpectedSwapOutputMainnet : api.getExpectedSwapOutput)(
            inputToken,
            inputAmount,
            contracts.bMeurAmm
          )
        : Decimal.ZERO,
    [contracts.bMeurAmm, isMainnet]
  );

  const [swapTokens, swapStatus] = useTransaction(
    async (inputToken: BMeurAmmTokenIndex, inputAmount: Decimal, minOutputAmount: Decimal) => {
      await (isMainnet ? api.swapTokensMainnet : api.swapTokens)(
        inputToken,
        inputAmount,
        minOutputAmount,
        contracts.bMeurAmm,
        mosaic.connection.signer,
        account
      );
      setShouldSynchronize(true);
    },
    [contracts.bMeurAmm, isMainnet, mosaic.connection.signer, account]
  );

  const getExpectedLpTokens = useCallback(
    async (bMeurAmount: Decimal, msicAmount: Decimal) => {
      return contracts.bMeurAmmZapper
        ? api.getExpectedLpTokens(bMeurAmount, msicAmount, contracts.bMeurAmmZapper)
        : Decimal.ZERO;
    },
    [contracts.bMeurAmmZapper]
  );

  const [manageLiquidity, manageLiquidityStatus] = useTransaction(
    async (params: ManageLiquidityPayload) => {
      if (params.action === "addLiquidity") {
        await api.addLiquidity(
          params.bMeurAmount,
          params.msicAmount,
          params.minLpTokens,
          params.shouldStakeInGauge,
          contracts.bMeurAmmZapper,
          mosaic.connection.signer,
          account
        );
      } else if (params.action === "removeLiquidity") {
        await api.removeLiquidity(
          params.burnLpTokens,
          params.minBMeurAmount,
          params.minMeurAmount,
          contracts.bMeurAmmZapper,
          mosaic.connection.signer
        );
      } else if (params.action === "removeLiquidityOneCoin") {
        await api.removeLiquidityOneCoin(
          params.burnLpTokens,
          params.output,
          params.minAmount,
          contracts.bMeurAmmZapper,
          contracts.bMeurAmm,
          mosaic.connection.signer,
          account
        );
      } else if (params.action === "stakeLiquidity") {
        await api.stakeLiquidity(
          params.stakeAmount,
          contracts.bMeurGauge,
          mosaic.connection.signer
        );
      } else if (params.action === "unstakeLiquidity") {
        await api.unstakeLiquidity(
          params.unstakeAmount,
          contracts.bMeurGauge,
          mosaic.connection.signer
        );
      } else if (params.action === "claimLpRewards") {
        await api.claimLpRewards(contracts.bMeurGauge, mosaic.connection.signer);
      }
      setShouldSynchronize(true);
    },
    [
      contracts.bMeurAmmZapper,
      contracts.bMeurGauge,
      contracts.bMeurAmm,
      mosaic.connection.signer,
      account
    ]
  );

  const getExpectedWithdrawal = useCallback(
    async (
      burnLp: Decimal,
      output: BMeurAmmTokenIndex | "both"
    ): Promise<Map<BMeurAmmTokenIndex, Decimal>> => {
      if (contracts.bMeurAmm === undefined)
        return new Map([
          [BMeurAmmTokenIndex.MEUR, Decimal.ZERO],
          [BMeurAmmTokenIndex.BMEUR, Decimal.ZERO]
        ]);

      return contracts.bMeurAmmZapper
        ? api.getExpectedWithdrawal(burnLp, output, contracts.bMeurAmmZapper, contracts.bMeurAmm)
        : new Map();
    },
    [contracts.bMeurAmmZapper, contracts.bMeurAmm]
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
          await approveBond((payload as CreateBondPayload).deposit);
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
      approveBond,
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

      if (protocolInfo.bMeurSupply.gt(0)) {
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
    bMeurBalance,
    meurBalance,
    lpTokenBalance,
    stakedLpTokenBalance,
    lpTokenSupply,
    bMeurAmmBMeurBalance,
    bMeurAmmMeurBalance,
    isInfiniteBondApproved,
    isSynchronizing,
    getMeurFromFaucet,
    setSimulatedMarketPrice,
    resetSimulatedMarketPrice,
    simulatedProtocolInfo,
    hasFoundContracts: contracts.hasFoundContracts,
    isBMeurApprovedWithBmsicAmm,
    isMeurApprovedWithBmsicAmm,
    isMeurApprovedWithAmmZapper,
    isBMeurApprovedWithAmmZapper,
    isBMeurLpApprovedWithAmmZapper,
    isBMeurLpApprovedWithGauge,
    inputToken,
    isInputTokenApprovedWithBMeurAmm:
      inputToken === BMeurAmmTokenIndex.BMEUR
        ? isBMeurApprovedWithBmsicAmm
        : isMeurApprovedWithBmsicAmm,
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
