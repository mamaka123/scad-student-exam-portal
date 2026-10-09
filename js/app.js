/* ==========================================================================
   App JS - Router, Global UI Manager, Theme Controller & Event Listeners
   ========================================================================== */

/* Global HTML Entity Escaping Utility */
if (typeof window.escapeHtml !== 'function') {
  window.escapeHtml = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };
}

/* Global Synchronizer for Academic Years & Sections */
window.populateGlobalYearsAndSections = function() {
  if (typeof storage === 'undefined' || typeof storage.getYearsAndSections !== 'function') {
    return;
  }
  const data = storage.getYearsAndSections();
  const escapeFn = window.escapeHtml;

  // 1. Student Login Page: Academic Year Select
  const loginYear = document.getElementById('student-login-year');
  if (loginYear) {
    const curVal = loginYear.value;
    const hasCur = data.years && data.years.includes(curVal);
    let optionsHtml = '<option value="" disabled ' + (!hasCur ? 'selected' : '') + '>-- Select Academic Year --</option>';
    if (data.years && data.years.length > 0) {
      data.years.forEach(y => {
        const isSel = hasCur && curVal === y;
        optionsHtml += `<option value="${escapeFn(y)}" ${isSel ? 'selected' : ''}>${escapeFn(y)}</option>`;
      });
    }
    loginYear.innerHTML = optionsHtml;

    // Control visibility of the section select group on student login
    const secGroup = document.getElementById('student-login-section-group');
    if (secGroup) {
      secGroup.style.display = loginYear.value ? 'flex' : 'none';
    }
  }

  // 1b. New Student Register Form: Academic Year Select
  const regYear = document.getElementById('student-reg-year');
  if (regYear) {
    const curVal = regYear.value;
    const hasCur = data.years && data.years.includes(curVal);
    let optionsHtml = '<option value="" disabled ' + (!hasCur ? 'selected' : '') + '>-- Select Academic Year --</option>';
    if (data.years && data.years.length > 0) {
      data.years.forEach(y => {
        const isSel = hasCur && curVal === y;
        optionsHtml += `<option value="${escapeFn(y)}" ${isSel ? 'selected' : ''}>${escapeFn(y)}</option>`;
      });
    }
    regYear.innerHTML = optionsHtml;

    const regSecGroup = document.getElementById('student-reg-section-group');
    if (regSecGroup) {
      regSecGroup.style.display = regYear.value ? 'block' : 'none';
    }
  }

  // 2. Student Login Page: Section Select
  const loginSec = document.getElementById('student-login-section');
  if (loginSec) {
    const curVal = loginSec.value;
    const hasCur = data.sections && data.sections.includes(curVal);
    let secHtml = '';
    if (data.sections && data.sections.length > 0) {
      data.sections.forEach((s, idx) => {
        const isSel = hasCur ? (curVal === s) : (idx === 0);
        secHtml += `<option value="${escapeFn(s)}" ${isSel ? 'selected' : ''}>Section ${escapeFn(s)}</option>`;
      });
    }
    loginSec.innerHTML = secHtml;
  }

  // 2b. New Student Register Form: Section Select
  const regSec = document.getElementById('student-reg-section');
  if (regSec) {
    const curVal = regSec.value;
    const hasCur = data.sections && data.sections.includes(curVal);
    let secHtml = '';
    if (data.sections && data.sections.length > 0) {
      data.sections.forEach((s, idx) => {
        const isSel = hasCur ? (curVal === s) : (idx === 0);
        secHtml += `<option value="${escapeFn(s)}" ${isSel ? 'selected' : ''}>Section ${escapeFn(s)}</option>`;
      });
    }
    regSec.innerHTML = secHtml;
  }

  // Helper for generic select updates
  const syncSelect = (elId, items, formatFn, includeAll = false, allLabel = 'All Sections') => {
    const el = document.getElementById(elId);
    if (!el) return;
    const curVal = el.value;
    const itemValues = (items || []).map(i => (typeof i === 'object' ? i.val : i));
    const hasCur = itemValues.includes(curVal) || (includeAll && curVal === 'All');

    let html = '';
    if (includeAll) {
      html += `<option value="All" ${curVal === 'All' || !hasCur ? 'selected' : ''}>${allLabel}</option>`;
    }
    if (items && items.length > 0) {
      items.forEach((item, idx) => {
        const val = typeof item === 'object' ? item.val : item;
        const text = formatFn ? formatFn(item) : val;
        const isSel = (!includeAll && !hasCur && idx === 0) || (curVal === val);
        html += `<option value="${escapeFn(val)}" ${isSel ? 'selected' : ''}>${escapeFn(text)}</option>`;
      });
    }
    el.innerHTML = html;
  };

  // 3. Admin Modals: Year Selects
  syncSelect('modal-student-year', data.years || []);
  syncSelect('modal-sub-year', data.years || []);
  syncSelect('pdf-upload-year', data.years || []);

  // 4. Admin Modals: Section Selects
  syncSelect('modal-student-sec', data.sections || [], s => `Section ${s}`);
  syncSelect('modal-sub-sec', data.sections || [], s => `Section ${s}`, true, 'All Sections');
  syncSelect('pdf-upload-sec', data.sections || [], s => `Section ${s}`, true, 'All Sections');

  // 5. Admin Student Management Filter Chips
  const yearChipsContainer = document.getElementById('chips-row-year');
  if (yearChipsContainer) {
    const currentActiveYear = (window.adminDashboard && adminDashboard.studentYearFilter) || 'All';
    let chipsHtml = '<span class="chips-row-label">Year:</span>';
    chipsHtml += `<button type="button" class="chip-btn ${currentActiveYear === 'All' ? 'active' : ''}" data-val="All" onclick="window.handleChipFilter('student-year', 'All', this)">All</button>`;
    if (data.years) {
      data.years.forEach(y => {
        chipsHtml += `<button type="button" class="chip-btn ${currentActiveYear === y ? 'active' : ''}" data-val="${escapeFn(y)}" onclick="window.handleChipFilter('student-year', '${escapeFn(y)}', this)">${escapeFn(y)}</button>`;
      });
    }
    yearChipsContainer.innerHTML = chipsHtml;
  }

  const secChipsContainer = document.getElementById('chips-row-sec');
  if (secChipsContainer) {
    const currentActiveSec = (window.adminDashboard && adminDashboard.studentSecFilter) || 'All';
    let chipsHtml = '<span class="chips-row-label">Section:</span>';
    chipsHtml += `<button type="button" class="chip-btn ${currentActiveSec === 'All' ? 'active' : ''}" data-val="All" onclick="window.handleChipFilter('student-sec', 'All', this)">All</button>`;
    if (data.sections) {
      data.sections.forEach(s => {
        chipsHtml += `<button type="button" class="chip-btn ${currentActiveSec === s ? 'active' : ''}" data-val="${escapeFn(s)}" onclick="window.handleChipFilter('student-sec', '${escapeFn(s)}', this)">Sec ${escapeFn(s)}</button>`;
      });
    }
    secChipsContainer.innerHTML = chipsHtml;
  }

  // If Admin active filters were on deleted year/section, reset them safely
  if (window.adminDashboard) {
    let needsReRender = false;
    if (adminDashboard.studentYearFilter !== 'All' && data.years && !data.years.includes(adminDashboard.studentYearFilter)) {
      adminDashboard.studentYearFilter = 'All';
      needsReRender = true;
    }
    if (adminDashboard.studentSecFilter !== 'All' && data.sections && !data.sections.includes(adminDashboard.studentSecFilter)) {
      adminDashboard.studentSecFilter = 'All';
      needsReRender = true;
    }
    if (needsReRender && typeof adminDashboard.renderStudentsTable === 'function') {
      adminDashboard.renderStudentsTable();
    }
  }
};

