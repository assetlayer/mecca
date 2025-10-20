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

  console.log("=== PoolManager Contract Debug ===");
  
  // Check basic contract state
  try {
    const owner = await pm.owner();
    console.log("✓ PoolManager owner:", owner);
    console.log("✓ Our address:", me);
    console.log("✓ Are we owner?", owner.toLowerCase() === me.toLowerCase());
  } catch (e: any) {
    console.error("✗ Failed to get owner:", e?.error?.message || e?.message || e);
  }

  // Check if there are any special requirements
  console.log("\n=== Checking Contract State ===");
  
  // Check if the contract is properly initialized
  try {
    const protocolFeeController = await pm.protocolFeeController();
    console.log("✓ Protocol fee controller:", protocolFeeController);
  } catch (e: any) {
    console.error("✗ Failed to get protocol fee controller:", e?.error?.message || e?.message || e);
  }

  // Check if there are any fee requirements
  try {
    const protocolFee = await pm.protocolFee();
    console.log("✓ Protocol fee:", protocolFee);
  } catch (e: any) {
    console.log("No protocolFee() function");
  }

  // Check if there are any initialization requirements
  try {
    const initialized = await pm.initialized();
    console.log("✓ Contract initialized:", initialized);
  } catch (e: any) {
    console.log("No initialized() function");
  }

  // Try to understand why initialize is failing
  console.log("\n=== Debugging Initialize Function ===");
  
  const key = {
    currency0: tokenA < tokenB ? tokenA : tokenB,
    currency1: tokenA < tokenB ? tokenB : tokenA,
    fee: 10000,
    tickSpacing: 200,
    hooks: ethers.ZeroAddress,
  };

  console.log("PoolKey:", key);

  // Try to get more detailed error information
  try {
    const sqrtP = ethers.parseUnits("1", 0) * (2n ** 96n);
    console.log("Trying to estimate gas for initialize...");
    
    const gasEstimate = await pm.initialize.estimateGas(key, sqrtP);
    console.log("✓ Gas estimate:", gasEstimate.toString());
    
    // Try with higher gas limit
    console.log("Trying with higher gas limit...");
    const tx = await pm.initialize(key, sqrtP, { gasLimit: gasEstimate * 2n });
    await tx.wait();
    console.log("✓ Pool initialized successfully!");
    
  } catch (e: any) {
    console.error("✗ Initialize failed:", e?.error?.message || e?.message || e);
    
    // Try to decode the error
    if (e?.error?.data) {
      console.log("Error data:", e.error.data);
    }
    
    // Check if it's a specific error
    const errorMsg = (e?.error?.message || e?.message || "").toLowerCase();
    if (errorMsg.includes("currenciesoutoforderorequal")) {
      console.log("❌ Error: Currencies are out of order or equal");
    } else if (errorMsg.includes("invalidcaller")) {
      console.log("❌ Error: Invalid caller - still permission issue");
    } else if (errorMsg.includes("managerlocked")) {
      console.log("❌ Error: Manager is locked");
    } else if (errorMsg.includes("delegatecallnotallowed")) {
      console.log("❌ Error: Delegate call not allowed");
    } else {
      console.log("❌ Unknown error:", errorMsg);
    }
  }

  // Try a different approach - maybe the issue is with the token addresses
  console.log("\n=== Token Address Validation ===");
  
  try {
    const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
    const tB = await ethers.getContractAt("IERC20Minimal", tokenB);
    
    const nameA = await tA.name();
    const nameB = await tB.name();
    const symbolA = await tA.symbol();
    const symbolB = await tB.symbol();
    const decimalsA = await tA.decimals();
    const decimalsB = await tB.decimals();
    
    console.log("TokenA:", { name: nameA, symbol: symbolA, decimals: decimalsA });
    console.log("TokenB:", { name: nameB, symbol: symbolB, decimals: decimalsB });
    
    // Check if tokens are the same
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      console.log("❌ Error: TokenA and TokenB are the same address!");
    } else {
      console.log("✓ Tokens are different addresses");
    }
    
  } catch (e: any) {
    console.error("✗ Failed to validate tokens:", e?.error?.message || e?.message || e);
  }

  // Try to check if there are any network-specific issues
  console.log("\n=== Network Debug ===");
  
  try {
    const network = await ethers.provider.getNetwork();
    const blockNumber = await ethers.provider.getBlockNumber();
    const balance = await ethers.provider.getBalance(me);
    
    console.log("✓ Network:", network);
    console.log("✓ Block number:", blockNumber);
    console.log("✓ ETH balance:", ethers.formatEther(balance));
    
  } catch (e: any) {
    console.error("✗ Network debug failed:", e?.error?.message || e?.message || e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
