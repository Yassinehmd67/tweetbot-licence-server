import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Method not allowed",
      });
    }

    const adminSecret = req.headers["x-admin-secret"];

    if (!process.env.ADMIN_SECRET || adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(401).json({
        ok: false,
        error: "Unauthorized",
      });
    }

    const { orderId, licenseKey } = req.body || {};

    if (!orderId && !licenseKey) {
      return res.status(400).json({
        ok: false,
        error: "Order ID or License Key is required",
      });
    }

    if (licenseKey) {
      const normalizedKey = String(licenseKey).trim().toUpperCase();
      const license = await redis.get(`license:${normalizedKey}`);

      if (!license) {
        return res.status(404).json({
          ok: false,
          error: "License not found",
        });
      }

      return res.status(200).json({
        ok: true,
        license,
      });
    }

    const normalizedOrderId = String(orderId).trim();
    const order = await redis.get(`order:${normalizedOrderId}`);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "Order not found",
      });
    }

    let license = null;

    if (order.licenseKey) {
      license = await redis.get(
        `license:${String(order.licenseKey).trim().toUpperCase()}`
      );
    }

    return res.status(200).json({
      ok: true,
      order,
      license,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: e.message,
    });
  }
}
