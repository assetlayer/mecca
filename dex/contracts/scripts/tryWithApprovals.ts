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

  console.log("=== Testing with Token Approvals ===");
  
  // Step 1: Approve PoolManager to spend tokens
  console.log("Step 1: Approving PoolManager to spend tokens...");
  try {
    await (await tA.approve(poolManagerAddress, ethers.MaxUint256)).wait();
    console.log("✓ TokenA approved");
  } catch (e: any) {
    console.error("✗ TokenA approval failed:", e?.error?.message || e?.message || e);
  }

  try {
    await (await tB.approve(poolManagerAddress, ethers.MaxUint256)).wait();
    console.log("✓ TokenB approved");
  } catch (e: any) {
    console.error("✗ TokenB approval failed:", e?.error?.message || e?.message || e);
  }

  // Step 2: Sync tokens
  console.log("\nStep 2: Syncing tokens...");
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

  // Step 3: Try to initialize pool
  console.log("\nStep 3: Attempting pool initialization...");
  
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    console.log("Trying static call...");
    await pm.initialize.staticCall(key, sqrtP);
    console.log("✓ Static call succeeded, proceeding with transaction...");
    
    await (await pm.initialize(key, sqrtP)).wait();
    console.log("✓ Pool initialized successfully!");
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
    } else {
      console.error("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
      
      // Try with different configurations
      console.log("\nTrying alternative configurations...");
      
      const altConfigs = [
        { fee: 3000, tickSpacing: 60 },
        { fee: 500, tickSpacing: 10 },
        { fee: 100, tickSpacing: 1 },
      ];
      
      for (const config of altConfigs) {
        const altKey = {
          currency0: tokenA < tokenB ? tokenA : tokenB,
          currency1: tokenA < tokenB ? tokenB : tokenA,
          fee: config.fee,
          tickSpacing: config.tickSpacing,
          hooks: ethers.ZeroAddress,
        };
        
        console.log(`Trying fee=${config.fee}, tickSpacing=${config.tickSpacing}...`);
        
        try {
          const altSqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
          await pm.initialize.staticCall(altKey, altSqrtP);
          console.log(`✓ Static call succeeded for fee=${config.fee}`);
          
          await (await pm.initialize(altKey, altSqrtP)).wait();
          console.log(`✓ Pool initialized successfully with fee=${config.fee}!`);
          
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
            
            await (await pm.modifyLiquidity(altKey, mlParams, "0x")).wait();
            console.log("✓ Liquidity added successfully!");
            console.log("✓ Pool is now seeded and ready for swapping!");
            return;
          } catch (e: any) {
            console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
          }
        } catch (e: any) {
          console.log(`✗ Fee=${config.fee} failed:`, e?.error?.message || e?.message || e);
        }
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
