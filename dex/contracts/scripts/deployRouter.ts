import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const addressesPath = path.resolve(__dirname, "../../frontend/lib/addresses.json");

interface AddressBook {
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

async function main() {
  const poolManager = process.env.POOL_MANAGER_ADDRESS;
  if (!poolManager) {
    throw new Error("Missing required env var: POOL_MANAGER_ADDRESS");
  }

  const routerFactory = await ethers.getContractFactory("MinimalSwapRouterV4");
  const router = await routerFactory.deploy(poolManager);
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log(`MinimalSwapRouterV4 deployed: ${routerAddress}`);

  const existing = readAddresses();
  existing.MINIMAL_SWAP_ROUTER = routerAddress;
  writeAddresses(existing);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
