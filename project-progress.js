let planSystems = [];
let activePlan = null;
let planRequest = 0;

async function initProjectPlans() {
  try {
    const config = await readPlanConfig();
    const plans = config.plans.filter(plan => plan.enabled);
    const requested = new URLSearchParams(location.search).get("plan");
    activePlan = plans.find(plan => plan.id === requested) || (!requested ? plans[0] : null);
    const tabs = document.getElementById("planSourceTabs");
    tabs.hidden = plans.length < 2;
    tabs.innerHTML = plans.map(plan => `<a href="/project_plan?plan=${encodeURIComponent(plan.id)}" ${activePlan?.id === plan.id ? 'class="is-active" aria-current="page"' : ''}>${escapeHtml(plan.name)}</a>`).join("");
    if (!activePlan) {
      setText("planMessage", requested ? "ไม่พบชุดข้อมูลนี้ หรือถูกปิดการแสดง" : "ยังไม่มีชุดข้อมูลที่เปิดแสดง เพิ่มได้ที่หน้าตั้งค่า");
      setText("heroFocusLabel", "ยังไม่มีข้อมูล");
      setText("heroFocusDetail", "เลือกหรือเพิ่มชุดข้อมูลที่หน้าตั้งค่า");
      setText("heroSubtitle", "เลือกชุดข้อมูลเพื่อดูความคืบหน้าโครงการ");
      setText("planFocus", "ยังไม่มีข้อมูล");
      setText("planDoneRatio", "ยังไม่มีข้อมูล");
      setText("planPendingRatio", "ยังไม่มีข้อมูล");
      document.querySelector(".updated").textContent = "ยังไม่มีชุดข้อมูลที่เลือก";
      return;
    }
    document.querySelector(".hero h1").textContent = activePlan.name;
    setText("heroSubtitle", "Project Progress · นับเฉพาะข้อที่มีสถานะ · Developed และ Tested ถือว่าพัฒนาแล้ว");
    await refreshProjectPlan();
  } catch (error) { setText("planMessage", error.message); }
}

async function refreshProjectPlan() {
  if (!activePlan) return;
  const request = ++planRequest;
  try {
    const systems = await loadProjectPlan(activePlan.url);
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

function parseProjectPlan(rows) {
  rows = rows.map(row => row.map(cell => String(cell ?? "").trim()));
  const headerIndex = rows.findIndex((row) => row.includes("คำอธิบาย") && row.includes("สถานะ"));
  if (headerIndex < 0) throw new Error("ไม่พบคอลัมน์คำอธิบายและสถานะ");
  const headers = rows[headerIndex];
  const titleIndex = headers.indexOf("คำอธิบาย");
  const statusIndex = headers.indexOf("สถานะ");
  const codeIndex = titleIndex - 1;
  const palette = ["#7c5cc4", "#c06722", "#228b57", "#2f73b7", "#2b8a8a"];
  const systems = [];
  let current = null;
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
    const system = [...systems].reverse().find(item => code.startsWith(`${item.code}.`)) || current;
    if (!system) throw new Error(`ข้อ ${code} ไม่มีหัวข้อระบบ กรุณาตรวจรูปแบบชีต`);
    system.items.push({ code, title, status });
  }
  if (!systems.some((system) => system.items.length)) throw new Error("ไม่พบข้อที่มีสถานะใต้หัวข้อระบบ");
  return systems.filter(system => system.items.length).map((system) => ({
    ...system,
    total: system.items.length,
    done: system.items.filter((item) => DONE_STATUSES.has(item.status)).length,
  }));
}

async function loadProjectPlan(link) {
  const { spreadsheetId, gid } = parseSheetLink(link);
  const response = await fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("อ่านชีตไม่ได้ กรุณาตรวจลิงก์และสิทธิ์การเข้าถึง");
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
  setText("planMessage", `${activePlan.name} · ${total} ข้อที่มีสถานะ`);
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
