let planSystems = [];
let workbookTabs = [];
let activePlan = null;
let planRequest = 0;
let dashboardFailedTabs = 0;
let systemNavObserver = null;
const PROJECT_WORKBOOK_ID = "1Hi1M7GNhA5G2p7BgiGLH3F5A3aKgO2A-iU46XGOvFC8";
const DASHBOARD_PLAN = { id: "dashboard", displayName: "Dashboard", isDashboard: true };
const ENVIRONMENT_WORKBOOK_ID = "1Zf9Ud4pIf_XvL2U-1jzyLkRB5YwEKcwwlipQNfvv8SM";
const SPECIAL_PLANS = [
  { id: "dev-environment", gid: "0", displayName: "เครื่อง Dev", kind: "environment-dev", workbookId: ENVIRONMENT_WORKBOOK_ID },
  { id: "uat-environment", gid: "209210002", displayName: "เครื่อง UAT", kind: "environment-uat", workbookId: ENVIRONMENT_WORKBOOK_ID },
];

const backToTop = document.getElementById("backToTop");
if (backToTop) {
  const updateBackToTop = () => {
    const threshold = Math.max(500, window.innerHeight * 0.75);
    backToTop.hidden = window.scrollY < threshold
      || document.documentElement.scrollHeight - window.innerHeight < threshold;
  };
  window.addEventListener("scroll", updateBackToTop, { passive: true });
  window.addEventListener("resize", updateBackToTop);
  new ResizeObserver(updateBackToTop).observe(document.body);
  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });
  updateBackToTop();
}

function projectDisplayName(name) {
  return String(name || "").replace(/^Project\s*Plan[_\s-]*/i, "").trim() || String(name || "Project Progress");
}

function parseWorkbookTabsHtml(html) {
  const tabs = [];
  const pattern = /items\.push\(\{name:\s*"((?:\\.|[^"\\])*)",[\s\S]*?gid:\s*"(-?\d+)"/g;
  for (const match of html.matchAll(pattern)) {
    const name = JSON.parse(`"${match[1]}"`);
    if (!tabs.some(tab => tab.id === match[2])) tabs.push({ id: match[2], gid: match[2], name, displayName: projectDisplayName(name) });
  }
  if (!tabs.length) throw new Error("ไม่พบแท็บโปรเจกต์ที่เปิดอ่านได้");
  return tabs;
}

