/**
 * Pioneer Property Management System (PPMS)
 * Main Application Controller v4.0
 *
 * الجديد:
 * - توليد وحدات ذكي (دور × وحدات/دور) بترقيم 101,102 / 201,202...
 * - إشعارات انتهاء عقود الإيجار (banner)
 * - بحث بالاسم + فلاتر (حيوانات، كبار سن، حالة)
 * - أرشيف المستأجرين
 * - تقرير انتهاء العقود
 * - إعدادات أيام الإنذار
 */

'use strict';

let currentUser            = null;
let dashboardChartInstance = null;
let myPeerInstance         = null;
let lastSearchResults      = [];  // لحفظ نتائج البحث للفلترة
let currentFilter          = 'all';

// ══════════════════════════════════════════════════
// 0. Toast Notifications
// ══════════════════════════════════════════════════

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) { console.warn(message); return; }

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast${type !== 'success' ? ' ' + type : ''}`;
    toast.innerHTML = `<span>${icons[type] || '✅'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastOut .3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ══════════════════════════════════════════════════
// 1. App Initialization
// ══════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
    updateOnlineStatus();
    window.addEventListener('online',  updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    initAppEventListeners();

    // تحديث formula في شاشة التفعيل
    const deviceId    = localStorage.getItem('ppms_device_id') || '—';
    const formulaEl   = document.getElementById('device-id-formula');
    if (formulaEl) formulaEl.textContent = deviceId;

    try {
        if (typeof initActivationFlow === 'function') await initActivationFlow();
    } catch (e) {
        console.warn('Activation flow error:', e);
    }
});

window.proceedToDashboardDirectly = function () {
    currentUser = { username: 'admin', fullName: 'المدير العام', role: 'Admin' };

    // Device ID = نفس رقم التفعيل
    const deviceId = localStorage.getItem('ppms_device_id') || '—';

    const displayName = document.getElementById('user-display-name');
    if (displayName) displayName.textContent = currentUser.fullName;

    // Device ID في الإعدادات (نفس رقم التفعيل)
    const settingsDev = document.getElementById('settings-device-id');
    if (settingsDev) settingsDev.textContent = deviceId;

    document.getElementById('activation-screen')?.classList.add('hidden');
    document.getElementById('login-screen')?.classList.add('hidden');

    const app = document.getElementById('app-container');
    if (app) { app.classList.remove('hidden'); app.classList.add('app-layout'); }

    // تحميل إعدادات التنبيه
    getLeaseAlertDays().then(days => {
        const inp = document.getElementById('lease-alert-days');
        if (inp) inp.value = days;
    });

    initP2PLiveConnection();
    switchView('view-dashboard');

    // فحص إشعارات العقود عند كل فتح
    setTimeout(checkLeaseExpirations, 1200);
    setTimeout(loadDashboardData, 80);
};

// ══════════════════════════════════════════════════
// 2. Online Status
// ══════════════════════════════════════════════════

function updateOnlineStatus() {
    const badge = document.getElementById('connection-status');
    if (!badge) return;
    badge.textContent = navigator.onLine ? '🟢 متصل'   : '🔴 أوفلاين';
    badge.className   = `status-badge ${navigator.onLine ? 'online' : 'offline'}`;
}

// ══════════════════════════════════════════════════
// 3. Event Listeners
// ══════════════════════════════════════════════════

function initAppEventListeners() {
    // Navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            switchView(item.getAttribute('data-target'), item);
        });
    });

    // Projects
    document.getElementById('btn-add-project')?.addEventListener('click', () => openModal('project-modal'));
    document.getElementById('btn-save-project')?.addEventListener('click', handleSaveProject);

    // Preview generator
    ['modal-project-floors', 'modal-project-units-per-floor'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', updateProjectPreview);
    });

    // Buildings
    document.getElementById('btn-add-building')?.addEventListener('click', openBuildingModalFlow);
    document.getElementById('btn-save-building')?.addEventListener('click', handleSaveBuilding);

    // Search
    document.getElementById('btn-trigger-search')?.addEventListener('click', handleSearch);
    document.getElementById('btn-clear-search')?.addEventListener('click', clearSearch);
    document.getElementById('search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleSearch(); });

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            applyFilter();
        });
    });

    // Reports
    document.querySelectorAll('.btn-report').forEach(btn => {
        btn.addEventListener('click', () => generateReport(btn.getAttribute('data-report-type')));
    });
    document.getElementById('btn-export-report')?.addEventListener('click', exportReportCSV);

    // Archive search
    document.getElementById('btn-archive-search')?.addEventListener('click', searchArchive);
    document.getElementById('btn-archive-show-all')?.addEventListener('click', loadArchiveAll);
    document.getElementById('archive-search-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') searchArchive(); });

    // Settings
    document.getElementById('btn-save-alert-days')?.addEventListener('click', saveAlertDays);
    document.getElementById('btn-export-db')?.addEventListener('click', exportDatabase);
    document.getElementById('import-db-file')?.addEventListener('change', importDatabase);
    document.getElementById('btn-clear-data')?.addEventListener('click', confirmClearData);

    // Modal تعديل حالة الوحدة
    const confirmStatusBtn = document.getElementById('btn-confirm-status-change');
    if (confirmStatusBtn) {
        confirmStatusBtn.addEventListener('click', applyStatusChange);
    }
    // إغلاق modal الحالة بالنقر خارجه
    document.getElementById('unit-status-modal')?.addEventListener('click', e => {
        if (e.target.id === 'unit-status-modal') closeModal('unit-status-modal');
    });

    // Modals: close on ×, outside click, ESC
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal')?.classList.add('hidden'));
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') document.querySelectorAll('.modal:not(.hidden)').forEach(m => m.classList.add('hidden'));
    });

    // Auto-uppercase inputs
    ['modal-project-code', 'modal-building-code'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', function () { this.value = this.value.toUpperCase(); });
    });
}

window.openModal = function openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); }
window.closeModal = function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

// ══════════════════════════════════════════════════
// 4. View Switching
// ══════════════════════════════════════════════════

const pageTitles = {
    'view-dashboard': 'لوحة التحكم الرئيسية',
    'view-projects':  'المشروعات العقارية',
    'view-buildings': 'إدارة العمائر والوحدات',
    'view-search':    'البحث الذكي',
    'view-reports':   'التقارير والإحصائيات',
    'view-archive':   'أرشيف المستأجرين السابقين',
    'view-settings':  'الإعدادات والمزامنة',
};

function switchView(targetViewId, menuItem) {
    document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
    document.getElementById(targetViewId)?.classList.remove('hidden');

    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    if (menuItem) {
        menuItem.classList.add('active');
    } else {
        document.querySelector(`.menu-item[data-target="${targetViewId}"]`)?.classList.add('active');
    }

    const titleEl = document.getElementById('page-title');
    if (titleEl) titleEl.textContent = pageTitles[targetViewId] || '';

    if (targetViewId === 'view-dashboard') loadDashboardData();
    if (targetViewId === 'view-projects')  loadProjectsData();
    if (targetViewId === 'view-buildings') loadBuildingsData();
    if (targetViewId === 'view-archive')   loadArchiveAll();
}

// ══════════════════════════════════════════════════
// 5. Dashboard
// ══════════════════════════════════════════════════

