import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses from .env
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  const routerAddress = process.env.MINIMAL_SWAP_ROUTER_ADDRESS;
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!poolManagerAddress || !routerAddress || !tokenA || !tokenB) {
    throw new Error("Missing required environment variables");
  }

  console.log("=== Testing New Deployment ===");
  console.log("PoolManager:", poolManagerAddress);
  console.log("Router:", routerAddress);
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const router = await ethers.getContractAt("MinimalSwapRouterV4", routerAddress);
  const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
  const tB = await ethers.getContractAt("IERC20Minimal", tokenB);

  // Check balances
  const balA = await tA.balanceOf(me);
  const balB = await tB.balanceOf(me);
  console.log("Token balances:", { 
    tokenA: balA.toString(), 
    tokenB: balB.toString() 
  });

  // Use a working pool configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 100,
    tickSpacing: 1,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Step 1: Initialize pool if needed
  console.log("\n=== Step 1: Pool Initialization ===");
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));

  try {
    await pm.extsload(poolId);
    console.log("✓ Pool already exists");
  } catch (e: any) {
    console.log("Pool does not exist, initializing...");
    try {
      const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
      await (await pm.initialize(key, sqrtP)).wait();
      console.log("✓ Pool initialized successfully!");
    } catch (initError: any) {
      console.error("✗ Pool initialization failed:", initError?.error?.message || initError?.message || initError);
      return;
    }
  }

  // Step 2: Approve router to spend tokens
  console.log("\n=== Step 2: Token Approvals ===");
  try {
    await (await tA.approve(routerAddress, ethers.MaxUint256)).wait();
    await (await tB.approve(routerAddress, ethers.MaxUint256)).wait();
    console.log("✓ Router approved to spend tokens");
  } catch (e: any) {
    console.error("✗ Token approval failed:", e?.error?.message || e?.message || e);
    return;
  }

  // Step 3: Add liquidity using router
  console.log("\n=== Step 3: Adding Liquidity via Router ===");
  try {
    const MIN_TICK = -60;
    const MAX_TICK = 60;
    const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
    
    const addParams = {
      key,
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      liquidityDelta: liquidityAmount,
      payer: me,
      deadline: Math.floor(Date.now() / 1000) + 600,
    };
    
    console.log("Liquidity params:", {
      tickLower: MIN_TICK,
      tickUpper: MAX_TICK,
      liquidityDelta: liquidityAmount.toString(),
      payer: me,
      deadline: addParams.deadline
    });
    
    // Try static call first
    console.log("Testing with static call...");
    await router.addLiquidity.staticCall(addParams);
    console.log("✓ Static call succeeded, proceeding with transaction...");
    
    // Execute the transaction
    const tx = await router.addLiquidity(addParams);
    await tx.wait();
    console.log("✓ Liquidity added successfully via router!");
    console.log("✓ Pool is now seeded and ready for swapping!");
    
  } catch (e: any) {
    console.error("✗ Router addLiquidity failed:", e?.error?.message || e?.message || e);
    
    // If router fails, try direct PoolManager approach
    console.log("\n=== Fallback: Direct PoolManager Approach ===");
    try {
      // Sync tokens first
      await (await pm.sync(tokenA)).wait();
      await (await pm.sync(tokenB)).wait();
      console.log("✓ Tokens synced");
      
      // Transfer tokens to PoolManager
      const fundAmount = ethers.toBigInt("1000000000000000000"); // 1e18
      await (await tA.transfer(poolManagerAddress, fundAmount)).wait();
      await (await tB.transfer(poolManagerAddress, fundAmount)).wait();
      console.log("✓ Tokens transferred to PoolManager");
      
      // Settle the tokens
      await (await pm.settle(tokenA)).wait();
      await (await pm.settle(tokenB)).wait();
      console.log("✓ Tokens settled");
      
      // Add liquidity
      const MIN_TICK = -60;
      const MAX_TICK = 60;
      const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
      
      const mlParams = {
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        liquidityDelta: liquidityAmount,
        salt: ethers.ZeroHash,
      };
      
      await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
      console.log("✓ Liquidity added successfully via direct PoolManager!");
      console.log("✓ Pool is now seeded and ready for swapping!");
      
    } catch (directError: any) {
      console.error("✗ Direct PoolManager approach also failed:", directError?.error?.message || directError?.message || directError);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