async function loadWorkbookTabs() {
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/htmlview`, {
    cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error("อ่านรายชื่อโปรเจกต์ไม่สำเร็จ กรุณาตรวจสิทธิ์ Google Sheet");
  return parseWorkbookTabsHtml(await response.text());
}

function renderProjectSourceTabs() {
  const tabs = document.getElementById("planSourceTabs");
  tabs.innerHTML = workbookTabs.map(plan => `<button type="button" data-project-id="${escapeHtml(plan.id)}" ${activePlan?.id === plan.id ? 'class="is-active" aria-current="page"' : ""}>${escapeHtml(plan.displayName)}</button>`).join("");
}

function showNoProject(message) {
  setText("planMessage", message);
  setText("heroFocusLabel", "ยังไม่มีข้อมูล");
  setText("heroFocusDetail", "เพิ่มแท็บใน Google Sheet เพื่อแสดงโปรเจกต์");
  setText("heroSubtitle", "ยังไม่พบแท็บโปรเจกต์ที่เปิดอ่านได้");
  setText("planDoneRatio", "ยังไม่มีข้อมูล");
  setText("planPendingRatio", "ยังไม่มีข้อมูล");
  document.querySelector(".updated").textContent = "ยังไม่มีโปรเจกต์ที่เลือก";
}

function showProjectLoading(label = activePlan?.displayName || "Project Progress") {
  document.body.classList.add("is-loading-plan");
  setText("planMessage", `กำลังอ่าน ${label}`);
  setText("planTotal", "...");
  setText("planDone", "...");
  setText("planPending", "...");
  setText("planDoneRatio", "กำลังโหลดข้อมูล");
  setText("planPendingRatio", "กำลังโหลดข้อมูล");
  setText("planSystemCount", "กำลังอ่านรายการที่มีสถานะ");
  setText("planDetailsTitle", "รายละเอียดกำลังโหลด");
  document.querySelector(".updated").textContent = "กำลังอัปเดตข้อมูล";
  const systemNav = document.getElementById("systemNav");
  const detailsSection = document.getElementById("planDetailsSection");
  systemNav.hidden = true;
  systemNav.innerHTML = "";
  detailsSection.hidden = true;
  document.getElementById("planDetails").innerHTML = "";
  const planRows = document.getElementById("planRows");
  planRows.className = "project-table is-ready";
  planRows.innerHTML = Array.from({ length: 4 }, (_, index) => `
    <article class="project-row loading-row" aria-hidden="true">
      <div class="row-name">
        <span class="loading-line ${index === 0 ? "is-wide" : ""}"></span>
        <span class="loading-line is-small"></span>
      </div>
      <div class="bar is-loading"><span></span></div>
      <div class="row-counts">
        <span class="loading-pill"></span>
        <span class="loading-pill"></span>
        <span class="loading-pill is-short"></span>
      </div>
    </article>
  `).join("");
}

async function initProjectPlans() {
  try {
    workbookTabs = [DASHBOARD_PLAN, ...SPECIAL_PLANS, ...await loadWorkbookTabs()];
    const requested = new URLSearchParams(location.search).get("project");
    const dashboardPlan = workbookTabs.find(plan => plan.isDashboard);
    activePlan = workbookTabs.find(plan => plan.id === requested)
      || workbookTabs.find(plan => plan.id === activePlan?.id)
      || dashboardPlan
      || workbookTabs[0]
      || null;
    if (requested && activePlan && activePlan.id !== requested) history.replaceState(null, "", `/?project=${encodeURIComponent(activePlan.id)}`);
    renderProjectSourceTabs();
    if (!activePlan) {
      showNoProject("ยังไม่พบแท็บใน Google Sheet");
      return;
    }
    document.querySelector(".hero h1").textContent = activePlan.displayName;
    setText("heroSubtitle", activePlan.kind === "environment-dev"
      ? "Environment Readiness · สรุปความพร้อมเครื่อง Dev จากหลักฐาน PASS"
      : activePlan.kind === "environment-uat"
        ? "Environment Readiness · สรุปความพร้อมเครื่อง UAT จากการตรวจ UAT จริง"
        : "Project Progress · นับเฉพาะข้อที่มีสถานะ · Developed, Tested และ Completed ถือว่าพัฒนาแล้ว");
    showProjectLoading(activePlan.displayName);
    await refreshProjectPlan();
  } catch (error) { setText("planMessage", error.message); }
}

async function activateProject(projectId) {
  if (projectId === activePlan?.id) return;
  activePlan = workbookTabs.find(plan => plan.id === projectId) || null;
  if (!activePlan) return;
  planSystems = [];
  renderProjectSourceTabs();
  document.querySelector(".hero h1").textContent = activePlan.displayName;
  setText("heroSubtitle", activePlan.kind === "environment-dev"
    ? "Environment Readiness · สรุปความพร้อมเครื่อง Dev จากหลักฐาน PASS"
    : activePlan.kind === "environment-uat"
      ? "Environment Readiness · สรุปความพร้อมเครื่อง UAT จากการตรวจ UAT จริง"
      : "Project Progress · นับเฉพาะข้อที่มีสถานะ · Developed, Tested และ Completed ถือว่าพัฒนาแล้ว");
  history.replaceState(null, "", `/?project=${encodeURIComponent(activePlan.id)}`);
  showProjectLoading(activePlan.displayName);
  await refreshProjectPlan();
}

document.getElementById("planSourceTabs")?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-project-id]");
  if (button) await activateProject(button.dataset.projectId);
});

document.getElementById("refreshPlanButton")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  if (button.disabled || !activePlan) return;
  button.disabled = true;
  button.classList.add("is-loading");
  try {
    showProjectLoading(activePlan.displayName);
    await refreshProjectPlan();
  } finally {
    button.disabled = false;
    button.classList.remove("is-loading");
  }
});

async function refreshProjectPlan() {
  if (!activePlan) return;
  const request = ++planRequest;
  try {
    dashboardFailedTabs = 0;
    const systems = activePlan.isDashboard
      ? await loadDashboardPlan()
      : activePlan.kind
        ? await loadSpecialPlan(activePlan)
      : await loadProjectPlan(activePlan.gid, activePlan.displayName);
    if (request !== planRequest) return;
    planSystems = systems;
    renderProjectPlan();
    document.body.classList.remove("is-loading-plan");
    syncHeroMeter();
    syncPlanBrief();
    const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    document.querySelector(".updated").textContent = `ข้อมูลล่าสุด ${updatedAt}`;
  } catch (error) {
    if (request !== planRequest) return;
    document.body.classList.remove("is-loading-plan");
    if (planSystems.length) renderProjectPlan();
    setText("planMessage", `อัปเดต Project Progress ไม่สำเร็จ${planSystems.length ? " · แสดงข้อมูลครั้งล่าสุด" : ""}: ${error.message}`);
    document.querySelector(".updated").textContent = "อัปเดตข้อมูลไม่สำเร็จ";
  }
}

function parseProjectPlan(rows, fallbackName = activePlan?.displayName || "Project") {
  rows = rows.map(row => row.map(cell => String(cell ?? "").trim()));
  const titleHeaders = ["คำอธิบาย", "หน้าจอ/เมนู/หัวข้อ", "รายการ", "ชื่องาน", "งาน", "task", "feature", "menu"];
  const statusHeaders = ["สถานะ", "สถานะงาน", "ผลการดำเนินงาน", "status"];
  const matchesHeader = (cell, candidates) => {
    const value = String(cell || "").trim().toLocaleLowerCase("th");
    return candidates.some((header) => {
      const name = header.toLocaleLowerCase("th");
      return value === name || value.startsWith(`${name} `) || value.startsWith(`${name}:`) || value.startsWith(`${name}/`) || value.startsWith(`${name}(`);
    });
  };
  const headerIndex = rows.findIndex((row) => row.some((cell) => matchesHeader(cell, titleHeaders)) && row.some((cell) => matchesHeader(cell, statusHeaders)));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const titleIndex = headers.findIndex((cell) => matchesHeader(cell, titleHeaders));
  const statusIndex = headers.findIndex((cell) => matchesHeader(cell, statusHeaders));
  const palette = ["#0b6fb3", "#168fbd", "#2d83c5", "#3e75c7", "#0b9abd"];
  const systems = [];
  let current = null;
  let fallback = null;
  let fallbackItemNumber = 0;
  const dataRows = rows.slice(headerIndex + 1).map((row) => {
    const rawCode = (row.slice(0, titleIndex).map((cell) => String(cell || "").trim()).filter(Boolean).at(-1) || "").replace(/[\u200B-\u200D\uFEFF]/g, "");
    return {
      row,
      rawCode,
      title: String(row[titleIndex] || "").trim(),
      status: String(row[statusIndex] || "").trim(),
    };
  });
  const groupDepth = dataRows
    .filter((record) => !record.status && /^\d+(?:\.\d+)*$/.test(record.rawCode))
    .filter((record) => dataRows.some((candidate) => candidate.rawCode.startsWith(`${record.rawCode}.`)))
    .map((record) => record.rawCode.split(".").length)
    .sort((a, b) => a - b)[0];
  const hasTextSections = dataRows.some(({ row, rawCode, title, status }) =>
    rawCode && !/^\d/.test(rawCode) && !title && !status && row.slice(titleIndex).every(cell => !cell));

  for (const record of dataRows) {
    const { row, rawCode, title, status } = record;
    if (hasTextSections && rawCode && !/^\d/.test(rawCode) && !title && !status && row.slice(titleIndex).every(cell => !cell)) {
      current = { code: "", name: rawCode, accent: palette[systems.length % palette.length], slug: `plan-group-${systems.length}`, items: [], textSection: true };
      systems.push(current);
      continue;
    }
    const code = rawCode || (title && status ? String(++fallbackItemNumber) : "");
    if (!hasTextSections && code && title && !status && /^\d+(?:\.\d+)*$/.test(code)
      && (!groupDepth || code.split(".").length === groupDepth)) {
      current = { code, name: title, accent: palette[systems.length % palette.length], slug: `plan-group-${systems.length}`, items: [] };
      systems.push(current);
      continue;
    }
    if (!title || !status || !code || !/^\d+(?:\.\d+)*$/.test(code)) continue;
    let system = [...systems].reverse().find(item => item.code && code.startsWith(`${item.code}.`)) || current;
    if (!system) {
      fallback = { code: "", name: fallbackName, accent: palette[0], slug: "plan-group-0", items: [] };
      systems.push(fallback);
      system = fallback;
      current = fallback;
    }
    system.items.push({ code, title, status });
  }
  return systems.filter(system => system.items.length || system.textSection).map((system) => ({
    ...system,
    total: system.items.length,
    done: system.items.filter((item) => DONE_STATUSES.has(item.status)).length,
  }));
}

async function loadProjectPlan(gid, fallbackName = activePlan?.displayName || "Project") {
  if (location.protocol === "file:") throw new Error("กรุณาเปิดหน้านี้ผ่านเว็บ Netlify หรือ localhost ไม่ใช่เปิดไฟล์ HTML โดยตรง");
  let response;
  try {
    response = await fetch(`https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/export?format=csv&gid=${encodeURIComponent(gid)}`, {
      cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error("เชื่อมต่อบริการอ่านชีตไม่ได้ กรุณาตรวจอินเทอร์เน็ตและเปิดหน้าเว็บใหม่");
  }
  if (!response.ok) {
    throw new Error("อ่านข้อมูลแท็บนี้ไม่สำเร็จ กรุณาตรวจสิทธิ์ Google Sheet");
  }
  return parseProjectPlan(parseCsv(await response.text()), fallbackName);
}

function parseEnvironmentPlan(rows, plan) {
  const normalizedRows = rows.map(row => row.map(cell => String(cell ?? "").trim()));
  if (plan.kind === "environment-dev") return parseDevEnvironmentPlan(normalizedRows, plan);
  return parseUatEnvironmentPlan(normalizedRows, plan);
}

function makeEnvironmentSystem(name, code, items, plan, summary = {}) {
  const measuredDone = items.filter(item => specialDoneStatus(plan, item.status)).length;
  return {
    code: code || "",
    name,
    accent: plan.kind === "environment-uat" ? "#0b6fb3" : "#168fbd",
    slug: `environment-${slugify(name)}`,
    items,
    total: items.length,
    done: measuredDone,
    summary,
    special: plan.kind,
  };
}

function slugify(value) {
  return String(value || "item").toLowerCase().replace(/[^a-z0-9ก-๙]+/gi, "-").replace(/^-|-$/g, "") || "item";
}

function parseDevEnvironmentPlan(rows, plan) {
  const taskHeaderIndex = rows.findIndex(row => row.some(cell => cell === "รหัสงาน") && row.some(cell => cell === "สถานะล่าสุด"));
  if (taskHeaderIndex < 0) return [];
  const headers = rows[taskHeaderIndex];
  const indexOf = name => headers.findIndex(cell => cell === name);
  const records = rows.slice(taskHeaderIndex + 1)
    .filter(row => row[indexOf("รหัสงาน")] && row[indexOf("สถานะล่าสุด")])
    .map(row => ({
      code: row[indexOf("รหัสงาน")],
      machine: row[indexOf("เครื่อง")] || "ไม่ระบุเครื่อง",
      step: row[indexOf("ขั้นตอน")],
      title: row[indexOf("งาน")] || row[indexOf("เกณฑ์ผ่าน")],
      status: row[indexOf("สถานะล่าสุด")],
      owner: row[indexOf("ผู้รับผิดชอบ")],
      priority: row[indexOf("Priority")],
      dependency: row[indexOf("Dependency")],
      next: row[indexOf("ผลล่าสุด / งานต่อ")],
      criteria: row[indexOf("เกณฑ์ผ่าน")],
      reference: row[indexOf("อ้างอิง")],
    }));
  const summaryHeaderIndex = rows.findIndex(row => row[1] === "เครื่อง" && String(row[0] || "").includes("บทบาท"));
  const summaries = new Map();
  if (summaryHeaderIndex >= 0) {
    const summaryHeaders = rows[summaryHeaderIndex];
    const summaryIndex = name => summaryHeaders.findIndex(cell => cell === name);
    for (const row of rows.slice(summaryHeaderIndex + 1)) {
      if (row[0] === "ภาพรวม") break;
      const machine = row[summaryIndex("เครื่อง")];
      if (!machine || machine === "ภาพรวม") continue;
      const ratio = String(row[summaryIndex("รวม ผ่าน/ทั้งหมด")] || "").match(/^(\d+)\/(\d+)$/);
      summaries.set(machine, {
        install: row[summaryIndex("ติดตั้ง ผ่าน/ทั้งหมด")],
        config: row[summaryIndex("Config ผ่าน/ทั้งหมด")],
        integration: row[summaryIndex("Integration ผ่าน/ทั้งหมด")],
        done: ratio ? Number(ratio[1]) : undefined,
        total: ratio ? Number(ratio[2]) : undefined,
      });
    }
  }
  const machineNames = [...new Set([
    ...summaries.keys(),
    ...records.map(record => record.machine),
  ])];
  return machineNames.map(machine => makeEnvironmentSystem(
    machine,
    summaries.get(machine)?.role || "",
    records.filter(record => record.machine === machine),
    plan,
    summaries.get(machine) || {},
  ));
}

function parseUatEnvironmentPlan(rows, plan) {
  const headerIndex = rows.findIndex(row => row.includes("เครื่อง UAT") && row.includes("รหัสงาน UAT") && row.includes("สถานะ UAT"));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const indexOf = name => headers.indexOf(name);
  const records = rows.slice(headerIndex + 1)
    .filter(row => row[indexOf("รหัสงาน UAT")] && row[indexOf("สถานะ UAT")])
    .map(row => ({
      code: row[indexOf("รหัสงาน UAT")],
      machine: row[indexOf("เครื่อง UAT")] || "ไม่ระบุเครื่อง",
      step: row[indexOf("ขั้นตอน")],
      title: row[indexOf("รายการติดตั้ง / Config")],
      status: row[indexOf("สถานะ UAT")],
      sourceStatus: row[indexOf("สถานะ DEV ต้นทาง")],
      owner: row[indexOf("ผู้รับผิดชอบ")],
      priority: row[indexOf("Priority")],
      dependency: row[indexOf("Dependency")],
      next: row[indexOf("หมายเหตุ / งานต่อ")],
      ip: row[indexOf("IP")],
      criteria: row[indexOf("เกณฑ์ตรวจรับ")],
      reference: row[indexOf("อ้างอิง DEV")],
    }));
  return Array.from(new Set(records.map(record => record.machine))).map(machine => makeEnvironmentSystem(
    machine,
    "",
    records.filter(record => record.machine === machine),
    plan,
  ));
}

async function loadSpecialPlan(plan) {
  if (location.protocol === "file:") throw new Error("กรุณาเปิดหน้านี้ผ่านเว็บ Netlify หรือ localhost ไม่ใช่เปิดไฟล์ HTML โดยตรง");
  let response;
  try {
    response = await fetch(`https://docs.google.com/spreadsheets/d/${plan.workbookId}/export?format=csv&gid=${encodeURIComponent(plan.gid)}`, {
      cache: "no-store", credentials: "omit", signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error(`เชื่อมต่อแท็บ ${plan.displayName} ไม่สำเร็จ`);
  }
  if (!response.ok) throw new Error(`อ่านแท็บ ${plan.displayName} ไม่สำเร็จ กรุณาตรวจสิทธิ์ Google Sheet`);
  return parseEnvironmentPlan(parseCsv(await response.text()), plan);
}

