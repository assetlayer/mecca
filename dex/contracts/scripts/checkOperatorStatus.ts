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

  // Create contracts
  const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);

  console.log("=== Operator Status Check ===");
  
  // Check if we are an operator
  try {
    const owner = await pm.owner();
    console.log("PoolManager owner:", owner);
    console.log("Our address:", me);
    console.log("Are we the owner?", owner.toLowerCase() === me.toLowerCase());
    
    // Check if we are an operator
    const isOperator = await pm.isOperator(owner, me);
    console.log("Are we an operator?", isOperator);
    
    // Check if we are an operator of ourselves
    const isSelfOperator = await pm.isOperator(me, me);
    console.log("Are we an operator of ourselves?", isSelfOperator);
    
    // Check if the owner is an operator of us
    const isOwnerOperator = await pm.isOperator(me, owner);
    console.log("Is owner an operator of us?", isOwnerOperator);
    
  } catch (e: any) {
    console.error("Failed to check operator status:", e?.error?.message || e?.message || e);
  }

  // Check if there are any other access control functions
  console.log("\n=== Access Control Functions ===");
  
  const accessFunctions = [
    'isAuthorized',
    'hasPermission',
    'canCall',
    'isAllowed',
    'isWhitelisted'
  ];

  for (const func of accessFunctions) {
    try {
      if (typeof pm[func] === 'function') {
        console.log(`✓ Function ${func} exists`);
        try {
          const result = await pm[func](me);
          console.log(`  ${func}(${me}):`, result);
        } catch (e: any) {
          console.log(`  ${func}(${me}) failed:`, e?.error?.message || e?.message || e);
        }
      } else {
        console.log(`✗ Function ${func} does not exist`);
      }
    } catch (e: any) {
      console.log(`✗ Error checking ${func}:`, e?.error?.message || e?.message || e);
    }
  }

  // Check if we need to be whitelisted or have special permissions
  console.log("\n=== Permission Check ===");
  
  // Try to check if there are any whitelist functions
  const permissionFunctions = [
    'isWhitelisted',
    'hasPermission',
    'canInitialize',
    'isAuthorized'
  ];

  for (const func of permissionFunctions) {
    try {
      if (typeof pm[func] === 'function') {
        console.log(`✓ Function ${func} exists`);
        try {
          const result = await pm[func](me);
          console.log(`  ${func}(${me}):`, result);
        } catch (e: any) {
          console.log(`  ${func}(${me}) failed:`, e?.error?.message || e?.message || e);
        }
      } else {
        console.log(`✗ Function ${func} does not exist`);
      }
    } catch (e: any) {
      console.log(`✗ Error checking ${func}:`, e?.error?.message || e?.message || e);
    }
  }

  // Check if there are any initialization requirements
  console.log("\n=== Initialization Requirements ===");
  
  // Try to check if the PoolManager needs to be initialized first
  try {
    const initialized = await pm.initialized();
    console.log("PoolManager initialized:", initialized);
  } catch (e: any) {
    console.log("No initialized() function or error:", e?.error?.message || e?.message || e);
  }

  // Check if there are any fee requirements
  try {
    const protocolFee = await pm.protocolFee();
    console.log("Protocol fee:", protocolFee);
  } catch (e: any) {
    console.log("No protocolFee() function or error:", e?.error?.message || e?.message || e);
  }

  // Check if we need to pay fees to initialize
  console.log("\n=== Fee Requirements ===");
  
  // Check if there are any fee payment requirements
  try {
    const feeAmount = await pm.getInitializeFee();
    console.log("Initialize fee required:", feeAmount);
  } catch (e: any) {
    console.log("No getInitializeFee() function or error:", e?.error?.message || e?.message || e);
  }

  // Check if we need to approve the PoolManager to spend our tokens
  console.log("\n=== Token Approval Check ===");
  
  const tokenA = process.env.SEED_TOKEN_A;
  const tokenB = process.env.SEED_TOKEN_B;
  
  if (tokenA && tokenB) {
    const tA = await ethers.getContractAt("IERC20Minimal", tokenA);
    const tB = await ethers.getContractAt("IERC20Minimal", tokenB);
    
    try {
      const allowanceA = await tA.allowance(me, poolManagerAddress);
      const allowanceB = await tB.allowance(me, poolManagerAddress);
      console.log("Token allowances:", {
        tokenA: allowanceA.toString(),
        tokenB: allowanceB.toString()
      });
    } catch (e: any) {
      console.log("Failed to get allowances:", e?.error?.message || e?.message || e);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
