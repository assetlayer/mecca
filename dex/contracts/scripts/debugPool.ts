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

  // Check token balances
  try {
    const balA = await tA.balanceOf(me);
    const balB = await tB.balanceOf(me);
    console.log("Token balances:", { balA: balA.toString(), balB: balB.toString() });
  } catch (e: any) {
    console.error("Failed to get token balances:", e?.error?.message || e?.message || e);
  }

  // Try different pool configurations
  const poolConfigs = [
    { fee: 500, tickSpacing: 10, hook: ethers.ZeroAddress },
    { fee: 3000, tickSpacing: 60, hook: ethers.ZeroAddress },
    { fee: 100, tickSpacing: 1, hook: ethers.ZeroAddress },
  ];

  for (const config of poolConfigs) {
    console.log(`\n=== Trying pool config: fee=${config.fee}, tickSpacing=${config.tickSpacing} ===`);
    
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
    
    // Check if pool exists
    try {
      await pm.extsload(poolId);
      console.log("✓ Pool already exists!");
      continue;
    } catch (e: any) {
      console.log("Pool does not exist, trying to initialize...");
    }
    
    // Try to initialize with different sqrtPriceX96 values
    const sqrtPValues = [
      ethers.parseUnits("1", 0) * (2n ** 96n), // 1:1
      ethers.parseUnits("2", 0) * (2n ** 96n), // 4:1
      (ethers.parseUnits("1", 0) * (2n ** 96n)) / 2n, // 1:4
      4295128739n, // minimum valid
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
      console.log("✓ Found working pool configuration!");
      return;
    }
  }
  
  console.log("\n✗ All pool configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