function combineDashboardSystems(entries) {
  return entries.map(({ plan, systems }, index) => ({
    code: "",
    name: plan.displayName,
    accent: systems[0]?.accent || "#0b6fb3",
    slug: `dashboard-project-${index}`,
    sourcePlanId: plan.id,
    items: [],
    total: systems.reduce((sum, system) => sum + system.total, 0),
    done: systems.reduce((sum, system) => sum + system.done, 0),
  }));
}

async function loadDashboardPlan() {
  const plans = workbookTabs.filter(plan => !plan.isDashboard && !plan.kind);
  const results = await Promise.allSettled(plans.map(async plan => ({
    plan,
    systems: await loadProjectPlan(plan.gid, plan.displayName),
  })));
  dashboardFailedTabs = results.filter(result => result.status === "rejected").length;
  const entries = results.filter(result => result.status === "fulfilled").map(result => result.value);
  if (!entries.length && dashboardFailedTabs) throw new Error("อ่านข้อมูลทุกแท็บไม่สำเร็จ");
  return combineDashboardSystems(entries);
}

function planTotals() {
  return planSystems.reduce((sum, system) => ({ total: sum.total + system.total, done: sum.done + system.done }), { total: 0, done: 0 });
}

function planPercent() {
  const { total, done } = planTotals();
  return fmtPercent(done, total);
}