async function loadDashboardData() {
    try {
        const [projects, buildings, units] = await Promise.all([
            getAllProjects().catch(() => []),
            getAllBuildings().catch(() => []),
            getAllUnits().catch(() => []),
        ]);

        setEl('stat-projects',     projects.length);
        setEl('stat-buildings',    buildings.length);
        setEl('stat-units',        units.length);
        setEl('stat-vacant-units', units.filter(u => u.status === 'فارغة').length);
        setEl('stat-rented-units', units.filter(u => u.status === 'مؤجرة').length);
        setEl('stat-owned-units',  units.filter(u => u.status === 'مملوكة').length);

        const counts = { 'جاهزة': 0, 'فارغة': 0, 'تحت التشطيب': 0, 'تحت الإنشاء': 0, 'مؤجرة': 0, 'مملوكة': 0 };
        units.forEach(u => { if (counts[u.status] !== undefined) counts[u.status]++; });
        renderStatusChart(counts);
    } catch (e) {
        console.error('loadDashboardData:', e);
    }
}

function setEl(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function renderStatusChart(dataMap) {
    const ctx = document.getElementById('unitsStatusChart');
    if (!ctx || typeof Chart === 'undefined') return;
    if (dashboardChartInstance) dashboardChartInstance.destroy();

    dashboardChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dataMap),
            datasets: [{
                data: Object.values(dataMap),
                backgroundColor: ['#16a34a', '#64748b', '#d97706', '#37474f', '#1565c0', '#6a1b9a'],
                borderWidth: 3, borderColor: '#fff', hoverOffset: 8,
            }],
        },
        options: {
            responsive: true, cutout: '62%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 14, font: { family: 'Cairo', size: 12, weight: '600' }, usePointStyle: true } },
                tooltip: { callbacks: { label: ctx => {
                    const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                    const pct   = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                    return ` ${ctx.label}: ${ctx.parsed} وحدة (${pct}%)`;
                }}},
            },
        },
    });
}

// ══════════════════════════════════════════════════
// 6. Lease Expiry Notifications
// ══════════════════════════════════════════════════

window.checkLeaseExpirations = async function () {
    try {
        const [alertDays, occupants] = await Promise.all([
            getLeaseAlertDays(),
            getAllFromStore('occupants').catch(() => []),
        ]);

        const today   = new Date();
        const alerts  = [];

        occupants.forEach(occ => {
            if (!occ.leaseEndDate) return;
            const endDate  = new Date(occ.leaseEndDate);
            const diffDays = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= alertDays) {
                alerts.push({ occ, diffDays, endDate });
            } else if (diffDays < 0) {
                // منتهي الصلاحية
                alerts.push({ occ, diffDays, endDate, expired: true });
            }
        });

        const banner  = document.getElementById('lease-alert-banner');
        const textEl  = document.getElementById('lease-alert-text');

        if (!banner || !textEl) return;

        if (alerts.length === 0) {
            banner.classList.add('hidden');
            document.body.classList.remove('has-banner');
            return;
        }

        const expiredAlerts = alerts.filter(a => a.expired);
        const soonAlerts    = alerts.filter(a => !a.expired);

        let msg = '';
        if (expiredAlerts.length > 0) {
            const list = expiredAlerts.map(a => `${a.occ.unitCode} (منذ ${Math.abs(a.diffDays)} يوم)`).join('، ');
            msg += `⚠️ ${expiredAlerts.length} عقد منتهي: [ ${list} ] `;
        }
        if (soonAlerts.length > 0) {
            const list = soonAlerts.map(a => `${a.occ.unitCode} (خلال ${a.diffDays} يوم)`).join('، ');
            msg += `🕐 ${soonAlerts.length} عقد ستنتهي قريباً: [ ${list} ]`;
        }

        textEl.textContent = msg;
        banner.classList.remove('hidden');
        document.body.classList.add('has-banner');
    } catch (e) {
        console.warn('checkLeaseExpirations:', e);
    }
};

async function saveAlertDays() {
    const days = parseInt(document.getElementById('lease-alert-days')?.value, 10);
    if (isNaN(days) || days < 1) { showToast('أدخل عدد أيام صحيح.', 'error'); return; }
    await setLeaseAlertDays(days);
    showToast(`تم حفظ إعداد التنبيه: ${days} يوم.`);
    checkLeaseExpirations();
}

// ══════════════════════════════════════════════════
// 7. Project Creation (Advanced Unit Generator)
// ══════════════════════════════════════════════════

function updateProjectPreview() {
    const floors        = parseInt(document.getElementById('modal-project-floors')?.value, 10) || 0;
    const unitsPerFloor = parseInt(document.getElementById('modal-project-units-per-floor')?.value, 10) || 0;
    const total         = floors * unitsPerFloor;
    const preview       = document.getElementById('project-units-preview');
    if (!preview) return;

    if (floors > 0 && unitsPerFloor > 0) {
        // أمثلة: أول 6 وحدات بالترقيم التسلسلي
        const examples = [];
        for (let i = 1; i <= Math.min(total, 6); i++) {
            examples.push(String(i));
        }
        preview.innerHTML = `إجمالي: <strong>${total} وحدة</strong> لكل عمارة — ترقيم تسلسلي: ${examples.join(', ')}${total > 6 ? '...' : ''}`;
    } else {
        preview.textContent = '';
    }
}

/**
 * توليد رقم الوحدة: ترقيم تسلسلي مستمر عبر الأدوار
 * الدور الأول: 1, 2, 3, 4 — الدور الثاني: 5, 6, 7, 8 — إلخ
 * @param {string} projectCode - كود المشروع
 * @param {string} buildingCode - كود العمارة
 * @param {number} floor - رقم الدور (يبدأ من 1)
 * @param {number} unitInFloor - ترتيب الوحدة في الدور (يبدأ من 1)
 * @param {number} unitsPerFloor - عدد الوحدات في الدور
 */
function generateUnitCode(projectCode, buildingCode, floor, unitInFloor, unitsPerFloor) {
    // الرقم التسلسلي = ((رقم الدور - 1) × وحدات/دور) + ترتيب الوحدة في الدور
    const seqNum = ((floor - 1) * unitsPerFloor) + unitInFloor;
    return `${projectCode}-${buildingCode}${seqNum}`;
}

