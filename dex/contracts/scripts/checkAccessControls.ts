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

  console.log("=== Access Control Investigation ===");
  
  // Check if we can call other functions that might not require ownership
  try {
    const owner = await pm.owner();
    console.log("✓ Can call owner() - no access control");
  } catch (e: any) {
    console.error("✗ Cannot call owner():", e?.error?.message || e?.message || e);
  }

  try {
    const protocolFeeController = await pm.protocolFeeController();
    console.log("✓ Can call protocolFeeController() - no access control");
  } catch (e: any) {
    console.error("✗ Cannot call protocolFeeController():", e?.error?.message || e?.message || e);
  }

  // Try to call sync (should not require ownership)
  try {
    await (await pm.sync(tokenA)).wait();
    console.log("✓ Can call sync() - no access control");
  } catch (e: any) {
    console.error("✗ Cannot call sync():", e?.error?.message || e?.message || e);
  }

  // Check if there are any role-based access controls
  console.log("\n=== Role-based Access Control Check ===");
  
  // Try to check if there are any role functions
  const roleFunctions = [
    'hasRole',
    'getRoleAdmin',
    'DEFAULT_ADMIN_ROLE',
    'POOL_MANAGER_ROLE',
    'INITIALIZER_ROLE'
  ];

  for (const func of roleFunctions) {
    try {
      if (typeof pm[func] === 'function') {
        console.log(`✓ Function ${func} exists`);
        // Try to call it if it's a view function
        if (func.includes('ROLE') || func === 'hasRole') {
          try {
            const result = await pm[func]();
            console.log(`  ${func}():`, result);
          } catch (e: any) {
            console.log(`  ${func}() failed:`, e?.error?.message || e?.message || e);
          }
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

  // Try to check if we need to pay fees to initialize
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
