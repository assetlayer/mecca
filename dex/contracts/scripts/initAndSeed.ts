import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!poolManagerAddress || !tokenA || !tokenB) {
    throw new Error("Set POOL_MANAGER_ADDRESS, SEED_TOKEN_A, and SEED_TOKEN_B in contracts/.env");
  }

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
  const tB = await ethers.getContractAt("IERC20Minimal", tokenB);

  // Use the working pool configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 500,
    tickSpacing: 10,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Step 1: Initialize the pool
  console.log("Step 1: Initializing pool...");
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n); // Working sqrtPriceX96
    console.log("Initializing with sqrtPriceX96:", sqrtP.toString());
    await (await pm.initialize(key, sqrtP)).wait();
    console.log("✓ Pool initialized successfully!");
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
    } else {
      console.error("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
      throw e;
    }
  }

  // Step 2: Add liquidity
  console.log("Step 2: Adding liquidity...");
  
  const MIN_TICK = -60;
  const MAX_TICK = 60;
  const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
  
  const mlParams = {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount,
    salt: ethers.ZeroHash,
  };
  
  console.log("Liquidity params:", {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount.toString(),
  });
  
  try {
    await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
    console.log("✓ Liquidity added successfully!");
  } catch (e: any) {
    console.error("✗ modifyLiquidity failed:", e?.error?.message || e?.message || e);
    throw e;
  }

  console.log("✓ Pool seeded successfully! You can now try swapping.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