async function handleSaveProject() {
    const code    = document.getElementById('modal-project-code')?.value.trim().toUpperCase();
    const name    = document.getElementById('modal-project-name')?.value.trim();
    const city    = document.getElementById('modal-project-city')?.value.trim()    || 'القاهرة';
    const country = document.getElementById('modal-project-country')?.value.trim() || 'مصر';
    const floors       = parseInt(document.getElementById('modal-project-floors')?.value, 10)          || 5;
    const unitPerFloor = parseInt(document.getElementById('modal-project-units-per-floor')?.value, 10) || 4;
    const area         = parseInt(document.getElementById('modal-project-area')?.value, 10)            || 120;
    const initStatus   = document.getElementById('modal-project-init-status')?.value || 'فارغة';

    const saveBtn = document.getElementById('btn-save-project');

    if (!code || !name) { showToast('يرجى إدخال كود واسم المشروع.', 'error'); return; }
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span> جاري الحفظ...'; }

    try {
        const db = await openDB();

        // التحقق من التكرار
        const exists = await new Promise(res => {
            const req = db.transaction(['projects'], 'readonly').objectStore('projects').get(code);
            req.onsuccess = () => res(!!req.result);
            req.onerror   = () => res(false);
        });
        if (exists) {
            showToast(`كود المشروع "${code}" موجود بالفعل.`, 'error');
            if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '💾 حفظ المشروع وتوليد العمائر'; }
            return;
        }

        const tx     = db.transaction(['projects', 'buildings', 'units'], 'readwrite');
        const pStore = tx.objectStore('projects');
        const bStore = tx.objectStore('buildings');
        const uStore = tx.objectStore('units');

        pStore.put({ projectCode: code, projectName: name, city, country, floors, unitPerFloor, area, createdAt: new Date().toISOString() });

        const buildingLetters = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N'];
        const totalUnits      = floors * unitPerFloor;

        buildingLetters.forEach(letter => {
            bStore.add({ projectCode: code, buildingCode: letter, floors, unitPerFloor, unitsCount: totalUnits, createdAt: new Date().toISOString() });

            for (let f = 1; f <= floors; f++) {
                for (let u = 1; u <= unitPerFloor; u++) {
                    const unitCode = generateUnitCode(code, letter, f, u, unitPerFloor);
                    uStore.put({ unitCode, projectCode: code, buildingCode: letter, floor: f, unitInFloor: u, area, rooms: area >= 150 ? 4 : 3, type: 'شقة سكنية', status: initStatus, hasPets: false, hasElderly: false, occupantType: 'vacant', updatedAt: new Date().toISOString() });
                }
            }
        });

        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });

        closeModal('project-modal');
        document.getElementById('modal-project-code').value = '';
        document.getElementById('modal-project-name').value = '';
        const totalAll = buildingLetters.length * totalUnits;
        showToast(`✅ تم إنشاء "${name}": 14 عمارة × ${totalUnits} وحدة = ${totalAll} وحدة.`);
        addLogEntry('admin', 'ADD_PROJECT', `${code} — ${name}: ${floors} دور × ${unitPerFloor} وحدة/دور`);
        loadProjectsData();
        loadBuildingsData();
        loadDashboardData();

    } catch (e) {
        showToast('حدث خطأ أثناء الحفظ.', 'error');
        console.error(e);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '💾 حفظ المشروع وتوليد العمائر'; }
    }
}

// ══════════════════════════════════════════════════
// 8. Projects List
// ══════════════════════════════════════════════════

async function loadProjectsData() {
    const list  = await getAllProjects().catch(() => []);
    const tbody = document.getElementById('projects-tbody');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = emptyState('🏢', 'لا توجد مشروعات بعد. أضف مشروعك الأول!');
        return;
    }

    tbody.innerHTML = list.map(p => `
        <tr>
            <td data-label="كود"><code style="font-family:var(--font-mono);font-weight:700;color:var(--primary);background:var(--bg);padding:2px 8px;border-radius:4px;">${escHtml(p.projectCode)}</code></td>
            <td data-label="الاسم"><strong>${escHtml(p.projectName)}</strong></td>
            <td data-label="المدينة">${escHtml(p.city)}</td>
            <td data-label="الدولة">${escHtml(p.country)}</td>
            <td data-label="الحالة"><span class="status-badge online">نشط</span></td>
            <td data-label="الإجراءات">
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-warning btn-sm" onclick="promptEditProject('${escAttr(p.projectCode)}','${escAttr(p.projectName)}')">✏️ تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteProject('${escAttr(p.projectCode)}')">🗑️ حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

window.promptEditProject = async function (code, currentName) {
    const newName = prompt(`تعديل اسم المشروع (${code}):`, currentName);
    if (!newName?.trim()) return;
    try {
        const db  = await openDB();
        const tx  = db.transaction(['projects'], 'readwrite');
        const req = tx.objectStore('projects').get(code);
        await new Promise((res, rej) => {
            req.onsuccess = () => { if (req.result) { req.result.projectName = newName.trim(); tx.objectStore('projects').put(req.result); } res(); };
            req.onerror = rej; tx.oncomplete = res;
        });
        showToast('تم تعديل اسم المشروع.');
        addLogEntry('admin', 'EDIT_PROJECT', `${code} → ${newName.trim()}`);
        loadProjectsData();
    } catch (e) { showToast('خطأ في التعديل.', 'error'); }
};

window.confirmDeleteProject = async function (code) {
    if (!confirm(`حذف المشروع "${code}" وكافة بياناته؟`)) return;
    try {
        await deleteProjectRecord(code);
        showToast(`تم حذف المشروع "${code}".`);
        addLogEntry('admin', 'DELETE_PROJECT', code);
        loadProjectsData(); loadBuildingsData(); loadDashboardData();
    } catch (e) { showToast('خطأ في الحذف.', 'error'); }
};

// ══════════════════════════════════════════════════
// 9. Buildings
// ══════════════════════════════════════════════════

async function loadBuildingsData() {
    const list  = await getAllBuildings().catch(() => []);
    const tbody = document.getElementById('buildings-tbody');
    if (!tbody) return;

    if (!list.length) {
        tbody.innerHTML = emptyState('🏗️', 'لا توجد عمائر. أضف مشروعاً أولاً.');
        return;
    }

    tbody.innerHTML = list.map(b => `
        <tr>
            <td data-label="كود العمارة"><strong>عمارة ${escHtml(b.buildingCode)}</strong></td>
            <td data-label="المشروع"><code style="font-family:var(--font-mono);font-size:12px;color:var(--primary);background:var(--bg);padding:2px 8px;border-radius:4px;">${escHtml(b.projectCode)}</code></td>
            <td data-label="الأدوار">${b.floors || '—'}</td>
            <td data-label="وحدات/دور">${b.unitPerFloor || '—'}</td>
            <td data-label="إجمالي الوحدات"><span class="status-badge info">${b.unitsCount || 0} وحدة</span></td>
            <td data-label="الإجراءات">
                <div style="display:flex;gap:4px;">
                    <button class="btn btn-secondary btn-sm" onclick="viewBuildingUnits('${escAttr(b.buildingCode)}','${escAttr(b.projectCode)}')">🏠 الوحدات</button>
                    <button class="btn btn-warning btn-sm" onclick="promptEditBuilding('${escAttr(b.buildingCode)}','${escAttr(b.projectCode)}',${b.unitsCount})">✏️ تعديل</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteBuilding('${escAttr(b.buildingCode)}','${escAttr(b.projectCode)}')">🗑️ حذف</button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function openBuildingModalFlow() {
    const projects = await getAllProjects().catch(() => []);
    const select   = document.getElementById('modal-building-project-select');
    if (!select) return;
    select.innerHTML = '';

    if (!projects.length) { showToast('أضف مشروعاً أولاً.', 'warning'); return; }

    projects.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.projectCode;
        opt.textContent = `${p.projectName} (${p.projectCode})`;
        select.appendChild(opt);
    });

    // اقتراح الكود التالي
    const allBuildings  = await getAllBuildings().catch(() => []);
    const codes         = allBuildings.filter(b => b.projectCode === select.value).map(b => b.buildingCode).sort();
    const last          = codes[codes.length - 1];
    const codeInput     = document.getElementById('modal-building-code');
    if (codeInput) codeInput.value = (last && last.length === 1 && last < 'Z') ? String.fromCharCode(last.charCodeAt(0) + 1) : 'O';

    openModal('building-modal');
}

