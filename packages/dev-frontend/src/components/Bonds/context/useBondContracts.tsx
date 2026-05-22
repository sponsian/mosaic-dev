import { Decimal } from "@mosaic/lib-base";
import {
  BMEURLPZap,
  BMEURLPZap__factory,
  BMEURToken,
  BondNFT,
  ChickenBondManager,
  ERC20Faucet,
  ERC20Faucet__factory
} from "@mosaic/chicken-bonds/meur/types";
import {
  CurveCryptoSwap2ETH,
  CurveLiquidityGaugeV5__factory
} from "@mosaic/chicken-bonds/meur/types/external";
import { CurveCryptoSwap2ETH__factory } from "@mosaic/chicken-bonds/meur/types/external";
import {
  BMEURToken__factory,
  BondNFT__factory,
  ChickenBondManager__factory
} from "@mosaic/chicken-bonds/meur/types";
import type { MEURToken } from "@mosaic/lib-ethers/dist/types";
import MEURTokenAbi from "@mosaic/lib-ethers/abi/MEURToken.json";
import { useContract } from "../../../hooks/useContract";
import { useMosaic } from "../../../hooks/MosaicContext";
import { useCallback } from "react";
import type { BondsApi } from "./api";
import type { BMeurLpRewards, Bond, ProtocolInfo, Stats } from "./transitions";
import { BMeurAmmTokenIndex } from "./transitions";
import type { Addresses } from "./transitions";
import { useChainId } from "wagmi";
import { useBondAddresses } from "./BondAddressesContext";
import type { CurveLiquidityGaugeV5 } from "@mosaic/chicken-bonds/meur/types/external/CurveLiquidityGaugeV5";

type BondsInformation = {
  protocolInfo: ProtocolInfo;
  bonds: Bond[];
  stats: Stats;
  bMeurBalance: Decimal;
  meurBalance: Decimal;
  lpTokenBalance: Decimal;
  stakedLpTokenBalance: Decimal;
  lpTokenSupply: Decimal;
  bMeurAmmBMeurBalance: Decimal;
  bMeurAmmMeurBalance: Decimal;
  lpRewards: BMeurLpRewards;
};

type BondContracts = {
  addresses: Addresses;
  meurToken: MEURToken | undefined;
  bMeurToken: BMEURToken | undefined;
  bondNft: BondNFT | undefined;
  chickenBondManager: ChickenBondManager | undefined;
  bMeurAmm: CurveCryptoSwap2ETH | undefined;
  bMeurAmmZapper: BMEURLPZap | undefined;
  bMeurGauge: CurveLiquidityGaugeV5 | undefined;
  hasFoundContracts: boolean;
  getLatestData: (account: string, api: BondsApi) => Promise<BondsInformation | undefined>;
};

