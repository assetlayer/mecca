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

  console.log("=== Testing as PoolManager Owner ===");
  
  // Verify we're the owner
  const owner = await pm.owner();
  console.log("PoolManager owner:", owner);
  console.log("Our address:", me);
  console.log("Are we the owner?", owner.toLowerCase() === me.toLowerCase());
  
  if (owner.toLowerCase() !== me.toLowerCase()) {
    console.error("❌ We are not the owner! Cannot proceed.");
    return;
  }

  // Check token balances
  try {
    const balA = await tA.balanceOf(me);
    const balB = await tB.balanceOf(me);
    console.log("Token balances:", { 
      tokenA: balA.toString(), 
      tokenB: balB.toString() 
    });
  } catch (e: any) {
    console.error("Failed to get token balances:", e?.error?.message || e?.message || e);
  }

  // Sync tokens first
  console.log("\n=== Syncing Tokens ===");
  try {
    await (await pm.sync(tokenA)).wait();
    console.log("✓ TokenA synced");
  } catch (e: any) {
    console.error("✗ TokenA sync failed:", e?.error?.message || e?.message || e);
  }

  try {
    await (await pm.sync(tokenB)).wait();
    console.log("✓ TokenB synced");
  } catch (e: any) {
    console.error("✗ TokenB sync failed:", e?.error?.message || e?.message || e);
  }

  // Try different pool configurations
  const poolConfigs = [
    { fee: 10000, tickSpacing: 200 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 500, tickSpacing: 10 },
    { fee: 100, tickSpacing: 1 },
  ];

  for (const config of poolConfigs) {
    console.log(`\n=== Trying Pool Config: fee=${config.fee}, tickSpacing=${config.tickSpacing} ===`);
    
    const key = {
      currency0: tokenA < tokenB ? tokenA : tokenB,
      currency1: tokenA < tokenB ? tokenB : tokenA,
      fee: config.fee,
      tickSpacing: config.tickSpacing,
      hooks: ethers.ZeroAddress,
    };
    
    console.log("PoolKey:", key);
    
    // Check if pool already exists
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    ));
    
    try {
      await pm.extsload(poolId);
      console.log("✓ Pool already exists, trying to add liquidity...");
      
      // Try to add liquidity to existing pool
      try {
        const MIN_TICK = -200;
        const MAX_TICK = 200;
        const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
        
        const mlParams = {
          tickLower: MIN_TICK,
          tickUpper: MAX_TICK,
          liquidityDelta: liquidityAmount,
          salt: ethers.ZeroHash,
        };
        
        await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
        console.log("✓ Liquidity added successfully!");
        console.log("✓ Pool is now seeded and ready for swapping!");
        return;
      } catch (e: any) {
        console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
      }
    } catch (e: any) {
      console.log("Pool does not exist, trying to initialize...");
    }
    
    // Try to initialize with different sqrtPriceX96 values
    const sqrtPValues = [
      ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
      ethers.parseUnits("2", 0) * (2n ** 96n), // 4:1
      (ethers.parseUnits("1", 0) * (2n ** 96n)) / 2n, // 1:4
      4295128739n, // minimum valid
    ];
    
    let initialized = false;
    for (let i = 0; i < sqrtPValues.length; i++) {
      const sqrtP = sqrtPValues[i];
      console.log(`  Trying sqrtPriceX96 ${i + 1}/${sqrtPValues.length}:`, sqrtP.toString());
      
      try {
        // Try static call first
        await pm.initialize.staticCall(key, sqrtP);
        console.log(`  ✓ Static call succeeded for sqrtPriceX96 ${i + 1}`);
        
        // If static call succeeds, try actual transaction
        await (await pm.initialize(key, sqrtP)).wait();
        console.log(`  ✓ Pool initialized successfully with sqrtPriceX96 ${i + 1}`);
        initialized = true;
        break;
      } catch (initError: any) {
        const msg = (initError?.error?.message || initError?.message || "").toLowerCase();
        if (msg.includes("already initialized")) {
          console.log(`  ✓ Pool already initialized`);
          initialized = true;
          break;
        } else {
          console.log(`  ✗ sqrtPriceX96 ${i + 1} failed:`, initError?.error?.message || initError?.message || initError);
        }
      }
    }
    
    if (initialized) {
      console.log("✓ Pool initialized successfully!");
      
      // Try to add liquidity
      console.log("Attempting to add liquidity...");
      try {
        const MIN_TICK = -200;
        const MAX_TICK = 200;
        const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
        
        const mlParams = {
          tickLower: MIN_TICK,
          tickUpper: MAX_TICK,
          liquidityDelta: liquidityAmount,
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
  }
  
  console.log("\n✗ All pool configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
