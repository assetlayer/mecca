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

  console.log("PoolManager:", poolManagerAddress);

  // Create contract
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  // List all available functions
  console.log("\n=== Available Functions ===");
  try {
    const functions = Object.getOwnPropertyNames(pm.interface.functions);
    functions.forEach(func => {
      console.log(`- ${func}`);
    });
  } catch (e: any) {
    console.log("Could not list functions:", e?.message || e);
  }

  // Test extsload with proper parameters
  console.log("\n=== Testing extsload ===");
  
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  console.log("PoolId:", poolId);

  // Try extsload with single bytes32
  try {
    const slot0 = await pm.extsload(poolId);
    console.log("✓ extsload (single) succeeded:", slot0);
  } catch (e: any) {
    console.log("✗ extsload (single) failed:", e?.error?.message || e?.message || e);
  }

  // Try extsload with array
  try {
    const slot0 = await pm.extsload([poolId]);
    console.log("✓ extsload (array) succeeded:", slot0);
  } catch (e: any) {
    console.log("✗ extsload (array) failed:", e?.error?.message || e?.message || e);
  }

  // Try to initialize pool
  console.log("\n=== Testing Pool Initialization ===");
  
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
    
    // Check if pool exists now using extsload
    console.log("\n=== Checking Pool After Initialization ===");
    
    try {
      const slot0 = await pm.extsload(poolId);
      console.log("✓ Pool now exists (extsload single):", slot0);
    } catch (e: any) {
      console.log("✗ Pool still does not exist (extsload single):", e?.error?.message || e?.message || e);
    }
    
    try {
      const slot0 = await pm.extsload([poolId]);
      console.log("✓ Pool now exists (extsload array):", slot0);
    } catch (e: any) {
      console.log("✗ Pool still does not exist (extsload array):", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
    } else {
      console.log("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
