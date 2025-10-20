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

  // Test with the working configuration
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  
  console.log("PoolKey:", key);
  
  const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "address", "uint24", "int24", "address"],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
  ));
  
  console.log("PoolId:", poolId);

  // Check current pool state
  try {
    const slot0 = await pm["extsload(bytes32)"](poolId);
    console.log("Current slot0:", slot0);
  } catch (e: any) {
    console.log("Could not read slot0:", e?.error?.message || e?.message || e);
  }

  // Try different sqrtPriceX96 values
  const sqrtPValues = [
    ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
    ethers.parseUnits("2", 0) * (2n ** 96n), // 4:1
    (ethers.parseUnits("1", 0) * (2n ** 96n)) / 2n, // 1:4
    4295128739n, // minimum valid sqrtPriceX96
    79228162514264337593543950336n, // 2^96
    158456325028528675187087900672n, // 2^97
    39614081257132168796771975168n, // 2^95
  ];

  console.log("\n=== Testing Different sqrtPriceX96 Values ===");
  
  for (let i = 0; i < sqrtPValues.length; i++) {
    const sqrtP = sqrtPValues[i];
    console.log(`\nTrying sqrtPriceX96 ${i + 1}/${sqrtPValues.length}:`, sqrtP.toString());
    
    try {
      // Try static call first
      await pm.initialize.staticCall(key, sqrtP);
      console.log("  ✓ Static call succeeded");
      
      // Try actual initialization
      const tx = await pm.initialize(key, sqrtP);
      console.log("  Transaction hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("  ✓ Pool initialized successfully!");
      console.log("  Gas used:", receipt?.gasUsed?.toString());
      
      // Check if pool is now properly initialized
      try {
        const slot0 = await pm["extsload(bytes32)"](poolId);
        console.log("  New slot0:", slot0);
        
        // Try to add liquidity
        console.log("  Attempting to add liquidity...");
        
        const MIN_TICK = -60;
        const MAX_TICK = 60;
        const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
        
        const mlParams = {
          tickLower: MIN_TICK,
          tickUpper: MAX_TICK,
          liquidityDelta: liquidityAmount,
          salt: ethers.ZeroHash,
        };
        
        // Try static call first
        try {
          await pm.modifyLiquidity.staticCall(key, mlParams, "0x");
          console.log("  ✓ modifyLiquidity static call succeeded");
        } catch (e: any) {
          console.log("  ✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
        }
        
        // Try actual liquidity addition
        const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
        console.log("  Liquidity transaction hash:", liquidityTx.hash);
        const liquidityReceipt = await liquidityTx.wait();
        console.log("  ✓ Liquidity added successfully!");
        console.log("  Gas used:", liquidityReceipt?.gasUsed?.toString());
        
        console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
        return;
        
      } catch (e: any) {
        console.log("  ✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
      }
      
    } catch (e: any) {
      const msg = (e?.error?.message || e?.message || "").toLowerCase();
      if (msg.includes("already initialized")) {
        console.log("  ✓ Pool already initialized");
        
        // Try to add liquidity to existing pool
        console.log("  Attempting to add liquidity to existing pool...");
        
        try {
          const MIN_TICK = -60;
          const MAX_TICK = 60;
          const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
          
          const mlParams = {
            tickLower: MIN_TICK,
            tickUpper: MAX_TICK,
            liquidityDelta: liquidityAmount,
            salt: ethers.ZeroHash,
          };
          
          // Try static call first
          try {
            await pm.modifyLiquidity.staticCall(key, mlParams, "0x");
            console.log("  ✓ modifyLiquidity static call succeeded");
          } catch (e: any) {
            console.log("  ✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
          }
          
          // Try actual liquidity addition
          const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
          console.log("  Liquidity transaction hash:", liquidityTx.hash);
          const liquidityReceipt = await liquidityTx.wait();
          console.log("  ✓ Liquidity added successfully!");
          console.log("  Gas used:", liquidityReceipt?.gasUsed?.toString());
          
          console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
          return;
          
        } catch (e: any) {
          console.log("  ✗ Failed to add liquidity to existing pool:", e?.error?.message || e?.message || e);
        }
        
      } else {
        console.log("  ✗ sqrtPriceX96 failed:", e?.error?.message || e?.message || e);
      }
    }
  }
  
  console.log("\n✗ All sqrtPriceX96 values failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
