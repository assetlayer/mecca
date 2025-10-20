"use client";

import { Listbox } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon } from "@heroicons/react/24/solid";
import type { TokenInfo } from "@/lib/tokens";
import { Fragment } from "react";

interface TokenSelectProps {
  tokens: TokenInfo[];
  value?: TokenInfo;
  onChange: (token: TokenInfo) => void;
  label: string;
}

export function TokenSelect({ tokens, value, onChange, label }: TokenSelectProps) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-gray-300">{label}</span>
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button className="w-full bg-surface border border-border rounded-xl px-4 py-3 flex justify-between items-center">
            <span className="flex items-center gap-3">
              <span className="font-semibold">{value ? value.symbol : "Select"}</span>
              <span className="text-xs text-gray-400">{value?.name}</span>
            </span>
            <ChevronUpDownIcon className="w-5 h-5 text-gray-400" />
          </Listbox.Button>
          <Listbox.Options className="absolute mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-xl z-10">
            {tokens.map((token) => (
              <Listbox.Option key={token.address} value={token} as={Fragment}>
                {({ active, selected }) => (
                  <li
                    className={`px-4 py-2 cursor-pointer flex justify-between ${
                      active ? "bg-accent/20" : ""
                    }`}
                  >
                    <span>
                      <span className="font-medium">{token.symbol}</span>
                      <span className="text-xs text-gray-400 ml-2">{token.name}</span>
                    </span>
                    {selected && <CheckIcon className="w-4 h-4 text-accent" />}
                  </li>
                )}
              </Listbox.Option>
            ))}
          </Listbox.Options>
        </div>
      </Listbox>
    </div>
  );
}
