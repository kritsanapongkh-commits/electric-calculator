// ==========================================
// RENTAL ELECTRICITY APP - CORE JS ENGINE (V3)
// ==========================================


const firebaseConfig = {
    apiKey: "AIzaSyAN5tl2iwidzQeAMJ1l2-hr6nxEG7pguKM",
    authDomain: "rental-electricity.firebaseapp.com",
    projectId: "rental-electricity",
    storageBucket: "rental-electricity.firebasestorage.app",
    messagingSenderId: "718134464187",
    appId: "1:718134464187:web:2ead6afa578692223da39e"
};



// Global state
let state = {
    records: [],
    currentRecordId: null,
    theme: 'light',
    isLoggedIn: false
};

// Database instance
let db = null;
let trendChartInstance = null;

// Thai month names
const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

// Helper to format currency
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ฿";
}

// Helper to format units
function formatUnits(value) {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return Number(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " หน่วย";
}

// Helper to format simple number
function formatNum(value) {
    if (value === null || value === undefined || isNaN(value)) return "-";
    return Number(value).toFixed(2);
}

// 1. Initial Load & Theme Settings
window.addEventListener('DOMContentLoaded', () => {
    populateDropdowns();
    
    // Load local storage theme
    const savedTheme = localStorage.getItem('rental_elec_theme');
    if (savedTheme) {
        state.theme = savedTheme;
        document.body.setAttribute('data-theme', savedTheme);
        updateThemeToggleIcon();
    }
    
    // Initialize Database (Firebase Firestore or LocalStorage fallback)
    initDatabaseConnection();

    // Check login state
    const loggedInSession = localStorage.getItem('rental_elec_session');
    if (loggedInSession === 'true') {
        state.isLoggedIn = true;
        showApp();
    } else {
        state.isLoggedIn = false;
        showLogin();
    }
    
    updateDateStamp();
    setupBillFormListeners();
});

// Setup selectors
function populateDropdowns() {
    const historyYearSelect = document.getElementById('history-year-select');
    const modalYearSelect = document.getElementById('bill-year');
    
    if (!historyYearSelect || !modalYearSelect) return;
    
    const currentYearBE = new Date().getFullYear() + 543;
    const endYear = Math.max(currentYearBE + 1, 2580);
    
    historyYearSelect.innerHTML = '';
    modalYearSelect.innerHTML = '';
    
    for (let yr = 2568; yr <= endYear; yr++) {
        const opt1 = document.createElement('option');
        opt1.value = yr;
        opt1.textContent = yr;
        if (yr === currentYearBE) opt1.selected = true;
        historyYearSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = yr;
        opt2.textContent = yr;
        if (yr === currentYearBE) opt2.selected = true;
        modalYearSelect.appendChild(opt2);
    }
    
    const currentMonth = new Date().getMonth() + 1;
    document.getElementById('history-month-select').value = currentMonth;
}

// 2. Database Connection Management (Firebase / LocalStorage)
function initDatabaseConnection() {
    // Check if Firebase script is loaded and configuration has been replaced by user
    const hasConfig = firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID";
    
    if (typeof firebase !== 'undefined' && hasConfig) {
        try {
            firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            console.log("Firebase Connected successfully!");
            
            // Set up real-time listener (syncs database instantly across all phone screens)
            db.collection("records").onSnapshot((snapshot) => {
                state.records = [];
                snapshot.forEach(doc => {
                    state.records.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });
                
                // Trigger UI update if user is logged in
                if (state.isLoggedIn) {
                    // Refresh view
                    handleHistorySelectChange();
                }
            }, (error) => {
                console.error("Firestore sync error: ", error);
                loadLocalStorageFallback();
            });
            
            // Hide warning banner (Connected online)
            document.getElementById('db-warning-banner').style.display = 'none';
        } catch (e) {
            console.error("Firebase init failed: ", e);
            loadLocalStorageFallback();
        }
    } else {
        loadLocalStorageFallback();
    }
}

// Fallback to local storage if Firebase credentials aren't set
function loadLocalStorageFallback() {
    db = null;
    console.log("Database initialized in LocalStorage mode (Offline).");
    
    // Load local storage records or set mock data if empty
    const saved = localStorage.getItem('rental_elec_records');
    if (saved) {
        state.records = JSON.parse(saved);
    } else {
        seedMockData();
    }
    
    // Show warning banner
    document.getElementById('db-warning-banner').style.display = 'block';
}

function seedMockData() {
    state.records = [];
    let meterR2 = 500;
    let meterPump = 200;
    
    // Seed 12 Months for 2568
    for (let m = 1; m <= 12; m++) {
        const r2Usage = 150 + (m % 3) * 12;
        const pumpUsage = 30 + (m % 2) * 6;
        
        const r2Prev = meterR2;
        meterR2 += r2Usage;
        
        const pumpPrev = meterPump;
        meterPump += pumpUsage;
        
        const totalUnits = r2Usage + pumpUsage + 500 + (m * 8);
        const rate = 4.20;
        const energy = totalUnits * rate;
        const service = 38.22;
        const ft = totalUnits * 0.40;
        const preVat = energy + service + ft;
        const vat = preVat * 0.07;
        const discount = 20.00;
        
        state.records.push({
            id: `seed_2568_${m}`,
            month: m,
            year: 2568,
            dateAdded: `2025-${String(m).padStart(2, '0')}-28T09:00:00.000Z`,
            bill_units: totalUnits,
            bill_energy: energy,
            bill_service: service,
            bill_ft: ft,
            bill_pre_vat: preVat,
            bill_vat: vat,
            bill_discount: discount,
            meter_r2_prev: r2Prev,
            meter_r2_curr: meterR2,
            meter_pump_prev: pumpPrev,
            meter_pump_curr: meterPump
        });
    }
    
    // Seed Jan-May 2569
    for (let m = 1; m <= 5; m++) {
        const r2Usage = 160 + (m % 4) * 15;
        const pumpUsage = 35 + (m % 2) * 5;
        
        const r2Prev = meterR2;
        meterR2 += r2Usage;
        
        const pumpPrev = meterPump;
        meterPump += pumpUsage;
        
        const totalUnits = r2Usage + pumpUsage + 550 + (m * 10);
        const rate = 4.45;
        const energy = totalUnits * rate;
        const service = 38.22;
        const ft = totalUnits * 0.45;
        const preVat = energy + service + ft;
        const vat = preVat * 0.07;
        const discount = 30.00;
        
        state.records.push({
            id: `seed_2569_${m}`,
            month: m,
            year: 2569,
            dateAdded: `2026-${String(m).padStart(2, '0')}-28T09:00:00.000Z`,
            bill_units: totalUnits,
            bill_energy: energy,
            bill_service: service,
            bill_ft: ft,
            bill_pre_vat: preVat,
            bill_vat: vat,
            bill_discount: discount,
            meter_r2_prev: r2Prev,
            meter_r2_curr: meterR2,
            meter_pump_prev: pumpPrev,
            meter_pump_curr: meterPump
        });
    }
    localStorage.setItem('rental_elec_records', JSON.stringify(state.records));
}

// 3. Database CRUD Operations Helper
function saveRecord(record) {
    if (db) {
        // Save online to Firebase
        return db.collection("records").doc(record.id).set(record)
            .catch(error => {
                alert("เกิดข้อผิดพลาดในการเซฟข้อมูลไปที่คลาวด์: " + error.message);
                throw error;
            });
    } else {
        // Save offline in LocalStorage
        const index = state.records.findIndex(r => r.id === record.id);
        if (index !== -1) {
            state.records[index] = record;
        } else {
            state.records.push(record);
        }
        localStorage.setItem('rental_elec_records', JSON.stringify(state.records));
        return Promise.resolve();
    }
}

function deleteRecord(id) {
    if (db) {
        // Delete online from Firebase
        return db.collection("records").doc(id).delete()
            .catch(error => {
                alert("เกิดข้อผิดพลาดในการลบข้อมูลบนคลาวด์: " + error.message);
                throw error;
            });
    } else {
        // Delete offline from LocalStorage
        state.records = state.records.filter(r => r.id !== id);
        localStorage.setItem('rental_elec_records', JSON.stringify(state.records));
        return Promise.resolve();
    }
}

// Theme Controls
function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', state.theme);
    localStorage.setItem('rental_elec_theme', state.theme);
    updateThemeToggleIcon();
    
    if (state.currentRecordId || state.records.length > 0) {
        const currentYear = document.getElementById('history-year-select').value;
        renderTrendChart(Number(currentYear));
    }
}

