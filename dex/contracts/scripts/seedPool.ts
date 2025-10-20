import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const addressesPath = path.resolve(__dirname, "../../frontend/lib/addresses.json");

interface AddressBook {
  ASSET_LAYER_SWAP_HOOK?: string;
  MINIMAL_SWAP_ROUTER?: string;
  POOL_MANAGER?: string;
}

function readAddresses(): AddressBook {
  if (fs.existsSync(addressesPath)) {
    const raw = fs.readFileSync(addressesPath, "utf8");
    return JSON.parse(raw);
  }
  return {};
}

// Minimal ERC20 ABI for approve/transfer/decimals
const erc20Abi = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address,uint256) returns (bool)",
  "function transfer(address,uint256) returns (bool)",
];

// Load the compiled ABIs from artifacts
const poolManagerArtifact = require("../artifacts/@uniswap/v4-core/src/interfaces/IPoolManager.sol/IPoolManager.json");
const routerArtifact = require("../artifacts/contracts/MinimalSwapRouterV4.sol/MinimalSwapRouterV4.json");

// Helpers for sqrtPriceX96
const Q96 = BigInt(2) ** BigInt(96);
const Q192 = Q96 * Q96;

function bigintSqrt(value: bigint): bigint {
  if (value <= 0n) return 0n;
  let x = value;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (x + value / x) >> 1n;
  }
  return x;
}

// sqrtPriceX96 for price = 1 (1:1 ratio in human units)
function sqrtPriceX96For1to1(dec0: number, dec1: number): bigint {
  // For 1:1 human price, we need sqrtPriceX96 = sqrt(10^(dec1-dec0)) * 2^96
  const diff = dec1 - dec0;
  if (diff === 0) return Q96;
  
  if (diff > 0) {
    // currency1 has more decimals, so 1 unit of currency0 = 10^diff units of currency1
    const ratio = BigInt(10) ** BigInt(diff);
    return bigintSqrt(ratio * Q192);
  } else {
    // currency0 has more decimals, so 1 unit of currency0 = 10^(-diff) units of currency1
    const inv = BigInt(10) ** BigInt(-diff);
    return bigintSqrt(Q192 / inv);
  }
}

// v4 tick bounds compatible with TickMath (must be multiples of tickSpacing)
const RAW_MIN_TICK = -887272;
const RAW_MAX_TICK = 887272;
function alignedTicks(spacing: number) {
  const lower = Math.ceil(RAW_MIN_TICK / spacing) * spacing; // -887220 for spacing 60
  const upper = Math.floor(RAW_MAX_TICK / spacing) * spacing; // 887220 for spacing 60
  return { lower, upper };
}

function sortTokens(a: string, b: string) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  return aLower < bLower
    ? { currency0: a, currency1: b, zeroForOneIfPayingA: true }
    : { currency0: b, currency1: a, zeroForOneIfPayingA: false };
}

function parseAmount(raw: string, decimalsIn: number | bigint): bigint {
  const decimals = Number(decimalsIn);
  const [whole, frac = ""] = raw.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * (BigInt(10) ** BigInt(decimals)) + BigInt(fracPadded || "0");
}

async function main() {
  const addrs = readAddresses();
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS || addrs.POOL_MANAGER;
  const hook = ethers.ZeroAddress; // seed a pool without a hook to avoid flagged-address requirement

  if (!poolManagerAddress || !hook) {
    throw new Error("POOL_MANAGER_ADDRESS and ASSET_LAYER_SWAP_HOOK are required (in .env or addresses.json)");
  }

  const tokenA = process.env.SEED_TOKEN_A!; // e.g. WASL
  const tokenB = process.env.SEED_TOKEN_B!; // e.g. AUSD
  if (!tokenA || !tokenB) throw new Error("Set SEED_TOKEN_A and SEED_TOKEN_B in contracts/.env");

  const amountA = process.env.SEED_AMOUNT_A || "1000"; // in human units
  const amountB = process.env.SEED_AMOUNT_B || "1000";
  const fee = 100; // use the working fee tier
  const tickSpacing = 1;

  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();

  const pm = new ethers.Contract(poolManagerAddress, poolManagerArtifact.abi, signer);
  const routerAddr = addrs.MINIMAL_SWAP_ROUTER;
  if (!routerAddr) throw new Error("MINIMAL_SWAP_ROUTER missing from addresses.json - deploy the router first.");
  const router = new ethers.Contract(routerAddr, routerArtifact.abi, signer);
  const tA = new ethers.Contract(tokenA, erc20Abi, signer);
  const tB = new ethers.Contract(tokenB, erc20Abi, signer);

  const decA = Number(await tA.decimals());
  const decB = Number(await tB.decimals());
  const amtA: bigint = parseAmount(amountA, decA);
  const amtB: bigint = parseAmount(amountB, decB);

  const { currency0, currency1 } = sortTokens(tokenA, tokenB);

  const key = {
    currency0,
    currency1,
    fee,
    tickSpacing,
    hooks: hook,
  };
  console.log("PoolKey:", key);

  console.log("Skipping pool initialization - trying to add liquidity directly…");
  console.log("PoolId:", ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  )));

  // Approve router to pull desired amounts (use MaxUint256 to avoid under-approval)
  console.log("Approving router to pull tokens…");
  await (await tA.approve(routerAddr, ethers.MaxUint256)).wait();
  await (await tB.approve(routerAddr, ethers.MaxUint256)).wait();

  // Try to add liquidity directly through PoolManager
  console.log("Adding liquidity directly through PoolManager…");
  const MIN_TICK = -60; // smaller range around current price
  const MAX_TICK = 60;
  const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18 - much larger
  
  console.log("Liquidity params:", {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount.toString(),
  });
  
  // Check if pool is already initialized
  console.log("Checking if pool is already initialized...");
  try {
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    ));
    
    // Try to read the pool's slot0 to see if it's initialized
    try {
      await pm.extsload(poolId);
      console.log("✓ Pool is already initialized, proceeding...");
    } catch (readError: any) {
      console.log("Pool not found, attempting to initialize...");
      
      // Try to initialize with the working sqrtPriceX96
      try {
        const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n); // Working sqrtPriceX96
        console.log("Initializing with sqrtPriceX96:", sqrtP.toString());
        await (await pm.initialize(key, sqrtP)).wait();
        console.log("✓ Pool initialized successfully!");
      } catch (initError: any) {
        const msg = (initError?.error?.message || initError?.message || "").toLowerCase();
        if (msg.includes("already initialized") || msg.includes("initialized")) {
          console.log("✓ Pool already initialized, proceeding...");
        } else {
          console.log("✗ Pool initialization failed:", initError?.error?.message || initError?.message || initError);
          throw initError;
        }
      }
    }
  } catch (e: any) {
    console.log("Could not check pool status, but continuing anyway...");
  }
  
  // Now try to add liquidity directly
  try {
    const mlParams = {
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      liquidityDelta: liquidityAmount,
      salt: ethers.ZeroHash,
    };
    
    console.log("Calling modifyLiquidity directly...");
    await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
    console.log("Liquidity added successfully via PoolManager");
  } catch (e: any) {
    console.error("modifyLiquidity failed:", e?.error?.message || e?.message || e);
    throw e;
  }

  console.log("Done. Try quoting/swapping now.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


