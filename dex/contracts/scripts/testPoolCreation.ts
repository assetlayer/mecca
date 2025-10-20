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

  console.log("PoolManager:", poolManagerAddress);
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
  const tB = await ethers.getContractAt("IERC20Minimal", tokenB);

  // Get token info - use hardcoded values since IERC20Minimal doesn't have decimals()
  const decA = 6; // AUSD has 6 decimals
  const decB = 18; // WASL has 18 decimals
  console.log("Token decimals:", { decA, decB });

  // Try different pool configurations
  const poolConfigs = [
    { fee: 3000, tickSpacing: 60, hook: ethers.ZeroAddress },
    { fee: 500, tickSpacing: 10, hook: ethers.ZeroAddress },
    { fee: 10000, tickSpacing: 200, hook: ethers.ZeroAddress },
  ];

  for (const config of poolConfigs) {
    console.log(`\nTrying pool config:`, config);
    
    const key = {
      currency0: tokenA < tokenB ? tokenA : tokenB,
      currency1: tokenA < tokenB ? tokenB : tokenA,
      fee: config.fee,
      tickSpacing: config.tickSpacing,
      hooks: config.hook,
    };
    
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    ));
    
    console.log("PoolId:", poolId);
    
    // Try to initialize
    try {
      const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n); // Proper sqrtPriceX96 for 1:1
      console.log("Trying to initialize with sqrtPriceX96:", sqrtP.toString());
      await (await pm.initialize(key, sqrtP)).wait();
      console.log("✓ Pool initialized successfully!");
      return; // Success!
    } catch (e: any) {
      const msg = (e?.error?.message || e?.message || "").toLowerCase();
      if (msg.includes("already initialized")) {
        console.log("✓ Pool already exists!");
        return; // Success!
      } else {
        console.log("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
      }
    }
  }
  
  console.log("\nAll pool configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