function updateThemeToggleIcon() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
    if (state.theme === 'dark') {
        btn.innerHTML = `
            <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
        `;
    } else {
        btn.innerHTML = `
            <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"/></svg>
        `;
    }
}

// 4. Session Handlers
function handleLogin(event) {
    event.preventDefault();
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value;
    const errorMsg = document.getElementById('login-error');
    
    if (user === 'admin' && pass === 'admin_password') {
        state.isLoggedIn = true;
        localStorage.setItem('rental_elec_session', 'true');
        errorMsg.style.display = 'none';
        showApp();
    } else {
        errorMsg.style.display = 'block';
        errorMsg.textContent = "ชื่อผู้ใช้งาน หรือรหัสผ่าน ไม่ถูกต้อง!";
    }
}

function handleLogout() {
    state.isLoggedIn = false;
    localStorage.removeItem('rental_elec_session');
    showLogin();
}

function showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-container').style.display = 'none';
}

function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    
    handleHistorySelectChange();
}

// 5. Calculations Engine
function calculateMonthData(rec) {
    const billUnits = Number(rec.bill_units || 0);
    const billEnergy = Number(rec.bill_energy || 0);
    const billService = Number(rec.bill_service || 0);
    const billFt = Number(rec.bill_ft || 0);
    const billPreVat = Number(rec.bill_pre_vat || 0);
    const billVat = Number(rec.bill_vat || 0);
    const billDiscount = Number(rec.bill_discount || 0);
    
    const ratePerUnit = billUnits > 0 ? (billEnergy / billUnits) : 0;
    
    const r2Prev = Number(rec.meter_r2_prev || 0);
    const r2Curr = Number(rec.meter_r2_curr || 0);
    const pumpPrev = Number(rec.meter_pump_prev || 0);
    const pumpCurr = Number(rec.meter_pump_curr || 0);
    
    const r2Units = Math.max(0, r2Curr - r2Prev);
    const pumpUnits = Math.max(0, pumpCurr - pumpPrev);
    const r1Units = Math.max(0, billUnits - r2Units - pumpUnits);
    
    // Room 2 (O)
    const r2Energy = r2Units * ratePerUnit;
    const r2Service = billService / 3;
    const r2Ft = r2Units/billUnits * billFt;
    const r2PreVat = r2Energy + r2Service + r2Ft;
    const r2Vat = r2PreVat * 0.07;
    const r2Discount = billDiscount / 3;
    const r2Grand = r2PreVat + r2Vat - r2Discount;
    
    // Pump (P)
    const pumpEnergy = pumpUnits * ratePerUnit;
    const pumpService = billService / 3;
    const pumpFt = pumpUnits/billUnits * billFt;
    const pumpPreVat = pumpEnergy + pumpService + pumpFt;
    const pumpVat = pumpPreVat * 0.07;
    const pumpDiscount = billDiscount / 3;
    const pumpGrand = pumpPreVat + pumpVat - pumpDiscount;
    
    // Room 1 (N)
    const r1Energy = billEnergy - r2Energy - pumpEnergy;
    const r1Service = billService - r2Service - pumpService;
    const r1Ft = billFt - r2Ft - pumpFt;
    const r1PreVat = billPreVat - r2PreVat - pumpPreVat;
    const r1Vat = billVat - r2Vat - pumpVat;
    const r1Discount = billDiscount - r2Discount - pumpDiscount;
    
    const billGrand = billPreVat + billVat - billDiscount;
    const r1Grand = billGrand - r2Grand - pumpGrand;
    
    return {
        ratePerUnit,
        billGrand,
        units: { total: billUnits, r1: r1Units, r2: r2Units, pump: pumpUnits },
        energy: { total: billEnergy, r1: r1Energy, r2: r2Energy, pump: pumpEnergy },
        service: { total: billService, r1: r1Service, r2: r2Service, pump: pumpService },
        ft: { total: billFt, r1: r1Ft, r2: r2Ft, pump: pumpFt },
        preVat: { total: billPreVat, r1: r1PreVat, r2: r2PreVat, pump: pumpPreVat },
        vat: { total: billVat, r1: r1Vat, r2: r2Vat, pump: pumpVat },
        discount: { total: billDiscount, r1: r1Discount, r2: r2Discount, pump: pumpDiscount },
        grand: { total: billGrand, r1: r1Grand, r2: r2Grand, pump: pumpGrand }
    };
}