function syncPlanBrief() {
  const focus = [...planSystems].sort((a, b) => (b.total - b.done) - (a.total - a.done))[0];
  setText("heroFocusLabel", focus ? (focus.total > focus.done ? focus.name : "พัฒนาครบแล้ว") : activePlan?.displayName || "ยังไม่มีข้อมูล");
  setText("heroFocusDetail", focus ? `ยังต้องติดตาม ${focus.total - focus.done}/${focus.total} ข้อ` : "ยังไม่มีข้อมูลในแท็บนี้");
}

function planBar(system) {
  const percent = fmtPercent(system.done, system.total);
  const label = system.special === "environment-uat" ? "ผ่านการตรวจ UAT" : system.special === "environment-dev" ? "ผ่านตามหลักฐาน" : "พัฒนาแล้ว";
  return `<div class="bar" role="img" aria-label="${label} ${system.done} จาก ${system.total} ข้อ"><span style="width:${percent}%"></span><span style="width:${100 - percent}%"></span></div>`;
}

function statusChipClass(status) {
  const key = String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `status-${key || "other"} ${DONE_STATUSES.has(status) ? "is-done" : ""}`.trim();
}

function isSpecialPlan(plan = activePlan) {
  return Boolean(plan?.kind);
}

function specialDoneStatus(plan, status) {
  return plan?.kind === "environment-dev" || plan?.kind === "environment-uat"
    ? String(status || "").trim().toUpperCase() === "PASS"
    : DONE_STATUSES.has(status);
}

