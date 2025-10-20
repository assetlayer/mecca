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

  // Use the exact same configuration that worked in debug script
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 100,
    tickSpacing: 1,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Try to initialize with the exact same sqrtPriceX96 that worked
  const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
  console.log("Initializing with sqrtPriceX96:", sqrtP.toString());
  
  try {
    await (await pm.initialize(key, sqrtP)).wait();
    console.log("✓ Pool initialized successfully!");
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
    } else {
      console.error("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
      console.error("Full error:", e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