// 6. Navigation Dropdowns
function handleHistorySelectChange() {
    const month = Number(document.getElementById('history-month-select').value);
    const year = Number(document.getElementById('history-year-select').value);
    
    const rec = state.records.find(r => r.month === month && r.year === year);
    const sidebarAction = document.getElementById('sidebar-action-container');
    
    if (rec) {
        state.currentRecordId = rec.id;
        renderOverview();
        
        sidebarAction.innerHTML = `
            <button class="btn btn-secondary btn-block" onclick="editCurrentMonth()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                แก้ไขข้อมูลรอบบิลนี้
            </button>
        `;
    } else {
        state.currentRecordId = null;
        showWelcomeEmptyScreen(month, year);
        
        sidebarAction.innerHTML = `
            <button class="btn btn-primary btn-block" onclick="openAddModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                บันทึกข้อมูลเดือนนี้
            </button>
        `;
    }
}

function showWelcomeEmptyScreen(month, year) {
    document.getElementById('welcome-card').style.display = 'block';
    document.getElementById('overview-card').style.display = 'none';
    document.getElementById('chart-card').style.display = 'block';
    document.getElementById('dashboard-stats').style.display = 'none';
    
    document.getElementById('welcome-title').textContent = `ไม่มีข้อมูลสำหรับ เดือน ${THAI_MONTHS[month - 1]} พ.ศ. ${year}`;
    document.getElementById('welcome-desc').textContent = `รอบบิลประจำเดือนนี้ยังไม่มีข้อมูลบันทึกในระบบ คุณสามารถคลิกเพื่อกรอกข้อมูลได้ทันที`;
    document.getElementById('welcome-add-btn').innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        บันทึกข้อมูลของเดือน ${THAI_MONTHS[month - 1]} ${year}
    `;
    
    renderTrendChart(year);
}

function renderOverview() {
    const rec = state.records.find(r => r.id === state.currentRecordId);
    if (!rec) return;
    
    document.getElementById('welcome-card').style.display = 'none';
    document.getElementById('overview-card').style.display = 'block';
    document.getElementById('chart-card').style.display = 'block';
    document.getElementById('dashboard-stats').style.display = 'grid';
    
    const calc = calculateMonthData(rec);
    
    const dateOpts = { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' };
    const dateStr = new Date(rec.dateAdded).toLocaleDateString('th-TH', dateOpts) + " น.";
    document.getElementById('overview-timestamp').textContent = `บันทึกข้อมูลเมื่อ: ${dateStr}`;
    
    const monthLabel = `เดือน ${THAI_MONTHS[rec.month - 1]} ${rec.year}`;
    document.getElementById('th-month-label').textContent = monthLabel;
    document.getElementById('overview-title').innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/></svg>
        ตารางภาพรวมประจำ${monthLabel}
    `;
    
    // Stats
    document.getElementById('stat-total-bill').textContent = formatCurrency(calc.grand.total);
    document.getElementById('stat-r1-bill').textContent = formatCurrency(calc.grand.r1);
    document.getElementById('stat-r2-bill').textContent = formatCurrency(calc.grand.r2);
    document.getElementById('stat-pump-bill').textContent = formatCurrency(calc.grand.pump);
    
    // Table Rows
    document.getElementById('cell-total-units').textContent = formatNum(calc.units.total);
    document.getElementById('cell-r1-units').textContent = formatNum(calc.units.r1);
    document.getElementById('cell-r2-units').textContent = formatNum(calc.units.r2);
    document.getElementById('cell-pump-units').textContent = formatNum(calc.units.pump);
    
    document.getElementById('cell-total-energy').textContent = formatNum(calc.energy.total);
    document.getElementById('cell-r1-energy').textContent = formatNum(calc.energy.r1);
    document.getElementById('cell-r2-energy').textContent = formatNum(calc.energy.r2);
    document.getElementById('cell-pump-energy').textContent = formatNum(calc.energy.pump);
    
    document.getElementById('cell-total-service').textContent = formatNum(calc.service.total);
    document.getElementById('cell-r1-service').textContent = formatNum(calc.service.r1);
    document.getElementById('cell-r2-service').textContent = formatNum(calc.service.r2);
    document.getElementById('cell-pump-service').textContent = formatNum(calc.service.pump);
    
    document.getElementById('cell-total-ft').textContent = formatNum(calc.ft.total);
    document.getElementById('cell-r1-ft').textContent = formatNum(calc.ft.r1);
    document.getElementById('cell-r2-ft').textContent = formatNum(calc.ft.r2);
    document.getElementById('cell-pump-ft').textContent = formatNum(calc.ft.pump);
    
    document.getElementById('cell-total-pre-vat').textContent = formatNum(calc.preVat.total);
    document.getElementById('cell-r1-pre-vat').textContent = formatNum(calc.preVat.r1);
    document.getElementById('cell-r2-pre-vat').textContent = formatNum(calc.preVat.r2);
    document.getElementById('cell-pump-pre-vat').textContent = formatNum(calc.preVat.pump);
    
    document.getElementById('cell-total-vat').textContent = formatNum(calc.vat.total);
    document.getElementById('cell-r1-vat').textContent = formatNum(calc.vat.r1);
    document.getElementById('cell-r2-vat').textContent = formatNum(calc.vat.r2);
    document.getElementById('cell-pump-vat').textContent = formatNum(calc.vat.pump);
    
    document.getElementById('cell-total-discount').textContent = formatNum(calc.discount.total);
    document.getElementById('cell-r1-discount').textContent = formatNum(calc.discount.r1);
    document.getElementById('cell-r2-discount').textContent = formatNum(calc.discount.r2);
    document.getElementById('cell-pump-discount').textContent = formatNum(calc.discount.pump);
    
    document.getElementById('cell-total-grand').textContent = formatNum(calc.grand.total);
    document.getElementById('cell-r1-grand').textContent = formatNum(calc.grand.r1);
    document.getElementById('cell-r2-grand').textContent = formatNum(calc.grand.r2);
    document.getElementById('cell-pump-grand').textContent = formatNum(calc.grand.pump);
    
    document.getElementById('cell-rate-per-unit').textContent = formatNum(calc.ratePerUnit);
    
    renderTrendChart(rec.year);
}

