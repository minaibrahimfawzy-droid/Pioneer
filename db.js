/**
 * Pioneer Property Management System (PPMS)
 * Database Driver v3.0
 *
 * DB_VERSION 3 — stores جديدة:
 *   documents     : وثائق الشاغلين (Base64)
 *   tenantArchive : أرشيف المستأجرين المنتهية عقودهم
 *   leaseAlerts   : إعدادات إشعارات العقود
 */

'use strict';

const DB_NAME    = 'PPMS_DB';
const DB_VERSION = 3;
let dbInstance   = null;

function openDB() {
    return new Promise((resolve, reject) => {
        if (dbInstance) { resolve(dbInstance); return; }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = event => {
            console.error('فشل فتح قاعدة البيانات:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = event => {
            dbInstance = event.target.result;
            dbInstance.onclose      = () => { dbInstance = null; };
            dbInstance.onversionchange = () => { dbInstance.close(); dbInstance = null; };
            resolve(dbInstance);
        };

        request.onupgradeneeded = event => {
            const db  = event.target.result;
            const old = event.oldVersion;

            // ── Version 1 & 2 stores (إبقاء البيانات القديمة) ──────────────
            if (!db.objectStoreNames.contains('projects')) {
                const s = db.createObjectStore('projects', { keyPath: 'projectCode' });
                s.createIndex('projectName', 'projectName', { unique: false });
            }
            if (!db.objectStoreNames.contains('buildings')) {
                const s = db.createObjectStore('buildings', { keyPath: 'id', autoIncrement: true });
                s.createIndex('projectCode',  'projectCode',  { unique: false });
                s.createIndex('buildingCode', 'buildingCode', { unique: false });
            }
            if (!db.objectStoreNames.contains('units')) {
                const s = db.createObjectStore('units', { keyPath: 'unitCode' });
                s.createIndex('projectCode',  'projectCode',  { unique: false });
                s.createIndex('buildingCode', 'buildingCode', { unique: false });
                s.createIndex('status',       'status',       { unique: false });
                s.createIndex('occupantType', 'occupantType', { unique: false });
            }
            if (!db.objectStoreNames.contains('activation')) {
                db.createObjectStore('activation', { keyPath: 'key' });
            }
            if (!db.objectStoreNames.contains('users')) {
                db.createObjectStore('users', { keyPath: 'username' });
            }
            if (!db.objectStoreNames.contains('auditLog')) {
                const s = db.createObjectStore('auditLog', { keyPath: 'logId', autoIncrement: true });
                s.createIndex('timestamp', 'timestamp', { unique: false });
                s.createIndex('action',    'action',    { unique: false });
            }
            if (!db.objectStoreNames.contains('occupants')) {
                const s = db.createObjectStore('occupants', { keyPath: 'idNumber' });
                s.createIndex('fullName',  'fullName',  { unique: false });
                s.createIndex('unitCode',  'unitCode',  { unique: false });
                s.createIndex('roleType',  'roleType',  { unique: false });
            }
            if (!db.objectStoreNames.contains('vehicles')) {
                const s = db.createObjectStore('vehicles', { keyPath: 'plateNumber' });
                s.createIndex('ownerId',  'ownerId',  { unique: false });
                s.createIndex('unitCode', 'unitCode', { unique: false });
            }
            if (!db.objectStoreNames.contains('maintenance')) {
                const s = db.createObjectStore('maintenance', { keyPath: 'ticketNumber', autoIncrement: true });
                s.createIndex('unitCode', 'unitCode', { unique: false });
                s.createIndex('status',   'status',   { unique: false });
                s.createIndex('priority', 'priority', { unique: false });
            }
            if (!db.objectStoreNames.contains('violations')) {
                const s = db.createObjectStore('violations', { keyPath: 'violationId', autoIncrement: true });
                s.createIndex('unitCode', 'unitCode', { unique: false });
            }
            if (!db.objectStoreNames.contains('visits')) {
                const s = db.createObjectStore('visits', { keyPath: 'visitId', autoIncrement: true });
                s.createIndex('unitCode',  'unitCode',  { unique: false });
                s.createIndex('entryTime', 'entryTime', { unique: false });
            }

            // ── Version 3 stores (جديدة) ────────────────────────────────────
            if (!db.objectStoreNames.contains('documents')) {
                // وثائق الشاغلين — بدون حد للحجم (Base64)
                const s = db.createObjectStore('documents', { keyPath: 'docId', autoIncrement: true });
                s.createIndex('unitCode',   'unitCode',   { unique: false });
                s.createIndex('occupantId', 'occupantId', { unique: false });
                s.createIndex('docType',    'docType',    { unique: false });
            }

            if (!db.objectStoreNames.contains('tenantArchive')) {
                // أرشيف المستأجرين المنتهية عقودهم
                const s = db.createObjectStore('tenantArchive', { keyPath: 'archiveId', autoIncrement: true });
                s.createIndex('unitCode',    'unitCode',    { unique: false });
                s.createIndex('occupantId',  'occupantId',  { unique: false });
                s.createIndex('moveOutDate', 'moveOutDate', { unique: false });
                s.createIndex('fullName',    'fullName',    { unique: false });
            }

            if (!db.objectStoreNames.contains('leaseAlerts')) {
                // إعدادات إشعارات العقود
                db.createObjectStore('leaseAlerts', { keyPath: 'alertKey' });
            }
        };
    });
}

// ─────────────────────────────────────
// Generic CRUD Helpers
// ─────────────────────────────────────

async function getAllFromStore(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const req   = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
    });
}