async function handleSaveBuilding() {
    const projectCode  = document.getElementById('modal-building-project-select')?.value;
    const buildingCode = document.getElementById('modal-building-code')?.value.trim().toUpperCase();
    const floors       = parseInt(document.getElementById('modal-building-floors')?.value, 10)          || 5;
    const unitPerFloor = parseInt(document.getElementById('modal-building-units-per-floor')?.value, 10) || 4;
    const area         = parseInt(document.getElementById('modal-building-area')?.value, 10)            || 120;
    const initStatus   = document.getElementById('modal-building-init-status')?.value || 'فارغة';
    const saveBtn      = document.getElementById('btn-save-building');

    if (!buildingCode) { showToast('أدخل كود العمارة.', 'error'); return; }
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner"></span> جاري الحفظ...'; }

    const totalUnits = floors * unitPerFloor;

    try {
        const db = await openDB();
        const tx = db.transaction(['buildings', 'units'], 'readwrite');

        tx.objectStore('buildings').add({ projectCode, buildingCode, floors, unitPerFloor, unitsCount: totalUnits, createdAt: new Date().toISOString() });

        const uStore = tx.objectStore('units');
        for (let f = 1; f <= floors; f++) {
            for (let u = 1; u <= unitPerFloor; u++) {
                const unitCode = generateUnitCode(projectCode, buildingCode, f, u, unitPerFloor);
                uStore.put({ unitCode, projectCode, buildingCode, floor: f, unitInFloor: u, area, rooms: area >= 150 ? 4 : 3, type: 'شقة سكنية', status: initStatus, hasPets: false, hasElderly: false, occupantType: 'vacant', updatedAt: new Date().toISOString() });
            }
        }

        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
        closeModal('building-modal');
        showToast(`تم إنشاء العمارة "${buildingCode}": ${floors} دور × ${unitPerFloor} وحدة = ${totalUnits} وحدة.`);
        addLogEntry('admin', 'ADD_BUILDING', `${buildingCode}/${projectCode}: ${totalUnits} وحدة`);
        loadBuildingsData(); loadDashboardData();
    } catch (e) {
        showToast('خطأ في حفظ العمارة.', 'error');
        console.error(e);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '💾 حفظ وتوليد الوحدات'; }
    }
}

window.promptEditBuilding = async function (buildingCode, projectCode, currentCount) {
    const newCountStr = prompt(`تعديل عدد وحدات العمارة "${buildingCode}":`, currentCount);
    if (!newCountStr) return;
    const newCount = parseInt(newCountStr, 10);
    if (isNaN(newCount) || newCount <= 0) { showToast('عدد غير صحيح.', 'error'); return; }

    try {
        const db  = await openDB();
        const tx  = db.transaction(['buildings'], 'readwrite');
        const req = tx.objectStore('buildings').openCursor();
        await new Promise((res, rej) => {
            req.onsuccess = e => {
                const c = e.target.result;
                if (!c) return;
                if (c.value.buildingCode === buildingCode && c.value.projectCode === projectCode) {
                    const u = c.value; u.unitsCount = newCount; c.update(u);
                }
                c.continue();
            };
            tx.oncomplete = res; tx.onerror = () => rej(tx.error);
        });
        showToast(`تم تعديل العمارة "${buildingCode}".`);
        loadBuildingsData(); loadDashboardData();
    } catch (e) { showToast('خطأ في التعديل.', 'error'); }
};

window.confirmDeleteBuilding = async function (buildingCode, projectCode) {
    if (!confirm(`حذف العمارة "${buildingCode}" وكافة وحداتها؟`)) return;
    try {
        await deleteBuildingAndUnits(buildingCode, projectCode);
        showToast(`تم حذف العمارة "${buildingCode}".`);
        addLogEntry('admin', 'DELETE_BUILDING', `${buildingCode}/${projectCode}`);
        loadBuildingsData(); loadDashboardData();
    } catch (e) { showToast('خطأ في الحذف.', 'error'); }
};

window.viewBuildingUnits = function (buildingCode, projectCode) {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = `${projectCode}-${buildingCode}`;
    switchView('view-search');
    handleSearch();
};

// ══════════════════════════════════════════════════
// 10. Search & Filters
// ══════════════════════════════════════════════════

const occupantTypeLabel = {
    owner:  ['🟢 مالك',   'occ-owner'],
    tenant: ['🟡 مستأجر', 'occ-tenant'],
    agent:  ['🔵 وكيل',   'occ-agent'],
    vacant: ['⬜ فارغة',  'occ-vacant'],
};

const statusColors = {
    'فارغة': 'success', 'جاهزة': 'online', 'مؤجرة': 'warning',
    'مملوكة': 'info', 'تحت التشطيب': 'warning', 'تحت الإنشاء': 'offline',
};

async function handleSearch() {
    const query = document.getElementById('search-input')?.value.trim();
    const tbody = document.getElementById('search-tbody');
    if (!tbody) return;

    if (!query) { showToast('أدخل نصاً للبحث.', 'warning'); return; }

    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">⏳ جاري البحث...</td></tr>';

    const [units, occupants] = await Promise.all([
        getAllUnits().catch(() => []),
        getAllFromStore('occupants').catch(() => []),
    ]);

    const queryUp = query.toUpperCase();
    // خريطة الشاغلين حسب unitCode
    const occupantMap = {};
    occupants.forEach(o => { occupantMap[o.unitCode] = o; });

    // البحث بكود الوحدة أو اسم الشاغل أو المشروع أو العمارة
    lastSearchResults = units.filter(u => {
        const occ = occupantMap[u.unitCode];
        return (
            u.unitCode?.toUpperCase().includes(queryUp) ||
            u.projectCode?.toUpperCase().includes(queryUp) ||
            u.buildingCode?.toUpperCase() === queryUp ||
            occ?.fullName?.toLowerCase().includes(query.toLowerCase()) ||
            occ?.idNumber?.includes(query)
        );
    }).map(u => ({ ...u, _occupant: occupantMap[u.unitCode] || null }));

    // الترتيب حسب الدور ثم ترتيب الوحدة داخل الدور (مع دعم الوحدات القديمة التي لا تحتوي على حقل الدور)
    lastSearchResults.sort((a, b) => {
        const floorA = a.floor || 0;
        const floorB = b.floor || 0;
        if (floorA !== floorB && floorA !== 0 && floorB !== 0) {
            return floorA - floorB;
        }
        // في حالة تساوي الدور أو عدم وجوده، نرتب بناءً على الرقم المستخرج من كود الوحدة
        const numA = parseInt((a.unitCode.match(/\d+$/) || [0])[0], 10);
        const numB = parseInt((b.unitCode.match(/\d+$/) || [0])[0], 10);
        return numA - numB;
    });

    // إعادة ضبط الفلاتر
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    currentFilter = 'all';

    renderSearchResults(lastSearchResults);
}

function applyFilter() {
    if (!lastSearchResults.length) return;

    let filtered = [...lastSearchResults];
    if (currentFilter === 'all') {
        // لا شيء
    } else if (currentFilter === 'pets') {
        filtered = filtered.filter(u => u.hasPets);
    } else if (currentFilter === 'elderly') {
        filtered = filtered.filter(u => u.hasElderly);
    } else {
        filtered = filtered.filter(u => u.status === currentFilter);
    }
    renderSearchResults(filtered);
}

