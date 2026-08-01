/**
 * Pioneer Property Management System (PPMS)
 * Activation System v3.0
 *
 * إصلاح: التطبيق لا يفتح مباشرة — يجب المرور بشاشة التفعيل أولاً
 * التدفق الصحيح:
 *   1. DOMContentLoaded → initActivationFlow()
 *   2. checkActivationState() → true  → proceedToDashboardDirectly()
 *   2.                        → false → إظهار activation-screen
 *   3. المستخدم يُدخل الكود الصحيح → saveActivationSuccess() → Dashboard
 */

'use strict';

// ── Device ID ──────────────────────────────────────────────────────────────

function generateDeviceUUID() {
    let deviceId = localStorage.getItem('ppms_device_id');

    if (!deviceId || isNaN(deviceId) || deviceId.length < 5) {
        const timePart   = Date.now() % 10000;
        const randomPart = Math.floor(100 + Math.random() * 900);
        const generated  = (timePart * 1000) + randomPart;
        deviceId = String((generated % 9000000) + 1000000);
        localStorage.setItem('ppms_device_id', deviceId);
    }
    return deviceId;
}

function generateActivationCode(deviceId) {
    const num = parseInt(deviceId, 10);
    if (isNaN(num)) return null;
    return String(num * 7);
}

// ── Check State ─────────────────────────────────────────────────────────────

async function checkActivationState() {
    // فحص localStorage أولاً
    if (localStorage.getItem('ppms_activation_status') === 'true') return true;

    try {
        const db = await openDB();
        if (!db.objectStoreNames.contains('activation')) return false;

        return new Promise(resolve => {
            const tx  = db.transaction(['activation'], 'readonly');
            const req = tx.objectStore('activation').get('activation_status');
            req.onsuccess = () => {
                if (req.result && req.result.isActivated === true) {
                    localStorage.setItem('ppms_activation_status', 'true');
                    resolve(true);
                } else {
                    resolve(false);
                }
            };
            req.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

// ── Save Activation ─────────────────────────────────────────────────────────

async function saveActivationSuccess() {
    localStorage.setItem('ppms_activation_status', 'true');
    try {
        const db = await openDB();
        if (db.objectStoreNames.contains('activation')) {
            const tx = db.transaction(['activation'], 'readwrite');
            tx.objectStore('activation').put({
                key:         'activation_status',
                isActivated: true,
                activatedAt: new Date().toISOString(),
                device:      navigator.userAgent.slice(0, 80),
            });
        }
        try { addLogEntry('System', 'ACTIVATION', 'تم تفعيل ترخيص الجهاز بنجاح'); } catch (e) {}
    } catch (e) {
        console.warn('Activation saved to localStorage only.');
    }
}

// ── Init Flow ───────────────────────────────────────────────────────────────

async function initActivationFlow() {
    const deviceId     = generateDeviceUUID();
    const expectedCode = generateActivationCode(deviceId);

    // سر التفعيل — للمطور فقط (لا يُعرض في الواجهة)
    console.groupCollapsed('🔐 [PPMS DEV — INTERNAL]');
    console.log('%cDevice ID:       ', 'color:#0c2b5c;font-weight:bold', deviceId);
    console.log('%cActivation Code: ', 'color:#16a34a;font-weight:bold', expectedCode);
    console.groupEnd();

    // عرض معرف الجهاز في الحقل فقط (بدون المعادلة)
    const inp = document.getElementById('device-id-input');
    if (inp) inp.value = deviceId;

    // تحديث formula span إن وُجد (نخفيه)
    const formulaEl = document.getElementById('device-id-formula');
    if (formulaEl) formulaEl.closest('.activation-formula')?.remove();

    const isActivated = await checkActivationState();

    const activationScreen = document.getElementById('activation-screen');
    const loginScreen      = document.getElementById('login-screen');

    if (isActivated) {
        // ✅ مُفعَّل: إخفاء شاشة التفعيل وفتح التطبيق
        activationScreen?.classList.add('hidden');
        loginScreen?.classList.add('hidden');

        setTimeout(() => {
            if (typeof window.proceedToDashboardDirectly === 'function') {
                window.proceedToDashboardDirectly();
            }
        }, 100);

    } else {
        // ❌ غير مُفعَّل: إظهار شاشة التفعيل فقط
        activationScreen?.classList.remove('hidden');
        loginScreen?.classList.add('hidden');

        // التأكد من إخفاء التطبيق الرئيسي
        document.getElementById('app-container')?.classList.add('hidden');
    }
}

// ── Button Handler ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const btn      = document.getElementById('btn-activate');
    const codeInp  = document.getElementById('activation-code');
    const errorDiv = document.getElementById('activation-error');

    function showActivationMsg(msg, isSuccess) {
        if (!errorDiv) return;
        errorDiv.style.color      = isSuccess ? 'var(--success)'    : 'var(--danger)';
        errorDiv.style.background = isSuccess ? 'var(--success-bg)' : 'var(--danger-bg)';
        errorDiv.style.padding    = '10px';
        errorDiv.style.borderRadius = '6px';
        errorDiv.textContent      = msg;
    }

    if (btn) {
        btn.addEventListener('click', async () => {
            const deviceId    = generateDeviceUUID();
            const entered     = codeInp?.value.trim();
            const correct     = generateActivationCode(deviceId);

            if (!entered) {
                showActivationMsg('⚠️ يرجى إدخال كود التفعيل أولاً.', false);
                return;
            }

            btn.disabled    = true;
            btn.innerHTML   = '<span class="spinner"></span> جاري التحقق...';

            if (entered === correct) {
                await saveActivationSuccess();
                showActivationMsg('✅ تم التفعيل بنجاح! جاري فتح النظام...', true);

                setTimeout(() => {
                    document.getElementById('activation-screen')?.classList.add('hidden');
                    if (typeof window.proceedToDashboardDirectly === 'function') {
                        window.proceedToDashboardDirectly();
                    }
                }, 900);
            } else {
                showActivationMsg(
                    `❌ كود التفعيل غير صحيح!\nالكود الصحيح = ${deviceId} × 7`,
                    false
                );
                btn.disabled  = false;
                btn.innerHTML = '🔓 تفعيل الجهاز الآن';

                if (codeInp) {
                    codeInp.style.borderColor = 'var(--danger)';
                    codeInp.style.animation   = 'shake .4s ease';
                    setTimeout(() => {
                        codeInp.style.borderColor = '';
                        codeInp.style.animation   = '';
                    }, 2000);
                }
            }
        });

        // Enter key
        codeInp?.addEventListener('keydown', e => {
            if (e.key === 'Enter') btn.click();
        });
    }

    // ▶ تشغيل التدفق
    initActivationFlow();
});