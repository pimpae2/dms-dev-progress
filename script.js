const projects = [
  {
    name: "DMS 8095",
    slug: "dms-8095",
    done: 7,
    total: 16,
    accent: "#2f73b7",
    status: [
      ["Developed", 6, true],
      ["Tested", 1, true],
      ["Fixing / Rework", 2, false],
      ["In Progress", 4, false],
      ["ไม่ระบุ", 2, false],
    ],
    notes: [
      "การขอผ่อนผัน",
      "การขอระงับการชำระเงินคืน",
      "การระงับหนี้",
      "ตอนนี้กำลัง Dev และมีประเด็น API DDM เก็บไฟล์",
    ],
  },
  {
    name: "องค์กรนายจ้าง 8096",
    slug: "employer-8096",
    done: 13,
    total: 24,
    accent: "#7c5cc4",
    status: [
      ["Developed", 13, true],
      ["Fixing / Rework", 2, false],
      ["In Progress", 3, false],
      ["To Do", 6, false],
    ],
    notes: ["เหลือเรื่องเงินเพิ่ม", "เหลือเรื่อง API DDM เก็บไฟล์"],
  },
  {
    name: "LCS 8097",
    slug: "lcs-8097",
    done: 5,
    total: 19,
    accent: "#2b8a8a",
    status: [
      ["Developed", 5, true],
      ["To Do", 14, false],
    ],
    notes: [
      "หน้าจอบันทึกงานติดตามหนี้ (ผู้กู้, องค์กรนายจ้าง)",
      "เชื่อมต่อการโทร Sky Phone",
      "การส่ง SMS และการส่ง Email",
      "แสดงเบอร์โทร การเพิ่มเบอร์โทร ประวัติเบอร์โทร",
      "บันทึกการติดตามหนี้ และประวัติการติดตามหนี้",
      "การแสดงจำนวนงานติดตามหนี้",
      "เชื่อมต่อข้อมูลสรุปผลการติดตาม",
      "Text to Speech สำหรับการบันทึกรายละเอียด",
    ],
  },
  {
    name: "e-payslf 8098",
    slug: "epayslf-8098",
    done: 6,
    total: 12,
    accent: "#c06722",
    status: [
      ["Developed", 6, true],
      ["Fixing / Rework", 1, false],
      ["To Do", 5, false],
    ],
    notes: [
      "การสมัครสร้างผู้ใช้งานใหม่ ไม่มี e-Filing",
      "ยืนยันตัวตนผ่าน ThaID",
      "OTP SMS, Email",
      "การดึงข้อมูลจริงมาใส่",
      "เอกสารประกอบการสมัคร และ API DDM เก็บไฟล์",
      "ฟอร์มการแจ้งเหตุ",
      "เงินเพิ่ม",
      "ลืม Pin Code",
    ],
  },
  {
    name: "ลงพื้นที่ 8099",
    slug: "field-8099",
    done: 7,
    total: 12,
    accent: "#228b57",
    status: [
      ["Developed", 7, true],
      ["To Do", 5, false],
    ],
    notes: ["การเชื่อมต่อข้อมูลกับ LCS เพื่อดูข้อมูลการติดตามหนี้", "API DDM เก็บไฟล์"],
  },
];

const fmtPercent = (done, total) => Math.round((done / total) * 100);
const problemOf = (project) => project.total - project.done;
const totalJobs = projects.reduce((sum, project) => sum + project.total, 0);
const doneJobs = projects.reduce((sum, project) => sum + project.done, 0);
const problemJobs = totalJobs - doneJobs;

function setOverallNumbers() {
  const donePercent = fmtPercent(doneJobs, totalJobs);
  const problemPercent = 100 - donePercent;

  document.getElementById("totalJobs").textContent = totalJobs.toString();
  document.getElementById("doneJobs").textContent = `${doneJobs}/${totalJobs}`;
  document.getElementById("problemJobs").textContent = `${problemJobs}/${totalJobs}`;
  document.getElementById("doneRatio").textContent = `${donePercent}% ของงานทั้งหมด`;
  document.getElementById("problemRatio").textContent = `${problemPercent}% ของงานทั้งหมด`;
  document.getElementById("overallPercent").textContent = `${donePercent}%`;
  document.getElementById("overallDonut").style.setProperty("--percent", donePercent);
}

function renderTabs() {
  const tabs = document.getElementById("projectTabs");
  tabs.innerHTML = projects
    .map(
      (project, index) =>
        `<button type="button" data-target="${project.slug}" class="${index === 0 ? "is-active" : ""}">${project.name}</button>`,
    )
    .join("");

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    tabs.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");

    const target = document.getElementById(button.dataset.target);
    document.querySelectorAll(".detail-card").forEach((card) => card.classList.remove("is-highlight"));
    target.classList.add("is-highlight");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function renderRows() {
  const rows = document.getElementById("projectRows");
  rows.innerHTML = projects
    .map((project) => {
      const donePercent = fmtPercent(project.done, project.total);
      const problem = problemOf(project);

      return `
        <article class="project-row">
          <div class="row-name">
            <strong>${project.name}</strong>
            <small>รวม ${project.total} งาน</small>
          </div>
          <div class="bar" aria-label="${project.name}: แก้แล้ว ${project.done} งาน ติดปัญหา ${problem} งาน">
            <span style="width:${donePercent}%"></span>
            <span style="width:${100 - donePercent}%"></span>
          </div>
          <div class="row-counts">
            <span class="done-count">${project.done}/${project.total}</span>
            <span class="problem-count">${problem}/${project.total}</span>
            <span class="percent">${donePercent}%</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderDetails() {
  const detailGrid = document.getElementById("detailGrid");
  detailGrid.innerHTML = projects
    .map((project, index) => {
      const donePercent = fmtPercent(project.done, project.total);
      const problem = problemOf(project);
      const noteItems = project.notes.map((note) => `<li>${note}</li>`).join("");
      const statusItems = project.status
        .map(
          ([name, count, isDone]) =>
            `<span class="status-chip ${isDone ? "is-done" : ""}">${name} <strong>${count}</strong></span>`,
        )
        .join("");

      return `
        <article id="${project.slug}" class="detail-card ${index === 0 ? "is-highlight" : ""}" style="--accent:${project.accent}">
          <div class="detail-head">
            <div>
              <h3>${project.name}</h3>
              <p>แก้แล้ว ${project.done}/${project.total} งาน • ติดปัญหา ${problem}/${project.total} งาน</p>
            </div>
            <div class="donut small-donut" style="--percent:${donePercent}; --accent:${project.accent}" aria-label="${project.name}: ${donePercent}% แก้ไขแล้ว">
              <span>${donePercent}%</span>
              <small>แก้แล้ว</small>
            </div>
          </div>

          <div class="mini-stats">
            <span class="mini-stat">แก้ไขแล้ว <strong>${project.done}</strong></span>
            <span class="mini-stat">ติดปัญหา <strong>${problem}</strong></span>
            <span class="mini-stat">ทั้งหมด <strong>${project.total}</strong></span>
          </div>

          <div class="bar" aria-hidden="true">
            <span style="width:${donePercent}%"></span>
            <span style="width:${100 - donePercent}%"></span>
          </div>

          <ul class="notes">
            ${noteItems}
          </ul>

          <div class="status-list" aria-label="สถานะในชีต">
            ${statusItems}
          </div>
        </article>
      `;
    })
    .join("");
}

setOverallNumbers();
renderTabs();
renderRows();
renderDetails();
