import crypto from "crypto";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function generateLicense(machineId, secretSalt) {
  const raw = `${machineId}:${secretSalt}`;
  const hash = crypto
    .createHash("sha256")
    .update(raw)
    .digest("hex")
    .toUpperCase();

  return [
    hash.slice(0, 5),
    hash.slice(5, 10),
    hash.slice(10, 15),
    hash.slice(15, 20),
  ].join("-");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const { orderId, email, machineId } = req.body || {};

    if (!orderId || !machineId) {
      return res.status(400).json({
        ok: false,
        error: "Order ID and Machine ID are required.",
      });
    }

    const normalizedOrderId = String(orderId).trim();
    const normalizedEmail = String(email || "")
      .trim()
      .toLowerCase();
    const normalizedMachineId = String(machineId).trim();

    const order = await redis.get(`order:${normalizedOrderId}`);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "Order not found. Please check your Order ID.",
      });
    }

    if (order.used) {
      return res.status(403).json({
        ok: false,
        error: "This order has already been used.",
      });
    }

    const orderEmail = String(order.email || "")
      .trim()
      .toLowerCase();

    if (normalizedEmail && orderEmail && normalizedEmail !== orderEmail) {
      return res.status(403).json({
        ok: false,
        error: "The email address does not match this order.",
      });
    }

    const secretSalt = process.env.SECRET_SALT;

    if (!secretSalt) {
      return res.status(500).json({
        ok: false,
        error: "License server is not configured correctly.",
      });
    }

    const licenseKey = generateLicense(normalizedMachineId, secretSalt);

    const activatedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 5);

    await redis.set(`order:${normalizedOrderId}`, {
      ...order,
      orderId: normalizedOrderId,
      email: orderEmail || normalizedEmail,
      used: true,
      machineId: normalizedMachineId,
      licenseKey,
      activatedAt: activatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    await redis.set(`license:${licenseKey}`, {
      licenseKey,
      orderId: normalizedOrderId,
      email: orderEmail || normalizedEmail,
      machineId: normalizedMachineId,
      activatedAt: activatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      active: true,
    });

    return res.status(200).json({
      ok: true,
      licenseKey,
      machineId: normalizedMachineId,
      expiresAt: expiresAt.toISOString(),
      duration: "5 months",
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error. Please try again later.",
      details: e.message,
    });
  }
}