function specialProgressLabel(plan) {
  return plan?.kind === "environment-uat" ? "ผ่านการตรวจ UAT" : "ผ่านตามหลักฐาน";
}

function renderEmptyState(title, detail) {
  return `<article class="empty-state"><div class="empty-mark">0%</div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></article>`;
}

function renderDashboardCard(system) {
  const percent = fmtPercent(system.done, system.total);
  const isEmpty = system.total === 0;
  return `<button type="button" class="dashboard-card${isEmpty ? " is-empty" : ""}" data-project-link="${escapeHtml(system.sourcePlanId)}" aria-label="เปิดแท็บ ${escapeHtml(system.name)}">
    <div class="dashboard-card-head">
      <strong>${escapeHtml(system.name)}</strong>
      <span>${isEmpty ? "-" : `${percent}%`}</span>
    </div>
    ${planBar(system)}
    <div class="dashboard-card-foot">
      <span>พัฒนาแล้ว <b>${system.done}/${system.total}</b></span>
      <span>ติดตาม <b>${system.total - system.done}</b></span>
    </div>
  </button>`;
}

function renderEnvironmentRow(system) {
  const label = specialProgressLabel(activePlan);
  const summary = activePlan.kind === "environment-dev" && Object.values(system.summary).some(Boolean)
    ? `<small>${escapeHtml(system.summary.install || "")} · ${escapeHtml(system.summary.config || "")} · ${escapeHtml(system.summary.integration || "")}</small>`
    : `<small>${system.items.filter(item => item.step === "ติดตั้ง").length} ติดตั้ง · ${system.items.filter(item => item.step === "Config").length} Config</small>`;
  return `<article class="project-row environment-row"><div class="row-name"><strong>${escapeHtml(system.name)}</strong>${summary}</div>${planBar(system)}<div class="row-counts"><span class="done-count">${system.done}/${system.total}</span><span class="problem-count">${system.total - system.done}/${system.total}</span><span class="percent">${fmtPercent(system.done, system.total)}%</span></div></article>`;
}

function environmentStages(items) {
  return [...new Set(items.map(item => item.step || "ไม่ระบุขั้นตอน"))].map(step => {
    const tasks = items.filter(item => (item.step || "ไม่ระบุขั้นตอน") === step);
    return `<div class="environment-stage"><strong>${escapeHtml(step)}</strong><span>${tasks.filter(item => item.status === "PASS").length}/${tasks.length} ผ่าน</span><progress max="${tasks.length}" value="${tasks.filter(item => item.status === "PASS").length}" aria-label="${escapeHtml(step)}"></progress></div>`;
  }).join("");
}

