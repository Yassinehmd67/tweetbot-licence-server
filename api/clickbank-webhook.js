import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function parseBody(req) {
  if (!req.body) return {};

  if (typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }

  return {};
}

function decryptClickBankNotification(notification, iv, secretKey) {
  const key = crypto
    .createHash("sha1")
    .update(secretKey)
    .digest("hex")
    .slice(0, 32);

  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv, "hex")
  );

  let decrypted = decipher.update(notification, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return JSON.parse(decrypted);
}

function extractOrderData(body) {
  const lineItem = Array.isArray(body.lineItems) ? body.lineItems[0] || {} : {};

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
      body.customer?.shipping?.email ||
      "",

    product:
      body.product ||
      body.item ||
      body.itemNo ||
      body.productId ||
      lineItem.itemNo ||
      lineItem.productId ||
      "",

    transactionType: body.transactionType || body.transaction_type || "",

    raw: body,
  };
}

function isSaleTransaction(transactionType) {
  const value = String(transactionType || "").toUpperCase();

  if (!value) return true;

  return ["SALE", "TEST", "BILL", "REBILL", "TEST_SALE", "TEST-BILL"].includes(
    value
  );
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

    const encryptedBody = parseBody(req);

    if (!encryptedBody.notification || !encryptedBody.iv) {
      return res.status(400).send("Invalid ClickBank notification payload.");
    }

    const decryptedBody = decryptClickBankNotification(
      encryptedBody.notification,
      encryptedBody.iv,
      secretKey
    );

    const data = extractOrderData(decryptedBody);
    const orderId = String(data.orderId || "").trim();

    if (!orderId) {
      return res.status(400).send("Missing order ID.");
    }

    if (!isSaleTransaction(data.transactionType)) {
      return res.status(200).send("Notification ignored.");
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
