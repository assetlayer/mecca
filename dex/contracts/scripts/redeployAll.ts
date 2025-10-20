import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const addressesPath = path.resolve(__dirname, "../../frontend/lib/addresses.json");

interface AddressBook {
  POOL_MANAGER?: string;
  ASSET_LAYER_SWAP_HOOK?: string;
  MINIMAL_SWAP_ROUTER?: string;
}

function readAddresses(): AddressBook {
  if (fs.existsSync(addressesPath)) {
    const raw = fs.readFileSync(addressesPath, "utf8");
    return JSON.parse(raw);
  }
  return {};
}

function writeAddresses(addresses: AddressBook) {
  fs.mkdirSync(path.dirname(addressesPath), { recursive: true });
  fs.writeFileSync(addressesPath, JSON.stringify(addresses, null, 2));
}

function parseUintEnv(name: string, fallback: bigint): bigint {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  try {
    const value = BigInt(raw);
    if (value < 0n) {
      throw new Error("value must be non-negative");
    }
    return value;
  } catch (error) {
    throw new Error(`Invalid numeric value for ${name}: ${raw}`);
  }
}

async function main() {
  console.log("🚀 Starting complete contract redeployment...");
  
  const [signer] = await ethers.getSigners();
  const deployerAddress = await signer.getAddress();
  console.log("Deployer address:", deployerAddress);
  
  // Check ETH balance
  const balance = await ethers.provider.getBalance(deployerAddress);
  console.log("ETH balance:", ethers.formatEther(balance));
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low ETH balance. Consider adding more ETH for deployment.");
  }

  // Clear existing addresses
  const addresses: AddressBook = {};
  writeAddresses(addresses);
  console.log("✓ Cleared existing addresses");

  // Step 1: Deploy PoolManager
  console.log("\n📦 Step 1: Deploying PoolManager...");
  
  const owner = process.env.POOL_MANAGER_OWNER || deployerAddress;
  const protocolFeeController = process.env.POOL_MANAGER_PROTOCOL_FEE_CONTROLLER || owner;
  const initialTimestamp = parseUintEnv("POOL_MANAGER_INITIAL_TIMESTAMP", 0n);

  const poolManagerFactory = await ethers.getContractFactory("PoolManager");
  const constructorFragment = poolManagerFactory.interface.fragments.find(
    (fragment) => fragment.type === "constructor"
  );
  const constructorInputs = constructorFragment?.inputs ?? [];

  const poolManagerArgs = constructorInputs.map((input) => {
    const normalized = input.name.toLowerCase();
    if (normalized.includes("timestamp")) {
      return initialTimestamp;
    }
    if (normalized.includes("owner")) {
      return owner;
    }
    if (normalized.includes("controller")) {
      return protocolFeeController;
    }
    throw new Error(`Unhandled constructor parameter: ${input.name}`);
  });

  const poolManager = await poolManagerFactory.deploy(...poolManagerArgs);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();

  console.log("✓ PoolManager deployed:", poolManagerAddress);
  console.log("  Owner:", owner);
  console.log("  Protocol Fee Controller:", protocolFeeController);
  console.log("  Initial Timestamp:", initialTimestamp.toString());

  addresses.POOL_MANAGER = poolManagerAddress;
  writeAddresses(addresses);

  // Step 2: Deploy AssetLayerSwapHook
  console.log("\n🔗 Step 2: Deploying AssetLayerSwapHook...");
  
  const feeRecipient = process.env.PROTOCOL_FEE_RECIPIENT || deployerAddress;
  const feeE6 = process.env.PROTOCOL_FEE_E6 || "2500";

  const hookFactory = await ethers.getContractFactory("AssetLayerSwapHook");
  const hook = await hookFactory.deploy(poolManagerAddress, feeRecipient, BigInt(feeE6));
  await hook.waitForDeployment();
  const hookAddress = await hook.getAddress();

  console.log("✓ AssetLayerSwapHook deployed:", hookAddress);
  console.log("  PoolManager:", poolManagerAddress);
  console.log("  Fee Recipient:", feeRecipient);
  console.log("  Fee E6:", feeE6);

  addresses.ASSET_LAYER_SWAP_HOOK = hookAddress;
  writeAddresses(addresses);

  // Step 3: Deploy MinimalSwapRouterV4
  console.log("\n🛣️  Step 3: Deploying MinimalSwapRouterV4...");
  
  const routerFactory = await ethers.getContractFactory("MinimalSwapRouterV4");
  const router = await routerFactory.deploy(poolManagerAddress);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();

  console.log("✓ MinimalSwapRouterV4 deployed:", routerAddress);
  console.log("  PoolManager:", poolManagerAddress);

  addresses.MINIMAL_SWAP_ROUTER = routerAddress;
  writeAddresses(addresses);

  // Step 4: Update .env file with new addresses
  console.log("\n📝 Step 4: Updating .env file...");
  
  const envPath = path.resolve(__dirname, "../.env");
  let envContent = "";
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Update or add the new addresses
  const envUpdates = [
    `POOL_MANAGER_ADDRESS=${poolManagerAddress}`,
    `MINIMAL_SWAP_ROUTER_ADDRESS=${routerAddress}`,
    `ASSET_LAYER_SWAP_HOOK_ADDRESS=${hookAddress}`,
  ];

  // Remove old addresses and add new ones
  envUpdates.forEach(update => {
    const [key] = update.split('=');
    const regex = new RegExp(`^${key}=.*$`, 'gm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, update);
    } else {
      envContent += `\n${update}`;
    }
  });

  fs.writeFileSync(envPath, envContent);
  console.log("✓ .env file updated");

  // Step 5: Test the new deployment
  console.log("\n🧪 Step 5: Testing new deployment...");
  
  try {
    // Test PoolManager
    const pm = await ethers.getContractAt("PoolManager", poolManagerAddress);
    const pmOwner = await pm.owner();
    console.log("✓ PoolManager owner:", pmOwner);
    
    // Test Router
    const routerContract = await ethers.getContractAt("MinimalSwapRouterV4", routerAddress);
    const routerPoolManager = await routerContract.poolManager();
    console.log("✓ Router PoolManager:", routerPoolManager);
    
    // Test Hook
    const hookContract = await ethers.getContractAt("AssetLayerSwapHook", hookAddress);
    const hookPoolManager = await hookContract.poolManager();
    console.log("✓ Hook PoolManager:", hookPoolManager);
    
    console.log("✓ All contracts are properly connected!");
    
  } catch (error: any) {
    console.error("✗ Error testing contracts:", error?.message || error);
  }

  // Final summary
  console.log("\n🎉 Deployment Complete!");
  console.log("=" * 50);
  console.log("Contract Addresses:");
  console.log(`  PoolManager: ${poolManagerAddress}`);
  console.log(`  Router: ${routerAddress}`);
  console.log(`  Hook: ${hookAddress}`);
  console.log("=" * 50);
  console.log("Next steps:");
  console.log("1. Test pool initialization with: npx hardhat run --network assetlayer scripts/seedPool.ts");
  console.log("2. Start the frontend with: cd ../frontend && npm run dev");
  console.log("3. Update any hardcoded addresses in your code");
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exitCode = 1;
});
