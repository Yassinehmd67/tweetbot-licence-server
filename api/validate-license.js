import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        valid: false,
        reason: "method_not_allowed",
        message: "Method not allowed",
      });
    }

    const { licenseKey, machineId } = req.body || {};

    if (!licenseKey || !machineId) {
      return res.status(400).json({
        valid: false,
        reason: "missing_data",
        message: "License Key و Machine ID مطلوبان",
      });
    }

    const normalizedKey = String(licenseKey).trim().toUpperCase();
    const normalizedMachineId = String(machineId).trim();

    const license = await redis.get(`license:${normalizedKey}`);

    if (!license) {
      return res.status(404).json({
        valid: false,
        reason: "not_found",
        message: "الترخيص غير موجود",
      });
    }

    if (!license.active) {
      return res.status(403).json({
        valid: false,
        reason: "inactive",
        message: "الترخيص غير مفعل",
      });
    }

    if (license.machineId !== normalizedMachineId) {
      return res.status(403).json({
        valid: false,
        reason: "machine_mismatch",
        message: "هذا الترخيص مرتبط بجهاز آخر",
      });
    }

    if (license.expiresAt) {
      const now = new Date();
      const expiresAt = new Date(license.expiresAt);

      if (now > expiresAt) {
        return res.status(403).json({
          valid: false,
          reason: "expired",
          message: "انتهت مدة الترخيص",
        });
      }
    }

    return res.status(200).json({
      valid: true,
      licenseKey: normalizedKey,
      machineId: normalizedMachineId,
      orderId: license.orderId || "",
      email: license.email || "",
      activatedAt: license.activatedAt || "",
      expiresAt: license.expiresAt || "",
    });
  } catch (e) {
    return res.status(500).json({
      valid: false,
      reason: "server_error",
      message: e.message,
    });
  }
}
