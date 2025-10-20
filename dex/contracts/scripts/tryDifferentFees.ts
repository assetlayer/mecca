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

  // Try different fee tiers and tick spacings
  const configurations = [
    { fee: 100, tickSpacing: 1 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
    { fee: 50, tickSpacing: 1 },
    { fee: 200, tickSpacing: 4 },
    { fee: 5000, tickSpacing: 100 },
  ];

  for (const config of configurations) {
    console.log(`\n=== Trying fee=${config.fee}, tickSpacing=${config.tickSpacing} ===`);
    
    const key = {
      currency0: tokenA < tokenB ? tokenA : tokenB,
      currency1: tokenA < tokenB ? tokenB : tokenA,
      fee: config.fee,
      tickSpacing: config.tickSpacing,
      hooks: ethers.ZeroAddress,
    };
    
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    ));
    
    console.log("PoolId:", poolId);
    
    // Check if pool already exists
    try {
      await pm.extsload(poolId);
      console.log("✓ Pool already exists!");
      continue;
    } catch (e: any) {
      console.log("Pool does not exist, trying to initialize...");
    }
    
    // Try different sqrtPriceX96 values
    const sqrtPValues = [
      ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
      ethers.parseUnits("2", 0) * (2n ** 96n), // 4:1
      (ethers.parseUnits("1", 0) * (2n ** 96n)) / 2n, // 1:4
      4295128739n, // minimum valid
      79228162514264337593543950336n, // 2^96
    ];
    
    let initialized = false;
    for (let i = 0; i < sqrtPValues.length; i++) {
      const sqrtP = sqrtPValues[i];
      console.log(`  Trying sqrtPriceX96 ${i + 1}/${sqrtPValues.length}:`, sqrtP.toString());
      
      try {
        await (await pm.initialize(key, sqrtP)).wait();
        console.log(`  ✓ Pool initialized successfully with sqrtPriceX96 ${i + 1}`);
        initialized = true;
        break;
      } catch (initError: any) {
        const msg = (initError?.error?.message || initError?.message || "").toLowerCase();
        if (msg.includes("already initialized")) {
          console.log(`  ✓ Pool already initialized`);
          initialized = true;
          break;
        } else {
          console.log(`  ✗ sqrtPriceX96 ${i + 1} failed:`, initError?.error?.message || initError?.message || initError);
        }
      }
    }
    
    if (initialized) {
      console.log("✓ Found working configuration!");
      
      // Try to add liquidity
      console.log("Attempting to add liquidity...");
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
        
        await (await pm.modifyLiquidity(key, mlParams, "0x")).wait();
        console.log("✓ Liquidity added successfully!");
        console.log("✓ Pool is now seeded and ready for swapping!");
        return;
      } catch (e: any) {
        console.error("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
      }
    }
  }
  
  console.log("\n✗ All configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
