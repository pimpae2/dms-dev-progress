const SHEET_ID = "1vAv6UKV57NoRlDG5a0tL88AI0qfGIcDWr74FLOm8cfA";
const DEV_SHEET_GID = "1262019974";
const DOCUMENT_SHEET_GID = "345092171";
const DONE_STATUSES = new Set(["Developed", "Tested"]);
const DOCUMENT_READY_STATUSES = new Set(["เซ็นหน้าจอแล้ว", "ส่งแล้ว"]);
const DOCUMENT_EMPTY_STATUS = "ยังไม่ระบุ";
const REFRESH_INTERVAL_MS = 60_000;

const projectConfig = [
  { name: "DMS 8095", slug: "dms-8095", accent: "#2f73b7" },
  { name: "องค์กรนายจ้าง 8096", slug: "employer-8096", accent: "#7c5cc4" },
  { name: "LCS 8097", slug: "lcs-8097", accent: "#2b8a8a" },
  { name: "e-payslf 8098", slug: "epayslf-8098", accent: "#c06722" },
  { name: "ลงพื้นที่ 8099", slug: "field-8099", accent: "#228b57" },
];

const sheetLinks = {
  dev: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${DEV_SHEET_GID}#gid=${DEV_SHEET_GID}`,
  documents: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?gid=${DOCUMENT_SHEET_GID}#gid=${DOCUMENT_SHEET_GID}`,
};

const heroSubtitles = {
  dev: "เกณฑ์การนับ: <strong>Tested</strong> และ <strong>Developed</strong> คือจำนวนงานที่แก้ไขแล้ว ส่วนสถานะอื่นทั้งหมดนับเป็นงานติดปัญหา/ยังไม่จบ",
  documents: "งานเอกสารอ่านจากแท็บเอกสารส่งเซ็นหน้าจอ โดยแสดงสถานะของแต่ละระบบแยกตามตัวงาน",
};

const documentStatusOrder = [
  "เซ็นหน้าจอแล้ว",
  "ส่งแล้ว",
  "เสร็จแล้วรอตรวจ",
  "อยู่ระหว่างจัดทำ",
  DOCUMENT_EMPTY_STATUS,
];

const documentGroups = ["signed", "sent", "review", "progress", "empty", "other"];
const documentGroupLabels = {
  signed: "เซ็นแล้ว",
  sent: "ส่งแล้ว",
  review: "รอตรวจ",
  progress: "จัดทำ",
  empty: "ยังไม่ระบุ",
  other: "อื่นๆ",
};

const documentWorkstreamConfig = [
  {
    id: "screen-sign",
    title: "กองเอกสารเซ็นหน้าจอ",
    shortTitle: "เอกสารเซ็นหน้าจอ",
    subtitle: "ข้อ 1 ใช้ติดตามส่งเซ็นหน้าจอ",
    accent: "#315fba",
  },
  {
    id: "delivery",
    title: "กองเอกสารส่งงาน",
    shortTitle: "เอกสารส่งงาน",
    subtitle: "ข้อ 2 เป็นต้นไป ใช้ติดตามเอกสารส่งงาน",
    accent: "#557a95",
  },
];

let activeView = "dev";
let projects = [];
let documentSummary = createEmptyDocumentSummary();

function createEmptyDocumentSummary() {
  return {
    systems: [],
    documents: [],
    workstreams: [],
    total: 0,
    ready: 0,
    followUp: 0,
    status: [],
  };
}

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