// 7. Line Chart Generator
function renderTrendChart(selectedYear) {
    const canvas = document.getElementById('electricity-trend-chart');
    if (!canvas) return;
    
    if (typeof Chart === 'undefined') {
        console.warn("Chart.js is not loaded.");
        canvas.parentNode.innerHTML = '<div class="empty-state" style="padding:100px 0;">⚠️ ไม่สามารถโหลดกราฟได้เนื่องจากไม่ได้เชื่อมต่ออินเทอร์เน็ต (หรือโหลด Chart.js ล้มเหลว)</div>';
        return;
    }
    
    const prevYear = selectedYear - 1;
    document.getElementById('chart-description-text').textContent = `แสดงผลเปรียบเทียบข้อมูลรายเดือนของปี พ.ศ. ${prevYear} (เส้นประ) และ พ.ศ. ${selectedYear} (เส้นทึบ)`;
    
    const prevData = { total: Array(12).fill(null), r1: Array(12).fill(null), r2: Array(12).fill(null), pump: Array(12).fill(null) };
    const currData = { total: Array(12).fill(null), r1: Array(12).fill(null), r2: Array(12).fill(null), pump: Array(12).fill(null) };
    
    state.records.forEach(rec => {
        if (rec.year === prevYear && rec.month >= 1 && rec.month <= 12) {
            const calc = calculateMonthData(rec);
            prevData.total[rec.month - 1] = calc.grand.total;
            prevData.r1[rec.month - 1] = calc.grand.r1;
            prevData.r2[rec.month - 1] = calc.grand.r2;
            prevData.pump[rec.month - 1] = calc.grand.pump;
        } else if (rec.year === selectedYear && rec.month >= 1 && rec.month <= 12) {
            const calc = calculateMonthData(rec);
            currData.total[rec.month - 1] = calc.grand.total;
            currData.r1[rec.month - 1] = calc.grand.r1;
            currData.r2[rec.month - 1] = calc.grand.r2;
            currData.pump[rec.month - 1] = calc.grand.pump;
        }
    });
    
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#d1d5db' : '#475569';
    
    if (trendChartInstance) {
        trendChartInstance.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    const colors = {
        total: { solid: '#3b82f6' },
        r1: { solid: '#f59e0b' },
        r2: { solid: '#10b981' },
        pump: { solid: '#ef4444' }
    };
    
    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: THAI_MONTHS,
            datasets: [
                {
                    label: `บิลรวม (${selectedYear})`,
                    data: currData.total,
                    borderColor: colors.total.solid,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: `ห้อง 1 เจ้าของ (${selectedYear})`,
                    data: currData.r1,
                    borderColor: colors.r1.solid,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: `ห้อง 2 ผู้เช่า (${selectedYear})`,
                    data: currData.r2,
                    borderColor: colors.r2.solid,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: `ปั้มน้ำ (${selectedYear})`,
                    data: currData.pump,
                    borderColor: colors.pump.solid,
                    borderWidth: 3,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4
                },
                {
                    label: `บิลรวม (${prevYear})`,
                    data: prevData.total,
                    borderColor: colors.total.solid,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                },
                {
                    label: `ห้อง 1 เจ้าของ (${prevYear})`,
                    data: prevData.r1,
                    borderColor: colors.r1.solid,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                },
                {
                    label: `ห้อง 2 ผู้เช่า (${prevYear})`,
                    data: prevData.r2,
                    borderColor: colors.r2.solid,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                },
                {
                    label: `ปั้มน้ำ (${prevYear})`,
                    data: prevData.pump,
                    borderColor: colors.pump.solid,
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.3,
                    fill: false,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        font: { family: 'Prompt, sans-serif', size: 12 },
                        padding: 15
                    }
                },
                tooltip: {
                    titleFont: { family: 'Prompt, sans-serif', size: 14 },
                    bodyFont: { family: 'Prompt, sans-serif', size: 13 },
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) label += Number(context.parsed.y).toFixed(2) + ' บาท';
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Prompt, sans-serif', size: 11 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Prompt, sans-serif', size: 11 },
                        callback: function(value) { return value + ' ฿'; }
                    }
                }
            }
        }
    });
}

