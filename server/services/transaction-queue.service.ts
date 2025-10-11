/**
 * Transaction Queue Service
 * Manages pending transactions awaiting user approval
 */

import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { logger } from "../utils/logger";
import { ValidationError } from "../utils/errors";
import storage from "../storage";
import { getConnection } from "../solana/connection";
//import { getConnection } from "../solana/connection";

export interface PendingTransaction {
  id: string;
  type: "rebalance" | "stop-loss" | "close-position";
  positionAddress: string;
  walletAddress: string;
  transaction: string; // Base64 encoded transaction
  metadata: {
    poolAddress: string;
    oldRange?: { lowerBinId: number; upperBinId: number };
    newRange?: { lowerBinId: number; upperBinId: number };
    reason: string;
    estimatedValue?: number;
    volatility?: number;
  };
  status: "pending" | "approved" | "rejected" | "executed" | "failed";
  createdAt: number;
  expiresAt: number;
  approvedAt?: number;
  executedAt?: number;
  signature?: string;
  error?: string;
}

export class TransactionQueueService {
  private queue: Map<string, PendingTransaction>;
  private readonly EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    this.queue = new Map();
    this.loadFromStorage();
    this.startCleanupInterval();
    logger.info("Transaction Queue Service initialized");
  }

  /**
   * Add a transaction to the queue
   */
  async queueTransaction(
    type: PendingTransaction["type"],
    positionAddress: string,
    walletAddress: string,
    transaction: Transaction | VersionedTransaction,
    metadata: PendingTransaction["metadata"]
  ): Promise<PendingTransaction> {
    try {
      const id = this.generateId();
      const now = Date.now();

      // Serialize transaction to base64
      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const transactionBase64 = Buffer.from(serialized).toString("base64");

      const pendingTx: PendingTransaction = {
        id,
        type,
        positionAddress,
        walletAddress,
        transaction: transactionBase64,
        metadata,
        status: "pending",
        createdAt: now,
        expiresAt: now + this.EXPIRY_MS,
      };

      this.queue.set(id, pendingTx);
      this.saveToStorage();

      logger.info("Transaction queued", {
        id,
        type,
        positionAddress,
        walletAddress,
      });

      return pendingTx;
    } catch (error: any) {
      logger.error("Failed to queue transaction", {
        type,
        positionAddress,
        error: error.message,
      });
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Get pending transactions for a wallet
   */
  getPendingTransactions(walletAddress: string): PendingTransaction[] {
    return Array.from(this.queue.values())
      .filter(
        (tx) =>
          tx.walletAddress === walletAddress &&
          tx.status === "pending" &&
          tx.expiresAt > Date.now()
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get all pending transactions (admin view)
   */
  getAllPending(): PendingTransaction[] {
    return Array.from(this.queue.values())
      .filter((tx) => tx.status === "pending" && tx.expiresAt > Date.now())
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): PendingTransaction | undefined {
    return this.queue.get(id);
  }

  /**
   * Approve a transaction
   */
  async approveTransaction(
    id: string
  ): Promise<{ success: boolean; data?: PendingTransaction; error?: string }> {
    try {
      const tx = this.queue.get(id);
      if (!tx) {
        return { success: false, error: `Transaction not found: ${id}` };
      }

      if (tx.status !== "pending") {
        return {
          success: false,
          error: `Transaction is not pending: ${tx.status}`,
        };
      }

      if (tx.expiresAt < Date.now()) {
        return { success: false, error: "Transaction has expired" };
      }

      tx.status = "approved";
      tx.approvedAt = Date.now();
      this.queue.set(id, tx);
      this.saveToStorage();

      logger.info("Transaction approved", { id });
      return { success: true, data: tx };
    } catch (error: any) {
      logger.error("Failed to approve transaction", {
        id,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject a transaction
   */
  async rejectTransaction(
    id: string
  ): Promise<{ success: boolean; data?: PendingTransaction; error?: string }> {
    try {
      const tx = this.queue.get(id);
      if (!tx) {
        return { success: false, error: `Transaction not found: ${id}` };
      }

      if (tx.status !== "pending") {
        return {
          success: false,
          error: `Transaction is not pending: ${tx.status}`,
        };
      }

      tx.status = "rejected";
      this.queue.set(id, tx);
      this.saveToStorage();

      logger.info("Transaction rejected", { id });
      return { success: true, data: tx };
    } catch (error: any) {
      logger.error("Failed to reject transaction", {
        id,
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  }

  /**
   * Mark transaction as executed
   */
  async markExecuted(
    id: string,
    signature: string
  ): Promise<PendingTransaction> {
    const tx = this.queue.get(id);
    if (!tx) {
      throw new ValidationError(`Transaction not found: ${id}`);
    }

    tx.status = "executed";
    tx.executedAt = Date.now();
    tx.signature = signature;
    this.queue.set(id, tx);
    this.saveToStorage();

    logger.info("Transaction executed", { id, signature });
    return tx;
  }

  /**
   * Mark transaction as failed
   */
  async markFailed(id: string, error: string): Promise<PendingTransaction> {
    const tx = this.queue.get(id);
    if (!tx) {
      throw new ValidationError(`Transaction not found: ${id}`);
    }

    tx.status = "failed";
    tx.error = error;
    this.queue.set(id, tx);
    this.saveToStorage();

    logger.error("Transaction failed", { id, error });
    return tx;
  }

  /**
   * Get transaction history for a position
   */
  getPositionHistory(positionAddress: string): PendingTransaction[] {
    return Array.from(this.queue.values())
      .filter((tx) => tx.positionAddress === positionAddress)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Clean up expired transactions
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, tx] of this.queue.entries()) {
      if (tx.expiresAt < now && tx.status === "pending") {
        this.queue.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info("Cleaned up expired transactions", { count: cleaned });
      this.saveToStorage();
    }
  }

  /**
   * Start cleanup interval
   */
  private startCleanupInterval(): void {
    setInterval(
      () => {
        this.cleanupExpired();
      },
      60 * 60 * 1000
    ); // Every hour
  }

  /**
   * Generate unique transaction ID
   */
  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load queue from storage
   */
  private loadFromStorage(): void {
    try {
      const data = storage.get("transactionQueue");
      if (data && Array.isArray(data)) {
        this.queue = new Map(data.map((tx: PendingTransaction) => [tx.id, tx]));
        logger.info("Loaded transaction queue from storage", {
          count: this.queue.size,
        });
      }
    } catch (error: any) {
      logger.error("Failed to load transaction queue", {
        error: error.message,
      });
    }
  }

  /**
   * Save queue to storage
   */
  private saveToStorage(): void {
    try {
      const data = Array.from(this.queue.values());
      storage.set("transactionQueue", data);
    } catch (error: any) {
      logger.error("Failed to save transaction queue", {
        error: error.message,
      });
    }
  }

  /**
   * Execute a signed transaction
   */
  async executeTransaction(
    id: string,
    signedTransaction: string
  ): Promise<{
    success: boolean;
    data?: { signature: string };
    error?: string;
  }> {
    try {
      const tx = this.queue.get(id);
      if (!tx) {
        return { success: false, error: `Transaction not found: ${id}` };
      }

      if (tx.status !== "approved") {
        return {
          success: false,
          error: `Transaction is not approved: ${tx.status}`,
        };
      }

      // Deserialize and send the signed transaction
      const buffer = Buffer.from(signedTransaction, "base64");
      const transaction = Transaction.from(buffer);

      // Send transaction to Solana network
      const connection = getConnection();
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );

      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");

      // Mark as executed
      await this.markExecuted(id, signature);

      logger.info("Transaction executed successfully", { id, signature });
      return { success: true, data: { signature } };
    } catch (error: any) {
      logger.error("Failed to execute transaction", {
        id,
        error: error.message,
      });
      await this.markFailed(id, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get queue statistics
   */
  getStats() {
    const all = Array.from(this.queue.values());
    return {
      total: all.length,
      pending: all.filter((tx) => tx.status === "pending").length,
      approved: all.filter((tx) => tx.status === "approved").length,
      executed: all.filter((tx) => tx.status === "executed").length,
      failed: all.filter((tx) => tx.status === "failed").length,
      rejected: all.filter((tx) => tx.status === "rejected").length,
    };
  }
}

// Export singleton instance
export const transactionQueueService = new TransactionQueueService();
