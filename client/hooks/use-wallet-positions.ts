import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import type { PositionData, ApiResponse } from '../../shared/schema';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function useWalletPositions() {
  const { publicKey } = useWallet();

  return useQuery({
    queryKey: ['positions', publicKey?.toString()],
    queryFn: async (): Promise<PositionData[]> => {
      if (!publicKey) {
        console.log('[useWalletPositions] No wallet connected');
        return [];
      }

      const url = `${API_URL}/positions/${publicKey.toString()}`;
      console.log('[useWalletPositions] Fetching positions from:', url);
      
      const response = await fetch(url);
      console.log('[useWalletPositions] Response status:', response.status);
      
      const data: ApiResponse<PositionData[]> = await response.json();
      console.log('[useWalletPositions] Response data:', data);

      if (!data.success || !data.data) {
        console.error('[useWalletPositions] Failed to fetch positions:', data.error);
        throw new Error(data.error || 'Failed to fetch positions');
      }

      console.log('[useWalletPositions] Positions loaded:', data.data.length);
      return data.data;
    },
    enabled: !!publicKey,
  });
}

export function usePositionDetail(address: string | undefined) {
  return useQuery({
    queryKey: ['position', address],
    queryFn: async (): Promise<PositionData | null> => {
      if (!address) {
        console.log('[usePositionDetail] No address provided');
        return null;
      }

      const url = `${API_URL}/positions/detail/${address}`;
      console.log('[usePositionDetail] Fetching position from:', url);
      
      const response = await fetch(url);
      console.log('[usePositionDetail] Response status:', response.status);
      
      const data: ApiResponse<PositionData> = await response.json();
      console.log('[usePositionDetail] Response data:', data);

      if (!data.success) {
        console.error('[usePositionDetail] Failed to fetch position:', data.error);
        throw new Error(data.error || 'Failed to fetch position');
      }

      console.log('[usePositionDetail] Position loaded:', data.data);
      return data.data || null;
    },
    enabled: !!address,
  });
}