// 8. Form Modals and Dynamic Locked Inputs
function updateDateStamp() {
    const stampInput = document.getElementById('date-stamp-label');
    if (!stampInput) return;
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
    stampInput.value = dateStr;
}

function openAddModal() {
    const modal = document.getElementById('add-data-modal');
    modal.className = "modal-overlay open";
    document.getElementById('modal-form-title').textContent = "บันทึกข้อมูลค่าไฟฟ้าใหม่";
    document.getElementById('data-entry-form').reset();
    document.getElementById('entry-id-field').value = '';
    
    const selectedMonth = document.getElementById('history-month-select').value;
    const selectedYear = document.getElementById('history-year-select').value;
    
    document.getElementById('bill-month').value = selectedMonth;
    document.getElementById('bill-year').value = selectedYear;
    
    updateDateStamp();
    
    lookupPreviousMeterReadings();
    
    document.getElementById('bill-month').onchange = lookupPreviousMeterReadings;
    document.getElementById('bill-year').onchange = lookupPreviousMeterReadings;
    
    triggerLiveCalc();
}

function closeAddModal() {
    document.getElementById('add-data-modal').className = "modal-overlay";
}

// Lock meter readings if previous month is present (A1 rule)
function lookupPreviousMeterReadings() {
    const mSelect = document.getElementById('bill-month');
    const ySelect = document.getElementById('bill-year');
    if (!mSelect || !ySelect) return;
    
    const targetMonth = Number(mSelect.value);
    const targetYear = Number(ySelect.value);
    
    let prevMonth = targetMonth - 1;
    let prevYear = targetYear;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear = targetYear - 1;
    }
    
    const prevRec = state.records.find(r => r.month === prevMonth && r.year === prevYear);
    
    const r2PrevInput = document.getElementById('r2-prev-meter-input');
    const pumpPrevInput = document.getElementById('pump-prev-meter-input');
    const r2PrevLabel = document.getElementById('r2-prev-label');
    const pumpPrevLabel = document.getElementById('pump-prev-label');
    
    if (prevRec) {
        // Locked from previous month
        r2PrevInput.value = prevRec.meter_r2_curr;
        r2PrevInput.readOnly = true;
        r2PrevInput.className = "input-control readonly-input";
        r2PrevLabel.innerHTML = 'มิเตอร์ห้อง 2 เดือนก่อน <span style="color:var(--success); font-size:11px;">[ล็อก - ดึงอัตโนมัติ]</span>';
        
        pumpPrevInput.value = prevRec.meter_pump_curr;
        pumpPrevInput.readOnly = true;
        pumpPrevInput.className = "input-control readonly-input";
        pumpPrevLabel.innerHTML = 'มิเตอร์ปั้มน้ำเดือนก่อน <span style="color:var(--success); font-size:11px;">[ล็อก - ดึงอัตโนมัติ]</span>';
    } else {
        // Unlocked for manual initial input
        const sortedDesc = [...state.records].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            return b.month - a.month;
        });
        
        r2PrevInput.readOnly = false;
        r2PrevInput.className = "input-control";
        r2PrevLabel.innerHTML = 'มิเตอร์ห้อง 2 เดือนก่อน <span style="color:var(--warning); font-size:11px;">[กรอกได้ - เดือนแรกสุด]</span>';
        
        pumpPrevInput.readOnly = false;
        pumpPrevInput.className = "input-control";
        pumpPrevLabel.innerHTML = 'มิเตอร์ปั้มน้ำเดือนก่อน <span style="color:var(--warning); font-size:11px;">[กรอกได้ - เดือนแรกสุด]</span>';
        
        if (sortedDesc.length > 0) {
            r2PrevInput.value = sortedDesc[0].meter_r2_curr;
            pumpPrevInput.value = sortedDesc[0].meter_pump_curr;
        } else {
            r2PrevInput.value = 0;
            pumpPrevInput.value = 0;
        }
    }
    triggerLiveCalc();
}

