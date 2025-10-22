"use client";

import AddLiquidity from "../../components/AddLiquidity";
import { Navigation } from "../../components/Navigation";

export default function LiquidityPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />
      <AddLiquidity />
    </div>
  );
}