function csvEndpoint(source) {
  const sheetSelector = source.gid
    ? `gid=${encodeURIComponent(source.gid)}`
    : `sheet=${encodeURIComponent(source.sheetName)}`;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&${sheetSelector}`;
}

async function fetchCsvRows(source) {
  const response = await fetch(csvEndpoint(source), { cache: "no-store" });
  if (!response.ok) throw new Error(`อ่านแท็บ ${source.displayName || source.sheetName || source.gid} ไม่สำเร็จ (${response.status})`);
  return parseCsv(await response.text());
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function safeDriveUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const isGoogleDrive = host === "drive.google.com" || host === "docs.google.com";
    return url.protocol === "https:" && isGoogleDrive ? url.href : "";
  } catch {
    return "";
  }
}

function normalizeDocumentStatus(value) {
  const status = String(value || "").trim();
  return status || DOCUMENT_EMPTY_STATUS;
}

function getDocumentStatusGroup(status) {
  if (status === "เซ็นหน้าจอแล้ว") return "signed";
  if (status === "ส่งแล้ว") return "sent";
  if (status === "เสร็จแล้วรอตรวจ") return "review";
  if (status === "อยู่ระหว่างจัดทำ") return "progress";
  if (status === DOCUMENT_EMPTY_STATUS) return "empty";
  return "other";
}

function isDocumentReady(status) {
  return DOCUMENT_READY_STATUSES.has(status);
}

function getDocumentWorkstreamKey(number, title) {
  const normalizedNumber = String(number || "").trim();
  const normalizedTitle = String(title || "").trim();
  return normalizedNumber === "1" || normalizedTitle === "เอกสารเซ็นหน้าจอ"
    ? "screen-sign"
    : "delivery";
}

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function sortDocumentStatuses(entries) {
  return entries.sort(([a], [b]) => {
    const aIndex = documentStatusOrder.indexOf(a);
    const bIndex = documentStatusOrder.indexOf(b);
    const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
    const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
    return normalizedA - normalizedB || a.localeCompare(b, "th");
  });
}

async function loadProject(config) {
  const rows = await fetchCsvRows({ sheetName: config.name, displayName: config.name });
  if (!rows.length) throw new Error(`ไม่พบข้อมูลในแท็บ ${config.name}`);

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

  const statusCounts = countBy(items, (item) => item.status);

  return {
    ...config,
    total: items.length,
    done: items.filter((item) => DONE_STATUSES.has(item.status)).length,
    status: Object.entries(statusCounts)
      .sort(([a], [b]) => Number(DONE_STATUSES.has(b)) - Number(DONE_STATUSES.has(a)) || a.localeCompare(b, "th"))
      .map(([name, count]) => [name, count, DONE_STATUSES.has(name)]),
    notes: items.filter((item) => !DONE_STATUSES.has(item.status)).map((item) => `${item.title} - ${item.status}`),
  };
}

async function loadDocuments() {
  const rows = await fetchCsvRows({ gid: DOCUMENT_SHEET_GID, displayName: "เอกสารส่งเซ็นหน้าจอ" });
  if (!rows.length) throw new Error("ไม่พบข้อมูลในแท็บเอกสารส่งเซ็นหน้าจอ");

  const headers = rows.shift().map((header) => header.trim());
  const numberIndex = headers.indexOf("#");
  const titleIndex = headers.indexOf("เอกสาร");
  if (titleIndex < 0) throw new Error("ไม่พบคอลัมน์เอกสารในแท็บเอกสารส่งเซ็นหน้าจอ");

  const systemColumns = headers
    .map((name, index) => ({ name, index }))
    .filter((column) => column.index > titleIndex && column.name);

  if (!systemColumns.length) throw new Error("ไม่พบคอลัมน์ระบบในแท็บเอกสารส่งเซ็นหน้าจอ");

  const documents = rows
    .filter((row) => row[titleIndex] && row[titleIndex].trim())
    .map((row) => {
      const number = numberIndex >= 0 ? String(row[numberIndex] || "").trim() : "";
      const title = row[titleIndex].trim();
      const statuses = systemColumns.map((column) => {
        const status = normalizeDocumentStatus(row[column.index]);
        return {
          system: column.name,
          status,
          group: getDocumentStatusGroup(status),
        };
      });
      const ready = statuses.filter((item) => isDocumentReady(item.status)).length;
      const folderUrl = row.map(safeDriveUrl).find(Boolean) || "";

      return {
        number,
        title,
        workstream: getDocumentWorkstreamKey(number, title),
        statuses,
        total: statuses.length,
        ready,
        followUp: statuses.length - ready,
        folderUrl,
      };
    });

  const allStatuses = documents.flatMap((documentItem) => documentItem.statuses);
  const total = allStatuses.length;
  const ready = allStatuses.filter((item) => isDocumentReady(item.status)).length;
  const statusCounts = countBy(allStatuses, (item) => item.status);
  const workstreams = documentWorkstreamConfig.map((workstream) => {
    const workstreamDocuments = documents.filter((documentItem) => documentItem.workstream === workstream.id);
    const workstreamStatuses = workstreamDocuments.flatMap((documentItem) => documentItem.statuses);
    const workstreamReady = workstreamStatuses.filter((item) => isDocumentReady(item.status)).length;

    return {
      ...workstream,
      documents: workstreamDocuments,
      total: workstreamStatuses.length,
      ready: workstreamReady,
      followUp: workstreamStatuses.length - workstreamReady,
    };
  });

  return {
    systems: systemColumns.map((column) => column.name),
    documents,
    workstreams,
    total,
    ready,
    followUp: total - ready,
    status: sortDocumentStatuses(Object.entries(statusCounts)),
  };
}

const fmtPercent = (done, total) => (total ? Math.round((done / total) * 100) : 0);
const problemOf = (project) => project.total - project.done;
const devPercent = () => {
  const totalJobs = projects.reduce((sum, project) => sum + project.total, 0);
  const doneJobs = projects.reduce((sum, project) => sum + project.done, 0);
  return fmtPercent(doneJobs, totalJobs);
};
const documentReadyPercent = () => fmtPercent(documentSummary.ready, documentSummary.total);

function setText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function getWorkstreamSummary(id) {
  return documentSummary.workstreams.find((workstream) => workstream.id === id) || {
    documents: [],
    total: 0,
    ready: 0,
    followUp: 0,
  };
}

function syncPmBrief() {
  const totalJobs = projects.reduce((sum, project) => sum + project.total, 0);
  const doneJobs = projects.reduce((sum, project) => sum + project.done, 0);
  const devDonePercent = fmtPercent(doneJobs, totalJobs);
  const signWorkstream = getWorkstreamSummary("screen-sign");
  const deliveryWorkstream = getWorkstreamSummary("delivery");
  const deliveryPercent = fmtPercent(deliveryWorkstream.ready, deliveryWorkstream.total);

  setText("heroDevDone", `${doneJobs}/${totalJobs}`);
  setText("heroDevPercent", `${devDonePercent}% ภาพรวม DEV`);
  setText("heroScreenSign", `${signWorkstream.ready}/${signWorkstream.total}`);
  setText("heroDeliveryDocs", `${deliveryWorkstream.ready}/${deliveryWorkstream.total}`);
  setText("heroDeliveryPercent", `${deliveryPercent}% ส่ง/เซ็นแล้ว`);

  if (deliveryWorkstream.followUp > 0) {
    setText("heroFocusLabel", "กองเอกสารส่งงาน");
    setText("heroFocusDetail", `ยังต้องตาม ${deliveryWorkstream.followUp}/${deliveryWorkstream.total} ช่องสถานะ`);
    return;
  }

  if (projects.length) {
    const devFocus = [...projects].sort((a, b) => problemOf(b) - problemOf(a))[0];
    setText("heroFocusLabel", devFocus.name);
    setText("heroFocusDetail", `งาน Dev ยังติดตาม ${problemOf(devFocus)}/${devFocus.total} รายการ`);
    return;
  }

  setText("heroFocusLabel", "กำลังโหลดข้อมูล");
  setText("heroFocusDetail", "อ่านสถานะล่าสุดจาก Google Sheet");
}

function syncHeroMeter() {
  const percent = activeView === "documents" ? documentReadyPercent() : devPercent();
  const label = activeView === "documents" ? "ส่ง/เซ็นแล้ว" : "แก้ไขแล้ว";
  document.getElementById("overallPercent").textContent = `${percent}%`;
  document.getElementById("overallDonut").style.setProperty("--percent", percent);
  document.querySelector("#overallDonut small").textContent = label;
}

function setActiveView(view) {
  activeView = view === "documents" ? "documents" : "dev";

  document.querySelectorAll("[data-view-panel]").forEach((panel) => {
    const isActive = panel.dataset.viewPanel === activeView;
    panel.hidden = !isActive;
    panel.classList.toggle("is-active", isActive);
  });

  document.querySelectorAll("#viewTabs button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === activeView);
  });

  document.querySelector(".sheet-link").href = sheetLinks[activeView];
  document.getElementById("heroSubtitle").innerHTML = heroSubtitles[activeView];
  syncHeroMeter();
}

function initViewTabs() {
  const tabs = document.getElementById("viewTabs");
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    setActiveView(button.dataset.view);
  });
  setActiveView("dev");
}

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
  syncHeroMeter();
  syncPmBrief();
}

function renderTabs() {
  const tabs = document.getElementById("projectTabs");
  tabs.innerHTML = projects.map((project, index) =>
    `<button type="button" data-target="${escapeHtml(project.slug)}" class="${index === 0 ? "is-active" : ""}">${escapeHtml(project.name)}</button>`,
  ).join("");

  tabs.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    tabs.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    document.querySelectorAll(".detail-card").forEach((card) => card.classList.remove("is-highlight"));
    const target = document.getElementById(button.dataset.target);
    if (!target) return;
    target.classList.add("is-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

function renderRows() {
  document.getElementById("projectRows").innerHTML = projects.map((project) => {
    const donePercent = fmtPercent(project.done, project.total);
    const problem = problemOf(project);
    return `<article class="project-row">
      <div class="row-name"><strong>${escapeHtml(project.name)}</strong><small>รวม ${project.total} งาน</small></div>
      <div class="bar" aria-label="${escapeHtml(project.name)}: แก้แล้ว ${project.done} งาน ติดปัญหา ${problem} งาน">
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
      ? project.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")
      : "<li>ไม่มีงานค้าง</li>";
    const statuses = project.status.map(([name, count, isDone]) =>
      `<span class="status-chip ${isDone ? "is-done" : ""}">${escapeHtml(name)} <strong>${count}</strong></span>`,
    ).join("");

    return `<article id="${escapeHtml(project.slug)}" class="detail-card ${index === 0 ? "is-highlight" : ""}" style="--accent:${project.accent}">
      <div class="detail-head"><div><h3>${escapeHtml(project.name)}</h3><p>แก้แล้ว ${project.done}/${project.total} งาน - ติดปัญหา ${problem}/${project.total} งาน</p></div>
        <div class="donut small-donut" style="--percent:${donePercent}; --accent:${project.accent}"><span>${donePercent}%</span><small>แก้แล้ว</small></div></div>
      <div class="mini-stats"><span class="mini-stat">แก้ไขแล้ว <strong>${project.done}</strong></span><span class="mini-stat">ติดปัญหา <strong>${problem}</strong></span><span class="mini-stat">ทั้งหมด <strong>${project.total}</strong></span></div>
      <div class="bar" aria-hidden="true"><span style="width:${donePercent}%"></span><span style="width:${100 - donePercent}%"></span></div>
      <ul class="notes">${notes}</ul><div class="status-list" aria-label="สถานะในชีต">${statuses}</div>
    </article>`;
  }).join("");
}