// Auto-calculation for locked Pre-VAT and VAT fields
function setupBillFormListeners() {
    const energy = document.getElementById('bill-energy-input');
    const service = document.getElementById('bill-service-input');
    const ft = document.getElementById('bill-ft-input');
    const preVat = document.getElementById('bill-pre-vat-input');
    const vat = document.getElementById('bill-vat-input');
    
    function autoCalcBillTotals() {
        const valEnergy = Number(energy.value || 0);
        const valService = Number(service.value || 0);
        const valFt = Number(ft.value || 0);
        
        const computedPreVat = valEnergy + valService + valFt;
        preVat.value = computedPreVat.toFixed(2);
        
        const computedVat = computedPreVat * 0.07;
        vat.value = computedVat.toFixed(2);
        
        triggerLiveCalc();
    }
    
    energy.addEventListener('input', autoCalcBillTotals);
    service.addEventListener('input', autoCalcBillTotals);
    ft.addEventListener('input', autoCalcBillTotals);
}

function triggerLiveCalc() {
    const billUnits = Number(document.getElementById('bill-units-input').value || 0);
    const billEnergy = Number(document.getElementById('bill-energy-input').value || 0);
    const billPreVat = Number(document.getElementById('bill-pre-vat-input').value || 0);
    const billVat = Number(document.getElementById('bill-vat-input').value || 0);
    const billDiscount = Number(document.getElementById('bill-discount-input').value || 0);
    
    const r2Prev = Number(document.getElementById('r2-prev-meter-input').value || 0);
    const r2Curr = Number(document.getElementById('r2-curr-meter-input').value || 0);
    const pumpPrev = Number(document.getElementById('pump-prev-meter-input').value || 0);
    const pumpCurr = Number(document.getElementById('pump-curr-meter-input').value || 0);
    
    const rate = billUnits > 0 ? (billEnergy / billUnits) : 0;
    const r2Units = Math.max(0, r2Curr - r2Prev);
    const pumpUnits = Math.max(0, pumpCurr - pumpPrev);
    const grandTotal = billPreVat + billVat - billDiscount;
    
    document.getElementById('live-rate-val').textContent = `${rate.toFixed(4)} บาท/หน่วย`;
    document.getElementById('live-units-val').textContent = `${r2Units.toFixed(2)} | ${pumpUnits.toFixed(2)} หน่วย`;
    document.getElementById('live-grand-val').textContent = `${grandTotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`;
}