export const useBondContracts = (): BondContracts => {
  const { mosaic } = useMosaic();
  const chainId = useChainId();
  const isMainnet = chainId === 1;

  const addresses = useBondAddresses();

  const {
    BMEUR_AMM_ADDRESS,
    BMEUR_TOKEN_ADDRESS,
    BOND_NFT_ADDRESS,
    CHICKEN_BOND_MANAGER_ADDRESS,
    MEUR_OVERRIDE_ADDRESS,
    BMEUR_LP_ZAP_ADDRESS,
    BMEUR_AMM_STAKING_ADDRESS
  } = addresses;

  const [meurTokenDefault, meurTokenDefaultStatus] = useContract<MEURToken>(
    mosaic.connection.addresses.meurToken,
    MEURTokenAbi
  );

  const [meurTokenOverride, meurTokenOverrideStatus] = useContract<ERC20Faucet>(
    MEUR_OVERRIDE_ADDRESS,
    ERC20Faucet__factory.abi
  );

  const [meurToken, meurTokenStatus] =
    MEUR_OVERRIDE_ADDRESS === null
      ? [meurTokenDefault, meurTokenDefaultStatus]
      : [(meurTokenOverride as unknown) as MEURToken, meurTokenOverrideStatus];

  const [bMeurToken, bMeurTokenStatus] = useContract<BMEURToken>(
    BMEUR_TOKEN_ADDRESS,
    BMEURToken__factory.abi
  );

  const [bondNft, bondNftStatus] = useContract<BondNFT>(BOND_NFT_ADDRESS, BondNFT__factory.abi);
  const [chickenBondManager, chickenBondManagerStatus] = useContract<ChickenBondManager>(
    CHICKEN_BOND_MANAGER_ADDRESS,
    ChickenBondManager__factory.abi
  );

  const [bMeurAmm, bMeurAmmStatus] = useContract<CurveCryptoSwap2ETH>(
    BMEUR_AMM_ADDRESS,
    CurveCryptoSwap2ETH__factory.abi
  );

  const [bMeurAmmZapper, bMeurAmmZapperStatus] = useContract<BMEURLPZap>(
    BMEUR_LP_ZAP_ADDRESS,
    BMEURLPZap__factory.abi
  );

  const [bMeurGauge, bMeurGaugeStatus] = useContract<CurveLiquidityGaugeV5>(
    BMEUR_AMM_STAKING_ADDRESS,
    CurveLiquidityGaugeV5__factory.abi
  );

  const hasFoundContracts =
    [
      meurTokenStatus,
      bondNftStatus,
      chickenBondManagerStatus,
      bMeurTokenStatus,
      bMeurAmmStatus,
      ...(isMainnet ? [bMeurAmmZapperStatus] : []),
      bMeurGaugeStatus
    ].find(status => status === "FAILED") === undefined;

  const getLatestData = useCallback(
    async (account: string, api: BondsApi): Promise<BondsInformation | undefined> => {
      if (
        meurToken === undefined ||
        bondNft === undefined ||
        chickenBondManager === undefined ||
        bMeurToken === undefined ||
        bMeurAmm === undefined ||
        bMeurGauge === undefined
      ) {
        return undefined;
      }

      const protocolInfoPromise = api.getProtocolInfo(
        bMeurToken,
        bMeurAmm,
        chickenBondManager,
        isMainnet
      );

      const bondsPromise = api.getAccountBonds(
        account,
        bondNft,
        chickenBondManager,
        await protocolInfoPromise
      );

      const [protocolInfo, stats, lpToken] = await Promise.all([
        protocolInfoPromise,
        api.getStats(chickenBondManager),
        api.getLpToken(bMeurAmm)
      ]);

      const [
        bMeurBalance,
        meurBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bMeurAmmCoinBalances,
        lpRewards
      ] = await Promise.all([
        api.getTokenBalance(account, bMeurToken),
        api.getTokenBalance(account, meurToken),
        api.getTokenBalance(account, lpToken),
        isMainnet ? api.getTokenBalance(account, bMeurGauge) : Decimal.ZERO,
        api.getTokenTotalSupply(lpToken),
        api.getCoinBalances(bMeurAmm),
        isMainnet ? api.getLpRewards(account, bMeurGauge) : []
      ]);

      const bonds = await bondsPromise;

      return {
        protocolInfo,
        bonds,
        stats,
        bMeurBalance,
        meurBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bMeurAmmBMeurBalance: bMeurAmmCoinBalances[BMeurAmmTokenIndex.BMEUR],
        bMeurAmmMeurBalance: bMeurAmmCoinBalances[BMeurAmmTokenIndex.MEUR],
        lpRewards
      };
    },
    [chickenBondManager, bondNft, bMeurToken, meurToken, bMeurAmm, isMainnet, bMeurGauge]
  );

  return {
    addresses,
    meurToken,
    bMeurToken,
    bondNft,
    chickenBondManager,
    bMeurAmm,
    bMeurAmmZapper,
    bMeurGauge,
    getLatestData,
    hasFoundContracts
  };
};