function renderFocus() {
  if (!projects.length) return;

  const focus = [...projects].sort((a, b) => problemOf(b) - problemOf(a));
  const text = focus.slice(0, 3).map((project) => `${project.name} ${problemOf(project)}/${project.total}`).join(" ตามด้วย ");
  document.querySelector(".focus-strip span").textContent =
    `${focus[0].name} เหลืองานติดปัญหามากสุด ${text.replace(`${focus[0].name} ${problemOf(focus[0])}/${focus[0].total}`, `${problemOf(focus[0])}/${focus[0].total}`)}`;
}

function setDocumentNumbers() {
  const readyPercent = fmtPercent(documentSummary.ready, documentSummary.total);
  const workstreamCount = documentSummary.workstreams.filter((workstream) => workstream.documents.length).length;

  document.getElementById("docTotalItems").textContent = documentSummary.documents.length.toString();
  document.getElementById("docSystemCount").textContent = `${workstreamCount} กองงาน / ${documentSummary.systems.length} ระบบต่อเอกสาร`;
  document.getElementById("docReadyItems").textContent = `${documentSummary.ready}/${documentSummary.total}`;
  document.getElementById("docFollowItems").textContent = `${documentSummary.followUp}/${documentSummary.total}`;
  document.getElementById("docReadyRatio").textContent = `${readyPercent}% ของสถานะเอกสาร`;
  document.getElementById("docFollowRatio").textContent = `${100 - readyPercent}% ของสถานะเอกสาร`;
  syncHeroMeter();
  syncPmBrief();
}

