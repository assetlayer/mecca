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

  console.log("=== Simple Pool Initialization Test ===");
  
  // Use a very simple pool configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);
  console.log("Currency0:", key.currency0);
  console.log("Currency1:", key.currency1);
  console.log("Fee:", key.fee);
  console.log("TickSpacing:", key.tickSpacing);
  console.log("Hooks:", key.hooks);

  // Try different sqrtPriceX96 values
  const sqrtPValues = [
    ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
    4295128739n, // minimum valid
    79228162514264337593543950336n, // 2^96
  ];

  for (let i = 0; i < sqrtPValues.length; i++) {
    const sqrtP = sqrtPValues[i];
    console.log(`\n=== Trying sqrtPriceX96 ${i + 1}/${sqrtPValues.length}: ${sqrtP.toString()} ===`);
    
    try {
      // Try static call first
      console.log("Trying static call...");
      await pm.initialize.staticCall(key, sqrtP);
      console.log("✓ Static call succeeded!");
      
      // If static call succeeds, try actual transaction
      console.log("Trying actual transaction...");
      const tx = await pm.initialize(key, sqrtP);
      console.log("Transaction hash:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✓ Transaction confirmed!");
      console.log("Gas used:", receipt?.gasUsed?.toString());
      
      // Check if pool now exists
      const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint24", "int24", "address"],
        [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
      ));
      
      try {
        await pm.extsload(poolId);
        console.log("✓ Pool exists and is initialized!");
        
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
          
          const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
          await liquidityTx.wait();
          console.log("✓ Liquidity added successfully!");
          console.log("✓ Pool is now seeded and ready for swapping!");
          return;
        } catch (e: any) {
          console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
        }
        
      } catch (e: any) {
        console.log("✗ Pool does not exist after initialization");
      }
      
      break; // If we get here, initialization succeeded
      
    } catch (e: any) {
      const msg = (e?.error?.message || e?.message || "").toLowerCase();
      if (msg.includes("already initialized")) {
        console.log("✓ Pool already initialized");
        break;
      } else {
        console.log(`✗ sqrtPriceX96 ${i + 1} failed:`, e?.error?.message || e?.message || e);
      }
    }
  }
  
  console.log("\n✗ All sqrtPriceX96 values failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
