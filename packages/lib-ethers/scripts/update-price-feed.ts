import { BigNumber } from "@ethersproject/bignumber";
import { Contract } from "@ethersproject/contracts";
import { JsonRpcProvider } from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import { formatUnits, parseUnits } from "@ethersproject/units";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

// --- Configuration ---

const CMC_API_KEY = process.env.CMC_API_KEY;
const PRICE_FEED_ADDRESS = process.env.PRICE_FEED_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const UPDATER_PRIVATE_KEY = process.env.UPDATER_PRIVATE_KEY;
const UPDATE_INTERVAL_MS = Number(process.env.UPDATE_INTERVAL_MS ?? 300_000); // default 5 min
const MAX_PRICE_DEVIATION_PERCENT = Number(process.env.MAX_PRICE_DEVIATION_PERCENT ?? 50);

// PriceFeedTestnet ABI — only the functions we need
const PRICE_FEED_ABI = [
  "function setPrice(uint256 price) external returns (bool)",
  "function getPrice() external view returns (uint256)"
];

// --- Validation ---

function validateConfig(): void {
  const required: Record<string, string | undefined> = {
    CMC_API_KEY,
    PRICE_FEED_ADDRESS,
    RPC_URL,
    UPDATER_PRIVATE_KEY
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  if (UPDATE_INTERVAL_MS < 60_000) {
    throw new Error("UPDATE_INTERVAL_MS must be >= 60000 (1 minute) to respect API rate limits");
  }
}

// --- CoinMarketCap API ---

interface CMCQuote {
  price: number;
  last_updated: string;
}

interface CMCResponse {
  status: { error_code: number; error_message: string | null };
  data: {
    REEF: Array<{ quote: { EUR: CMCQuote } }>;
  };
}

function fetchReefEurPrice(): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = new URL("https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest");
    url.searchParams.set("symbol", "REEF");
    url.searchParams.set("convert", "EUR");

    const req = https.get(
      url.toString(),
      {
        headers: {
          "X-CMC_PRO_API_KEY": CMC_API_KEY!,
          Accept: "application/json"
        }
      },
      res => {
        let data = "";
        res.on("data", (chunk: string) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`CMC API returned HTTP ${res.statusCode}: ${data}`));
              return;
            }
            const parsed: CMCResponse = JSON.parse(data);
            if (parsed.status.error_code !== 0) {
              reject(new Error(`CMC API error: ${parsed.status.error_message}`));
              return;
            }
            const reefData = parsed.data.REEF;
            if (!reefData || reefData.length === 0) {
              reject(new Error("No REEF data in CMC response"));
              return;
            }
            const price = reefData[0].quote.EUR.price;
            if (typeof price !== "number" || price <= 0 || !isFinite(price)) {
              reject(new Error(`Invalid price from CMC: ${price}`));
              return;
            }
            resolve(price);
          } catch (err) {
            reject(new Error(`Failed to parse CMC response: ${err}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(15_000, () => {
      req.destroy(new Error("CMC API request timed out (15s)"));
    });
  });
}

// --- Price conversion ---

// CoinMarketCap returns a float like 0.00234 (EUR per REEF).
// PriceFeedTestnet expects uint256 with 18 decimals.
// e.g., 0.00234 EUR -> 2340000000000000 (0.00234 * 1e18)
function priceToUint256(price: number): BigNumber {
  // Use parseUnits with string to avoid floating-point precision issues.
  // Limit to 18 decimal places max.
  const priceStr = price.toFixed(18);
  return parseUnits(priceStr, 18);
}

// --- Sanity check ---

function isPriceReasonable(
  newPrice: BigNumber,
  currentOnChainPrice: BigNumber,
  maxDeviationPercent: number
): boolean {
  // If on-chain price is 0 or the default 200e18, skip the check
  const defaultPrice = parseUnits("200", 18);
  if (currentOnChainPrice.isZero() || currentOnChainPrice.eq(defaultPrice)) {
    return true;
  }
  // Calculate percentage deviation
  const diff = newPrice.gt(currentOnChainPrice)
    ? newPrice.sub(currentOnChainPrice)
    : currentOnChainPrice.sub(newPrice);
  const deviationBps = diff.mul(10000).div(currentOnChainPrice);
  return deviationBps.lte(maxDeviationPercent * 100);
}

// --- Logging ---

function log(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}] ${message}`);
}

// --- Main loop ---

let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 10;

async function updatePrice(priceFeed: Contract): Promise<void> {
  // 1. Fetch price from CoinMarketCap
  log("INFO", "Fetching REEF/EUR price from CoinMarketCap...");
  const price = await fetchReefEurPrice();
  log("INFO", `CoinMarketCap REEF/EUR price: ${price}`);

  // 2. Convert to uint256
  const priceWei = priceToUint256(price);
  log("INFO", `Price as uint256 (18 decimals): ${priceWei.toString()}`);

  // 3. Read current on-chain price for sanity check
  const currentPrice: BigNumber = await priceFeed.getPrice();
  log("INFO", `Current on-chain price: ${formatUnits(currentPrice, 18)}`);

  // 4. Sanity check
  if (!isPriceReasonable(priceWei, currentPrice, MAX_PRICE_DEVIATION_PERCENT)) {
    log(
      "WARN",
      `Price deviation exceeds ${MAX_PRICE_DEVIATION_PERCENT}%. ` +
        `Current: ${formatUnits(currentPrice, 18)}, New: ${price}. Skipping update.`
    );
    return;
  }

  // 5. Send transaction
  log("INFO", "Sending setPrice transaction...");
  const tx = await priceFeed.setPrice(priceWei);
  log("INFO", `Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  log(
    "INFO",
    `Transaction confirmed in block ${receipt.blockNumber}, gas used: ${receipt.gasUsed.toString()}`
  );

  consecutiveFailures = 0;
}

async function main(): Promise<void> {
  validateConfig();

  const provider = new JsonRpcProvider(RPC_URL);
  const wallet = new Wallet(UPDATER_PRIVATE_KEY!, provider);
  const priceFeed = new Contract(PRICE_FEED_ADDRESS!, PRICE_FEED_ABI, wallet);

  const network = await provider.getNetwork();
  const address = await wallet.getAddress();
  const balance = await wallet.getBalance();

  log("INFO", "=== CoinMarketCap Price Feed Updater ===");
  log("INFO", `Network: chainId=${network.chainId}, name=${network.name}`);
  log("INFO", `Updater address: ${address}`);
  log("INFO", `Updater balance: ${formatUnits(balance, 18)} REEF`);
  log("INFO", `PriceFeed contract: ${PRICE_FEED_ADDRESS}`);
  log("INFO", `Update interval: ${UPDATE_INTERVAL_MS / 1000}s`);
  log("INFO", `Max price deviation: ${MAX_PRICE_DEVIATION_PERCENT}%`);

  // Initial update
  try {
    await updatePrice(priceFeed);
  } catch (err) {
    log("ERROR", `Initial price update failed: ${err}`);
  }

  // Periodic updates
  const intervalId = setInterval(async () => {
    try {
      await updatePrice(priceFeed);
    } catch (err) {
      consecutiveFailures++;
      log(
        "ERROR",
        `Price update failed (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${err}`
      );
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        log("ERROR", `${MAX_CONSECUTIVE_FAILURES} consecutive failures. Exiting.`);
        clearInterval(intervalId);
        process.exit(1);
      }
    }
  }, UPDATE_INTERVAL_MS);

  // Graceful shutdown
  const shutdown = () => {
    log("INFO", "Shutting down...");
    clearInterval(intervalId);
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(err => {
  log("ERROR", `Fatal error: ${err}`);
  process.exit(1);
});
