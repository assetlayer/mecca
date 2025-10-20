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

  // Use a working configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Initialize the pool
  console.log("Initializing pool...");
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
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

  // Try different liquidity configurations
  const liquidityConfigs = [
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("1000000000000000000") }, // 1e18
    { tickLower: -100, tickUpper: 100, liquidityDelta: ethers.toBigInt("1000000000000000000") }, // 1e18
    { tickLower: -50, tickUpper: 50, liquidityDelta: ethers.toBigInt("1000000000000000000") }, // 1e18
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("100000000000000000") }, // 1e17
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("10000000000000000") }, // 1e16
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("1000000000000000") }, // 1e15
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("100000000000000") }, // 1e14
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("10000000000000") }, // 1e13
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("1000000000000") }, // 1e12
    { tickLower: -200, tickUpper: 200, liquidityDelta: ethers.toBigInt("100000000000") }, // 1e11
  ];

  for (const config of liquidityConfigs) {
    console.log(`\n=== Trying tickLower=${config.tickLower}, tickUpper=${config.tickUpper}, liquidityDelta=${config.liquidityDelta.toString()} ===`);
    
    try {
      const mlParams = {
        tickLower: config.tickLower,
        tickUpper: config.tickUpper,
        liquidityDelta: config.liquidityDelta,
        salt: ethers.ZeroHash,
      };
      
      await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
      console.log("✓ Liquidity added successfully!");
      console.log("✓ Pool is now seeded and ready for swapping!");
      return;
    } catch (e: any) {
      console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
    }
  }
  
  console.log("\n✗ All liquidity configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
