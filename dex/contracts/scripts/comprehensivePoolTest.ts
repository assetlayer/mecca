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

  console.log("PoolManager:", poolManagerAddress);
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  // Test with the working configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  
  console.log("PoolKey:", key);
  
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  console.log("PoolId:", poolId);

  // Check if pool exists using different methods
  console.log("\n=== Checking Pool Existence ===");
  
  // Method 1: extsload
  try {
    const slot0 = await pm.extsload(poolId);
    console.log("✓ Pool exists (extsload):", slot0);
  } catch (e: any) {
    console.log("✗ Pool does not exist (extsload):", e?.error?.message || e?.message || e);
  }

  // Method 2: Try to read slot0 directly
  try {
    const slot0 = await pm.getSlot0(poolId);
    console.log("✓ Pool exists (getSlot0):", slot0);
  } catch (e: any) {
    console.log("✗ Pool does not exist (getSlot0):", e?.error?.message || e?.message || e);
  }

  // Method 3: Try to read liquidity
  try {
    const liquidity = await pm.getLiquidity(poolId);
    console.log("✓ Pool exists (getLiquidity):", liquidity);
  } catch (e: any) {
    console.log("✗ Pool does not exist (getLiquidity):", e?.error?.message || e?.message || e);
  }

  // Method 4: Try to read tick bitmap
  try {
    const tickBitmap = await pm.getTickBitmap(poolId, 0);
    console.log("✓ Pool exists (getTickBitmap):", tickBitmap);
  } catch (e: any) {
    console.log("✗ Pool does not exist (getTickBitmap):", e?.error?.message || e?.message || e);
  }

  // If pool doesn't exist, try to initialize it
  console.log("\n=== Attempting Pool Initialization ===");
  
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    console.log("Initializing with sqrtPriceX96:", sqrtP.toString());
    
    // Try static call first
    try {
      await pm.initialize.staticCall(key, sqrtP);
      console.log("✓ Static call succeeded");
    } catch (e: any) {
      console.log("✗ Static call failed:", e?.error?.message || e?.message || e);
    }
    
    // Try actual initialization
    const tx = await pm.initialize(key, sqrtP);
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ Pool initialized successfully!");
    console.log("Gas used:", receipt?.gasUsed?.toString());
    
    // Check if pool exists now
    console.log("\n=== Checking Pool Existence After Initialization ===");
    
    try {
      const slot0 = await pm.extsload(poolId);
      console.log("✓ Pool now exists (extsload):", slot0);
    } catch (e: any) {
      console.log("✗ Pool still does not exist (extsload):", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
    } else {
      console.log("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
    }
  }

  // Try to add liquidity if pool exists
  console.log("\n=== Attempting to Add Liquidity ===");
  
  try {
    const slot0 = await pm.extsload(poolId);
    console.log("Pool exists, attempting to add liquidity...");
    
    const MIN_TICK = -60;
    const MAX_TICK = 60;
    const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
    
    const mlParams = {
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      liquidityDelta: liquidityAmount,
      salt: ethers.ZeroHash,
    };
    
    console.log("Liquidity params:", mlParams);
    
    // Try static call first
    try {
      await pm.modifyLiquidity.staticCall(key, mlParams, "0x");
      console.log("✓ modifyLiquidity static call succeeded");
    } catch (e: any) {
      console.log("✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
    }
    
    // Try actual liquidity addition
    const tx = await pm.modifyLiquidity(key, mlParams, "0x");
    console.log("Transaction hash:", tx.hash);
    const receipt = await tx.wait();
    console.log("✓ Liquidity added successfully!");
    console.log("Gas used:", receipt?.gasUsed?.toString());
    
  } catch (e: any) {
    console.log("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