async function putRecord(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req   = store.put(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function addRecord(storeName, record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req   = store.add(record);
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

async function deleteRecord(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req   = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror   = () => reject(req.error);
    });
}

async function getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req   = index.getAll(value);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
    });
}

// ─────────────────────────────────────
// Domain shortcuts
// ─────────────────────────────────────

async function getAllProjects()  { return getAllFromStore('projects');       }
async function addProject(p)    { return addRecord('projects', p);          }
async function getAllBuildings() { return getAllFromStore('buildings');      }
async function addBuilding(b)   { delete b.id; return addRecord('buildings', b); }
async function getAllUnits()     { return getAllFromStore('units');          }

// ─────────────────────────────────────
// Delete Cascades
// ─────────────────────────────────────

async function deleteProjectRecord(projectCode) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx     = db.transaction(['projects', 'buildings', 'units'], 'readwrite');
        tx.objectStore('projects').delete(projectCode);

        tx.objectStore('buildings').openCursor().onsuccess = e => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.projectCode === projectCode) c.delete();
            c.continue();
        };
        tx.objectStore('units').openCursor().onsuccess = e => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.projectCode === projectCode) c.delete();
            c.continue();
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => reject(tx.error);
    });
}

async function deleteBuildingAndUnits(buildingCode, projectCode) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx     = db.transaction(['buildings', 'units'], 'readwrite');
        const bStore = tx.objectStore('buildings');
        const uStore = tx.objectStore('units');

        uStore.index('buildingCode').openCursor(IDBKeyRange.only(buildingCode)).onsuccess = e => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.projectCode === projectCode) c.delete();
            c.continue();
        };
        bStore.openCursor().onsuccess = e => {
            const c = e.target.result;
            if (!c) return;
            if (c.value.buildingCode === buildingCode && c.value.projectCode === projectCode) c.delete();
            c.continue();
        };
        tx.oncomplete = () => resolve(true);
        tx.onerror    = () => reject(tx.error);
    });
}

// ─────────────────────────────────────
// Audit Log
// ─────────────────────────────────────

async function getAuditLogs() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction(['auditLog'], 'readonly');
        const store = tx.objectStore('auditLog');
        let req;
        try {
            req = store.index('timestamp').openCursor(null, 'prev');
        } catch {
            req = store.openCursor(null, 'prev');
        }
        const logs = [];
        req.onsuccess = e => {
            const c = e.target.result;
            if (c && logs.length < 500) { logs.push(c.value); c.continue(); }
            else resolve(logs);
        };
        req.onerror = () => reject(req.error);
    });
}

async function addLogEntry(username, action, details) {
    try {
        const db    = await openDB();
        const tx    = db.transaction(['auditLog'], 'readwrite');
        tx.objectStore('auditLog').add({
            username, action, details,
            timestamp: new Date().toISOString(),
            device: navigator.userAgent.slice(0, 80),
        });
    } catch (e) {
        console.warn('addLogEntry failed:', e);
    }
}

// ─────────────────────────────────────
// Occupants / Vehicles / Maintenance / Violations / Visits
// ─────────────────────────────────────

async function addOccupant(o)           { return putRecord('occupants', o);   }
async function addMaintenanceTicket(t)  { return addRecord('maintenance', t); }
async function addViolation(v)          { return addRecord('violations', v);  }
async function registerVisit(v)         { return addRecord('visits', v);      }

// ─────────────────────────────────────
// Documents
// ─────────────────────────────────────

async function saveDocument(doc) {
    return addRecord('documents', doc);
}

async function getDocumentsByUnit(unitCode) {
    return getByIndex('documents', 'unitCode', unitCode);
}

async function getDocumentsByOccupant(occupantId) {
    return getByIndex('documents', 'occupantId', occupantId);
}

async function deleteDocument(docId) {
    return deleteRecord('documents', docId);
}

// ─────────────────────────────────────
// Tenant Archive
// ─────────────────────────────────────

async function archiveTenant(archiveRecord) {
    return addRecord('tenantArchive', archiveRecord);
}

async function getAllArchive() {
    return getAllFromStore('tenantArchive');
}

async function getArchiveByUnit(unitCode) {
    return getByIndex('tenantArchive', 'unitCode', unitCode);
}

async function getArchiveByName(fullName) {
    return getByIndex('tenantArchive', 'fullName', fullName);
}

// ─────────────────────────────────────
// Lease Alerts Settings
// ─────────────────────────────────────

async function getLeaseAlertDays() {
    const db = await openDB();
    return new Promise(resolve => {
        const tx    = db.transaction(['leaseAlerts'], 'readonly');
        const store = tx.objectStore('leaseAlerts');
        const req   = store.get('alertDays');
        req.onsuccess = () => resolve(req.result ? req.result.value : 30);
        req.onerror   = () => resolve(30);
    });
}

async function setLeaseAlertDays(days) {
    return putRecord('leaseAlerts', { alertKey: 'alertDays', value: days });
}

// ─────────────────────────────────────
// Init
// ─────────────────────────────────────

openDB().catch(e => console.error('DB init error:', e));