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

    const { licenseKey, reason } = req.body || {};

    if (!licenseKey) {
      return res.status(400).json({
        ok: false,
        error: "License key is required",
      });
    }

    const normalizedKey = String(licenseKey).trim().toUpperCase();
    const license = await redis.get(`license:${normalizedKey}`);

    if (!license) {
      return res.status(404).json({
        ok: false,
        error: "License not found",
      });
    }

    const updatedLicense = {
      ...license,
      active: false,
      disabledAt: new Date().toISOString(),
      disabledReason: reason || "Disabled by admin",
    };

    await redis.set(`license:${normalizedKey}`, updatedLicense);

    return res.status(200).json({
      ok: true,
      message: "License disabled successfully",
      licenseKey: normalizedKey,
      license: updatedLicense,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      details: e.message,
    });
  }
}