class UIManager {
  constructor() {
    this.currentTheme = 'dark';
    this.currentView = 'student-login-view';
    this.init();
  }

  init() {
    this.initTheme();
    window.populateGlobalYearsAndSections();
    this.bindRouteGuards();
    this.bindStudentLoginDynamicSections();
    this.initNavigation();
    if (typeof window.renderRecentStudents === 'function') {
      window.renderRecentStudents();
    }
  }

  /* Theme Switching System */
  initTheme() {
    const savedTheme = localStorage.getItem('lms_theme_mode') || 'dark';
    this.setTheme(savedTheme);
  }

  setTheme(theme) {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lms_theme_mode', theme);
    this.updateThemeButtonsUI();
  }

  toggleTheme() {
    const nextTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
    this.showToast(`Switched to ${nextTheme === 'light' ? 'White (Light)' : 'Dark'} Theme`, 'info');
  }

  updateThemeButtonsUI() {
    const btns = document.querySelectorAll('.theme-toggle-btn');
    const isDark = this.currentTheme === 'dark';

    const sunIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    const moonIcon = `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

    btns.forEach(btn => {
      if (isDark) {
        btn.innerHTML = `${sunIcon} <span>Light Theme</span>`;
        btn.setAttribute('title', 'Switch to Light (White) Theme');
      } else {
        btn.innerHTML = `${moonIcon} <span>Dark Theme</span>`;
        btn.setAttribute('title', 'Switch to Dark Theme');
      }
    });
  }

  getCurrentActiveViewId() {
    const active = document.querySelector('.view-section.active');
    return active ? active.id : (this.currentView || 'student-login-view');
  }

  /* Screen Navigation / View Switcher */
  showView(viewId, pushHistory = true) {
    if (!viewId) return;

    const views = document.querySelectorAll('.view-section');
    views.forEach(v => v.classList.remove('active'));

    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add('active');
    }
    this.currentView = viewId;

    if (viewId === 'student-login-view' && typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }

    if (typeof window.renderGlobalAdSlots === 'function') {
      window.renderGlobalAdSlots();
    }

    if (pushHistory) {
      try {
        const state = {
          view: viewId,
          panel: (viewId === 'admin-dashboard-view' && window.adminDashboard) ? adminDashboard.activePanel : 'overview',
          modal: null
        };
        if (!history.state || history.state.view !== viewId) {
          history.pushState(state, '', '#' + viewId.replace('-view', ''));
        }
      } catch (e) {}
    }
  }

  /* Navigation History Manager (Browser Back Button / Mobile Back Support) */
  initNavigation() {
    const activeView = this.getCurrentActiveViewId();
    this.currentView = activeView;
    const initialState = {
      view: activeView,
      panel: 'overview',
      modal: null
    };
    try {
      history.replaceState(initialState, '', window.location.href);
    } catch (e) {}

    window.addEventListener('popstate', (event) => {
      this.handlePopState(event);
    });
  }

  handlePopState(event) {
    // 1. Proctored Exam Protection
    if (window.examEngine && examEngine.examActive) {
      const confirmExit = confirm('Proctored exam in progress! Are you sure you want to go back? Unsaved progress may be submitted.');
      if (confirmExit) {
        examEngine.submitExam('Interrupted / Back Navigation');
      } else {
        try {
          history.pushState({ view: 'exam', exam: true }, '', window.location.href);
        } catch (e) {}
        return;
      }
    }

    // 2. Dismiss any open modal when pressing Back
    const openModals = document.querySelectorAll('.modal-overlay.active');
    if (openModals.length > 0) {
      openModals.forEach(m => m.classList.remove('active'));
      if (!event.state || !event.state.modal) {
        return;
      }
    }

    // 3. Re-open modal if state specified
    if (event.state && event.state.modal) {
      this.showModal(event.state.modal, false);
      return;
    }

    // 4. Restore target view & subpanel
    if (event.state && event.state.view) {
      this.showView(event.state.view, false);
      if (event.state.view === 'student-dashboard-view' && window.studentDashboard) {
        studentDashboard.renderDashboard();
      } else if (event.state.view === 'super-admin-view' && window.superAdminDashboard) {
        superAdminDashboard.init();
      } else if (event.state.view === 'admin-dashboard-view' && window.adminDashboard) {
        const targetPanel = event.state.panel || 'overview';
        adminDashboard.switchPanel(targetPanel, false);
      }
      return;
    }

    // 5. Fallback if no state
    const session = storage.getActiveSession();
    if (session) {
      if (session.role === 'student') {
        this.showView('student-dashboard-view', false);
        if (window.studentDashboard) studentDashboard.renderDashboard();
      } else if (session.role === 'admin') {
        if (window.auth && typeof auth.isSuperAdmin === 'function' && auth.isSuperAdmin()) {
          this.showView('super-admin-view', false);
          if (window.superAdminDashboard) superAdminDashboard.init();
        } else {
          this.showView('admin-dashboard-view', false);
          if (window.adminDashboard) adminDashboard.init();
        }
      }
    } else {
      this.showView('student-login-view', false);
    }
  }

  /* Universal In-App Back Method */
  goBack() {
    const openModal = document.querySelector('.modal-overlay.active');
    if (openModal) {
      this.hideModal(openModal.id);
      return;
    }

    if (this.currentView === 'super-admin-view') {
      return;
    }

    if (this.currentView === 'super-admin-2fa-view') {
      if (window.superAdmin2FA) superAdmin2FA.cancel();
      this.showView('admin-login-view');
      return;
    }

    if (this.currentView === 'admin-dashboard-view' && window.adminDashboard && adminDashboard.activePanel !== 'overview') {
      adminDashboard.switchPanel('overview');
      return;
    }

    if (this.currentView === 'admin-login-view') {
      this.showView('student-login-view');
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.showView('student-login-view');
    }
  }

  /* Dynamic Section Dropdown Handler for Student Login & Admin Modals */
  bindStudentLoginDynamicSections() {
    const yearSelect = document.getElementById('student-login-year');
    const secGroup = document.getElementById('student-login-section-group');

    if (yearSelect && secGroup) {
      yearSelect.addEventListener('change', () => {
        if (yearSelect.value) {
          secGroup.style.display = 'flex';
        } else {
          secGroup.style.display = 'none';
        }
      });
    }
  }

  /* Route Guard Check on Load - Default to Login Page */
  bindRouteGuards() {
    const hash = window.location.hash;
    const session = storage.getActiveSession();
    if (hash === '#student-dashboard') {
      if (session && session.role === 'student') {
        this.showView('student-dashboard-view', false);
        if (window.studentDashboard) studentDashboard.renderDashboard();
        return;
      }
    } else if (hash === '#super-admin') {
      if (session && session.role === 'admin' && window.auth && auth.isSuperAdmin()) {
        this.showView('super-admin-view', false);
        if (window.superAdminDashboard) superAdminDashboard.init();
        return;
      } else {
        // Direct URL access without 2FA verification: redirect to login
        this.showView('admin-login-view', false);
        return;
      }
    } else if (hash === '#super-admin-2fa') {
      this.showView('admin-login-view', false);
      return;
    } else if (hash === '#admin-dashboard') {
      if (session && session.role === 'admin') {
        if (window.auth && auth.isSuperAdmin()) {
          this.showView('super-admin-view', false);
          if (window.superAdminDashboard) superAdminDashboard.init();
          return;
        }
        this.showView('admin-dashboard-view', false);
        if (window.adminDashboard) adminDashboard.init();
        return;
      }
    } else if (hash === '#admin-login') {
      this.showView('admin-login-view', false);
      return;
    }

    // Default: Always show the Login Page
    this.showView('student-login-view', false);
  }

  /* Toast Manager */
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
    if (type === 'success') {
      iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24" style="color: #10b981;"><polyline points="20 6 9 17 4 12"/></svg>';
    }
    if (type === 'error') {
      iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24" style="color: #f43f5e;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    }
    if (type === 'warning') {
      iconSvg = '<svg class="svg-icon" viewBox="0 0 24 24" style="color: #f59e0b;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    }

    toast.innerHTML = `<span>${iconSvg}</span><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1), transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(16px) scale(0.96)';
      setTimeout(() => toast.remove(), 360);
    }, 3200);
  }

  /* Modal Helpers */
  showModal(modalId, pushHistory = true) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (pushHistory) {
        try {
          history.pushState({
            view: this.getCurrentActiveViewId(),
            panel: (window.adminDashboard ? adminDashboard.activePanel : 'overview'),
            modal: modalId
          }, '', window.location.href);
        } catch (e) {}
      }
    }
  }

  hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
    if (history.state && history.state.modal === modalId) {
      try {
        const cleanedState = Object.assign({}, history.state, { modal: null });
        history.replaceState(cleanedState, '', window.location.href);
      } catch (e) {}
    }
  }
}

