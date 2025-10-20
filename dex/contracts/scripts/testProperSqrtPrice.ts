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
  
  // Get token info
  const basicERC20Abi = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
  ];

  const tA = new ethers.Contract(tokenA, basicERC20Abi, signer);
  const tB = new ethers.Contract(tokenB, basicERC20Abi, signer);
  
  const decA = Number(await tA.decimals());
  const decB = Number(await tB.decimals());
  
  console.log("Token decimals:", { tokenA: decA, tokenB: decB });

  // Calculate proper sqrtPriceX96 for 1:1 ratio considering decimals
  const Q96 = BigInt(2) ** BigInt(96);
  const Q192 = Q96 * Q96;

  function bigintSqrt(value: bigint): bigint {
    if (value <= 0n) return 0n;
    let x = value;
    let y = (x + 1n) >> 1n;
    while (y < x) {
      x = y;
      y = (x + value / x) >> 1n;
    }
    return x;
  }

  // For 1:1 human price, we need sqrtPriceX96 = sqrt(10^(decB-decA)) * 2^96
  const diff = decB - decA;
  console.log("Decimal difference (B - A):", diff);
  
  let sqrtPriceX96: bigint;
  
  if (diff === 0) {
    sqrtPriceX96 = Q96;
  } else if (diff > 0) {
    // currency1 has more decimals, so 1 unit of currency0 = 10^diff units of currency1
    const ratio = BigInt(10) ** BigInt(diff);
    sqrtPriceX96 = bigintSqrt(ratio * Q192);
  } else {
    // currency0 has more decimals, so 1 unit of currency0 = 10^(-diff) units of currency1
    const inv = BigInt(10) ** BigInt(-diff);
    sqrtPriceX96 = bigintSqrt(Q192 / inv);
  }
  
  console.log("Calculated sqrtPriceX96 for 1:1 ratio:", sqrtPriceX96.toString());

  // Test with different pool configurations
  const poolConfigs = [
    { fee: 100, tickSpacing: 1 },
    { fee: 500, tickSpacing: 10 },
    { fee: 3000, tickSpacing: 60 },
    { fee: 10000, tickSpacing: 200 },
  ];

  for (const config of poolConfigs) {
    console.log(`\n=== Testing Pool Config: fee=${config.fee}, tickSpacing=${config.tickSpacing} ===`);
    
    const key = {
      currency0: tokenA < tokenB ? tokenA : tokenB,
      currency1: tokenA < tokenB ? tokenB : tokenA,
      fee: config.fee,
      tickSpacing: config.tickSpacing,
      hooks: ethers.ZeroAddress,
    };
    
    console.log("PoolKey:", key);
    
    const poolId = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks]
    ));
    
    console.log("PoolId:", poolId);

    // Check if pool exists
    try {
      const slot0 = await pm["extsload(bytes32)"](poolId);
      console.log("Pool slot0:", slot0);
      if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log("✓ Pool already exists and is initialized");
        continue;
      }
    } catch (e: any) {
      console.log("Pool does not exist");
    }

    // Try to initialize with calculated sqrtPriceX96
    try {
      console.log("Trying to initialize with calculated sqrtPriceX96...");
      
      // Try static call first
      try {
        await pm.initialize.staticCall(key, sqrtPriceX96);
        console.log("✓ Static call succeeded");
      } catch (e: any) {
        console.log("✗ Static call failed:", e?.error?.message || e?.message || e);
        continue;
      }
      
      // Try actual initialization
      const tx = await pm.initialize(key, sqrtPriceX96);
      console.log("Transaction hash:", tx.hash);
      const receipt = await tx.wait();
      console.log("✓ Pool initialized successfully!");
      console.log("Gas used:", receipt?.gasUsed?.toString());
      
      // Check if pool is now properly initialized
      try {
        const slot0 = await pm["extsload(bytes32)"](poolId);
        console.log("New slot0:", slot0);
        
        if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
          console.log("✓ Pool is now properly initialized!");
          
          // Try to add liquidity
          console.log("Attempting to add liquidity...");
          
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
            console.log("✓ modifyLiquidity static call succeeded");
          } catch (e: any) {
            console.log("✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
            continue;
          }
          
          // Try actual liquidity addition
          const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
          console.log("Liquidity transaction hash:", liquidityTx.hash);
          const liquidityReceipt = await liquidityTx.wait();
          console.log("✓ Liquidity added successfully!");
          console.log("Gas used:", liquidityReceipt?.gasUsed?.toString());
          
          console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
          return;
          
        } else {
          console.log("✗ Pool slot0 is still zero after initialization");
        }
        
      } catch (e: any) {
        console.log("✗ Failed to check pool state after initialization:", e?.error?.message || e?.message || e);
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
  
  console.log("\n✗ All pool configurations failed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
