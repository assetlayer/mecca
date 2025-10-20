import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const feeRecipient = process.env.PROTOCOL_FEE_RECIPIENT;
  const feeE6 = process.env.PROTOCOL_FEE_E6;

  if (!poolManager || !feeRecipient || !feeE6) {
    throw new Error("Missing required env vars: POOL_MANAGER_ADDRESS, PROTOCOL_FEE_RECIPIENT, PROTOCOL_FEE_E6");
  }

  const hookFactory = await ethers.getContractFactory("AssetLayerSwapHook");
  const hook = await hookFactory.deploy(poolManager, feeRecipient, BigInt(feeE6));
  await hook.waitForDeployment();
  const hookAddress = await hook.getAddress();
  console.log(`AssetLayerSwapHook deployed: ${hookAddress}`);

  const existing = readAddresses();
  existing.ASSET_LAYER_SWAP_HOOK = hookAddress;
  writeAddresses(existing);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