const ui = new UIManager();
window.ui = ui;

/* Global Event Listeners & Auth Handler Functions */

// Switch between 'login' and 'register' mode on Student Portal
window.switchStudentAuthMode = function(mode) {
  const btnLogin = document.getElementById('btn-mode-login');
  const btnRegister = document.getElementById('btn-mode-register');
  const formLogin = document.getElementById('student-existing-login-form');
  const formRegister = document.getElementById('student-register-form');

  if (mode === 'register') {
    if (btnLogin) btnLogin.classList.remove('active');
    if (btnRegister) btnRegister.classList.add('active');
    if (formLogin) formLogin.style.display = 'none';
    if (formRegister) {
      formRegister.style.display = 'block';
      const loginReg = document.getElementById('student-login-reg');
      const regReg = document.getElementById('student-reg-reg');
      if (loginReg && regReg && loginReg.value && !regReg.value) {
        regReg.value = loginReg.value;
      }
    }
    const nameInput = document.getElementById('student-reg-name');
    if (nameInput) nameInput.focus();
  } else {
    if (btnLogin) btnLogin.classList.add('active');
    if (btnRegister) btnRegister.classList.remove('active');
    if (formLogin) {
      formLogin.style.display = 'block';
      const regInput = document.getElementById('student-login-reg');
      if (regInput) {
        regInput.focus();
        if (regInput.value) {
          window.onStudentRegNoInput(regInput.value);
        }
      }
    }
    if (formRegister) formRegister.style.display = 'none';
  }
};

