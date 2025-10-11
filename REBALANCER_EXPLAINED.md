# Automatic Rebalancer - How It Works

## Overview
The automatic rebalancer monitors your liquidity positions and triggers rebalancing when positions become inefficient or risky.

## Trigger Conditions

The rebalancer checks your positions **every 5 minutes** and triggers a rebalance if either condition is met:

### 1. Position Out of Range
- **When**: Current price (activeId) is outside your position's range
- **Why**: Out-of-range positions earn no fees and represent idle capital
- **Example**: 
  - Your position range: bins 100-116
  - Current price: bin 120 (out of range)
  - **Action**: Rebalance immediately

### 2. Price Too Close to Range Edge
- **When**: Current price is within **10% of the range boundary**
- **Why**: Prevents positions from going out of range soon
- **Calculation**:
  ```
  Position width = upperBinId - lowerBinId
  Distance to lower edge = activeId - lowerBinId
  Distance to upper edge = upperBinId - activeId
  Minimum distance = min(distance to lower, distance to upper)
  Distance percentage = (minimum distance / position width) × 100
  
  If distance percentage < 10% → Trigger rebalance
  ```
- **Example**:
  - Position range: bins 100-116 (width = 16 bins)
  - Current price: bin 114
  - Distance to upper edge: 116 - 114 = 2 bins
  - Distance percentage: (2 / 16) × 100 = 12.5%
  - **Action**: No rebalance (12.5% > 10%)
  
  - If price moves to bin 115:
  - Distance to upper edge: 116 - 115 = 1 bin
  - Distance percentage: (1 / 16) × 100 = 6.25%
  - **Action**: Rebalance (6.25% < 10%)

## Rebalancing Process

### 1. Calculate New Range
- **Fixed width**: Always 16 bins
- **Centered**: New range centers on current price
- **Formula**:
  ```
  lowerBinId = currentBinId - 7
  upperBinId = currentBinId + 8
  Total bins = 16 (7 below + current + 8 above)
  ```

### 2. Execute Rebalance
1. Close old position (withdraw liquidity)
2. Create new position with optimal range
3. Deposit liquidity into new position
4. Send Telegram notification with details

### 3. Store Event
- Records old range, new range, timestamp
- Tracks transaction signature
- Available in dashboard history

## Configuration

### Current Settings
- **Check interval**: 5 minutes (300,000ms)
- **Trigger threshold**: 10% distance to edge
- **New position width**: 16 bins (fixed)

### Adjusting Threshold
Lower threshold = More frequent rebalancing:
- **5%**: Very aggressive, rebalances often
- **10%**: Balanced (current setting)
- **15%**: Conservative, fewer rebalances

## Monitoring

### Logs
The rebalancer logs detailed information:
```
[Rebalancer] Position range check
  - activeId: current price bin
  - range: [lower, upper] bin IDs
  - distanceToLower: bins from price to lower edge
  - distanceToUpper: bins from price to upper edge
  - distancePercentage: % of position width
  - needsRebalance: true/false
```

### Telegram Notifications
Receive alerts when:
- Rebalance is triggered
- Transaction is executed
- Rebalance succeeds or fails

## Performance Impact

### Speed Optimizations
- Parallel position loading (all positions at once)
- Batch pool queries (5 pools per batch)
- Reduced delays between checks (100ms between batches)
- Smart caching (storage + blockchain merge)

### Expected Behavior
- **Initial load**: 2-5 seconds for all positions
- **Subsequent updates**: Uses cached data, faster
- **Rebalance check**: < 1 second per position
- **Total positions shown**: Should match blockchain count exactly

## Troubleshooting

### Position Count Mismatch
**Fixed**: Now scans ALL pools in parallel batches instead of just 10 pools
- Ensures no positions are missed
- Faster than sequential scanning
- Handles rate limits with batch delays

### Missing Positions
- Check wallet address is correct
- Verify positions exist on blockchain
- Review server logs for errors
- Ensure RPC endpoint is responsive

### Frequent Rebalancing
- Normal if price is volatile
- Adjust threshold higher (e.g., 15%) for less frequent rebalancing
- Check position width (16 bins may be too narrow for volatile pairs)
