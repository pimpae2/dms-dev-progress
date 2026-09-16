let settingsConfig = null;
let editingPlanId = null;
let checkedUrl = null;
let checking = 0;
let settingsBusy = false;
const form = document.getElementById("planForm");
const nameInput = document.getElementById("planName");
const urlInput = document.getElementById("planUrl");
const enabledInput = document.getElementById("planEnabled");
const saveButton = document.getElementById("savePlan");

function resetPlanForm() {
  editingPlanId = null;
  checkedUrl = null;
  checking++;
  form.reset();
  saveButton.disabled = true;
  setText("editorTitle", "เพิ่มชุดข้อมูล");
  setText("planPreview", "");
}

function renderSettingsList() {
  document.getElementById("settingsList").innerHTML = settingsConfig.plans.map((plan, index) => `<article class="settings-row"><div><strong>${escapeHtml(plan.name)}</strong><small>${plan.enabled ? "เปิดแสดง" : "ซ่อน"}</small><a href="${escapeHtml(plan.url)}" target="_blank" rel="noopener noreferrer">เปิดชีต ↗</a></div><div class="settings-row-actions"><button class="settings-button" data-action="up" data-id="${plan.id}" title="เลื่อนขึ้น" aria-label="เลื่อน ${escapeHtml(plan.name)} ขึ้น" ${index === 0 ? "disabled" : ""}>↑</button><button class="settings-button" data-action="down" data-id="${plan.id}" title="เลื่อนลง" aria-label="เลื่อน ${escapeHtml(plan.name)} ลง" ${index === settingsConfig.plans.length - 1 ? "disabled" : ""}>↓</button><button class="settings-button" data-action="edit" data-id="${plan.id}">แก้ไข</button><button class="settings-button" data-action="delete" data-id="${plan.id}">ลบ</button></div></article>`).join("") || '<p class="empty-workstream">ยังไม่มีชุดข้อมูล</p>';
}

async function persistSettings(plans) {
  if (settingsBusy) return false;
  settingsBusy = true;
  saveButton.disabled = true;
  try {
    settingsConfig = await savePlanConfig({ revision: settingsConfig.revision, plans });
    renderSettingsList();
    setText("settingsMessage", "บันทึกค่าตั้งค่าแล้ว");
    return true;
  } catch (error) {
    setText("settingsMessage", error.message);
    return false;
  } finally {
    settingsBusy = false;
    saveButton.disabled = !checkedUrl;
  }
}

urlInput.addEventListener("input", () => { checkedUrl = null; checking++; saveButton.disabled = true; setText("planPreview", ""); });
document.getElementById("checkPlan").onclick = async () => {
  if (!urlInput.reportValidity() || !urlInput.value.trim()) return;
  const request = ++checking;
  checkedUrl = null;
  saveButton.disabled = true;
  setText("planPreview", "กำลังตรวจสอบชีต…");
  try {
    const parsed = parseSheetLink(urlInput.value);
    const systems = await loadProjectPlan(parsed.url);
    if (request !== checking) return;
    checkedUrl = parsed.url;
    const total = systems.reduce((sum, system) => sum + system.total, 0);
    const statuses = [...new Set(systems.flatMap(system => system.items.map(item => item.status)))];
    document.getElementById("planPreview").innerHTML = `<strong>อ่านข้อมูลได้ · ${systems.length} ระบบ · ${total} ข้อ</strong><ul>${systems.map(system => `<li>${escapeHtml(system.name)}: ${system.done}/${system.total} ข้อพัฒนาแล้ว</li>`).join("")}</ul><p>สถานะ: ${statuses.map(escapeHtml).join(", ")}</p>`;
    saveButton.disabled = false;
  } catch (error) { if (request === checking) setText("planPreview", `ตรวจสอบไม่สำเร็จ: ${error.message}`); }
};

form.onsubmit = async event => {
  event.preventDefault();
  if (!checkedUrl || !settingsConfig || settingsBusy || !form.reportValidity()) return;
  const plan = { id: editingPlanId || crypto.randomUUID(), name: nameInput.value.trim(), url: checkedUrl, enabled: enabledInput.checked };
  if (!plan.name) return;
  const plans = editingPlanId ? settingsConfig.plans.map(item => item.id === editingPlanId ? plan : item) : [...settingsConfig.plans, plan];
  if (await persistSettings(plans)) resetPlanForm();
};

document.getElementById("settingsList").onclick = async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || settingsBusy) return;
  const index = settingsConfig.plans.findIndex(plan => plan.id === button.dataset.id);
  if (index < 0) return;
  const plan = settingsConfig.plans[index];
  if (button.dataset.action === "edit") {
    resetPlanForm();
    editingPlanId = plan.id;
    nameInput.value = plan.name;
    urlInput.value = plan.url;
    enabledInput.checked = plan.enabled;
    setText("editorTitle", "แก้ไขชุดข้อมูล");
    nameInput.focus();
    return;
  }
  const plans = [...settingsConfig.plans];
  if (button.dataset.action === "delete") {
    if (!confirm(`ลบชุดข้อมูล “${plan.name}” ออกจากรายการ? ไฟล์ Google Sheet จะยังอยู่`)) return;
    plans.splice(index, 1);
  } else {
    const next = index + (button.dataset.action === "up" ? -1 : 1);
    if (next < 0 || next >= plans.length) return;
    [plans[index], plans[next]] = [plans[next], plans[index]];
  }
  if (await persistSettings(plans)) resetPlanForm();
};
document.getElementById("newPlan").onclick = () => { resetPlanForm(); nameInput.focus(); };
document.getElementById("cancelPlan").onclick = resetPlanForm;
readPlanConfig().then(config => { settingsConfig = config; renderSettingsList(); setText("settingsMessage", `${config.plans.length} ชุดข้อมูล`); }).catch(error => setText("settingsMessage", error.message));
