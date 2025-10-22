"use client";

import AddLiquidity from "../../components/AddLiquidity";
import { Navigation } from "../../components/Navigation";
import LayoutWrapper from "../../components/LayoutWrapper";

export default function LiquidityPage() {
  return (
    <LayoutWrapper>
      <div className="min-h-screen flex flex-col bg-background">
        <Navigation />
        <AddLiquidity />
      </div>
    </LayoutWrapper>
  );
}
