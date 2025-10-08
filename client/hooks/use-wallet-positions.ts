import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import type { PositionData, ApiResponse } from '../../shared/schema';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useWalletPositions() {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['positions', publicKey?.toString()],
    queryFn: async (): Promise<PositionData[]> => {
      if (!publicKey) return [];

      const response = await fetch(`${API_URL}/positions/${publicKey.toString()}`);
      const data: ApiResponse<PositionData[]> = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.error || 'Failed to fetch positions');
      }

      return data.data;
    },
    enabled: !!publicKey,
  });
}

export function usePositionDetail(address: string | undefined) {
  return useQuery({
    queryKey: ['position', address],
    queryFn: async (): Promise<PositionData | null> => {
      if (!address) return null;

      const response = await fetch(`${API_URL}/positions/detail/${address}`);
      const data: ApiResponse<PositionData> = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch position');
      }

      return data.data || null;
    },
    enabled: !!address,
  });
}
