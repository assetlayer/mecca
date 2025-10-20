import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  
  if (!poolManagerAddress) {
    throw new Error("Set POOL_MANAGER_ADDRESS in contracts/.env");
  }

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  console.log("=== Checking Operator Status After Set ===");
  
  const owner = await pm.owner();
  console.log("PoolManager owner:", owner);
  console.log("Our address:", me);
  
  // Check different operator status combinations
  try {
    const isOperatorOwner = await pm.isOperator(owner, me);
    console.log("Are we an operator of the owner?", isOperatorOwner);
    
    const isOperatorSelf = await pm.isOperator(me, me);
    console.log("Are we an operator of ourselves?", isOperatorSelf);
    
    const isOwnerOperator = await pm.isOperator(me, owner);
    console.log("Is owner an operator of us?", isOwnerOperator);
    
    // Try to check if we can now initialize a pool
    console.log("\n=== Testing Pool Initialization After Operator Set ===");
    
    const tokenA = process.env.SEED_TOKEN_A!;
    const tokenB = process.env.SEED_TOKEN_B!;
    
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
      console.log("✓ Static call succeeded! Pool initialization should work now.");
      
      // Try the actual initialization
      console.log("Attempting actual pool initialization...");
      await (await pm.initialize(key, sqrtP)).wait();
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
      
    } catch (e: any) {
      const msg = (e?.error?.message || e?.message || "").toLowerCase();
      if (msg.includes("already initialized")) {
        console.log("✓ Pool already initialized");
      } else {
        console.error("✗ Pool initialization still failed:", e?.error?.message || e?.message || e);
      }
    }
    
  } catch (e: any) {
    console.error("Failed to check operator status:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
