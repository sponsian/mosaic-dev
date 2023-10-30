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
  BMousdAmmTokenIndex,
  Addresses,
  BMousdLpRewards
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
  bMousdBalance?: Decimal;
  msicBalance?: Decimal;
  lpTokenBalance?: Decimal;
  stakedLpTokenBalance?: Decimal;
  lpTokenSupply?: Decimal;
  bMousdAmmBMousdBalance?: Decimal;
  bMousdAmmMousdBalance?: Decimal;
  statuses: BondTransactionStatuses;
  isInfiniteBondApproved: boolean;
  isSynchronizing: boolean;
  getMousdFromFaucet: () => Promise<void>;
  simulatedProtocolInfo?: ProtocolInfo;
  setSimulatedMarketPrice: (marketPrice: Decimal) => void;
  resetSimulatedMarketPrice: () => void;
  hasFoundContracts: boolean;
  isBMousdApprovedWithBmsicAmm: boolean;
  isMousdApprovedWithBmsicAmm: boolean;
  isMousdApprovedWithAmmZapper: boolean;
  isBMousdApprovedWithAmmZapper: boolean;
  isBMousdLpApprovedWithAmmZapper: boolean;
  isBMousdLpApprovedWithGauge: boolean;
  inputToken: BMousdAmmTokenIndex.BMoUSD | BMousdAmmTokenIndex.MoUSD;
  isInputTokenApprovedWithBMousdAmm: boolean;
  getExpectedSwapOutput: (inputToken: BMousdAmmTokenIndex, inputAmount: Decimal) => Promise<Decimal>;
  getExpectedLpTokens: (bMousdAmount: Decimal, msicAmount: Decimal) => Promise<Decimal>;
  getExpectedWithdrawal: (
    burnLp: Decimal,
    output: BMousdAmmTokenIndex | "both"
  ) => Promise<Map<BMousdAmmTokenIndex, Decimal>>;
  isBootstrapPeriodActive?: boolean;
  hasLoaded: boolean;
  addresses: Addresses;
  lpRewards: BMousdLpRewards | undefined;
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