function documentGroupCounts(statuses) {
  return statuses.reduce((counts, item) => {
    counts[item.group] = (counts[item.group] || 0) + 1;
    return counts;
  }, {});
}

function renderDocumentSegments(statuses) {
  const total = statuses.length || 1;
  const counts = documentGroupCounts(statuses);

  return documentGroups.map((group) => {
    const count = counts[group] || 0;
    if (!count) return "";
    return `<span class="segment is-${group}" style="width:${(count / total) * 100}%" title="${documentGroupLabels[group]} ${count}"></span>`;
  }).join("");
}

function renderDocumentStatusStrip() {
  document.getElementById("documentStatusStrip").innerHTML = documentSummary.status.map(([name, count]) => {
    const group = getDocumentStatusGroup(name);
    return `<span class="status-chip document-status is-${group}">${escapeHtml(name)} <strong>${count}</strong></span>`;
  }).join("");
}

function renderDocumentWorkstreamStrip() {
  document.getElementById("documentWorkstreamStrip").innerHTML = documentSummary.workstreams.map((workstream) => {
    const readyPercent = fmtPercent(workstream.ready, workstream.total);
    return `<article class="document-workstream-summary" style="--accent:${workstream.accent}">
      <span>${escapeHtml(workstream.shortTitle)}</span>
      <strong>${workstream.ready}/${workstream.total}</strong>
      <small>${workstream.documents.length} รายการ - ${readyPercent}% ส่ง/เซ็นแล้ว</small>
    </article>`;
  }).join("");
}

