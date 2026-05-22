import { createContext, useContext } from "react";
import type {
  BondView,
  BondEvent,
  Payload,
  Bond,
  Stats,
  BondTransactionStatuses,
  ProtocolInfo,
  OptimisticBond,
  BMeurAmmTokenIndex,
  Addresses,
  BMeurLpRewards
} from "./transitions";
import { PENDING_STATUS, CANCELLED_STATUS, CLAIMED_STATUS } from "../lexicon";
import { Decimal } from "@mosaic/lib-base";

export type BondViewContextType = {
  view: BondView;
  dispatchEvent: (event: BondEvent, payload?: Payload) => void;
  selectedBondId?: string;
  protocolInfo?: ProtocolInfo;
  stats?: Stats;
  bonds?: Bond[];
  selectedBond?: Bond;
  optimisticBond?: OptimisticBond;
  bMeurBalance?: Decimal;
  meurBalance?: Decimal;
  lpTokenBalance?: Decimal;
  stakedLpTokenBalance?: Decimal;
  lpTokenSupply?: Decimal;
  bMeurAmmBMeurBalance?: Decimal;
  bMeurAmmMeurBalance?: Decimal;
  statuses: BondTransactionStatuses;
  isInfiniteBondApproved: boolean;
  isSynchronizing: boolean;
  getMeurFromFaucet: () => Promise<void>;
  simulatedProtocolInfo?: ProtocolInfo;
  setSimulatedMarketPrice: (marketPrice: Decimal) => void;
  resetSimulatedMarketPrice: () => void;
  hasFoundContracts: boolean;
  isBMeurApprovedWithBmsicAmm: boolean;
  isMeurApprovedWithBmsicAmm: boolean;
  isMeurApprovedWithAmmZapper: boolean;
  isBMeurApprovedWithAmmZapper: boolean;
  isBMeurLpApprovedWithAmmZapper: boolean;
  isBMeurLpApprovedWithGauge: boolean;
  inputToken: BMeurAmmTokenIndex.BMEUR | BMeurAmmTokenIndex.MEUR;
  isInputTokenApprovedWithBMeurAmm: boolean;
  getExpectedSwapOutput: (inputToken: BMeurAmmTokenIndex, inputAmount: Decimal) => Promise<Decimal>;
  getExpectedLpTokens: (bMeurAmount: Decimal, msicAmount: Decimal) => Promise<Decimal>;
  getExpectedWithdrawal: (
    burnLp: Decimal,
    output: BMeurAmmTokenIndex | "both"
  ) => Promise<Map<BMeurAmmTokenIndex, Decimal>>;
  isBootstrapPeriodActive?: boolean;
  hasLoaded: boolean;
  addresses: Addresses;
  lpRewards: BMeurLpRewards | undefined;
};

export const BondViewContext = createContext<BondViewContextType | null>(null);

export const useBondView = (): BondViewContextType => {
  const context: BondViewContextType | null = useContext(BondViewContext);

  if (context === null) {
    throw new Error("You must add a <BondViewProvider> into the React tree");
  }

  return context;
};

export const statuses = {
  PENDING: PENDING_STATUS.term,
  CANCELLED: CANCELLED_STATUS.term,
  CLAIMED: CLAIMED_STATUS.term,
  NON_EXISTENT: "NON_EXISTENT"
};
