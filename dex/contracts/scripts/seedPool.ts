import { ethers } from "hardhat";
import { readFileSync } from "fs";
import { join } from "path";

// Read addresses from the JSON file
function readAddresses() {
  const addressesPath = join(__dirname, "../../frontend/lib/addresses.json");
  return JSON.parse(readFileSync(addressesPath, "utf8"));
}

// Sort tokens deterministically (lower address first)
function sortTokens(tokenA: string, tokenB: string): [string, string] {
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

// Calculate sqrtPriceX96 for 1:1 ratio
function calculateSqrtPriceX96(decimals0: number, decimals1: number): bigint {
  // For 1:1 ratio: sqrtPrice = sqrt(10^(decimals1-decimals0)) * 2^96
  const priceRatio = 10n ** BigInt(decimals1 - decimals0);
  const sqrtPrice = BigInt(Math.floor(Math.sqrt(Number(priceRatio)) * (2 ** 96)));
  return sqrtPrice;
}

async function main() {
  const addrs = readAddresses();
  const poolManagerAddress = addrs.POOL_MANAGER;
  const routerAddress = addrs.MINIMAL_SWAP_ROUTER;

  if (!poolManagerAddress || !routerAddress) {
    throw new Error("POOL_MANAGER and MINIMAL_SWAP_ROUTER are required in addresses.json");
  }

  const tokenA = process.env.SEED_TOKEN_A!; // e.g. WASL
  const tokenB = process.env.SEED_TOKEN_B!; // e.g. AUSD
  if (!tokenA || !tokenB) throw new Error("Set SEED_TOKEN_A and SEED_TOKEN_B in contracts/.env");

  console.log("=== Uniswap V4 Pool Seeding ===");
  console.log("PoolManager:", poolManagerAddress);
  console.log("Router:", routerAddress);
  console.log("Token A:", tokenA);
  console.log("Token B:", tokenB);

  const [signer] = await ethers.getSigners();
  console.log("Using account:", await signer.getAddress());

  // Sort tokens deterministically
  const [currency0, currency1] = sortTokens(tokenA, tokenB);
  console.log("Sorted tokens - currency0:", currency0, "currency1:", currency1);

  // Get token contracts
  const token0 = await ethers.getContractAt("ERC20", currency0);
  const token1 = await ethers.getContractAt("ERC20", currency1);

  // Get token decimals
  const decimals0 = Number(await token0.decimals());
  const decimals1 = Number(await token1.decimals());
  console.log("Token0 decimals:", decimals0, "Token1 decimals:", decimals1);

  // Calculate sqrtPriceX96 for 1:1 ratio
  const sqrtPriceX96 = calculateSqrtPriceX96(decimals0, decimals1);
  console.log("sqrtPriceX96:", sqrtPriceX96.toString());

  // Create PoolKey
  const poolKey = {
    currency0: currency0,
    currency1: currency1,
    fee: 3000, // 0.3%
    tickSpacing: 60,
    hooks: ethers.ZeroAddress
  };

  // Calculate PoolId
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
  ));

  console.log("PoolId:", poolId);

  // Get PoolManager contract
  const pm = await ethers.getContractAt("IPoolManager", poolManagerAddress);

  // Check if pool is already initialized
  try {
    const slot0 = await pm["extsload(bytes32)"](poolId);
    if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("✓ Pool is already initialized, slot0:", slot0);
    } else {
      console.log("Pool not initialized, will initialize...");
    }
  } catch (readError: any) {
    console.log("Pool not found, will initialize...");
  }

  // Get router contract
  const router = await ethers.getContractAt("MinimalSwapRouterV4", routerAddress);

  // Check balances
  const balance0 = await token0.balanceOf(await signer.getAddress());
  const balance1 = await token1.balanceOf(await signer.getAddress());
  console.log("Token0 balance:", ethers.formatUnits(balance0, decimals0));
  console.log("Token1 balance:", ethers.formatUnits(balance1, decimals1));

  // Set amounts (1 token each)
  const amount0 = ethers.parseUnits("1", decimals0);
  const amount1 = ethers.parseUnits("1", decimals1);

  console.log("Amount0:", ethers.formatUnits(amount0, decimals0));
  console.log("Amount1:", ethers.formatUnits(amount1, decimals1));

  // Check if we have enough balance
  if (balance0 < amount0 || balance1 < amount1) {
    throw new Error("Insufficient token balance");
  }

  // Approve router to spend tokens
  console.log("Approving tokens...");
  const approve0Tx = await token0.approve(routerAddress, amount0);
  await approve0Tx.wait();
  console.log("✓ Token0 approved");

  const approve1Tx = await token1.approve(routerAddress, amount1);
  await approve1Tx.wait();
  console.log("✓ Token1 approved");

  // Initialize pool if not already initialized
  try {
    const slot0 = await pm["extsload(bytes32)"](poolId);
    if (slot0 === "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("Initializing pool...");
      const initTx = await pm.initialize(poolKey, sqrtPriceX96);
      await initTx.wait();
      console.log("✓ Pool initialized");
    }
  } catch (initError: any) {
    console.log("Pool initialization failed:", initError.message);
    throw initError;
  }

  // Verify pool is initialized
  const slot0 = await pm["extsload(bytes32)"](poolId);
  console.log("Pool slot0 after init:", slot0);

  // Add liquidity
  console.log("Adding liquidity...");
  const addLiquidityTx = await router.addLiquidity(
    poolKey,
    {
      tickLower: -60, // -1% from current price
      tickUpper: 60,  // +1% from current price
      liquidityDelta: ethers.parseUnits("1", 18) // 1 unit of liquidity
    },
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "address"],
      [currency0, currency1, await signer.getAddress()]
    ),
    "0x" // empty hook data
  );

  await addLiquidityTx.wait();
  console.log("✓ Liquidity added successfully!");

  // Verify final state
  const finalSlot0 = await pm["extsload(bytes32)"](poolId);
  console.log("Final pool slot0:", finalSlot0);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});