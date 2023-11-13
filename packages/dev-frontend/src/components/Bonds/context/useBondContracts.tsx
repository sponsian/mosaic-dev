import { Decimal } from "@liquity/lib-base";
import {
  BMoUSDLPZap,
  BMoUSDLPZap__factory,
  BMoUSDToken,
  BondNFT,
  ChickenBondManager,
  ERC20Faucet,
  ERC20Faucet__factory
} from "@mosaic/chicken-bonds/msic/types";
import {
  CurveCryptoSwap2ETH,
  CurveLiquidityGaugeV5__factory
} from "@mosaic/chicken-bonds/msic/types/external";
import { CurveCryptoSwap2ETH__factory } from "@mosaic/chicken-bonds/msic/types/external";
import {
  BMoUSDToken__factory,
  BondNFT__factory,
  ChickenBondManager__factory
} from "@mosaic/chicken-bonds/msic/types";
import type { MoUSDToken } from "@liquity/lib-ethers/dist/types";
import MoUSDTokenAbi from "@liquity/lib-ethers/abi/MoUSDToken.json";
import { useContract } from "../../../hooks/useContract";
import { useMosaic } from "../../../hooks/MosaicContext";
import { useCallback } from "react";
import type { BondsApi } from "./api";
import type { BMousdLpRewards, Bond, ProtocolInfo, Stats } from "./transitions";
import { BMousdAmmTokenIndex } from "./transitions";
import type { Addresses } from "./transitions";
import { useChainId } from "wagmi";
import { useBondAddresses } from "./BondAddressesContext";
import type { CurveLiquidityGaugeV5 } from "@mosaic/chicken-bonds/msic/types/external/CurveLiquidityGaugeV5";

type BondsInformation = {
  protocolInfo: ProtocolInfo;
  bonds: Bond[];
  stats: Stats;
  bMousdBalance: Decimal;
  msicBalance: Decimal;
  lpTokenBalance: Decimal;
  stakedLpTokenBalance: Decimal;
  lpTokenSupply: Decimal;
  bMousdAmmBMousdBalance: Decimal;
  bMousdAmmMousdBalance: Decimal;
  lpRewards: BMousdLpRewards;
};

type BondContracts = {
  addresses: Addresses;
  msicToken: MoUSDToken | undefined;
  bMousdToken: BMoUSDToken | undefined;
  bondNft: BondNFT | undefined;
  chickenBondManager: ChickenBondManager | undefined;
  bMousdAmm: CurveCryptoSwap2ETH | undefined;
  bMousdAmmZapper: BMoUSDLPZap | undefined;
  bMousdGauge: CurveLiquidityGaugeV5 | undefined;
  hasFoundContracts: boolean;
  getLatestData: (account: string, api: BondsApi) => Promise<BondsInformation | undefined>;
};

export const useBondContracts = (): BondContracts => {
  const { mosaic } = useMosaic();
  const chainId = useChainId();
  const isMainnet = chainId === 1;

  const addresses = useBondAddresses();

  const {
    BMoUSD_AMM_ADDRESS,
    BMoUSD_TOKEN_ADDRESS,
    BOND_NFT_ADDRESS,
    CHICKEN_BOND_MANAGER_ADDRESS,
    MoUSD_OVERRIDE_ADDRESS,
    BMoUSD_LP_ZAP_ADDRESS,
    BMoUSD_AMM_STAKING_ADDRESS
  } = addresses;

  const [msicTokenDefault, msicTokenDefaultStatus] = useContract<MoUSDToken>(
    mosaic.connection.addresses.msicToken,
    MoUSDTokenAbi
  );

  const [msicTokenOverride, msicTokenOverrideStatus] = useContract<ERC20Faucet>(
    MoUSD_OVERRIDE_ADDRESS,
    ERC20Faucet__factory.abi
  );

  const [msicToken, msicTokenStatus] =
    MoUSD_OVERRIDE_ADDRESS === null
      ? [msicTokenDefault, msicTokenDefaultStatus]
      : [(msicTokenOverride as unknown) as MoUSDToken, msicTokenOverrideStatus];

  const [bMousdToken, bMousdTokenStatus] = useContract<BMoUSDToken>(
    BMoUSD_TOKEN_ADDRESS,
    BMoUSDToken__factory.abi
  );

  const [bondNft, bondNftStatus] = useContract<BondNFT>(BOND_NFT_ADDRESS, BondNFT__factory.abi);
  const [chickenBondManager, chickenBondManagerStatus] = useContract<ChickenBondManager>(
    CHICKEN_BOND_MANAGER_ADDRESS,
    ChickenBondManager__factory.abi
  );

  const [bMousdAmm, bMousdAmmStatus] = useContract<CurveCryptoSwap2ETH>(
    BMoUSD_AMM_ADDRESS,
    CurveCryptoSwap2ETH__factory.abi
  );

  const [bMousdAmmZapper, bMousdAmmZapperStatus] = useContract<BMoUSDLPZap>(
    BMoUSD_LP_ZAP_ADDRESS,
    BMoUSDLPZap__factory.abi
  );

  const [bMousdGauge, bMousdGaugeStatus] = useContract<CurveLiquidityGaugeV5>(
    BMoUSD_AMM_STAKING_ADDRESS,
    CurveLiquidityGaugeV5__factory.abi
  );

  const hasFoundContracts =
    [
      msicTokenStatus,
      bondNftStatus,
      chickenBondManagerStatus,
      bMousdTokenStatus,
      bMousdAmmStatus,
      ...(isMainnet ? [bMousdAmmZapperStatus] : []),
      bMousdGaugeStatus
    ].find(status => status === "FAILED") === undefined;

  const getLatestData = useCallback(
    async (account: string, api: BondsApi): Promise<BondsInformation | undefined> => {
      if (
        msicToken === undefined ||
        bondNft === undefined ||
        chickenBondManager === undefined ||
        bMousdToken === undefined ||
        bMousdAmm === undefined ||
        bMousdGauge === undefined
      ) {
        return undefined;
      }

      const protocolInfoPromise = api.getProtocolInfo(
        bMousdToken,
        bMousdAmm,
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
        api.getLpToken(bMousdAmm)
      ]);

      const [
        bMousdBalance,
        msicBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bMousdAmmCoinBalances,
        lpRewards
      ] = await Promise.all([
        api.getTokenBalance(account, bMousdToken),
        api.getTokenBalance(account, msicToken),
        api.getTokenBalance(account, lpToken),
        isMainnet ? api.getTokenBalance(account, bMousdGauge) : Decimal.ZERO,
        api.getTokenTotalSupply(lpToken),
        api.getCoinBalances(bMousdAmm),
        isMainnet ? api.getLpRewards(account, bMousdGauge) : []
      ]);

      const bonds = await bondsPromise;

      return {
        protocolInfo,
        bonds,
        stats,
        bMousdBalance,
        msicBalance,
        lpTokenBalance,
        stakedLpTokenBalance,
        lpTokenSupply,
        bMousdAmmBMousdBalance: bMousdAmmCoinBalances[BMousdAmmTokenIndex.BMoUSD],
        bMousdAmmMousdBalance: bMousdAmmCoinBalances[BMousdAmmTokenIndex.MoUSD],
        lpRewards
      };
    },
    [chickenBondManager, bondNft, bMousdToken, msicToken, bMousdAmm, isMainnet, bMousdGauge]
  );

  return {
    addresses,
    msicToken,
    bMousdToken,
    bondNft,
    chickenBondManager,
    bMousdAmm,
    bMousdAmmZapper,
    bMousdGauge,
    getLatestData,
    hasFoundContracts
  };
};
