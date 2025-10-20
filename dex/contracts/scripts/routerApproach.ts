import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  const routerAddress = process.env.MINIMAL_SWAP_ROUTER_ADDRESS;
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!poolManagerAddress || !routerAddress || !tokenA || !tokenB) {
    throw new Error("Set POOL_MANAGER_ADDRESS, MINIMAL_SWAP_ROUTER_ADDRESS, SEED_TOKEN_A, and SEED_TOKEN_B in contracts/.env");
  }

  console.log("PoolManager:", poolManagerAddress);
  console.log("Router:", routerAddress);
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const router = await ethers.getContractAt("MinimalSwapRouterV4", routerAddress);
  const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
  const tB = await ethers.getContractAt("IERC20Minimal", tokenB);

  // Use a simple pool configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 100,
    tickSpacing: 1,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Step 1: Approve router to spend tokens
  console.log("Step 1: Approving router to spend tokens...");
  try {
    await (await tA.approve(routerAddress, ethers.MaxUint256)).wait();
    await (await tB.approve(routerAddress, ethers.MaxUint256)).wait();
    console.log("✓ Router approved to spend tokens");
  } catch (e: any) {
    console.error("✗ Approval failed:", e?.error?.message || e?.message || e);
    throw e;
  }

  // Step 2: Try to add liquidity using router (this should initialize the pool if needed)
  console.log("Step 2: Adding liquidity via router...");
  
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
  
  try {
    // Try static call first to see if it would work
    console.log("Testing with static call...");
    await router.addLiquidity.staticCall(addParams);
    console.log("✓ Static call succeeded, proceeding with transaction...");
    
    // If static call succeeds, do the actual transaction
    const tx = await router.addLiquidity(addParams);
    await tx.wait();
    console.log("✓ Liquidity added successfully via router!");
    console.log("✓ Pool should now be initialized and seeded!");
  } catch (e: any) {
    console.error("✗ Router addLiquidity failed:", e?.error?.message || e?.message || e);
    
    // If router approach fails, try direct PoolManager approach
    console.log("Trying direct PoolManager approach...");
    
    try {
      // Try to initialize pool first
      console.log("Attempting to initialize pool...");
      const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
      await (await pm.initialize(key, sqrtP)).wait();
      console.log("✓ Pool initialized successfully!");
      
      // Then add liquidity
      console.log("Adding liquidity directly...");
      const mlParams = {
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        liquidityDelta: liquidityAmount,
        salt: ethers.ZeroHash,
      };
      
      await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
      console.log("✓ Liquidity added successfully!");
    } catch (directError: any) {
      console.error("✗ Direct PoolManager approach also failed:", directError?.error?.message || directError?.message || directError);
      throw directError;
    }
  }

  console.log("✓ Pool seeding completed! You can now try swapping.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
