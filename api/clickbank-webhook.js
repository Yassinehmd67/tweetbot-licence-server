import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function extractOrderData(body) {
  return {
    orderId:
      body.receipt ||
      body.receiptNumber ||
      body.orderId ||
      body.order_id ||
      body.transactionId ||
      body.transaction_id ||
      "",

    email:
      body.email ||
      body.customerEmail ||
      body.customer_email ||
      body.customer?.email ||
      "",

    product: body.product || body.item || body.itemNo || body.productId || "",

    raw: body,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed.");
    }

    const data = extractOrderData(req.body || {});
    const orderId = String(data.orderId || "").trim();

    if (!orderId) {
      return res.status(400).send("Missing order ID.");
    }

    const existingOrder = await redis.get(`order:${orderId}`);

    // 🔥 منع تكرار التسجيل (مهم جدًا)
    if (existingOrder) {
      return res.status(200).send("Order already exists.");
    }

    await redis.set(`order:${orderId}`, {
      orderId,
      email: String(data.email || "").trim(),
      product: String(data.product || "").trim(),
      used: false,
      createdAt: new Date().toISOString(),
      raw: data.raw,
    });

    return res.status(200).send("Order stored successfully.");
  } catch (e) {
    return res.status(500).send("Server error: " + e.message);
  }
}
