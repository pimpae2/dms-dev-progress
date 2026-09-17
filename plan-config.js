function parseSheetLink(value) {
  const url = new URL(value.trim());
  const match = url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !match || url.username || url.password) {
    throw new Error("กรุณาใส่ลิงก์ Google Sheets ที่ถูกต้อง");
  }
  const gid = new URLSearchParams(url.hash.slice(1)).get("gid") || url.searchParams.get("gid");
  if (!gid || !/^\d+$/.test(gid)) throw new Error("กรุณาคัดลอกลิงก์จากแท็บชีตที่ต้องการ โดยมี gid ในลิงก์");
  return { spreadsheetId: match[1], gid, url: `https://docs.google.com/spreadsheets/d/${match[1]}/edit?gid=${gid}#gid=${gid}` };
}

let planAdminToken = "";

async function readPlanConfig() {
  if (location.protocol === "file:") throw new Error("กรุณาเปิดผ่านเว็บ Netlify หรือ localhost ไม่ใช่เปิดไฟล์ HTML โดยตรง");
  let response;
  try {
    response = await fetch("/api/plans", { cache: "no-store", signal: AbortSignal.timeout(25000), headers: planAdminToken ? { Authorization: `Bearer ${planAdminToken}` } : {} });
  } catch {
    throw new Error("เชื่อมต่อบริการตั้งค่าไม่ได้ กรุณาตรวจอินเทอร์เน็ตและเปิดหน้าเว็บใหม่");
  }
  const isHtml = (response.headers.get("content-type") || "").includes("text/html");
  if (response.status === 404 || response.status === 405 || (response.ok && isHtml)) {
    const published = await fetch("/plans-public.json", { cache: "no-store" });
    if (!published.ok || !(published.headers.get("content-type") || "").includes("application/json")) {
      throw new Error("ไม่พบรายการชีตที่เผยแพร่ กรุณาอัปโหลดไฟล์ในโฟลเดอร์ dist ไปยัง Netlify อีกครั้ง");
    }
    const config = await published.json();
    if (!Array.isArray(config.plans)) throw new Error("ข้อมูลการตั้งค่าไม่ถูกต้อง");
    return { ...config, readOnly: true };
  }
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `อ่านค่าตั้งค่าไม่สำเร็จ (${response.status})`);
  }
  const config = await response.json();
  if (!Array.isArray(config.plans)) throw new Error("ข้อมูลการตั้งค่าไม่ถูกต้อง");
  return config;
}

async function savePlanConfig(config) {
  const response = await fetch("/api/plans", {
    method: "PUT", headers: { "Content-Type": "application/json", ...(planAdminToken ? { Authorization: `Bearer ${planAdminToken}` } : {}) }, body: JSON.stringify(config),
  });
  if (!(response.headers.get("content-type") || "").includes("application/json")) {
    throw new Error("เว็บนี้ยังไม่มีบริการบันทึกค่าตั้งค่า กรุณาแก้ไขในเครื่องแล้วเผยแพร่ใหม่");
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
  return result;
}
