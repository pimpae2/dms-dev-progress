let planSystems = [];
let workbookTabs = [];
let activePlan = null;
let planRequest = 0;
let dashboardFailedTabs = 0;
const PROJECT_WORKBOOK_ID = "1Hi1M7GNhA5G2p7BgiGLH3F5A3aKgO2A-iU46XGOvFC8";
const DASHBOARD_PLAN = { id: "dashboard", displayName: "Dashboard", isDashboard: true };

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
  const planTabs = document.getElementById("planTabs");
  const detailsSection = document.getElementById("planDetailsSection");
  planTabs.hidden = true;
  detailsSection.hidden = true;
  planTabs.innerHTML = "";
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
    workbookTabs = [DASHBOARD_PLAN, ...await loadWorkbookTabs()];
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
    setText("heroSubtitle", "Project Progress · นับเฉพาะข้อที่มีสถานะ · Developed และ Tested ถือว่าพัฒนาแล้ว");
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
  const titleHeaders = ["คำอธิบาย", "หน้าจอ/เมนู/หัวข้อ"];
  const headerIndex = rows.findIndex((row) => titleHeaders.some(header => row.includes(header)) && row.includes("สถานะ"));
  if (headerIndex < 0) return [];
  const headers = rows[headerIndex];
  const titleIndex = titleHeaders.map(header => headers.indexOf(header)).find(index => index >= 0);
  const statusIndex = headers.indexOf("สถานะ");
  const codeIndex = titleIndex - 1;
  const palette = ["#0b6fb3", "#168fbd", "#2d83c5", "#3e75c7", "#0b9abd"];
  const systems = [];
  let current = null;
  let fallback = null;
  for (const row of rows.slice(headerIndex + 1)) {
    const code = String(row[codeIndex] || "").trim();
    const title = String(row[titleIndex] || "").trim();
    const status = String(row[statusIndex] || "").trim();
    if (code && title && !status && /^\d+(?:\.\d+)*$/.test(code)) {
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
  return systems.filter(system => system.items.length).map((system) => ({
    ...system,
    total: system.items.length,
    done: system.items.filter((item) => DONE_STATUSES.has(item.status)).length,
  }));
}

async function loadProjectPlan(gid, fallbackName = activePlan?.displayName || "Project") {
  if (location.protocol === "file:") throw new Error("กรุณาเปิดหน้านี้ผ่านเว็บ Netlify หรือ localhost ไม่ใช่เปิดไฟล์ HTML โดยตรง");
  let response;
  try {
    response = await fetch(`https://docs.google.com/spreadsheets/d/${PROJECT_WORKBOOK_ID}/gviz/tq?tqx=out:csv&gid=${encodeURIComponent(gid)}`, {
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
  const plans = workbookTabs.filter(plan => !plan.isDashboard);
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
  return `<div class="bar" role="img" aria-label="พัฒนาแล้ว ${system.done} จาก ${system.total} ข้อ"><span style="width:${percent}%"></span><span style="width:${100 - percent}%"></span></div>`;
}

function statusChipClass(status) {
  const key = String(status || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `status-${key || "other"} ${DONE_STATUSES.has(status) ? "is-done" : ""}`.trim();
}

function renderEmptyState(title, detail) {
  return `<article class="empty-state"><div class="empty-mark">0%</div><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div></article>`;
}

function renderDashboardCard(system) {
  const percent = fmtPercent(system.done, system.total);
  return `<button type="button" class="dashboard-card" data-project-link="${escapeHtml(system.sourcePlanId)}" aria-label="เปิดแท็บ ${escapeHtml(system.name)}">
    <div class="dashboard-card-head">
      <strong>${escapeHtml(system.name)}</strong>
      <span>${percent}%</span>
    </div>
    ${planBar(system)}
    <div class="dashboard-card-foot">
      <span>พัฒนาแล้ว <b>${system.done}/${system.total}</b></span>
      <span>ติดตาม <b>${system.total - system.done}</b></span>
    </div>
  </button>`;
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
  const { total, done } = planTotals();
  const percent = planPercent();
  setText("planTotal", total);
  setText("planDone", `${done}/${total}`);
  setText("planPending", `${total - done}/${total}`);
  setText("planDoneRatio", `${percent}% ของรายการที่มีสถานะ`);
  setText("planPendingRatio", `${total ? 100 - percent : 0}% ของรายการที่มีสถานะ`);
  const incomplete = activePlan.isDashboard && dashboardFailedTabs ? ` · อ่านไม่สำเร็จ ${dashboardFailedTabs} แท็บ` : "";
  setText("planMessage", total ? `${activePlan.displayName} · ${total} ข้อที่มีสถานะ${incomplete}` : `${activePlan.displayName} · ยังไม่มีข้อมูล${incomplete}`);
  setText("planSystemCount", total ? `รายการที่มีสถานะ · ${planSystems.length} ระบบ` : "ยังไม่มีรายการที่มีสถานะ");
  setText("planDetailsTitle", `รายละเอียด ${planSystems.length} ระบบ`);
  const planTabs = document.getElementById("planTabs");
  const detailsSection = document.getElementById("planDetailsSection");
  planTabs.hidden = activePlan.isDashboard;
  detailsSection.hidden = activePlan.isDashboard;
  planTabs.innerHTML = activePlan.isDashboard ? "" : planSystems.map((system) => `<button type="button" data-plan-target="${system.slug}">${system.code} ${escapeHtml(system.name)}</button>`).join("");
  planTabs.onclick = (event) => {
    const button = event.target.closest("button[data-plan-target]");
    if (!button) return;
    document.getElementById(button.dataset.planTarget).scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const planRows = document.getElementById("planRows");
  planRows.className = activePlan.isDashboard ? "project-table dashboard-grid" : "project-table";
  renderDashboardSearch();
  planRows.innerHTML = planSystems.length
    ? planSystems.map((system) => activePlan.isDashboard
      ? renderDashboardCard(system)
      : `<article class="project-row"><div class="row-name"><strong>${system.code} ${escapeHtml(system.name)}</strong><small>${system.total} ข้อ</small></div>${planBar(system)}<div class="row-counts"><span class="done-count">${system.done}/${system.total}</span><span class="problem-count">${system.total - system.done}/${system.total}</span><span class="percent">${fmtPercent(system.done, system.total)}%</span></div></article>`).join("")
    : renderEmptyState(activePlan.isDashboard ? "ยังไม่มีข้อมูล Dashboard" : `${activePlan.displayName} ยังไม่มีรายการสถานะ`, activePlan.isDashboard ? "เพิ่มข้อมูลในแท็บโปรเจกต์ แล้ว Dashboard จะสรุปให้อัตโนมัติ" : "แท็บนี้ยังไม่มีรายการที่มีสถานะ แสดงเป็นหน้าว่างไว้ก่อน");
  revealPlanRows(planRows);
  planRows.onclick = async event => {
    const row = event.target.closest("button[data-project-link]");
    if (row) await activateProject(row.dataset.projectLink);
  };
  document.getElementById("planDetails").innerHTML = activePlan.isDashboard ? "" : planSystems.map((system) => {
    const counts = countBy(system.items, (item) => item.status);
    const chips = Object.entries(counts).map(([status, count]) => `<span class="status-chip ${statusChipClass(status)}">${escapeHtml(status)} <strong>${count}</strong></span>`).join("");
    const items = system.items.map((item) => `<li class="${DONE_STATUSES.has(item.status) ? "is-done" : "needs-followup"}"><span class="plan-item-code">${escapeHtml(item.code)}</span><span>${escapeHtml(item.title)}</span><span class="status-chip ${statusChipClass(item.status)}">${escapeHtml(item.status)}</span></li>`).join("");
    return `<article class="detail-card" id="${system.slug}" style="--accent:${system.accent}"><div class="detail-head"><div><p class="eyebrow">${system.code}</p><h3>${escapeHtml(system.name)}</h3><p>พัฒนาแล้ว ${system.done}/${system.total} ข้อ · ติดตาม ${system.total - system.done} ข้อ</p></div><div class="donut small-donut" style="--percent:${fmtPercent(system.done, system.total)};--accent:${system.accent}"><span>${fmtPercent(system.done, system.total)}%</span><small>พัฒนาแล้ว</small></div></div>${planBar(system)}<div class="status-list">${chips}</div><details class="plan-items" open><summary>รายการทั้งหมด ${system.total} ข้อ</summary><ul>${items}</ul></details></article>`;
  }).join("");
}
