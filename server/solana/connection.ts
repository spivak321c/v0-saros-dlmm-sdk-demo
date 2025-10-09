import { Connection, Commitment } from '@solana/web3.js';

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://api.devnet.solana.com';
const COMMITMENT: Commitment = 'confirmed';

export const connection = new Connection(RPC_ENDPOINT, {
  commitment: COMMITMENT,
  confirmTransactionInitialTimeout: 60000,
});

export const getConnection = () => connection;
