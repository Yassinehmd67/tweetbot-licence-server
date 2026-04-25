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
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { orderId, email, machineId } = req.body || {};

    if (!orderId || !machineId) {
      return res.status(400).json({
        error: "Order ID و Machine ID مطلوبان",
      });
    }

    const order = await redis.get(`order:${orderId}`);

    if (!order) {
      return res.status(404).json({
        error: "لم يتم العثور على الطلب",
      });
    }

    if (order.used) {
      return res.status(403).json({
        error: "تم استخدام هذا الطلب مسبقًا",
      });
    }

    if (
      email &&
      order.email &&
      email.toLowerCase() !== order.email.toLowerCase()
    ) {
      return res.status(403).json({
        error: "البريد الإلكتروني غير مطابق للطلب",
      });
    }

    const secretSalt = process.env.SECRET_SALT;

    if (!secretSalt) {
      return res.status(500).json({
        error: "SECRET_SALT غير مضبوط في السيرفر",
      });
    }

    const licenseKey = generateLicense(machineId.trim(), secretSalt);

    await redis.set(`order:${orderId}`, {
      ...order,
      used: true,
      machineId: machineId.trim(),
      licenseKey,
      activatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      ok: true,
      licenseKey,
      duration: "5 months",
    });
  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      details: e.message,
    });
  }
}