function environmentDependencies(value, allItems) {
  if (!value) return "ไม่ระบุ";
  return String(value).split(/[,;\n]+/).map(part => {
    const code = part.trim();
    const match = allItems.find(item => item.code === code);
    return match ? `${escapeHtml(code)} · ${escapeHtml(match.title)} <span class="status-chip ${statusChipClass(match.status)}">${escapeHtml(match.status)}</span>` : `${escapeHtml(code)} <small>(ยังจับคู่รหัสไม่ได้)</small>`;
  }).join("<br>");
}

function renderEnvironmentOverview() {
  const items = planSystems.flatMap(system => system.items);
  const owners = [...new Set(items.map(item => item.owner || "ยังไม่ระบุ"))];
  return `<section class="environment-overview" aria-label="ขั้นตอนและผู้รับผิดชอบ"><h3>ความคืบหน้าตามขั้นตอน</h3><div class="environment-stages">${environmentStages(items)}</div><div class="environment-owner-filter"><label for="environmentOwner">ผู้รับผิดชอบ</label><select id="environmentOwner"><option value="">ทุกคน · ${items.length} งาน</option>${owners.map(owner => {
    const tasks = items.filter(item => (item.owner || "ยังไม่ระบุ") === owner);
    return `<option value="${escapeHtml(owner)}">${escapeHtml(owner)} · ค้าง ${tasks.filter(item => item.status !== "PASS").length}/${tasks.length} งาน</option>`;
  }).join("")}</select><span id="environmentFilterCount" role="status">แสดง ${items.length} งาน</span></div></section>`;
}

document.getElementById("planDetails")?.addEventListener("change", event => {
  if (event.target.id !== "environmentOwner") return;
  const owner = event.target.value;
  let visible = 0;
  document.querySelectorAll(".environment-task").forEach(row => {
    row.hidden = Boolean(owner && row.dataset.owner !== owner);
    if (!row.hidden) visible++;
  });
  document.querySelectorAll(".environment-detail").forEach(card => {
    const count = [...card.querySelectorAll(".environment-task")].filter(row => !row.hidden).length;
    card.querySelector(".environment-match-count").textContent = `แสดง ${count} งาน`;
  });
  setText("environmentFilterCount", `แสดง ${visible} งาน · ยอดสรุปเป็นงานทั้งหมด`);
});

function renderEnvironmentDetail(system) {
  const label = specialProgressLabel(activePlan);
  const counts = countBy(system.items, item => item.status || "ไม่ระบุ");
  const chips = Object.entries(counts).map(([status, count]) => `<span class="status-chip ${statusChipClass(status)}">${escapeHtml(status)} <strong>${count}</strong></span>`).join("");
  const items = system.items.map(item => {
    const done = specialDoneStatus(activePlan, item.status);
    const meta = [item.step, `ผู้รับผิดชอบ: ${item.owner || "ยังไม่ระบุ"}`, item.priority ? `Priority: ${item.priority}` : ""].filter(Boolean).join(" · ");
    const fields = [["ผลล่าสุด / งานต่อ", item.next], ["เกณฑ์ผ่าน / ตรวจรับ", item.criteria], ["อ้างอิง", item.reference], ["Priority", item.priority], ["IP", item.ip]];
    return `<li class="environment-task ${done ? "is-done" : "needs-followup"}" data-owner="${escapeHtml(item.owner || "ยังไม่ระบุ")}"><details><summary><span class="plan-item-code">${escapeHtml(item.code)}</span><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(meta)}</small></span><span class="status-chip ${statusChipClass(item.status)}">${escapeHtml(item.status)}</span></summary><dl class="environment-fields">${item.sourceStatus ? `<dt>DEV / UAT</dt><dd><span class="status-chip ${statusChipClass(item.sourceStatus)}">DEV: ${escapeHtml(item.sourceStatus)}</span> → <span class="status-chip ${statusChipClass(item.status)}">UAT: ${escapeHtml(item.status)}</span></dd>` : ""}${fields.map(([name, value]) => `<dt>${name}</dt><dd>${escapeHtml(value || "ไม่ระบุ")}</dd>`).join("")}<dt>งานที่ต้องพึ่งพา</dt><dd>${environmentDependencies(item.dependency, planSystems.flatMap(group => group.items))}</dd></dl></details></li>`;
  }).join("");
  const detail = activePlan.kind === "environment-dev"
    ? "สรุปจากสถานะ PASS, CONDITIONAL, PENDING, BLOCKED และ UNTESTED"
    : "สถานะ UAT ต้องตรวจแยกจาก DEV และเริ่มนับ PASS เมื่อมีหลักฐานตรวจจริง";
  const visibleItems = system.items.length < system.total
    ? `แสดงรายละเอียดที่อ่านได้ ${system.items.length}/${system.total} ข้อ`
    : `รายการทั้งหมด ${system.total} ข้อ`;
  return `<article class="detail-card environment-detail" id="${system.slug}" style="--accent:${system.accent}"><div class="detail-head"><div><p class="eyebrow">${escapeHtml(activePlan.displayName)}</p><h3>${escapeHtml(system.name)}</h3><p>${label} ${system.done}/${system.total} ข้อ · ยังไม่ผ่าน ${system.total - system.done} ข้อ</p></div><div class="donut small-donut" style="--percent:${fmtPercent(system.done, system.total)};--accent:${system.accent}"><span>${fmtPercent(system.done, system.total)}%</span><small>${escapeHtml(label)}</small></div></div>${planBar(system)}<div class="environment-stages">${environmentStages(system.items)}</div><div class="status-list">${chips}</div><p class="environment-note">${detail}</p><p class="environment-match-count">แสดง ${system.items.length} งาน</p><details class="plan-items" open><summary>${visibleItems}</summary><ul>${items}</ul></details></article>`;
}

