# Transaction Approval Queue Architecture

## Overview

This document describes the architecture for automatic rebalancing with transaction approval queue, designed to solve the fundamental challenge of blockchain automation: **transactions require wallet signatures, which cannot be automated without compromising security**.

## The Problem

Traditional automatic rebalancing faces a critical limitation:
- Blockchain transactions require private key signatures
- Storing user private keys on the server is a **major security risk**
- Wallet popups (e.g., Solflare) require manual user interaction
- True "automatic" execution is impossible without the user's private key

## The Solution: Transaction Approval Queue

Our hybrid approach combines the best of automation and security:

### Architecture Components

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRANSACTION APPROVAL FLOW                    │
└─────────────────────────────────────────────────────────────────┘

1. MONITORING (Backend - Automated)
   ├─ Automation Service runs on intervals
   ├─ Checks positions for rebalancing needs
   ├─ Analyzes volatility and active bin position
   └─ Detects stop-loss triggers

2. TRANSACTION CREATION (Backend - Automated)
   ├─ Creates unsigned rebalance transaction
   ├─ Calculates optimal bin range based on volatility
   ├─ Prepares transaction metadata
   └─ Queues transaction for approval

3. NOTIFICATION (Telegram Bot)
   └─ Telegram Bot
      ├─ Direct Telegram messages
      ├─ Transaction approval alerts
      └─ Execution status updates

4. USER REVIEW (Frontend - Manual)
   ├─ User receives notification
   ├─ Clicks "Review & Approve" button
   ├─ Navigates to /approvals page
   ├─ Reviews transaction details:
   │  ├─ Rebalance reason
   │  ├─ Current vs new range
   │  ├─ Volatility metrics
   │  └─ Estimated impact
   └─ Makes decision: Approve or Reject

5. WALLET SIGNING (User Wallet - Manual)
   ├─ User clicks "Approve & Sign"
   ├─ Frontend deserializes transaction
   ├─ Wallet adapter prompts for signature
   ├─ User signs with Solflare/Phantom/etc.
   └─ Signed transaction sent to backend

6. EXECUTION (Backend - Automated)
   ├─ Receives signed transaction
   ├─ Validates signature
   ├─ Submits to Solana blockchain
   ├─ Waits for confirmation
   └─ Updates position state

7. CONFIRMATION (Telegram)
   ├─ Success notification via Telegram
   ├─ Transaction signature link
   ├─ Updated position metrics
   └─ Audit trail in history
```

## Key Services

### 1. Transaction Queue Service (`transaction-queue.service.ts`)

**Purpose**: Manages pending transactions awaiting user approval

**Key Features**:
- Queue management with expiry (24 hours)
- Transaction serialization/deserialization
- Status tracking (pending → approved → executed)
- Position-based transaction history
- Automatic cleanup of expired transactions

**Data Model**:
```typescript
interface PendingTransaction {
  id: string;
  type: 'rebalance' | 'stop-loss' | 'close-position';
  positionAddress: string;
  walletAddress: string;
  transaction: string; // Base64 encoded
  metadata: {
    poolAddress: string;
    oldRange?: { lowerBinId: number; upperBinId: number };
    newRange?: { lowerBinId: number; upperBinId: number };
    reason: string;
    estimatedValue?: number;
    volatility?: number;
  };
  status: 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';
  createdAt: number;
  expiresAt: number;
  signature?: string;
}
```

### 2. Telegram Bot Service (`telegram-bot.ts`)

**Purpose**: Send Telegram notifications for transaction approvals

**Key Features**:
- Direct Telegram messaging
- Transaction approval alerts
- Execution status notifications
- Simple configuration via bot token and chat ID

**Notification Types**:
- Transaction approval required
- Transaction executed successfully
- Transaction failed

### 3. Automation Service (`automation.service.ts`)

**Purpose**: Schedule and execute monitoring jobs

**Key Features**:
- Interval-based job scheduling
- Position monitoring
- Rebalance need detection
- Transaction queue integration
- Job enable/disable controls

**Updated Flow**:
```typescript
// Old: Tried to execute with missing keypair
setInterval(async () => {
  await executeRebalance(keypair); // ❌ No keypair available
}, intervalMs);