function renderSearchResults(results) {
    const tbody = document.getElementById('search-tbody');
    if (!tbody) return;

    if (!results.length) {
        tbody.innerHTML = `<tr><td colspan="9">${emptyState('🔍', 'لا توجد نتائج.')}</td></tr>`;
        return;
    }

    let currentFloor = null;
    let html = '';

    results.forEach(u => {
        const occ     = u._occupant;
        const occType = u.occupantType || 'vacant';
        const [occLabel, occClass] = occupantTypeLabel[occType] || occupantTypeLabel['vacant'];

        // حساب أيام انتهاء العقد
        let expiryHtml = '—';
        if (occ?.leaseEndDate) {
            const days = Math.ceil((new Date(occ.leaseEndDate) - new Date()) / 86400000);
            const cls  = days < 0 ? 'expiry-critical' : days <= 30 ? 'expiry-warning' : 'expiry-ok';
            expiryHtml = `<span class="${cls}">${days < 0 ? `منتهي منذ ${Math.abs(days)} يوم` : `${days} يوم`}</span>`;
        }

        if (u.floor !== currentFloor) {
            currentFloor = u.floor;
            html += `<tr class="floor-separator" style="background:var(--bg-2);border:none;box-shadow:none;"><td colspan="9" style="text-align:center;font-weight:900;color:var(--primary);font-size:16px;padding:12px;border:none;justify-content:center;">الدور ${currentFloor}</td></tr>`;
        }

        html += `
        <tr class="row-${occType}">
            <td data-label="كود الوحدة"><code style="font-family:var(--font-mono);font-weight:700;color:var(--primary);">${escHtml(u.unitCode)}</code></td>
            <td data-label="الشاغل">${occ ? `<div style="font-weight:700;">${escHtml(occ.fullName)}</div><div style="font-size:11px;color:var(--text-muted);">${escHtml(occ.idNumber||'')}</div>` : '<span style="color:var(--text-muted);">—</span>'}</td>
            <td data-label="النوع"><span class="occ-badge ${occClass}">${occLabel}</span></td>
            <td data-label="الدور">الدور ${u.floor}</td>
            <td data-label="الحالة"><span class="status-badge ${statusColors[u.status]||'online'}">${escHtml(u.status)}</span></td>
            <td data-label="انتهاء العقد">${expiryHtml}</td>
            <td data-label="حيوانات" style="text-align:center;">${u.hasPets ? '🐾' : '—'}</td>
            <td data-label="كبار سن" style="text-align:center;">${u.hasElderly ? '👴' : '—'}</td>
            <td data-label="الإجراءات">
                <div style="display:flex;gap:3px;">
                    <button class="btn btn-primary btn-sm" onclick="showUnitOperations('${escAttr(u.unitCode)}')">⚙️</button>
                    <button class="btn btn-warning btn-sm" onclick="promptEditUnitStatus('${escAttr(u.unitCode)}','${escAttr(u.status)}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="confirmDeleteUnit('${escAttr(u.unitCode)}')">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function clearSearch() {
    const inp = document.getElementById('search-input');
    if (inp) inp.value = '';
    const tbody = document.getElementById('search-tbody');
    if (tbody) tbody.innerHTML = '';
    lastSearchResults = [];
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.filter-btn[data-filter="all"]')?.classList.add('active');
    currentFilter = 'all';
}

// متغيرات المودال
let _statusModalUnitCode = '';
let _statusModalCurrentStatus = '';

window.promptEditUnitStatus = async function (unitCode, currentStatus) {
    _statusModalUnitCode    = unitCode;
    _statusModalCurrentStatus = currentStatus;

    const codeEl  = document.getElementById('status-modal-unit-code');
    const selectEl = document.getElementById('status-modal-select');
    if (codeEl)   codeEl.textContent  = unitCode;
    if (selectEl) selectEl.value      = currentStatus;

    document.getElementById('unit-status-modal')?.classList.remove('hidden');
};

async function applyStatusChange() {
    const newStatus = document.getElementById('status-modal-select')?.value;
    if (!newStatus || !_statusModalUnitCode) return;

    const btn = document.getElementById('btn-confirm-status-change');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> جاري...'; }

    try {
        const db  = await openDB();
        const tx  = db.transaction(['units'], 'readwrite');
        const req = tx.objectStore('units').get(_statusModalUnitCode);
        await new Promise((res, rej) => {
            req.onsuccess = () => {
                const u = req.result;
                if (u) {
                    u.status    = newStatus;
                    u.updatedAt = new Date().toISOString();
                    tx.objectStore('units').put(u);
                }
                res();
            };
            req.onerror = rej;
            tx.oncomplete = res;
        });

        closeModal('unit-status-modal');
        showToast(`تم تغيير حالة الوحدة إلى "‎${newStatus}".`);
        addLogEntry('admin', 'EDIT_UNIT_STATUS', `${_statusModalUnitCode}: ${_statusModalCurrentStatus} → ${newStatus}`);
        handleSearch();
        loadDashboardData();
    } catch (e) {
        showToast('خطأ في التعديل.', 'error');
        console.error(e);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '💾 تأكيد التغيير'; }
    }
}

window.confirmDeleteUnit = async function (unitCode) {
    if (!confirm(`حذف الوحدة "${unitCode}"؟`)) return;
    try {
        const db = await openDB();
        const tx = db.transaction(['units'], 'readwrite');
        tx.objectStore('units').delete(unitCode);
        await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
        showToast(`تم حذف الوحدة "${unitCode}".`);
        addLogEntry('admin', 'DELETE_UNIT', unitCode);
        handleSearch(); loadDashboardData();
    } catch (e) { showToast('خطأ في الحذف.', 'error'); }
};

// ══════════════════════════════════════════════════
// 11. Reports
// ══════════════════════════════════════════════════

let lastReportData = [], lastReportCols = [], lastReportTitle = '';

async function generateReport(type) {
    const headerEl = document.getElementById('report-output-header');
    const titleEl  = document.getElementById('report-title-display');
    const table    = document.getElementById('reports-output-table');
    const theadRow = document.getElementById('reports-table-headers');
    const tbody    = document.getElementById('reports-tbody');
    if (!table || !theadRow || !tbody) return;

    headerEl?.classList.remove('hidden');
    table.classList.remove('hidden');
    theadRow.innerHTML = '';
    tbody.innerHTML    = '<tr><td colspan="10" style="text-align:center;padding:16px;">⏳ جاري التحميل...</td></tr>';

    let data = [], cols = [], title = '';

    if (type === 'projects') {
        title = 'تقرير المشروعات';
        cols  = ['كود','الاسم','المدينة','الدولة','الأدوار','وحدات/دور','تاريخ الإنشاء'];
        data  = (await getAllProjects().catch(() => [])).map(p => [p.projectCode, p.projectName, p.city, p.country, p.floors||'—', p.unitPerFloor||'—', p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : '—']);

    } else if (type === 'units-vacant') {
        title = 'الوحدات الشاغرة'; cols = ['كود الوحدة','المشروع','العمارة','الدور','المساحة','الحالة'];
        data  = (await getAllUnits().catch(() => [])).filter(u => u.status==='فارغة').map(u => [u.unitCode,u.projectCode,u.buildingCode,`الدور ${u.floor}`,`${u.area} م²`,u.status]);

    } else if (type === 'units-rented') {
        title = 'الوحدات المؤجرة'; cols = ['كود الوحدة','المشروع','العمارة','الدور','المساحة','الحالة'];
        data  = (await getAllUnits().catch(() => [])).filter(u => u.status==='مؤجرة').map(u => [u.unitCode,u.projectCode,u.buildingCode,`الدور ${u.floor}`,`${u.area} م²`,u.status]);

    } else if (type === 'units-owned') {
        title = 'الوحدات المملوكة'; cols = ['كود الوحدة','المشروع','العمارة','الدور','المساحة','الحالة'];
        data  = (await getAllUnits().catch(() => [])).filter(u => u.status==='مملوكة').map(u => [u.unitCode,u.projectCode,u.buildingCode,`الدور ${u.floor}`,`${u.area} م²`,u.status]);

    } else if (type === 'lease-expiry') {
        title = 'تقرير انتهاء عقود الإيجار';
        cols  = ['كود الوحدة','اسم المستأجر','رقم الهوية','تاريخ الانتهاء','الأيام المتبقية','الحالة'];
        const occupants = await getAllFromStore('occupants').catch(() => []);
        const today = new Date();
        data = occupants.filter(o => o.leaseEndDate).map(o => {
            const days = Math.ceil((new Date(o.leaseEndDate) - today) / 86400000);
            return [o.unitCode, o.fullName, o.idNumber||'—', o.leaseEndDate, days >= 0 ? `${days} يوم` : `منتهي ${Math.abs(days)} يوم`, days < 0 ? '❌ منتهي' : days <= 30 ? '⚠️ قريب' : '✅ سارٍ'];
        }).sort((a, b) => a[4].localeCompare(b[4]));

    } else if (type === 'audit-log') {
        title = 'سجل العمليات'; cols = ['المستخدم','الإجراء','التفاصيل','التاريخ'];
        const logs = await getAuditLogs().catch(() => []);
        data = logs.map(l => [l.username, l.action, l.details, new Date(l.timestamp).toLocaleString('ar-EG')]);
    }

    if (titleEl) titleEl.textContent = title;
    lastReportData = data; lastReportCols = cols; lastReportTitle = title;
    theadRow.innerHTML = cols.map(c => `<th>${escHtml(c)}</th>`).join('');

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد بيانات.</td></tr>`;
        return;
    }
    tbody.innerHTML = data.map(row => `<tr>${row.map((c, i) => `<td data-label="${escHtml(cols[i])}">${escHtml(String(c))}</td>`).join('')}</tr>`).join('');
}

function exportReportCSV() {
    if (!lastReportData.length) { showToast('لا توجد بيانات.', 'warning'); return; }
    const BOM  = '\uFEFF';
    const rows = [lastReportCols, ...lastReportData];
    const csv  = BOM + rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `PPMS_${lastReportTitle}_${new Date().toISOString().slice(0,10)}.csv` });
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    showToast('تم تصدير التقرير CSV.');
}

