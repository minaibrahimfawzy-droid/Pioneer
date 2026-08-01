/**
 * Pioneer Property Management System (PPMS)
 * Operations Controller v4.0
 *
 * الجديد:
 * - تبويب وثائق: رفع Base64 بدون حد حجم
 * - تبويب الأرشيف: نقل المستأجر للأرشيف مع كل وثائقه
 * - حقول: حيوانات أليفة، كبار السن، تاريخ الدخول، تاريخ انتهاء العقد
 * - ترميز الألوان في العنوان حسب نوع الشاغل
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
    injectOperationsModal();
    injectOperationsStyles();
    window.showUnitOperations = showUnitOperations;

    document.addEventListener('click', e => {
        if (e.target.classList.contains('close-modal')) {
            const modal = document.getElementById('operations-modal');
            if (modal && modal.contains(e.target)) modal.classList.add('hidden');
        }
    });
});

// ─────────────────────────────────────
// Modal Injection
// ─────────────────────────────────────

function injectOperationsModal() {
    if (document.getElementById('operations-modal')) return;

    const div = document.createElement('div');
    div.id        = 'operations-modal';
    div.className = 'modal hidden';
    div.setAttribute('role', 'dialog');
    div.setAttribute('aria-modal', 'true');

    div.innerHTML = `
    <div class="modal-content operations-modal-content">
        <span class="close-modal" role="button" aria-label="إغلاق">×</span>
        <h2>
            <span id="ops-occ-badge" class="occ-badge occ-vacant" style="font-size:11px;margin-left:8px;">⬜ فارغة</span>
            الوحدة: <span id="ops-unit-code-title" style="color:var(--accent);font-family:var(--font-mono);"></span>
        </h2>
        <div id="ops-unit-extra-badges" style="margin:6px 0 10px;display:flex;gap:8px;flex-wrap:wrap;"></div>

        <div class="ops-tabs" id="ops-tabs-container">
            <button class="tab-btn active" data-tab="tab-occupant"    onclick="switchOpsTab('tab-occupant',    this)">👤 الشاغل</button>
            <button class="tab-btn"        data-tab="tab-vehicles"    onclick="switchOpsTab('tab-vehicles',    this)">🚗 السيارات</button>
            <button class="tab-btn"        data-tab="tab-maintenance" onclick="switchOpsTab('tab-maintenance', this)">🔧 الصيانة</button>
            <button class="tab-btn"        data-tab="tab-violations"  onclick="switchOpsTab('tab-violations',  this)">⚠️ المخالفات</button>
            <button class="tab-btn"        data-tab="tab-visits"      onclick="switchOpsTab('tab-visits',      this)">🚪 الزوار</button>
            <button class="tab-btn"        data-tab="tab-documents"   onclick="switchOpsTab('tab-documents',   this)">📄 وثائق</button>
            <button class="tab-btn"        data-tab="tab-notes"       onclick="switchOpsTab('tab-notes',       this)">📝 ملاحظات</button>
        </div>

        <!-- ── الشاغل ── -->
        <div id="tab-occupant" class="tab-content">
            <h3>بيانات المالك أو المستأجر</h3>
            <div class="form-grid" style="margin-top:12px;">
                <div class="form-group">
                    <label for="occ-role">الصفة العقارية:</label>
                    <select id="occ-role">
                        <option value="مالك">🟢 مالك الوحدة</option>
                        <option value="مستأجر">🟡 مستأجر</option>
                        <option value="وكيل">🔵 وكيل / مفوض</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="occ-phone">رقم الهاتف:</label>
                    <input type="tel" id="occ-phone" placeholder="05xxxxxxxx" inputmode="tel">
                </div>
                <div class="form-group">
                    <label for="occ-name">الاسم الكامل:</label>
                    <input type="text" id="occ-name" placeholder="الاسم الرباعي">
                </div>
                <div class="form-group">
                    <label for="occ-id">رقم الهوية / الإقامة:</label>
                    <input type="text" id="occ-id" placeholder="10 خانات" inputmode="numeric">
                </div>
                <div class="form-group">
                    <label for="occ-move-in">تاريخ الدخول / بداية العقد:</label>
                    <input type="date" id="occ-move-in">
                </div>
                <div class="form-group">
                    <label for="occ-lease-end">تاريخ انتهاء العقد:</label>
                    <input type="date" id="occ-lease-end">
                </div>
            </div>

            <!-- حيوانات أليفة وكبار السن -->
            <div style="display:flex;gap:20px;margin-bottom:14px;flex-wrap:wrap;background:var(--surface);padding:12px;border-radius:var(--radius-sm);border:1px solid var(--border);">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13px;">
                    <input type="checkbox" id="occ-has-pets" style="width:16px;height:16px;cursor:pointer;">
                    🐾 يوجد حيوانات أليفة
                </label>
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:700;font-size:13px;">
                    <input type="checkbox" id="occ-has-elderly" style="width:16px;height:16px;cursor:pointer;">
                    👴 يوجد كبار سن (يحتاج متابعة)
                </label>
            </div>
            <div id="elderly-followup-section" class="hidden" style="background:var(--info-bg);border:1px solid #a5f3fc;border-radius:var(--radius-md);padding:14px;margin-bottom:12px;">
                <div style="font-size:13px;font-weight:800;color:var(--info);margin-bottom:12px;padding-bottom:8px;border-bottom:1px dashed #a5f3fc;">👴 بيانات كبار السن</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label for="elderly-name">اسم كبير السن:</label>
                        <input type="text" id="elderly-name" placeholder="الاسم كاملاً">
                    </div>
                    <div class="form-group">
                        <label for="elderly-age">السن (سنة):</label>
                        <input type="number" id="elderly-age" placeholder="مثال: 75" min="60" max="120" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="elderly-health">الحالة الصحية:</label>
                        <select id="elderly-health">
                            <option value="جيدة">✅ جيدة</option>
                            <option value="متوسطة">⚠️ متوسطة</option>
                            <option value="تحتاج متابعة">🔴 تحتاج متابعة</option>
                            <option value="مريض / طريح الفراش">🏥 مريض / طريح</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="elderly-phone">هاتف التواصل الطارئ:</label>
                        <input type="tel" id="elderly-phone" placeholder="05xxxxxxxx" inputmode="tel">
                    </div>
                    <div class="form-group">
                        <label for="elderly-last-visit">تاريخ آخر متابعة:</label>
                        <input type="date" id="elderly-last-visit">
                    </div>
                    <div class="form-group">
                        <label for="elderly-next-visit">موعد المتابعة القادمة:</label>
                        <input type="date" id="elderly-next-visit">
                    </div>
                </div>
                <div class="form-group" style="grid-column: 1 / -1;">
                    <label for="elderly-diseases">الأمراض المزمنة (إن وجدت):</label>
                    <input type="text" id="elderly-diseases" placeholder="سكري ، ضغط ، قلب ، كلى...">
                </div>
                <div class="form-group">
                    <label for="elderly-notes">ملاحظات إضافية:</label>
                    <textarea id="elderly-notes" rows="2" class="form-textarea" placeholder="أي تفاصيل أخرى..."></textarea>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-top:4px;">
                <button class="btn btn-primary" style="flex:1;" onclick="saveOccupantData()">💾 حفظ بيانات الشاغل</button>
                <button class="btn btn-danger btn-sm" onclick="confirmArchiveOccupant()" title="أنهِ العقد وانقل للأرشيف">🗄️ إنهاء وأرشفة</button>
            </div>
            <div id="occupant-feedback" style="margin-top:8px;font-size:12px;text-align:center;"></div>
        </div>

        <!-- ── السيارات ── -->
        <div id="tab-vehicles" class="tab-content hidden">
            <h3>إضافة سيارة جديدة</h3>
            <div class="form-grid" style="margin-top:12px;">
                <div class="form-group">
                    <label for="new-car-plate">رقم اللوحة:</label>
                    <input type="text" id="new-car-plate" placeholder="أ ب ج 1234" style="text-transform:uppercase;">
                </div>
                <div class="form-group">
                    <label for="new-car-parking">رقم موقف السيارة:</label>
                    <input type="text" id="new-car-parking" placeholder="P-12">
                </div>
            </div>
            <button class="btn btn-primary" style="width:100%;margin-bottom:16px;" onclick="addNewVehicle()">➕ إضافة سيارة</button>
            <h4 class="sub-title">السيارات المسجلة:</h4>
            <div id="vehicles-list-container" class="ops-history-list"></div>
        </div>

        <!-- ── الصيانة ── -->
        <div id="tab-maintenance" class="tab-content hidden">
            <h3>تسجيل بلاغ صيانة</h3>
            <div class="form-group" style="margin-top:12px;">
                <label for="maint-title">نوع المشكلة / العطل:</label>
                <input type="text" id="maint-title" placeholder="تسريب مياه بالحمام الرئيسي">
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label for="maint-priority">الأولوية:</label>
                    <select id="maint-priority">
                        <option value="عادي">✅ عادي</option>
                        <option value="متوسط">⚠️ متوسط</option>
                        <option value="طارئ جداً">🚨 طارئ جداً</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="maint-tech">الفني المختص:</label>
                    <input type="text" id="maint-tech" placeholder="اسم الفني">
                </div>
            </div>
            <button class="btn btn-primary margin-top" style="width:100%;" onclick="saveMaintenanceTicket()">📋 تسجيل بلاغ الصيانة</button>
            <h4 class="sub-title" style="margin:14px 0 6px;">بلاغات الصيانة السابقة:</h4>
            <div id="maint-history-list" class="ops-history-list"></div>
        </div>

        <!-- ── المخالفات ── -->
        <div id="tab-violations" class="tab-content hidden">
            <h3>رصد مخالفة على الوحدة</h3>
            <div class="form-group" style="margin-top:12px;">
                <label for="vio-type">نوع المخالفة:</label>
                <input type="text" id="vio-type" placeholder="وضع مهملات بالممرات">
            </div>
            <div class="form-group">
                <label for="vio-desc">وصف الإجراء:</label>
                <textarea id="vio-desc" rows="3" class="form-textarea" placeholder="تفاصيل الإجراء المتخذ..."></textarea>
            </div>
            <button class="btn btn-warning margin-top" style="width:100%;" onclick="saveViolationData()">⚠️ تقييد المخالفة</button>
            <h4 class="sub-title" style="margin:14px 0 6px;">سجل المخالفات:</h4>
            <div id="vio-history-list" class="ops-history-list"></div>
        </div>

        <!-- ── الزوار ── -->
        <div id="tab-visits" class="tab-content hidden">
            <h3>تسجيل دخول زائر</h3>
            <div class="form-grid" style="margin-top:12px;">
                <div class="form-group">
                    <label for="visit-name">اسم الزائر:</label>
                    <input type="text" id="visit-name" placeholder="الاسم الرباعي">
                </div>
                <div class="form-group">
                    <label for="visit-id">رقم الهوية:</label>
                    <input type="text" id="visit-id" placeholder="رقم الوثيقة" inputmode="numeric">
                </div>
            </div>
            <div class="form-group">
                <label for="visit-reason">سبب الزيارة:</label>
                <input type="text" id="visit-reason" placeholder="زيارة عائلية / صيانة / ...">
            </div>
            <button class="btn btn-primary margin-top" style="width:100%;" onclick="saveVisitorData()">🚪 تسجيل دخول الزائر</button>
            <h4 class="sub-title" style="margin:14px 0 6px;">سجل الزيارات:</h4>
            <div id="visit-history-list" class="ops-history-list"></div>
        </div>

        <!-- ── وثائق ── -->
        <div id="tab-documents" class="tab-content hidden">
            <h3>وثائق الشاغل</h3>
            <div class="form-grid" style="margin-top:12px;">
                <div class="form-group">
                    <label for="doc-type">نوع الوثيقة:</label>
                    <select id="doc-type">
                        <option value="جواز سفر">🛂 جواز سفر</option>
                        <option value="تصريح إقامة">📋 تصريح إقامة</option>
                        <option value="عقد إيجار">📝 عقد إيجار</option>
                        <option value="بطاقة هوية">🪪 بطاقة هوية</option>
                        <option value="تصريح عمل">💼 تصريح عمل</option>
                        <option value="وثيقة أخرى">📎 وثيقة أخرى</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="doc-notes">ملاحظة:</label>
                    <input type="text" id="doc-notes" placeholder="وصف الوثيقة (اختياري)">
                </div>
            </div>
            <label class="doc-upload-area" for="doc-file-input">
                <input type="file" id="doc-file-input" accept="*/*" multiple>
                <div>📂 انقر لاختيار الملف أو اسحبه هنا</div>
                <small style="display:block;margin-top:4px;color:var(--text-muted);">يقبل: صور، PDF، Word، ملفات أخرى</small>
            </label>
            <div id="doc-upload-progress" style="margin-top:8px;font-size:12px;color:var(--text-muted);text-align:center;"></div>
            <button class="btn btn-primary margin-top" style="width:100%;" onclick="uploadDocument()">⬆️ رفع الوثيقة</button>
            <h4 class="sub-title" style="margin:16px 0 6px;">الوثائق المرفوعة:</h4>
            <div id="doc-list-container" class="doc-list"></div>
        </div>

        <!-- ── ملاحظات ── -->
        <div id="tab-notes" class="tab-content hidden">
            <h3>ملاحظات خاصة بالوحدة</h3>
            <div class="form-group" style="margin-top:12px;">
                <textarea id="unit-notes" rows="6" class="form-textarea" placeholder="أي ملاحظات خاصة بالوحدة..."></textarea>
            </div>
            <button class="btn btn-primary margin-top" style="width:100%;" onclick="saveUnitNotes()">💾 حفظ الملاحظات</button>
        </div>

    </div>`;
    document.body.appendChild(div);
    div.addEventListener('click', e => { if (e.target === div) div.classList.add('hidden'); });

    // Toggle elderly section
    document.getElementById('occ-has-elderly')?.addEventListener('change', function () {
        document.getElementById('elderly-followup-section')?.classList.toggle('hidden', !this.checked);
    });

    // Drag & Drop for file
    const uploadArea = div.querySelector('.doc-upload-area');
    if (uploadArea) {
        uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });
        uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = ''; });
        uploadArea.addEventListener('drop', e => {
            e.preventDefault(); uploadArea.style.borderColor = '';
            const files = e.dataTransfer.files;
            if (files.length) {
                const input = document.getElementById('doc-file-input');
                if (input) {
                    const dt   = new DataTransfer();
                    Array.from(files).forEach(f => dt.items.add(f));
                    input.files = dt.files;
                    document.getElementById('doc-upload-progress').textContent = `✅ تم تحديد: ${Array.from(files).map(f => f.name).join(', ')}`;
                }
            }
        });
    }
}

function injectOperationsStyles() {
    if (document.getElementById('operations-styles')) return;
    const style    = document.createElement('style');
    style.id       = 'operations-styles';
    style.innerHTML = `
        .operations-modal-content { max-width: 720px !important; }
        .sub-title { font-size:12px; font-weight:800; color:var(--text-muted); margin:4px 0; }
        #tab-occupant h3, #tab-vehicles h3, #tab-maintenance h3,
        #tab-violations h3, #tab-visits h3, #tab-documents h3, #tab-notes h3 {
            font-size:14px; font-weight:800; color:var(--primary);
            margin-bottom:4px; padding-bottom:8px; border-bottom:1px dashed var(--border);
        }
        @media (max-width:600px) { .form-grid { grid-template-columns: 1fr !important; } }
    `;
    document.head.appendChild(style);
}

// ─────────────────────────────────────
// Tab Switching
// ─────────────────────────────────────

window.switchOpsTab = function (tabId, btnElement) {
    document.querySelectorAll('#operations-modal .tab-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(tabId)?.classList.remove('hidden');
    document.querySelectorAll('#ops-tabs-container .tab-btn').forEach(b => b.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        document.querySelector(`#ops-tabs-container [data-tab="${tabId}"]`)?.classList.add('active');
    }
};

