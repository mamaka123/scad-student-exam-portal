/* ==========================================================================
   Admin JS - LMS Admin Dashboard Controller, CRUD Management & Filters
   ========================================================================== */

class AdminDashboardController {
  constructor() {
    this.activePanel = 'overview';
    this.studentSearchQuery = '';
    this.studentYearFilter = 'All';
    this.studentSecFilter = 'All';

    this.questionSubjectFilter = 'All';
    this.currentQuestionPdfData = null;

    this.resultSearchQuery = '';
    this.resultPassFilter = 'All';
    this.violationSearchQuery = '';
    this.violationTypeFilter = 'All';
    this.violationsSelectedSubjectId = 'ALL';

    // Exam Attendees & Performance Report State
    this.attendeesSubjectId = null;
    this.attendeesSearchQuery = '';
    this.attendeesStatusFilter = 'All';
    this.attendeesSortBy = 'regNo';

    // Overview Submissions Filter & Search State
    this.overviewSearchQuery = '';
    this.overviewFilter = 'All';
    this.overviewSubjectFilter = 'All';

    // Super Admin Management State
    this.adminSearchQuery = '';
    this.adminRoleFilter = 'All';
  }

  getCurrentAdminUsername() {
    const session = (window.storage && typeof storage.getActiveSession === 'function') ? storage.getActiveSession() : null;
    return (session && session.user && session.user.username) ? session.user.username.trim().toLowerCase() : '';
  }

  isSuperAdmin() {
    return (window.auth && typeof auth.isSuperAdmin === 'function') ? auth.isSuperAdmin() : false;
  }

  getAdminSubjects() {
    const allSubjects = storage.getSubjects();
    if (this.isSuperAdmin()) return allSubjects;
    const currentAdmin = this.getCurrentAdminUsername();
    if (!currentAdmin) return allSubjects;
    return allSubjects.filter(s => {
      const creator = (s.createdBy || 'admin').trim().toLowerCase();
      return creator === currentAdmin;
    });
  }

  getAdminSubjectIds() {
    return this.getAdminSubjects().map(s => String(s.id || '').toLowerCase());
  }

  getAdminQuestions() {
    const allQuestions = storage.getQuestions();
    if (this.isSuperAdmin()) return allQuestions;
    const currentAdmin = this.getCurrentAdminUsername();
    const mySubIds = this.getAdminSubjectIds();
    return allQuestions.filter(q => {
      const qCreator = (q.createdBy || '').trim().toLowerCase();
      if (qCreator && qCreator === currentAdmin) return true;
      if (q.subjectId && mySubIds.includes(String(q.subjectId).toLowerCase())) return true;
      return false;
    });
  }

  getAdminAttempts() {
    const allAttempts = storage.getAttempts();
    if (this.isSuperAdmin()) return allAttempts;
    const currentAdmin = this.getCurrentAdminUsername();
    const mySubIds = this.getAdminSubjectIds();
    const mySubNames = this.getAdminSubjects().map(s => (s.name || '').trim().toLowerCase());
    return allAttempts.filter(a => {
      if (a.createdBy && (a.createdBy || '').trim().toLowerCase() === currentAdmin) return true;
      if (a.subjectId && mySubIds.includes(String(a.subjectId).toLowerCase())) return true;
      if (a.subjectName && mySubNames.includes(String(a.subjectName).trim().toLowerCase())) return true;
      if (a.type === 'coding_lab') {
        const creator = (a.createdBy || '').trim().toLowerCase();
        return creator === currentAdmin;
      }
      return false;
    });
  }

  getAdminViolations() {
    const allViolations = storage.getViolations();
    if (this.isSuperAdmin()) return allViolations;
    const currentAdmin = this.getCurrentAdminUsername();
    const mySubIds = this.getAdminSubjectIds();
    const mySubNames = this.getAdminSubjects().map(s => (s.name || '').trim().toLowerCase());
    return allViolations.filter(v => {
      if (v.createdBy && (v.createdBy || '').trim().toLowerCase() === currentAdmin) return true;
      if (v.subjectId && mySubIds.includes(String(v.subjectId).toLowerCase())) return true;
      if (v.subjectName && mySubNames.includes(String(v.subjectName).trim().toLowerCase())) return true;
      return false;
    });
  }

  updateSuperAdminUI() {
    const isSuper = this.isSuperAdmin();
    const navItem = document.getElementById('nav-item-admin-management');
    if (navItem) {
      navItem.style.display = isSuper ? 'flex' : 'none';
    }
    const overviewBtn = document.getElementById('overview-btn-manage-admins');
    if (overviewBtn) {
      overviewBtn.style.display = isSuper ? 'inline-flex' : 'none';
    }

    // Personalize Topbar for currently logged-in Admin
    const session = (window.storage && typeof storage.getActiveSession === 'function') ? storage.getActiveSession() : null;
    if (session && session.user) {
      const nameEl = document.getElementById('admin-topbar-name');
      const roleEl = document.getElementById('admin-topbar-role');
      const avatarEl = document.getElementById('admin-topbar-avatar');
      
      const adminName = session.user.name || session.user.username || 'Admin';
      const adminUsername = session.user.username || 'admin';
      const adminRole = session.user.role || (isSuper ? 'Super Admin' : 'Administrator');

      if (nameEl) nameEl.textContent = adminName;
      if (roleEl) roleEl.textContent = isSuper ? `👑 Super Admin (@${adminUsername})` : `👤 @${adminUsername} • ${adminRole}`;
      if (avatarEl) {
        avatarEl.textContent = adminName.charAt(0).toUpperCase();
        avatarEl.style.background = isSuper 
          ? 'linear-gradient(135deg, #f59e0b, #d97706)' 
          : 'linear-gradient(135deg, #6366f1, #4f46e5)';
      }
    }
  }

  init() {
    this.updateSuperAdminUI();
    this.bindSidebarEvents();
    this.bindDotsMenuEvents();
    this.renderActivePanel();
  }