// ══════════════════════════════════════════════════
// 12. Archive
// ══════════════════════════════════════════════════

async function loadArchiveAll() {
    // جلب كل السجلات بدون فلترة على roleType — الأرشيف يشمل كل الوحدات المنتهية
    const records = await getAllArchive().catch(() => []);
    // ترتيب من الأحدث للأقدم
    records.sort((a, b) => new Date(b.archivedAt || b.moveOutDate || 0) - new Date(a.archivedAt || a.moveOutDate || 0));
    await renderArchive(records);
}

async function searchArchive() {
    const query = document.getElementById('archive-search-input')?.value.trim().toLowerCase();
    const all   = await getAllArchive().catch(() => []);
    const filtered = all.filter(r =>
        !query ||
        r.fullName?.toLowerCase().includes(query) ||
        r.unitCode?.toLowerCase().includes(query) ||
        r.idNumber?.includes(query) ||
        r.roleType?.toLowerCase().includes(query)
    );
    // ترتيب من الأحدث للأقدم
    filtered.sort((a, b) => new Date(b.archivedAt || b.moveOutDate || 0) - new Date(a.archivedAt || a.moveOutDate || 0));
    await renderArchive(filtered);
}

async function renderArchive(records) {
    const container = document.getElementById('archive-cards-container');
    if (!container) return;

    if (!records.length) {
        container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="empty-icon">🗄️</div><p>لا توجد سجلات في الأرشيف.</p></div>`;
        return;
    }

    // تحميل كل الوثائق مرة واحدة وتجميعها حسب الوحدة
    const allDocs = await getAllFromStore('documents').catch(() => []);
    const docsByUnit = {};
    allDocs.forEach(d => {
        if (!docsByUnit[d.unitCode]) docsByUnit[d.unitCode] = [];
        docsByUnit[d.unitCode].push(d);
    });

    container.innerHTML = records.map(r => {
        const moveIn  = r.moveInDate  ? new Date(r.moveInDate).toLocaleDateString('ar-EG')  : '—';
        const moveOut = r.moveOutDate ? new Date(r.moveOutDate).toLocaleDateString('ar-EG') : '—';
        // عدد الوثائق: من سجل الأرشيف + من مخزن documents
        const archivedDocs = r.documents?.length || 0;
        const storeDocs    = docsByUnit[r.unitCode]?.length || 0;
        const totalDocs    = archivedDocs + storeDocs;
        // المعرف الحقيقي للسجل
        const recordKey    = r.archiveId ?? r.id ?? 0;
        // تحديد نوع العقد
        const hasLease = r.leaseType || (r.moveInDate && r.moveOutDate);
        const roleLabel = r.roleType || 'مستأجر';
        const roleColor = roleLabel === 'مالك' ? '#16a34a' : roleLabel === 'وكيل' ? '#1565c0' : '#d97706';
        // أول صورة مصغّرة إن وجدت
        const firstImg = r.documents?.find(d => d.mimeType?.startsWith('image/') && d.docData)
                      || docsByUnit[r.unitCode]?.find(d => d.mimeType?.startsWith('image/') && d.docData);

        return `
        <div class="archive-card">
            <div class="archive-card-header">
                <h4>🏠 ${escHtml(r.unitCode)}</h4>
                <span class="archive-duration">${r.durationDays || 0} يوم</span>
            </div>
            ${firstImg ? `<div style="text-align:center;padding:6px 12px 0;"><img src="${firstImg.docData}" alt="وثيقة" style="max-height:70px;max-width:100%;border-radius:6px;object-fit:cover;border:1px solid var(--border);"></div>` : ''}
            <div class="archive-card-body">
                <div class="archive-row"><span>الاسم</span><strong>${escHtml(r.fullName||'—')}</strong></div>
                <div class="archive-row"><span>الهوية</span><strong>${escHtml(r.idNumber||'—')}</strong></div>
                <div class="archive-row"><span>الصفة</span><strong style="color:${roleColor}">${escHtml(roleLabel)}</strong></div>
                <div class="archive-row"><span>دخل</span><strong>${moveIn}</strong></div>
                <div class="archive-row"><span>خرج</span><strong>${moveOut}</strong></div>
                <div class="archive-row"><span>الهاتف</span><strong>${escHtml(r.phone||'—')}</strong></div>
                <div class="archive-row"><span>الوثائق</span><strong>${totalDocs > 0 ? `📎 ${totalDocs} وثيقة` : '—'}</strong></div>
                <button class="btn btn-secondary btn-sm" style="width:100%; margin-top:10px;" onclick="viewArchivedTenant(${recordKey})">👀 عرض كامل التفاصيل والوثائق</button>
            </div>
        </div>`;
    }).join('');
}

window.viewArchivedTenant = async function(archiveId) {
    try {
        const records = await getAllArchive();
        // بحث مرن: نجرب archiveId و id كليهم، ونقارن برقم ونص
        const aid = Number(archiveId);
        const r = records.find(x =>
            x.archiveId === aid ||
            x.archiveId === archiveId ||
            x.id === aid ||
            x.id === archiveId
        );

        if (!r) {
            console.error('[viewArchivedTenant] لم يوجد سجل بمعرف:', archiveId);
            showToast('لم يتم العثور على السجل.', 'error');
            return;
        }

        const moveIn    = r.moveInDate  ? new Date(r.moveInDate).toLocaleDateString('ar-EG')  : '—';
        const moveOut   = r.moveOutDate ? new Date(r.moveOutDate).toLocaleDateString('ar-EG') : '—';
        const archived  = r.archivedAt  ? new Date(r.archivedAt).toLocaleDateString('ar-EG')  : '—';
        const roleLabel = r.roleType || '—';
        const roleColor = roleLabel === 'مالك' ? '#16a34a' : roleLabel === 'وكيل' ? '#1565c0' : '#d97706';

        document.getElementById('archive-details-body').innerHTML = `
            <table style="width:100%; text-align:right; border-collapse:collapse;">
                <tr><td style="padding:8px 5px; color:var(--text-muted); width:130px; border-bottom:1px solid var(--border);">كود الوحدة:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border); font-family:var(--font-mono); color:var(--primary);">${escHtml(r.unitCode)}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">الاسم الكامل:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${escHtml(r.fullName||'—')}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">رقم الهوية:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border); font-family:var(--font-mono);">${escHtml(r.idNumber||'—')}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">الصفة:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border); color:${roleColor};">${escHtml(roleLabel)}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">رقم الهاتف:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${escHtml(r.phone||'—')}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">تاريخ الدخول:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${moveIn}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">تاريخ الخروج:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${moveOut}</td></tr>
                <tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">مدة الإقامة:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${r.durationDays ? r.durationDays + ' يوم' : '—'}</td></tr>
                ${r.notes ? `<tr><td style="padding:8px 5px; color:var(--text-muted); border-bottom:1px solid var(--border);">ملاحظات:</td>
                    <td style="font-weight:700; padding:8px 5px; border-bottom:1px solid var(--border);">${escHtml(r.notes)}</td></tr>` : ''}
                <tr><td style="padding:8px 5px; color:var(--text-muted);">تاريخ الأرشفة:</td>
                    <td style="font-weight:700; padding:8px 5px;">${archived}</td></tr>
            </table>
        `;

        // ── جلب الوثائق ──
        // أولاً: من سجل الأرشيف نفسه (محفوظة وقت الأرشفة)
        // ثانياً: من مخزن documents (احتياطي)
        let docsList = (r.documents && r.documents.length > 0)
            ? r.documents
            : await getDocumentsByUnit(r.unitCode).catch(() => []);

        const docsContainer = document.getElementById('archive-docs-list');
        const docIcons = {
            'جواز سفر': '🛂', 'تصريح إقامة': '📋', 'عقد إيجار': '📝',
            'بطاقة هوية': '🪪', 'تصريح عمل': '💼', 'وثيقة أخرى': '📎'
        };

        if (!docsList || docsList.length === 0) {
            docsContainer.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:20px;">📭 لا توجد وثائق مرفقة بهذا السجل.</div>';
        } else {
            docsContainer.innerHTML = docsList.map(d => {
                const sizeKB  = d.fileSize ? `${(d.fileSize/1024).toFixed(1)} KB` : '—';
                const hasData = !!d.docData;
                const isImage = d.mimeType?.startsWith('image/');
                const isPDF   = d.mimeType === 'application/pdf' || d.docName?.toLowerCase().endsWith('.pdf');

                let previewHtml = '';
                if (hasData && isImage) {
                    previewHtml = `<div style="margin:8px 0;"><img src="${d.docData}" alt="${escHtml(d.docName)}" style="max-width:100%; max-height:200px; border-radius:8px; border:1px solid var(--border); object-fit:contain;"></div>`;
                } else if (hasData && isPDF) {
                    previewHtml = `<div style="margin:8px 0; padding:8px; background:var(--surface); border-radius:6px; border:1px solid var(--border); font-size:11px; color:var(--text-muted);">📄 ملف PDF — اضغط تحميل للعرض</div>`;
                }

                return `
                <div style="border-bottom:1px solid var(--border); padding:12px 0;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:10px; align-items:center;">
                            <span style="font-size:24px;">${docIcons[d.docType]||'📎'}</span>
                            <div>
                                <div style="font-weight:700; font-size:13px;">${escHtml(d.docName||'—')}</div>
                                <div style="color:var(--text-muted); font-size:11px;">${escHtml(d.docType||'—')} — ${sizeKB}${d.uploadedAt ? ' — ' + new Date(d.uploadedAt).toLocaleDateString('ar-EG') : ''}</div>
                            </div>
                        </div>
                        ${hasData
                            ? `<a class="btn btn-primary btn-sm" href="${d.docData}" download="${escAttr(d.docName||'file')}" target="_blank" style="text-decoration:none; flex-shrink:0;">⬇️ تحميل</a>`
                            : `<span style="font-size:11px; color:var(--text-muted); padding:4px 8px; background:var(--surface); border-radius:var(--radius-sm); border:1px solid var(--border);">غير متوفر</span>`
                        }
                    </div>
                    ${previewHtml}
                </div>`;
            }).join('');
        }

        // ── فتح المودال ──
        const modal = document.getElementById('archive-details-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
        }
    } catch (e) {
        console.error('[viewArchivedTenant]', e);
        showToast('حدث خطأ أثناء تحميل التفاصيل.', 'error');
    }
}

// ══════════════════════════════════════════════════
// 13. Export / Import / Settings
// ══════════════════════════════════════════════════

async function exportDatabase() {
    try {
        const [projects, buildings, units, archive] = await Promise.all([
            getAllProjects(), getAllBuildings(), getAllUnits(), getAllArchive(),
        ]);
        const blob = new Blob([JSON.stringify({ version:'4.0', exportedAt: new Date().toISOString(), projects, buildings, units, archive }, null, 2)], { type:'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = Object.assign(document.createElement('a'), { href: url, download: `PPMS_Backup_${new Date().toISOString().slice(0,10)}.json` });
        document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        showToast('تم تصدير النسخة الاحتياطية.');
    } catch (e) { showToast('خطأ في التصدير.', 'error'); }
}

async function importDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm(`استيراد:\n• ${data.projects?.length||0} مشروع\n• ${data.buildings?.length||0} عمارة\n• ${data.units?.length||0} وحدة\nالمتابعة؟`)) return;
            for (const p of (data.projects||[])) await putRecord('projects', p);
            for (const b of (data.buildings||[])) await putRecord('buildings', b);
            for (const u of (data.units||[])) await putRecord('units', u);
            for (const a of (data.archive||[])) await putRecord('tenantArchive', a);
            showToast('تم الاستيراد. جاري الإعادة...');
            setTimeout(() => location.reload(), 1500);
        } catch { showToast('ملف غير صالح.', 'error'); }
    };
    reader.readAsText(file);
    event.target.value = '';
}

async function confirmClearData() {
    if (!confirm('⚠️ سيتم حذف جميع البيانات نهائياً. هل أنت متأكد؟')) return;
    if (!confirm('تأكيد أخير: لا يمكن التراجع. هل تريد المتابعة؟')) return;
    localStorage.clear();
    indexedDB.deleteDatabase('PPMS_DB');
    showToast('تم المسح. جاري الإعادة...', 'warning');
    setTimeout(() => location.reload(), 1500);
}

// ══════════════════════════════════════════════════
// 14. P2P Sync
// ══════════════════════════════════════════════════

function initP2PLiveConnection() {
    const deviceId  = localStorage.getItem('ppms_device_id') || '—';
    const displayEl = document.getElementById('my-peer-id-display');

    // دائماً نعرض Device ID القصير فقط — لا UUID
    if (displayEl) displayEl.value = deviceId;

    if (typeof Peer === 'undefined') return;

    try {
        myPeerInstance = new Peer(String(deviceId));

        myPeerInstance.on('open', () => {
            // نتعمد نتجاهل ID المفتوح — الحقل يبقى Device ID
            if (displayEl) displayEl.value = deviceId;
        });

        myPeerInstance.on('error', err => {
            // لو الـ ID مستخدم نشتغل داخلياً بـ ID عشوائي لكن نعرض Device ID
            if (err.type === 'unavailable-id') {
                myPeerInstance = new Peer();
                myPeerInstance.on('open', () => {
                    if (displayEl) displayEl.value = deviceId; // نعيد عرض Device ID
                });
                myPeerInstance.on('error', () => {});
            }
        });

        myPeerInstance.on('connection', conn => {
            conn.on('data', async msg => {
                if (msg.type === 'SYNC') {
                    for (const p of (msg.data.projects||[])) await putRecord('projects', p);
                    for (const b of (msg.data.buildings||[])) await putRecord('buildings', b);
                    for (const u of (msg.data.units||[])) await putRecord('units', u);
                    showToast('تم استقبال بيانات زميل. جاري التحديث...');
                    loadDashboardData();
                }
            });
        });
    } catch (e) {
        if (displayEl) displayEl.value = deviceId;
    }
}

window.connectAndSyncLive = async function () {
    const targetId = document.getElementById('peer-connection-input')?.value.trim();
    const badge    = document.getElementById('p2p-status-badge');
    if (!targetId) { showToast('أدخل Peer ID.', 'warning'); return; }
    if (!myPeerInstance) { showToast('P2P غير جاهز.', 'error'); return; }
    if (badge) { badge.textContent = '🟡 جاري الاتصال...'; badge.className = 'status-badge warning'; }

    try {
        const conn = myPeerInstance.connect(targetId);
        conn.on('open', async () => {
            if (badge) { badge.textContent = '🟢 متصل'; badge.className = 'status-badge online'; }
            const [projects, buildings, units] = await Promise.all([getAllProjects(), getAllBuildings(), getAllUnits()]);
            conn.send({ type: 'SYNC', data: { projects, buildings, units } });
            showToast('تم الاتصال والمزامنة.');
        });
        conn.on('data', async msg => {
            if (msg.type === 'SYNC') {
                for (const p of (msg.data.projects||[])) await putRecord('projects', p);
                for (const b of (msg.data.buildings||[])) await putRecord('buildings', b);
                for (const u of (msg.data.units||[])) await putRecord('units', u);
                showToast('تم استقبال بيانات الزميل.');
                loadDashboardData();
            }
        });
        conn.on('close', () => { if (badge) { badge.textContent = '⚪ غير متصل'; badge.className = 'status-badge'; } });
        conn.on('error', () => { showToast('فشل الاتصال.', 'error'); if (badge) { badge.textContent = '🔴 خطأ'; badge.className = 'status-badge offline'; } });
    } catch (e) { showToast('فشل P2P.', 'error'); }
};

window.copyPeerId = function () {
    const val = document.getElementById('my-peer-id-display')?.value;
    if (!val || val === '—') { showToast('لا يوجد ID للنسخ.', 'warning'); return; }
    navigator.clipboard?.writeText(val)
        .then(() => showToast('تم نسخ الـ ID.'))
        .catch(() => showToast('تعذر النسخ.', 'error'));
};

// ══════════════════════════════════════════════════
// 15. Helpers
// ══════════════════════════════════════════════════

function escHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttr(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/'/g,"\\'").replace(/"/g,'&quot;');
}
function emptyState(icon, text) {
    return `<div class="empty-state" style="padding:28px;"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
}

