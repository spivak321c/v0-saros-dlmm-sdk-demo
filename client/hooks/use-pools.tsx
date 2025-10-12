import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface Pool {
  address: string;
  tokenX: { symbol: string; mint: string; decimals: number };
  tokenY: { symbol: string; mint: string; decimals: number };
  currentPrice: number;
  binStep: number;
  activeId: number;
}

interface PoolsResponse {
  success: boolean;
  data: Pool[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  timestamp: number;
}

export function usePools(page: number = 1, limit: number = 20) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['pools', page, limit],
    queryFn: async (): Promise<PoolsResponse> => {
      const url = `${API_URL}/pools?page=${page}&limit=${limit}`;
      console.log('[usePools] Fetching pools from:', url);
      
      const response = await fetch(url);
      console.log('[usePools] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: PoolsResponse = await response.json();
      console.log('[usePools] Response data:', data);

      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid response format');
      }

      // Filter out invalid pools
      const validPools = data.data.filter((pool: any) => {
        const hasAddress = !!pool?.address;
        const hasTokenX = !!pool?.tokenX;
        const hasTokenY = !!pool?.tokenY;
        const hasValidPrice = typeof pool?.currentPrice === 'number' && !isNaN(pool.currentPrice) && pool.currentPrice > 0;
        
        return hasAddress && hasTokenX && hasTokenY && hasValidPrice;
      });

      console.log('[usePools] Valid pools:', validPools.length, 'of', data.data.length);
      
      return {
        ...data,
        data: validPools,
      };
    },
    staleTime: Infinity, // Never auto-refetch
    refetchInterval: false, // No polling
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}

export function usePool(address: string | undefined) {
  return useQuery({
    queryKey: ['pool', address],
    queryFn: async (): Promise<Pool | null> => {
      if (!address) {
        console.log('[usePool] No address provided');
        return null;
      }

      const url = `${API_URL}/pool/${address}`;
      console.log('[usePool] Fetching pool from:', url);
      
      const response = await fetch(url);
      console.log('[usePool] Response status:', response.status);
      
      const data = await response.json();
      console.log('[usePool] Response data:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch pool');
      }

      console.log('[usePool] Pool loaded:', data.data);
      return data.data || null;
    },
    enabled: !!address,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
