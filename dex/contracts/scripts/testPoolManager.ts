import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get PoolManager address
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  if (!poolManagerAddress) {
    throw new Error("Set POOL_MANAGER_ADDRESS in contracts/.env");
  }
  console.log("PoolManager address:", poolManagerAddress);

  // Create PoolManager contract
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  // Test basic PoolManager functions
  try {
    console.log("Testing PoolManager basic functions...");
    
    // Test if we can call a simple view function
    try {
      const protocolFeeController = await pm.protocolFeeController();
      console.log("✓ protocolFeeController:", protocolFeeController);
    } catch (e: any) {
      console.error("✗ protocolFeeController failed:", e?.error?.message || e?.message || e);
    }

    // Test if we can call another view function
    try {
      const owner = await pm.owner();
      console.log("✓ owner:", owner);
    } catch (e: any) {
      console.error("✗ owner failed:", e?.error?.message || e?.message || e);
    }

    // Test if we can call a function that requires state changes
    try {
      console.log("Testing sync function...");
      const tokenA = process.env.SEED_TOKEN_A!;
      await (await pm.sync(tokenA)).wait();
      console.log("✓ sync succeeded for tokenA");
    } catch (e: any) {
      console.error("✗ sync failed:", e?.error?.message || e?.message || e);
    }

  } catch (e: any) {
    console.error("PoolManager test failed:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
