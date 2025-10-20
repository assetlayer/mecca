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

  console.log("=== Network Investigation ===");
  
  // Check network state
  const network = await ethers.provider.getNetwork();
  const blockNumber = await ethers.provider.getBlockNumber();
  const balance = await ethers.provider.getBalance(me);
  
  console.log("Network:", network);
  console.log("Block number:", blockNumber);
  console.log("ETH balance:", ethers.formatEther(balance));
  
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

  // Check PoolManager state
  try {
    const owner = await pm.owner();
    const protocolFeeController = await pm.protocolFeeController();
    console.log("PoolManager owner:", owner);
    console.log("Protocol fee controller:", protocolFeeController);
  } catch (e: any) {
    console.error("Failed to get PoolManager state:", e?.error?.message || e?.message || e);
  }

  // Try to sync tokens first
  console.log("\n=== Syncing tokens ===");
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

  // Try different approaches to pool initialization
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("\n=== Pool Initialization Tests ===");
  console.log("PoolKey:", key);

  // Test 1: Try to initialize with different gas settings
  console.log("\nTest 1: Initialize with different gas settings");
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    const tx = await pm.initialize(key, sqrtP, { gasLimit: 1000000 });
    await tx.wait();
    console.log("✓ Pool initialized with high gas limit");
  } catch (e: any) {
    console.error("✗ High gas limit failed:", e?.error?.message || e?.message || e);
  }

  // Test 2: Try to initialize with different sqrtPriceX96 values
  console.log("\nTest 2: Initialize with different sqrtPriceX96 values");
  const sqrtPValues = [
    ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
    ethers.parseUnits("2", 0) * (2n ** 96n), // 4:1
    (ethers.parseUnits("1", 0) * (2n ** 96n)) / 2n, // 1:4
    4295128739n, // minimum valid
  ];

  for (let i = 0; i < sqrtPValues.length; i++) {
    const sqrtP = sqrtPValues[i];
    console.log(`  Trying sqrtPriceX96 ${i + 1}:`, sqrtP.toString());
    
    try {
      await (await pm.initialize(key, sqrtP)).wait();
      console.log(`  ✓ Pool initialized with sqrtPriceX96 ${i + 1}`);
      break;
    } catch (e: any) {
      const msg = (e?.error?.message || e?.message || "").toLowerCase();
      if (msg.includes("already initialized")) {
        console.log(`  ✓ Pool already initialized`);
        break;
      } else {
        console.log(`  ✗ sqrtPriceX96 ${i + 1} failed:`, e?.error?.message || e?.message || e);
      }
    }
  }

  // Test 3: Check if pool exists after initialization attempts
  console.log("\nTest 3: Check if pool exists");
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  try {
    await pm.extsload(poolId);
    console.log("✓ Pool exists and is initialized");
    
    // Try to add liquidity
    console.log("\nTest 4: Adding liquidity to existing pool");
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
    } catch (e: any) {
      console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
    }
  } catch (e: any) {
    console.log("✗ Pool does not exist");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