function renderDashboardSearch(query = "") {
  const search = document.getElementById("dashboardSearch");
  const input = document.getElementById("dashboardSearchInput");
  const results = document.getElementById("dashboardSearchResults");
  if (!search || !input || !results) return;

  const isDashboard = Boolean(activePlan?.isDashboard);
  search.hidden = !isDashboard;
  if (!isDashboard) {
    input.value = "";
    results.hidden = true;
    results.innerHTML = "";
    return;
  }

  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("th");
  if (!normalizedQuery) {
    results.hidden = true;
    results.innerHTML = "";
    return;
  }

  const matches = planSystems
    .filter((system) => system.name.toLocaleLowerCase("th").includes(normalizedQuery))
    .slice(0, 8);
  results.innerHTML = matches.length
    ? matches.map((system) => `<button type="button" role="option" data-search-project="${escapeHtml(system.sourcePlanId)}"><strong>${escapeHtml(system.name)}</strong><span>${system.done}/${system.total} ข้อ · ${fmtPercent(system.done, system.total)}%</span></button>`).join("")
    : `<p class="dashboard-search-empty">ไม่พบชื่อระบบที่ค้นหา</p>`;
  results.hidden = false;
}

function setActiveSystemNav(slug) {
  document.querySelectorAll("#systemNav button[data-system-target]").forEach((button) => {
    const active = button.dataset.systemTarget === slug;
    button.classList.toggle("is-active", active);
    if (active) button.setAttribute("aria-current", "location");
    else button.removeAttribute("aria-current");
  });
}

function renderSystemNavigation() {
  const nav = document.getElementById("systemNav");
  if (!nav) return;
  systemNavObserver?.disconnect();
  systemNavObserver = null;
  const visible = Boolean(activePlan && !activePlan.isDashboard && planSystems.length);
  nav.hidden = !visible;
  nav.innerHTML = visible
    ? planSystems.map((system, index) => `<button type="button" class="system-nav-button${index === 0 ? " is-active" : ""}" data-system-target="${escapeHtml(system.slug)}" title="${escapeHtml(system.name)}" aria-label="${escapeHtml(system.code || String(index + 1))} ${escapeHtml(system.name)}"${index === 0 ? ' aria-current="location"' : ""}><span class="system-nav-index">${escapeHtml(system.code || String(index + 1))}</span><span class="system-nav-label">${escapeHtml(system.name)}</span></button>`).join("")
    : "";
  if (!visible) return;

  nav.onclick = (event) => {
    const button = event.target.closest("button[data-system-target]");
    if (!button) return;
    setActiveSystemNav(button.dataset.systemTarget);
    document.getElementById(button.dataset.systemTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  systemNavObserver = new IntersectionObserver((entries) => {
    const visibleEntry = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visibleEntry) setActiveSystemNav(visibleEntry.target.id);
  }, { rootMargin: "-18% 0px -62% 0px", threshold: [0, 0.2, 0.5, 0.8] });
  planSystems.forEach((system) => {
    const section = document.getElementById(system.slug);
    if (section) systemNavObserver.observe(section);
  });
}

document.getElementById("dashboardSearchInput")?.addEventListener("input", (event) => {
  renderDashboardSearch(event.target.value);
});

document.getElementById("dashboardSearchResults")?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-search-project]");
  if (!button) return;
  const input = document.getElementById("dashboardSearchInput");
  if (input) input.value = "";
  renderDashboardSearch("");
  await activateProject(button.dataset.searchProject);
});

function revealPlanRows(planRows) {
  planRows.classList.remove("is-ready");
  requestAnimationFrame(() => planRows.classList.add("is-ready"));
}

