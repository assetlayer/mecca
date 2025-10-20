import type { Address, PublicClient } from "viem";
import { erc20Abi } from "./v4";

export async function fetchAllowance(
  client: PublicClient,
  token: Address,
  owner: Address,
  spender: Address
) {
  return (await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
}

export function needsApproval(current: bigint, required: bigint) {
  return current < required;
}
