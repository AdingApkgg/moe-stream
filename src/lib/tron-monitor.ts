import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { releaseAmount } from "@/lib/usdt-payment";

const USDT_TRC20_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const POLL_INTERVAL_MS = 15_000;
const PROCESSED_TX_PREFIX = "usdt:tx:";
const PROCESSED_TX_TTL = 86400 * 7; // 7 days
const LAST_TIMESTAMP_KEY = "usdt:last_ts";

let timerId: ReturnType<typeof setTimeout> | null = null;
let monitoring = false;

interface TronTRC20Tx {
  transaction_id: string;
  token_info: { address: string; decimals: number };
  from: string;
  to: string;
  value: string;
  block_timestamp: number;
}

async function getWalletAddress(): Promise<string | null> {
  const config = await prisma.siteConfig.findUnique({
    where: { id: "default" },
    select: { usdtPaymentEnabled: true, usdtWalletAddress: true },
  });
  if (!config?.usdtPaymentEnabled || !config.usdtWalletAddress) return null;
  return config.usdtWalletAddress;
}

async function fetchRecentTransfers(walletAddress: string): Promise<TronTRC20Tx[]> {
  let minTimestamp: number;
  try {
    const stored = await redis.get(LAST_TIMESTAMP_KEY);
    minTimestamp = stored ? parseInt(stored, 10) : Date.now() - 60_000;
  } catch {
    minTimestamp = Date.now() - 60_000;
  }

  const params = new URLSearchParams({
    only_to: "true",
    only_confirmed: "true",
    limit: "50",
    contract_address: USDT_TRC20_CONTRACT,
    min_timestamp: String(minTimestamp),
    order_by: "block_timestamp,asc",
  });

  const url = `https://api.trongrid.io/v1/accounts/${walletAddress}/transactions/trc20?${params}`;

  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    console.error(`[TronMonitor] TronGrid API error: ${res.status}`);
    return [];
  }

  const json = await res.json();
  return (json.data || []) as TronTRC20Tx[];
}

async function processTransactions(walletAddress: string): Promise<void> {
  const txs = await fetchRecentTransfers(walletAddress);
  if (txs.length === 0) return;

  let maxTimestamp = 0;

  for (const tx of txs) {
    if (tx.to.toLowerCase() !== walletAddress.toLowerCase()) continue;
    if (tx.token_info.address !== USDT_TRC20_CONTRACT) continue;

    const txHash = tx.transaction_id;
    if (tx.block_timestamp > maxTimestamp) maxTimestamp = tx.block_timestamp;

    try {
      const claimed = await redis.set(`${PROCESSED_TX_PREFIX}${txHash}`, "1", "EX", 120, "NX");
      if (!claimed) continue;
    } catch {
      // Redis down — fall through to DB-level guard
    }

    const existingTx = await prisma.paymentOrder.findFirst({
      where: { txHash },
      select: { id: true },
    });
    if (existingTx) {
      try { await redis.set(`${PROCESSED_TX_PREFIX}${txHash}`, "1", "EX", PROCESSED_TX_TTL); } catch {}
      continue;
    }

    const decimals = tx.token_info.decimals || 6;
    const amountRaw = parseFloat(tx.value) / Math.pow(10, decimals);
    const amount = Math.round(amountRaw * 100) / 100;

    const order = await prisma.paymentOrder.findFirst({
      where: {
        status: "PENDING",
        walletAddress: walletAddress,
        amount: { gte: amount - 0.001, lte: amount + 0.001 },
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!order) {
      try { await redis.set(`${PROCESSED_TX_PREFIX}${txHash}`, "1", "EX", PROCESSED_TX_TTL); } catch {}
      continue;
    }

    await prisma.$transaction(async (tx_db) => {
      const updated = await tx_db.paymentOrder.updateMany({
        where: { id: order.id, status: "PENDING" },
        data: { status: "PAID", txHash, paidAt: new Date() },
      });
      if (updated.count === 0) return;

      if (order.pointsAmount > 0) {
        const user = await tx_db.user.update({
          where: { id: order.userId },
          data: { points: { increment: order.pointsAmount } },
          select: { points: true },
        });

        await tx_db.pointsTransaction.create({
          data: {
            userId: order.userId,
            amount: order.pointsAmount,
            balance: user.points,
            type: "USDT_RECHARGE",
            description: `USDT 充值 ${order.amount} → ${order.pointsAmount} 积分`,
            relatedId: order.id,
          },
        });
      }

      if (order.grantUpload) {
        await tx_db.user.update({
          where: { id: order.userId },
          data: { canUpload: true },
        });
      }
    });

    await releaseAmount(order.amount);

    try { await redis.set(`${PROCESSED_TX_PREFIX}${txHash}`, "1", "EX", PROCESSED_TX_TTL); } catch {}

    console.log(`[TronMonitor] Order ${order.orderNo} paid: ${amount} USDT, tx=${txHash}`);
  }

  if (maxTimestamp > 0) {
    try {
      await redis.set(LAST_TIMESTAMP_KEY, String(maxTimestamp + 1));
    } catch {}
  }
}

async function expireOrders(): Promise<void> {
  const expired = await prisma.paymentOrder.findMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    select: { id: true, amount: true, orderNo: true },
  });

  for (const order of expired) {
    const { count } = await prisma.paymentOrder.updateMany({
      where: { id: order.id, status: "PENDING" },
      data: { status: "EXPIRED" },
    });
    if (count > 0) {
      await releaseAmount(order.amount);
    }
  }

  if (expired.length > 0) {
    console.log(`[TronMonitor] Expired ${expired.length} orders`);
  }
}

async function poll(): Promise<void> {
  try {
    const walletAddress = await getWalletAddress();
    if (!walletAddress) return;

    await processTransactions(walletAddress);
    await expireOrders();
  } catch (err) {
    console.error("[TronMonitor] Poll error:", err);
  }
}

async function pollLoop(): Promise<void> {
  if (!monitoring) return;
  await poll();
  if (monitoring) {
    timerId = setTimeout(pollLoop, POLL_INTERVAL_MS);
  }
}

export function startTronMonitor(): void {
  if (monitoring) return;
  monitoring = true;
  console.log(`[TronMonitor] Starting TRC20 USDT monitor (interval=${POLL_INTERVAL_MS}ms)`);
  pollLoop();
}

export function stopTronMonitor(): void {
  monitoring = false;
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  console.log("[TronMonitor] Stopped");
}