// New: Check and queue for approval
setInterval(async () => {
  const needsRebalance = await checkPosition();
  if (needsRebalance) {
    const tx = await createUnsignedTransaction();
    await queueTransaction(tx);
    await sendNotification(walletAddress, tx);
  }
}, intervalMs);
```

### 4. Rebalance Service (`rebalance.service.ts`)

**Purpose**: Core rebalancing logic

**Key Features**:
- Position analysis
- Optimal range calculation based on volatility
- Rebalance necessity detection
- Transaction building (unsigned)

## Frontend Integration

### Approvals Page (`client/pages/approvals.tsx`)

**Purpose**: User interface for reviewing and approving transactions

**Key Features**:
- List all pending transactions for connected wallet
- Display transaction details and metadata
- Approve button triggers wallet signature
- Reject button cancels transaction
- Real-time status updates
- Transaction expiry countdown
- Links to Solscan for transparency

**User Flow**:
1. User connects wallet
2. Page fetches pending transactions for wallet address
3. User reviews transaction details
4. User clicks "Approve & Sign"
5. Wallet adapter prompts for signature
6. Signed transaction sent to backend
7. Backend executes and confirms
8. Page updates with success/failure

## API Endpoints

### Transaction Queue Endpoints

```typescript
// Get pending transactions for wallet
GET /api/transactions/pending?wallet=<address>
Response: { success: true, data: PendingTransaction[] }

// Execute approved transaction
POST /api/transactions/:id/execute
Body: { signedTransaction: string }
Response: { success: true, signature: string }

// Reject pending transaction
POST /api/transactions/:id/reject
Response: { success: true }

// Get transaction history for position
GET /api/transactions/history/:positionAddress
Response: { success: true, data: PendingTransaction[] }
```

## Security Considerations

### ✅ What We Do

1. **Never store private keys**: User keys remain in their wallet
2. **Transparent transactions**: All details visible before signing
3. **Expiry mechanism**: Transactions expire after 24 hours
4. **Audit trail**: Complete history of all transactions
5. **User control**: Users can reject any transaction
6. **Wallet validation**: Only wallet owner can sign

### ✅ What We Don't Do

1. **No automatic signing**: Never sign transactions without user
2. **No key storage**: Never store or transmit private keys
3. **No blind execution**: Users always review before approval
4. **No forced actions**: Users can disable automation anytime

## Benefits

### For Users

- **Security**: Private keys never leave wallet
- **Transparency**: Full visibility into all actions
- **Control**: Approve or reject at discretion
- **Convenience**: Automated monitoring and optimal parameter calculation
- **Telegram Alerts**: Instant notifications for pending approvals

### For Developers

- **Scalable**: Queue handles multiple positions and users
- **Maintainable**: Clear separation of concerns
- **Extensible**: Easy to add new transaction types
- **Auditable**: Complete transaction history
- **Reliable**: Automatic cleanup and error handling

## Future Enhancements

### Planned Features

1. **Batch Approvals**: Approve multiple transactions at once
2. **Auto-approve Rules**: User-defined rules for automatic approval
3. **Scheduled Execution**: Approve now, execute later
4. **Gas Optimization**: Batch multiple rebalances into one transaction
5. **Mobile App**: Native mobile notifications and approvals
6. **Smart Notifications**: ML-based notification timing
7. **Transaction Simulation**: Preview exact outcome before approval



## Comparison with Alternatives

### Option 1: Delegated Wallet (Rejected)

**How it works**: Store user private key on server

**Pros**:
- Truly automatic execution
- No user interaction needed

**Cons**:
- ❌ Major security risk
- ❌ Single point of failure
- ❌ Regulatory concerns
- ❌ User trust issues

### Option 2: Transaction Approval Queue (Chosen)

**How it works**: Queue transactions for user approval

**Pros**:
- ✅ Secure (keys stay in wallet)
- ✅ Transparent (user reviews all)
- ✅ Flexible (approve/reject)
- ✅ Automated monitoring
- ✅ Telegram notifications
- ✅ Web-based approval interface

**Cons**:
- Requires user interaction
- Not instant execution

### Option 3: On-chain Automation (Future)

**How it works**: Solana program with delegated authority

**Pros**:
- Fully on-chain
- No backend needed
- Trustless execution

**Cons**:
- Complex to implement
- Higher development cost
- Limited flexibility
- Program upgrade challenges

## Conclusion

The transaction approval queue architecture provides the optimal balance between automation and security. It leverages backend automation for monitoring and optimal parameter calculation while maintaining user control and security through wallet-based transaction signing.

This approach is:
- **Secure**: Private keys never leave the user's wallet
- **Transparent**: Users review all transaction details
- **Convenient**: Telegram notifications ensure timely awareness
- **Scalable**: Handles multiple users and positions efficiently
- **Simple**: Easy-to-use web interface for approvals

The system is production-ready and can be enhanced with additional features like batch approvals, auto-approve rules, and additional notification channels as user needs evolve.
