import { ethers } from "hardhat";

async function main() {
  const [signer] = await ethers.getSigners();
  const me = await signer.getAddress();
  console.log("Using address:", me);

  // Get addresses
  const poolManagerAddress = process.env.POOL_MANAGER_ADDRESS;
  
  if (!poolManagerAddress) {
    throw new Error("Set POOL_MANAGER_ADDRESS in contracts/.env");
  }

  console.log("PoolManager:", poolManagerAddress);

  // Create contract
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  // Check basic contract info
  console.log("\n=== Contract Info ===");
  
  try {
    const code = await ethers.provider.getCode(poolManagerAddress);
    console.log("Contract code length:", code.length);
    console.log("Contract deployed:", code !== "0x");
  } catch (e: any) {
    console.log("Failed to get contract code:", e?.error?.message || e?.message || e);
  }

  // Check if we can call basic functions
  console.log("\n=== Basic Function Tests ===");
  
  try {
    const owner = await pm.owner();
    console.log("Owner:", owner);
    console.log("Are we the owner?", owner.toLowerCase() === me.toLowerCase());
  } catch (e: any) {
    console.log("Failed to get owner:", e?.error?.message || e?.message || e);
  }

  try {
    const isOperator = await pm.isOperator(me, me);
    console.log("Are we an operator of ourselves?", isOperator);
  } catch (e: any) {
    console.log("Failed to check operator status:", e?.error?.message || e?.message || e);
  }

  // Check if there are any specific requirements
  console.log("\n=== Checking for Specific Requirements ===");
  
  // Check if we need to pay fees
  try {
    const protocolFee = await pm.protocolFee();
    console.log("Protocol fee:", protocolFee.toString());
  } catch (e: any) {
    console.log("No protocolFee function or error:", e?.error?.message || e?.message || e);
  }

  // Check if there are any initialization requirements
  try {
    const initialized = await pm.initialized();
    console.log("PoolManager initialized:", initialized);
  } catch (e: any) {
    console.log("No initialized function or error:", e?.error?.message || e?.message || e);
  }

  // Check if there are any fee requirements for pool creation
  try {
    const initializeFee = await pm.getInitializeFee();
    console.log("Initialize fee required:", initializeFee.toString());
  } catch (e: any) {
    console.log("No getInitializeFee function or error:", e?.error?.message || e?.message || e);
  }

  // Check if there are any specific requirements for the tokens
  console.log("\n=== Token Requirements ===");
  
  const tokenA = process.env.SEED_TOKEN_A!;
  const tokenB = process.env.SEED_TOKEN_B!;
  
  if (tokenA && tokenB) {
    const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
    const tB = await ethers.getContractAt("IERC20Minimal", tokenB);
    
    try {
      const decA = await tA.decimals();
      const decB = await tB.decimals();
      console.log("Token decimals:", { tokenA: decA, tokenB: decB });
      
      const balA = await tA.balanceOf(me);
      const balB = await tB.balanceOf(me);
      console.log("Token balances:", { tokenA: balA.toString(), tokenB: balB.toString() });
      
      const allowanceA = await tA.allowance(me, poolManagerAddress);
      const allowanceB = await tB.allowance(me, poolManagerAddress);
      console.log("Token allowances:", { tokenA: allowanceA.toString(), tokenB: allowanceB.toString() });
      
    } catch (e: any) {
      console.log("Failed to get token info:", e?.error?.message || e?.message || e);
    }
  }

  // Try to understand why pool initialization is failing
  console.log("\n=== Pool Initialization Debug ===");
  
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
    console.log("Pool exists:", slot0 !== "0x0000000000000000000000000000000000000000000000000000000000000000");
  } catch (e: any) {
    console.log("Pool does not exist or error:", e?.error?.message || e?.message || e);
  }

  // Try to understand what's wrong with initialization
  console.log("\n=== Initialization Debug ===");
  
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    console.log("sqrtPriceX96:", sqrtP.toString());
    
    // Try to understand what's failing
    console.log("Trying to estimate gas for initialize...");
    try {
      const gasEstimate = await pm.initialize.estimateGas(key, sqrtP);
      console.log("Gas estimate:", gasEstimate.toString());
    } catch (e: any) {
      console.log("Gas estimation failed:", e?.error?.message || e?.message || e);
    }
    
    // Try static call to see what happens
    console.log("Trying static call...");
    try {
      await pm.initialize.staticCall(key, sqrtP);
      console.log("Static call succeeded");
    } catch (e: any) {
      console.log("Static call failed:", e?.error?.message || e?.message || e);
    }
    
  } catch (e: any) {
    console.log("Failed to debug initialization:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