// Real-time student profile lookup as Register Number is typed
window.onStudentRegNoInput = function(val) {
  const clean = (val || '').toString().trim();
  const lookupCard = document.getElementById('student-lookup-card');
  const notFoundAlert = document.getElementById('student-notfound-alert');
  const statusIcon = document.getElementById('student-reg-status-icon');
  const nameEl = document.getElementById('lookup-name');
  const metaEl = document.getElementById('lookup-meta');
  const avatarEl = document.getElementById('lookup-avatar');

  if (!clean || clean.length < 12) {
    if (lookupCard) lookupCard.style.display = 'none';
    if (notFoundAlert) notFoundAlert.style.display = 'none';
    if (statusIcon) statusIcon.style.display = 'none';
    return;
  }

  const student = (window.storage && typeof storage.getStudentByRegNo === 'function')
    ? storage.getStudentByRegNo(clean)
    : (storage.getStudents().find(s => s.regNo && s.regNo.toString().trim() === clean));

  if (student) {
    if (nameEl) nameEl.textContent = student.name;
    if (metaEl) metaEl.textContent = `${student.year} • Section ${student.section}`;
    if (avatarEl) avatarEl.textContent = (student.name || 'S').charAt(0).toUpperCase();
    if (lookupCard) lookupCard.style.display = 'block';
    if (notFoundAlert) notFoundAlert.style.display = 'none';
    if (statusIcon) {
      statusIcon.style.display = 'block';
      statusIcon.innerHTML = '✅';
      statusIcon.title = 'Verified Registered Student';
    }
  } else {
    if (lookupCard) lookupCard.style.display = 'none';
    if (notFoundAlert) notFoundAlert.style.display = 'block';
    if (statusIcon) {
      statusIcon.style.display = 'block';
      statusIcon.innerHTML = '⚠️';
      statusIcon.title = 'Not registered yet';
    }
  }
};

