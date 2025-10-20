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

  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Try to get more detailed error information
  console.log("=== Detailed Error Analysis ===");
  
  try {
    // Try to call initialize with static call first to get better error info
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    console.log("Trying static call...");
    await pm.initialize.staticCall(key, sqrtP);
    console.log("✓ Static call succeeded");
  } catch (e: any) {
    console.error("✗ Static call failed:", e?.error?.message || e?.message || e);
    
    // Try to decode the error
    if (e?.error?.data) {
      console.log("Error data:", e.error.data);
    }
  }

  // Check if the PoolManager has any specific requirements
  console.log("\n=== PoolManager Requirements Check ===");
  
  try {
    // Check if we need to be the owner
    const owner = await pm.owner();
    console.log("PoolManager owner:", owner);
    console.log("Our address:", me);
    console.log("Are we the owner?", owner.toLowerCase() === me.toLowerCase());
  } catch (e: any) {
    console.error("Failed to check owner:", e?.error?.message || e?.message || e);
  }

  // Check if there are any access controls
  try {
    // Try to call a view function that might give us more info
    const protocolFeeController = await pm.protocolFeeController();
    console.log("Protocol fee controller:", protocolFeeController);
  } catch (e: any) {
    console.error("Failed to get protocol fee controller:", e?.error?.message || e?.message || e);
  }

  // Try to check if the pool already exists with a different method
  console.log("\n=== Pool Existence Check ===");
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  try {
    // Try to read the pool's slot0 directly
    const slot0 = await pm.extsload(poolId);
    console.log("Pool slot0:", slot0);
  } catch (e: any) {
    console.log("Pool does not exist (extsload failed):", e?.error?.message || e?.message || e);
  }

  // Try to check if there are any restrictions on the fee or tickSpacing
  console.log("\n=== Fee and TickSpacing Validation ===");
  console.log("Fee:", key.fee);
  console.log("TickSpacing:", key.tickSpacing);
  console.log("Fee % TickSpacing == 0?", key.fee % key.tickSpacing === 0);
  
  // Check if the fee is valid
  const validFees = [50, 100, 200, 500, 1000, 3000, 5000, 10000];
  console.log("Is fee valid?", validFees.includes(key.fee));
  
  // Check if tickSpacing is valid for the fee
  const validTickSpacings = {
    50: [1],
    100: [1, 2],
    200: [1, 2, 4],
    500: [10],
    1000: [10, 20],
    3000: [60],
    5000: [100],
    10000: [200],
  };
  
  const validSpacings = validTickSpacings[key.fee] || [];
  console.log("Valid tick spacings for fee", key.fee, ":", validSpacings);
  console.log("Is tickSpacing valid?", validSpacings.includes(key.tickSpacing));

  // Try with a different configuration that might work
  console.log("\n=== Trying Alternative Configuration ===");
  const altKey = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  
  console.log("Alternative PoolKey:", altKey);
  
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    await pm.initialize.staticCall(altKey, sqrtP);
    console.log("✓ Alternative configuration static call succeeded");
  } catch (e: any) {
    console.error("✗ Alternative configuration static call failed:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
