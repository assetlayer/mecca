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

  // Check token balances and allowances
  console.log("\n=== Token Status ===");
  
  try {
    const balA = await tA.balanceOf(me);
    const balB = await tB.balanceOf(me);
    console.log("Token balances:", { balA: balA.toString(), balB: balB.toString() });
    
    const allowanceA = await tA.allowance(me, poolManagerAddress);
    const allowanceB = await tB.allowance(me, poolManagerAddress);
    console.log("Token allowances to PoolManager:", { 
      allowanceA: allowanceA.toString(), 
      allowanceB: allowanceB.toString() 
    });
  } catch (e: any) {
    console.log("Failed to get token status:", e?.error?.message || e?.message || e);
  }

  // Approve PoolManager to spend tokens
  console.log("\n=== Approving PoolManager ===");
  
  try {
    console.log("Approving tokenA...");
    const txA = await tA.approve(poolManagerAddress, ethers.MaxUint256);
    await txA.wait();
    console.log("✓ TokenA approved");
    
    console.log("Approving tokenB...");
    const txB = await tB.approve(poolManagerAddress, ethers.MaxUint256);
    await txB.wait();
    console.log("✓ TokenB approved");
  } catch (e: any) {
    console.log("Failed to approve tokens:", e?.error?.message || e?.message || e);
  }

  // Test pool initialization
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 3000,
    tickSpacing: 60,
    hooks: ethers.ZeroAddress,
  };
  
  console.log("\n=== Testing Pool Initialization ===");
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

  // Try to initialize with a very simple sqrtPriceX96
  try {
    const sqrtP = 79228162514264337593543950336n; // 2^96
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
    
    // Check if pool is now properly initialized
    try {
      const slot0 = await pm["extsload(bytes32)"](poolId);
      console.log("New slot0:", slot0);
      
      // Try to add liquidity
      console.log("\n=== Attempting to Add Liquidity ===");
      
      const MIN_TICK = -60;
      const MAX_TICK = 60;
      const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
      
      const mlParams = {
        tickLower: MIN_TICK,
        tickUpper: MAX_TICK,
        liquidityDelta: liquidityAmount,
        salt: ethers.ZeroHash,
      };
      
      console.log("Liquidity params:", mlParams);
      
      // Try static call first
      try {
        await pm.modifyLiquidity.staticCall(key, mlParams, "0x");
        console.log("✓ modifyLiquidity static call succeeded");
      } catch (e: any) {
        console.log("✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
      }
      
      // Try actual liquidity addition
      const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
      console.log("Liquidity transaction hash:", liquidityTx.hash);
      const liquidityReceipt = await liquidityTx.wait();
      console.log("✓ Liquidity added successfully!");
      console.log("Gas used:", liquidityReceipt?.gasUsed?.toString());
      
      console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
      
    } catch (e: any) {
      console.log("✗ Failed to add liquidity:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    const msg = (e?.error?.message || e?.message || "").toLowerCase();
    if (msg.includes("already initialized")) {
      console.log("✓ Pool already initialized");
      
      // Try to add liquidity to existing pool
      console.log("\n=== Attempting to Add Liquidity to Existing Pool ===");
      
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
        
        console.log("Liquidity params:", mlParams);
        
        // Try static call first
        try {
          await pm.modifyLiquidity.staticCall(key, mlParams, "0x");
          console.log("✓ modifyLiquidity static call succeeded");
        } catch (e: any) {
          console.log("✗ modifyLiquidity static call failed:", e?.error?.message || e?.message || e);
        }
        
        // Try actual liquidity addition
        const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
        console.log("Liquidity transaction hash:", liquidityTx.hash);
        const liquidityReceipt = await liquidityTx.wait();
        console.log("✓ Liquidity added successfully!");
        console.log("Gas used:", liquidityReceipt?.gasUsed?.toString());
        
        console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
        
      } catch (e: any) {
        console.log("✗ Failed to add liquidity to existing pool:", e?.error?.message || e?.message || e);
      }
      
    } else {
      console.log("✗ Pool initialization failed:", e?.error?.message || e?.message || e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