// ─────────────────────────────────────
// Show Unit Operations
// ─────────────────────────────────────

let activeUnitCode = '';
let activeOccupant = null;

// مهم: تعريف صريح كـ window حتى يعمل onclick في HTML
window.showUnitOperations = async function showUnitOperations(unitCode) {
    activeUnitCode = unitCode;
    activeOccupant = null;

    document.getElementById('ops-unit-code-title').textContent = unitCode;

    resetOpsFormFields();

    try {
        const db = await openDB();

        // تحميل بيانات الوحدة
        const unitReq = db.transaction(['units'], 'readonly').objectStore('units').get(unitCode);
        unitReq.onsuccess = () => {
            const unit = unitReq.result;
            if (!unit) return;

            // الملاحظات
            const notesEl = document.getElementById('unit-notes');
            if (notesEl) notesEl.value = unit.notes || '';

            // حيوانات أليفة وكبار السن
            const petsEl   = document.getElementById('occ-has-pets');
            const elderEl  = document.getElementById('occ-has-elderly');
            const elderSec = document.getElementById('elderly-followup-section');
            if (petsEl)  petsEl.checked  = !!unit.hasPets;
            if (elderEl) elderEl.checked = !!unit.hasElderly;
            if (elderSec) elderSec.classList.toggle('hidden', !unit.hasElderly);

            const ed = unit.elderlyData || {};
            setF('elderly-name',       ed.name || '');
            setF('elderly-age',        ed.age || '');
            setF('elderly-health',     ed.health || 'جيدة');
            setF('elderly-phone',      ed.phone || '');
            setF('elderly-last-visit', ed.lastVisit || '');
            setF('elderly-next-visit', ed.nextVisit || '');
            setF('elderly-diseases',   ed.diseases || '');
            setF('elderly-notes',      ed.notes || unit.elderlyNote || '');

            // الشارات الإضافية
            const badgesEl = document.getElementById('ops-unit-extra-badges');
            if (badgesEl) {
                let html = '';
                if (unit.hasPets)    html += '<span class="status-badge warning">🐾 حيوانات أليفة</span>';
                if (unit.hasElderly) html += '<span class="status-badge info">👴 كبار السن</span>';
                html += `<span class="status-badge online">${escHtmlOps(unit.status||'—')}</span>`;
                html += `<span style="font-size:11px;color:var(--text-muted);">الدور ${unit.floor} — ${unit.area||'—'} م²</span>`;
                badgesEl.innerHTML = html;
            }
        };

        // تحميل بيانات الشاغل
        const occIndex = db.transaction(['occupants'], 'readonly').objectStore('occupants').index('unitCode');
        const occReq   = occIndex.get(unitCode);
        occReq.onsuccess = () => {
            const occ = occReq.result;
            activeOccupant = occ || null;

            if (occ) {
                const roleMap = { 'مالك': ['🟢 مالك', 'occ-owner'], 'مستأجر': ['🟡 مستأجر', 'occ-tenant'], 'وكيل': ['🔵 وكيل', 'occ-agent'] };
                const [occLabel, occClass] = roleMap[occ.roleType] || ['⬜ فارغة', 'occ-vacant'];

                const badge = document.getElementById('ops-occ-badge');
                if (badge) { badge.textContent = occLabel; badge.className = `occ-badge ${occClass}`; }

                setF('occ-role',      occ.roleType);
                setF('occ-name',      occ.fullName);
                setF('occ-id',        occ.idNumber);
                setF('occ-phone',     occ.phone);
                setF('occ-move-in',   occ.moveInDate);
                setF('occ-lease-end', occ.leaseEndDate);

                if (occ.idNumber) loadOccupantVehicles(occ.idNumber);
            } else {
                const badge = document.getElementById('ops-occ-badge');
                if (badge) { badge.textContent = '⬜ فارغة'; badge.className = 'occ-badge occ-vacant'; }
            }
        };

        // تحميل التاريخ عبر window.loadHistoryList
        if (typeof window.loadHistoryList === 'function') {
            window.loadHistoryList(db, 'maintenance', 'unitCode', unitCode, 'maint-history-list',
                i => `[${i.priority||'عادي'}] ${i.problemTitle} — ${i.status||'قيد الانتظار'}`);
            window.loadHistoryList(db, 'violations', 'unitCode', unitCode, 'vio-history-list',
                i => `${i.violationType}: ${i.description||''}`);
            window.loadHistoryList(db, 'visits', 'unitCode', unitCode, 'visit-history-list',
                i => `${i.visitorName} — ${i.purpose||''} (${new Date(i.entryTime).toLocaleDateString('ar-EG')})`);
        }

        // تحميل الوثائق
        loadDocumentsList(unitCode);

    } catch (e) {
        console.error('showUnitOperations error:', e);
    }

    document.getElementById('operations-modal')?.classList.remove('hidden');
    switchOpsTab('tab-occupant', document.querySelector('#ops-tabs-container .tab-btn'));
}

