import { Keypair } from "@solana/web3.js"
import bs58 from "bs58"
import { config } from "../config"

export const getWallet = (): Keypair => {
  try {
    const privateKeyString = config.wallet.privateKey

    // Try base58 decoding first
    try {
      const privateKeyBytes = bs58.decode(privateKeyString)
      return Keypair.fromSecretKey(privateKeyBytes)
    } catch {
      // Try JSON array format
      const privateKeyArray = JSON.parse(privateKeyString)
      return Keypair.fromSecretKey(Uint8Array.from(privateKeyArray))
    }
  } catch (error) {
    throw new Error("Invalid wallet private key format. Use base58 or JSON array format.")
  }
}

export const getWalletPublicKey = (): string => {
  return getWallet().publicKey.toBase58()
}
