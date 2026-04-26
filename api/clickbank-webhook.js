import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function decryptClickBankNotification(notification, iv, secretKey) {
  const key = crypto.createHash("sha256").update(secretKey).digest();

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    key,
    Buffer.from(iv, "hex")
  );

  let decrypted = decipher.update(notification, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

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
      body.customer?.billing?.email ||
      "",

    product:
      body.product ||
      body.item ||
      body.itemNo ||
      body.productId ||
      body.lineItems?.[0]?.itemNo ||
      "",

    transactionType: body.transactionType || body.transaction_type || "",

    raw: body,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method not allowed.");
    }

    const secretKey = process.env.CLICKBANK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).send("ClickBank secret key is not configured.");
    }

    let body = req.body || {};

    if (typeof body === "string") {
      body = Object.fromEntries(new URLSearchParams(body));
    }

    if (body.notification && body.iv) {
      body = decryptClickBankNotification(
        body.notification,
        body.iv,
        secretKey
      );
    }

    const data = extractOrderData(body);
    const orderId = String(data.orderId || "").trim();

    if (!orderId) {
      return res.status(400).send("Missing order ID.");
    }

    const existingOrder = await redis.get(`order:${orderId}`);

    if (existingOrder) {
      return res.status(200).send("Order already exists.");
    }

    await redis.set(`order:${orderId}`, {
      orderId,
      email: String(data.email || "")
        .trim()
        .toLowerCase(),
      product: String(data.product || "").trim(),
      transactionType: String(data.transactionType || "").trim(),
      used: false,
      createdAt: new Date().toISOString(),
      raw: data.raw,
    });

    return res.status(200).send("Order stored successfully.");
  } catch (e) {
    return res.status(500).send("Server error: " + e.message);
  }
}
