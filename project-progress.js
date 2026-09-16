let planSystems = [];

async function refreshProjectPlan() {
  try {
    planSystems = await loadProjectPlan();
    renderProjectPlan();
    syncHeroMeter();
    syncPlanBrief();
    const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    document.querySelector(".updated").textContent = `ข้อมูลล่าสุด ${updatedAt}`;
  } catch (error) {
    setText("planMessage", `อัปเดต Project Progress ไม่สำเร็จ${planSystems.length ? " · แสดงข้อมูลครั้งล่าสุด" : ""}: ${error.message}`);
    document.querySelector(".updated").textContent = "อัปเดตข้อมูลไม่สำเร็จ";
  }
}

function parseProjectPlan(rows) {
  const headerIndex = rows.findIndex((row) => row.includes("คำอธิบาย") && row.includes("สถานะ"));
  if (headerIndex < 0) throw new Error("ไม่พบคอลัมน์คำอธิบายและสถานะ");
  const headers = rows[headerIndex];
  const titleIndex = headers.indexOf("คำอธิบาย");
  const statusIndex = headers.indexOf("สถานะ");
  const codeIndex = titleIndex - 1;
  const systems = [
    { code: "1.1", name: "ระบบองค์กรนายจ้าง (จนท.กองทุน)", accent: "#7c5cc4" },
    { code: "1.2", name: "ระบบ ePaySLF", accent: "#c06722" },
    { code: "1.3", name: "ระบบลงพื้นที่ e-PaySLF", accent: "#228b57" },
  ].map((system) => ({ ...system, slug: `plan-${system.code.replace(".", "-")}`, items: [] }));
  for (const row of rows.slice(headerIndex + 1)) {
    const code = String(row[codeIndex] || "").trim();
    const title = String(row[titleIndex] || "").trim();
    const status = String(row[statusIndex] || "").trim();
    const system = systems.find((item) => code.startsWith(`${item.code}.`));
    if (system && title && status) system.items.push({ code, title, status });
  }
  if (!systems.some((system) => system.items.length)) throw new Error("ไม่พบข้อที่มีสถานะใน 3 ระบบ");
  return systems.map((system) => ({
    ...system,
    total: system.items.length,
    done: system.items.filter((item) => DONE_STATUSES.has(item.status)).length,
  }));
}

async function loadProjectPlan() {
  return parseProjectPlan(await fetchCsvRows({ gid: "1021126458", displayName: "Project Plan_ORG" }));
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
  setText("planMessage", `Project Plan_ORG · ${total} ข้อที่มีสถานะ${total !== 49 ? " · จำนวนรายการปัจจุบันต่างจาก 49 ข้อเดิม" : ""}`);
  const pending = planSystems.filter((system) => system.done < system.total);
  setText("planFocus", pending.length ? pending.map((system) => `${system.name} เหลือ ${system.total - system.done} ข้อ`).join(" · ") : "พัฒนาครบทั้ง 3 ระบบแล้ว");
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
