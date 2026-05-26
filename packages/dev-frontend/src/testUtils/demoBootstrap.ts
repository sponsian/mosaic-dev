// Demo-mode wallet bootstrap. This entire module — including the well-known
// dev-chain funder key — is dynamically imported ONLY when
// VITE_APP_DEMO_MODE === "true". For production builds (demo mode off), Vite
// tree-shakes this file out of the bundle entirely, so the private-key-shaped
// hex string never ships and source-code security scanners (Blockaid etc.)
// don't see a wallet-drainer pattern.

import { DisposableWalletProvider } from "./DisposableWalletProvider";

// Well-known Hardhat / Liquity dev-chain funder. Public; intentionally inline.
const DEV_CHAIN_FUNDER_KEY =
  "0x4d5db4107d237df6a3d58ee5f70ae63d73d7658d4026f2eefd2f204c81682cb7";

export const installDemoWalletProvider = (): void => {
  const ethereum = new DisposableWalletProvider(
    import.meta.env.VITE_APP_RPC_URL || `http://${window.location.hostname || "localhost"}:8545`,
    DEV_CHAIN_FUNDER_KEY
  );

  Object.assign(window, { ethereum });
};
