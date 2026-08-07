const SHEET_ID = "1vAv6UKV57NoRlDG5a0tL88AI0qfGIcDWr74FLOm8cfA";
const DONE_STATUSES = new Set(["Developed", "Tested"]);

const projectConfig = [
  { name: "DMS 8095", slug: "dms-8095", accent: "#2f73b7" },
  { name: "องค์กรนายจ้าง 8096", slug: "employer-8096", accent: "#7c5cc4" },
  { name: "LCS 8097", slug: "lcs-8097", accent: "#2b8a8a" },
  { name: "e-payslf 8098", slug: "epayslf-8098", accent: "#c06722" },
  { name: "ลงพื้นที่ 8099", slug: "field-8099", accent: "#228b57" },
];

let projects = [];
const REFRESH_INTERVAL_MS = 60_000;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      value += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

async function loadProject(config) {
  const endpoint = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(config.name)}`;
  const response = await fetch(endpoint, { cache: "no-store" });
  if (!response.ok) throw new Error(`อ่านแท็บ ${config.name} ไม่สำเร็จ (${response.status})`);

  const rows = parseCsv(await response.text());
  const headers = rows.shift().map((header) => header.trim());
  const titleIndex = headers.indexOf("หน้าจอ/เมนู/หัวข้อ");
  const statusIndex = headers.indexOf("สถานะ");
  if (titleIndex < 0 || statusIndex < 0) throw new Error(`ไม่พบคอลัมน์สถานะในแท็บ ${config.name}`);

  const items = rows
    .filter((row) => row[titleIndex] && row[titleIndex].trim())
    .map((row) => ({
      title: row[titleIndex].trim(),
      status: (row[statusIndex] && row[statusIndex].trim()) || "ไม่ระบุ",
    }));

  const statusCounts = items.reduce((counts, item) => {
    counts[item.status] = (counts[item.status] || 0) + 1;
    return counts;
  }, {});

  return {
    ...config,
    total: items.length,
    done: items.filter((item) => DONE_STATUSES.has(item.status)).length,
    status: Object.entries(statusCounts)
      .sort(([a], [b]) => Number(DONE_STATUSES.has(b)) - Number(DONE_STATUSES.has(a)))
      .map(([name, count]) => [name, count, DONE_STATUSES.has(name)]),
    notes: items.filter((item) => !DONE_STATUSES.has(item.status)).map((item) => `${item.title} — ${item.status}`),
  };
}

const fmtPercent = (done, total) => (total ? Math.round((done / total) * 100) : 0);
const problemOf = (project) => project.total - project.done;

function setOverallNumbers() {
  const totalJobs = projects.reduce((sum, project) => sum + project.total, 0);
  const doneJobs = projects.reduce((sum, project) => sum + project.done, 0);
  const problemJobs = totalJobs - doneJobs;
  const donePercent = fmtPercent(doneJobs, totalJobs);

  document.getElementById("totalJobs").textContent = totalJobs.toString();
  document.getElementById("doneJobs").textContent = `${doneJobs}/${totalJobs}`;
  document.getElementById("problemJobs").textContent = `${problemJobs}/${totalJobs}`;
  document.getElementById("doneRatio").textContent = `${donePercent}% ของงานทั้งหมด`;
  document.getElementById("problemRatio").textContent = `${100 - donePercent}% ของงานทั้งหมด`;
  document.getElementById("overallPercent").textContent = `${donePercent}%`;
  document.getElementById("overallDonut").style.setProperty("--percent", donePercent);
}

function renderTabs() {
  const tabs = document.getElementById("projectTabs");
  tabs.innerHTML = projects.map((project, index) =>
    `<button type="button" data-target="${project.slug}" class="${index === 0 ? "is-active" : ""}">${project.name}</button>`,
  ).join("");

  tabs.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelectorAll(".detail-card").forEach((card) => card.classList.remove("is-highlight"));
    const target = document.getElementById(button.dataset.target);
    target.classList.add("is-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

function renderRows() {
  document.getElementById("projectRows").innerHTML = projects.map((project) => {
    const donePercent = fmtPercent(project.done, project.total);
    const problem = problemOf(project);
    return `<article class="project-row">
      <div class="row-name"><strong>${project.name}</strong><small>รวม ${project.total} งาน</small></div>
      <div class="bar" aria-label="${project.name}: แก้แล้ว ${project.done} งาน ติดปัญหา ${problem} งาน">
        <span style="width:${donePercent}%"></span><span style="width:${100 - donePercent}%"></span>
      </div>
      <div class="row-counts"><span class="done-count">${project.done}/${project.total}</span><span class="problem-count">${problem}/${project.total}</span><span class="percent">${donePercent}%</span></div>
    </article>`;
  }).join("");
}

function renderDetails() {
  document.getElementById("detailGrid").innerHTML = projects.map((project, index) => {
    const donePercent = fmtPercent(project.done, project.total);
    const problem = problemOf(project);
    const notes = project.notes.length
      ? project.notes.map((note) => `<li>${note}</li>`).join("")
      : "<li>ไม่มีงานค้าง</li>";
    const statuses = project.status.map(([name, count, isDone]) =>
      `<span class="status-chip ${isDone ? "is-done" : ""}">${name} <strong>${count}</strong></span>`,
    ).join("");

    return `<article id="${project.slug}" class="detail-card ${index === 0 ? "is-highlight" : ""}" style="--accent:${project.accent}">
      <div class="detail-head"><div><h3>${project.name}</h3><p>แก้แล้ว ${project.done}/${project.total} งาน • ติดปัญหา ${problem}/${project.total} งาน</p></div>
        <div class="donut small-donut" style="--percent:${donePercent}; --accent:${project.accent}"><span>${donePercent}%</span><small>แก้แล้ว</small></div></div>
      <div class="mini-stats"><span class="mini-stat">แก้ไขแล้ว <strong>${project.done}</strong></span><span class="mini-stat">ติดปัญหา <strong>${problem}</strong></span><span class="mini-stat">ทั้งหมด <strong>${project.total}</strong></span></div>
      <div class="bar" aria-hidden="true"><span style="width:${donePercent}%"></span><span style="width:${100 - donePercent}%"></span></div>
      <ul class="notes">${notes}</ul><div class="status-list" aria-label="สถานะในชีต">${statuses}</div>
    </article>`;
  }).join("");
}

function renderFocus() {
  const focus = [...projects].sort((a, b) => problemOf(b) - problemOf(a));
  const text = focus.slice(0, 3).map((project) => `${project.name} ${problemOf(project)}/${project.total}`).join(" ตามด้วย ");
  document.querySelector(".focus-strip span").textContent = `${focus[0].name} เหลืองานติดปัญหามากสุด ${text.replace(`${focus[0].name} ${problemOf(focus[0])}/${focus[0].total}`, `${problemOf(focus[0])}/${focus[0].total}`)}`;
}

async function refreshDashboard() {
  try {
    const latestProjects = await Promise.all(projectConfig.map(loadProject));
    projects = latestProjects;
    setOverallNumbers();
    renderTabs();
    renderRows();
    renderDetails();
    renderFocus();
    document.querySelector(".updated").textContent = `ข้อมูลล่าสุด ${new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date())}`;
  } catch (error) {
    console.error(error);
    document.querySelector(".updated").textContent = "อัปเดตข้อมูล Google Sheet ไม่สำเร็จ";
    if (!projects.length) {
      document.getElementById("projectRows").innerHTML = `<p role="alert">${error.message} — กรุณาตรวจสอบว่าสิทธิ์ของชีตเป็น “ทุกคนที่มีลิงก์ดูได้”</p>`;
    }
  }
}

refreshDashboard();
setInterval(refreshDashboard, REFRESH_INTERVAL_MS);