function renderDocumentRows() {
  document.getElementById("documentRows").innerHTML = documentSummary.workstreams.map((workstream) => {
    const readyPercent = fmtPercent(workstream.ready, workstream.total);
    const rows = workstream.documents.length
      ? workstream.documents.map((documentItem) => renderDocumentRow(documentItem)).join("")
      : `<p class="empty-workstream">ยังไม่พบรายการในกองงานนี้</p>`;

    return `<section class="document-workstream" style="--accent:${workstream.accent}">
      <div class="document-workstream-head">
        <div>
          <h3>${escapeHtml(workstream.title)}</h3>
          <p>${escapeHtml(workstream.subtitle)}</p>
        </div>
        <div class="workstream-counts">
          <strong>${workstream.ready}/${workstream.total}</strong>
          <small>${readyPercent}% ส่ง/เซ็นแล้ว</small>
        </div>
      </div>
      <div class="document-workstream-table">${rows}</div>
    </section>`;
  }).join("");
}

function renderDocumentRow(documentItem) {
  const readyPercent = fmtPercent(documentItem.ready, documentItem.total);
  return `<article class="project-row document-row">
    <div class="row-name"><strong>${escapeHtml(documentItem.title)}</strong><small>รวม ${documentItem.total} ระบบ</small></div>
    <div class="bar document-bar" aria-label="${escapeHtml(documentItem.title)}: ส่งหรือเซ็นแล้ว ${documentItem.ready} ระบบ ยังต้องติดตาม ${documentItem.followUp} ระบบ">
      ${renderDocumentSegments(documentItem.statuses)}
    </div>
    <div class="row-counts document-counts"><span class="done-count">${documentItem.ready}/${documentItem.total}</span><span class="problem-count">${documentItem.followUp}/${documentItem.total}</span><span class="percent">${readyPercent}%</span></div>
  </article>`;
}

function renderDocumentDetails() {
  document.getElementById("documentDetailGrid").innerHTML = documentSummary.workstreams.map((workstream) => {
    const cards = workstream.documents.length
      ? workstream.documents.map((documentItem) => renderDocumentCard(documentItem, workstream.accent)).join("")
      : `<p class="empty-workstream">ยังไม่พบรายการในกองงานนี้</p>`;

    return `<section class="document-detail-stack" style="--accent:${workstream.accent}">
      <div class="document-stack-head">
        <h3>${escapeHtml(workstream.title)}</h3>
        <span>${workstream.documents.length} รายการ</span>
      </div>
      <div class="document-stack-grid">${cards}</div>
    </section>`;
  }).join("");
}

function renderDocumentCard(documentItem, accent) {
  const readyPercent = fmtPercent(documentItem.ready, documentItem.total);
  const systemStatuses = documentItem.statuses.map((item) =>
    `<div class="system-status">
      <span>${escapeHtml(item.system)}</span>
      <strong class="document-status is-${item.group}">${escapeHtml(item.status)}</strong>
    </div>`,
  ).join("");
  const folderLink = documentItem.folderUrl
    ? `<a class="folder-link" href="${escapeHtml(documentItem.folderUrl)}" target="_blank" rel="noopener noreferrer">เปิดโฟลเดอร์เอกสาร ↗</a>`
    : "";

  return `<article class="detail-card document-card" style="--accent:${accent}">
    <div class="detail-head">
      <div>
        <h3>${escapeHtml(documentItem.title)}</h3>
        <p>ส่ง/เซ็นแล้ว ${documentItem.ready}/${documentItem.total} ระบบ - ยังต้องติดตาม ${documentItem.followUp}/${documentItem.total} ระบบ</p>
      </div>
      <div class="donut small-donut" style="--percent:${readyPercent}; --accent:${accent}"><span>${readyPercent}%</span><small>ส่ง/เซ็น</small></div>
    </div>
    <div class="bar document-bar" aria-hidden="true">${renderDocumentSegments(documentItem.statuses)}</div>
    <div class="system-status-grid">${systemStatuses}</div>
    ${folderLink}
  </article>`;
}