// 9. CRUD UI triggers
function saveDataEntry(event) {
    event.preventDefault();
    
    const idField = document.getElementById('entry-id-field').value;
    const month = Number(document.getElementById('bill-month').value);
    const year = Number(document.getElementById('bill-year').value);
    
    if (!idField) {
        const exist = state.records.find(r => r.month === month && r.year === year);
        if (exist) {
            alert(`มีข้อมูลของเดือน ${THAI_MONTHS[month-1]} พ.ศ. ${year} ในฐานข้อมูลอยู่แล้ว! กรุณาเลือกแก้ไขข้อมูลจากเมนูของเดือนนั้นแทน`);
            return;
        }
    }
    
    const record = {
        id: idField || Date.now().toString(),
        month,
        year,
        dateAdded: idField ? (state.records.find(r => r.id === idField).dateAdded) : new Date().toISOString(),
        
        bill_units: Number(document.getElementById('bill-units-input').value || 0),
        bill_energy: Number(document.getElementById('bill-energy-input').value || 0),
        bill_service: Number(document.getElementById('bill-service-input').value || 0),
        bill_ft: Number(document.getElementById('bill-ft-input').value || 0),
        bill_pre_vat: Number(document.getElementById('bill-pre-vat-input').value || 0),
        bill_vat: Number(document.getElementById('bill-vat-input').value || 0),
        bill_discount: Number(document.getElementById('bill-discount-input').value || 0),
        
        meter_r2_prev: Number(document.getElementById('r2-prev-meter-input').value || 0),
        meter_r2_curr: Number(document.getElementById('r2-curr-meter-input').value || 0),
        meter_pump_prev: Number(document.getElementById('pump-prev-meter-input').value || 0),
        meter_pump_curr: Number(document.getElementById('pump-curr-meter-input').value || 0)
    };
    
    // Save to Database Helper (writes to Firestore if configured, or falls back to LocalStorage)
    saveRecord(record).then(() => {
        closeAddModal();
        
        // Sync Dropdowns
        document.getElementById('history-month-select').value = month;
        document.getElementById('history-year-select').value = year;
        
        selectRecord(record.id);
    });
}

