const translations = {
  en: {
    page_title: "TweetBot Activation",
    title: "Activate TweetBot",
    desc: "Enter your purchase details and Machine ID to generate your license key.",
    order_id: "Order ID",
    email: "Email",
    machine_id: "Machine ID",
    activate_btn: "Activate & Generate Key",
    validate_title: "Validate License",
    validate_desc: "Verify your license key here.",
    license_key: "License Key",
    validate_btn: "Validate License",
    activating: "⏳ Activating...",
    validating: "⏳ Validating...",
    license_label: "License Key",
    expires_at: "Expires at",
    valid_license: "License is valid",
    invalid_license: "License is invalid",
    reason: "Reason",
    connection_error: "Connection error",
    server_error: "Server error",
  },

  ar: {
    page_title: "تفعيل TweetBot",
    title: "تفعيل TweetBot",
    desc: "أدخل بيانات الشراء و Machine ID للحصول على مفتاح الترخيص.",
    order_id: "رقم الطلب",
    email: "البريد الإلكتروني",
    machine_id: "معرّف الجهاز",
    activate_btn: "تفعيل وإنشاء المفتاح",
    validate_title: "اختبار الترخيص",
    validate_desc: "تأكد من صلاحية الترخيص هنا.",
    license_key: "مفتاح الترخيص",
    validate_btn: "اختبار الترخيص",
    activating: "⏳ جاري التفعيل...",
    validating: "⏳ جاري التحقق...",
    license_label: "مفتاح الترخيص",
    expires_at: "ينتهي في",
    valid_license: "الترخيص صالح",
    invalid_license: "الترخيص غير صالح",
    reason: "السبب",
    connection_error: "خطأ في الاتصال",
    server_error: "خطأ في السيرفر",
  },
};

let currentLang = localStorage.getItem("tweetbot_lang") || "en";

function t(key) {
  return translations[currentLang]?.[key] || key;
}

function setLang(lang) {
  localStorage.setItem("tweetbot_lang", lang);
  location.reload();
}

function applyLanguage() {
  document.documentElement.lang = currentLang;
  document.body.dir = currentLang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  document.title = t("page_title");
}

document.addEventListener("DOMContentLoaded", applyLanguage);
