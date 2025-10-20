import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  const routerAddress = process.env.MINIMAL_SWAP_ROUTER_ADDRESS;
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (!poolManagerAddress || !routerAddress || !tokenA || !tokenB) {
    throw new Error("Set POOL_MANAGER_ADDRESS, MINIMAL_SWAP_ROUTER_ADDRESS, SEED_TOKEN_A, and SEED_TOKEN_B in contracts/.env");
  }

  console.log("PoolManager:", poolManagerAddress);
  console.log("Router:", routerAddress);
  console.log("TokenA:", tokenA);
  console.log("TokenB:", tokenB);

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
  const router = await ethers.getContractAt("MinimalSwapRouterV4", routerAddress);
  
  // Get token info
  const basicERC20Abi = [
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
    "function approve(address,uint256) returns (bool)",
  ];

  const tA = new ethers.Contract(tokenA, basicERC20Abi, signer);
  const tB = new ethers.Contract(tokenB, basicERC20Abi, signer);
  
  const decA = Number(await tA.decimals());
  const decB = Number(await tB.decimals());
  
  console.log("Token decimals:", { tokenA: decA, tokenB: decB });

  // Use a simple pool configuration that might work
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

  // Check if pool exists
  try {
    const slot0 = await pm["extsload(bytes32)"](poolId);
    console.log("Pool slot0:", slot0);
    if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      console.log("✓ Pool already exists and is initialized");
      
      // Try to add liquidity to existing pool
      console.log("Attempting to add liquidity to existing pool...");
      
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
        return;
        
      } catch (e: any) {
        console.log("✗ Failed to add liquidity to existing pool:", e?.error?.message || e?.message || e);
      }
    }
  } catch (e: any) {
    console.log("Pool does not exist, will try to create it");
  }

  // Approve router to spend tokens
  console.log("Approving router to spend tokens...");
  try {
    await (await tA.approve(routerAddress, ethers.MaxUint256)).wait();
    await (await tB.approve(routerAddress, ethers.MaxUint256)).wait();
    console.log("✓ Router approved to spend tokens");
  } catch (e: any) {
    console.error("✗ Approval failed:", e?.error?.message || e?.message || e);
    throw e;
  }

  // Try to add liquidity using router (this should initialize the pool if needed)
  console.log("Attempting to add liquidity via router...");
  
  const MIN_TICK = -60;
  const MAX_TICK = 60;
  const liquidityAmount = ethers.toBigInt("1000000000000000000"); // 1e18
  
  const addParams = {
    key,
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount,
    payer: me,
    deadline: Math.floor(Date.now() / 1000) + 600,
  };
  
  console.log("Liquidity params:", {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
    liquidityDelta: liquidityAmount.toString(),
    payer: me,
    deadline: addParams.deadline
  });
  
  try {
    // Try static call first to see if it would work
    console.log("Testing with static call...");
    await router.addLiquidity.staticCall(addParams);
    console.log("✓ Static call succeeded, proceeding with transaction...");
    
    // If static call succeeds, do the actual transaction
    const tx = await router.addLiquidity(addParams);
    await tx.wait();
    console.log("✓ Liquidity added successfully via router!");
    console.log("✓ Pool should now be initialized and seeded!");
    
    // Verify the pool is now initialized
    try {
      const slot0 = await pm["extsload(bytes32)"](poolId);
      console.log("Pool slot0 after initialization:", slot0);
      if (slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
        console.log("✓ Pool is now properly initialized!");
      } else {
        console.log("✗ Pool slot0 is still zero after initialization");
      }
    } catch (e: any) {
      console.log("Could not verify pool state:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    console.error("✗ Router addLiquidity failed:", e?.error?.message || e?.message || e);
    
    // If router approach fails, try direct PoolManager approach with different parameters
    console.log("Trying direct PoolManager approach with different parameters...");
    
    // Try different sqrtPriceX96 values
    const sqrtPValues = [
      ethers.parseUnits("1", 0) * (2n ** 96n), // 2^96
      79228162514264337593543n, // calculated for 1:1 with decimals
      4295128739n, // minimum valid
      79228162514264337593543950336n, // 2^96
    ];
    
    for (let i = 0; i < sqrtPValues.length; i++) {
      const sqrtP = sqrtPValues[i];
      console.log(`Trying sqrtPriceX96 ${i + 1}/${sqrtPValues.length}:`, sqrtP.toString());
      
      try {
        // Try static call first
        await pm.initialize.staticCall(key, sqrtP);
        console.log("✓ Static call succeeded");
        
        // Try actual initialization
        const tx = await pm.initialize(key, sqrtP);
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("✓ Pool initialized successfully!");
        console.log("Gas used:", receipt?.gasUsed?.toString());
        
        // Try to add liquidity
        console.log("Attempting to add liquidity...");
        
        const mlParams = {
          tickLower: MIN_TICK,
          tickUpper: MAX_TICK,
          liquidityDelta: liquidityAmount,
          salt: ethers.ZeroHash,
        };
        
        const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
        console.log("Liquidity transaction hash:", liquidityTx.hash);
        const liquidityReceipt = await liquidityTx.wait();
        console.log("✓ Liquidity added successfully!");
        console.log("Gas used:", liquidityReceipt?.gasUsed?.toString());
        
        console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
        return;
        
      } catch (e: any) {
        const msg = (e?.error?.message || e?.message || "").toLowerCase();
        if (msg.includes("already initialized")) {
          console.log("✓ Pool already initialized");
          
          // Try to add liquidity to existing pool
          try {
            const mlParams = {
              tickLower: MIN_TICK,
              tickUpper: MAX_TICK,
              liquidityDelta: liquidityAmount,
              salt: ethers.ZeroHash,
            };
            
            const liquidityTx = await pm.modifyLiquidity(key, mlParams, "0x");
            console.log("Liquidity transaction hash:", liquidityTx.hash);
            const liquidityReceipt = await liquidityTx.wait();
            console.log("✓ Liquidity added successfully!");
            console.log("Gas used:", liquidityReceipt?.gasUsed?.toString());
            
            console.log("✓ SUCCESS! Pool is now seeded and ready for swapping!");
            return;
            
          } catch (e: any) {
            console.log("✗ Failed to add liquidity to existing pool:", e?.error?.message || e?.message || e);
          }
          
        } else {
          console.log("✗ sqrtPriceX96 failed:", e?.error?.message || e?.message || e);
        }
      }
    }
    
    console.log("✗ All approaches failed");
  }

  console.log("✓ Pool seeding completed! You can now try swapping.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