function selectRecord(id) {
    state.currentRecordId = id;
    renderOverview();
    
    const rec = state.records.find(r => r.id === id);
    if (rec) {
        document.getElementById('sidebar-action-container').innerHTML = `
            <button class="btn btn-secondary btn-block" onclick="editCurrentMonth()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                แก้ไขข้อมูลรอบบิลนี้
            </button>
        `;
    }
}

function editCurrentMonth() {
    const rec = state.records.find(r => r.id === state.currentRecordId);
    if (!rec) return;
    
    openAddModal();
    document.getElementById('modal-form-title').textContent = `แก้ไขข้อมูลค่าไฟฟ้าประจำ ${THAI_MONTHS[rec.month - 1]} ${rec.year}`;
    
    document.getElementById('entry-id-field').value = rec.id;
    document.getElementById('bill-month').value = rec.month;
    document.getElementById('bill-year').value = rec.year;
    
    document.getElementById('bill-units-input').value = rec.bill_units;
    document.getElementById('bill-energy-input').value = rec.bill_energy;
    document.getElementById('bill-service-input').value = rec.bill_service;
    document.getElementById('bill-ft-input').value = rec.bill_ft;
    document.getElementById('bill-pre-vat-input').value = rec.bill_pre_vat;
    document.getElementById('bill-vat-input').value = rec.bill_vat;
    document.getElementById('bill-discount-input').value = rec.bill_discount;
    
    lookupPreviousMeterReadings();
    
    document.getElementById('r2-prev-meter-input').value = rec.meter_r2_prev;
    document.getElementById('r2-curr-meter-input').value = rec.meter_r2_curr;
    document.getElementById('pump-prev-meter-input').value = rec.meter_pump_prev;
    document.getElementById('pump-curr-meter-input').value = rec.meter_pump_curr;
    
    triggerLiveCalc();
}

function deleteCurrentMonth() {
    const rec = state.records.find(r => r.id === state.currentRecordId);
    if (!rec) return;
    
    const conf = confirm(`คุณต้องการลบข้อมูลรอบบิลเดือน ${THAI_MONTHS[rec.month - 1]} ${rec.year} ใช่หรือไม่? ยืนยันการลบแล้วข้อมูลทั้งหมดของเดือนนี้จะถูกลบถาวร`);
    if (!conf) return;
    
    deleteRecord(state.currentRecordId).then(() => {
        handleHistorySelectChange();
    });
}