// 1-Click Select Saved Student Profile
window.quickSelectStudent = function(regNo) {
  const regInput = document.getElementById('student-login-reg');
  if (regInput) {
    regInput.value = regNo;
    window.onStudentRegNoInput(regNo);
  }
};

// Registered student chips permanently disabled for privacy
window.renderRecentStudents = function() {
  const wrap = document.getElementById('student-recent-accounts-wrap');
  if (wrap) wrap.style.display = 'none';
};

window.onStudentRegYearChange = function(year) {
  const secGroup = document.getElementById('student-reg-section-group');
  if (secGroup) {
    secGroup.style.display = year ? 'block' : 'none';
  }
};

// Existing Student Fast Login
function handleExistingStudentLogin(e) {
  if (e) e.preventDefault();
  const regInput = document.getElementById('student-login-reg');
  const regNo = regInput ? regInput.value.trim() : '';

  try {
    const session = auth.loginExistingStudent(regNo);
    ui.showToast(`Welcome back, ${session.user.name}!`, 'success');
    ui.showView('student-dashboard-view');
    if (window.studentDashboard) {
      studentDashboard.renderDashboard();
    }
  } catch (err) {
    ui.showToast(err.message, 'error');
    window.onStudentRegNoInput(regNo);
  }
}
window.handleExistingStudentLogin = handleExistingStudentLogin;

