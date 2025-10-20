import { ethers } from "hardhat";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const [defaultSigner] = await ethers.getSigners();
  const defaultAddress = await defaultSigner.getAddress();

  const owner = process.env.POOL_MANAGER_OWNER || defaultAddress;
  const protocolFeeController =
    process.env.POOL_MANAGER_PROTOCOL_FEE_CONTROLLER || owner;
  const initialTimestamp = parseUintEnv("POOL_MANAGER_INITIAL_TIMESTAMP", 0n);

  const poolManagerFactory = await ethers.getContractFactory("PoolManager");

  const constructorFragment = poolManagerFactory.interface.fragments.find(
    (fragment) => fragment.type === "constructor"
  );

  const constructorInputs = constructorFragment?.inputs ?? [];

  const args = constructorInputs.map((input) => {
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

  const poolManager = await poolManagerFactory.deploy(...args);
  await poolManager.waitForDeployment();
  const poolManagerAddress = await poolManager.getAddress();

  console.log("PoolManager deployment complete:");
  console.log(`  address: ${poolManagerAddress}`);
  console.log(`  owner: ${owner}`);
  console.log(`  protocolFeeController: ${protocolFeeController}`);
  console.log(`  initialTimestamp: ${initialTimestamp.toString()}`);

  const existing = readAddresses();
  existing.POOL_MANAGER = poolManagerAddress;
  writeAddresses(existing);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