function setF(id, val) {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
}

// ─────────────────────────────────────
// Vehicles
// ─────────────────────────────────────

async function loadOccupantVehicles(ownerId) {
    const container = document.getElementById('vehicles-list-container');
    if (!container) return;
    container.innerHTML = '<div class="history-item">⏳ جاري التحميل...</div>';

    try {
        const db  = await openDB();
        const req = db.transaction(['vehicles'], 'readonly').objectStore('vehicles').index('ownerId').getAll(ownerId);
        req.onsuccess = () => {
            const vehicles = req.result || [];
            if (!vehicles.length) {
                container.innerHTML = '<div class="history-item" style="color:var(--text-muted);justify-content:center;">لا توجد سيارات.</div>';
                return;
            }
            container.innerHTML = vehicles.map(v => `
                <div class="history-item">
                    <span>🚗 <strong>${escHtmlOps(v.plateNumber)}</strong> — موقف: ${escHtmlOps(v.parkingSlot||'غير محدد')}</span>
                    <button class="btn btn-danger btn-sm" onclick="deleteVehicleRecord('${escAttrOps(v.plateNumber)}','${escAttrOps(ownerId)}')">🗑️</button>
                </div>`).join('');
        };
    } catch {
        container.innerHTML = '<div class="history-item" style="color:var(--danger);">خطأ.</div>';
    }
}