// New Student Registration
function handleNewStudentRegister(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('student-reg-name').value.trim();
  const regNo = document.getElementById('student-reg-reg').value.trim();
  const year = document.getElementById('student-reg-year').value;
  const section = document.getElementById('student-reg-section').value;

  try {
    const session = auth.registerStudent(name, regNo, year, section);
    ui.showToast(`Account registered! Welcome, ${name}!`, 'success');
    ui.showView('student-dashboard-view');
    if (window.studentDashboard) {
      studentDashboard.renderDashboard();
    }
  } catch (err) {
    ui.showToast(err.message, 'error');
  }
}
window.handleNewStudentRegister = handleNewStudentRegister;

// Fallback unified handler
function handleStudentLogin(e) {
  if (e) e.preventDefault();
  const regInput = document.getElementById('student-login-reg');
  if (regInput && regInput.value) {
    return handleExistingStudentLogin(e);
  }
  return handleNewStudentRegister(e);
}
window.handleStudentLogin = handleStudentLogin;

// Admin Login Form Submit
function handleAdminLogin(e) {
  e.preventDefault();
  const username = document.getElementById('admin-login-username').value.trim();
  const password = document.getElementById('admin-login-password').value;

  try {
    const res = auth.loginAdmin(username, password);

    // If Super Admin requires 2FA authentication
    if (res && res.requires2FA) {
      ui.showToast(res.isFresher ? 'Super Admin: Please link your Authenticator app.' : 'Super Admin: Please enter your 6-digit Authenticator code.', 'info');
      ui.showView('super-admin-2fa-view');
      if (window.superAdmin2FA) {
        superAdmin2FA.init(res.isFresher);
      }
      return;
    }

    // Standard Admin (Faculty / Exam Admin)
    ui.showToast('Logged in as Administrator.', 'success');
    ui.showView('admin-dashboard-view');
    adminDashboard.init();
    if (typeof window.renderGlobalAdSlots === 'function') {
      window.renderGlobalAdSlots();
    }
  } catch (err) {
    ui.showToast(err.message, 'error');
  }
}

// Global Logout Handler
window.handleLogout = function() {
  try {
    // 1. Close any open modal (e.g. coding lab, profile, etc.)
    const activeModals = document.querySelectorAll('.modal-overlay.active');
    activeModals.forEach(m => m.classList.remove('active'));

    // 2. Clear authentication session
    if (window.auth && typeof auth.logout === 'function') {
      auth.logout();
    }
    if (window.storage && typeof storage.clearActiveSession === 'function') {
      storage.clearActiveSession();
    } else {
      localStorage.removeItem(typeof APP_KEYS !== 'undefined' ? APP_KEYS.ACTIVE_SESSION : 'lms_active_session');
    }

    // 3. Reset dashboard runtime state
    if (window.studentDashboard) {
      studentDashboard.currentStudent = null;
      studentDashboard.studentResultHistory = [];
    }

    // 4. Update history URL
    try {
      history.replaceState({ view: 'student-login-view' }, '', '#student-login');
    } catch (e) {}

    // 5. Toast notification
    ui.showToast('You have been logged out.', 'info');

    // 6. Refresh login dropdowns & show login view
    if (typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }
    if (typeof window.renderRecentStudents === 'function') {
      window.renderRecentStudents();
    }
    ui.showView('student-login-view', false);
  } catch (err) {
    console.error('Logout error:', err);
    try {
      localStorage.removeItem(typeof APP_KEYS !== 'undefined' ? APP_KEYS.ACTIVE_SESSION : 'lms_active_session');
      ui.showView('student-login-view', false);
    } catch (fallbackErr) {}
  }
};

function handleLogout() {
  window.handleLogout();
}

// Switch between Student Login & Admin Login Screens
function switchAuthView(targetView) {
  if (targetView === 'student-login-view') {
    if (typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }
    if (typeof window.renderRecentStudents === 'function') {
      window.renderRecentStudents();
    }
  }
  ui.showView(targetView);
}
