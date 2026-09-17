let planSystems = [];
let workbookTabs = [];
let activePlan = null;
let planRequest = 0;

function projectDisplayName(name) {
  return String(name || "").replace(/^Project\s*Plan[_\s-]*/i, "").trim() || String(name || "Project Progress");
}

async function loadWorkbookTabs() {
  const response = await fetch("/api/workbook", { cache: "no-store", signal: AbortSignal.timeout(25000) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(result.tabs)) throw new Error(result.error || "อ่านรายชื่อโปรเจกต์ไม่สำเร็จ");
  return result.tabs.map(tab => ({ ...tab, id: tab.gid, displayName: projectDisplayName(tab.name) }));
}

function renderProjectSourceTabs() {
  const tabs = document.getElementById("planSourceTabs");
  tabs.innerHTML = workbookTabs.map(plan => `<button type="button" data-project-gid="${plan.gid}" ${activePlan?.gid === plan.gid ? 'class="is-active" aria-current="page"' : ""}>${escapeHtml(plan.displayName)}</button>`).join("");
}

function showNoProject(message) {
  setText("planMessage", message);
  setText("heroFocusLabel", "ยังไม่มีข้อมูล");
  setText("heroFocusDetail", "เพิ่มแท็บใน Google Sheet เพื่อแสดงโปรเจกต์");
  setText("heroSubtitle", "ยังไม่พบแท็บโปรเจกต์ที่เปิดอ่านได้");
  setText("planFocus", "ยังไม่มีข้อมูล");
  setText("planDoneRatio", "ยังไม่มีข้อมูล");
  setText("planPendingRatio", "ยังไม่มีข้อมูล");
  document.querySelector(".updated").textContent = "ยังไม่มีโปรเจกต์ที่เลือก";
}

async function initProjectPlans() {
  try {
    workbookTabs = await loadWorkbookTabs();
    const requested = new URLSearchParams(location.search).get("project");
    activePlan = workbookTabs.find(plan => plan.gid === requested)
      || workbookTabs.find(plan => plan.gid === activePlan?.gid)
      || workbookTabs[0]
      || null;
    if (requested && activePlan && activePlan.gid !== requested) history.replaceState(null, "", `/?project=${encodeURIComponent(activePlan.gid)}`);
    renderProjectSourceTabs();
    if (!activePlan) {
      showNoProject("ยังไม่พบแท็บใน Google Sheet");
      return;
    }
    document.querySelector(".hero h1").textContent = activePlan.displayName;
    setText("heroSubtitle", "Project Progress · นับเฉพาะข้อที่มีสถานะ · Developed และ Tested ถือว่าพัฒนาแล้ว");
    await refreshProjectPlan();
  } catch (error) { setText("planMessage", error.message); }
}

document.getElementById("planSourceTabs")?.addEventListener("click", async event => {
  const button = event.target.closest("button[data-project-gid]");
  if (!button || button.dataset.projectGid === activePlan?.gid) return;
  activePlan = workbookTabs.find(plan => plan.gid === button.dataset.projectGid) || null;
  if (!activePlan) return;
  planSystems = [];
  renderProjectSourceTabs();
  document.querySelector(".hero h1").textContent = activePlan.displayName;
  history.replaceState(null, "", `/?project=${encodeURIComponent(activePlan.gid)}`);
  setText("planMessage", `กำลังอ่าน ${activePlan.displayName}`);
  await refreshProjectPlan();
});

async function refreshProjectPlan() {
  if (!activePlan) return;
  const request = ++planRequest;
  try {
    const systems = await loadProjectPlan(activePlan.gid);
    if (request !== planRequest) return;
    planSystems = systems;
    renderProjectPlan();
    syncHeroMeter();
    syncPlanBrief();
    const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    document.querySelector(".updated").textContent = `ข้อมูลล่าสุด ${updatedAt}`;
  } catch (error) {
    if (request !== planRequest) return;
    setText("planMessage", `อัปเดต Project Progress ไม่สำเร็จ${planSystems.length ? " · แสดงข้อมูลครั้งล่าสุด" : ""}: ${error.message}`);
    document.querySelector(".updated").textContent = "อัปเดตข้อมูลไม่สำเร็จ";
  }
}

function parseProjectPlan(rows, fallbackName = activePlan?.displayName || "Project") {
  rows = rows.map(row => row.map(cell => String(cell ?? "").trim()));
  const titleHeaders = ["คำอธิบาย", "หน้าจอ/เมนู/หัวข้อ"];
  const headerIndex = rows.findIndex((row) => titleHeaders.some(header => row.includes(header)) && row.includes("สถานะ"));
  if (headerIndex < 0) throw new Error("ไม่พบคอลัมน์หน้าจอ/เมนู/หัวข้อและสถานะ");
  const headers = rows[headerIndex];
  const titleIndex = titleHeaders.map(header => headers.indexOf(header)).find(index => index >= 0);
  const statusIndex = headers.indexOf("สถานะ");
  const codeIndex = titleIndex - 1;
  const palette = ["#7c5cc4", "#c06722", "#228b57", "#2f73b7", "#2b8a8a"];
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
  if (!systems.some((system) => system.items.length)) throw new Error("ไม่พบข้อที่มีสถานะใต้หัวข้อระบบ");
  return systems.filter(system => system.items.length).map((system) => ({
    ...system,
    total: system.items.length,
    done: system.items.filter((item) => DONE_STATUSES.has(item.status)).length,
  }));
}

async function loadProjectPlan(gid) {
  if (location.protocol === "file:") throw new Error("กรุณาเปิดหน้านี้ผ่านเว็บ Netlify หรือ localhost ไม่ใช่เปิดไฟล์ HTML โดยตรง");
  let response;
  try {
    response = await fetch(`/api/sheet?gid=${encodeURIComponent(gid)}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error("เชื่อมต่อบริการอ่านชีตไม่ได้ กรุณาตรวจอินเทอร์เน็ตและเปิดหน้าเว็บใหม่");
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "ไม่พบบริการอ่านชีต กรุณา Deploy พร้อม Netlify Functions หรือเริ่มเซิร์ฟเวอร์ใหม่");
  }
  if (!response.headers.get("content-type")?.includes("text/csv")) throw new Error("ยังไม่มีบริการอ่านชีต กรุณา Deploy พร้อม Netlify Functions");
  return parseProjectPlan(parseCsv(await response.text()));
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
  setText("heroFocusLabel", focus ? (focus.total > focus.done ? focus.name : "พัฒนาครบแล้ว") : "กำลังโหลดข้อมูล");
  setText("heroFocusDetail", focus ? `ยังต้องติดตาม ${focus.total - focus.done}/${focus.total} ข้อ` : "อ่าน Project Plan_ORG");
}

function planBar(system) {
  const percent = fmtPercent(system.done, system.total);
  return `<div class="bar" role="img" aria-label="พัฒนาแล้ว ${system.done} จาก ${system.total} ข้อ"><span style="width:${percent}%"></span><span style="width:${100 - percent}%"></span></div>`;
}

function renderProjectPlan() {
  const { total, done } = planTotals();
  const percent = planPercent();
  setText("planTotal", total);
  setText("planDone", `${done}/${total}`);
  setText("planPending", `${total - done}/${total}`);
  setText("planDoneRatio", `${percent}% ของรายการที่มีสถานะ`);
  setText("planPendingRatio", `${100 - percent}% ของรายการที่มีสถานะ`);
  setText("planMessage", `${activePlan.displayName} · ${total} ข้อที่มีสถานะ`);
  setText("planSystemCount", `รายการที่มีสถานะ · ${planSystems.length} ระบบ`);
  setText("planDetailsTitle", `รายละเอียด ${planSystems.length} ระบบ`);
  const pending = planSystems.filter((system) => system.done < system.total);
  setText("planFocus", pending.length ? pending.map((system) => `${system.name} เหลือ ${system.total - system.done} ข้อ`).join(" · ") : "พัฒนาครบทุกระบบแล้ว");
  document.getElementById("planTabs").innerHTML = planSystems.map((system) => `<button type="button" data-plan-target="${system.slug}">${system.code} ${escapeHtml(system.name)}</button>`).join("");
  document.getElementById("planTabs").onclick = (event) => {
    const button = event.target.closest("button[data-plan-target]");
    if (!button) return;
    document.getElementById(button.dataset.planTarget).scrollIntoView({ behavior: "smooth", block: "start" });
  };
  document.getElementById("planRows").innerHTML = planSystems.map((system) => `<article class="project-row"><div class="row-name"><strong>${system.code} ${escapeHtml(system.name)}</strong><small>${system.total} ข้อ</small></div>${planBar(system)}<div class="row-counts"><span class="done-count">${system.done}/${system.total}</span><span class="problem-count">${system.total - system.done}/${system.total}</span><span class="percent">${fmtPercent(system.done, system.total)}%</span></div></article>`).join("");
  document.getElementById("planDetails").innerHTML = planSystems.map((system) => {
    const counts = countBy(system.items, (item) => item.status);
    const chips = Object.entries(counts).map(([status, count]) => `<span class="status-chip ${DONE_STATUSES.has(status) ? "is-done" : ""}">${escapeHtml(status)} <strong>${count}</strong></span>`).join("");
    const items = system.items.map((item) => `<li><span class="plan-item-code">${escapeHtml(item.code)}</span><span>${escapeHtml(item.title)}</span><span class="status-chip ${DONE_STATUSES.has(item.status) ? "is-done" : ""}">${escapeHtml(item.status)}</span></li>`).join("");
    return `<article class="detail-card" id="${system.slug}" style="--accent:${system.accent}"><div class="detail-head"><div><p class="eyebrow">${system.code}</p><h3>${escapeHtml(system.name)}</h3><p>พัฒนาแล้ว ${system.done}/${system.total} ข้อ · ติดตาม ${system.total - system.done} ข้อ</p></div><div class="donut small-donut" style="--percent:${fmtPercent(system.done, system.total)};--accent:${system.accent}"><span>${fmtPercent(system.done, system.total)}%</span><small>พัฒนาแล้ว</small></div></div>${planBar(system)}<div class="status-list">${chips}</div><details class="plan-items" open><summary>รายการทั้งหมด ${system.total} ข้อ</summary><ul>${items}</ul></details></article>`;
  }).join("");
}
