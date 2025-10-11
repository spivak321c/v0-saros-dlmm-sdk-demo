import { createContext, useContext, useState, ReactNode } from "react";

interface VolatilityData {
  poolAddress: string;
  volatility: number;
  priceChange24h: number;
  timestamp: number;
  tokenX?: { symbol: string };
  tokenY?: { symbol: string };
}

interface Pool {
  address: string;
  tokenX: { symbol: string; mint: string };
  tokenY: { symbol: string; mint: string };
  currentPrice: number;
}

interface VolatilityContextType {
  pools: Pool[];
  volatilityData: Map<string, VolatilityData>;
  setPools: React.Dispatch<React.SetStateAction<Pool[]>>;
  setVolatilityData: (data: Map<string, VolatilityData>) => void;
  updateVolatilityForPool: (poolAddress: string, data: VolatilityData) => void;
}

const VolatilityContext = createContext<VolatilityContextType | undefined>(
  undefined
);

export function VolatilityProvider({ children }: { children: ReactNode }) {
  const [pools, setPools] = useState<Pool[]>([]);
  const [volatilityData, setVolatilityData] = useState<
    Map<string, VolatilityData>
  >(new Map());

  const updateVolatilityForPool = (
    poolAddress: string,
    data: VolatilityData
  ) => {
    setVolatilityData((prev) => {
      const newMap = new Map(prev);
      newMap.set(poolAddress, data);
      return newMap;
    });
  };

  return (
    <VolatilityContext.Provider
      value={{
        pools,
        volatilityData,
        setPools,
        setVolatilityData,
        updateVolatilityForPool,
      }}
    >
      {children}
    </VolatilityContext.Provider>
  );
}

export function useVolatility() {
  const context = useContext(VolatilityContext);
  if (context === undefined) {
    throw new Error("useVolatility must be used within a VolatilityProvider");
  }
  return context;
}
