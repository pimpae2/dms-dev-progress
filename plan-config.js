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

async function readPlanConfig() {
  const response = await fetch("/api/plans", { cache: "no-store" });
  if (!response.ok) throw new Error("อ่านค่าตั้งค่าไม่สำเร็จ กรุณาเปิดเว็บผ่านเซิร์ฟเวอร์ Project Progress");
  const config = await response.json();
  if (!Array.isArray(config.plans)) throw new Error("ข้อมูลการตั้งค่าไม่ถูกต้อง");
  return config;
}

async function savePlanConfig(config) {
  const response = await fetch("/api/plans", {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "บันทึกไม่สำเร็จ");
  return result;
}