window.addNewVehicle = async function () {
    const occId   = document.getElementById('occ-id')?.value.trim();
    const plate   = document.getElementById('new-car-plate')?.value.trim().toUpperCase();
    const parking = document.getElementById('new-car-parking')?.value.trim();

    if (!occId)  { showOpsToast('احفظ بيانات الشاغل ورقم الهوية أولاً.', 'error'); return; }
    if (!plate)  { showOpsToast('أدخل رقم اللوحة.', 'error'); return; }

    try {
        await putRecord('vehicles', { plateNumber: plate, ownerId: occId, parkingSlot: parking, unitCode: activeUnitCode, updatedAt: new Date().toISOString() });
        document.getElementById('new-car-plate').value   = '';
        document.getElementById('new-car-parking').value = '';
        showOpsToast('تمت إضافة السيارة.');
        loadOccupantVehicles(occId);
    } catch { showOpsToast('خطأ.', 'error'); }
};

window.deleteVehicleRecord = async function (plateNumber, ownerId) {
    if (!confirm(`حذف السيارة "${plateNumber}"؟`)) return;
    try {
        const db = await openDB();
        const tx = db.transaction(['vehicles'], 'readwrite');
        tx.objectStore('vehicles').delete(plateNumber);
        tx.oncomplete = () => { showOpsToast('تم الحذف.'); loadOccupantVehicles(ownerId); };
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Save Occupant
// ─────────────────────────────────────

window.saveOccupantData = async function () {
    const roleType   = document.getElementById('occ-role')?.value;
    const fullName   = document.getElementById('occ-name')?.value.trim();
    const idNumber   = document.getElementById('occ-id')?.value.trim();
    const phone      = document.getElementById('occ-phone')?.value.trim();
    const moveInDate = document.getElementById('occ-move-in')?.value;
    const leaseEnd   = document.getElementById('occ-lease-end')?.value;
    const hasPets    = document.getElementById('occ-has-pets')?.checked;
    const hasElderly = document.getElementById('occ-has-elderly')?.checked;
    const elderlyData = {
        name:      document.getElementById('elderly-name')?.value.trim() || '',
        age:       document.getElementById('elderly-age')?.value.trim() || '',
        health:    document.getElementById('elderly-health')?.value || 'جيدة',
        phone:     document.getElementById('elderly-phone')?.value.trim() || '',
        lastVisit: document.getElementById('elderly-last-visit')?.value || '',
        nextVisit: document.getElementById('elderly-next-visit')?.value || '',
        diseases:  document.getElementById('elderly-diseases')?.value.trim() || '',
        notes:     document.getElementById('elderly-notes')?.value.trim() || '',
    };
    const feedback   = document.getElementById('occupant-feedback');

    if (!fullName || !idNumber) { showOpsToast('أدخل الاسم ورقم الهوية.', 'error'); return; }

    const roleTypeMap = { 'مالك': 'owner', 'مستأجر': 'tenant', 'وكيل': 'agent' };
    const occupantType = roleTypeMap[roleType] || 'vacant';

    try {
        await addOccupant({ idNumber, fullName, phone, roleType, moveInDate, leaseEndDate: leaseEnd, unitCode: activeUnitCode, updatedAt: new Date().toISOString() });

        // تحديث الوحدة (occupantType, hasPets, hasElderly, elderlyData)
        const db  = await openDB();
        const tx  = db.transaction(['units'], 'readwrite');
        const req = tx.objectStore('units').get(activeUnitCode);
        req.onsuccess = () => {
            const u = req.result;
            if (u) {
                u.occupantType = occupantType;
                u.hasPets      = hasPets;
                u.hasElderly   = hasElderly;
                u.elderlyData  = elderlyData;
                u.elderlyNote  = elderlyData.notes;
                u.updatedAt    = new Date().toISOString();
                if (occupantType === 'tenant') u.status = 'مؤجرة';
                if (occupantType === 'owner')  u.status = 'مملوكة';
                tx.objectStore('units').put(u);
            }
        };

        activeOccupant = { idNumber, fullName, phone, roleType, moveInDate, leaseEndDate: leaseEnd, unitCode: activeUnitCode };

        if (feedback) { feedback.style.color = 'var(--success)'; feedback.textContent = '✅ تم الحفظ!'; setTimeout(() => { feedback.textContent = ''; }, 3000); }
        addLogEntry('admin', 'SAVE_OCCUPANT', `${fullName} → ${activeUnitCode}`);
        loadOccupantVehicles(idNumber);
        window.checkLeaseExpirations?.();

    } catch (e) { showOpsToast('خطأ في الحفظ.', 'error'); }
};

// ─────────────────────────────────────
// Archive Occupant
// ─────────────────────────────────────

window.confirmArchiveOccupant = async function () {
    if (!activeOccupant) { showOpsToast('احفظ بيانات الشاغل أولاً.', 'warning'); return; }
    if (!confirm(`إنهاء عقد "${activeOccupant.fullName}" ونقله للأرشيف؟\nسيتم تغيير حالة الوحدة إلى "فارغة".`)) return;

    // جمع وثائق الشاغل
    const docs = await getDocumentsByUnit(activeUnitCode).catch(() => []);
    const docsMetadata = docs.map(d => ({ 
        docType: d.docType, 
        docName: d.docName, 
        uploadedAt: d.uploadedAt,
        docData: d.docData,
        fileSize: d.fileSize 
    }));

    await window.doArchiveTenant(activeOccupant, activeUnitCode, activeOccupant.moveInDate, docsMetadata);

    // حذف الشاغل من occupants
    try {
        const db = await openDB();
        const tx = db.transaction(['occupants'], 'readwrite');
        tx.objectStore('occupants').delete(activeOccupant.idNumber);
    } catch (e) {}

    activeOccupant = null;
    document.getElementById('operations-modal')?.classList.add('hidden');
};

// ─────────────────────────────────────
// Maintenance
// ─────────────────────────────────────

window.saveMaintenanceTicket = async function () {
    const title    = document.getElementById('maint-title')?.value.trim();
    const priority = document.getElementById('maint-priority')?.value;
    const tech     = document.getElementById('maint-tech')?.value.trim();

    if (!title) { showOpsToast('أدخل نوع المشكلة.', 'error'); return; }

    try {
        await addMaintenanceTicket({ unitCode: activeUnitCode, problemTitle: title, priority, assignedTech: tech, status: 'قيد الانتظار', date: new Date().toISOString() });
        showOpsToast('تم تسجيل بلاغ الصيانة.');
        addLogEntry('admin', 'MAINTENANCE', `${title} → ${activeUnitCode}`);
        document.getElementById('maint-title').value = '';
        showUnitOperations(activeUnitCode);
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Violations
// ─────────────────────────────────────

window.saveViolationData = async function () {
    const type = document.getElementById('vio-type')?.value.trim();
    const desc = document.getElementById('vio-desc')?.value.trim();
    if (!type) { showOpsToast('أدخل نوع المخالفة.', 'error'); return; }

    try {
        await addViolation({ unitCode: activeUnitCode, violationType: type, description: desc, date: new Date().toISOString() });
        showOpsToast('تم تقييد المخالفة.');
        addLogEntry('admin', 'VIOLATION', `${type} → ${activeUnitCode}`);
        document.getElementById('vio-type').value = '';
        document.getElementById('vio-desc').value = '';
        showUnitOperations(activeUnitCode);
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Visits
// ─────────────────────────────────────

window.saveVisitorData = async function () {
    const name   = document.getElementById('visit-name')?.value.trim();
    const id     = document.getElementById('visit-id')?.value.trim();
    const reason = document.getElementById('visit-reason')?.value.trim();
    if (!name) { showOpsToast('أدخل اسم الزائر.', 'error'); return; }

    try {
        await registerVisit({ unitCode: activeUnitCode, visitorName: name, visitorId: id, purpose: reason, entryTime: new Date().toISOString() });
        showOpsToast('تم تسجيل الزائر.');
        addLogEntry('admin', 'VISIT', `${name} → ${activeUnitCode}`);
        document.getElementById('visit-name').value   = '';
        document.getElementById('visit-id').value     = '';
        document.getElementById('visit-reason').value = '';
        showUnitOperations(activeUnitCode);
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Documents — رفع Base64 بدون حد حجم
// ─────────────────────────────────────

window.uploadDocument = async function () {
    const fileInput = document.getElementById('doc-file-input');
    const docType   = document.getElementById('doc-type')?.value;
    const docNotes  = document.getElementById('doc-notes')?.value.trim();
    const progress  = document.getElementById('doc-upload-progress');

    if (!fileInput?.files.length) { showOpsToast('اختر ملفاً.', 'warning'); return; }

    if (progress) progress.textContent = '⏳ جاري القراءة...';

    try {
        const files = Array.from(fileInput.files);
        for (const file of files) {
            const base64 = await fileToBase64(file);
            await saveDocument({
                unitCode:    activeUnitCode,
                occupantId:  document.getElementById('occ-id')?.value.trim() || 'unknown',
                docType:     docType,
                docName:     file.name,
                docNotes:    docNotes,
                docData:     base64,
                fileSize:    file.size,
                mimeType:    file.type,
                uploadedAt:  new Date().toISOString(),
            });
        }
        if (progress) progress.textContent = `✅ تم رفع ${files.length} ملف.`;
        fileInput.value = '';
        showOpsToast(`تم رفع ${files.length} وثيقة.`);
        addLogEntry('admin', 'UPLOAD_DOC', `${docType} → ${activeUnitCode} (${files.length} ملف)`);
        loadDocumentsList(activeUnitCode);
    } catch (e) {
        showOpsToast('خطأ في رفع الوثيقة.', 'error');
        console.error(e);
    }
};

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function loadDocumentsList(unitCode) {
    const container = document.getElementById('doc-list-container');
    if (!container) return;

    const docs = await getDocumentsByUnit(unitCode).catch(() => []);
    if (!docs.length) {
        container.innerHTML = '<div class="doc-item" style="justify-content:center;color:var(--text-muted);">لا توجد وثائق.</div>';
        return;
    }

    const docIcons = { 'جواز سفر': '🛂', 'تصريح إقامة': '📋', 'عقد إيجار': '📝', 'بطاقة هوية': '🪪', 'تصريح عمل': '💼', 'وثيقة أخرى': '📎' };

    container.innerHTML = docs.map(d => {
        const sizeKB = d.fileSize ? `${(d.fileSize / 1024).toFixed(1)} KB` : '—';
        const date   = new Date(d.uploadedAt).toLocaleDateString('ar-EG');
        return `
        <div class="doc-item">
            <span class="doc-icon">${docIcons[d.docType]||'📎'}</span>
            <div class="doc-info">
                <div class="doc-name">${escHtmlOps(d.docName)}</div>
                <div class="doc-meta">${escHtmlOps(d.docType)} — ${sizeKB} — ${date}${d.docNotes ? ' — '+escHtmlOps(d.docNotes) : ''}</div>
            </div>
            <a class="btn btn-secondary btn-sm" href="${d.docData}" download="${escAttrOps(d.docName)}" target="_blank">⬇️</a>
            <button class="btn btn-danger btn-sm" onclick="deleteDocRecord(${d.docId}, '${escAttrOps(unitCode)}')">🗑️</button>
        </div>`;
    }).join('');
}

window.deleteDocRecord = async function (docId, unitCode) {
    if (!confirm('حذف هذه الوثيقة نهائياً؟')) return;
    try {
        await deleteDocument(docId);
        showOpsToast('تم حذف الوثيقة.');
        loadDocumentsList(unitCode);
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Unit Notes
// ─────────────────────────────────────

window.saveUnitNotes = async function () {
    const notes = document.getElementById('unit-notes')?.value.trim();
    try {
        const db  = await openDB();
        const tx  = db.transaction(['units'], 'readwrite');
        const req = tx.objectStore('units').get(activeUnitCode);
        req.onsuccess = () => {
            const u = req.result;
            if (u) { u.notes = notes; u.updatedAt = new Date().toISOString(); tx.objectStore('units').put(u); }
        };
        tx.oncomplete = () => showOpsToast('تم حفظ الملاحظات.');
        tx.onerror    = () => showOpsToast('خطأ.', 'error');
    } catch { showOpsToast('خطأ.', 'error'); }
};

// ─────────────────────────────────────
// Helpers
// ─────────────────────────────────────

function resetOpsFormFields() {
    document.querySelectorAll('#operations-modal input:not([type=checkbox])').forEach(i => { i.value = ''; });
    document.querySelectorAll('#operations-modal textarea').forEach(i => { i.value = ''; });
    document.querySelectorAll('#operations-modal select').forEach(s => { s.selectedIndex = 0; });
    document.querySelectorAll('#operations-modal input[type=checkbox]').forEach(c => { c.checked = false; });
    const fb = document.getElementById('occupant-feedback');
    if (fb)  fb.textContent = '';
    const vc = document.getElementById('vehicles-list-container');
    if (vc)  vc.innerHTML  = '';
    const dl = document.getElementById('doc-list-container');
    if (dl)  dl.innerHTML  = '';
    const dp = document.getElementById('doc-upload-progress');
    if (dp)  dp.textContent = '';
    const badges = document.getElementById('ops-unit-extra-badges');
    if (badges) badges.innerHTML = '';
    document.getElementById('elderly-followup-section')?.classList.add('hidden');
}

function showOpsToast(msg, type = 'success') {
    if (typeof showToast === 'function') showToast(msg, type);
    else alert(msg);
}

function escHtmlOps(str) {
    if (!str && str !== 0) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escAttrOps(str) {
    if (!str) return '';
    return String(str).replace(/'/g,"\\'");
}