function renderProjectPlan() {
  document.getElementById("planView").dataset.planKind = activePlan.kind || "project";
  const { total, done } = planTotals();
  const percent = planPercent();
  setText("planTotal", total);
  setText("planDone", `${done}/${total}`);
  setText("planPending", `${total - done}/${total}`);
  const progressLabel = isSpecialPlan() ? specialProgressLabel(activePlan) : "พัฒนาแล้ว";
  const pendingLabel = isSpecialPlan() ? "ยังไม่ผ่าน" : "ยังต้องติดตาม";
  setText("planDoneRatio", `${percent}% ของรายการที่มีสถานะ`);
  setText("planPendingRatio", `${total ? 100 - percent : 0}% ของรายการที่มีสถานะ`);
  const incomplete = activePlan.isDashboard && dashboardFailedTabs ? ` · อ่านไม่สำเร็จ ${dashboardFailedTabs} แท็บ` : "";
  setText("planMessage", total ? `${activePlan.displayName} · ${total} ข้อที่มีสถานะ${incomplete}` : `${activePlan.displayName} · ยังไม่มีข้อมูล${incomplete}`);
  setText("planSystemCount", total ? `รายการที่มีสถานะ · ${planSystems.length} ระบบ` : "ยังไม่มีรายการที่มีสถานะ");
  setText("planDetailsTitle", isSpecialPlan() ? `รายละเอียด ${planSystems.length} เครื่อง` : `รายละเอียด ${planSystems.length} ระบบ`);
  document.querySelector(".metric-card.is-done .metric-label")?.replaceChildren(progressLabel);
  document.querySelector(".metric-card.is-problem .metric-label")?.replaceChildren(pendingLabel);
  document.getElementById("overallLabel")?.replaceChildren(isSpecialPlan() ? progressLabel : "แก้ไขแล้ว");
  document.getElementById("planDoneLegend")?.replaceChildren(document.createElement("i"), progressLabel);
  document.getElementById("planPendingLegend")?.replaceChildren(document.createElement("i"), pendingLabel);
  document.querySelector("#planDoneLegend i")?.classList.add("swatch", "done");
  document.querySelector("#planPendingLegend i")?.classList.add("swatch", "problem");
  document.querySelector(".section-head .eyebrow")?.replaceChildren(isSpecialPlan() ? "Environment Readiness" : "Project Progress");
  document.querySelector(".section-head h2")?.replaceChildren(isSpecialPlan() ? "ภาพรวมความพร้อมของเครื่อง" : "ภาพรวมความคืบหน้าโครงการ");
  document.querySelector("#planDetailsSection .eyebrow")?.replaceChildren(isSpecialPlan() ? "Environment Detail" : "Project Detail");
  const detailsSection = document.getElementById("planDetailsSection");
  detailsSection.hidden = activePlan.isDashboard;
  const planRows = document.getElementById("planRows");
  planRows.className = activePlan.isDashboard ? "project-table dashboard-grid" : isSpecialPlan() ? "project-table environment-grid" : "project-table";
  renderDashboardSearch();
  planRows.innerHTML = planSystems.length
    ? planSystems.map((system) => activePlan.isDashboard
      ? renderDashboardCard(system)
      : isSpecialPlan() ? renderEnvironmentRow(system)
      : `<article class="project-row"><div class="row-name"><strong>${system.code} ${escapeHtml(system.name)}</strong><small>${system.total} ข้อ</small></div>${planBar(system)}<div class="row-counts"><span class="done-count">${system.done}/${system.total}</span><span class="problem-count">${system.total - system.done}/${system.total}</span><span class="percent">${fmtPercent(system.done, system.total)}%</span></div></article>`).join("")
    : renderEmptyState(activePlan.isDashboard ? "ยังไม่มีข้อมูล Dashboard" : `${activePlan.displayName} ยังไม่มีรายการสถานะ`, activePlan.isDashboard ? "เพิ่มข้อมูลในแท็บโปรเจกต์ แล้ว Dashboard จะสรุปให้อัตโนมัติ" : "แท็บนี้ยังไม่มีรายการที่มีสถานะ แสดงเป็นหน้าว่างไว้ก่อน");
  revealPlanRows(planRows);
  planRows.onclick = async event => {
    const row = event.target.closest("button[data-project-link]");
    if (row) await activateProject(row.dataset.projectLink);
  };
  document.getElementById("planDetails").innerHTML = activePlan.isDashboard ? "" : isSpecialPlan()
    ? renderEnvironmentOverview() + planSystems.map(renderEnvironmentDetail).join("")
    : planSystems.map((system) => {
    const counts = countBy(system.items, (item) => item.status);
    const chips = Object.entries(counts).map(([status, count]) => `<span class="status-chip ${statusChipClass(status)}">${escapeHtml(status)} <strong>${count}</strong></span>`).join("");
    const items = system.items.map((item) => `<li class="${DONE_STATUSES.has(item.status) ? "is-done" : "needs-followup"}"><span class="plan-item-code">${escapeHtml(item.code)}</span><span>${escapeHtml(item.title)}</span><span class="status-chip ${statusChipClass(item.status)}">${escapeHtml(item.status)}</span></li>`).join("");
    return `<article class="detail-card" id="${system.slug}" style="--accent:${system.accent}"><div class="detail-head"><div><p class="eyebrow">${system.code}</p><h3>${escapeHtml(system.name)}</h3><p>พัฒนาแล้ว ${system.done}/${system.total} ข้อ · ติดตาม ${system.total - system.done} ข้อ</p></div><div class="donut small-donut" style="--percent:${fmtPercent(system.done, system.total)};--accent:${system.accent}"><span>${fmtPercent(system.done, system.total)}%</span><small>พัฒนาแล้ว</small></div></div>${planBar(system)}<div class="status-list">${chips}</div><details class="plan-items" open><summary>รายการทั้งหมด ${system.total} ข้อ</summary><ul>${items}</ul></details></article>`;
  }).join("");
  renderSystemNavigation();
}