// Public helper for operations.js
window.loadHistoryList = function (db, storeName, indexName, keyValue, containerId, formatter) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '<div class="history-item">⏳ جاري التحميل...</div>';
    try {
        const tx    = db.transaction([storeName], 'readonly');
        const req   = tx.objectStore(storeName).index(indexName).getAll(keyValue);
        req.onsuccess = () => {
            const items = req.result || [];
            container.innerHTML = items.length
                ? items.map(i => `<div class="history-item"><span>${escHtml(formatter(i))}</span></div>`).join('')
                : '<div class="history-item" style="justify-content:center;color:var(--text-muted);">لا توجد سجلات.</div>';
        };
        req.onerror = () => { container.innerHTML = '<div class="history-item" style="color:var(--danger);">خطأ في التحميل.</div>'; };
    } catch (e) {
        container.innerHTML = '<div class="history-item" style="color:var(--danger);">خطأ في قاعدة البيانات.</div>';
    }
};

// Expose archiveTenant to operations.js
window.doArchiveTenant = async function (occupantData, unitCode, moveInDate, documents) {
    const moveOut = new Date();
    const moveIn  = moveInDate ? new Date(moveInDate) : moveOut;
    const days    = Math.round((moveOut - moveIn) / 86400000);

    await archiveTenant({
        unitCode,
        fullName:    occupantData.fullName,
        idNumber:    occupantData.idNumber,
        phone:       occupantData.phone,
        roleType:    occupantData.roleType,
        moveInDate:  moveInDate || null,
        moveOutDate: moveOut.toISOString(),
        durationDays: days,
        documents:   documents || [],
        archivedAt:  new Date().toISOString(),
    });

    // تغيير حالة الوحدة إلى فارغة
    try {
        const db  = await openDB();
        const tx  = db.transaction(['units'], 'readwrite');
        const req = tx.objectStore('units').get(unitCode);
        req.onsuccess = () => {
            const u = req.result;
            if (u) { u.status = 'فارغة'; u.occupantType = 'vacant'; u.updatedAt = new Date().toISOString(); tx.objectStore('units').put(u); }
        };
    } catch (e) {}

    addLogEntry('admin', 'ARCHIVE_TENANT', `${occupantData.fullName} → أرشيف ${unitCode}`);
    showToast(`تم نقل "${occupantData.fullName}" للأرشيف تلقائياً.`);
    loadDashboardData();
};