  bindSidebarEvents() {
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const targetPanel = item.getAttribute('data-panel');
        if (targetPanel) {
          this.switchPanel(targetPanel);
        }
      });
    });
  }

  bindDotsMenuEvents() {
    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.admin-dots-menu-wrap');
      if (wrap && !wrap.contains(e.target)) {
        this.closeDotsMenu();
      }
      // Close custom dropdowns when clicking outside
      if (!e.target.closest('.custom-dropdown-wrap')) {
        document.querySelectorAll('.custom-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.custom-dropdown-btn.active').forEach(b => b.classList.remove('active'));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeDotsMenu();
        document.querySelectorAll('.custom-dropdown-menu.show').forEach(m => m.classList.remove('show'));
        document.querySelectorAll('.custom-dropdown-btn.active').forEach(b => b.classList.remove('active'));
      }
    });
  }

  /* Custom Modern Dropdown Component (Replaces native browser select popup) */
  toggleCustomSelect(dropdownId, e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const target = document.getElementById(dropdownId);
    if (!target) return;
    const menu = target.querySelector('.custom-dropdown-menu');
    const btn = target.querySelector('.custom-dropdown-btn');
    if (!menu || !btn) return;
    const isShowing = menu.classList.contains('show');

    // Close any other open custom dropdowns
    document.querySelectorAll('.custom-dropdown-menu.show').forEach(m => {
      if (m !== menu) m.classList.remove('show');
    });
    document.querySelectorAll('.custom-dropdown-btn.active').forEach(b => {
      if (b !== btn) b.classList.remove('active');
    });

    if (!isShowing) {
      menu.classList.add('show');
      btn.classList.add('active');
    } else {
      menu.classList.remove('show');
      btn.classList.remove('active');
    }
  }

  selectCustomOption(dropdownId, value, labelText, filterType) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;

    // Update button display text
    const labelSpan = dropdown.querySelector('.dropdown-label-text');
    if (labelSpan) labelSpan.textContent = labelText;

    // Update selected class
    dropdown.querySelectorAll('.custom-dropdown-item').forEach(item => {
      if (item.getAttribute('data-value') === String(value)) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });

    // Close menu
    const menu = dropdown.querySelector('.custom-dropdown-menu');
    const btn = dropdown.querySelector('.custom-dropdown-btn');
    if (menu) menu.classList.remove('show');
    if (btn) btn.classList.remove('active');

    // Trigger active filter
    if (filterType === 'student-year') {
      this.studentYearFilter = value;
      this.renderStudentsTable();
    } else if (filterType === 'student-sec') {
      this.studentSecFilter = value;
      this.renderStudentsTable();
    } else if (filterType === 'question-subject') {
      this.questionSubjectFilter = value;
      this.renderQuestionsTable();
    } else if (filterType === 'result-pass') {
      this.resultPassFilter = value;
      this.renderResultsTable();
    }
  }

  toggleDotsMenu(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const dropdown = document.getElementById('admin-dots-dropdown');
    const btn = document.getElementById('admin-dots-btn');
    if (!dropdown) return;

    const isVisible = dropdown.classList.contains('show') || dropdown.style.display === 'block';
    if (isVisible) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
      if (btn) btn.classList.remove('active');
    } else {
      dropdown.classList.add('show');
      dropdown.style.display = 'block';
      if (btn) btn.classList.add('active');
    }
  }

  closeDotsMenu() {
    const dropdown = document.getElementById('admin-dots-dropdown');
    const btn = document.getElementById('admin-dots-btn');
    if (dropdown) {
      dropdown.classList.remove('show');
      dropdown.style.display = 'none';
    }
    if (btn) btn.classList.remove('active');
  }

  selectDotsPanel(panelId) {
    this.switchPanel(panelId);
    this.closeDotsMenu();
  }

  switchPanel(panelId, pushHistory = true) {
    this.activePanel = panelId;
    const panels = document.querySelectorAll('.admin-panel');
    panels.forEach(p => p.classList.remove('active'));

    const target = document.getElementById(`admin-panel-${panelId}`);
    if (target) target.classList.add('active');

    // Sync sidebar active state
    const sidebarItems = document.querySelectorAll('.sidebar .nav-item');
    sidebarItems.forEach(item => {
      if (item.getAttribute('data-panel') === panelId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Sync 3-dots dropdown menu item active state
    const dotsItems = document.querySelectorAll('.dots-dropdown-item[data-dots-panel]');
    dotsItems.forEach(item => {
      if (item.getAttribute('data-dots-panel') === panelId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Sync Topbar Back Button visibility
    const backBtn = document.getElementById('admin-panel-back-btn');
    if (backBtn) {
      backBtn.style.display = (panelId === 'overview') ? 'none' : 'inline-flex';
    }

    if (pushHistory) {
      try {
        if (!history.state || history.state.panel !== panelId) {
          history.pushState({
            view: 'admin-dashboard-view',
            panel: panelId,
            modal: null
          }, '', '#admin-' + panelId);
        }
      } catch (e) {}
    }

    this.renderActivePanel();
  }

  renderActivePanel() {
    switch (this.activePanel) {
      case 'overview':
        this.renderOverviewStats();
        break;
      case 'students':
        this.renderStudentsTable();
        break;
      case 'years-sections':
        this.renderYearsSectionsPanel();
        break;
      case 'subjects':

        this.renderSubjectsTable();
        break;
      case 'questions':
        this.renderQuestionsTable();
        break;
      case 'results':
        this.renderResultsTable();
        break;
      case 'violations':
        this.renderViolationsTable();
        break;
      case 'coding-lab':
        this.renderCodingLabPanel();
        break;
    }
  }

  /* ------------------------------------------------------------------------
     1. OVERVIEW PANEL & PERFORMANCE ANALYTICS
     ------------------------------------------------------------------------ */
  startPulseClock() {
    const update = () => {
      const el = document.getElementById('admin-pulse-clock');
      if (el) {
        const now = new Date();
        el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    update();
    if (!this._clockTimer) {
      this._clockTimer = setInterval(update, 1000);
    }
  }

  renderOverviewStats() {
    this.startPulseClock();

    const students = storage.getStudents();
    const subjects = this.getAdminSubjects();
    const questions = this.getAdminQuestions();
    const attempts = this.getAdminAttempts();
    const violations = this.getAdminViolations();

    const passedAttempts = attempts.filter(a => (a.percentage || 0) >= 50);
    const failedAttempts = attempts.filter(a => (a.percentage || 0) < 50);

    const elStdCount = document.getElementById('admin-stat-students');
    const elSubCount = document.getElementById('admin-stat-subjects');
    const elQuesCount = document.getElementById('admin-stat-questions');
    const elViolCount = document.getElementById('admin-stat-violations');

    const elPassedCount = document.getElementById('admin-stat-passed');
    const elFailedCount = document.getElementById('admin-stat-failed');

    if (elStdCount) elStdCount.textContent = students.length;
    if (elSubCount) elSubCount.textContent = subjects.length;
    if (elQuesCount) elQuesCount.textContent = questions.length;
    if (elViolCount) elViolCount.textContent = violations.length;

    if (elPassedCount) elPassedCount.textContent = passedAttempts.length;
    if (elFailedCount) elFailedCount.textContent = failedAttempts.length;

    // Calculate Dynamic Pass Rate % & Trends
    const totalAttemptsCount = attempts.length;
    const passRate = totalAttemptsCount > 0 ? Math.round((passedAttempts.length / totalAttemptsCount) * 100) : 100;
    const failRate = totalAttemptsCount > 0 ? Math.round((failedAttempts.length / totalAttemptsCount) * 100) : 0;

    const passRateTag = document.getElementById('admin-pass-rate-tag');
    if (passRateTag) passRateTag.textContent = `${passRate}% Pass Rate`;

    const failRateTag = document.getElementById('admin-fail-rate-tag');
    if (failRateTag) failRateTag.textContent = `${failRate}% Fail Rate`;

    const violBadge = document.getElementById('admin-violation-badge');
    if (violBadge) {
      violBadge.textContent = violations.length > 0 ? `${violations.length} Flagged` : 'Shield Active';
      violBadge.className = violations.length > 0 ? 'stat-trend-tag warning' : 'stat-trend-tag emerald';
    }

    // Performance Insights Calculation
    let avgPercentage = 0;
    if (totalAttemptsCount > 0) {
      const sum = attempts.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
      avgPercentage = (sum / totalAttemptsCount).toFixed(1);
    }
    const avgScoreBadge = document.getElementById('admin-avg-score-badge');
    const avgScoreBar = document.getElementById('admin-avg-score-bar');
    const avgScoreSub = document.getElementById('admin-avg-score-sub');
    if (avgScoreBadge) avgScoreBadge.textContent = `${avgPercentage}%`;
    if (avgScoreBar) avgScoreBar.style.width = `${Math.min(100, Math.max(0, avgPercentage))}%`;
    if (avgScoreSub) avgScoreSub.textContent = `Based on ${totalAttemptsCount} total exam submissions`;

    // Top subject & Activity Velocity
    const subjectCounts = {};
    attempts.forEach(a => {
      const sName = a.subjectName || 'General';
      subjectCounts[sName] = (subjectCounts[sName] || 0) + 1;
    });
    let topSubject = 'General';
    let topCount = 0;
    for (const s in subjectCounts) {
      if (subjectCounts[s] > topCount) {
        topCount = subjectCounts[s];
        topSubject = s;
      }
    }
    if (subjects.length > 0 && topCount === 0) {
      topSubject = subjects[0].name;
    }
    const topSubjectBadge = document.getElementById('admin-top-subject-badge');
    const topSubjectStat = document.getElementById('admin-top-subject-stat');
    if (topSubjectBadge) topSubjectBadge.textContent = topSubject;
    if (topSubjectStat) topSubjectStat.textContent = `${topCount} Submission${topCount === 1 ? '' : 's'}`;

    // Latest Submission Velocity
    const latestTimeEl = document.getElementById('admin-latest-submission-time');
    const latestStudentEl = document.getElementById('admin-latest-student-name');
    if (attempts.length > 0) {
      const latestAtt = attempts[attempts.length - 1];
      const d = new Date(latestAtt.submittedAt || latestAtt.startedAt);
      if (latestTimeEl) latestTimeEl.textContent = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (latestStudentEl) latestStudentEl.textContent = `By ${latestAtt.studentName || 'Student'} (${latestAtt.subjectName || ''})`;
    } else {
      if (latestTimeEl) latestTimeEl.textContent = 'Awaiting Submissions';
      if (latestStudentEl) latestStudentEl.textContent = 'System ready for exams';
    }

    // Populate Subject Filter Dropdown
    this.populateOverviewSubjectDropdown();

    // Render Submissions Table with Live Search & Filters
    this.renderOverviewSubmissions();
  }

  populateOverviewSubjectDropdown() {
    const select = document.getElementById('admin-overview-subject-filter');
    if (!select) return;
    const subjects = this.getAdminSubjects();
    const attempts = this.getAdminAttempts();
    const subjectNames = new Set(subjects.map(s => s.name));
    attempts.forEach(a => { if (a.subjectName) subjectNames.add(a.subjectName); });

    const currentVal = this.overviewSubjectFilter || 'All';
    let html = `<option value="All">All Subjects (${subjectNames.size})</option>`;
    subjectNames.forEach(name => {
      html += `<option value="${escapeHtml(name)}" ${name === currentVal ? 'selected' : ''}>${escapeHtml(name)}</option>`;
    });
    select.innerHTML = html;
  }

  onOverviewSearch(query) {
    this.overviewSearchQuery = (query || '').trim().toLowerCase();
    this.renderOverviewSubmissions();
  }

  setOverviewFilter(filter, btnEl) {
    this.overviewFilter = filter;
    document.querySelectorAll('[data-overview-filter]').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    this.renderOverviewSubmissions();
  }

  onOverviewSubjectFilter(subject) {
    this.overviewSubjectFilter = subject;
    this.renderOverviewSubmissions();
  }

  openAddCodingQuestionModal() {
    this.openAddQuestionModal();
    const typeSelect = document.getElementById('modal-q-type');
    if (typeSelect) {
      typeSelect.value = 'coding';
      this.onQuestionTypeChange();
    }
    const titleEl = document.getElementById('question-modal-title');
    if (titleEl) {
      titleEl.textContent = 'Upload / Add Coding Challenge';
    }
    // If starter code is empty, populate default starter template for selected language
    const starterEl = document.getElementById('modal-q-starter-code');
    const langSelect = document.getElementById('modal-q-language');
    if (starterEl && !starterEl.value.trim() && langSelect) {
      starterEl.value = this.getStarterTemplateForLang(langSelect.value || 'python');
    }
  }

  // =========================================================================
  //  SMART DOCUMENT IMPORT SYSTEM
  //  Supports: PDF, DOCX, DOC, TXT, MD, JSON, .py, .c, .cpp, .java, .js
  // =========================================================================

  handleSmartDocDrop(event) {
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) this._processSmartDocFile(file);
  }

  handleSmartDocImport(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (file) this._processSmartDocFile(file);
    if (event.target) event.target.value = '';
  }

  clearSmartDocImport() {
    document.getElementById('smart-doc-preview').style.display = 'none';
    document.getElementById('smart-doc-processing').style.display = 'none';
  }

  _showSmartProcessing(msg) {
    const proc = document.getElementById('smart-doc-processing');
    const txt = document.getElementById('smart-doc-processing-text');
    if (proc) proc.style.display = 'block';
    if (txt) txt.textContent = msg || 'Parsing document...';
    document.getElementById('smart-doc-preview').style.display = 'none';
  }

  _hideSmartProcessing() {
    const proc = document.getElementById('smart-doc-processing');
    if (proc) proc.style.display = 'none';
  }

  _showSmartPreview(filename, fieldsPopulated) {
    this._hideSmartProcessing();
    const preview = document.getElementById('smart-doc-preview');
    const fnEl = document.getElementById('smart-doc-preview-filename');
    const itemsEl = document.getElementById('smart-doc-preview-items');
    if (!preview || !fnEl || !itemsEl) return;

    fnEl.textContent = filename;
    const FIELD_LABELS = {
      text: { label: 'Problem Statement', color: '#818cf8', elId: 'modal-q-text' },
      chapter: { label: 'Chapter/Topic', color: '#34d399', elId: 'modal-q-chapter' },
      marks: { label: 'Marks / Points', color: '#f59e0b', elId: 'modal-q-marks' },
      starterCode: { label: 'Starter Code', color: '#fbbf24', elId: 'modal-q-starter-code' },
      sampleInput: { label: 'Sample Input', color: '#22d3ee', elId: 'modal-q-sample-input' },
      expectedOutput: { label: 'Expected Output', color: '#4ade80', elId: 'modal-q-expected-output' },
      input2: { label: 'Input 2', color: '#a78bfa', elId: 'modal-q-input2' },
      output2: { label: 'Output 2', color: '#86efac', elId: 'modal-q-output2' },
      explanation: { label: 'Explanation', color: '#f9a8d4', elId: 'modal-q-explanation' },
      options: { label: 'MCQ Options', color: '#fb923c', elId: 'modal-q-op1' },
      language: { label: 'Language', color: '#67e8f9', elId: 'modal-q-language' }
    };

    itemsEl.innerHTML = fieldsPopulated.map(f => {
      const meta = FIELD_LABELS[f] || { label: f, color: '#94a3b8' };
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:9999px;padding:2px 9px;font-size:0.74rem;font-weight:600;color:${meta.color};">&#10003; ${meta.label}</span>`;
    }).join('');

    preview.style.display = 'block';

    // Flash highlight on populated fields
    fieldsPopulated.forEach(f => {
      const meta = FIELD_LABELS[f];
      if (meta && meta.elId) {
        const el = document.getElementById(meta.elId);
        if (el) {
          el.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
          el.style.borderColor = '#10b981';
          el.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.25)';
          setTimeout(() => {
            el.style.borderColor = '';
            el.style.boxShadow = '';
          }, 2000);
        }
      }
    });
  }

  async _processSmartDocFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    this._showSmartProcessing(`Reading ${file.name}...`);

    try {
      // ── 1. JSON ────────────────────────────────────────────────────────
      if (ext === 'json') {
        const text = await this._readFileAsText(file);
        const data = JSON.parse(text);
        const filled = this._applyJsonToForm(data, file.name);
        this._showSmartPreview(file.name, filled);
        ui.showToast(`Imported from JSON: ${filled.length} field(s) filled`, 'success');
        return;
      }

      // ── 2. PDF ─────────────────────────────────────────────────────────
      if (ext === 'pdf') {
        this._showSmartProcessing('Extracting text from PDF...');
        const arrayBuffer = await this._readFileAsArrayBuffer(file);
        const text = await this._extractPdfText(arrayBuffer);
        const filled = this._applyExtractedTextToForm(text, file.name, ext);
        this._showSmartPreview(file.name, filled);
        ui.showToast(`Extracted from PDF — ${filled.length} field(s) auto-filled`, 'success');
        return;
      }

      // ── 3. DOCX / DOC ─────────────────────────────────────────────────
      if (ext === 'docx' || ext === 'doc') {
        this._showSmartProcessing('Extracting text from Word document...');
        const arrayBuffer = await this._readFileAsArrayBuffer(file);
        const text = await this._extractDocxText(arrayBuffer);
        const filled = this._applyExtractedTextToForm(text, file.name, ext);
        this._showSmartPreview(file.name, filled);
        ui.showToast(`Extracted from DOCX — ${filled.length} field(s) auto-filled`, 'success');
        return;
      }

      // ── 4. TXT / MD ───────────────────────────────────────────────────
      if (ext === 'txt' || ext === 'md') {
        this._showSmartProcessing('Reading text file...');
        const text = await this._readFileAsText(file);
        const filled = this._applyExtractedTextToForm(text, file.name, ext);
        this._showSmartPreview(file.name, filled);
        ui.showToast(`Parsed text file — ${filled.length} field(s) auto-filled`, 'success');
        return;
      }

      // ── 5. Source Code Files (.py, .c, .cpp, .java, .js, etc.) ────────
      const CODE_EXTS = ['py', 'c', 'cpp', 'cc', 'cxx', 'java', 'js', 'ts'];
      const EXT_LANG_MAP = { py: 'python', js: 'javascript', ts: 'javascript', c: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', java: 'java' };

      if (CODE_EXTS.includes(ext)) {
        this._showSmartProcessing('Reading source code...');
        const code = await this._readFileAsText(file);
        const filled = [];

        // Put code into starter code field
        const starterEl = document.getElementById('modal-q-starter-code');
        if (starterEl) { starterEl.value = code; filled.push('starterCode'); }

        // Auto-select language
        const lang = EXT_LANG_MAP[ext];
        if (lang) {
          const langEl = document.getElementById('modal-q-language');
          if (langEl) { langEl.value = lang; filled.push('language'); }
        }

        // Try to extract inline comments as problem description (look for block comments)
        const commentText = this._extractCommentDescription(code, ext);
        if (commentText) {
          const textEl = document.getElementById('modal-q-text');
          if (textEl && !textEl.value.trim()) { textEl.value = commentText; filled.push('text'); }
        }

        this._showSmartPreview(file.name, filled);
        ui.showToast(`Imported source code from ${file.name}`, 'success');
        return;
      }

      this._hideSmartProcessing();
      ui.showToast('Unsupported file format. Try PDF, DOCX, TXT, JSON or source code files.', 'warning');

    } catch (err) {
      console.error('Smart doc import error:', err);
      this._hideSmartProcessing();
      ui.showToast('Could not parse file: ' + (err.message || 'Unknown error'), 'error');
    }
  }

  // ── PDF Text Extraction using PDF.js ──────────────────────────────────────
  async _extractPdfText(arrayBuffer) {
    if (typeof pdfjsLib === 'undefined') {
      throw new Error('PDF.js library is not loaded. Please check your internet connection.');
    }
    try {
      if (pdfjsLib.GlobalWorkerOptions) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    } catch (e) {}

    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      useSystemFonts: true
    });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];
      if (items.length === 0) continue;

      let pageLines = [];
      let currentLineItems = [];
      let lastY = null;

      for (const item of items) {
        const y = item.transform ? Math.round(item.transform[5]) : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          if (currentLineItems.length > 0) {
            pageLines.push(currentLineItems.join(' '));
            currentLineItems = [];
          }
        }
        if (item.str && item.str.trim()) {
          currentLineItems.push(item.str.trim());
        }
        if (item.hasEOL) {
          if (currentLineItems.length > 0) {
            pageLines.push(currentLineItems.join(' '));
            currentLineItems = [];
          }
          lastY = null;
          continue;
        }
        lastY = y;
      }
      if (currentLineItems.length > 0) {
        pageLines.push(currentLineItems.join(' '));
      }

      fullText += pageLines.join('\n') + '\n\n';
    }
    return fullText.trim();
  }

  // ── DOCX Text Extraction using Mammoth.js ─────────────────────────────────
  async _extractDocxText(arrayBuffer) {
    if (typeof mammoth === 'undefined') {
      throw new Error('Mammoth.js library is not loaded. Please check your internet connection.');
    }
    const result = await mammoth.extractRawText({ arrayBuffer });
    return (result.value || '').trim();
  }

  // ── FileReader helpers ────────────────────────────────────────────────────
  _readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsText(file);
    });
  }

  _readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // ── JSON structured import ────────────────────────────────────────────────
  _applyJsonToForm(data, filename) {
    const filled = [];
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && String(val).trim() !== '') {
        el.value = String(val);
        return true;
      }
      return false;
    };

    if (set('modal-q-text', data.questionText || data.text || data.problem || data.description || data.title)) filled.push('text');
    if (set('modal-q-chapter', data.chapter || data.topic || data.category)) filled.push('chapter');
    if (set('modal-q-marks', data.marks || data.points || data.score)) filled.push('marks');
    if (set('modal-q-starter-code', data.starterCode || data.code || data.template || data.boilerplate)) filled.push('starterCode');
    if (set('modal-q-sample-input', data.sampleInput || data.input || data.stdin || data.input1 || (data.testCases && data.testCases[0] && data.testCases[0].input))) filled.push('sampleInput');
    if (set('modal-q-expected-output', data.expectedOutput || data.output || data.stdout || data.output1 || (data.testCases && data.testCases[0] && data.testCases[0].output))) filled.push('expectedOutput');
    if (set('modal-q-input2', data.input2 || (data.testCases && data.testCases[1] && data.testCases[1].input))) filled.push('input2');
    if (set('modal-q-output2', data.output2 || data.expectedOutput2 || (data.testCases && data.testCases[1] && data.testCases[1].output))) filled.push('output2');
    if (set('modal-q-explanation', data.explanation || data.hint || data.solution || data.notes)) filled.push('explanation');

    // Auto-synthesize Anti-Cheat Test Case 2 if blank or duplicate
    const exp1Val = (document.getElementById('modal-q-expected-output') && document.getElementById('modal-q-expected-output').value.trim()) || '';
    const in1Val = (document.getElementById('modal-q-sample-input') && document.getElementById('modal-q-sample-input').value.trim()) || '';
    const out2Val = (document.getElementById('modal-q-output2') && document.getElementById('modal-q-output2').value.trim()) || '';
    const qDesc = (data.questionText || data.text || data.title || '').toLowerCase();

    if ((!out2Val || out2Val.toLowerCase() === exp1Val.toLowerCase()) && exp1Val) {
      if (qDesc.includes('palin') || /palindrome/i.test(exp1Val)) {
        set('modal-q-input2', in1Val === '121' ? '123' : (isNaN(in1Val) ? 'hello' : '1234'));
        set('modal-q-output2', 'Not Palindrome');
        filled.push('input2', 'output2');
      } else if (qDesc.includes('prime') || /prime/i.test(exp1Val)) {
        set('modal-q-input2', (in1Val === '5' || in1Val === '7') ? '8' : '4');
        set('modal-q-output2', 'Not Prime');
        filled.push('input2', 'output2');
      } else if (qDesc.includes('even') || qDesc.includes('odd') || /even|odd/i.test(exp1Val)) {
        const isEven = /even/i.test(exp1Val);
        set('modal-q-input2', in1Val && !isNaN(in1Val) ? String(parseInt(in1Val, 10) + 1) : (isEven ? '7' : '8'));
        set('modal-q-output2', isEven ? 'Odd' : 'Even');
        filled.push('input2', 'output2');
      }
    }

    // MCQ options
    if (Array.isArray(data.options) && data.options.length >= 2) {
      ['modal-q-op1','modal-q-op2','modal-q-op3','modal-q-op4'].forEach((id, i) => {
        if (data.options[i] !== undefined) set(id, data.options[i]);
      });
      if (data.correctIndex !== undefined) set('modal-q-correct', data.correctIndex);
      filled.push('options');
    }

    if (data.language) {
      const langEl = document.getElementById('modal-q-language');
      if (langEl) { langEl.value = data.language.toLowerCase(); filled.push('language'); }
    }

    // Auto-switch to coding type if applicable
    if (data.type === 'coding' || data.starterCode || data.code || data.sampleInput || data.expectedOutput) {
      const typeEl = document.getElementById('modal-q-type');
      if (typeEl) { typeEl.value = 'coding'; this.onQuestionTypeChange(); }
    } else if (data.type === 'mcq' || data.options) {
      const typeEl = document.getElementById('modal-q-type');
      if (typeEl) { typeEl.value = 'mcq'; this.onQuestionTypeChange(); }
    }

    return [...new Set(filled)];
  }

  // ── Intelligent Text Extraction & Field Population ─────────────────────────
  _applyExtractedTextToForm(rawText, filename, ext) {
    if (!rawText || !rawText.trim()) return [];

    const filled = [];
    const fullText = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

    // Helper to safely set an input value
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val !== undefined && val !== null && String(val).trim() !== '') {
        el.value = String(val).trim();
        return true;
      }
      return false;
    };

    // Helper to validate whether a candidate text block is actually programming source code
    const isLikelyCode = (str) => {
      if (!str || str.trim().length < 8) return false;
      const t = str.trim();
      // Document introductory prose or titles are NOT code
      if (/^(?:each question|difficulty|overview|table of contents|instructions|note|this document|given an integer|given a string|write a program|write a function)/i.test(t)) return false;

      const hasCodeKeywords = /\b(public\s+class|import\s+java|import\s+sys|#include\s*<|def\s+\w+\s*\(|int\s+main\s*\(|void\s+main\s*\(|function\s+\w+\s*\(|class\s+\w+|System\.out\.|printf\s*\(|scanf\s*\(|cin\s*>>|cout\s*<<|console\.log|Scanner\s+\w+|return\s+[\w"'{}\[\]]+;)\b/i.test(t);
      const hasSyntaxStructure = /[{};]/g.test(t) || /^\s*(?:def|class|if|for|while|return)\s+.+:/m.test(t);
      return hasCodeKeywords || (hasSyntaxStructure && t.split('\n').length >= 2);
    };

    // Helper to check section heading regex
    const isHeading = (str) => {
      return /^(?:problem statement|problem description|problem|question|task description|task|description|input format|output format|constraints|sample input|sample output|example|test case|input \d+|output \d+|input:|output:|explanation|hint|hints|starter code|sample code|solution code|sample solution|source code|python code|c code|cpp code|java code|java solution|python solution|c solution|program|implementation|boilerplate|template code|marks|points|chapter|topic|note)\b/i.test(str.trim());
    };

    // Advanced section extractor: handles both inline "Header: value" and block "Header:\nvalue1\nvalue2"
    const extractSection = (headerPatterns) => {
      for (const pat of headerPatterns) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const headerRegex = new RegExp('^(?:' + pat + ')[ \\t]*[:\\-]?[ \\t]*(.*)$', 'i');
          const m = line.match(headerRegex);

          if (m) {
            const remainder = m[1] ? m[1].trim() : '';
            let blockLines = [];
            if (remainder && !isHeading(remainder)) {
              blockLines.push(remainder);
            }
            let j = i + 1;
            while (j < lines.length) {
              if (isHeading(lines[j])) break;
              blockLines.push(lines[j]);
              j++;
            }

            if (blockLines.length > 0) {
              return blockLines.join('\n').trim();
            }
          }
        }
      }
      return null;
    };

    // ── 1. Marks / Points Extraction ──────────────────────────────────────────
    const marksMatch = fullText.match(/(?:marks|points|score|max marks|total marks)\s*[:=\-]?\s*(\d+)/i) ||
                       fullText.match(/(\d+)\s*(?:marks|points|pts)\b/i);
    if (marksMatch && marksMatch[1]) {
      if (setVal('modal-q-marks', marksMatch[1])) filled.push('marks');
    }

    // ── 2. Chapter / Topic Extraction ────────────────────────────────────────
    const chapterMatch = extractSection(['chapter', 'topic', 'unit', 'module', 'category', 'tag']);
    if (chapterMatch) {
      if (setVal('modal-q-chapter', chapterMatch.substring(0, 80))) filled.push('chapter');
    }

    // ── 3. Primary Test Case (Sample Input & Expected Output) ─────────────────
    let sampleInput = extractSection([
      'sample input 1', 'sample input 0', 'sample input', 'sample test case 1',
      'example 1:?\\s*input', 'example 1 input', 'example input 1', 'example input',
      'test case 1:?\\s*input', 'input 1', 'input', 'stdin'
    ]);
    if (sampleInput) {
      sampleInput = sampleInput.replace(/^(?:input\s*[:=]\s*)/i, '').trim();
      if (setVal('modal-q-sample-input', sampleInput.substring(0, 500))) filled.push('sampleInput');
    }

    let expectedOutput = extractSection([
      'sample output 1', 'sample output 0', 'sample output', 'sample test case 1 output',
      'example 1:?\\s*output', 'example 1 output', 'example output 1', 'example output',
      'test case 1:?\\s*output', 'expected output 1', 'expected output', 'output 1', 'output', 'stdout'
    ]);
    if (expectedOutput) {
      expectedOutput = expectedOutput.replace(/^(?:output\s*[:=]\s*)/i, '').trim();
      if (setVal('modal-q-expected-output', expectedOutput.substring(0, 500))) filled.push('expectedOutput');
    }

    // ── 4. Secondary Test Case (Input 2 & Output 2) ───────────────────────────
    let input2 = extractSection([
      'sample input 2', 'sample test case 2', 'example 2:?\\s*input', 'example 2 input',
      'example input 2', 'test case 2:?\\s*input', 'test case 2 input', 'input 2', 'input2'
    ]);
    if (input2) {
      input2 = input2.replace(/^(?:input\s*[:=]\s*)/i, '').trim();
      if (setVal('modal-q-input2', input2.substring(0, 500))) filled.push('input2');
    }

    let output2 = extractSection([
      'sample output 2', 'sample test case 2 output', 'example 2:?\\s*output', 'example 2 output',
      'example output 2', 'test case 2:?\\s*output', 'test case 2 output', 'expected output 2', 'output 2', 'output2'
    ]);
    if (output2) {
      output2 = output2.replace(/^(?:output\s*[:=]\s*)/i, '').trim();
      if (setVal('modal-q-output2', output2.substring(0, 500))) filled.push('output2');
    }

    // ── Anti-Hardcoding Auto-Generator (Negative / Secondary Test Case) ─────
    if (!output2 && expectedOutput) {
      const lowerAll = fullText.toLowerCase();
      const expClean = expectedOutput.trim();

      if (lowerAll.includes('palindrome') && /palindrome/i.test(expClean)) {
        if (setVal('modal-q-input2', '123')) filled.push('input2');
        if (setVal('modal-q-output2', 'Not Palindrome')) filled.push('output2');
      } else if (lowerAll.includes('prime') && /prime/i.test(expClean)) {
        if (setVal('modal-q-input2', '4')) filled.push('input2');
        if (setVal('modal-q-output2', 'Not Prime')) filled.push('output2');
      } else if (lowerAll.includes('even') && /even/i.test(expClean)) {
        if (setVal('modal-q-input2', '7')) filled.push('input2');
        if (setVal('modal-q-output2', 'Odd')) filled.push('output2');
      } else if (/^true$/i.test(expClean)) {
        const nextIn = sampleInput && !isNaN(sampleInput) ? String(parseInt(sampleInput, 10) + 1) : '0';
        if (setVal('modal-q-input2', nextIn)) filled.push('input2');
        if (setVal('modal-q-output2', 'False')) filled.push('output2');
      } else if (/^yes$/i.test(expClean)) {
        const nextIn = sampleInput && !isNaN(sampleInput) ? String(parseInt(sampleInput, 10) + 1) : '0';
        if (setVal('modal-q-input2', nextIn)) filled.push('input2');
        if (setVal('modal-q-output2', 'No')) filled.push('output2');
      }
    }

    // ── Exam Timer / Duration Extraction ──────────────────────────────────────
    const durationMatch = fullText.match(/(?:duration|timer|time limit|time allowed|test duration)\s*[:=\-]?\s*(\d+)\s*(?:mins?|minutes?|m)?/i);
    if (durationMatch && durationMatch[1]) {
      if (setVal('modal-q-duration', durationMatch[1])) filled.push('duration');
    }

    // ── 5. Starter Code / Solution Code Extraction (Accurate & Strict) ────────
    let starterCode = null;

    // Pattern A: Markdown code fence ```lang ... ```
    const codeBlockMatch = fullText.match(/```(?:python|py|cpp|c|java|js|javascript|typescript|ts)?\s*\n([\s\S]+?)```/i);
    if (codeBlockMatch && codeBlockMatch[1] && isLikelyCode(codeBlockMatch[1])) {
      starterCode = codeBlockMatch[1].trim();
    }

    // Pattern B: Exact Line Headers for Code (e.g. "Java Solution:", "Sample Code:", "Starter Code:")
    if (!starterCode) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headerMatch = line.match(/^(?:java\s+(?:solution|code|program)|python\s+(?:solution|code|program)|c\s+(?:solution|code|program)|c\+\+\s+(?:solution|code|program)|cpp\s+(?:solution|code|program)|sample\s+(?:solution|code|program)|starter\s+(?:code|template)|solution\s+code|source\s+code|boilerplate|implementation)\s*[:\-]?\s*$/i);
        if (headerMatch) {
          let codeLines = [];
          let j = i + 1;
          while (j < lines.length) {
            if (isHeading(lines[j]) && !/^(?:sample code|code|solution|starter code|program|implementation|source code)/i.test(lines[j])) break;
            if (/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s+[A-Z]/i.test(lines[j])) break;
            codeLines.push(lines[j]);
            j++;
          }
          const candidate = codeLines.join('\n').trim();
          if (isLikelyCode(candidate)) {
            starterCode = candidate;
            break;
          }
        }
      }
    }

    // Pattern C: Continuous Code Block Scanner (looks for import java, #include, public class, def, etc.)
    if (!starterCode) {
      const codeStartRegex = /^(?:import\s+(?:java|sys|math|os|typing|collections|Scanner)|#include\s*<|public\s+class\s+|class\s+\w+|def\s+\w+\s*\(|int\s+main\s*\(|void\s+main\s*\(|function\s+\w+\s*\()/i;
      for (let i = 0; i < lines.length; i++) {
        if (codeStartRegex.test(lines[i])) {
          let codeLines = [];
          let j = i;
          while (j < lines.length) {
            if (isHeading(lines[j]) && !/^(?:sample code|code|solution|starter code|program|implementation|source code)/i.test(lines[j])) break;
            if (/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s+[A-Z]/i.test(lines[j])) break;
            codeLines.push(lines[j]);
            j++;
          }
          const candidate = codeLines.join('\n').trim();
          if (isLikelyCode(candidate)) {
            starterCode = candidate;
            break;
          }
        }
      }
    }

    // ── 6. Programming Language Extraction & Code Application ──────────────────
    let detectedLang = null;
    if (starterCode) {
      if (/import\s+java|public\s+class|System\.out\.|Scanner\s+\w+/i.test(starterCode)) detectedLang = 'java';
      else if (/#include\s*<iostream>|std::cin|std::cout/i.test(starterCode)) detectedLang = 'cpp';
      else if (/#include\s*<stdio\.h>|printf\s*\(|scanf\s*\(/i.test(starterCode)) detectedLang = 'c';
      else if (/def\s+\w+\s*\(|import\s+sys/i.test(starterCode)) detectedLang = 'python';
      else if (/console\.log|function\s+\w+\s*\(/i.test(starterCode)) detectedLang = 'javascript';

      if (setVal('modal-q-starter-code', starterCode)) filled.push('starterCode');
    }

    if (!detectedLang) {
      const langMatch = fullText.match(/(?:programming language|language|lang)\s*[:=\-]?\s*([a-zA-Z\+#]+)/i);
      if (langMatch && langMatch[1]) {
        const l = langMatch[1].toLowerCase();
        if (l.includes('py')) detectedLang = 'python';
        else if (l.includes('java') && !l.includes('script')) detectedLang = 'java';
        else if (l.includes('cpp') || l.includes('c++')) detectedLang = 'cpp';
        else if (l.includes('c') && !l.includes('javascript')) detectedLang = 'c';
        else if (l.includes('js') || l.includes('javascript') || l.includes('node')) detectedLang = 'javascript';
      }
    }

    if (detectedLang) {
      const langEl = document.getElementById('modal-q-language');
      if (langEl) { langEl.value = detectedLang; filled.push('language'); }
    }

    // ── 7. Explanation / Hint ─────────────────────────────────────────────────
    const explanation = extractSection(['explanation', 'hint', 'hints', 'approach', 'solution approach', 'note', 'notes']);
    if (explanation) {
      if (setVal('modal-q-explanation', explanation.substring(0, 800))) filled.push('explanation');
    }

    // ── 8. Question Text / Problem Statement ──────────────────────────────────
    let questionText = extractSection([
      'problem statement', 'problem description', 'problem', 'question statement',
      'question', 'task description', 'task', 'description', 'objective', 'challenge'
    ]);

    // If no explicit header, extract body lines before sample input/output/code
    if (!questionText) {
      let qLines = [];
      for (const line of lines) {
        // Strip out document preambles or introductions
        if (/^(?:each question includes|overview|table of contents|difficulty:\s*\w+)/i.test(line)) {
          continue;
        }
        if (/^(?:sample input|input 1|example 1|example:|test case 1|input:|constraints|marks|starter code|sample code|code:|solution:)/i.test(line)) {
          break;
        }
        if (/^(?:def\s+\w+\s*\(|#include\s*<|public\s+class\s+|int\s+main\s*\(|import\s+java)/i.test(line)) {
          break;
        }
        qLines.push(line);
      }
      if (qLines.length > 0) {
        questionText = qLines.join('\n').trim();
      }
    }

    // Append Constraints or Input/Output Format if available
    const constraints = extractSection(['constraints', 'constraint']);
    const inputFormat = extractSection(['input format']);
    const outputFormat = extractSection(['output format']);

    let enrichedQuestion = questionText || '';
    if (inputFormat && !enrichedQuestion.includes(inputFormat)) {
      enrichedQuestion += '\n\n**Input Format:**\n' + inputFormat;
    }
    if (outputFormat && !enrichedQuestion.includes(outputFormat)) {
      enrichedQuestion += '\n\n**Output Format:**\n' + outputFormat;
    }
    if (constraints && !enrichedQuestion.includes(constraints)) {
      enrichedQuestion += '\n\n**Constraints:**\n' + constraints;
    }

    // Clean out any duplicate raw code from question text
    if (starterCode && enrichedQuestion.includes(starterCode)) {
      enrichedQuestion = enrichedQuestion.replace(starterCode, '').trim();
      enrichedQuestion = enrichedQuestion.replace(/(?:sample code|code|solution|starter code|program|source code)\s*[:\-]?\s*$/i, '').trim();
    }

    if (enrichedQuestion.trim()) {
      if (setVal('modal-q-text', enrichedQuestion.trim().substring(0, 3000))) filled.push('text');
    }

    // ── 9. MCQ Options & Correct Option Extraction ────────────────────────────
    const optRegex = /^(?:[a-d][\).\s\-]|option\s*[a-d][\):\s\-])\s*(.+)/i;
    const detectedOptions = lines.filter(l => optRegex.test(l)).slice(0, 4).map(l => {
      const m = l.match(optRegex);
      return m ? m[1].trim() : l;
    });

    if (detectedOptions.length >= 2) {
      ['modal-q-op1', 'modal-q-op2', 'modal-q-op3', 'modal-q-op4'].forEach((id, idx) => {
        if (detectedOptions[idx]) setVal(id, detectedOptions[idx]);
      });
      filled.push('options');

      const ansMatch = fullText.match(/(?:correct answer|answer|correct option|ans)\s*[:=\-]?\s*(?:option\s*)?\(?([a-d1-4])\)?/i);
      if (ansMatch && ansMatch[1]) {
        const val = ansMatch[1].toUpperCase();
        const map = { 'A': '0', 'B': '1', 'C': '2', 'D': '3', '1': '0', '2': '1', '3': '2', '4': '3' };
        if (map[val] !== undefined) {
          setVal('modal-q-correct', map[val]);
        }
      }
    }

    // ── 10. Auto-switch Question Type ─────────────────────────────────────────
    const isCoding = sampleInput || expectedOutput || starterCode || detectedLang || (ext && ['py','c','cpp','java','js','ts'].includes(ext));
    const typeEl = document.getElementById('modal-q-type');
    if (typeEl) {
      if (isCoding) {
        typeEl.value = 'coding';
        this.onQuestionTypeChange();
      } else if (detectedOptions.length >= 2) {
        typeEl.value = 'mcq';
        this.onQuestionTypeChange();
      }
    }

    return [...new Set(filled)];
  }

  // Find the next section heading line index
  _findNextSectionLine(lines, fromIdx) {
    const SECTION_PATTERNS = [
      /^(sample|expected|input|output|explanation|hint|note|approach|chapter|topic|constraint|example|test case|starter code|marks|points)/i,
      /^[A-Z][A-Z\s]{4,}:$/,
      /^\d+\.\s+[A-Z]/
    ];
    for (let i = fromIdx; i < lines.length; i++) {
      if (SECTION_PATTERNS.some(p => p.test(lines[i]))) return i;
    }
    return Math.min(fromIdx + 20, lines.length);
  }

  // Extract description from inline code comments
  _extractCommentDescription(code, ext) {
    let commentLines = [];
    if (ext === 'py') {
      const docMatch = code.match(/^"""([\s\S]+?)"""/m) || code.match(/^'''([\s\S]+?)'''/m);
      if (docMatch) return docMatch[1].trim();
      commentLines = code.split('\n').filter(l => l.trim().startsWith('#')).slice(0, 15).map(l => l.replace(/^#+\s*/, ''));
    } else {
      const blockMatch = code.match(/\/\*([\s\S]+?)\*\//);
      if (blockMatch) return blockMatch[1].replace(/^\s*\*\s?/gm, '').trim();
      commentLines = code.split('\n').filter(l => l.trim().startsWith('//')).slice(0, 15).map(l => l.replace(/^\/\/+\s*/, ''));
    }
    return commentLines.length > 0 ? commentLines.join('\n').trim() : null;
  }

  // ── Keep old method for backward compatibility ─────────────────────────────
  handleCodingFileUpload(event) {
    this.handleSmartDocImport(event);
  }



  renderOverviewSubmissions() {
    const recentTbody = document.getElementById('admin-recent-attempts-tbody');
    const countPill = document.getElementById('admin-submissions-count');
    if (!recentTbody) return;

    const attempts = this.getAdminAttempts();
    const violations = this.getAdminViolations();

    // Apply Filters & Search
    let filtered = [...attempts];

    // Status filter
    if (this.overviewFilter === 'Passed') {
      filtered = filtered.filter(a => (a.percentage || 0) >= 50);
    } else if (this.overviewFilter === 'Failed') {
      filtered = filtered.filter(a => (a.percentage || 0) < 50);
    } else if (this.overviewFilter === 'Violations') {
      filtered = filtered.filter(a => {
        const studentViolations = violations.filter(v => v.studentRegNo.toString() === a.studentRegNo.toString() && v.subjectName === a.subjectName);
        return studentViolations.length > 0 || a.status === 'Auto Submitted';
      });
    }

    // Subject dropdown filter
    if (this.overviewSubjectFilter && this.overviewSubjectFilter !== 'All') {
      filtered = filtered.filter(a => (a.subjectName || '').toLowerCase() === this.overviewSubjectFilter.toLowerCase());
    }

    // Search query filter
    if (this.overviewSearchQuery) {
      const q = this.overviewSearchQuery;
      filtered = filtered.filter(a => 
        (a.studentName || '').toLowerCase().includes(q) ||
        (a.studentRegNo || '').toLowerCase().includes(q) ||
        (a.subjectName || '').toLowerCase().includes(q) ||
        (a.year || '').toLowerCase().includes(q)
      );
    }

    if (countPill) {
      countPill.textContent = `${filtered.length} Record${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      recentTbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
            <div style="font-size: 1.8rem; margin-bottom: 0.5rem;">🔍</div>
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">No matching submissions found</div>
            <div style="font-size: 0.8rem; margin-top: 0.25rem;">Try adjusting your search query or filter chips.</div>
          </td>
        </tr>
      `;
      return;
    }

    // Reverse chronological order for recent submissions
    const sorted = filtered.slice().reverse();

    recentTbody.innerHTML = sorted.map(att => {
      const isPassed = (att.percentage || 0) >= 50;
      const studentViolations = violations.filter(v => v.studentRegNo.toString() === att.studentRegNo.toString() && v.subjectName === att.subjectName);
      const vCount = studentViolations.length > 0 ? Math.max(...studentViolations.map(v => v.count)) : (att.status === 'Auto Submitted' ? 3 : 0);

      const initial = (att.studentName || 'S').charAt(0).toUpperCase();
      const avatarBg = isPassed ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #4f46e5)';

      let cheatBadge = `<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981;"></span> Clean (0)</span>`;
      if (vCount >= 3 || att.status === 'Auto Submitted') {
        cheatBadge = `<span class="badge badge-danger" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 7px; height: 7px; border-radius: 50%; background: #f43f5e;"></span> Auto-Submitted (${vCount})</span>`;
      } else if (vCount > 0) {
        cheatBadge = `<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 0.35rem;"><span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b;"></span> ${vCount} Warning(s)</span>`;
      }

      return `
        <tr>
          <td data-label="Student">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 36px; height: 36px; border-radius: 50%; background: ${avatarBg}; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.88rem; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.15);">${initial}</div>
              <div>
                <div style="font-weight: 600; color: var(--text-main); line-height: 1.25;">${escapeHtml(att.studentName)}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); margin-top: 1px;">${att.studentRegNo}</div>
              </div>
            </div>
          </td>
          <td data-label="Class">
            <span class="badge badge-primary" style="font-weight: 600; font-size: 0.78rem;">${att.year} • Sec ${att.section}</span>
          </td>
          <td data-label="Subject">
            <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(att.subjectName)}</span>
          </td>
          <td data-label="Score">
            <div class="mini-score-container">
              <div class="mini-score-label">
                <span style="font-weight: 700; color: ${isPassed ? '#10b981' : '#f43f5e'};">${att.score}/${att.totalQuestions}</span>
                <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted);">(${att.percentage}%)</span>
              </div>
              <div class="mini-score-track">
                <div class="mini-score-fill ${isPassed ? 'passed' : 'failed'}" style="width: ${Math.min(100, Math.max(0, att.percentage))}%;"></div>
              </div>
            </div>
          </td>
          <td data-label="Result">
            <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-weight: 700; letter-spacing: 0.04em;">${isPassed ? 'PASSED' : 'FAILED'}</span>
          </td>
          <td data-label="Cheating">${cheatBadge}</td>
          <td data-label="Submitted">
            <div style="font-size: 0.8rem; color: var(--text-muted);">${new Date(att.submittedAt || att.startedAt).toLocaleString()}</div>
          </td>
          <td class="actions-cell" data-label="Action" style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="adminDashboard.viewResultDetail('${att.id}')" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 8px;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Details</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  exportOverviewSubmissionsCSV() {
    const attempts = this.getAdminAttempts();
    if (!attempts || attempts.length === 0) {
      ui.showToast('No exam submissions available to export.', 'warning');
      return;
    }

    const headers = ['Student Name', 'Registration No', 'Year', 'Section', 'Subject', 'Score', 'Total Questions', 'Percentage', 'Result', 'Status', 'Submitted At'];
    const rows = attempts.map(a => [
      `"${(a.studentName || '').replace(/"/g, '""')}"`,
      `"${a.studentRegNo || ''}"`,
      `"${a.year || ''}"`,
      `"${a.section || ''}"`,
      `"${(a.subjectName || '').replace(/"/g, '""')}"`,
      a.score !== undefined ? a.score : 0,
      a.totalQuestions || 0,
      `${a.percentage || 0}%`,
      ((a.percentage || 0) >= 50) ? 'PASSED' : 'FAILED',
      `"${a.status || 'Submitted'}"`,
      `"${new Date(a.submittedAt || a.startedAt).toLocaleString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Exam_Submissions_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ui.showToast('Submissions CSV downloaded successfully!', 'success');
  }

  /* ------------------------------------------------------------------------
     2. STUDENT MANAGEMENT & DIRECTORY
     ------------------------------------------------------------------------ */
  getStudentAvatarColor(name, id) {
    const palettes = [
      'linear-gradient(135deg, #4f46e5, #7c3aed)',
      'linear-gradient(135deg, #0ea5e9, #2563eb)',
      'linear-gradient(135deg, #10b981, #059669)',
      'linear-gradient(135deg, #f59e0b, #d97706)',
      'linear-gradient(135deg, #ec4899, #db2777)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #06b6d4, #0891b2)'
    ];
    let hash = 0;
    const str = (name || '') + (id || '');
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const idx = Math.abs(hash) % palettes.length;
    return palettes[idx];
  }

  renderStudentRosterMetrics(students, attempts) {
    const totalEl = document.getElementById('student-stat-total');
    const juniorEl = document.getElementById('student-stat-junior');
    const seniorEl = document.getElementById('student-stat-senior');
    const examActiveEl = document.getElementById('student-stat-exam-active');

    if (!totalEl) return;

    totalEl.textContent = students.length;

    const juniorCount = students.filter(s => s.year === '1st Year' || s.year === '2nd Year').length;
    const seniorCount = students.filter(s => s.year === '3rd Year' || s.year === '4th Year').length;

    if (juniorEl) juniorEl.textContent = juniorCount;
    if (seniorEl) seniorEl.textContent = seniorCount;

    // Students with at least 1 attempt
    const activeStudentRegs = new Set(attempts.map(a => String(a.studentRegNo || '').trim()));
    const activeCount = students.filter(s => activeStudentRegs.has(String(s.regNo || '').trim())).length;
    if (examActiveEl) examActiveEl.textContent = activeCount;
  }

  onStudentSearch(val) {
    this.studentSearchQuery = val || '';
    const clearBtn = document.getElementById('admin-student-search-clear');
    if (clearBtn) {
      clearBtn.style.display = this.studentSearchQuery.trim() ? 'flex' : 'none';
    }
    this.renderStudentsTable();
  }

  clearStudentSearch() {
    this.studentSearchQuery = '';
    const input = document.getElementById('admin-student-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('admin-student-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    this.renderStudentsTable();
  }

  resetStudentFilters() {
    this.studentSearchQuery = '';
    this.studentYearFilter = 'All';
    this.studentSecFilter = 'All';
    const input = document.getElementById('admin-student-search-input');
    if (input) input.value = '';
    const clearBtn = document.getElementById('admin-student-search-clear');
    if (clearBtn) clearBtn.style.display = 'none';
    this.renderStudentsTable();
  }

  async copyStudentRegNo(regNo, btnEl) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(regNo);
      } else {
        const temp = document.createElement('textarea');
        temp.value = regNo;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      if (btnEl) {
        const origHtml = btnEl.innerHTML;
        btnEl.innerHTML = `<span>Copied!</span> <svg class="svg-icon" viewBox="0 0 24 24" width="11" height="11"><polyline points="20 6 9 17 4 12"/></svg>`;
        btnEl.style.borderColor = '#10b981';
        btnEl.style.color = '#10b981';
        setTimeout(() => {
          btnEl.innerHTML = origHtml;
          btnEl.style.borderColor = '';
          btnEl.style.color = '';
        }, 1500);
      }
      ui.showToast(`Register Number ${regNo} copied to clipboard!`, 'info');
    } catch (e) {
      ui.showToast(`Reg No: ${regNo}`, 'info');
    }
  }

  filterResultsByStudent(regNo) {
    this.switchPanel('results');
    this.resultSearchQuery = regNo;
    const searchInput = document.getElementById('admin-results-search-input');
    if (searchInput) searchInput.value = regNo;
    this.renderResultsTable();
  }

  exportStudentsCSV() {
    const students = storage.getStudents();
    const attempts = storage.getAttempts();

    if (students.length === 0) {
      ui.showToast('No student records found to export.', 'warning');
      return;
    }

    const headers = ['Register Number', 'Student Name', 'Academic Year', 'Section', 'Registered Date', 'Exams Taken', 'Average Score %'];
    const rows = students.map(s => {
      const reg = String(s.regNo || '').trim();
      const stdAttempts = attempts.filter(a => String(a.studentRegNo || '').trim() === reg);
      const examCount = stdAttempts.length;
      const avgScore = examCount > 0 
        ? Math.round(stdAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0) / examCount) 
        : 'N/A';

      return [
        `"${reg}"`,
        `"${(s.name || '').replace(/"/g, '""')}"`,
        `"${s.year || ''}"`,
        `"${s.section || ''}"`,
        `"${new Date(s.createdAt || Date.now()).toLocaleDateString()}"`,
        examCount,
        avgScore
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Student_Roster_SCAD_LMS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ui.showToast(`Student Directory exported successfully (${students.length} students)!`, 'success');
  }

  openBulkImportModal() {
    this._bulkImportCandidates = [];
    const previewBox = document.getElementById('student-import-preview-box');
    if (previewBox) previewBox.style.display = 'none';
    const btnExecute = document.getElementById('btn-execute-student-import');
    if (btnExecute) btnExecute.disabled = true;
    const pasteInput = document.getElementById('student-bulk-paste-input');
    if (pasteInput) pasteInput.value = '';
    const fileInput = document.getElementById('student-bulk-file-input');
    if (fileInput) fileInput.value = '';
    this.switchStudentImportTab('file');
    ui.showModal('modal-student-bulk-import');
  }

  switchStudentImportTab(tab) {
    const btnFile = document.getElementById('btn-import-tab-file');
    const btnPaste = document.getElementById('btn-import-tab-paste');
    const panelFile = document.getElementById('student-import-file-panel');
    const panelPaste = document.getElementById('student-import-paste-panel');

    if (tab === 'file') {
      btnFile?.classList.add('active');
      btnPaste?.classList.remove('active');
      if (panelFile) panelFile.style.display = 'block';
      if (panelPaste) panelPaste.style.display = 'none';
    } else {
      btnPaste?.classList.add('active');
      btnFile?.classList.remove('active');
      if (panelPaste) panelPaste.style.display = 'block';
      if (panelFile) panelFile.style.display = 'none';
    }
  }

  downloadSampleStudentCSV() {
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + 
      'RegisterNo,Name,Year,Section\n' +
      '952821104005,Michael Scott,1st Year,A\n' +
      '952821104006,Jim Halpert,2nd Year,B\n' +
      '952821104007,Pam Beesly,3rd Year,A\n' +
      '952821104008,Dwight Schrute,4th Year,C\n';
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', 'student_import_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  handleStudentFileSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      if (file.name.endsWith('.json')) {
        this.parseStudentJson(content);
      } else {
        this.parsePastedStudents(content);
      }
    };
    reader.readAsText(file);
  }

  parseStudentJson(content) {
    try {
      const data = JSON.parse(content);
      const list = Array.isArray(data) ? data : (data.students || []);
      this.updateStudentImportPreview(list);
    } catch (err) {
      ui.showToast('Invalid JSON file format: ' + err.message, 'error');
    }
  }

  parsePastedStudents(rawText) {
    if (!rawText || !rawText.trim()) {
      this._bulkImportCandidates = [];
      const previewBox = document.getElementById('student-import-preview-box');
      if (previewBox) previewBox.style.display = 'none';
      const btn = document.getElementById('btn-execute-student-import');
      if (btn) btn.disabled = true;
      return;
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const candidates = [];

    lines.forEach((line, idx) => {
      if (idx === 0 && line.toLowerCase().includes('register') && line.toLowerCase().includes('name')) {
        return;
      }
      const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= 2) {
        const regNo = parts[0];
        const name = parts[1];
        const year = parts[2] || '1st Year';
        const section = parts[3] || 'A';
        candidates.push({ regNo, name, year, section });
      }
    });

    this.updateStudentImportPreview(candidates);
  }

  updateStudentImportPreview(candidates) {
    const existingStudents = storage.getStudents();
    const existingRegSet = new Set(existingStudents.map(s => String(s.regNo).trim()));

    const validList = [];
    const duplicates = [];
    const invalidReg = [];

    candidates.forEach(c => {
      const cleanReg = String(c.regNo || '').replace(/[^0-9]/g, '');
      const cleanName = (c.name || '').trim();
      const validYear = c.year || '1st Year';
      const validSec = (c.section || 'A').toUpperCase().replace('SECTION', '').trim();

      if (!/^9528\d{8}$/.test(cleanReg)) {
        invalidReg.push(cleanReg || 'Empty');
      } else if (existingRegSet.has(cleanReg)) {
        duplicates.push(cleanReg);
      } else if (!cleanName) {
        invalidReg.push('Missing Name');
      } else {
        existingRegSet.add(cleanReg);
        validList.push({
          regNo: cleanReg,
          name: cleanName,
          year: validYear,
          section: validSec
        });
      }
    });

    this._bulkImportCandidates = validList;

    const previewBox = document.getElementById('student-import-preview-box');
    const statsText = document.getElementById('student-import-stats-text');
    const badge = document.getElementById('student-import-valid-badge');
    const listEl = document.getElementById('student-import-preview-list');
    const btn = document.getElementById('btn-execute-student-import');

    if (previewBox) previewBox.style.display = 'block';

    if (validList.length > 0) {
      if (statsText) statsText.textContent = `${validList.length} student${validList.length === 1 ? '' : 's'} ready for import`;
      if (badge) {
        badge.className = 'badge badge-success';
        badge.textContent = `${validList.length} Valid`;
      }
      if (btn) btn.disabled = false;
    } else {
      if (statsText) statsText.textContent = `No valid new student records found`;
      if (badge) {
        badge.className = 'badge badge-danger';
        badge.textContent = 'None Valid';
      }
      if (btn) btn.disabled = true;
    }

    let html = '';
    if (validList.length > 0) {
      html += validList.slice(0, 10).map(s => `
        <div style="display: flex; justify-content: space-between; padding: 0.35rem 0; border-bottom: 1px dashed rgba(0,0,0,0.06);">
          <span><strong>${escapeHtml(s.name)}</strong> (<code style="font-family: var(--font-mono);">${s.regNo}</code>)</span>
          <span style="color: var(--text-muted);">${s.year} • Sec ${s.section}</span>
        </div>
      `).join('');
      if (validList.length > 10) {
        html += `<div style="padding-top: 0.4rem; color: var(--text-muted); font-size: 0.75rem;">...and ${validList.length - 10} more students</div>`;
      }
    }
    if (duplicates.length > 0) {
      html += `<div style="margin-top: 0.4rem; color: #f59e0b; font-size: 0.75rem;">⚠️ Skipped ${duplicates.length} duplicate register number(s).</div>`;
    }
    if (invalidReg.length > 0) {
      html += `<div style="margin-top: 0.2rem; color: #f43f5e; font-size: 0.75rem;">⚠️ ${invalidReg.length} row(s) had invalid register numbers (must start with 9528 and have 12 digits).</div>`;
    }

    if (listEl) listEl.innerHTML = html;
  }

  executeStudentImport() {
    if (!this._bulkImportCandidates || this._bulkImportCandidates.length === 0) {
      ui.showToast('No valid students to import.', 'warning');
      return;
    }

    let successCount = 0;
    this._bulkImportCandidates.forEach(student => {
      try {
        storage.addStudent(student);
        successCount++;
      } catch (err) {
        console.warn('Import error:', err);
      }
    });

    ui.hideModal('modal-student-bulk-import');
    this._bulkImportCandidates = [];
    ui.showToast(`Successfully enrolled ${successCount} student(s) into LMS!`, 'success');
    this.renderStudentsTable();
  }

  renderStudentsTable() {
    const tbody = document.getElementById('admin-students-tbody');
    const counterEl = document.getElementById('admin-students-counter');
    const resetFiltersBtn = document.getElementById('btn-clear-student-filters');
    if (!tbody) return;

    const allStudents = storage.getStudents();
    const attempts = storage.getAttempts();

    // Update Quick Roster Metrics
    this.renderStudentRosterMetrics(allStudents, attempts);

    let students = [...allStudents];

    // Filter by Year
    if (this.studentYearFilter !== 'All') {
      students = students.filter(s => s.year === this.studentYearFilter);
    }
    // Filter by Section
    if (this.studentSecFilter !== 'All') {
      students = students.filter(s => s.section === this.studentSecFilter);
    }
    // Filter by Search
    if (this.studentSearchQuery && this.studentSearchQuery.trim()) {
      const q = this.studentSearchQuery.toLowerCase();
      students = students.filter(s => 
        (s.name || '').toLowerCase().includes(q) || 
        String(s.regNo || '').toLowerCase().includes(q)
      );
    }

    // Sync Counter Badge
    if (counterEl) {
      counterEl.textContent = `Showing ${students.length} of ${allStudents.length} Students`;
    }

    // Sync Reset Filters button visibility
    if (resetFiltersBtn) {
      const isFiltered = this.studentYearFilter !== 'All' || this.studentSecFilter !== 'All' || (this.studentSearchQuery && this.studentSearchQuery.trim().length > 0);
      resetFiltersBtn.style.display = isFiltered ? 'inline-flex' : 'none';
    }

    // Sync chip buttons state
    document.querySelectorAll('#chips-row-year .chip-btn').forEach(b => {
      if (b.getAttribute('data-val') === this.studentYearFilter) b.classList.add('active');
      else b.classList.remove('active');
    });
    document.querySelectorAll('#chips-row-sec .chip-btn').forEach(b => {
      if (b.getAttribute('data-val') === this.studentSecFilter) b.classList.add('active');
      else b.classList.remove('active');
    });

    if (students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="empty-state" style="padding: 3rem 1.5rem; text-align: center;">
            <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">👨‍🎓</div>
            <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">No matching students found</div>
            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 0.35rem;">
              ${this.studentSearchQuery ? `No student matched "${escapeHtml(this.studentSearchQuery)}"` : 'Try selecting different cohort chips or add a new student.'}
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="adminDashboard.resetStudentFilters()" style="margin-top: 1rem;">Reset All Filters</button>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = students.map(s => {
      const reg = String(s.regNo || '').trim();
      const initial = (s.name || 'S').trim().charAt(0).toUpperCase();
      const avatarBg = this.getStudentAvatarColor(s.name, s.id);
      
      const stdAttempts = attempts.filter(a => String(a.studentRegNo || '').trim() === reg);
      const attemptCount = stdAttempts.length;

      let participationHtml = `<span class="student-exam-pill empty" title="No exams taken yet"><span style="opacity: 0.6;">📝</span> 0 Exams Taken</span>`;
      if (attemptCount > 0) {
        const passedCount = stdAttempts.filter(a => (a.percentage || 0) >= 50).length;
        participationHtml = `
          <button type="button" class="student-exam-pill active" onclick="adminDashboard.filterResultsByStudent('${escapeHtml(reg)}')" title="Click to view exam attempts for ${escapeHtml(s.name)}">
            <span>📊</span> ${attemptCount} Exam${attemptCount === 1 ? '' : 's'} (${passedCount} Passed)
          </button>
        `;
      }

      return `
        <tr>
          <td data-label="Student Profile">
            <div class="student-profile-cell">
              <div class="student-avatar" style="background: ${avatarBg};">${initial}</div>
              <div class="student-info-meta">
                <span class="student-primary-name">${escapeHtml(s.name)}</span>
                <span class="student-reg-copy-pill" onclick="adminDashboard.copyStudentRegNo('${escapeHtml(reg)}', this)" title="Click to copy register number">
                  <span>${escapeHtml(reg)}</span>
                  <svg class="svg-icon" viewBox="0 0 24 24" width="11" height="11"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </span>
              </div>
            </div>
          </td>
          <td data-label="Class & Section">
            <div class="student-class-stack">
              <span class="student-class-badge">${escapeHtml(s.year)}</span>
              <span class="student-section-badge">Section ${escapeHtml(s.section)}</span>
            </div>
          </td>
          <td data-label="Exam Participation">${participationHtml}</td>
          <td data-label="Enrolled On">
            <span style="font-size: 0.84rem; color: var(--text-muted); display: inline-flex; align-items: center; gap: 0.35rem;">
              <svg class="svg-icon" viewBox="0 0 24 24" width="13" height="13"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${new Date(s.createdAt || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </td>
          <td class="actions-cell" data-label="Actions" style="text-align: right; justify-content: flex-end;">
            <button type="button" class="btn-student-edit" onclick="adminDashboard.openEditStudentModal('${s.id}')" title="Edit student details">
              <svg class="svg-icon" viewBox="0 0 24 24" width="14" height="14"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Edit</span>
            </button>
            <button type="button" class="btn-student-delete" onclick="adminDashboard.deleteStudent('${s.id}')" title="Delete student record">
              <svg class="svg-icon" viewBox="0 0 24 24" width="14" height="14"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  openAddStudentModal() {
    if (typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }
    const data = storage.getYearsAndSections();
    document.getElementById('student-modal-title').textContent = 'Add New Student';
    document.getElementById('student-id-field').value = '';
    document.getElementById('modal-student-name').value = '';
    document.getElementById('modal-student-reg').value = '';
    const yearEl = document.getElementById('modal-student-year');
    if (yearEl) yearEl.value = (data.years && data.years[0]) ? data.years[0] : '';
    const secEl = document.getElementById('modal-student-sec');
    if (secEl) secEl.value = (data.sections && data.sections[0]) ? data.sections[0] : '';

    ui.showModal('modal-student-form');
  }

  openEditStudentModal(id) {
    const student = storage.getStudents().find(s => s.id === id);
    if (!student) return;

    document.getElementById('student-modal-title').textContent = 'Edit Student';
    document.getElementById('student-id-field').value = student.id;
    document.getElementById('modal-student-name').value = student.name;
    document.getElementById('modal-student-reg').value = student.regNo;
    document.getElementById('modal-student-year').value = student.year;
    document.getElementById('modal-student-sec').value = student.section;

    ui.showModal('modal-student-form');
  }

  saveStudentSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('student-id-field').value;
    const name = document.getElementById('modal-student-name').value.trim();
    const regNo = document.getElementById('modal-student-reg').value.trim();
    const year = document.getElementById('modal-student-year').value;
    const section = document.getElementById('modal-student-sec').value;

    try {
      if (id) {
        storage.updateStudent(id, { name, regNo, year, section });
        ui.showToast('Student updated successfully!', 'success');
      } else {
        storage.addStudent({ name, regNo, year, section });
        ui.showToast('Student added successfully!', 'success');
      }
      ui.hideModal('modal-student-form');
      this.renderStudentsTable();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  confirmDeleteAction({ message, onConfirm }) {
    const msgEl = document.getElementById('confirm-delete-message');
    const submitBtn = document.getElementById('confirm-delete-submit-btn');

    if (msgEl) msgEl.innerHTML = message;

    if (submitBtn) {
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

      newSubmitBtn.addEventListener('click', async () => {
        ui.hideModal('modal-confirm-delete');
        if (typeof onConfirm === 'function') {
          await onConfirm();
        }
      });
    }

    ui.showModal('modal-confirm-delete');
  }

  deleteStudent(id) {
    const targetId = String(id).trim().toLowerCase();
    const students = storage.getStudents();
    const s = students.find(item => 
      (item.id && String(item.id).trim().toLowerCase() === targetId) ||
      (item.regNo && String(item.regNo).trim().toLowerCase() === targetId)
    );
    const nameStr = s ? `<strong>${escapeHtml(s.name)}</strong> (${escapeHtml(s.regNo)})` : 'this student';

    this.confirmDeleteAction({
      message: `Are you sure you want to delete student record for ${nameStr}?`,
      onConfirm: async () => {
        storage.deleteStudent(id);
        ui.showToast('Student record permanently deleted.', 'warning');
        this.renderStudentsTable();
      }
    });
  }


  /* ------------------------------------------------------------------------
     3. YEARS & SECTIONS MANAGEMENT
     ------------------------------------------------------------------------ */
  renderYearsSectionsPanel() {
    const data = storage.getYearsAndSections();
    const yearsList = document.getElementById('admin-years-list');
    const sectionsList = document.getElementById('admin-sections-list');

    if (yearsList) {
      if (!data.years || data.years.length === 0) {
        yearsList.innerHTML = '<li style="padding: 1rem; color: var(--text-muted); text-align: center;">No academic years configured.</li>';
      } else {
        yearsList.innerHTML = data.years.map((y, idx) => `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-dark-card); border-radius: var(--radius-md); margin-bottom: 0.5rem; border: 1px solid var(--bg-dark-border);">
            <span><strong>${escapeHtml(y)}</strong></span>
            <button class="btn btn-danger btn-icon" onclick="adminDashboard.deleteYear(${idx})">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
            </button>
          </li>
        `).join('');
      }
    }

    if (sectionsList) {
      if (!data.sections || data.sections.length === 0) {
        sectionsList.innerHTML = '<li style="padding: 1rem; color: var(--text-muted); text-align: center;">No sections configured.</li>';
      } else {
        sectionsList.innerHTML = data.sections.map((sec, idx) => `
          <li style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--bg-dark-card); border-radius: var(--radius-md); margin-bottom: 0.5rem; border: 1px solid var(--bg-dark-border);">
            <span><strong>Section ${escapeHtml(sec)}</strong></span>
            <button class="btn btn-danger btn-icon" onclick="adminDashboard.deleteSection(${idx})">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
            </button>
          </li>
        `).join('');
      }
    }
  }

  addYearPrompt() {
    const val = prompt("Enter New Academic Year Name (e.g. 5th Year):");
    if (val && val.trim()) {
      const data = storage.getYearsAndSections();
      if (!data.years.includes(val.trim())) {
        data.years.push(val.trim());
        storage.saveYearsAndSections(data);
        ui.showToast('Year added.', 'success');
        this.renderYearsSectionsPanel();
        if (typeof window.populateGlobalYearsAndSections === 'function') {
          window.populateGlobalYearsAndSections();
        }
      }
    }
  }

  deleteYear(idx) {
    const data = storage.getYearsAndSections();
    const yearName = data.years[idx] || 'this year';

    this.confirmDeleteAction({
      message: `Are you sure you want to delete Academic Year <strong>${escapeHtml(yearName)}</strong>?`,
      onConfirm: () => {
        data.years.splice(idx, 1);
        storage.saveYearsAndSections(data);
        ui.showToast('Academic Year deleted.', 'success');
        this.renderYearsSectionsPanel();
        if (typeof window.populateGlobalYearsAndSections === 'function') {
          window.populateGlobalYearsAndSections();
        }
      }
    });
  }

  addSectionPrompt() {
    const val = prompt("Enter New Section Name (e.g. D):");
    if (val && val.trim()) {
      const data = storage.getYearsAndSections();
      const upper = val.trim().toUpperCase();
      if (!data.sections.includes(upper)) {
        data.sections.push(upper);
        storage.saveYearsAndSections(data);
        ui.showToast('Section added.', 'success');
        this.renderYearsSectionsPanel();
        if (typeof window.populateGlobalYearsAndSections === 'function') {
          window.populateGlobalYearsAndSections();
        }
      }
    }
  }

  deleteSection(idx) {
    const data = storage.getYearsAndSections();
    const secName = data.sections[idx] || 'this section';

    this.confirmDeleteAction({
      message: `Are you sure you want to delete Section <strong>${escapeHtml(secName)}</strong>?`,
      onConfirm: () => {
        data.sections.splice(idx, 1);
        storage.saveYearsAndSections(data);
        ui.showToast('Section deleted.', 'success');
        this.renderYearsSectionsPanel();
        if (typeof window.populateGlobalYearsAndSections === 'function') {
          window.populateGlobalYearsAndSections();
        }
      }
    });
  }


  /* ------------------------------------------------------------------------
     4. SUBJECT MANAGEMENT
     ------------------------------------------------------------------------ */
  renderSubjectsTable() {
    const tbody = document.getElementById('admin-subjects-tbody');
    if (!tbody) return;

    const subjects = this.getAdminSubjects();
    const questions = this.getAdminQuestions();

    if (subjects.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No subjects added.</td></tr>`;
      return;
    }

    tbody.innerHTML = subjects.map(s => {
      const qCount = questions.filter(q => q.subjectId === s.id).length;
      return `
        <tr>
          <td data-label="Course Code"><strong>${escapeHtml(s.code || 'N/A')}</strong></td>
          <td data-label="Subject Name">
            <a href="javascript:void(0)" class="clickable-subject-link" onclick="adminDashboard.openExamAttendeesModal('${s.id}')" title="View attendees & performance report for this subject">
              <strong>${escapeHtml(s.name)}</strong>
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-left: 3px; opacity: 0.8;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem; display: flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px; color: var(--primary-400);"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Timer: <strong style="color: var(--text-main);">${s.duration || 30} Mins</strong></span>
              ${this.isSuperAdmin() ? `<span class="badge" style="background: rgba(99, 102, 241, 0.12); color: #6366f1; font-size: 0.7rem; font-weight: 600; padding: 2px 6px; border-radius: 6px;">👤 Admin: @${escapeHtml(s.createdBy || 'admin')}</span>` : ''}
            </div>
          </td>
          <td data-label="Target Year"><span class="badge badge-primary">${s.year}</span></td>
          <td data-label="Target Section"><span class="badge badge-info">Section ${s.section || 'All'}</span></td>
          <td data-label="MCQ Count">${qCount} MCQs</td>
          <td class="actions-cell" data-label="Actions">
            <button class="btn btn-secondary btn-icon" onclick="adminDashboard.openExamAttendeesModal('${s.id}')" title="View student attendees & scores">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Attendees
            </button>
            <button class="btn btn-secondary btn-icon" onclick="adminDashboard.openEditSubjectModal('${s.id}')">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
            </button>
            <button class="btn btn-danger btn-icon" onclick="adminDashboard.deleteSubject('${s.id}')">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  setModalWarningLimit(val) {
    const input = document.getElementById('modal-sub-max-warnings');
    const badge = document.getElementById('modal-sub-warnings-badge');
    const count = parseInt(val, 10) || 3;
    if (input) input.value = count;
    if (badge) badge.textContent = `${count} Warnings Allowed`;
  }

  openAddSubjectModal() {
    if (typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }
    const data = storage.getYearsAndSections();
    document.getElementById('subject-modal-title').textContent = 'Add Subject';
    document.getElementById('subject-id-field').value = '';
    document.getElementById('modal-sub-code').value = '';
    document.getElementById('modal-sub-name').value = '';
    const yearEl = document.getElementById('modal-sub-year');
    if (yearEl) yearEl.value = (data.years && data.years[0]) ? data.years[0] : '';
    document.getElementById('modal-sub-sec').value = 'All';
    document.getElementById('modal-sub-desc').value = '';
    this.setDurationInputs('modal-sub', 30);
    const warnInput = document.getElementById('modal-sub-max-warnings');
    if (warnInput) warnInput.value = 3;
    const warnBadge = document.getElementById('modal-sub-warnings-badge');
    if (warnBadge) warnBadge.textContent = '3 Warnings Allowed';

    ui.showModal('modal-subject-form');
  }

  openEditSubjectModal(id) {
    const subject = storage.getSubjects().find(s => s.id === id);
    if (!subject) return;

    if (!this.isSuperAdmin()) {
      const creator = (subject.createdBy || 'admin').trim().toLowerCase();
      if (creator !== this.getCurrentAdminUsername()) {
        ui.showToast('You are not authorized to edit subjects created by another admin.', 'error');
        return;
      }
    }

    document.getElementById('subject-modal-title').textContent = 'Edit Subject';
    document.getElementById('subject-id-field').value = subject.id;
    document.getElementById('modal-sub-code').value = subject.code || '';
    document.getElementById('modal-sub-name').value = subject.name;
    document.getElementById('modal-sub-year').value = subject.year;
    document.getElementById('modal-sub-sec').value = subject.section || 'All';
    document.getElementById('modal-sub-desc').value = subject.description || '';
    this.setDurationInputs('modal-sub', subject.duration || 30);
    const warnInput = document.getElementById('modal-sub-max-warnings');
    if (warnInput) warnInput.value = subject.maxWarnings || 3;
    const warnBadge = document.getElementById('modal-sub-warnings-badge');
    if (warnBadge) warnBadge.textContent = `${subject.maxWarnings || 3} Warnings Allowed`;

    ui.showModal('modal-subject-form');
  }

  saveSubjectSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('subject-id-field').value;
    const code = document.getElementById('modal-sub-code').value.trim();
    const name = document.getElementById('modal-sub-name').value.trim();
    const year = document.getElementById('modal-sub-year').value;
    const section = document.getElementById('modal-sub-sec').value;
    const description = document.getElementById('modal-sub-desc').value.trim();
    const durationInput = document.getElementById('modal-sub-duration');
    const duration = durationInput ? (parseInt(durationInput.value, 10) || 30) : 30;
    const warnInput = document.getElementById('modal-sub-max-warnings');
    const maxWarnings = warnInput ? (parseInt(warnInput.value, 10) || 3) : 3;

    try {
      if (id) {
        storage.updateSubject(id, { code, name, year, section, description, duration, maxWarnings });
        ui.showToast('Subject updated.', 'success');
      } else {
        storage.addSubject({ code, name, year, section, description, duration, maxWarnings });
        ui.showToast('Subject created.', 'success');
      }
      ui.hideModal('modal-subject-form');
      this.renderSubjectsTable();
      this.populateQuestionSubjectFilterDropdown();
      if (typeof studentDashboard !== 'undefined') studentDashboard.renderDashboard();
    } catch (err) {
      ui.showToast(err.message, 'error');
    }
  }

  deleteSubject(id) {
    const targetId = String(id).trim().toLowerCase();
    const subjects = storage.getSubjects();
    const sub = subjects.find(item => 
      (item.id && String(item.id).trim().toLowerCase() === targetId) ||
      (item.code && String(item.code).trim().toLowerCase() === targetId)
    );
    if (!sub) return;

    if (!this.isSuperAdmin()) {
      const creator = (sub.createdBy || 'admin').trim().toLowerCase();
      if (creator !== this.getCurrentAdminUsername()) {
        ui.showToast('You are not authorized to delete subjects created by another admin.', 'error');
        return;
      }
    }

    const subName = sub ? `<strong>${escapeHtml(sub.name)}</strong> (${escapeHtml(sub.code || 'CODE')})` : 'this subject';

    this.confirmDeleteAction({
      message: `Are you sure you want to delete subject ${subName}? <br><span style="color:var(--accent-rose); font-weight:600; display:block; margin-top:0.4rem;">Deleting a subject also permanently deletes all associated questions from the database.</span>`,
      onConfirm: async () => {
        storage.deleteSubject(id);
        ui.showToast('Subject and associated questions permanently deleted.', 'warning');
        this.renderSubjectsTable();
        this.populateQuestionSubjectFilterDropdown();
        if (typeof studentDashboard !== 'undefined') studentDashboard.renderDashboard();
      }
    });
  }



  /* ------------------------------------------------------------------------
     5. QUESTION MANAGEMENT
     ------------------------------------------------------------------------ */
  cleanQuestionText(text) {
    if (!text) return 'No Question Text';
    let str = String(text).trim();

    if (str.startsWith('{') || str.startsWith('[')) {
      try {
        const parsed = JSON.parse(str);
        if (typeof parsed === 'object' && parsed !== null) {
          if (parsed.question) str = parsed.question;
          else if (parsed.text) str = parsed.text;
          else if (parsed.prompt) str = parsed.prompt;
          else if (parsed.title) str = parsed.title;
          else if (Array.isArray(parsed) && parsed.length > 0) {
            str = parsed.map(item => (typeof item === 'string' ? item : (item.text || item.question || ''))).filter(Boolean).join(' ');
          }
        }
      } catch (e) {}
    }

    if (str.includes('shadowOffsetX') || str.includes('contentEditable') || str.includes('alwaysOnTop') || str.includes('shadowColor')) {
      const textMatch = str.match(/["']?(?:text|question|title|prompt)["']?\s*:\s*["']([^"']+)["']/i);
      if (textMatch && textMatch[1]) {
        str = textMatch[1];
      } else {
        const leadingPart = str.split(/["']\w+["']\s*:/)[0].replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
        if (leadingPart && leadingPart.length > 2 && !/^\d+$/.test(leadingPart)) {
          str = leadingPart;
        } else {
          str = 'Question Content ' + (leadingPart ? `(#${leadingPart})` : '(PDF Data)');
        }
      }
    }

    return str.replace(/\s+/g, ' ').trim() || 'Question Content';
  }

  renderQuestionsTable() {
    this.populateQuestionSubjectFilterDropdown();

    const tbody = document.getElementById('admin-questions-tbody');
    if (!tbody) return;

    let questions = this.getAdminQuestions();
    const subjects = this.getAdminSubjects();

    if (this.questionSubjectFilter !== 'All') {
      questions = questions.filter(q => q.subjectId === this.questionSubjectFilter);
    }

    if (questions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No questions found.</td></tr>`;
      return;
    }

    tbody.innerHTML = questions.map(q => {
      const sub = subjects.find(s => s.id === q.subjectId);
      const subName = sub ? sub.name : (q.subjectId || 'N/A');
      const cleanText = this.cleanQuestionText(q.text || q.question);
      const hasPdf = q.pdfFileName ? `<div class="pdf-file-badge"><svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${escapeHtml(q.pdfFileName)}</div>` : '';
      
      const isCoding = q.type === 'coding';
      const qMarks = q.marks !== undefined ? q.marks : (isCoding ? 10 : 1);
      const optionLetter = isCoding
        ? `<span class="badge badge-info" style="font-family: var(--font-mono, monospace); font-size: 0.75rem;" title="Expected Output: ${escapeHtml(q.expectedOutput || 'N/A')}">💻 ${(q.language || 'python').toUpperCase()}: ${escapeHtml((q.expectedOutput || 'Output').slice(0, 10))} (${qMarks} M)</span>`
        : (['A', 'B', 'C', 'D'][q.correctIndex] !== undefined ? `Option ${['A', 'B', 'C', 'D'][q.correctIndex] || (q.correctIndex + 1)}` : `Option ${q.correctIndex + 1}`);

      const topicBadge = isCoding 
        ? `<span class="badge badge-info">${escapeHtml(q.chapter || 'Coding')}</span> <span class="badge badge-warning" style="margin-left: 0.25rem;">💻 Coding (${qMarks} Marks)</span>`
        : `<span class="badge badge-info">${escapeHtml(q.chapter || 'General')}</span>`;

      return `
        <tr>
          <td data-label="Year" style="white-space: nowrap;"><span class="badge badge-primary">${escapeHtml(q.year || '1st Year')}</span></td>
          <td data-label="Subject" style="font-weight: 600;">
            <a href="javascript:void(0)" class="clickable-subject-link" onclick="adminDashboard.openExamAttendeesModal('${q.subjectId}')" title="Click to view exam attendees & performance report">
              ${escapeHtml(subName)}
            </a>
          </td>
          <td data-label="Topic">${topicBadge}</td>
          <td data-label="Question">
            <div class="q-text-cell" title="${escapeHtml(cleanText)}">${escapeHtml(cleanText)}</div>
            ${hasPdf}
          </td>
          <td data-label="Answer / Test Case" style="white-space: nowrap;">
            ${isCoding ? optionLetter : `<span class="badge badge-success">${optionLetter}</span>`}
          </td>
          <td class="actions-cell" data-label="Actions">
            <button class="btn btn-secondary btn-icon btn-sm" onclick="adminDashboard.openEditQuestionModal('${q.id}')">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
            </button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="adminDashboard.deleteQuestion('${q.id}', this)">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  populateQuestionSubjectFilterDropdown() {
    const filterSelect = document.getElementById('admin-q-filter-subject');
    const customMenu = document.getElementById('admin-q-custom-dropdown-menu');
    const subjects = this.getAdminSubjects();
    const currentVal = this.questionSubjectFilter;

    if (customMenu) {
      let itemsHtml = `<div class="custom-dropdown-item ${currentVal === 'All' ? 'selected' : ''}" data-value="All" onclick="adminDashboard.selectCustomOption('admin-q-custom-dropdown', 'All', 'All Subjects', 'question-subject')">All Subjects</div>`;
      subjects.forEach(s => {
        const isSel = s.id === currentVal;
        itemsHtml += `<div class="custom-dropdown-item ${isSel ? 'selected' : ''}" data-value="${s.id}" onclick="adminDashboard.selectCustomOption('admin-q-custom-dropdown', '${s.id}', '${escapeHtml(s.name)}', 'question-subject')">${s.year} - ${escapeHtml(s.name)}</div>`;
      });
      customMenu.innerHTML = itemsHtml;
    }

    if (filterSelect) {
      filterSelect.innerHTML = `<option value="All" ${currentVal === 'All' ? 'selected' : ''}>All Subjects</option>` +
        (subjects.length > 0 ? subjects.map(s => `<option value="${s.id}" ${s.id === currentVal ? 'selected' : ''}>${s.year} - ${escapeHtml(s.name)} (${s.code || 'CODE'})</option>`).join('') : '');
    }
  }

  populateQuestionSubjectDropdown(targetId = 'modal-q-subject') {
    const select = document.getElementById(targetId);
    if (!select) return;

    const subjects = this.getAdminSubjects();
    let optionsHtml = '';

    if (targetId === 'pdf-upload-subject') {
      optionsHtml = `<option value="NEW">+ Create New Subject & Upload PDF</option>` +
        subjects.map(s => `<option value="${s.id}">${s.year} - ${escapeHtml(s.name)} (${s.code || 'CODE'})</option>`).join('');
    } else {
      optionsHtml = `<option value="__CUSTOM__">✏️ + Type New / Custom Subject...</option>` +
        subjects.map(s => `<option value="${s.id}">${s.year} - ${escapeHtml(s.name)}</option>`).join('');
    }

    select.innerHTML = optionsHtml;

    // Populate year and section dropdowns for custom subject typing
    const ysData = storage.getYearsAndSections();
    const yearSelect = document.getElementById('modal-q-custom-subject-year');
    const secSelect = document.getElementById('modal-q-custom-subject-sec');
    if (yearSelect && ysData && ysData.years) {
      yearSelect.innerHTML = ysData.years.map(y => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`).join('');
    }
    if (secSelect && ysData && ysData.sections) {
      secSelect.innerHTML = `<option value="All">All Sections</option>` + ysData.sections.map(sec => `<option value="${escapeHtml(sec)}">Sec ${escapeHtml(sec)}</option>`).join('');
    }

    this.populateQuestionSubjectFilterDropdown();
  }

  /* ------------------------------------------------------------------------
     PDF / JSON Question Paper Upload Functions
     ------------------------------------------------------------------------ */
  openPdfUploadModal(mode = 'json') {
    this.uploadMode = mode;
    this.parsedJsonResult = null;

    const modalTitle = document.getElementById('modal-upload-title');
    if (modalTitle) {
      modalTitle.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg> Upload Question Paper PDF
      `;
    }

    this.populateQuestionSubjectDropdown('pdf-upload-subject');
    const select = document.getElementById('pdf-upload-subject');
    if (select) {
      this.onPdfSubjectSelectChange(select.value);
    }
    this.setDurationInputs('pdf-upload', 30);

    const nameInput = document.getElementById('pdf-new-subject-name');
    const codeInput = document.getElementById('pdf-new-subject-code');
    if (nameInput) nameInput.value = '';
    if (codeInput) codeInput.value = '';

    const fileInput = document.getElementById('pdf-file-input');
    if (fileInput) fileInput.value = '';

    const txtArea = document.getElementById('pdf-extracted-text');
    if (txtArea) txtArea.value = '';

    const wrap = document.getElementById('pdf-file-preview-wrap');
    if (wrap) wrap.style.display = 'none';

    this.hideValidationError();
    const previewWrap = document.getElementById('json-preview-wrap');
    if (previewWrap) previewWrap.style.display = 'none';

    const submitBtn = document.getElementById('pdf-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `Import Questions`;
    }

    this.setupDropzoneEvents();
    ui.showModal('modal-pdf-upload');
  }

  setupDropzoneEvents() {
    const dropzone = document.getElementById('pdf-dropzone');
    const fileInput = document.getElementById('pdf-file-input');
    if (!dropzone || dropzone.dataset.bound) return;
    dropzone.dataset.bound = 'true';

    dropzone.addEventListener('click', () => {
      fileInput.click();
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      }, false);
    });

    dropzone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        fileInput.files = files;
        this.handlePdfFileSelect({ target: { files: files } });
      }
    });
  }

  onPdfSubjectSelectChange(subjectId) {
    const newFields = document.getElementById('pdf-new-subject-fields');
    const nameInput = document.getElementById('pdf-new-subject-name');

    if (subjectId === 'NEW' || !subjectId) {
      if (newFields) newFields.style.display = 'block';
      if (nameInput) nameInput.required = true;
      this.setDurationInputs('pdf-upload', 30);
    } else {
      if (newFields) newFields.style.display = 'none';
      if (nameInput) nameInput.required = false;

      const subjects = storage.getSubjects();
      const subject = subjects.find(s => s.id === subjectId);
      if (subject) {
        const yearSelect = document.getElementById('pdf-upload-year');
        const secSelect = document.getElementById('pdf-upload-sec');
        if (yearSelect) yearSelect.value = subject.year || '1st Year';
        if (secSelect) secSelect.value = subject.section || 'All';
        this.setDurationInputs('pdf-upload', subject.duration || 30);
      }
    }
    this.onUploadMetaChange();
  }

  /* Duration & Timer Preset Controllers */
  setDurationInputs(prefix, minutes) {
    const minVal = parseInt(minutes, 10) || 30;
    const inputEl = document.getElementById(`${prefix}-duration`);
    const presetEl = document.getElementById(`${prefix}-duration-preset`);
    const badgeEl = document.getElementById(`${prefix}-duration-badge`);

    if (inputEl) inputEl.value = minVal;
    if (presetEl) {
      const standardPresets = ['10', '15', '20', '30', '45', '60', '90', '120'];
      if (standardPresets.includes(String(minVal))) {
        presetEl.value = String(minVal);
      } else {
        presetEl.value = 'custom';
      }
    }
    if (badgeEl) badgeEl.textContent = `${minVal} Mins`;
  }

  onDurationPresetChange(prefix) {
    const presetEl = document.getElementById(`${prefix}-duration-preset`);
    const inputEl = document.getElementById(`${prefix}-duration`);
    const badgeEl = document.getElementById(`${prefix}-duration-badge`);
    if (!presetEl || !inputEl) return;

    if (presetEl.value !== 'custom') {
      inputEl.value = presetEl.value;
      if (badgeEl) badgeEl.textContent = `${presetEl.value} Mins`;
    } else {
      inputEl.focus();
      inputEl.select();
    }
    if (prefix === 'pdf-upload') {
      this.onUploadMetaChange();
    }
  }

  onCustomDurationInput(prefix) {
    const inputEl = document.getElementById(`${prefix}-duration`);
    const presetEl = document.getElementById(`${prefix}-duration-preset`);
    const badgeEl = document.getElementById(`${prefix}-duration-badge`);
    if (!inputEl) return;

    let val = parseInt(inputEl.value, 10);
    if (isNaN(val) || val <= 0) val = 1;
    if (val > 360) val = 360;

    if (badgeEl) badgeEl.textContent = `${val} Mins`;

    if (presetEl) {
      const standardPresets = ['10', '15', '20', '30', '45', '60', '90', '120'];
      if (standardPresets.includes(String(val))) {
        presetEl.value = String(val);
      } else {
        presetEl.value = 'custom';
      }
    }
    if (prefix === 'pdf-upload') {
      this.onUploadMetaChange();
    }
  }

  onUploadMetaChange() {
    const durInput = document.getElementById('pdf-upload-duration');
    const metaDur = document.getElementById('preview-meta-duration');
    if (metaDur && durInput) metaDur.textContent = `${durInput.value || 30} Mins`;

    if (this.parsedJsonResult && this.parsedJsonResult.valid) {
      this.renderJsonPreview(this.parsedJsonResult);
    }
  }

  showValidationError(msg) {
    const errorWrap = document.getElementById('json-validation-error-wrap');
    const errorText = document.getElementById('json-validation-error-text');
    const previewWrap = document.getElementById('json-preview-wrap');
    const submitBtn = document.getElementById('pdf-submit-btn');

    if (errorText) errorText.textContent = msg;
    if (errorWrap) errorWrap.style.display = 'block';
    if (previewWrap) previewWrap.style.display = 'none';
    if (submitBtn) submitBtn.disabled = true;
  }

  hideValidationError() {
    const errorWrap = document.getElementById('json-validation-error-wrap');
    const submitBtn = document.getElementById('pdf-submit-btn');
    if (errorWrap) errorWrap.style.display = 'none';
    if (submitBtn) submitBtn.disabled = false;
  }

  validateAndParseJson(rawContent) {
    if (!rawContent || !rawContent.trim()) {
      return { valid: false, error: "Empty JSON file. Please select a valid JSON question paper." };
    }

    let parsedObj;
    try {
      parsedObj = JSON.parse(rawContent);
    } catch (e) {
      return { valid: false, error: `Invalid JSON format: ${e.message}` };
    }

    if (!parsedObj || typeof parsedObj !== 'object') {
      return { valid: false, error: "Invalid JSON: Root element must be an object." };
    }

    if (!parsedObj.questions) {
      return { valid: false, error: "Invalid JSON: Missing 'questions' property at root level." };
    }

    if (!Array.isArray(parsedObj.questions)) {
      return { valid: false, error: "Invalid JSON: 'questions' must be an array." };
    }

    if (parsedObj.questions.length === 0) {
      return { valid: false, error: "Invalid JSON: 'questions' array cannot be empty." };
    }

    const questions = [];
    const seenIds = new Set();
    const letterMap = ['A', 'B', 'C', 'D'];

    for (let i = 0; i < parsedObj.questions.length; i++) {
      const q = parsedObj.questions[i];
      const qNum = i + 1;

      if (!q || typeof q !== 'object') {
        return { valid: false, error: `Invalid JSON: Question ${qNum} is not a valid object.` };
      }

      // Unique Question ID check
      if (q.id) {
        const cleanId = String(q.id).trim();
        if (seenIds.has(cleanId)) {
          return { valid: false, error: `Invalid JSON: Duplicate question ID '${cleanId}' found at Question ${qNum}.` };
        }
        seenIds.add(cleanId);
      }

      // Question Text check
      const text = (q.question || q.text || '').toString().trim();
      if (!text) {
        return { valid: false, error: `Invalid JSON: Question ${qNum} has empty question text.` };
      }

      // Check if Coding Question
      if (q.type === 'coding' || q.type === 'code') {
        const expOut = (q.expectedOutput || q.output || q.answer || '').toString().trim();
        if (!expOut) {
          return { valid: false, error: `Invalid JSON: Coding Question ${qNum} requires an 'expectedOutput'.` };
        }
        questions.push({
          id: (q.id ? String(q.id).trim() : null) || `q-code-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
          type: 'coding',
          question: text,
          text: text,
          title: q.title || text.split('\n')[0].replace(/^#*\s*/, '').substring(0, 40),
          language: (q.language || 'python').toLowerCase(),
          marks: parseInt(q.marks || 10, 10),
          starterCode: q.starterCode || q.code || '',
          sampleInput: q.sampleInput !== undefined ? q.sampleInput : (q.input || ''),
          expectedOutput: expOut,
          input2: q.input2 || '',
          output2: q.output2 || '',
          chapter: q.chapter || 'Practical Coding',
          explanation: q.explanation || ''
        });
        continue;
      }

      // Options format check
      let optionsArr = [];
      if (Array.isArray(q.options)) {
        optionsArr = q.options.map(o => typeof o === 'object' && o !== null ? (o.text || o.value || o.option || '') : String(o));
      } else if (q.options && typeof q.options === 'object') {
        const keys = Object.keys(q.options).map(k => k.toUpperCase());
        if (keys.includes('A') || keys.includes('B') || keys.includes('C') || keys.includes('D')) {
          optionsArr = [
            q.options.A || q.options.a || '',
            q.options.B || q.options.b || '',
            q.options.C || q.options.c || '',
            q.options.D || q.options.d || ''
          ];
        } else {
          optionsArr = Object.values(q.options).map(v => String(v));
        }
      }

      if (!optionsArr || optionsArr.length !== 4) {
        return { valid: false, error: `Invalid JSON: Question ${qNum} must have exactly 4 options.` };
      }

      // Empty option check
      for (let optIdx = 0; optIdx < 4; optIdx++) {
        const optVal = (optionsArr[optIdx] || '').toString().trim();
        if (!optVal) {
          return { valid: false, error: `Invalid JSON: Question ${qNum} has empty option text.` };
        }
        optionsArr[optIdx] = optVal;
      }

      // Correct Answer check
      const rawAns = q.correctAnswer !== undefined ? q.correctAnswer : q.answer;
      if (rawAns === undefined || rawAns === null || String(rawAns).trim() === '') {
        return { valid: false, error: `Invalid JSON: Question ${qNum} is missing a correctAnswer.` };
      }

      let correctIndex = -1;
      let correctAnswerLetter = '';
      const ansStr = String(rawAns).trim().toUpperCase();

      if (['A', 'B', 'C', 'D'].includes(ansStr)) {
        correctIndex = letterMap.indexOf(ansStr);
        correctAnswerLetter = ansStr;
      } else if (['0', '1', '2', '3'].includes(ansStr)) {
        correctIndex = parseInt(ansStr, 10);
        correctAnswerLetter = letterMap[correctIndex];
      } else if (['1', '2', '3', '4'].includes(ansStr)) {
        correctIndex = parseInt(ansStr, 10) - 1;
        correctAnswerLetter = letterMap[correctIndex];
      } else {
        const matchedIdx = optionsArr.findIndex(o => o.toLowerCase() === String(rawAns).trim().toLowerCase());
        if (matchedIdx !== -1) {
          correctIndex = matchedIdx;
          correctAnswerLetter = letterMap[matchedIdx];
        }
      }

      if (correctIndex < 0 || correctIndex > 3) {
        return { valid: false, error: `Invalid JSON: Question ${qNum} has an invalid correctAnswer.` };
      }

      questions.push({
        id: q.id || `q-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        question: text,
        text: text,
        options: optionsArr,
        correctAnswer: correctAnswerLetter,
        correctIndex: correctIndex,
        explanation: (q.explanation || '').toString().trim()
      });
    }

    return {
      valid: true,
      subject: parsedObj.subject || parsedObj.subjectName || null,
      academicYear: parsedObj.academicYear || parsedObj.year || null,
      section: parsedObj.section || null,
      questions: questions
    };
  }

  renderJsonPreview(jsonResult) {
    const previewWrap = document.getElementById('json-preview-wrap');
    const scrollList = document.getElementById('json-preview-scroll-list');
    const metaSub = document.getElementById('preview-meta-subject');
    const metaYear = document.getElementById('preview-meta-year');
    const metaSec = document.getElementById('preview-meta-sec');
    const metaCount = document.getElementById('preview-meta-count');
    const jsonEditor = document.getElementById('upload-json-code-editor');

    if (!jsonResult || !jsonResult.valid || !jsonResult.questions) return;

    // Get current UI selections or JSON fallbacks
    const subjectSelect = document.getElementById('pdf-upload-subject');
    let displaySubject = 'Subject';
    if (subjectSelect && subjectSelect.value && subjectSelect.value !== 'NEW') {
      const subObj = storage.getSubjects().find(s => s.id === subjectSelect.value);
      displaySubject = subObj ? subObj.name : (jsonResult.subject || 'Subject');
    } else {
      const nameInput = document.getElementById('pdf-new-subject-name');
      displaySubject = (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : (jsonResult.subject || 'New Subject');
    }

    const yearVal = document.getElementById('pdf-upload-year').value || jsonResult.academicYear || '1st Year';
    const secVal = document.getElementById('pdf-upload-sec').value || jsonResult.section || 'All Sections';

    if (metaSub) metaSub.textContent = displaySubject;
    if (metaYear) metaYear.textContent = yearVal;
    if (metaSec) metaSec.textContent = secVal === 'All' ? 'All Sections' : `Section ${secVal}`;
    if (metaCount) metaCount.textContent = `${jsonResult.questions.length} Questions`;
    const metaDur = document.getElementById('preview-meta-duration');
    const durInput = document.getElementById('pdf-upload-duration');
    if (metaDur) metaDur.textContent = `${(durInput && durInput.value) || 30} Mins`;

    const letters = ['A', 'B', 'C', 'D'];
    if (scrollList) {
      scrollList.innerHTML = jsonResult.questions.map((q, idx) => `
        <div class="json-preview-card" style="border-left: 3px solid var(--primary-500); padding: 1rem; margin-bottom: 0.85rem; background: rgba(15, 23, 42, 0.7); border-radius: 8px;">
          <div class="json-preview-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem; line-height: 1.5;">
              <span style="color: var(--primary-400); font-weight: 700; margin-right: 0.35rem;">Q${idx + 1}.</span> ${escapeHtml(q.question || q.text)}
            </div>
            <span class="badge badge-success" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; border-radius: 20px; white-space: nowrap;">
              ✓ Answer: ${q.correctAnswer || letters[q.correctIndex || 0]}
            </span>
          </div>
          <div class="json-preview-card-opts" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            ${(q.options || []).map((opt, oIdx) => {
              const isCorrect = q.correctIndex === oIdx;
              return `
                <div class="json-preview-opt ${isCorrect ? 'correct-opt' : ''}" 
                  onclick="adminDashboard.setPreviewCorrectAnswer(${idx}, ${oIdx})"
                  title="Click to set option ${letters[oIdx]} as correct answer"
                  style="cursor: pointer; padding: 0.5rem 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s ease;">
                  <span style="font-weight: 700; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; ${isCorrect ? 'background: #10b981; color: white;' : 'background: rgba(255,255,255,0.1); color: var(--text-muted);'}">
                    ${letters[oIdx]}
                  </span>
                  <span style="flex-grow: 1; font-size: 0.85rem;">${escapeHtml(opt)}</span>
                  ${isCorrect ? '<span style="color: #34d399; font-weight: bold; margin-left: auto;">✓</span>' : ''}
                </div>
              `;
            }).join('')}
          </div>
          ${q.explanation ? `<div class="json-preview-explanation" style="margin-top: 0.6rem; font-size: 0.8rem; color: var(--text-muted);"><strong style="color: var(--primary-300);">Explanation:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
        </div>
      `).join('');
    }

    // Also populate the JSON Code Editor
    if (jsonEditor) {
      const exportSchema = {
        subject: displaySubject,
        academicYear: yearVal,
        section: secVal,
        questions: jsonResult.questions.map(q => ({
          question: q.question || q.text,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation || ''
        }))
      };
      jsonEditor.value = JSON.stringify(exportSchema, null, 2);
    }

    if (previewWrap) previewWrap.style.display = 'block';
  }

  switchUploadTab(tabName) {
    const tabCards = document.getElementById('upload-tab-cards');
    const tabJson = document.getElementById('upload-tab-json');
    const tabRaw = document.getElementById('upload-tab-raw');

    const btnCards = document.getElementById('tab-btn-cards');
    const btnJson = document.getElementById('tab-btn-json');
    const btnRaw = document.getElementById('tab-btn-raw');

    [tabCards, tabJson, tabRaw].forEach(el => { if (el) el.style.display = 'none'; });
    [btnCards, btnJson, btnRaw].forEach(btn => {
      if (btn) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });

    if (tabName === 'cards' && tabCards) {
      tabCards.style.display = 'block';
      if (btnCards) { btnCards.classList.add('btn-primary'); btnCards.classList.remove('btn-secondary'); }
    } else if (tabName === 'json' && tabJson) {
      tabJson.style.display = 'block';
      if (btnJson) { btnJson.classList.add('btn-primary'); btnJson.classList.remove('btn-secondary'); }
    } else if (tabName === 'raw' && tabRaw) {
      tabRaw.style.display = 'block';
      if (btnRaw) { btnRaw.classList.add('btn-primary'); btnRaw.classList.remove('btn-secondary'); }
    }
  }

  setPreviewCorrectAnswer(qIndex, optIndex) {
    if (!this.parsedJsonResult || !this.parsedJsonResult.questions || !this.parsedJsonResult.questions[qIndex]) return;
    const letterMap = ['A', 'B', 'C', 'D'];
    this.parsedJsonResult.questions[qIndex].correctIndex = optIndex;
    this.parsedJsonResult.questions[qIndex].correctAnswer = letterMap[optIndex];
    this.renderJsonPreview(this.parsedJsonResult);
    ui.showToast(`Updated Question ${qIndex + 1} answer to Option ${letterMap[optIndex]}`, 'info');
  }

  copyPreviewJson() {
    const jsonEditor = document.getElementById('upload-json-code-editor');
    if (!jsonEditor || !jsonEditor.value.trim()) {
      ui.showToast("No JSON questions available to copy.", "warning");
      return;
    }
    navigator.clipboard.writeText(jsonEditor.value.trim()).then(() => {
      ui.showToast("Questions JSON copied to clipboard!", "success");
    }).catch(err => {
      ui.showToast("Failed to copy JSON: " + err.message, "error");
    });
  }

  downloadPreviewJson() {
    const jsonEditor = document.getElementById('upload-json-code-editor');
    if (!jsonEditor || !jsonEditor.value.trim()) {
      ui.showToast("No JSON questions available to download.", "warning");
      return;
    }
    const blob = new Blob([jsonEditor.value.trim()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const nameInput = document.getElementById('pdf-new-subject-name');
    const subName = (nameInput && nameInput.value.trim()) ? nameInput.value.trim().replace(/\s+/g, '_') : 'question_paper';
    a.href = url;
    a.download = `${subName}_questions.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ui.showToast("Questions JSON downloaded!", "success");
  }

  onJsonCodeEditorChange() {
    const jsonEditor = document.getElementById('upload-json-code-editor');
    if (!jsonEditor) return;
    const result = this.validateAndParseJson(jsonEditor.value);
    if (result.valid) {
      this.parsedJsonResult = result;
      this.hideValidationError();
      this.renderJsonPreview(result);
      ui.showToast(`Updated! ${result.questions.length} questions parsed.`, "success");
    } else {
      this.showValidationError(result.error);
    }
  }

  reparseExtractedText() {
    const txtArea = document.getElementById('pdf-extracted-text');
    if (!txtArea || !txtArea.value.trim()) {
      ui.showToast("Please enter or paste question paper text first.", "warning");
      return;
    }
    const subjectSelect = document.getElementById('pdf-upload-subject');
    const year = document.getElementById('pdf-upload-year').value;
    const sec = document.getElementById('pdf-upload-sec').value;
    const newNameEl = document.getElementById('pdf-new-subject-name');
    const subName = (newNameEl && newNameEl.value.trim()) ? newNameEl.value.trim() : 'Subject';

    const result = this.parseTextToQuestionsJson(txtArea.value, {
      name: subName,
      year: year,
      section: sec
    });

    if (result.valid && result.questions.length > 0) {
      this.parsedJsonResult = result;
      this.hideValidationError();
      this.renderJsonPreview(result);
      this.switchUploadTab('cards');
      ui.showToast(`Extracted ${result.questions.length} questions successfully!`, 'success');
    } else {
      this.showValidationError(result.error || "No valid questions detected from text.");
    }
  }

  async handlePdfFileSelect(e) {
    const file = e.target ? e.target.files[0] : null;
    if (!file) return;

    const nameEl = document.getElementById('pdf-file-name-text');
    const sizeEl = document.getElementById('pdf-file-size-text');
    const wrap = document.getElementById('pdf-file-preview-wrap');
    const txtArea = document.getElementById('pdf-extracted-text');

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = `(${(file.size / 1024).toFixed(1)} KB)`;
    if (wrap) wrap.style.display = 'block';

    this.hideValidationError();
    const fileName = file.name.toLowerCase();
    const isJson = fileName.endsWith('.json') || file.type === 'application/json';
    const isDocx = fileName.endsWith('.docx');
    const isDoc = fileName.endsWith('.doc');
    const isPdf = fileName.endsWith('.pdf') || file.type === 'application/pdf';

    if (isJson) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const content = evt.target.result;
        const result = this.validateAndParseJson(content);
        if (!result.valid) {
          this.parsedJsonResult = null;
          this.showValidationError(result.error);
          ui.showToast(result.error, 'error');
        } else {
          this.parsedJsonResult = result;
          this.hideValidationError();

          // Auto-populate Subject Name if JSON contains subject and field is empty
          if (result.subject) {
            const nameInput = document.getElementById('pdf-new-subject-name');
            if (nameInput && !nameInput.value.trim()) {
              nameInput.value = result.subject;
            }
          }
          if (result.academicYear) {
            const yearSelect = document.getElementById('pdf-upload-year');
            if (yearSelect) yearSelect.value = result.academicYear;
          }
          if (result.section) {
            const secSelect = document.getElementById('pdf-upload-sec');
            if (secSelect) secSelect.value = result.section;
          }

          this.renderJsonPreview(result);
          this.switchUploadTab('cards');
          ui.showToast(`Valid JSON: ${result.questions.length} questions detected!`, 'success');
        }
      };
      reader.readAsText(file);
    } else if (isDocx) {
      if (txtArea) txtArea.value = "Extracting clean text from Word Document (.docx)...";
      try {
        const extractedText = await this.extractDocxText(file);
        if (txtArea) txtArea.value = extractedText;

        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error("Could not extract readable text from this Word document.");
        }

        const year = document.getElementById('pdf-upload-year').value;
        const sec = document.getElementById('pdf-upload-sec').value;
        const nameInput = document.getElementById('pdf-new-subject-name');
        const defaultSubName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const result = this.parseTextToQuestionsJson(extractedText, {
          name: (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : defaultSubName,
          year: year,
          section: sec
        });

        if (result.valid && result.questions.length > 0) {
          this.parsedJsonResult = result;
          if (nameInput && !nameInput.value.trim()) nameInput.value = defaultSubName;
          this.hideValidationError();
          this.renderJsonPreview(result);
          this.switchUploadTab('cards');
          ui.showToast(`Word Document parsed: ${result.questions.length} questions converted to JSON!`, 'success');
        } else {
          this.showValidationError("Could not format questions from Word document. Please review the text in 'Raw Text Editor' tab.");
          this.switchUploadTab('raw');
        }
      } catch (err) {
        console.error("DOCX error:", err);
        if (txtArea) txtArea.value = `Word Document loaded. Error extracting text: ${err.message}`;
        this.showValidationError(`Error reading Word document: ${err.message}`);
      }
    } else if (isPdf) {
      if (txtArea) txtArea.value = "Extracting text from PDF...";
      try {
        const extractedText = await this.extractPdfText(file);
        if (txtArea) txtArea.value = extractedText;

        if (!extractedText || extractedText.trim().length < 10) {
          throw new Error("Could not extract selectable text from this PDF (it might be scanned images).");
        }

        const year = document.getElementById('pdf-upload-year').value;
        const sec = document.getElementById('pdf-upload-sec').value;
        const nameInput = document.getElementById('pdf-new-subject-name');
        const defaultSubName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const result = this.parseTextToQuestionsJson(extractedText, {
          name: (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : defaultSubName,
          year: year,
          section: sec
        });

        if (result.valid && result.questions.length > 0) {
          this.parsedJsonResult = result;
          if (nameInput && !nameInput.value.trim()) nameInput.value = defaultSubName;
          this.hideValidationError();
          this.renderJsonPreview(result);
          this.switchUploadTab('cards');
          ui.showToast(`PDF parsed: ${result.questions.length} questions converted to JSON!`, 'success');
        } else {
          this.showValidationError("Could not format questions from PDF. Please review the extracted text in 'Raw Text Editor' tab.");
          this.switchUploadTab('raw');
        }
      } catch (err) {
        console.error("PDF extraction error:", err);
        if (txtArea) txtArea.value = `PDF loaded. ${err.message}. You can paste question text directly.`;
        this.showValidationError(`${err.message} Please paste text in the 'Raw Text Editor' tab.`);
        this.switchUploadTab('raw');
      }
    } else {
      // DOC binary or Text file fallback
      const reader = new FileReader();
      reader.onload = (evt) => {
        let content = evt.target.result;
        // If legacy .doc, strip non-printable characters cleanly
        if (isDoc) {
          content = content.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();
        }
        if (txtArea) txtArea.value = content;

        const year = document.getElementById('pdf-upload-year').value;
        const sec = document.getElementById('pdf-upload-sec').value;
        const nameInput = document.getElementById('pdf-new-subject-name');
        const defaultSubName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const result = this.parseTextToQuestionsJson(content, {
          name: (nameInput && nameInput.value.trim()) ? nameInput.value.trim() : defaultSubName,
          year: year,
          section: sec
        });

        if (result.valid && result.questions.length > 0) {
          this.parsedJsonResult = result;
          if (nameInput && !nameInput.value.trim()) nameInput.value = defaultSubName;
          this.hideValidationError();
          this.renderJsonPreview(result);
          this.switchUploadTab('cards');
          ui.showToast(`File parsed: ${result.questions.length} questions converted to JSON!`, 'success');
        } else {
          this.showValidationError("Could not detect questions. Please check the text in 'Raw Text Editor' tab.");
          this.switchUploadTab('raw');
        }
      };
      reader.readAsText(file);
    }
  }

  async extractDocxText(file) {
    const arrayBuffer = await file.arrayBuffer();
    if (typeof mammoth !== 'undefined' && mammoth.extractRawText) {
      try {
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        if (result && result.value && result.value.trim()) {
          return result.value.trim();
        }
      } catch (err) {
        console.warn("Mammoth extraction error:", err);
      }
    }
    throw new Error("Mammoth DOCX parser is not available or file is not a valid DOCX.");
  }

  async extractPdfText(file) {
    const arrayBuffer = await file.arrayBuffer();

    if (typeof pdfjsLib !== 'undefined') {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
        const pdf = await loadingTask.promise;
        let pagesText = [];

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Sort items: primarily Y descending (top to bottom), secondarily X ascending (left to right)
          const items = [...textContent.items].filter(it => it.str && it.str.trim().length > 0);
          items.sort((a, b) => {
            const yA = a.transform ? a.transform[5] : 0;
            const yB = b.transform ? b.transform[5] : 0;
            if (Math.abs(yA - yB) > 5) {
              return yB - yA; // top to bottom
            }
            const xA = a.transform ? a.transform[4] : 0;
            const xB = b.transform ? b.transform[4] : 0;
            return xA - xB; // left to right
          });

          let pageLines = [];
          let currentLine = '';
          let lastY = null;

          items.forEach(item => {
            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(lastY - y) > 5) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = item.str.trim();
            } else {
              currentLine += (currentLine ? ' ' : '') + item.str.trim();
            }
            if (y !== null) lastY = y;
          });
          if (currentLine.trim()) pageLines.push(currentLine.trim());

          if (pageLines.length > 0) {
            pagesText.push(pageLines.join('\n'));
          }
        }

        if (pagesText.length > 0) {
          return pagesText.join('\n\n');
        }
      } catch (pdfErr) {
        console.warn("pdfjsLib parsing error:", pdfErr);
      }
    }

    // Do NOT fall back to reading raw binary bytes as ASCII.
    // That produced the garbage metadata in the PDF!
    return "";
  }

  parseTextToQuestionsJson(rawText, subjectMeta = {}) {
    if (!rawText || !rawText.trim()) {
      return { valid: false, error: "Document text is empty." };
    }

    // Filter out common binary artifacts, HTML/XML tags, or canvas objects
    const sanitizedText = rawText
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/<[^>]+>/g, ' ') // Strip raw HTML/XML tags
      .replace(/Page \d+ of \d+/gi, '') // Strip page numbers
      .replace(/CONFIDENTIAL/gi, '')
      .split('\n')
      .filter(line => {
        const l = line.trim();
        if (!l) return false;
        // Strip canvas / fabric / vector metadata lines
        if (
          l.includes('shadowOffsetX') ||
          l.includes('shadowOffsetY') ||
          l.includes('showInExport') ||
          l.includes('draggable') ||
          l.includes('resizable') ||
          l.includes('contentEditable') ||
          l.includes('styleEditable') ||
          l.includes('selectable')
        ) return false;
        return true;
      })
      .join('\n');

    // 1. Global Answer Key Check at the bottom (e.g. Answer Key: 1. A, 2. B, 3. C)
    const globalAnsMap = {};
    const ansKeyMatch = sanitizedText.match(/(?:Answer\s*Key|Answers|Keys|Ans\s*Key)[\:\s\n\-]+([\s\S]+)$/i);
    if (ansKeyMatch) {
      const keyBlock = ansKeyMatch[1];
      const keyPairs = [...keyBlock.matchAll(/(?:Q(?:uestion)?\s*|\b)(\d+)[\.\:\-\)\s]+([A-D1-4])\b/gi)];
      keyPairs.forEach(m => {
        const qNum = parseInt(m[1], 10);
        const ansChar = m[2].toUpperCase();
        const idx = ['A', 'B', 'C', 'D'].includes(ansChar)
          ? ['A', 'B', 'C', 'D'].indexOf(ansChar)
          : parseInt(ansChar, 10) - 1;
        if (qNum > 0 && idx >= 0 && idx < 4) {
          globalAnsMap[qNum] = idx;
        }
      });
    }

    // Split text into question blocks based on question headers
    // Matches: "1. ", "1) ", "Q1. ", "Question 1: ", "Question 1. "
    const blocks = sanitizedText.split(/(?=(?:^|\n)\s*(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)]))\s*/gi)
      .map(b => b.trim())
      .filter(b => b.length > 5);

    const questions = [];
    const letterMap = ['A', 'B', 'C', 'D'];
    let qCounter = 0;

    blocks.forEach(block => {
      qCounter++;
      const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      let questionStatement = '';
      const rawOptions = [];
      let correctIdx = null;
      let explanation = '';

      lines.forEach(line => {
        // Embedded answer detection e.g. [Ans: A] or (Answer: B)
        const embeddedAns = line.match(/[\(\[]?\b(?:Answer|Ans|Correct|Correct\s*Answer)[\.\:\-]?\s*([A-D1-4])[\)\]]?/i);
        if (embeddedAns) {
          const val = embeddedAns[1].toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(val)) {
            correctIdx = ['A', 'B', 'C', 'D'].indexOf(val);
          } else if (['1', '2', '3', '4'].includes(val)) {
            correctIdx = parseInt(val, 10) - 1;
          }
          line = line.replace(/[\(\[]?\b(?:Answer|Ans|Correct|Correct\s*Answer)[\.\:\-]?\s*([A-D1-4])[\)\]]?/gi, '').trim();
          if (!line) return;
        }

        // Line starting with Answer:
        const ansMatch = line.match(/^(?:Answer|Ans|Correct|Correct\s*Answer|Ans\s*Key)[\.\:\-]?\s*(?:Option\s*)?([A-D1-4])/i);
        if (ansMatch) {
          const val = ansMatch[1].toUpperCase();
          if (['A', 'B', 'C', 'D'].includes(val)) {
            correctIdx = ['A', 'B', 'C', 'D'].indexOf(val);
          } else if (['1', '2', '3', '4'].includes(val)) {
            correctIdx = parseInt(val, 10) - 1;
          }
          return;
        }

        // Explanation line
        if (line.toLowerCase().startsWith('explanation:') || line.toLowerCase().startsWith('note:')) {
          explanation = line.replace(/^(?:explanation|note):\s*/i, '').trim();
          return;
        }

        // Inline options on single line: e.g. "(A) Apple  (B) Banana  (C) Cherry  (D) Date"
        const inlineOpts = [...line.matchAll(/(?:[\(\[]?([A-Da-d])[\)\]\.\:]\s*|\(([1-4])\)\s*)([^\(\[\nA-Da-d]+)/g)];
        if (inlineOpts.length >= 2) {
          inlineOpts.forEach(m => {
            const optText = (m[3] || m[2] || '').trim();
            if (optText.length > 0) rawOptions.push(optText);
          });
          return;
        }

        // Option prefix on separate line: e.g. "A. Option Text", "A) Option Text", "(A) Option Text", "a) Option Text" or "(1) Option Text"
        // Note: Do NOT match numbers with periods like "1. " because that's a question number!
        const optLineMatch = line.match(/^(?:[\(\[]?([A-Da-d])[\)\]\.\:]\s*|\(([1-4])\)\s*)(.+)/);
        if (optLineMatch) {
          const optText = (optLineMatch[3] || optLineMatch[2] || '').trim();
          if (optText.length > 0) {
            rawOptions.push(optText);
          }
          return;
        }

        // If not option or answer line, treat as question text
        if (rawOptions.length === 0) {
          questionStatement += (questionStatement ? ' ' : '') + line;
        }
      });

      // Strip Question header (e.g. "Q1. ", "Question 1: ", "1) ")
      questionStatement = questionStatement.replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, '').trim();

      // Clean options text: strip any leading letters like "A. ", "A) ", "(A) "
      const cleanOptions = rawOptions
        .map(o => String(o).replace(/^(?:[\(\[]?[A-Da-d][\)\]\.:\s-]\s*|\([1-4]\)\s*)/, '').trim())
        .filter(o => o.length > 0);

      // Validate question statement & options
      if (!questionStatement || questionStatement.length < 3) return;
      if (cleanOptions.length < 2) return;

      // Ensure 4 options (standard MCQ format)
      while (cleanOptions.length < 4) {
        cleanOptions.push(`Option ${letterMap[cleanOptions.length]}`);
      }
      const finalOptions = cleanOptions.slice(0, 4);

      // Assign correct answer
      if (correctIdx === null && globalAnsMap.hasOwnProperty(qCounter)) {
        correctIdx = globalAnsMap[qCounter];
      }
      if (correctIdx === null || correctIdx < 0 || correctIdx > 3) {
        correctIdx = 0; // Default to Option A
      }

      questions.push({
        id: `q-${Date.now()}-${questions.length + 1}-${Math.random().toString(36).substr(2, 5)}`,
        question: questionStatement,
        text: questionStatement,
        options: finalOptions,
        correctAnswer: letterMap[correctIdx],
        correctIndex: correctIdx,
        explanation: explanation || 'Imported directly from Question Paper document.'
      });
    });

    if (questions.length === 0) {
      return { valid: false, error: "No valid MCQs could be parsed. Please check question numbers (1., 2.) and option labels (A., B., C., D.)." };
    }

    return {
      valid: true,
      subject: subjectMeta.name || null,
      academicYear: subjectMeta.year || '1st Year',
      section: subjectMeta.section || 'All',
      questions: questions
    };
  }

  processPdfUploadSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('pdf-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span class="btn-spinner"></span> Importing Questions...`;
    }

    setTimeout(() => {
      try {
        const subjectSelect = document.getElementById('pdf-upload-subject');
        const subjectId = subjectSelect ? subjectSelect.value : 'NEW';
        const year = document.getElementById('pdf-upload-year').value;
        const section = document.getElementById('pdf-upload-sec').value;
        const replaceExistingEl = document.getElementById('pdf-upload-replace-existing');
        const replaceExisting = replaceExistingEl ? replaceExistingEl.checked : true;
        const durationInput = document.getElementById('pdf-upload-duration');
        const durationMinutes = durationInput ? (parseInt(durationInput.value, 10) || 30) : 30;

        let targetSubjectId = subjectId;
        let subjectName = 'Subject';

        if (subjectId === 'NEW' || !subjectId) {
          const newNameEl = document.getElementById('pdf-new-subject-name');
          const newCodeEl = document.getElementById('pdf-new-subject-code');
          const newName = newNameEl ? newNameEl.value.trim() : '';
          const newCode = (newCodeEl && newCodeEl.value.trim()) ? newCodeEl.value.trim() : 'SUB' + Math.floor(100 + Math.random() * 900);

          if (!newName) {
            ui.showToast('Please enter a Subject Name for the question paper.', 'error');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `Import Questions`;
            }
            return;
          }

          const createdSub = storage.addSubject({
            name: newName,
            code: newCode,
            year: year,
            section: section,
            description: 'Imported via Question Paper Upload',
            duration: durationMinutes
          });
          targetSubjectId = createdSub.id;
          subjectName = createdSub.name;
        } else {
          const subject = storage.getSubjects().find(s => s.id === subjectId);
          if (subject) {
            subjectName = subject.name;
          }
          storage.updateSubject(subjectId, { year: year, section: section, duration: durationMinutes });
        }

        let questionsToImport = [];

        if (this.parsedJsonResult && this.parsedJsonResult.valid && this.parsedJsonResult.questions) {
          questionsToImport = this.parsedJsonResult.questions;
        } else {
          const textContent = document.getElementById('pdf-extracted-text') ? document.getElementById('pdf-extracted-text').value.trim() : '';
          if (textContent) {
            const parseRes = this.parseTextToQuestionsJson(textContent, {
              name: subjectName,
              year: year,
              section: section
            });
            if (parseRes.valid) {
              questionsToImport = parseRes.questions;
            }
          }
        }

        if (!questionsToImport || questionsToImport.length === 0) {
          ui.showToast('No valid questions to import. Please select a valid Word, PDF, or JSON file.', 'warning');
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Import Questions`;
          }
          return;
        }

        // Save imported questions using storage service
        const importedList = storage.importJsonQuestions(questionsToImport, {
          subjectId: targetSubjectId,
          name: subjectName,
          year: year,
          section: section
        }, replaceExisting);

        ui.showToast(`${importedList.length} questions imported successfully into ${escapeHtml(subjectName)}!`, 'success');
        ui.hideModal('modal-pdf-upload');

        // Reset submit button state
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Import Questions`;
        }

        // Automatically refresh Question table and Student Dashboard
        this.renderActivePanel();
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      } catch (err) {
        console.error("Import error:", err);
        ui.showToast(`Import failed: ${err.message}`, 'error');
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `Import Questions`;
        }
      }
    }, 400);
  }

  handleQuestionPdfAttachment(e) {
    const file = e.target.files[0];
    const previewWrap = document.getElementById('modal-q-pdf-preview');
    const nameEl = document.getElementById('modal-q-pdf-name');

    if (!file) {
      this.currentQuestionPdfData = null;
      if (previewWrap) previewWrap.style.display = 'none';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      this.currentQuestionPdfData = {
        name: file.name,
        url: evt.target.result
      };
      if (nameEl) nameEl.textContent = `📄 ${file.name}`;
      if (previewWrap) previewWrap.style.display = 'block';
    };
    reader.readAsDataURL(file);
  }

  getStarterTemplateForLang(lang) {
    switch (lang) {
      case 'javascript':
        return `// JavaScript (Node.js) Solution\nfunction solution() {\n    // Write your code here\n    console.log("Hello, World!");\n}\n\nsolution();`;
      case 'c':
        return `#include <stdio.h>\n\nint main() {\n    // Write your C code here\n    printf("Hello, World!\\n");\n    return 0;\n}`;
      case 'cpp':
        return `#include <iostream>\nusing namespace std;\n\nint main() {\n    // Write your C++ code here\n    cout << "Hello, World!" << endl;\n    return 0;\n}`;
      case 'java':
        return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        // Write your Java code here\n        System.out.println("Hello, World!");\n    }\n}`;
      case 'python':
      default:
        return `# Python 3 Solution\ndef solution():\n    # Read input if required:\n    # num = input()\n    print("Hello, World!")\n\nif __name__ == '__main__':\n    solution()`;
    }
  }

  onQuestionTypeChange() {
    const qTypeEl = document.getElementById('modal-q-type');
    const qType = qTypeEl ? qTypeEl.value : 'mcq';
    const mcqFields = document.getElementById('modal-q-mcq-fields');
    const codingFields = document.getElementById('modal-q-coding-fields');
    const titleEl = document.getElementById('question-modal-title');
    const idField = document.getElementById('question-id-field');
    const isEdit = idField && idField.value;

    if (qType === 'coding') {
      if (mcqFields) mcqFields.style.display = 'none';
      if (codingFields) codingFields.style.display = 'block';
      if (titleEl) titleEl.textContent = isEdit ? 'Edit Coding Question' : 'Add Coding Question';
      const starterCodeEl = document.getElementById('modal-q-starter-code');
      if (starterCodeEl && !starterCodeEl.value.trim()) {
        const langEl = document.getElementById('modal-q-language');
        const lang = langEl ? langEl.value : 'python';
        starterCodeEl.value = this.getStarterTemplateForLang(lang);
      }
    } else {
      if (mcqFields) mcqFields.style.display = 'block';
      if (codingFields) codingFields.style.display = 'none';
      if (titleEl) titleEl.textContent = isEdit ? 'Edit MCQ Question' : 'Add MCQ Question';
    }
  }

  onAdminLanguageChange() {
    const langEl = document.getElementById('modal-q-language');
    const lang = langEl ? langEl.value : 'python';
    const starterEl = document.getElementById('modal-q-starter-code');
    if (starterEl && (!starterEl.value.trim() || starterEl.value.includes('Solution'))) {
      starterEl.value = this.getStarterTemplateForLang(lang);
    }
  }

  fillStarterCodeTemplate() {
    const langEl = document.getElementById('modal-q-language');
    const lang = langEl ? langEl.value : 'python';
    const starterEl = document.getElementById('modal-q-starter-code');
    if (starterEl) {
      starterEl.value = this.getStarterTemplateForLang(lang);
      ui.showToast(`Loaded ${lang.toUpperCase()} starter template.`, 'info');
    }
  }

  autoGenerateAntiCheatTestCases() {
    const textEl = document.getElementById('modal-q-text');
    const qText = textEl ? textEl.value.trim().toLowerCase() : '';
    const in1El = document.getElementById('modal-q-sample-input');
    const out1El = document.getElementById('modal-q-expected-output');
    const in2El = document.getElementById('modal-q-input2');
    const out2El = document.getElementById('modal-q-output2');

    let in1 = in1El ? in1El.value.trim() : '';
    let out1 = out1El ? out1El.value.trim() : '';

    if (!qText && !out1) {
      ui.showToast('Please type the question text or problem statement first.', 'warning');
      return;
    }

    // 1. Palindrome Problem
    if (qText.includes('palindrome') || /palindrome/i.test(out1)) {
      if (!in1) in1 = '121';
      if (!out1) out1 = 'Palindrome';
      if (in1El) in1El.value = in1;
      if (out1El) out1El.value = out1;
      if (in2El) in2El.value = (in1 === '121' ? '123' : (in1 === 'madam' ? 'hello' : '1234'));
      if (out2El) out2El.value = 'Not Palindrome';
    }
    // 2. Prime Number Problem
    else if (qText.includes('prime') || /prime/i.test(out1)) {
      if (!in1) in1 = '5';
      if (!out1) out1 = 'Prime';
      if (in1El) in1El.value = in1;
      if (out1El) out1El.value = out1;
      if (in2El) in2El.value = (in1 === '5' || in1 === '7') ? '4' : '6';
      if (out2El) out2El.value = 'Not Prime';
    }
    // 3. Even or Odd Problem
    else if (qText.includes('even') || qText.includes('odd') || /even|odd/i.test(out1)) {
      if (!in1) in1 = '4';
      if (!out1) out1 = 'Even';
      if (in1El) in1El.value = in1;
      if (out1El) out1El.value = out1;
      if (in2El) in2El.value = '7';
      if (out2El) out2El.value = 'Odd';
    }
    // 4. Factorial Problem
    else if (qText.includes('factorial')) {
      if (!in1) in1 = '5';
      if (!out1) out1 = '120';
      if (in1El) in1El.value = in1;
      if (out1El) out1El.value = out1;
      if (in2El) in2El.value = '4';
      if (out2El) out2El.value = '24';
    }
    // 5. String Reverse Problem
    else if (qText.includes('reverse')) {
      if (!in1) in1 = 'hello';
      if (!out1) out1 = 'olleh';
      if (in1El) in1El.value = in1;
      if (out1El) out1El.value = out1;
      if (in2El) in2El.value = 'world';
      if (out2El) out2El.value = 'dlrow';
    }
    // 6. Generic Boolean / Yes-No
    else if (/^true$/i.test(out1) || /^yes$/i.test(out1)) {
      const isYes = /^yes$/i.test(out1);
      if (in2El) in2El.value = in1 && !isNaN(in1) ? String(parseInt(in1, 10) + 1) : '0';
      if (out2El) out2El.value = isYes ? 'No' : 'False';
    }
    // 7. General Arithmetic / Fallback
    else if (in1 && !isNaN(in1)) {
      const num1 = parseInt(in1, 10);
      if (in2El && !in2El.value.trim()) in2El.value = String(num1 + 2);
      if (out2El && !out2El.value.trim()) out2El.value = out1 ? (parseInt(out1, 10) ? String(parseInt(out1, 10) + 2) : out1 + ' (Test 2)') : 'Output 2';
    } else {
      if (!in1 && in1El) in1El.value = '5';
      if (!out1 && out1El) out1El.value = 'Result 1';
      if (in2El && !in2El.value.trim()) in2El.value = '10';
      if (out2El && !out2El.value.trim()) out2El.value = 'Result 2';
    }

    ui.showToast('⚡ Generated Anti-Cheat Test Cases (Primary + Negative Edge Cases)!', 'success');
  }

  toggleSubjectInputMode(forceMode = null) {
    const selectWrap = document.getElementById('modal-q-subject-select-wrap');
    const typeWrap = document.getElementById('modal-q-subject-type-wrap');
    const textSpan = document.getElementById('toggle-custom-subject-text');
    const iconSpan = document.getElementById('toggle-custom-subject-icon');
    const customInput = document.getElementById('modal-q-custom-subject-input');
    const selectEl = document.getElementById('modal-q-subject');

    if (!selectWrap || !typeWrap) return;

    let isTyping = typeWrap.style.display !== 'none';
    if (forceMode === 'type') isTyping = false;
    if (forceMode === 'select') isTyping = true;

    if (isTyping) {
      typeWrap.style.display = 'none';
      selectWrap.style.display = 'block';
      if (textSpan) textSpan.textContent = 'Type Custom Subject';
      if (iconSpan) iconSpan.textContent = '✏️';
      if (selectEl && selectEl.value === '__CUSTOM__') {
        const firstValid = Array.from(selectEl.options).find(o => o.value && o.value !== '__CUSTOM__');
        if (firstValid) selectEl.value = firstValid.value;
      }
    } else {
      typeWrap.style.display = 'flex';
      selectWrap.style.display = 'none';
      if (textSpan) textSpan.textContent = 'Choose from List';
      if (iconSpan) iconSpan.textContent = '📋';
      if (customInput) {
        setTimeout(() => customInput.focus(), 60);
      }
    }
  }

  isCustomSubjectInputMode() {
    const typeWrap = document.getElementById('modal-q-subject-type-wrap');
    return typeWrap && typeWrap.style.display !== 'none';
  }

  onSubjectSelectChange() {
    const select = document.getElementById('modal-q-subject');
    if (select && select.value === '__CUSTOM__') {
      this.toggleSubjectInputMode('type');
    }
  }

  openAddQuestionModal() {
    this.populateQuestionSubjectDropdown();
    this.toggleSubjectInputMode('select');
    const customInput = document.getElementById('modal-q-custom-subject-input');
    if (customInput) customInput.value = '';

    this.currentQuestionPdfData = null;
    const previewWrap = document.getElementById('modal-q-pdf-preview');
    if (previewWrap) previewWrap.style.display = 'none';
    document.getElementById('question-modal-title').textContent = 'Add Question';
    document.getElementById('question-id-field').value = '';
    document.getElementById('modal-q-chapter').value = 'General';
    document.getElementById('modal-q-text').value = '';
    document.getElementById('modal-q-op1').value = '';
    document.getElementById('modal-q-op2').value = '';
    document.getElementById('modal-q-op3').value = '';
    document.getElementById('modal-q-op4').value = '';
    document.getElementById('modal-q-correct').value = '0';
    document.getElementById('modal-q-explanation').value = '';

    const typeSelect = document.getElementById('modal-q-type');
    if (typeSelect) typeSelect.value = 'mcq';
    const langSelect = document.getElementById('modal-q-language');
    if (langSelect) langSelect.value = 'python';
    const marksEl = document.getElementById('modal-q-marks');
    if (marksEl) marksEl.value = '10';
    const starterEl = document.getElementById('modal-q-starter-code');
    if (starterEl) starterEl.value = '';
    const sampleInputEl = document.getElementById('modal-q-sample-input');
    if (sampleInputEl) sampleInputEl.value = '';
    const expOutputEl = document.getElementById('modal-q-expected-output');
    if (expOutputEl) expOutputEl.value = '';
    const input2El = document.getElementById('modal-q-input2');
    if (input2El) input2El.value = '';
    const output2El = document.getElementById('modal-q-output2');
    if (output2El) output2El.value = '';

    this.onQuestionTypeChange();
    ui.showModal('modal-question-form');
  }

  openEditQuestionModal(id) {
    this.populateQuestionSubjectDropdown();
    this.toggleSubjectInputMode('select');
    const customInput = document.getElementById('modal-q-custom-subject-input');
    if (customInput) customInput.value = '';

    const q = storage.getQuestions().find(item => item.id === id);
    if (!q) return;

    if (!this.isSuperAdmin()) {
      const mySubIds = this.getAdminSubjectIds();
      const qCreator = (q.createdBy || '').trim().toLowerCase();
      const belongs = (qCreator && qCreator === this.getCurrentAdminUsername()) ||
                      (q.subjectId && mySubIds.includes(String(q.subjectId).toLowerCase()));
      if (!belongs) {
        ui.showToast('You are not authorized to edit questions belonging to another admin.', 'error');
        return;
      }
    }

    if (q.pdfFileName && q.pdfFileUrl) {
      this.currentQuestionPdfData = { name: q.pdfFileName, url: q.pdfFileUrl };
      const previewWrap = document.getElementById('modal-q-pdf-preview');
      const nameEl = document.getElementById('modal-q-pdf-name');
      if (nameEl) nameEl.textContent = `📄 ${q.pdfFileName}`;
      if (previewWrap) previewWrap.style.display = 'block';
    } else {
      this.currentQuestionPdfData = null;
      const previewWrap = document.getElementById('modal-q-pdf-preview');
      if (previewWrap) previewWrap.style.display = 'none';
    }

    document.getElementById('question-modal-title').textContent = q.type === 'coding' ? 'Edit Coding Question' : 'Edit Question';
    document.getElementById('question-id-field').value = q.id;
    document.getElementById('modal-q-subject').value = q.subjectId;
    document.getElementById('modal-q-chapter').value = q.chapter || 'General';
    document.getElementById('modal-q-text').value = this.cleanQuestionText(q.text || q.question);
    document.getElementById('modal-q-explanation').value = q.explanation || '';

    const typeSelect = document.getElementById('modal-q-type');
    if (typeSelect) typeSelect.value = q.type === 'coding' ? 'coding' : 'mcq';

    if (q.type === 'coding') {
      const langSelect = document.getElementById('modal-q-language');
      if (langSelect) langSelect.value = q.language || 'python';
      const marksEl = document.getElementById('modal-q-marks');
      if (marksEl) marksEl.value = (q.marks !== undefined ? q.marks : 10).toString();
      const durationEl = document.getElementById('modal-q-duration');
      if (durationEl) durationEl.value = (q.duration || (subject && subject.duration) || 30).toString();
      const starterEl = document.getElementById('modal-q-starter-code');
      if (starterEl) starterEl.value = q.starterCode || '';
      const sampleInputEl = document.getElementById('modal-q-sample-input');
      if (sampleInputEl) sampleInputEl.value = q.sampleInput || '';
      const expOutputEl = document.getElementById('modal-q-expected-output');
      if (expOutputEl) expOutputEl.value = q.expectedOutput || '';
      const input2El = document.getElementById('modal-q-input2');
      if (input2El) input2El.value = q.input2 || '';
      const output2El = document.getElementById('modal-q-output2');
      if (output2El) output2El.value = q.output2 || '';
    } else {
      const currentOpts = Array.isArray(q.options) && q.options.length > 0 ? q.options : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);
      document.getElementById('modal-q-op1').value = currentOpts[0] || '';
      document.getElementById('modal-q-op2').value = currentOpts[1] || '';
      document.getElementById('modal-q-op3').value = currentOpts[2] || '';
      document.getElementById('modal-q-op4').value = currentOpts[3] || '';
      document.getElementById('modal-q-correct').value = (q.correctIndex !== undefined ? q.correctIndex : 0).toString();
    }

    this.onQuestionTypeChange();
    ui.showModal('modal-question-form');
  }

  saveQuestionSubmit(e) {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    try {
      const idField = document.getElementById('question-id-field');
      const id = idField ? idField.value : '';

      const isCustomSubjectMode = this.isCustomSubjectInputMode();
      const customSubjectInput = document.getElementById('modal-q-custom-subject-input');
      const customSubjectName = customSubjectInput ? customSubjectInput.value.trim() : '';
      const subjectSelect = document.getElementById('modal-q-subject');
      let subjectId = subjectSelect ? subjectSelect.value : '';
      let subject = null;

      const allSubs = storage.getSubjects() || [];

      if (isCustomSubjectMode || subjectId === '__CUSTOM__' || (!subjectId && customSubjectName)) {
        if (!customSubjectName) {
          ui.showToast('Please type the subject name.', 'warning');
          if (customSubjectInput) customSubjectInput.focus();
          return false;
        }

        // Check if subject already exists with same name (case-insensitive)
        const existing = allSubs.find(s => s.name && s.name.trim().toLowerCase() === customSubjectName.toLowerCase());
        if (existing) {
          subject = existing;
          subjectId = existing.id;
        } else {
          // Automatically create and register the new typed subject
          const customYear = (document.getElementById('modal-q-custom-subject-year') && document.getElementById('modal-q-custom-subject-year').value) || '1st Year';
          const customSec = (document.getElementById('modal-q-custom-subject-sec') && document.getElementById('modal-q-custom-subject-sec').value) || 'All';
          const autoCode = customSubjectName.replace(/[^A-Za-z0-9]/g, '').substring(0, 5).toUpperCase() || 'CS101';

          subject = storage.addSubject({
            name: customSubjectName,
            code: autoCode,
            year: customYear,
            section: customSec,
            duration: 30,
            maxWarnings: 3
          });
          subjectId = subject ? subject.id : `sub-${Date.now()}`;
          ui.showToast(`Registered new subject: "${customSubjectName}"`, 'success');
        }
      } else {
        subject = allSubs.find(s => s.id === subjectId || (s.name && s.name.toLowerCase() === (subjectId || '').toLowerCase()));
        if (!subject && subjectId) {
          subject = storage.addSubject({
            name: subjectId,
            code: subjectId.substring(0, 5).toUpperCase(),
            year: '1st Year',
            section: 'All',
            duration: 30,
            maxWarnings: 3
          });
          subjectId = subject ? subject.id : subjectId;
        }
      }

      const year = subject ? (subject.year || '1st Year') : '1st Year';
      const section = subject ? (subject.section || 'All') : 'All';
      const chapter = (document.getElementById('modal-q-chapter') && document.getElementById('modal-q-chapter').value.trim()) || 'General';
      const text = (document.getElementById('modal-q-text') && document.getElementById('modal-q-text').value.trim()) || '';
      const explanation = (document.getElementById('modal-q-explanation') && document.getElementById('modal-q-explanation').value.trim()) || '';
      const qTypeEl = document.getElementById('modal-q-type');
      let qType = qTypeEl ? qTypeEl.value : 'mcq';

      const starterCode = document.getElementById('modal-q-starter-code') ? document.getElementById('modal-q-starter-code').value : '';
      const sampleInput = document.getElementById('modal-q-sample-input') ? document.getElementById('modal-q-sample-input').value : '';
      const expEl = document.getElementById('modal-q-expected-output');
      let expectedOutput = expEl ? expEl.value.trim() : '';
      const op1 = document.getElementById('modal-q-op1') ? document.getElementById('modal-q-op1').value.trim() : '';

      // Auto-detect coding question if starter code or expected output is present, or if MCQ options are missing
      if (qType === 'mcq' && !op1 && (expectedOutput || starterCode || sampleInput || this.currentQuestionPdfData)) {
        qType = 'coding';
        if (qTypeEl) qTypeEl.value = 'coding';
      }

      if (!text) {
        ui.showToast('Please enter the question description or problem statement.', 'error');
        const tEl = document.getElementById('modal-q-text');
        if (tEl) tEl.focus();
        return false;
      }

      const durationEl = document.getElementById('modal-q-duration');
      const duration = durationEl ? parseInt(durationEl.value, 10) || 30 : 30;

      let payload = {
        year,
        section,
        subjectId: subjectId || (subject ? subject.id : 'sub-default'),
        chapter: chapter || 'General',
        text,
        type: qType,
        explanation,
        duration,
        subjectName: subject ? subject.name : (customSubjectName || 'Subject'),
        pdfFileName: this.currentQuestionPdfData ? this.currentQuestionPdfData.name : null,
        pdfFileUrl: this.currentQuestionPdfData ? this.currentQuestionPdfData.url : null
      };

      // Update subject duration in storage safely
      if (subject) {
        try {
          subject.duration = duration;
          storage.updateSubject(subject.id, { duration });
        } catch (e) {}
      }

      if (qType === 'coding') {
        const langEl = document.getElementById('modal-q-language');
        const language = langEl ? langEl.value : 'python';
        const marksEl = document.getElementById('modal-q-marks');
        const marks = marksEl ? parseInt(marksEl.value, 10) || 10 : 10;

        const input2El = document.getElementById('modal-q-input2');
        let input2 = input2El ? input2El.value.trim() : '';
        const output2El = document.getElementById('modal-q-output2');
        let output2 = output2El ? output2El.value.trim() : '';

        const lowerT = [text, chapter, (subject ? subject.name : ''), customSubjectName].join(' ').toLowerCase();

        // Auto-synthesize default test case if user left it blank
        if (!expectedOutput) {
          if (lowerT.includes('palin')) {
            expectedOutput = 'Palindrome';
            if (!output2) output2 = 'Not Palindrome';
          } else if (lowerT.includes('prime')) {
            expectedOutput = 'Prime';
            if (!output2) output2 = 'Not Prime';
          } else if (lowerT.includes('even') || lowerT.includes('odd')) {
            expectedOutput = 'Even';
            if (!output2) output2 = 'Odd';
          } else {
            expectedOutput = 'Output';
          }
        }

        // Auto-generate negative/opposing test case 2 if missing or identical to test case 1
        if (!output2 || output2.toLowerCase() === expectedOutput.toLowerCase()) {
          if (lowerT.includes('palin') || /palindrome/i.test(expectedOutput)) {
            input2 = sampleInput === '121' ? '123' : (isNaN(sampleInput) ? 'hello' : '1234');
            output2 = 'Not Palindrome';
          } else if (lowerT.includes('prime') || /prime/i.test(expectedOutput)) {
            input2 = (sampleInput === '5' || sampleInput === '7') ? '8' : '4';
            output2 = 'Not Prime';
          } else if (lowerT.includes('even') || lowerT.includes('odd') || /even|odd/i.test(expectedOutput)) {
            const isEven = /even/i.test(expectedOutput);
            input2 = sampleInput && !isNaN(sampleInput) ? String(parseInt(sampleInput, 10) + 1) : (isEven ? '7' : '8');
            output2 = isEven ? 'Odd' : 'Even';
          }
        }

        // Build structured test cases
        const testCases = [
          { id: 1, name: 'Primary Test Case', input: sampleInput, expectedOutput: expectedOutput, marks: output2 ? Math.round(marks / 2) : marks }
        ];
        if (output2) {
          testCases.push({
            id: 2,
            name: 'Secondary Test Case (Anti-Cheat / Negative)',
            input: input2,
            expectedOutput: output2,
            marks: marks - Math.round(marks / 2)
          });
        }

        payload = {
          ...payload,
          language,
          marks,
          duration,
          starterCode,
          sampleInput,
          expectedOutput,
          input2,
          output2,
          testCases,
          options: []
        };
      } else {
        const op2 = document.getElementById('modal-q-op2') ? document.getElementById('modal-q-op2').value.trim() : '';
        const op3 = document.getElementById('modal-q-op3') ? document.getElementById('modal-q-op3').value.trim() : '';
        const op4 = document.getElementById('modal-q-op4') ? document.getElementById('modal-q-op4').value.trim() : '';
        const correctIndex = parseInt((document.getElementById('modal-q-correct') && document.getElementById('modal-q-correct').value) || '0', 10) || 0;

        if (!op1 || !op2 || !op3 || !op4) {
          ui.showToast('Please fill in all 4 options or switch to Coding question type.', 'error');
          return false;
        }

        payload = {
          ...payload,
          type: 'mcq',
          options: [op1, op2, op3, op4],
          correctIndex
        };
      }

      // Save or update question
      if (id) {
        storage.updateQuestion(id, payload);
        ui.showToast('Question updated successfully.', 'success');
      } else {
        storage.addQuestion(payload);
        ui.showToast(`Question saved successfully to ${payload.subjectName}!`, 'success');
      }

      // Hide modal immediately
      ui.hideModal('modal-question-form');

      // Refresh both Admin & Student views
      try { this.renderQuestionsTable(); } catch (e) { console.warn(e); }
      try {
        if (typeof studentDashboard !== 'undefined' && studentDashboard && studentDashboard.renderDashboard) {
          studentDashboard.renderDashboard();
        }
      } catch (e) { console.warn(e); }

      return false;
    } catch (err) {
      console.error('Error saving question:', err);
      ui.showToast(`Error: ${err.message}`, 'error');
      return false;
    }
  }

  deleteQuestion(id) {
    const targetId = String(id).trim().toLowerCase();
    const questions = storage.getQuestions();
    const q = questions.find(item => item.id && String(item.id).trim().toLowerCase() === targetId);
    if (!q) return;

    if (!this.isSuperAdmin()) {
      const mySubIds = this.getAdminSubjectIds();
      const qCreator = (q.createdBy || '').trim().toLowerCase();
      const belongs = (qCreator && qCreator === this.getCurrentAdminUsername()) ||
                      (q.subjectId && mySubIds.includes(String(q.subjectId).toLowerCase()));
      if (!belongs) {
        ui.showToast('You are not authorized to delete questions belonging to another admin.', 'error');
        return;
      }
    }

    const qText = q ? `"${escapeHtml(q.text.substring(0, 60))}..."` : 'this question';

    this.confirmDeleteAction({
      message: `Are you sure you want to permanently delete question ${qText}?`,
      onConfirm: async () => {
        storage.deleteQuestion(id);
        ui.showToast('Question permanently deleted from database.', 'success');
        this.renderQuestionsTable();
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  deleteAllQuestionsPrompt() {
    const questions = this.getAdminQuestions();
    const subjects = this.getAdminSubjects();

    let targetQuestions = questions;
    let targetDesc = 'ALL questions across all subjects';

    if (this.questionSubjectFilter && this.questionSubjectFilter !== 'All') {
      const sub = subjects.find(s => s.id === this.questionSubjectFilter);
      const subName = sub ? sub.name : this.questionSubjectFilter;
      targetQuestions = questions.filter(q => q.subjectId === this.questionSubjectFilter || (q.subject && String(q.subject).toLowerCase() === String(this.questionSubjectFilter).toLowerCase()));
      targetDesc = `all ${targetQuestions.length} question(s) for subject <strong>${escapeHtml(subName)}</strong>`;
    } else {
      targetDesc = `ALL ${questions.length} question(s) across your subjects`;
    }

    if (targetQuestions.length === 0) {
      ui.showToast('No questions found to delete.', 'warning');
      return;
    }

    this.confirmDeleteAction({
      message: `Are you sure you want to delete ${targetDesc}?<br><br><span style="color:var(--accent-rose); font-weight:600;">Warning: This will permanently delete ${targetQuestions.length} question(s) from the system. This action cannot be undone.</span>`,
      onConfirm: async () => {
        if (!this.isSuperAdmin()) {
          const mySubIds = this.getAdminSubjectIds();
          let allQ = storage.getQuestions().filter(q => {
            const qCreator = (q.createdBy || '').trim().toLowerCase();
            if (this.questionSubjectFilter && this.questionSubjectFilter !== 'All') {
              if (q.subjectId === this.questionSubjectFilter) return false;
            } else {
              if (qCreator === this.getCurrentAdminUsername()) return false;
              if (q.subjectId && mySubIds.includes(String(q.subjectId).toLowerCase())) return false;
            }
            return true;
          });
          storage.setItem(APP_KEYS.QUESTIONS, allQ);
        } else {
          await storage.deleteAllQuestions(this.questionSubjectFilter);
        }
        ui.showToast(`Successfully deleted ${targetQuestions.length} question(s).`, 'success');
        this.renderQuestionsTable();
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     ONLINE COMPILER & CODING LAB CONTROLLER (ADMIN)
     ------------------------------------------------------------------------ */
  switchCodingTab(tabName) {
    this.codingLabActiveTab = tabName;
    const btnQ = document.getElementById('tab-btn-coding-questions');
    const btnSub = document.getElementById('tab-btn-coding-submissions');
    const viewQ = document.getElementById('admin-coding-view-questions');
    const viewSub = document.getElementById('admin-coding-view-submissions');

    if (tabName === 'submissions') {
      if (btnQ) btnQ.classList.remove('active');
      if (btnSub) btnSub.classList.add('active');
      if (viewQ) viewQ.style.display = 'none';
      if (viewSub) viewSub.style.display = 'block';
      this.renderCodingSubmissionsTable();
    } else {
      if (btnQ) btnQ.classList.add('active');
      if (btnSub) btnSub.classList.remove('active');
      if (viewQ) viewQ.style.display = 'block';
      if (viewSub) viewSub.style.display = 'none';
      this.renderCodingLabPanel();
    }
  }

  renderCodingLabPanel() {
    const tbody = document.getElementById('admin-coding-questions-tbody');
    const totalCountEl = document.getElementById('admin-coding-total-count');
    const subsCountEl = document.getElementById('admin-coding-submissions-count');
    const yearsCountEl = document.getElementById('admin-coding-years-count');
    const badgeQ = document.getElementById('admin-coding-tab-q-badge');
    const badgeSub = document.getElementById('admin-coding-tab-sub-badge');

    const allQuestions = this.getAdminQuestions();
    const allAttempts = this.getAdminAttempts();
    const codingQuestions = allQuestions.filter(q => q.type === 'coding');
    const codingAttempts = allAttempts.filter(a => a.type === 'coding_lab');

    if (totalCountEl) totalCountEl.textContent = codingQuestions.length;
    if (subsCountEl) subsCountEl.textContent = codingAttempts.length;
    if (badgeQ) badgeQ.textContent = codingQuestions.length;
    if (badgeSub) badgeSub.textContent = codingAttempts.length;

    // Years distribution
    const assignedYears = [...new Set(codingQuestions.map(q => q.year || 'All'))];
    if (yearsCountEl) {
      yearsCountEl.textContent = assignedYears.length > 0 ? `${assignedYears.length} Batches` : 'All Years';
    }

    // Always update submissions table in background
    this.renderCodingSubmissionsTable();

    if (!tbody) return;

    const filterYear = (document.getElementById('admin-coding-filter-year') && document.getElementById('admin-coding-filter-year').value) || 'All';
    const filterSec = (document.getElementById('admin-coding-filter-sec') && document.getElementById('admin-coding-filter-sec').value) || 'All';
    const searchQuery = (this.codingSearchQuery || '').toLowerCase().trim();

    let filtered = codingQuestions.filter(q => {
      const yMatch = filterYear === 'All' || (q.year || 'All') === filterYear;
      const sMatch = filterSec === 'All' || (q.section || 'All') === 'All' || (q.section || 'All') === filterSec;
      const textMatch = !searchQuery || (q.title || '').toLowerCase().includes(searchQuery) || (q.text || '').toLowerCase().includes(searchQuery) || (q.language || '').toLowerCase().includes(searchQuery);
      return yMatch && sMatch && textMatch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state" style="padding: 2.5rem; text-align: center;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">💻</div>
            <h4>No Coding Questions Found</h4>
            <p style="color: var(--text-muted); font-size: 0.85rem;">Click "Add Coding Question" or "Upload Questions (JSON)" to assign coding challenges to students.</p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((q, idx) => {
      const qTitle = q.title || (q.text ? q.text.split('\n')[0].replace(/^#*\s*/, '').substring(0, 35) : `Challenge ${idx + 1}`);
      const cleanDesc = (q.text || q.question || '').substring(0, 70);
      const qMarks = q.marks !== undefined ? q.marks : 10;
      const lang = (q.language || 'python').toUpperCase();

      return `
        <tr>
          <td data-label="Year & Section" style="white-space: nowrap;">
            <span class="badge badge-primary">${escapeHtml(q.year || 'All Years')}</span>
            <span class="badge badge-info" style="margin-left: 0.2rem;">Sec ${escapeHtml(q.section || 'All')}</span>
          </td>
          <td data-label="Subject / Lab" style="font-weight: 600;">
            ${escapeHtml(q.subject || q.subjectName || 'Online Compiler Lab')}
          </td>
          <td data-label="Problem Title">
            <div style="font-weight: 700; color: var(--text-main);">${escapeHtml(qTitle)}</div>
            <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">${escapeHtml(cleanDesc)}...</div>
          </td>
          <td data-label="Language" style="white-space: nowrap;">
            <span class="badge badge-warning" style="font-family: var(--font-mono, monospace); font-weight: 700;">&lt;/&gt; ${lang}</span>
          </td>
          <td data-label="Test Cases" style="font-size: 0.8rem; font-family: var(--font-mono, monospace);">
            <div><span style="color: #94a3b8;">In:</span> ${escapeHtml(q.sampleInput || '(none)')}</div>
            <div><span style="color: #34d399;">Out:</span> ${escapeHtml(q.expectedOutput || '(none)')}</div>
          </td>
          <td data-label="Marks" style="white-space: nowrap; font-weight: 700; color: #34d399;">
            ${qMarks} M
          </td>
          <td class="actions-cell" style="text-align: right; white-space: nowrap;">
            <button class="btn btn-secondary btn-icon btn-sm" onclick="adminDashboard.openEditQuestionModal('${q.id}')" title="Edit Problem">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit
            </button>
            <button class="btn btn-danger btn-icon btn-sm" onclick="adminDashboard.deleteCodingQuestion('${q.id}')" title="Delete Problem">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  /* ------------------------------------------------------------------------
     STUDENT CODING SUBMISSIONS CONTROLLER (ADMIN CODE VIEWER)
     ------------------------------------------------------------------------ */
  renderCodingSubmissionsTable() {
    const tbody = document.getElementById('admin-coding-submissions-tbody');
    if (!tbody) return;

    const allAttempts = this.getAdminAttempts();
    const codingAttempts = allAttempts.filter(a => a.type === 'coding_lab');

    const badgeSub = document.getElementById('admin-coding-tab-sub-badge');
    if (badgeSub) badgeSub.textContent = codingAttempts.length;

    const filterYear = (document.getElementById('admin-coding-subs-filter-year') && document.getElementById('admin-coding-subs-filter-year').value) || 'All';
    const filterSec = (document.getElementById('admin-coding-subs-filter-sec') && document.getElementById('admin-coding-subs-filter-sec').value) || 'All';
    const filterStatus = (document.getElementById('admin-coding-subs-filter-status') && document.getElementById('admin-coding-subs-filter-status').value) || 'All';
    const query = (this.codingSubsSearchQuery || '').toLowerCase().trim();

    let filtered = codingAttempts.filter(att => {
      const isPassed = (att.percentage || 0) >= 50;
      const yMatch = filterYear === 'All' || (att.year || 'All') === filterYear;
      const sMatch = filterSec === 'All' || (att.section || 'All') === 'All' || (att.section || 'All') === filterSec;
      const statusMatch = filterStatus === 'All' || (filterStatus === 'Passed' && isPassed) || (filterStatus === 'Failed' && !isPassed);

      const probTitle = att.problemTitle || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].questionText) || '';
      const textMatch = !query ||
        (att.studentName && att.studentName.toLowerCase().includes(query)) ||
        (att.studentRegNo && String(att.studentRegNo).toLowerCase().includes(query)) ||
        probTitle.toLowerCase().includes(query) ||
        (att.language && att.language.toLowerCase().includes(query));

      return yMatch && sMatch && statusMatch && textMatch;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state" style="padding: 2.5rem; text-align: center;">
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">👨‍💻</div>
            <h4>No Student Code Submissions Found</h4>
            <p style="color: var(--text-muted); font-size: 0.85rem;">
              ${codingAttempts.length === 0 
                ? 'No students have submitted code from the Online Compiler yet.' 
                : 'No submissions match your active filter or search criteria.'}
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((att, idx) => {
      const isPassed = (att.percentage || 0) >= 50;
      const probTitle = att.problemTitle || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].questionText) || 'Practical Problem';
      const lang = (att.language || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].language) || 'python').toUpperCase();
      const submittedDate = att.submittedAt || att.startedAt ? new Date(att.submittedAt || att.startedAt).toLocaleString() : 'N/A';
      const maxM = att.totalMarks || 10;
      const earnedM = att.score !== undefined ? att.score : 0;

      return `
        <tr>
          <td data-label="S.No" style="font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
          <td data-label="Roll No" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-300);">
            ${escapeHtml(att.studentRegNo)}
          </td>
          <td data-label="Student Name">
            <strong style="color: var(--text-main); font-size: 0.95rem;">${escapeHtml(att.studentName)}</strong>
          </td>
          <td data-label="Class / Sec">
            <span class="badge badge-info" style="font-size: 0.72rem;">${escapeHtml(att.year || 'N/A')} - Sec ${escapeHtml(att.section || 'All')}</span>
          </td>
          <td data-label="Problem Title" style="max-width: 220px;">
            <div style="font-weight: 600; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(probTitle)}">
              ${escapeHtml(probTitle)}
            </div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(att.subjectName || 'Online Compiler Lab')}</div>
          </td>
          <td data-label="Language">
            <span class="badge badge-warning" style="font-family: var(--font-mono); font-weight: 700; font-size: 0.72rem;">
              &lt;/&gt; ${lang}
            </span>
          </td>
          <td data-label="Score">
            <strong style="color: ${isPassed ? '#34d399' : '#f87171'};">${earnedM}</strong> / <span style="color: var(--text-muted); font-size: 0.85rem;">${maxM} M (${att.percentage || 0}%)</span>
          </td>
          <td data-label="Result">
            <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-weight: 700; letter-spacing: 0.5px;">
              ${isPassed ? 'PASS' : 'FAIL'}
            </span>
          </td>
          <td data-label="Submitted At" style="font-size: 0.8rem; color: var(--text-muted); white-space: nowrap;">
            ${submittedDate}
          </td>
          <td data-label="Action" style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn btn-sm btn-primary" onclick="adminDashboard.viewStudentCodingSubmission('${att.id}')" title="Click to view student's submitted source code & test case evaluation" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 600;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              <span>View Code</span>
            </button>
            <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="adminDashboard.deleteAttempt('${att.id}', '${escapeHtml(att.studentName)}')" title="Delete submission record" style="margin-left: 0.35rem;">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  onCodingSubsSearchInput(val) {
    this.codingSubsSearchQuery = val;
    this.renderCodingSubmissionsTable();
  }

  viewStudentCodingSubmission(attemptId) {
    const attempts = storage.getAttempts();
    const att = attempts.find(a => a.id === attemptId);
    if (!att) {
      ui.showToast('Submission record not found.', 'warning');
      return;
    }

    this.activeViewingCodingAttempt = att;

    const studentCode = att.submittedCode || att.code || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].submittedCode) || '';
    const lang = (att.language || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].language) || 'python').toLowerCase();
    const problemTitle = att.problemTitle || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].questionText) || 'Practical Coding Problem';
    const isPassed = (att.percentage || 0) >= 50;
    const testCases = att.testCaseResults || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].testCaseResults) || [];
    const passedTests = testCases.filter(t => t.passed).length;
    const totalTests = testCases.length;

    const EXT_MAP = {
      python: 'solution.py',
      javascript: 'solution.js',
      c: 'solution.c',
      cpp: 'solution.cpp',
      java: 'Solution.java'
    };
    const filename = EXT_MAP[lang] || 'solution.txt';

    // 1. Meta Card
    const metaCard = document.getElementById('admin-code-meta-card');
    if (metaCard) {
      metaCard.innerHTML = `
        <div class="code-meta-header-row">
          <div class="code-meta-student-info">
            <div class="student-name-val">${escapeHtml(att.studentName)}</div>
            <div class="student-reg-val">
              <span class="reg-pill">${escapeHtml(att.studentRegNo)}</span>
              <span class="class-pill">${escapeHtml(att.year || 'N/A')} - Sec ${escapeHtml(att.section || 'All')}</span>
              <span class="time-pill">🕒 ${new Date(att.submittedAt || att.startedAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="code-meta-score-box ${isPassed ? 'score-pass' : 'score-fail'}">
            <div class="score-number">${att.score || 0} / ${att.totalMarks || 10} M</div>
            <div class="score-pct">${att.percentage || 0}% • ${isPassed ? 'PASSED' : 'FAILED'}</div>
          </div>
        </div>

        <div class="code-meta-problem-row">
          <div style="font-weight: 600; color: var(--text-main); font-size: 0.95rem;">
            📌 Problem: <span style="color: var(--primary-300);">${escapeHtml(problemTitle)}</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
            Subject: ${escapeHtml(att.subjectName || 'Online Compiler Practical Lab')}
          </div>
        </div>
      `;
    }

    // 2. Filename & Lang Pill
    const fnEl = document.getElementById('admin-code-filename');
    const langPill = document.getElementById('admin-code-lang-pill');
    const statsEl = document.getElementById('admin-code-stats');
    if (fnEl) fnEl.textContent = filename;
    if (langPill) langPill.textContent = lang.toUpperCase();

    const lineCount = (studentCode.match(/\n/g) || []).length + 1;
    const charCount = studentCode.length;
    if (statsEl) statsEl.textContent = `${lineCount} line${lineCount === 1 ? '' : 's'} | ${charCount} char${charCount === 1 ? '' : 's'}`;

    // 3. Line gutter and Code Content
    const gutterEl = document.getElementById('admin-code-gutter');
    const contentEl = document.getElementById('admin-code-content');

    if (gutterEl) {
      let nums = '';
      for (let i = 1; i <= lineCount; i++) {
        nums += i + '\n';
      }
      gutterEl.textContent = nums;
    }

    if (contentEl) {
      if (!studentCode.trim()) {
        contentEl.textContent = '// (No code was submitted by student)';
      } else {
        if (typeof studentDashboard !== 'undefined' && studentDashboard.highlightCode) {
          contentEl.innerHTML = studentDashboard.highlightCode(studentCode, lang);
        } else {
          contentEl.textContent = studentCode;
        }
      }
    }

    // 4. Test Cases Evaluation
    const summaryBadge = document.getElementById('admin-code-test-summary-badge');
    const tcList = document.getElementById('admin-code-testcases-list');

    if (summaryBadge) {
      summaryBadge.className = `badge ${passedTests === totalTests && totalTests > 0 ? 'badge-success' : 'badge-warning'}`;
      summaryBadge.textContent = totalTests > 0 ? `${passedTests}/${totalTests} Passed` : (isPassed ? 'Passed' : 'Needs Review');
    }

    if (tcList) {
      if (testCases.length === 0) {
        tcList.innerHTML = `
          <div class="testcase-card ${isPassed ? 'passed' : 'failed'}" style="padding: 0.75rem 1rem;">
            <div style="font-weight: 600; font-size: 0.85rem; color: ${isPassed ? '#34d399' : '#f87171'};">
              ${isPassed ? '✅ Solution verified & approved by test compiler' : '⚠️ Test case details not recorded'}
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem;">
              Score awarded: ${att.score || 0} / ${att.totalMarks || 10} marks (${att.percentage || 0}%)
            </div>
          </div>
        `;
      } else {
        tcList.innerHTML = testCases.map(tc => {
          const pass = tc.passed;
          return `
            <div class="testcase-card ${pass ? 'passed' : 'failed'}">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: ${pass ? '#34d399' : '#f87171'}; margin-bottom: 0.25rem;">
                <span>${pass ? '✅' : '❌'} Test Case ${tc.num || 1}: ${pass ? 'PASSED' : 'FAILED'}</span>
                <span style="font-size: 0.75rem; text-transform: uppercase;">${pass ? 'Match' : 'Mismatch'}</span>
              </div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.76rem; color: #94a3b8;">
                <span style="color: #64748b;">Input:</span> ${escapeHtml(tc.input || '(empty)')}
              </div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.76rem; color: #cbd5e1; margin-top: 2px;">
                <span style="color: #64748b;">Expected:</span> <strong style="color: #34d399;">${escapeHtml(tc.expected || '(empty)')}</strong>
              </div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.76rem; color: ${pass ? '#34d399' : '#fca5a5'}; margin-top: 2px;">
                <span style="color: #64748b;">Student Output:</span> ${escapeHtml(tc.actual || tc.error || '(no output)')}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    ui.showModal('modal-admin-view-code');
  }

  copyCurrentStudentCode(btnEl) {
    if (!this.activeViewingCodingAttempt) return;
    const att = this.activeViewingCodingAttempt;
    const code = att.submittedCode || att.code || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].submittedCode) || '';
    if (!code) {
      ui.showToast('No code content to copy.', 'warning');
      return;
    }

    navigator.clipboard.writeText(code).then(() => {
      ui.showToast('Student code copied to clipboard! 📋', 'success');
      if (btnEl) {
        const label = btnEl.querySelector('.copy-label');
        if (label) {
          const original = label.textContent;
          label.textContent = 'Copied! ✓';
          setTimeout(() => { label.textContent = original; }, 2000);
        }
      }
    }).catch(() => {
      ui.showToast('Failed to copy code.', 'error');
    });
  }

  downloadCurrentStudentCode() {
    if (!this.activeViewingCodingAttempt) return;
    const att = this.activeViewingCodingAttempt;
    const code = att.submittedCode || att.code || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].submittedCode) || '';
    const lang = (att.language || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].language) || 'python').toLowerCase();

    const EXT_MAP = {
      python: 'py',
      javascript: 'js',
      c: 'c',
      cpp: 'cpp',
      java: 'java'
    };
    const ext = EXT_MAP[lang] || 'txt';
    const safeStudent = (att.studentName || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeReg = (att.studentRegNo || 'reg').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${safeReg}_${safeStudent}_code.${ext}`;

    const blob = new Blob([code], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast(`Downloaded ${filename}`, 'success');
  }

  exportCodingSubmissionsCSV() {
    const attempts = this.getAdminAttempts().filter(a => a.type === 'coding_lab');
    if (attempts.length === 0) {
      ui.showToast('No student coding submissions to export.', 'warning');
      return;
    }

    const headers = ['S.No', 'Roll No (Reg No)', 'Student Name', 'Year', 'Section', 'Problem Title', 'Language', 'Score', 'Total Marks', 'Percentage', 'Result', 'Submitted At'];
    const rows = attempts.map((att, idx) => {
      const isPassed = (att.percentage || 0) >= 50;
      const lang = att.language || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].language) || 'python';
      const prob = att.problemTitle || (att.evaluatedAnswers && att.evaluatedAnswers[0] && att.evaluatedAnswers[0].questionText) || 'Practical Problem';
      const dateStr = att.submittedAt || att.startedAt ? new Date(att.submittedAt || att.startedAt).toISOString() : '';

      return [
        idx + 1,
        `"${String(att.studentRegNo).replace(/"/g, '""')}"`,
        `"${String(att.studentName || '').replace(/"/g, '""')}"`,
        `"${String(att.year || '').replace(/"/g, '""')}"`,
        `"${String(att.section || '').replace(/"/g, '""')}"`,
        `"${String(prob).replace(/"/g, '""')}"`,
        `"${String(lang).toUpperCase()}"`,
        att.score,
        att.totalMarks || 10,
        att.percentage,
        isPassed ? 'PASS' : 'FAIL',
        `"${dateStr}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Student_Coding_Submissions_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast(`Exported ${attempts.length} student coding submission(s) to CSV!`, 'success');
  }

  onCodingFilterChange() {
    this.renderCodingLabPanel();
  }

  onCodingSearchInput(val) {
    this.codingSearchQuery = val;
    this.renderCodingLabPanel();
  }

  deleteCodingQuestion(id) {
    this.confirmDeleteAction({
      message: 'Are you sure you want to delete this Online Compiler problem?',
      onConfirm: async () => {
        storage.deleteQuestion(id);
        ui.showToast('Coding challenge deleted.', 'success');
        this.renderCodingLabPanel();
        this.renderQuestionsTable();
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderAvailableSubjects();
        }
      }
    });
  }

  openUploadCodingQuestionsModal() {
    const txtArea = document.getElementById('coding-batch-json-text');
    const fileInput = document.getElementById('coding-batch-file-input');
    if (txtArea) txtArea.value = '';
    if (fileInput) fileInput.value = '';
    ui.showModal('modal-coding-upload-batch');
  }

  handleCodingBatchFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const txtArea = document.getElementById('coding-batch-json-text');
      if (txtArea) txtArea.value = e.target.result;
      ui.showToast(`Loaded ${file.name}`, 'info');
    };
    reader.readAsText(file);
  }

  handleUploadCodingQuestionsSubmit(event) {
    event.preventDefault();
    const txtArea = document.getElementById('coding-batch-json-text');
    const yearSelect = document.getElementById('coding-batch-year');
    const secSelect = document.getElementById('coding-batch-sec');

    const rawJson = txtArea ? txtArea.value.trim() : '';
    if (!rawJson) {
      ui.showToast('Please provide JSON content or select a file.', 'warning');
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawJson);
    } catch (e) {
      ui.showToast(`Invalid JSON syntax: ${e.message}`, 'error');
      return;
    }

    const questionsList = Array.isArray(parsed) ? parsed : (parsed.questions || [parsed]);
    if (!Array.isArray(questionsList) || questionsList.length === 0) {
      ui.showToast('No questions found in JSON array.', 'error');
      return;
    }

    const targetYear = yearSelect ? yearSelect.value : '1st Year';
    const targetSec = secSelect ? secSelect.value : 'All';
    let addedCount = 0;

    questionsList.forEach((item, idx) => {
      const qText = item.text || item.question || item.description || '';
      const expOut = item.expectedOutput !== undefined ? item.expectedOutput : (item.output || '');
      if (!qText || expOut === undefined) return;

      const newQ = {
        id: item.id || `q-code-bulk-${Date.now()}-${idx}`,
        type: 'coding',
        title: item.title || qText.split('\n')[0].replace(/^#*\s*/, '').substring(0, 40),
        text: qText,
        subject: item.subject || 'Online Compiler Lab',
        chapter: item.chapter || 'Practical Coding',
        year: item.year || targetYear,
        section: item.section || targetSec,
        language: (item.language || 'python').toLowerCase(),
        marks: parseInt(item.marks || 10, 10),
        starterCode: item.starterCode || item.code || '',
        sampleInput: item.sampleInput !== undefined ? item.sampleInput : (item.input || ''),
        expectedOutput: String(expOut).trim(),
        input2: item.input2 || '',
        output2: item.output2 ? String(item.output2).trim() : ''
      };

      storage.addQuestion(newQ);
      addedCount++;
    });

    ui.hideModal('modal-coding-upload-batch');
    ui.showToast(`Successfully imported ${addedCount} coding question(s) for ${targetYear}!`, 'success');

    this.renderCodingLabPanel();
    this.renderQuestionsTable();
    if (typeof studentDashboard !== 'undefined') {
      studentDashboard.renderAvailableSubjects();
    }
  }

  downloadCodingQuestionsTemplate() {
    const templateData = [
      {
        "title": "Factorial of N",
        "text": "Write a program that takes an integer N as input and prints the factorial of N.\n\nInput Format:\nA single integer N.\n\nOutput Format:\nPrint factorial value.\n\nExample:\nInput: 5\nOutput: 120",
        "language": "python",
        "marks": 10,
        "starterCode": "# Write your solution here\ndef factorial(n):\n    if n <= 1: return 1\n    return n * factorial(n - 1)\n\nnum = int(input())\nprint(factorial(num))",
        "sampleInput": "5",
        "expectedOutput": "120",
        "input2": "4",
        "output2": "24"
      },
      {
        "title": "Reverse a String",
        "text": "Write a program to reverse a given input string S.\n\nExample:\nInput: hello\nOutput: olleh",
        "language": "python",
        "marks": 10,
        "starterCode": "s = input()\nprint(s[::-1])",
        "sampleInput": "hello",
        "expectedOutput": "olleh"
      }
    ];

    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scad_coding_questions_template.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    ui.showToast('Downloaded Coding Questions JSON template.', 'success');
  }

  loadSampleCodingQuestions() {
    const sampleProblems = [
      {
        id: "q-scad-code-1",
        type: "coding",
        title: "Factorial of a Number",
        text: "Write a program that takes an integer N as input and computes its factorial (N!).\n\nInput: An integer N\nOutput: Factorial value of N\n\nExample:\nInput: 5\nOutput: 120",
        subject: "Problem Solving & Python Programming",
        chapter: "Functions & Recursion",
        year: "1st Year",
        section: "All",
        language: "python",
        marks: 10,
        starterCode: "# Python 3 Solution\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nnum = int(input())\nprint(factorial(num))",
        sampleInput: "5",
        expectedOutput: "120",
        input2: "6",
        output2: "720"
      },
      {
        id: "q-scad-code-2",
        type: "coding",
        title: "Reverse a String",
        text: "Write a program to reverse a given string.\n\nInput: A string S\nOutput: The reversed string\n\nExample:\nInput: scad\nOutput: dacs",
        subject: "Problem Solving & Python Programming",
        chapter: "String Manipulation",
        year: "1st Year",
        section: "All",
        language: "python",
        marks: 10,
        starterCode: "# Python 3 String Reversal\ns = input()\nprint(s[::-1])",
        sampleInput: "scad",
        expectedOutput: "dacs"
      },
      {
        id: "q-scad-code-3",
        type: "coding",
        title: "Check Prime Number",
        text: "Write a program in Python to check whether a given positive integer is prime.\nPrint 'Prime' or 'Not Prime'.\n\nExample 1:\nInput: 7\nOutput: Prime\n\nExample 2:\nInput: 9\nOutput: Not Prime",
        subject: "Problem Solving & Python Programming",
        chapter: "Conditionals & Loops",
        year: "1st Year",
        section: "All",
        language: "python",
        marks: 10,
        starterCode: "# Check Prime\nn = int(input())\nis_prime = True\nif n < 2:\n    is_prime = False\nelse:\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            is_prime = False\n            break\nprint('Prime' if is_prime else 'Not Prime')",
        sampleInput: "7",
        expectedOutput: "Prime",
        input2: "9",
        output2: "Not Prime"
      },
      {
        id: "q-scad-code-4",
        type: "coding",
        title: "Sum of Array Elements",
        text: "Given an integer N followed by N space-separated integers, compute and print the sum of all elements.\n\nExample:\nInput:\n4\n10 20 30 40\nOutput:\n100",
        subject: "Problem Solving & Python Programming",
        chapter: "Lists & Arrays",
        year: "1st Year",
        section: "All",
        language: "python",
        marks: 10,
        starterCode: "n = int(input())\nnums = list(map(int, input().split()))\nprint(sum(nums))",
        sampleInput: "4\n10 20 30 40",
        expectedOutput: "100"
      }
    ];

    sampleProblems.forEach(p => {
      storage.addQuestion(p);
    });

    ui.showToast('Loaded SCAD standard practical coding lab problems!', 'success');
    this.renderCodingLabPanel();
    this.renderQuestionsTable();
    if (typeof studentDashboard !== 'undefined') {
      studentDashboard.renderAvailableSubjects();
    }
  }



  /* ------------------------------------------------------------------------
     6. RESULT MANAGEMENT & EXAM HISTORY
     ------------------------------------------------------------------------ */
  renderResultsTable() {
    const tbody = document.getElementById('admin-results-tbody');
    if (!tbody) return;

    let attempts = this.getAdminAttempts();
    const violations = this.getAdminViolations();

    // Pass / Fail Filter
    if (this.resultPassFilter === 'Passed') {
      attempts = attempts.filter(a => a.percentage >= 50);
    } else if (this.resultPassFilter === 'Failed') {
      attempts = attempts.filter(a => a.percentage < 50);
    }

    // Search Query Filter
    if (this.resultSearchQuery.trim()) {
      const q = this.resultSearchQuery.toLowerCase();
      attempts = attempts.filter(a => 
        a.studentName.toLowerCase().includes(q) || 
        a.studentRegNo.toLowerCase().includes(q) ||
        a.subjectName.toLowerCase().includes(q)
      );
    }

    if (attempts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No student exam results found.</td></tr>`;
      return;
    }

    tbody.innerHTML = attempts.map(att => {
      const isPassed = att.percentage >= 50;
      const studentViolations = violations.filter(v => v.studentRegNo.toString() === att.studentRegNo.toString() && v.subjectName === att.subjectName);
      const vCount = studentViolations.length > 0 ? Math.max(...studentViolations.map(v => v.count)) : (att.status === 'Auto Submitted' ? 3 : 0);

      let cheatBadge = `<span class="badge badge-success">Clean (0)</span>`;
      if (vCount >= 3 || att.status === 'Auto Submitted') {
        cheatBadge = `<span class="badge badge-danger">Cheating Auto-Submitted (${vCount})</span>`;
      } else if (vCount > 0) {
        cheatBadge = `<span class="badge badge-warning">${vCount} Warning(s)</span>`;
      }

      const isCodingLab = att.type === 'coding_lab';

      return `
        <tr>
          <td data-label="Student"><strong>${escapeHtml(att.studentName)}</strong></td>
          <td data-label="Reg No">${escapeHtml(att.studentRegNo)}</td>
          <td data-label="Class">${att.year} - Sec ${att.section}</td>
          <td data-label="Subject">
            ${isCodingLab ? '<span class="badge badge-warning" style="font-size: 0.68rem; font-family: var(--font-mono); margin-right: 4px;">💻 Code Lab</span>' : ''}
            <a href="javascript:void(0)" class="clickable-subject-link" onclick="${isCodingLab ? `adminDashboard.viewStudentCodingSubmission('${att.id}')` : `adminDashboard.openExamAttendeesModal('${att.subjectId || att.subjectName}')`}" title="${isCodingLab ? 'Click to inspect submitted code' : 'Click to view exam attendees & performance report'}">
              ${escapeHtml(att.problemTitle || att.subjectName)}
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px; display: inline-block; vertical-align: middle; margin-left: 3px; opacity: 0.8;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </td>
          <td data-label="Score"><strong>${att.score} / ${att.totalMarks || att.totalQuestions || 10}</strong></td>
          <td data-label="Percentage"><strong style="color: ${isPassed ? '#34d399' : '#f87171'}">${att.percentage}%</strong></td>
          <td data-label="Result"><span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}">${isPassed ? 'PASSED' : 'FAILED'}</span></td>
          <td data-label="Cheating">${cheatBadge}</td>
          <td data-label="Submitted">${new Date(att.submittedAt || att.startedAt).toLocaleString()}</td>
          <td class="actions-cell" data-label="Action">
            <div style="display: flex; gap: 0.35rem; align-items: center;">
              ${isCodingLab ? `
                <button class="btn btn-secondary btn-icon" onclick="adminDashboard.viewStudentCodingSubmission('${att.id}')" title="View Student's Code and Evaluation">
                  <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> View Code
                </button>
              ` : `
                <button class="btn btn-secondary btn-icon" onclick="adminDashboard.viewResultDetail('${att.id}')" title="View Full Review & Cheating Details">
                  <svg class="svg-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Details
                </button>
              `}
              <button class="btn btn-primary btn-icon" onclick="adminDashboard.grantStudentReattemptByAttempt('${att.studentRegNo}', '${escapeHtml(att.subjectName)}', '${escapeHtml(att.studentName)}')" title="Allow student to re-take this exam">
                <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Re-attempt
              </button>
              <button class="btn btn-danger btn-icon" onclick="adminDashboard.deleteAttempt('${att.id}', '${escapeHtml(att.studentName)}')" title="Delete this result record">
                <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  viewResultDetail(attemptId) {
    const attempt = storage.getAttempts().find(a => a.id === attemptId);
    if (!attempt) return;

    if (attempt.type === 'coding_lab') {
      this.viewStudentCodingSubmission(attemptId);
      return;
    }

    examEngine.renderResultModal(attempt);
  }

  grantStudentReattemptByAttempt(studentRegNo, subjectName, studentName) {
    this.confirmDeleteAction({
      message: `Allow fresh re-attempt for <strong>${escapeHtml(studentName)}</strong> (${escapeHtml(studentRegNo)}) in <strong>${escapeHtml(subjectName)}</strong>?<br><br><span style="color:var(--accent-emerald); font-weight:600;">This will clear any previous score or lock and allow the student to retake the exam.</span>`,
      onConfirm: () => {
        storage.unlockStudentExamAttempt(studentRegNo, subjectName);
        ui.showToast(`Re-attempt granted for ${studentName}! Exam is unlocked.`, 'success', 5000);
        this.renderResultsTable();
        this.renderViolationsTable();
        if (this.attendeesSubjectId) {
          this.renderExamAttendeesModal();
        }
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  deleteAttempt(attemptId, studentName) {
    const attempt = storage.getAttempts().find(a => a.id === attemptId);
    if (!attempt) return;
    if (!this.isSuperAdmin()) {
      const mySubIds = this.getAdminSubjectIds();
      if (!attempt.subjectId || !mySubIds.includes(String(attempt.subjectId).toLowerCase())) {
        ui.showToast('You are not authorized to delete exam results of another admin.', 'error');
        return;
      }
    }

    this.confirmDeleteAction({
      message: `Delete exam result record for <strong>${escapeHtml(studentName || 'Student')}</strong>?`,
      onConfirm: () => {
        let attempts = storage.getAttempts();
        attempts = attempts.filter(a => a.id !== attemptId);
        storage.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
        ui.showToast('Exam result record deleted.', 'success');
        this.renderResultsTable();
        this.renderOverviewStats();
        if (typeof this.renderCodingSubmissionsTable === 'function') {
          this.renderCodingSubmissionsTable();
        }
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  clearAllStudentResults() {
    const isSuper = this.isSuperAdmin();
    const mySubIds = this.getAdminSubjectIds();
    this.confirmDeleteAction({
      message: isSuper
        ? `Are you sure you want to permanently clear <strong>ALL student exam results, scores, and test submissions</strong>?<br><br><span style="color:#f87171; font-weight:600;">This will wipe all result records across all subjects for a 100% fresh start.</span>`
        : `Are you sure you want to clear student exam results for <strong>your subjects</strong>?`,
      onConfirm: () => {
        if (isSuper) {
          storage.setItem(APP_KEYS.EXAM_ATTEMPTS, []);
          storage.setItem(APP_KEYS.VIOLATIONS, []);
          localStorage.removeItem(APP_KEYS.ACTIVE_EXAM_STATE);
        } else {
          let attempts = storage.getAttempts().filter(a => !a.subjectId || !mySubIds.includes(String(a.subjectId).toLowerCase()));
          storage.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
          let violations = storage.getViolations().filter(v => !v.subjectId || !mySubIds.includes(String(v.subjectId).toLowerCase()));
          storage.setItem(APP_KEYS.VIOLATIONS, violations);
        }
        ui.showToast('Exam results cleared successfully!', 'success');
        this.renderResultsTable();
        this.renderViolationsTable();
        this.renderOverviewStats();
        if (typeof this.renderCodingSubmissionsTable === 'function') {
          this.renderCodingSubmissionsTable();
        }
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  clearAllStudents() {
    this.confirmDeleteAction({
      message: `Are you sure you want to permanently delete <strong>ALL registered students</strong>?<br><br><span style="color:#f87171; font-weight:600;">This will completely clear the student directory for a 100% fresh start.</span>`,
      onConfirm: () => {
        storage.setItem(APP_KEYS.STUDENTS, []);
        localStorage.removeItem('lms_deleted_student_ids');
        ui.showToast('All registered students cleared successfully!', 'success');
        this.renderStudentsTable();
        this.renderOverviewStats();
        if (typeof window.renderRecentStudents === 'function') {
          window.renderRecentStudents();
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     7. ANTI-CHEATING VIOLATION MONITOR & ATTEMPT CONTROLS
     ------------------------------------------------------------------------ */
  renderViolationsTable() {
    const tbody = document.getElementById('admin-violations-tbody');
    const kpiGrid = document.getElementById('violations-kpi-grid');
    if (!tbody) return;

    const allViolations = this.getAdminViolations();

    // 1. Compute Summary KPI Cards
    const totalInfractions = allViolations.length;
    const autoSubmittedCount = allViolations.filter(v => v.examStatus === 'Auto Submitted' || (v.count || 0) >= 3).length;
    const activeWarningsCount = allViolations.filter(v => (v.count || 0) > 0 && (v.count || 0) < 3 && v.examStatus !== 'Auto Submitted').length;
    const focusLostCount = allViolations.filter(v => {
      const type = String(v.violationType || '').toLowerCase();
      return type.includes('focus') || type.includes('tab') || type.includes('window');
    }).length;
    const fullscreenCount = allViolations.filter(v => String(v.violationType || '').toLowerCase().includes('fullscreen')).length;
    const copyCount = allViolations.filter(v => String(v.violationType || '').toLowerCase().includes('copy')).length;

    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="exam-kpi-card" style="border-top-color: var(--primary-400);">
          <div class="exam-kpi-label">Total Infractions</div>
          <div class="exam-kpi-val" style="color: var(--primary-300);">
            ${totalInfractions} <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-muted);">Incidents</span>
          </div>
          <div class="exam-kpi-sub">All logged warnings</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: var(--accent-rose);">
          <div class="exam-kpi-label">Auto-Submitted (3/3)</div>
          <div class="exam-kpi-val" style="color: #f87171;">
            ${autoSubmittedCount} <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-muted);">Locked</span>
          </div>
          <div class="exam-kpi-sub">Reached max 3 warnings</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: #fbbf24;">
          <div class="exam-kpi-label">Active Warnings</div>
          <div class="exam-kpi-val" style="color: #fbbf24;">
            ${activeWarningsCount} <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-muted);">Students</span>
          </div>
          <div class="exam-kpi-sub">Warning count: 1 - 2</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: #38bdf8;">
          <div class="exam-kpi-label">Tab / Focus Lost</div>
          <div class="exam-kpi-val" style="color: #38bdf8;">
            ${focusLostCount}
          </div>
          <div class="exam-kpi-sub">Screen switch events</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: #c084fc;">
          <div class="exam-kpi-label">Fullscreen & Copy</div>
          <div class="exam-kpi-val" style="color: #c084fc;">
            ${fullscreenCount + copyCount}
          </div>
          <div class="exam-kpi-sub">FS Exit: ${fullscreenCount} &bull; Copy: ${copyCount}</div>
        </div>
      `;
    }

    // 2. Filter logs
    let filtered = [...allViolations];

    if (this.violationTypeFilter && this.violationTypeFilter !== 'All') {
      if (this.violationTypeFilter === 'Auto Submitted') {
        filtered = filtered.filter(v => v.examStatus === 'Auto Submitted' || (v.count || 0) >= 3);
      } else if (this.violationTypeFilter === 'Warnings') {
        filtered = filtered.filter(v => (v.count || 0) > 0 && (v.count || 0) < 3 && v.examStatus !== 'Auto Submitted');
      } else if (this.violationTypeFilter === 'Focus Lost') {
        filtered = filtered.filter(v => {
          const type = String(v.violationType || '').toLowerCase();
          return type.includes('focus') || type.includes('tab') || type.includes('window');
        });
      } else if (this.violationTypeFilter === 'Fullscreen Exit') {
        filtered = filtered.filter(v => String(v.violationType || '').toLowerCase().includes('fullscreen'));
      } else if (this.violationTypeFilter === 'Copy Attempt') {
        filtered = filtered.filter(v => String(v.violationType || '').toLowerCase().includes('copy'));
      }
    }

    if (this.violationSearchQuery && this.violationSearchQuery.trim()) {
      const q = this.violationSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(v => 
        (v.studentName && v.studentName.toLowerCase().includes(q)) || 
        (v.studentRegNo && String(v.studentRegNo).toLowerCase().includes(q)) ||
        (v.violationType && v.violationType.toLowerCase().includes(q)) ||
        (v.subjectName && v.subjectName.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.4rem;">🛡️</div>
            <strong style="color: var(--text-main); font-size: 1.05rem;">No cheating violations found</strong>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
              ${allViolations.length === 0 ? 'No malpractice or tab-switch violations recorded.' : 'No logs match the current search or filter criteria.'}
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((v, idx) => {
      const count = Number(v.count) || 0;
      const isAutoSubmitted = v.examStatus === 'Auto Submitted' || count >= 3;
      
      // Determine pill style for violation type
      const vTypeLower = String(v.violationType || '').toLowerCase();
      let pillClass = 'pill-violation-general';
      if (vTypeLower.includes('copy')) pillClass = 'pill-violation-copy';
      else if (vTypeLower.includes('fullscreen')) pillClass = 'pill-violation-fullscreen';
      else if (vTypeLower.includes('focus') || vTypeLower.includes('tab') || vTypeLower.includes('window')) pillClass = 'pill-violation-focus';

      const formattedTime = v.timestamp 
        ? new Date(v.timestamp).toLocaleString(undefined, {
            year: 'numeric', month: 'numeric', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
          })
        : 'N/A';

      return `
        <tr>
          <td data-label="S.No" style="font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
          <td data-label="Student"><strong>${escapeHtml(v.studentName)}</strong></td>
          <td data-label="Reg No" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-300);">${escapeHtml(v.studentRegNo)}</td>
          <td data-label="Class">${escapeHtml(v.year || '')} - ${escapeHtml(v.section || '')}</td>
          <td data-label="Subject">
            <a href="javascript:void(0)" class="clickable-subject-link" onclick="adminDashboard.openExamAttendeesModal('${escapeHtml(v.subjectId || v.subjectName)}')" title="Click to view exam attendees">
              ${escapeHtml(v.subjectName)}
            </a>
          </td>
          <td data-label="Violation Type">
            <span class="pill-violation ${pillClass}">
              ${escapeHtml(v.violationType)}
            </span>
          </td>
          <td data-label="Warning / Attempt" style="text-align: center;">
            <div class="warning-stepper">
              <button type="button" class="stepper-btn stepper-btn-minus" onclick="adminDashboard.decreaseViolationAttempt('${v.id}')" title="Decrease warning / penalty count (-1)" ${count <= 0 ? 'disabled' : ''}>
                &minus;
              </button>
              <span class="stepper-val ${count >= 3 ? 'val-danger' : (count > 0 ? 'val-warn' : 'val-clean')}">
                ${count} / 3
              </span>
              <button type="button" class="stepper-btn stepper-btn-plus" onclick="adminDashboard.increaseViolationAttempt('${v.id}')" title="Increase warning / penalty count (+1)" ${count >= 5 ? 'disabled' : ''}>
                +
              </button>
            </div>
          </td>
          <td data-label="Timestamp" style="font-size: 0.8rem; color: var(--text-muted);">${formattedTime}</td>
          <td data-label="Exam Status">
            ${isAutoSubmitted 
              ? '<span class="badge badge-danger" style="font-weight: 700; letter-spacing: 0.5px;">AUTO SUBMITTED</span>' 
              : '<span class="badge badge-info" style="font-weight: 600; letter-spacing: 0.3px;">ACTIVE / PERMITTED</span>'
            }
          </td>
          <td class="actions-cell" data-label="Proctor Actions" style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
              <button type="button" class="btn btn-sm btn-primary" onclick="adminDashboard.grantStudentReattempt('${v.id}')" title="Clear violations and allow student to re-take the exam" style="font-size: 0.75rem; padding: 0.3rem 0.55rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Allow Re-attempt</span>
              </button>
              <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="adminDashboard.deleteViolationLog('${v.id}')" title="Delete this violation log">
                <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  decreaseViolationAttempt(violationId) {
    const violations = storage.getViolations();
    const v = violations.find(item => item.id === violationId);
    if (!v) return;

    const currentCount = Number(v.count) || 0;
    const newCount = Math.max(0, currentCount - 1);
    const newStatus = newCount >= 3 ? 'Auto Submitted' : 'Active';

    // 1. Update this violation and all other violations for this student + subject
    violations.forEach(item => {
      if (String(item.studentRegNo) === String(v.studentRegNo) && item.subjectName === v.subjectName) {
        storage.updateViolation(item.id, { count: newCount, examStatus: newStatus });
      }
    });

    // 2. If reduced below 3, unlock any "Auto Submitted" exam attempt
    if (newCount < 3) {
      let attempts = storage.getAttempts();
      let updatedAttempts = false;
      attempts.forEach(a => {
        if (String(a.studentRegNo) === String(v.studentRegNo) && a.subjectName === v.subjectName) {
          if (a.status === 'Auto Submitted') {
            a.status = 'Submitted';
            updatedAttempts = true;
          }
        }
      });
      if (updatedAttempts) {
        storage.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
      }
    }

    ui.showToast(`Decreased warning count to ${newCount}/3 for ${v.studentName}${newCount < 3 ? ' (Exam ban removed)' : ''}`, 'success');
    this.renderViolationsTable();
    this.renderResultsTable();
  }

  increaseViolationAttempt(violationId) {
    const violations = storage.getViolations();
    const v = violations.find(item => item.id === violationId);
    if (!v) return;

    const currentCount = Number(v.count) || 0;
    const newCount = currentCount + 1;
    const newStatus = newCount >= 3 ? 'Auto Submitted' : 'Active';

    // 1. Update this violation and all other violations for this student + subject
    violations.forEach(item => {
      if (String(item.studentRegNo) === String(v.studentRegNo) && item.subjectName === v.subjectName) {
        storage.updateViolation(item.id, { count: newCount, examStatus: newStatus });
      }
    });

    // 2. If reaches 3, apply Auto Submitted penalty lock to exam attempt
    if (newCount >= 3) {
      let attempts = storage.getAttempts();
      let updatedAttempts = false;
      attempts.forEach(a => {
        if (String(a.studentRegNo) === String(v.studentRegNo) && a.subjectName === v.subjectName) {
          a.status = 'Auto Submitted';
          updatedAttempts = true;
        }
      });
      if (updatedAttempts) {
        storage.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
      }
    }

    ui.showToast(`Increased warning count to ${newCount}/3 for ${v.studentName}${newCount >= 3 ? ' (Exam Auto-Submitted)' : ''}`, 'warning');
    this.renderViolationsTable();
    this.renderResultsTable();
  }

  grantStudentReattempt(violationId) {
    const violations = storage.getViolations();
    const v = violations.find(item => item.id === violationId);
    if (!v) return;

    this.confirmDeleteAction({
      message: `Allow fresh re-attempt for <strong>${escapeHtml(v.studentName)}</strong> (${escapeHtml(v.studentRegNo)}) in <strong>${escapeHtml(v.subjectName)}</strong>?<br><br><span style="color:var(--accent-emerald); font-weight:600;">This will clear their violation warnings and unlock the exam so the student can retake the test.</span>`,
      onConfirm: () => {
        storage.unlockStudentExamAttempt(v.studentRegNo, v.subjectName);
        ui.showToast(`Re-attempt granted for ${v.studentName}! Exam is unlocked.`, 'success', 5000);
        this.renderViolationsTable();
        this.renderResultsTable();
        if (typeof studentDashboard !== 'undefined') {
          studentDashboard.renderDashboard();
        }
      }
    });
  }

  deleteViolationLog(violationId) {
    storage.deleteViolation(violationId);
    ui.showToast("Violation log entry deleted.", "info");
    this.renderViolationsTable();
  }

  resetAllViolationsPrompt() {
    const isSuper = this.isSuperAdmin();
    const violations = this.getAdminViolations();
    if (violations.length === 0) {
      ui.showToast("No violation logs found to reset.", "warning");
      return;
    }

    const mySubIds = this.getAdminSubjectIds();
    this.confirmDeleteAction({
      message: isSuper
        ? `Are you sure you want to permanently clear ALL <strong>${violations.length}</strong> anti-cheating violation records?<br><br><span style="color:var(--accent-rose); font-weight:600;">Warning: This action will erase all cheating logs and cannot be undone.</span>`
        : `Are you sure you want to clear <strong>${violations.length}</strong> anti-cheating records for your subjects?`,
      onConfirm: () => {
        if (isSuper) {
          storage.clearAllViolations();
        } else {
          let allV = storage.getViolations().filter(v => !v.subjectId || !mySubIds.includes(String(v.subjectId).toLowerCase()));
          storage.setItem(APP_KEYS.VIOLATIONS, allV);
        }
        ui.showToast("Anti-cheating logs successfully cleared.", "success");
        this.renderViolationsTable();
      }
    });
  }

  filterViolationsType(type, btnEl) {
    this.violationTypeFilter = type;
    document.querySelectorAll('#violations-filter-chips .chip-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    this.renderViolationsTable();
  }

  exportViolationsCSV() {
    const violations = this.getAdminViolations();
    if (violations.length === 0) {
      ui.showToast("No violation logs to export.", "warning");
      return;
    }

    const headers = [
      'S.No',
      'Student Name',
      'Register No',
      'Year',
      'Section',
      'Subject',
      'Violation Type',
      'Warning Count',
      'Exam Status',
      'Timestamp'
    ];

    const rows = violations.map((v, idx) => [
      idx + 1,
      `"${String(v.studentName || '').replace(/"/g, '""')}"`,
      `"${String(v.studentRegNo || '').replace(/"/g, '""')}"`,
      `"${String(v.year || '').replace(/"/g, '""')}"`,
      `"${String(v.section || '').replace(/"/g, '""')}"`,
      `"${String(v.subjectName || '').replace(/"/g, '""')}"`,
      `"${String(v.violationType || '').replace(/"/g, '""')}"`,
      `${v.count || 0}/3`,
      `"${String(v.examStatus || 'Active').replace(/"/g, '""')}"`,
      `"${v.timestamp || ''}"`
    ].join(','));

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Anti_Cheating_Audit_Log_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast(`Exported ${violations.length} violation records to CSV!`, 'success');
  }

  /* ------------------------------------------------------------------------
     8. EXAM ATTENDEES & PERFORMANCE REPORT
     ------------------------------------------------------------------------ */
  openAttendeesForSelectedSubject() {
    const subjects = this.getAdminSubjects();
    if (this.questionSubjectFilter && this.questionSubjectFilter !== 'All') {
      this.openExamAttendeesModal(this.questionSubjectFilter);
      return;
    }

    // If "All Subjects" is selected, choose subject with most attempts or the first subject
    const attempts = this.getAdminAttempts();
    if (attempts.length > 0) {
      const counts = {};
      attempts.forEach(a => {
        const id = a.subjectId || a.subjectName;
        counts[id] = (counts[id] || 0) + 1;
      });
      const topSubId = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      this.openExamAttendeesModal(topSubId);
      return;
    }

    if (subjects.length > 0) {
      this.openExamAttendeesModal(subjects[0].id);
      return;
    }

    ui.showToast("No subjects or exam records found to display attendees.", "warning");
  }

  openExamAttendeesModal(subjectId) {
    if (!subjectId) {
      ui.showToast("No subject specified.", "warning");
      return;
    }

    if (!this.isSuperAdmin()) {
      const mySubIds = this.getAdminSubjectIds();
      const mySubNames = this.getAdminSubjects().map(s => (s.name || '').trim().toLowerCase());
      const cleanSub = String(subjectId).trim().toLowerCase();
      if (!mySubIds.includes(cleanSub) && !mySubNames.includes(cleanSub)) {
        ui.showToast("You are not authorized to view attendees for another admin's exam.", "error");
        return;
      }
    }

    this.attendeesSubjectId = subjectId;
    this.attendeesSearchQuery = '';
    this.attendeesStatusFilter = 'All';
    this.attendeesSortBy = 'regNo'; // Sequential roll numbers

    const searchInput = document.getElementById('attendees-search-input');
    if (searchInput) searchInput.value = '';

    const sortBtn = document.getElementById('attendees-sort-btn');
    if (sortBtn) sortBtn.innerHTML = `<span>🔢 Roll No Order</span>`;

    // Reset filter chips
    document.querySelectorAll('.attendees-chips .chip-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-filter') === 'All');
    });

    this.renderExamAttendeesModal();
    ui.showModal('modal-exam-attendees');
  }

  getAttendeesDataForCurrentSubject() {
    const subjects = this.getAdminSubjects();
    const attempts = this.getAdminAttempts();
    const questions = this.getAdminQuestions();
    const violations = this.getAdminViolations();

    const targetId = String(this.attendeesSubjectId || '').trim().toLowerCase();
    
    // Find matching subject
    let subject = subjects.find(s => 
      (s.id && String(s.id).trim().toLowerCase() === targetId) ||
      (s.name && String(s.name).trim().toLowerCase() === targetId) ||
      (s.code && String(s.code).trim().toLowerCase() === targetId)
    );

    // Subject name fallback
    const subjectName = subject ? subject.name : (this.attendeesSubjectId || 'Exam Subject');

    // Filter attempts for this subject
    const subjectAttempts = attempts.filter(a => {
      if (a.subjectId && String(a.subjectId).trim().toLowerCase() === targetId) return true;
      if (subject && a.subjectId && String(a.subjectId).trim().toLowerCase() === String(subject.id).trim().toLowerCase()) return true;
      if (a.subjectName && subject && String(a.subjectName).trim().toLowerCase() === String(subject.name).trim().toLowerCase()) return true;
      if (a.subjectName && String(a.subjectName).trim().toLowerCase() === targetId) return true;
      return false;
    });

    // Subject MCQs count
    const qCount = questions.filter(q => {
      if (subject && q.subjectId === subject.id) return true;
      if (q.subjectId === this.attendeesSubjectId) return true;
      return false;
    }).length;

    return { subject, subjectName, subjectAttempts, qCount, violations };
  }

  renderExamAttendeesModal() {
    const { subject, subjectName, subjectAttempts, qCount, violations } = this.getAttendeesDataForCurrentSubject();

    // 1. Update Title and Subtitle
    const titleEl = document.getElementById('attendees-modal-title');
    const subtitleEl = document.getElementById('attendees-modal-subtitle');
    if (titleEl) {
      titleEl.textContent = `${subjectName} - Exam Attendees & Performance`;
    }
    if (subtitleEl) {
      const yearText = subject ? subject.year : 'All Years';
      const secText = subject && subject.section ? `Sec ${subject.section}` : 'All Sections';
      const durationText = subject ? `${subject.duration || 30} Mins` : '30 Mins';
      const codeText = subject && subject.code ? ` (${subject.code})` : '';
      subtitleEl.innerHTML = `<strong>${escapeHtml(subjectName)}${escapeHtml(codeText)}</strong> &bull; ${escapeHtml(yearText)} &bull; ${escapeHtml(secText)} &bull; ⏱️ ${durationText} &bull; 📝 ${qCount} MCQs in Paper`;
    }

    // 2. Compute Summary KPIs ("mella evalo peru attend pannirukanga")
    const totalAttended = subjectAttempts.length;
    const passedAttempts = subjectAttempts.filter(a => (a.percentage || 0) >= 50);
    const failedAttempts = subjectAttempts.filter(a => (a.percentage || 0) < 50);
    const passedCount = passedAttempts.length;
    const failedCount = failedAttempts.length;
    const passRate = totalAttended > 0 ? Math.round((passedCount / totalAttended) * 100) : 0;
    const avgScore = totalAttended > 0 
      ? (subjectAttempts.reduce((sum, a) => sum + (Number(a.percentage) || 0), 0) / totalAttended).toFixed(1) 
      : '0.0';
    
    let highestPct = 0;
    let topScorerName = 'N/A';
    if (totalAttended > 0) {
      const sortedByScore = [...subjectAttempts].sort((a, b) => (b.percentage || 0) - (a.percentage || 0));
      highestPct = sortedByScore[0].percentage || 0;
      topScorerName = sortedByScore[0].studentName || 'Student';
    }

    // Render KPI Cards
    const kpiGrid = document.getElementById('attendees-kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="exam-kpi-card" style="border-top-color: var(--primary-400);">
          <div class="exam-kpi-label">Total Attended</div>
          <div class="exam-kpi-val" style="color: var(--primary-300);">
            ${totalAttended} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">Students</span>
          </div>
          <div class="exam-kpi-sub">Total submissions</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: var(--accent-emerald);">
          <div class="exam-kpi-label">Passed Students</div>
          <div class="exam-kpi-val" style="color: #34d399;">
            ${passedCount} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">(${passRate}%)</span>
          </div>
          <div class="exam-kpi-sub">Scored &ge; 50%</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: var(--accent-rose);">
          <div class="exam-kpi-label">Failed Students</div>
          <div class="exam-kpi-val" style="color: #f87171;">
            ${failedCount} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">(${totalAttended > 0 ? 100 - passRate : 0}%)</span>
          </div>
          <div class="exam-kpi-sub">Scored &lt; 50%</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: #38bdf8;">
          <div class="exam-kpi-label">Batch Average</div>
          <div class="exam-kpi-val" style="color: #38bdf8;">
            ${avgScore}%
          </div>
          <div class="exam-kpi-sub">Mean percentage</div>
        </div>

        <div class="exam-kpi-card" style="border-top-color: #fbbf24;">
          <div class="exam-kpi-label">Highest Score</div>
          <div class="exam-kpi-val" style="color: #fbbf24;">
            ${highestPct}%
          </div>
          <div class="exam-kpi-sub" title="${escapeHtml(topScorerName)}">Top: ${escapeHtml(topScorerName.substring(0, 16))}</div>
        </div>
      `;
    }

    // 3. Filter Records
    let filtered = [...subjectAttempts];

    // Status Filter (All / Passed / Failed)
    if (this.attendeesStatusFilter === 'Passed') {
      filtered = filtered.filter(a => (a.percentage || 0) >= 50);
    } else if (this.attendeesStatusFilter === 'Failed') {
      filtered = filtered.filter(a => (a.percentage || 0) < 50);
    }

    // Search Query Filter
    if (this.attendeesSearchQuery && this.attendeesSearchQuery.trim()) {
      const q = this.attendeesSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(a => 
        (a.studentName && a.studentName.toLowerCase().includes(q)) ||
        (a.studentRegNo && String(a.studentRegNo).toLowerCase().includes(q))
      );
    }

    // 4. Sort Records
    if (this.attendeesSortBy === 'regNo') {
      // Sequential Roll Number Order (e.g. 952821104001, 952821104002...)
      filtered.sort((a, b) => {
        const regA = String(a.studentRegNo || '');
        const regB = String(b.studentRegNo || '');
        return regA.localeCompare(regB, undefined, { numeric: true, sensitivity: 'base' });
      });
    } else {
      // Score / Rank Order (Highest score first)
      filtered.sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        return (b.percentage || 0) - (a.percentage || 0);
      });
    }

    // 5. Render Table Rows
    const tbody = document.getElementById('attendees-tbody');
    const footerCount = document.getElementById('attendees-footer-count');

    if (footerCount) {
      footerCount.textContent = `Showing ${filtered.length} of ${totalAttended} attended student(s)`;
    }

    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" class="empty-state" style="padding: 2.5rem 1rem; text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">👨‍🎓</div>
            <strong style="color: var(--text-main); font-size: 1.05rem;">No student exam records found</strong>
            <p style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">
              ${totalAttended === 0 ? 'No students have attended this exam yet.' : 'No attendees match the selected search or filter criteria.'}
            </p>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filtered.map((att, idx) => {
      const isPassed = (att.percentage || 0) >= 50;
      const studentViolations = violations.filter(v => 
        String(v.studentRegNo) === String(att.studentRegNo) && 
        (v.subjectName === att.subjectName || v.subjectId === att.subjectId)
      );
      const vCount = studentViolations.length > 0 ? Math.max(...studentViolations.map(v => v.count)) : (att.status === 'Auto Submitted' ? 3 : 0);

      let cheatBadge = `<span class="badge badge-success" style="font-size: 0.72rem;">Clean (0)</span>`;
      if (vCount >= 3 || att.status === 'Auto Submitted') {
        cheatBadge = `<span class="badge badge-danger" style="font-size: 0.72rem;">Cheating (${vCount})</span>`;
      } else if (vCount > 0) {
        cheatBadge = `<span class="badge badge-warning" style="font-size: 0.72rem;">${vCount} Warning(s)</span>`;
      }

      const formattedDate = att.submittedAt || att.startedAt 
        ? new Date(att.submittedAt || att.startedAt).toLocaleString(undefined, { 
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
          })
        : 'N/A';

      return `
        <tr>
          <td data-label="S.No" style="font-weight: 600; color: var(--text-muted);">${idx + 1}</td>
          <td data-label="Roll No" style="font-family: var(--font-mono); font-weight: 700; color: var(--primary-300);">
            ${escapeHtml(att.studentRegNo)}
          </td>
          <td data-label="Student Name">
            <strong style="color: var(--text-main);">${escapeHtml(att.studentName)}</strong>
          </td>
          <td data-label="Class / Sec">
            <span class="badge badge-info" style="font-size: 0.72rem;">${escapeHtml(att.year || 'N/A')} - Sec ${escapeHtml(att.section || 'All')}</span>
          </td>
          <td data-label="Score">
            <strong>${att.score}</strong> / <span style="color: var(--text-muted);">${att.totalQuestions}</span>
          </td>
          <td data-label="Percentage">
            <strong style="color: ${isPassed ? '#34d399' : '#f87171'}; font-size: 0.95rem;">
              ${att.percentage}%
            </strong>
          </td>
          <td data-label="Result">
            <span class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-weight: 700; letter-spacing: 0.5px;">
              ${isPassed ? 'PASS' : 'FAIL'}
            </span>
          </td>
          <td data-label="Integrity">${cheatBadge}</td>
          <td data-label="Submitted On" style="font-size: 0.8rem; color: var(--text-muted);">${formattedDate}</td>
          <td data-label="Action" style="text-align: right;">
            <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
              <button type="button" class="btn btn-sm btn-secondary" onclick="adminDashboard.viewResultDetail('${att.id}')" title="Review student answer sheet">
                <span>📄 View Paper</span>
              </button>
              <button type="button" class="btn btn-sm btn-primary" onclick="adminDashboard.grantStudentReattemptByAttempt('${att.studentRegNo}', '${escapeHtml(att.subjectName)}', '${escapeHtml(att.studentName)}')" title="Allow student to re-take this exam" style="font-size: 0.72rem; padding: 0.25rem 0.5rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                <svg class="svg-icon" viewBox="0 0 24 24" style="width: 11px; height: 11px;"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Re-attempt</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  onAttendeesSearchInput(val) {
    this.attendeesSearchQuery = val;
    this.renderExamAttendeesModal();
  }

  filterAttendeesStatus(status, btnEl) {
    this.attendeesStatusFilter = status;
    document.querySelectorAll('.attendees-chips .chip-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    if (btnEl) btnEl.classList.add('active');
    this.renderExamAttendeesModal();
  }

  toggleAttendeesSort() {
    this.attendeesSortBy = this.attendeesSortBy === 'regNo' ? 'score' : 'regNo';
    const sortBtn = document.getElementById('attendees-sort-btn');
    if (sortBtn) {
      if (this.attendeesSortBy === 'regNo') {
        sortBtn.innerHTML = `<span>🔢 Roll No Order</span>`;
        sortBtn.title = "Sorted sequentially by Roll Number";
      } else {
        sortBtn.innerHTML = `<span>🏆 Score / Rank</span>`;
        sortBtn.title = "Sorted by Highest Score first";
      }
    }
    this.renderExamAttendeesModal();
  }

  exportAttendeesCSV() {
    const { subjectName, subjectAttempts } = this.getAttendeesDataForCurrentSubject();
    if (subjectAttempts.length === 0) {
      ui.showToast("No student records to export for this subject.", "warning");
      return;
    }

    // Sort by roll number for clean official spreadsheet records
    const sorted = [...subjectAttempts].sort((a, b) => {
      return String(a.studentRegNo || '').localeCompare(String(b.studentRegNo || ''), undefined, { numeric: true });
    });

    const headers = [
      'S.No',
      'Roll No (Reg No)',
      'Student Name',
      'Year',
      'Section',
      'Subject',
      'Score',
      'Total Questions',
      'Percentage (%)',
      'Result Status',
      'Cheating Warnings',
      'Exam Status',
      'Submitted Date'
    ];

    const violations = storage.getViolations();
    const rows = sorted.map((att, idx) => {
      const isPassed = (att.percentage || 0) >= 50;
      const studentViolations = violations.filter(v => 
        String(v.studentRegNo) === String(att.studentRegNo) && 
        (v.subjectName === att.subjectName || v.subjectId === att.subjectId)
      );
      const vCount = studentViolations.length > 0 ? Math.max(...studentViolations.map(v => v.count)) : (att.status === 'Auto Submitted' ? 3 : 0);
      const dateStr = att.submittedAt || att.startedAt ? new Date(att.submittedAt || att.startedAt).toISOString() : '';

      return [
        idx + 1,
        `"${String(att.studentRegNo).replace(/"/g, '""')}"`,
        `"${String(att.studentName || '').replace(/"/g, '""')}"`,
        `"${String(att.year || '').replace(/"/g, '""')}"`,
        `"${String(att.section || '').replace(/"/g, '""')}"`,
        `"${String(att.subjectName || subjectName).replace(/"/g, '""')}"`,
        att.score,
        att.totalQuestions,
        att.percentage,
        isPassed ? 'PASS' : 'FAIL',
        vCount,
        `"${String(att.status || 'Submitted').replace(/"/g, '""')}"`,
        `"${dateStr}"`
      ].join(',');
    });

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeSubName = subjectName.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.href = url;
    link.download = `Exam_Attendees_${safeSubName}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    ui.showToast(`Exported ${sorted.length} student records to CSV!`, 'success');
  }

  printAttendeesReport() {
    window.print();
  }

  promptClearAllDemoData() {
    this.closeDotsMenu();
    if (!confirm('Are you sure you want to clear ALL demo data (students, subjects, questions, test results, violations)?\n\nThis will give you a 100% clean slate! Default Admin credentials will remain intact.')) {
      return;
    }
    if (window.storage && typeof storage.resetAllData === 'function') {
      storage.resetAllData();
      if (window.ui && typeof ui.showToast === 'function') {
        ui.showToast('All demo data cleared successfully! Page will refresh.', 'success');
      }
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }
  }
}

const adminDashboard = new AdminDashboardController();
window.adminDashboard = adminDashboard;
window.toggleAdminDotsMenu = function(e) { adminDashboard.toggleDotsMenu(e); };
window.selectAdminDotsPanel = function(panelId) { adminDashboard.selectDotsPanel(panelId); };
window.toggleCustomSelect = function(dropdownId, e) { adminDashboard.toggleCustomSelect(dropdownId, e); };
window.selectCustomOption = function(dropdownId, value, labelText, filterType) { adminDashboard.selectCustomOption(dropdownId, value, labelText, filterType); };