function renderDocumentFocus() {
  const focusText = document.getElementById("documentFocusText");
  if (!documentSummary.documents.length) {
    focusText.textContent = "ยังไม่พบรายการเอกสารในชีต";
    return;
  }

  const deliveryWorkstream = documentSummary.workstreams.find((workstream) => workstream.id === "delivery");
  const focusDocuments = deliveryWorkstream && deliveryWorkstream.documents.length
    ? deliveryWorkstream.documents
    : documentSummary.documents;
  const emptyDocuments = focusDocuments.filter((documentItem) =>
    documentItem.statuses.every((item) => item.status === DOCUMENT_EMPTY_STATUS),
  );

  if (emptyDocuments.length) {
    const names = emptyDocuments.slice(0, 3).map((item) => item.title).join(", ");
    const more = emptyDocuments.length > 3 ? ` และอีก ${emptyDocuments.length - 3} รายการ` : "";
    focusText.textContent = `กองเอกสารส่งงานยังต้องติดตาม ${deliveryWorkstream.followUp}/${deliveryWorkstream.total} ช่องสถานะ; มี ${emptyDocuments.length} รายการที่ยังไม่ระบุทุกระบบ: ${names}${more}`;
    return;
  }

  const focus = [...focusDocuments].sort((a, b) => b.followUp - a.followUp);
  focusText.textContent = `${focus[0].title} ยังต้องติดตามมากสุด ${focus[0].followUp}/${focus[0].total} ระบบ`;
}

function renderDocuments() {
  setDocumentNumbers();
  renderDocumentWorkstreamStrip();
  renderDocumentStatusStrip();
  renderDocumentRows();
  renderDocumentDetails();
  renderDocumentFocus();
}

function resetDocumentView(error) {
  documentSummary = createEmptyDocumentSummary();
  setDocumentNumbers();
  document.getElementById("documentWorkstreamStrip").innerHTML = "";
  document.getElementById("documentStatusStrip").innerHTML = "";
  document.getElementById("documentRows").innerHTML =
    `<p role="alert">${escapeHtml(error.message)} - กรุณาตรวจสอบสิทธิ์ของชีตหรือชื่อแท็บเอกสาร</p>`;
  document.getElementById("documentDetailGrid").innerHTML = "";
  document.getElementById("documentFocusText").textContent = "อัปเดตข้อมูลเอกสารไม่สำเร็จ";
}

function renderDevError(error) {
  console.error(error);
  if (!projects.length) {
    document.getElementById("projectRows").innerHTML =
      `<p role="alert">${escapeHtml(error.message)} - กรุณาตรวจสอบว่าสิทธิ์ของชีตเป็น “ทุกคนที่มีลิงก์ดูได้”</p>`;
    document.getElementById("detailGrid").innerHTML = "";
  }
}

async function refreshDashboard() {
  const [devResult, documentResult] = await Promise.allSettled([
    Promise.all(projectConfig.map(loadProject)),
    loadDocuments(),
  ]);

  const updatedAt = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date());

  if (devResult.status === "fulfilled") {
    projects = devResult.value;
    setOverallNumbers();
    renderTabs();
    renderRows();
    renderDetails();
    renderFocus();
  } else {
    renderDevError(devResult.reason);
  }

  if (documentResult.status === "fulfilled") {
    documentSummary = documentResult.value;
    renderDocuments();
  } else {
    console.error(documentResult.reason);
    resetDocumentView(documentResult.reason);
  }

  document.querySelector(".updated").textContent =
    devResult.status === "fulfilled" || documentResult.status === "fulfilled"
      ? `ข้อมูลล่าสุด ${updatedAt}`
      : "อัปเดตข้อมูล Google Sheet ไม่สำเร็จ";
}

initViewTabs();
refreshDashboard();
setInterval(refreshDashboard, REFRESH_INTERVAL_MS);
