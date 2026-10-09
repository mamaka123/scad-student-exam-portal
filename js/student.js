/* ==========================================================================
   Student JS - Dashboard UI Controller & Available Subjects
   ========================================================================== */

class StudentDashboardController {
  constructor() {
    this.currentStudent = null;
  }

  renderDashboard() {
    const session = storage.getActiveSession();
    if (!session || session.role !== 'student') return;

    this.currentStudent = session.user;
    this.updateHeaderProfile();
    this.renderStats();
    this.renderAvailableSubjects();
    this.renderAttemptHistory();
  }

  updateHeaderProfile() {
    if (!this.currentStudent) return;
    const nameEl = document.getElementById('student-profile-name');
    const regEl = document.getElementById('student-profile-reg');
    const metaEl = document.getElementById('student-profile-meta');
    const avatarEl = document.getElementById('student-avatar-initial');

    if (nameEl) nameEl.textContent = this.currentStudent.name;
    if (regEl) {
      regEl.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 1.1rem; height: 1.1rem; vertical-align: middle;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Reg No: ${escapeHtml(this.currentStudent.regNo)}</span>
      `;
    }
    if (metaEl) metaEl.textContent = `${this.currentStudent.year} • Sec ${this.currentStudent.section}`;
    if (avatarEl && this.currentStudent.name) {
      avatarEl.textContent = this.currentStudent.name.charAt(0).toUpperCase();
    }
  }

  renderStats() {
    const attempts = storage.getAttempts().filter(a =>
      a.studentRegNo && a.studentRegNo.toString().trim() === this.currentStudent.regNo.toString().trim()
    );
    const totalTaken = attempts.length;

    let avgScore = 0;
    let highPct = 0;

    if (totalTaken > 0) {
      const sumPct = attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      avgScore = Math.round(sumPct / totalTaken);
      highPct = Math.max(...attempts.map(a => a.percentage || 0));
    }

    const totalExamsEl = document.getElementById('stat-total-exams');
    const avgScoreEl = document.getElementById('stat-avg-score');
    const highPctEl = document.getElementById('stat-highest-pct');

    if (totalExamsEl) totalExamsEl.textContent = totalTaken;
    if (avgScoreEl) avgScoreEl.textContent = `${avgScore}%`;
    if (highPctEl) highPctEl.textContent = `${highPct}%`;
  }

  renderAvailableSubjects() {
    const grid = document.getElementById('student-subjects-grid');
    if (!grid) return;

    const allSubjects = storage.getSubjects();
    const allQuestions = storage.getQuestions();
    const attempts = storage.getAttempts().filter(a => a.studentRegNo.toString() === this.currentStudent.regNo.toString());

    // Filter subjects matching Student's Year and Section (or Section 'All')
    const assignedSubjects = allSubjects.filter(sub => {
      const yearMatch = sub.year.trim().toLowerCase() === this.currentStudent.year.trim().toLowerCase();
      const secMatch = !sub.section || sub.section === 'All' || sub.section.toString().toUpperCase() === this.currentStudent.section.toString().toUpperCase();
      return yearMatch && secMatch;
    });

    // Count Admin-Uploaded Coding Questions for Current Student
    const studentYear = (this.currentStudent.year || '').trim().toLowerCase();
    const studentSec = (this.currentStudent.section || '').trim().toLowerCase();
    const adminCodingQuestions = allQuestions.filter(q => {
      if (q.type !== 'coding') return false;
      const qYear = (q.year || 'All').trim().toLowerCase();
      const qSec = (q.section || 'All').trim().toLowerCase();
      const yearMatch = qYear === 'all' || qYear === studentYear;
      const secMatch = qSec === 'all' || qSec === studentSec;
      return yearMatch && secMatch;
    });

    // Check if student has coding lab submissions
    const codingLabAttempt = attempts.find(a => a.type === 'coding_lab' || (a.subjectName && a.subjectName.toLowerCase().includes('compiler')));

    const codingFacultySet = new Set();
    adminCodingQuestions.forEach(q => {
      const fName = q.createdByName || storage.getAdminDisplayName(q.createdBy, '');
      if (fName) codingFacultySet.add(fName);
    });
    const codingFacultyLabel = codingFacultySet.size > 0 ? Array.from(codingFacultySet).join(', ') : 'Faculty Staff';

    const compilerCardHtml = `
      <div class="subject-card online-compiler-card">
        <div>
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
            <span class="subject-tag">LAB • ${escapeHtml(this.currentStudent.year || '1st Year')}</span>
            <span class="badge" style="font-size: 0.74rem; background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); padding: 0.2rem 0.55rem; border-radius: 999px; font-weight: 700;">👨‍🏫 Staff: ${escapeHtml(codingFacultyLabel)}</span>
          </div>
          <h3 class="subject-name">Online Compiler & Practical Lab</h3>
          <p class="subject-desc">Execute code real-time in Python, C, C++, Java & JS. Solve Admin-assigned programming questions.</p>
        </div>
        <div>
          <div class="subject-meta-row">
            <span class="subject-meta-item">
              <svg class="svg-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg> Live Runner
            </span>
            <span class="subject-meta-item">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> ${adminCodingQuestions.length} Problem${adminCodingQuestions.length === 1 ? '' : 's'}
            </span>
          </div>
          ${
            codingLabAttempt ? `
              <div class="card-result-badge" style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.85rem; font-weight: 600; color: #10b981;">Score: ${codingLabAttempt.earnedMarks !== undefined ? codingLabAttempt.earnedMarks : codingLabAttempt.score}/${codingLabAttempt.totalMarks || 10} Marks</span>
                <span class="badge badge-success">COMPLETED</span>
              </div>
            ` : ''
          }
          <div style="margin-top: 0.85rem;">
            ${
              codingLabAttempt ? `
                <button class="btn btn-success" style="width: 100%;" onclick="studentDashboard.openCodingLabModal()">
                  <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> Open Coding Lab
                </button>
              ` : `
                <button class="btn btn-primary" style="width: 100%;" onclick="studentDashboard.openCodingLabModal()">
                  Start Online Compiler
                </button>
              `
            }
          </div>
        </div>
      </div>
    `;

    // Retrieve Student's Description & Answer Notes
    const studentNotesKey = `lms_student_notes_${this.currentStudent.regNo}`;
    const savedNotes = (localStorage.getItem(studentNotesKey) || '').trim();
    const hasNotes = savedNotes.length > 0;
    const wordsCount = hasNotes ? savedNotes.split(/\s+/).length : 0;
    const notesSnippet = hasNotes 
      ? escapeHtml(savedNotes.length > 120 ? savedNotes.substring(0, 120) + '...' : savedNotes)
      : 'Save your study descriptions, theory answers, formulas, or key points for quick copying.';

    const notesCardHtml = `
      <div class="subject-card student-notes-card">
        <div>
          <span class="subject-tag notes-tag">NOTES • ${escapeHtml(this.currentStudent.year || '1st Year')}</span>
          <h3 class="subject-name">Student Description &amp; Answers</h3>
          <p class="subject-desc" title="${hasNotes ? escapeHtml(savedNotes) : ''}">${notesSnippet}</p>
        </div>
        <div>
          <div class="subject-meta-row">
            <span class="subject-meta-item">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${wordsCount} Word${wordsCount === 1 ? '' : 's'}
            </span>
            <span class="subject-meta-item" style="color: #10b981; font-weight: 600;">
              <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Ready to Copy
            </span>
          </div>
          <div style="margin-top: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
            <button type="button" class="btn btn-outline" onclick="studentDashboard.copyStudentDescriptionNotes(this)" title="Copy saved answers and description" style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.58rem 0.35rem; font-size: 0.82rem; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span class="btn-copy-label">Copy Answer</span>
            </button>
            <button type="button" class="btn btn-primary" onclick="studentDashboard.openStudentNotesModal()" title="Add or edit your study description and answers" style="display: flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.58rem 0.35rem; font-size: 0.82rem; font-weight: 600; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              <span>Add / Edit</span>
            </button>
          </div>
        </div>
      </div>
    `;

    if (assignedSubjects.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem 1.5rem; text-align: center; background: var(--bg-card); border-radius: var(--radius-lg); border: 1px dashed var(--border-color);">
          <div class="empty-state-icon" style="margin-bottom: 0.8rem;">
            <svg class="svg-icon" viewBox="0 0 24 24" style="width: 2.5rem; height: 2.5rem; opacity: 0.5;"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <h3 style="margin-bottom: 0.5rem; font-size: 1.15rem;">No Multiple Choice Subjects Assigned Yet</h3>
          <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 420px; margin: 0 auto; line-height: 1.5;">When your Admin adds exam subjects, they will appear here. In the meantime, you can access your Online Compiler Lab on the right!</p>
        </div>
        ${compilerCardHtml}
        ${notesCardHtml}
      `;
      return;
    }

    const subjectsHtml = assignedSubjects.map(subject => {
      const subjectQuestions = allQuestions.filter(q => 
        (q.subjectId && subject.id && String(q.subjectId).trim().toLowerCase() === String(subject.id).trim().toLowerCase()) ||
        (q.subjectName && subject.name && q.subjectName.trim().toLowerCase() === subject.name.trim().toLowerCase()) ||
        (q.subject && subject.name && q.subject.trim().toLowerCase() === subject.name.trim().toLowerCase())
      );
      const pastAttempt = attempts.find(a => a.subjectId === subject.id || (a.subjectName && a.subjectName.toLowerCase() === subject.name.toLowerCase()));
      
      const qCount = subjectQuestions.length;
      const canStart = qCount > 0;
      const facultyName = subject.createdByName || storage.getAdminDisplayName(subject.createdBy, 'Faculty Staff');

      return `
        <div class="subject-card">
          <div>
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <span class="subject-tag">${subject.code || 'COURSE'} • ${subject.year}</span>
              <span class="badge" style="font-size: 0.74rem; background: rgba(99, 102, 241, 0.12); color: #818cf8; border: 1px solid rgba(99, 102, 241, 0.3); padding: 0.2rem 0.55rem; border-radius: 999px; font-weight: 700;">👨‍🏫 Staff: ${escapeHtml(facultyName)}</span>
            </div>
            <h3 class="subject-name">${escapeHtml(subject.name)}</h3>
            <p class="subject-desc">${escapeHtml(subject.description || 'Comprehensive multiple choice online assessment.')}</p>
          </div>
          <div>
            <div class="subject-meta-row">
              <span class="subject-meta-item">
                <svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> ${subject.duration || 30} Mins
              </span>
              <span class="subject-meta-item">
                <svg class="svg-icon" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${
                  subjectQuestions.filter(q => q.type === 'coding').length > 0 
                  ? `${subjectQuestions.filter(q => q.type !== 'coding').length} MCQs + ${subjectQuestions.filter(q => q.type === 'coding').length} Coding` 
                  : `${qCount} Questions`
                }
              </span>
            </div>
            ${
              pastAttempt ? `
                <div class="card-result-badge" style="margin-top: 0.75rem; padding: 0.5rem 0.75rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: #34d399;">Score: ${pastAttempt.earnedMarks !== undefined ? pastAttempt.earnedMarks : pastAttempt.score}/${pastAttempt.totalMarks || pastAttempt.totalQuestions} Marks (${pastAttempt.percentage}%)</span>
                  <span class="badge ${pastAttempt.percentage >= 50 ? 'badge-success' : 'badge-danger'}">${pastAttempt.percentage >= 50 ? 'PASSED' : 'FAILED'}</span>
                </div>
              ` : ''
            }
            <div style="margin-top: 0.85rem;">
              ${
                canStart 
                ? (pastAttempt ? `
                    <button class="btn btn-success" style="width: 100%;" onclick="studentDashboard.viewAttemptDetail('${pastAttempt.id}')">
                      <svg class="svg-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> View Exam Result
                    </button>
                  ` : `
                    <button class="btn btn-primary" style="width: 100%;" onclick="studentDashboard.startExamPrompt('${subject.id}')">
                      Start Exam
                    </button>
                  `)
                : `<button class="btn btn-secondary" style="width: 100%; opacity: 0.6; cursor: not-allowed;" disabled>
                    No Questions Yet
                   </button>`
              }
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Place the Online Compiler Card and Notes Card right alongside the assigned subjects
    grid.innerHTML = (assignedSubjects.length === 0 ? '' : subjectsHtml) + compilerCardHtml + notesCardHtml;
  }

  renderAttemptHistory() {
    const tableBody = document.getElementById('student-attempts-tbody');
    if (!tableBody) return;

    const attempts = storage.getAttempts().filter(a =>
      a.studentRegNo && a.studentRegNo.toString().trim() === this.currentStudent.regNo.toString().trim()
    );

    if (attempts.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-icon">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 2.5rem; height: 2.5rem;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <p>No exam attempts recorded yet. Select a subject above to begin.</p>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = attempts.map(att => {
      const dateStr = new Date(att.submittedAt || att.startedAt).toLocaleString();
      const statusBadge = att.status === 'Auto Submitted'
        ? `<span class="badge badge-warning">Auto Submitted</span>`
        : `<span class="badge badge-success">Submitted</span>`;
      const attFaculty = att.createdByName || storage.getAdminDisplayName(att.createdBy, 'Faculty Staff');

      return `
        <tr>
          <td data-label="Subject">
            <strong>${escapeHtml(att.subjectName)}</strong>
            <div style="font-size: 0.75rem; color: #818cf8; margin-top: 2px; font-weight: 600;">👨‍🏫 Staff: ${escapeHtml(attFaculty)}</div>
          </td>
          <td data-label="Score">${att.earnedMarks !== undefined ? att.earnedMarks : att.score} / ${att.totalMarks || att.totalQuestions} Marks</td>
          <td data-label="Percentage"><strong style="color: ${att.percentage >= 50 ? '#34d399' : '#f87171'}">${att.percentage}%</strong></td>
          <td data-label="Status">${statusBadge}</td>
          <td data-label="Submitted">${dateStr}</td>
          <td class="actions-cell" data-label="Action">
            <button class="btn btn-secondary btn-icon" onclick="studentDashboard.viewAttemptDetail('${att.id}')" title="View Details">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Details
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  startExamPrompt(subjectId) {
    const subject = storage.getSubjects().find(s => s.id === subjectId);
    if (!subject) return;

    examEngine.showRulesModal(subject);
  }

  viewAttemptDetail(attemptId) {
    if (!attemptId) {
      ui.showToast('No exam attempt selected.', 'warning');
      return;
    }
    const cleanId = String(attemptId).trim().toLowerCase();
    const attempts = storage.getAttempts() || [];
    const attempt = attempts.find(a => 
      (a.id && String(a.id).trim().toLowerCase() === cleanId) ||
      (a.subjectId && String(a.subjectId).trim().toLowerCase() === cleanId) ||
      (a.subjectName && a.subjectName.trim().toLowerCase() === cleanId)
    );
    if (!attempt) {
      ui.showToast('Exam attempt record not found.', 'warning');
      return;
    }

    examEngine.renderResultModal(attempt);
  }

  showStudentProfileModal() {
    if (!this.currentStudent) {
      const session = storage.getActiveSession();
      if (session && session.user) {
        this.currentStudent = session.user;
      }
    }
    if (!this.currentStudent) return;

    const nameEl = document.getElementById('profile-modal-name');
    const regEl = document.getElementById('profile-modal-reg');
    const yearEl = document.getElementById('profile-modal-year');
    const sectionEl = document.getElementById('profile-modal-section');
    const avatarEl = document.getElementById('profile-modal-avatar');

    if (nameEl) nameEl.textContent = this.currentStudent.name || 'N/A';
    if (regEl) regEl.textContent = this.currentStudent.regNo || 'N/A';
    if (yearEl) yearEl.textContent = this.currentStudent.year || 'N/A';
    if (sectionEl) sectionEl.textContent = `Section ${this.currentStudent.section || 'A'}`;
    if (avatarEl && this.currentStudent.name) {
      avatarEl.textContent = this.currentStudent.name.charAt(0).toUpperCase();
    }

    // Filter attempts for active student
    const attempts = storage.getAttempts().filter(a =>
      a.studentRegNo && a.studentRegNo.toString().trim() === this.currentStudent.regNo.toString().trim()
    );

    const totalExams = attempts.length;
    let avgPct = 0;
    let highestPct = 0;
    let totalViolations = 0;

    if (totalExams > 0) {
      const sumPct = attempts.reduce((acc, curr) => acc + (curr.percentage || 0), 0);
      avgPct = Math.round(sumPct / totalExams);
      highestPct = Math.max(...attempts.map(a => a.percentage || 0));
      totalViolations = attempts.reduce((acc, curr) => acc + (curr.warnings || 0), 0);
    }

    const statTotalEl = document.getElementById('profile-modal-total-exams');
    const statAvgEl = document.getElementById('profile-modal-avg-score');
    const statHighEl = document.getElementById('profile-modal-highest-score');
    const statViolationsEl = document.getElementById('profile-modal-violations');

    if (statTotalEl) statTotalEl.textContent = totalExams;
    if (statAvgEl) statAvgEl.textContent = `${avgPct}%`;
    if (statHighEl) statHighEl.textContent = `${highestPct}%`;
    if (statViolationsEl) statViolationsEl.textContent = totalViolations;

    // Populate Attempt History in Profile Modal
    const historyTbody = document.getElementById('profile-modal-history-tbody');
    if (historyTbody) {
      if (attempts.length === 0) {
        historyTbody.innerHTML = `
          <tr>
            <td colspan="4" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">
              No exam attempts recorded yet.
            </td>
          </tr>
        `;
      } else {
        historyTbody.innerHTML = attempts.map(att => {
          const dateStr = att.timestamp ? new Date(att.timestamp).toLocaleString() : 'N/A';
          const isPassed = att.percentage >= 40;
          const statusBadge = isPassed
            ? `<span class="badge badge-success">Passed</span>`
            : `<span class="badge badge-danger">Failed</span>`;

          return `
            <tr>
              <td data-label="Subject" style="font-weight: 600;">${escapeHtml(att.subjectName || 'N/A')}</td>
              <td data-label="Score">${att.earnedMarks !== undefined ? att.earnedMarks : att.score}/${att.totalMarks || att.totalQuestions} Marks (${att.percentage}%)</td>
              <td data-label="Result">${statusBadge}</td>
              <td data-label="Date & Time" style="font-size: 0.8rem; color: var(--text-muted);">${dateStr}</td>
            </tr>
          `;
        }).join('');
      }
    }

    ui.showModal('modal-student-profile');
  }

  /* ==========================================================================
     STANDALONE CODING LAB / ONLINE IDE STUDIO CONTROLLER
     ========================================================================== */

  openCodingLabModal(targetQId = null) {
    ui.showModal('modal-coding-lab');
    const editor = document.getElementById('lab-coding-editor');
    
    // Apply saved theme and layout preferences
    this.applySavedLabSettings();

    // Load Admin-assigned coding questions for current student
    this.loadAdminCodingQuestions(targetQId);

    // On tablet & mobile (<= 1024px), if no specific question requested, collapse drawer to show editor immediately
    if (window.innerWidth <= 1024 && !targetQId) {
      this.toggleLabProblemDrawer(false);
    }

    const langSelect = document.getElementById('lab-compiler-language');
    const currentLang = langSelect ? langSelect.value : 'python';

    // Keep editor clean (do not auto-populate starter code)
    if (editor) {
      this.syncLabLineNumbers(editor);
      this.syncLabHighlight(editor);
      this.updateCursorPosition(editor);
    }
    this.updateLabFileTabInfo(currentLang);
  }

  toggleLabProblemDrawer(forceState = null) {
    const drawer = document.getElementById('lab-problem-drawer');
    const toggleBtn = document.getElementById('btn-lab-toggle-problem');
    const backdrop = document.getElementById('lab-drawer-backdrop');
    if (!drawer) return;

    if (typeof forceState === 'boolean') {
      drawer.classList.toggle('collapsed', !forceState);
    } else {
      drawer.classList.toggle('collapsed');
    }

    const isExpanded = !drawer.classList.contains('collapsed');
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', isExpanded);
    }
    if (backdrop) {
      backdrop.classList.toggle('active', isExpanded);
    }
  }

  loadAdminCodingQuestions(targetQId = null) {
    const select = document.getElementById('lab-problem-select');
    const badgeCount = document.getElementById('lab-prob-count-badge');
    const allQuestions = storage.getQuestions();

    const studentYear = (this.currentStudent.year || '').trim().toLowerCase();
    const studentSec = (this.currentStudent.section || '').trim().toLowerCase();

    // Filter questions uploaded by admin that match student's year & section (or All)
    this.assignedCodingQuestions = allQuestions.filter(q => {
      if (q.type !== 'coding') return false;
      const qYear = (q.year || 'All').trim().toLowerCase();
      const qSec = (q.section || 'All').trim().toLowerCase();
      const yearMatch = qYear === 'all' || qYear === studentYear;
      const secMatch = qSec === 'all' || qSec === studentSec;
      return yearMatch && secMatch;
    });

    // Fallback 1: If no specific question matches student's year/section, show any available coding questions
    if (this.assignedCodingQuestions.length === 0) {
      this.assignedCodingQuestions = allQuestions.filter(q => q.type === 'coding');
    }

    // If none assigned or in storage, show clean Free Practice Mode (no auto-seeding demo questions)
    if (this.assignedCodingQuestions.length === 0) {
      if (badgeCount) badgeCount.textContent = '0';
      if (select) {
        select.innerHTML = '<option value="">Free Practice Mode (No Questions Assigned)</option>';
        select.value = '';
      }
      this.activeCodingQuestion = null;
      this.renderLabProblemDetails(null);
      return;
    }

    if (badgeCount) {
      badgeCount.textContent = this.assignedCodingQuestions.length;
    }

    if (!select) return;

    select.innerHTML = this.assignedCodingQuestions.map((q, idx) => {
      const qTitle = q.title || (q.text ? q.text.split('\n')[0].replace(/^#*\s*/, '').substring(0, 30) : `Problem ${idx + 1}`);
      const qFaculty = q.createdByName || storage.getAdminDisplayName(q.createdBy, 'Faculty Staff');
      return `<option value="${escapeHtml(q.id)}">Q${idx + 1}: ${escapeHtml(qTitle)} (${q.marks || 10}M) • 👨‍🏫 ${escapeHtml(qFaculty)}</option>`;
    }).join('');

    const initialQId = targetQId || this.assignedCodingQuestions[0].id;
    select.value = initialQId;
    this.onLabProblemChange(initialQId, true);
  }

  onLabProblemChange(qId, isInitial = false) {
    if (!this.assignedCodingQuestions || this.assignedCodingQuestions.length === 0) {
      this.renderLabProblemDetails(null);
      return;
    }

    const q = this.assignedCodingQuestions.find(item => item.id === qId) || this.assignedCodingQuestions[0];
    this.activeCodingQuestion = q;
    this.renderLabProblemDetails(q);

    // Sync IDE language with the question's specified language
    if (q && q.language) {
      const LANG_META = {
        python: { label: 'Python 3', ver: '3.8.1', icon: '🐍' },
        javascript: { label: 'JavaScript', ver: 'Node 18', icon: '⚡' },
        c: { label: 'C (GCC)', ver: '9.2.0', icon: '⚙️' },
        cpp: { label: 'C++ (GCC)', ver: '9.2.0', icon: '🚀' },
        java: { label: 'Java (OpenJDK)', ver: '13.0.1', icon: '☕' }
      };
      const meta = LANG_META[q.language.toLowerCase()] || LANG_META.python;
      this.selectLabLanguage(q.language.toLowerCase(), meta.label, meta.ver, meta.icon);
    }

    // Do not automatically show or overwrite code in the editor
    const editor = document.getElementById('lab-coding-editor');
    if (editor) {
      this.syncLabLineNumbers(editor);
      this.syncLabHighlight(editor);
    }

    // Set sample input into Stdin if present
    const stdinEl = document.getElementById('lab-coding-stdin');
    if (stdinEl && q && q.sampleInput !== undefined) {
      stdinEl.value = q.sampleInput;
      this.onLabStdinInput(stdinEl);
    }
  }

  renderLabProblemDetails(q) {
    const titleEl = document.getElementById('lab-prob-title');
    const descEl = document.getElementById('lab-prob-desc');
    const marksEl = document.getElementById('lab-prob-marks');
    const yearEl = document.getElementById('lab-prob-year');
    const langEl = document.getElementById('lab-prob-lang');
    const topicEl = document.getElementById('lab-prob-topic');
    const facultyEl = document.getElementById('lab-prob-faculty');
    const sampleInEl = document.getElementById('lab-prob-sample-input');
    const expOutEl = document.getElementById('lab-prob-expected-output');
    const resultsWrap = document.getElementById('lab-test-results-wrap');

    if (resultsWrap) resultsWrap.style.display = 'none';

    if (!q) {
      if (titleEl) titleEl.textContent = 'Free Practice Mode';
      if (descEl) descEl.textContent = 'No specific coding questions uploaded by Admin for your batch yet. You can write, execute, and test any program in Python, C, C++, Java, or JavaScript.';
      if (marksEl) marksEl.textContent = 'Practice';
      if (sampleInEl) sampleInEl.textContent = '(none)';
      if (expOutEl) expOutEl.textContent = '(none)';
      if (facultyEl) facultyEl.textContent = '👨‍🏫 Staff: Faculty';
      return;
    }

    const problemTitle = q.title || (q.text ? q.text.split('\n')[0].replace(/^#*\s*/, '') : 'Coding Challenge');
    const facultyName = q.createdByName || storage.getAdminDisplayName(q.createdBy, 'Faculty Staff');
    if (titleEl) titleEl.textContent = problemTitle;
    if (descEl) descEl.textContent = q.text || q.question || 'Solve the programming challenge.';
    if (marksEl) marksEl.textContent = `${q.marks || 10} Marks`;
    if (yearEl) yearEl.textContent = `${q.year || this.currentStudent.year}`;
    if (langEl) langEl.textContent = (q.language || 'python').toUpperCase();
    if (topicEl) topicEl.textContent = q.chapter || 'Practical Lab';
    if (facultyEl) facultyEl.textContent = `👨‍🏫 Staff: ${facultyName}`;
    if (sampleInEl) sampleInEl.textContent = q.sampleInput || '(no input required)';
    if (expOutEl) expOutEl.textContent = q.expectedOutput || '(not specified)';
  }

  loadAdminStarterCode() {
    if (!this.activeCodingQuestion) return;
    const editor = document.getElementById('lab-coding-editor');
    if (!editor) return;
    const code = this.activeCodingQuestion.starterCode || this.getLabStarterCode(this.activeCodingQuestion.language || 'python');
    editor.value = code;
    this.syncLabLineNumbers(editor);
    this.syncLabHighlight(editor);
    this.updateCursorPosition(editor);
    ui.showToast('Loaded Admin starter code template.', 'info');
    if (window.innerWidth <= 1024) {
      this.toggleLabProblemDrawer(false);
    }
  }

  loadAdminSampleInput() {
    if (!this.activeCodingQuestion) return;
    const stdinEl = document.getElementById('lab-coding-stdin');
    const panel = document.getElementById('lab-compiler-stdin-panel');
    const toggleBtn = document.getElementById('btn-lab-toggle-stdin');
    if (stdinEl) {
      stdinEl.value = this.activeCodingQuestion.sampleInput || '';
      this.onLabStdinInput(stdinEl);
      if (panel && !panel.classList.contains('active')) {
        panel.classList.add('active');
        if (toggleBtn) toggleBtn.classList.add('active');
      }
      stdinEl.focus();
      ui.showToast('Sample input loaded into Stdin.', 'info');
      if (window.innerWidth <= 1024) {
        this.toggleLabProblemDrawer(false);
      }
    }
  }

  async testLabTestCases() {
    if (!this.activeCodingQuestion) {
      ui.showToast('No active question to test.', 'warning');
      return;
    }

    const q = this.activeCodingQuestion;
    const editor = document.getElementById('lab-coding-editor');
    const code = editor ? editor.value.trim() : '';

    if (!code) {
      ui.showToast('Please write code in the editor first.', 'warning');
      return;
    }

    const resultsWrap = document.getElementById('lab-test-results-wrap');
    const listEl = document.getElementById('lab-test-cases-list');
    if (resultsWrap) resultsWrap.style.display = 'block';
    if (listEl) listEl.innerHTML = `<div style="color: #a5b4fc; padding: 0.5rem 0;">⏳ Running test cases against Admin expected output...</div>`;

    const rawTestCases = (window.examEngine && typeof window.examEngine.getQuestionTestCases === 'function')
      ? window.examEngine.getQuestionTestCases(q)
      : [];

    const testCases = rawTestCases.length > 0 ? rawTestCases.map((tc, idx) => ({
      num: idx + 1,
      name: tc.name || `Test Case ${idx + 1}`,
      input: tc.input || '',
      expected: (tc.expected || '').trim()
    })) : [
      {
        num: 1,
        name: 'Sample Test Case',
        input: q.sampleInput || '',
        expected: (q.expectedOutput || '').trim()
      }
    ];

    let allPassed = true;
    let passedCount = 0;
    const cardsHtml = [];
    const testDetails = [];

    const langSelect = document.getElementById('lab-compiler-language');
    const activeLang = (langSelect && langSelect.value) || (q && q.language) || 'python';

    for (const tc of testCases) {
      try {
        let result = await this.executeSourceCodeDirect(code, activeLang, tc.input);
        const actualOut = (result.stdout || '').trim().replace(/\r\n/g, '\n');
        const cleanExpected = tc.expected.replace(/\r\n/g, '\n');
        const isMatch = actualOut === cleanExpected;

        testDetails.push({
          num: tc.num,
          name: tc.name || `Test Case ${tc.num}`,
          input: tc.input || '',
          expected: cleanExpected,
          actual: actualOut,
          passed: isMatch,
          error: result.stderr || null
        });

        if (isMatch) {
          passedCount++;
          cardsHtml.push(`
            <div class="testcase-card passed">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: #34d399; margin-bottom: 0.25rem;">
                <span>✅ Test Case ${tc.num}: Passed</span>
                <span>Output Match</span>
              </div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.74rem; color: #94a3b8;">Input: ${escapeHtml(tc.input || '(empty)')} | Output: ${escapeHtml(actualOut)}</div>
            </div>
          `);
        } else {
          allPassed = false;
          cardsHtml.push(`
            <div class="testcase-card failed">
              <div style="display: flex; justify-content: space-between; font-weight: 700; color: #f87171; margin-bottom: 0.25rem;">
                <span>❌ Test Case ${tc.num}: Failed</span>
                <span>Mismatch</span>
              </div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.74rem; color: #cbd5e1;">Expected: <strong style="color: #34d399;">${escapeHtml(cleanExpected)}</strong></div>
              <div style="font-family: var(--font-mono, monospace); font-size: 0.74rem; color: #fca5a5;">Your Output: ${escapeHtml(actualOut || '(no output / error)')}</div>
            </div>
          `);
        }
      } catch (err) {
        allPassed = false;
        testDetails.push({
          num: tc.num,
          name: tc.name || `Test Case ${tc.num}`,
          input: tc.input || '',
          expected: tc.expected,
          actual: '',
          passed: false,
          error: err.message
        });
        cardsHtml.push(`
          <div class="testcase-card failed">
            <div style="font-weight: 700; color: #f87171;">❌ Test Case ${tc.num}: Execution Error</div>
            <div style="font-size: 0.74rem; color: #fca5a5;">${escapeHtml(err.message)}</div>
          </div>
        `);
      }
    }

    if (listEl) {
      listEl.innerHTML = cardsHtml.join('') + `
        <div style="margin-top: 0.5rem; font-weight: 700; font-size: 0.82rem; color: ${allPassed ? '#34d399' : '#f87171'};">
          Summary: ${passedCount} / ${testCases.length} Test Cases Passed (${Math.round((passedCount / testCases.length) * 100)}%)
        </div>
      `;
    }

    ui.showToast(allPassed ? 'All test cases passed successfully!' : `${passedCount}/${testCases.length} test cases passed.`, allPassed ? 'success' : 'warning');
    return { allPassed, passedCount, total: testCases.length, details: testDetails };
  }

  async executeSourceCodeDirect(code, lang, stdin) {
    const langKey = (lang || 'python').toLowerCase();
    const PISTON_LANG_MAP = {
      python: { language: 'python', version: '3.10.0' },
      javascript: { language: 'javascript', version: '18.15.0' },
      c: { language: 'c', version: '10.2.0' },
      cpp: { language: 'cpp', version: '10.2.0' },
      java: { language: 'java', version: '15.0.2' }
    };
    const targetConfig = PISTON_LANG_MAP[langKey] || PISTON_LANG_MAP.python;

    const resp = await fetch('https://emkc.org/api/v2/piston/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        language: targetConfig.language,
        version: targetConfig.version,
        files: [{ content: code }],
        stdin: stdin || ''
      })
    });

    if (!resp.ok) throw new Error(`Compiler API responded with ${resp.status}`);
    const data = await resp.json();
    return {
      stdout: data.run ? data.run.stdout : '',
      stderr: data.run ? data.run.stderr : ''
    };
  }

  async submitLabSolution() {
    if (!this.activeCodingQuestion) {
      ui.showToast('No active problem selected to submit.', 'warning');
      return;
    }

    const q = this.activeCodingQuestion;
    const editor = document.getElementById('lab-coding-editor');
    const code = editor ? editor.value.trim() : '';

    if (!code) {
      ui.showToast('Please write code before submitting.', 'warning');
      return;
    }

    const evalResult = await this.testLabTestCases();
    if (!evalResult) return;

    const totalMarks = q.marks || 10;
    const earnedMarks = Math.round((evalResult.passedCount / evalResult.total) * totalMarks);
    const pct = Math.round((earnedMarks / totalMarks) * 100);

    const langSelect = document.getElementById('lab-compiler-language');
    const activeLang = (langSelect && langSelect.value) || (q && q.language) || 'python';

    const submissionAttempt = {
      id: `att-coding-${Date.now()}`,
      studentRegNo: this.currentStudent.regNo,
      studentName: this.currentStudent.name,
      year: this.currentStudent.year,
      section: this.currentStudent.section,
      subjectId: q.subjectId || 'coding-lab',
      subjectName: q.subject || 'Online Compiler Practical Lab',
      problemTitle: q.title || (q.text ? q.text.split('\n')[0].replace(/^#*\s*/, '').substring(0, 45) : 'Coding Challenge'),
      language: activeLang,
      submittedCode: code,
      code: code,
      score: earnedMarks,
      earnedMarks: earnedMarks,
      totalMarks: totalMarks,
      totalQuestions: 1,
      percentage: pct,
      status: 'Submitted',
      type: 'coding_lab',
      testCasesSummary: `${evalResult.passedCount} / ${evalResult.total} passed`,
      testCaseResults: evalResult.details || [],
      startedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      evaluatedAnswers: [{
        questionId: q.id,
        questionText: q.title || q.text,
        type: 'coding',
        language: activeLang,
        submittedCode: code,
        marks: earnedMarks,
        maxMarks: totalMarks,
        passed: evalResult.allPassed,
        testCaseResults: evalResult.details || []
      }]
    };

    // Save to storage
    const attempts = storage.getAttempts();
    attempts.unshift(submissionAttempt);
    storage.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);

    // Sync UI
    this.updateStudentStats();
    this.renderAttemptHistory();
    this.renderAvailableSubjects();

    ui.showToast(`Solution Submitted! Score: ${earnedMarks}/${totalMarks} Marks (${pct}%)`, evalResult.allPassed ? 'success' : 'info');
  }

  /* Theme and Layout State Management */
  applySavedLabSettings() {
    // 1. Theme (Dark / Light)
    const savedTheme = localStorage.getItem('lab_ide_theme') || 'dark';
    const ideWindow = document.getElementById('lab-ide-window');
    const themeIcon = document.getElementById('lab-theme-icon');
    const themeText = document.getElementById('lab-theme-text');
    const btnTheme = document.getElementById('btn-lab-theme');

    if (ideWindow) {
      if (savedTheme === 'light') {
        ideWindow.classList.add('theme-light');
        if (themeIcon) themeIcon.textContent = '☀️';
        if (themeText) themeText.textContent = 'Light';
        if (btnTheme) btnTheme.title = 'Switch to Dark Theme';
      } else {
        ideWindow.classList.remove('theme-light');
        if (themeIcon) themeIcon.textContent = '🌙';
        if (themeText) themeText.textContent = 'Dark';
        if (btnTheme) btnTheme.title = 'Switch to Light Theme';
      }
    }

    // 2. Output Placement Layout (Side-by-Side Right / Stacked Bottom)
    const savedLayout = localStorage.getItem('lab_ide_layout') || 'side';
    const workspaceBody = document.getElementById('lab-workspace-body');
    const btnLayout = document.getElementById('btn-lab-layout');
    const layoutText = document.getElementById('lab-layout-text');

    if (workspaceBody) {
      if (savedLayout === 'stacked') {
        workspaceBody.classList.add('layout-stacked');
        if (btnLayout) btnLayout.classList.remove('active');
        if (layoutText) layoutText.textContent = 'Bottom View';
      } else {
        workspaceBody.classList.remove('layout-stacked');
        if (btnLayout) btnLayout.classList.add('active');
        if (layoutText) layoutText.textContent = 'Right Output';
      }
    }
  }

  toggleLabTheme() {
    const ideWindow = document.getElementById('lab-ide-window');
    const isLight = ideWindow && ideWindow.classList.contains('theme-light');
    const newTheme = isLight ? 'dark' : 'light';
    localStorage.setItem('lab_ide_theme', newTheme);
    this.applySavedLabSettings();
    ui.showToast(`Switched to ${newTheme.toUpperCase()} theme`, 'info');
  }

  toggleLabLayout() {
    const workspaceBody = document.getElementById('lab-workspace-body');
    const isStacked = workspaceBody && workspaceBody.classList.contains('layout-stacked');
    const newLayout = isStacked ? 'side' : 'stacked';
    localStorage.setItem('lab_ide_layout', newLayout);
    this.applySavedLabSettings();
    ui.showToast(newLayout === 'side' ? 'Output placed on Right Side' : 'Output placed on Bottom', 'info');
  }

  /* Multi-Language Syntax Tokenizer Engine */
  highlightCode(code, lang) {
    if (!code) return '';

    const escape = (str) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    // Language token dictionary definitions
    const LANG_DATA = {
      python: {
        keywords: new Set([
          'def', 'class', 'return', 'import', 'from', 'as', 'if', 'elif', 'else',
          'while', 'for', 'in', 'try', 'except', 'finally', 'raise', 'with', 'yield',
          'lambda', 'pass', 'break', 'continue', 'global', 'nonlocal', 'assert',
          'async', 'await', 'and', 'or', 'not', 'is', 'del'
        ]),
        datatypes: new Set([
          'int', 'float', 'str', 'bool', 'list', 'dict', 'set', 'tuple', 'bytes',
          'bytearray', 'complex', 'range', 'slice', 'memoryview', 'frozenset',
          'object', 'type', 'self', 'cls'
        ]),
        constants: new Set(['True', 'False', 'None']),
        builtins: new Set([
          'print', 'len', 'input', 'open', 'sum', 'min', 'max', 'enumerate', 'zip',
          'map', 'filter', 'sorted', 'any', 'all', 'abs', 'round', 'isinstance',
          'issubclass', 'id', 'repr', 'dir', 'help', 'iter', 'next', 'pow', 'format', 'super'
        ])
      },
      javascript: {
        keywords: new Set([
          'function', 'return', 'const', 'let', 'var', 'if', 'else', 'switch', 'case',
          'default', 'for', 'while', 'do', 'break', 'continue', 'class', 'extends',
          'new', 'this', 'super', 'import', 'export', 'from', 'try', 'catch',
          'finally', 'throw', 'typeof', 'instanceof', 'async', 'await', 'yield',
          'debugger', 'delete', 'void', 'in', 'of'
        ]),
        datatypes: new Set([
          'number', 'string', 'boolean', 'bigint', 'symbol', 'undefined', 'object',
          'Number', 'String', 'Boolean', 'BigInt', 'Symbol', 'Array', 'Object',
          'Function', 'Promise', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Date', 'RegExp'
        ]),
        constants: new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']),
        builtins: new Set([
          'console', 'Math', 'JSON', 'document', 'window', 'parseInt', 'parseFloat',
          'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch', 'alert', 'prompt', 'confirm'
        ])
      },
      c: {
        keywords: new Set([
          'struct', 'union', 'enum', 'if', 'else', 'for', 'while', 'do', 'switch',
          'case', 'default', 'break', 'continue', 'return', 'sizeof', 'const',
          'static', 'typedef', 'inline', 'goto'
        ]),
        datatypes: new Set([
          'int', 'float', 'double', 'char', 'void', 'bool', 'long', 'short',
          'unsigned', 'signed', 'size_t', 'ssize_t', 'auto', 'int8_t', 'int16_t',
          'int32_t', 'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'FILE'
        ]),
        constants: new Set(['true', 'false', 'NULL']),
        builtins: new Set([
          'printf', 'scanf', 'malloc', 'free', 'strlen', 'strcpy', 'strcmp', 'memset', 'memcpy', 'main'
        ])
      },
      cpp: {
        keywords: new Set([
          'struct', 'class', 'union', 'enum', 'public', 'private', 'protected',
          'template', 'typename', 'namespace', 'using', 'if', 'else', 'for', 'while',
          'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'sizeof',
          'new', 'delete', 'const', 'static', 'constexpr', 'virtual', 'override',
          'final', 'typedef', 'friend', 'operator', 'explicit', 'mutable', 'inline',
          'throw', 'try', 'catch', 'decltype', 'noexcept', 'static_assert', 'goto'
        ]),
        datatypes: new Set([
          'int', 'float', 'double', 'char', 'void', 'bool', 'long', 'short',
          'unsigned', 'signed', 'size_t', 'ssize_t', 'auto', 'int8_t', 'int16_t',
          'int32_t', 'int64_t', 'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
          'string', 'vector', 'map', 'unordered_map', 'set', 'unordered_set',
          'pair', 'tuple', 'queue', 'deque', 'stack', 'list', 'array'
        ]),
        constants: new Set(['true', 'false', 'NULL', 'nullptr']),
        builtins: new Set([
          'printf', 'scanf', 'cout', 'cin', 'endl', 'std', 'malloc', 'free', 'main', 'vector', 'string'
        ])
      },
      java: {
        keywords: new Set([
          'public', 'private', 'protected', 'class', 'interface', 'enum', 'extends',
          'implements', 'static', 'final', 'abstract', 'synchronized', 'native',
          'volatile', 'transient', 'new', 'return', 'if', 'else', 'for', 'while',
          'do', 'switch', 'case', 'default', 'break', 'continue', 'try', 'catch',
          'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'instanceof', 'assert'
        ]),
        datatypes: new Set([
          'int', 'float', 'double', 'char', 'boolean', 'byte', 'short', 'long', 'void',
          'String', 'Integer', 'Float', 'Double', 'Boolean', 'Character', 'Byte',
          'Short', 'Long', 'Object', 'List', 'ArrayList', 'LinkedList', 'Map',
          'HashMap', 'TreeMap', 'Set', 'HashSet', 'TreeSet', 'Queue', 'Deque', 'Stack',
          'Vector', 'Scanner', 'StringBuilder', 'StringBuffer'
        ]),
        constants: new Set(['true', 'false', 'null']),
        builtins: new Set([
          'System', 'out', 'println', 'print', 'printf', 'Math', 'Arrays', 'Collections', 'main'
        ])
      }
    };

    const cfg = LANG_DATA[lang] || LANG_DATA.python;

    // Build regular expressions for syntax components
    const commentPattern = lang === 'python'
      ? '"""[\\s\\S]*?"""|\'\'\'[\\s\\S]*?\'\'\'|#[^\\n]*'
      : '/\\*[\\s\\S]*?\\*/|//[^\\n]*';

    const stringPattern = lang === 'python'
      ? '(?:f|r|b)?(?:"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\')'
      : lang === 'javascript'
        ? '`(?:[^`\\\\]|\\\\.)*`|"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\''
        : '"(?:[^"\\\\]|\\\\.)*"|\'(?:[^\'\\\\]|\\\\.)*\'';

    const preprocessorPattern = (lang === 'c' || lang === 'cpp')
      ? '#[a-zA-Z_]\\w*(?:\\s*<[^>\\n]+>|\\s*"[^"\\n]+")?'
      : '(?!)';

    const masterRegex = new RegExp(
      '(' + commentPattern + ')' +                           // 1: Comments
      '|(' + stringPattern + ')' +                            // 2: Strings
      '|(' + preprocessorPattern + ')' +                      // 3: Preprocessor
      '|(\\b0x[0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?(?:[uUlLfFdD]+)?\\b)' + // 4: Numbers
      '|(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)' +                  // 5: Words / Identifiers
      '|(===|!==|==|!=|<=|>=|=>|->|::|\\+\\+|--|\\+=|-=|\\*=|/=|%=|&&|\\|\\||<<|>>|[+\\-*/%=<>!&|^~?:])' + // 6: Operators
      '|([[{}\\]();,.])' +                                    // 7: Punctuation
      '|(\\s+|[^\\s\'"`a-zA-Z0-9_$+\\-*/%=<>!&|^~?:[{}\\]();,.]+)', // 8: Others / Whitespace
      'g'
    );

    let html = '';
    let match;

    while ((match = masterRegex.exec(code)) !== null) {
      if (match[1]) {
        // Comment
        html += `<span class="token-comment">${escape(match[1])}</span>`;
      } else if (match[2]) {
        // String
        html += `<span class="token-string">${escape(match[2])}</span>`;
      } else if (match[3]) {
        // Preprocessor
        html += `<span class="token-preprocessor">${escape(match[3])}</span>`;
      } else if (match[4]) {
        // Number
        html += `<span class="token-number">${escape(match[4])}</span>`;
      } else if (match[5]) {
        // Identifier / Word
        const word = match[5];
        if (cfg.datatypes.has(word)) {
          html += `<span class="token-datatype">${escape(word)}</span>`;
        } else if (cfg.keywords.has(word)) {
          html += `<span class="token-keyword">${escape(word)}</span>`;
        } else if (cfg.constants.has(word)) {
          html += `<span class="token-constant">${escape(word)}</span>`;
        } else if (cfg.builtins.has(word)) {
          html += `<span class="token-builtin">${escape(word)}</span>`;
        } else {
          // Check if followed by '(' -> function call
          const remaining = code.substring(masterRegex.lastIndex);
          if (/^\s*\(/.test(remaining)) {
            html += `<span class="token-function">${escape(word)}</span>`;
          } else {
            html += escape(word);
          }
        }
      } else if (match[6]) {
        // Operator
        html += `<span class="token-operator">${escape(match[6])}</span>`;
      } else if (match[7]) {
        // Punctuation
        html += `<span class="token-punctuation">${escape(match[7])}</span>`;
      } else if (match[8]) {
        // Plain text / whitespace
        html += escape(match[8]);
      }
    }

    return html;
  }

  syncLabHighlight(textarea) {
    const codeEl = document.getElementById('lab-highlight-code');
    const langSelect = document.getElementById('lab-compiler-language');
    if (!codeEl || !textarea) return;
    const currentLang = langSelect ? langSelect.value : 'python';
    let text = textarea.value;
    // Append trailing space so empty trailing newlines occupy height
    if (text.endsWith('\n')) {
      text += ' ';
    }
    codeEl.innerHTML = this.highlightCode(text, currentLang);
  }

  syncLabScroll(textarea) {
    const gutter = document.getElementById('lab-line-numbers');
    const highlightLayer = document.getElementById('lab-highlight-layer');
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
    if (highlightLayer) {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    }
  }

  onLabEditorInput(textarea) {
    this.syncLabLineNumbers(textarea);
    this.syncLabHighlight(textarea);
    this.updateCursorPosition(textarea);
  }

  getLabStarterCode(lang) {
    switch (lang) {
      case 'javascript':
        return `// JavaScript (Node.js) Playground\nconsole.log("Hello, World!");\n\nfunction calculateSum(a, b) {\n    return a + b;\n}\n\nconsole.log("Sum: " + calculateSum(10, 25));`;
      case 'c':
        return `#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    int a = 10, b = 25;\n    printf("Sum: %d\\n", a + b);\n    return 0;\n}`;
      case 'cpp':
        return `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello from C++!" << endl;\n    int a = 10, b = 25;\n    cout << "Sum: " << (a + b) << endl;\n    return 0;\n}`;
      case 'java':
        return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n        int a = 10, b = 25;\n        System.out.println("Sum: " + (a + b));\n    }\n}`;
      case 'python':
      default:
        return `# Python 3 Code Playground\nprint("Hello from Python 3!")\n\ndef calculate_sum(a, b):\n    return a + b\n\nprint("Sum:", calculate_sum(10, 25))`;
    }
  }

  updateLabFileTabInfo(lang) {
    const iconEl = document.getElementById('lab-file-icon');
    const nameEl = document.getElementById('lab-file-tab-name');
    const MAP = {
      python: { icon: '🐍', name: 'main.py' },
      javascript: { icon: '⚡', name: 'script.js' },
      c: { icon: '⚙️', name: 'main.c' },
      cpp: { icon: '🚀', name: 'main.cpp' },
      java: { icon: '☕', name: 'Main.java' }
    };
    const info = MAP[lang] || MAP.python;
    if (iconEl) iconEl.textContent = info.icon;
    if (nameEl) nameEl.textContent = info.name;
  }

  toggleLabLangMenu(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const menu = document.getElementById('lab-lang-menu');
    const btn = document.querySelector('#lab-lang-custom-dropdown .ide-custom-dropdown-btn');
    if (!menu) return;
    const isShowing = menu.classList.contains('show');
    if (isShowing) {
      menu.classList.remove('show');
      if (btn) btn.classList.remove('active');
    } else {
      menu.classList.add('show');
      if (btn) btn.classList.add('active');
    }
  }

  selectLabLanguage(langKey, label, ver, icon, e) {
    if (e) {
      e.stopPropagation();
    }
    const lbl = document.getElementById('lab-selected-lang-label');
    const verEl = document.getElementById('lab-selected-lang-ver');
    const hiddenSelect = document.getElementById('lab-compiler-language');
    const statusLang = document.getElementById('lab-statusbar-lang');
    const menu = document.getElementById('lab-lang-menu');
    const btn = document.querySelector('#lab-lang-custom-dropdown .ide-custom-dropdown-btn');

    if (lbl) lbl.textContent = label;
    if (verEl) verEl.textContent = ver;
    if (hiddenSelect) hiddenSelect.value = langKey;
    if (statusLang) statusLang.innerHTML = `<span class="status-lang-dot"></span> ${label}`;

    if (this.activeCodingQuestion) {
      this.activeCodingQuestion.language = langKey;
    }

    if (menu) {
      menu.querySelectorAll('.ide-dropdown-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-lang') === langKey);
      });
      menu.classList.remove('show');
    }
    if (btn) btn.classList.remove('active');

    this.onLabLanguageChange(langKey);
  }

  updateCursorPosition(textarea) {
    const posEl = document.getElementById('lab-statusbar-pos');
    if (!posEl || !textarea) return;
    const start = textarea.selectionStart || 0;
    const textBefore = textarea.value.substring(0, start);
    const lines = textBefore.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    posEl.textContent = `Ln ${lineNum}, Col ${colNum}`;
  }

  onLabLanguageChange(newLang) {
    const editor = document.getElementById('lab-coding-editor');
    if (editor) {
      this.syncLabLineNumbers(editor);
      this.syncLabHighlight(editor);
      this.updateCursorPosition(editor);
    }
    this.updateLabFileTabInfo(newLang);
    ui.showToast(`Switched Studio to ${newLang.toUpperCase()}`, 'info');
  }

  toggleLabStdin() {
    const panel = document.getElementById('lab-compiler-stdin-panel');
    const btn = document.getElementById('btn-lab-toggle-stdin');
    if (panel) {
      panel.classList.toggle('active');
      if (btn) btn.classList.toggle('active', panel.classList.contains('active'));
    }
  }

  onLabStdinInput(textarea) {
    const dot = document.getElementById('lab-stdin-active-dot');
    if (dot) {
      dot.style.display = textarea.value.trim() ? 'inline-block' : 'none';
    }
  }

  clearLabStdin() {
    const stdinEl = document.getElementById('lab-coding-stdin');
    const dot = document.getElementById('lab-stdin-active-dot');
    if (stdinEl) stdinEl.value = '';
    if (dot) dot.style.display = 'none';
    ui.showToast('Stdin cleared.', 'info');
  }

  toggleLabMaximize() {
    const windowEl = document.getElementById('lab-ide-window');
    if (windowEl) {
      windowEl.classList.toggle('is-maximized');
      const isMax = windowEl.classList.contains('is-maximized');
      const maxBtn = document.getElementById('btn-lab-maximize');
      if (maxBtn) {
        maxBtn.title = isMax ? 'Restore Window Size' : 'Maximize Window';
      }
    }
  }

  copyLabOutput() {
    const outputEl = document.getElementById('lab-compiler-output');
    const copyText = document.getElementById('lab-copy-text');
    if (!outputEl) return;
    const textToCopy = outputEl.textContent.replace(/^\$ [^\n]+\n*/, '');
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (copyText) copyText.textContent = 'Copied!';
      ui.showToast('Terminal output copied to clipboard.', 'success');
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copy';
      }, 1500);
    }).catch(() => {
      ui.showToast('Could not copy output.', 'warning');
    });
  }

  resetLabCode() {
    const editor = document.getElementById('lab-coding-editor');
    if (editor && confirm("Clear editor code and start clean?")) {
      editor.value = '';
      this.syncLabLineNumbers(editor);
      this.syncLabHighlight(editor);
      this.updateCursorPosition(editor);
      ui.showToast("Editor cleared.", "info");
    }
  }

  clearLabOutput() {
    const outputEl = document.getElementById('lab-compiler-output');
    const metaEl = document.getElementById('lab-compiler-meta');
    const statusText = document.getElementById('lab-status-text');
    if (outputEl) {
      outputEl.textContent = '$ Terminal cleared. Ready for next execution.';
      outputEl.className = 'ide-terminal-viewport has-normal';
    }
    if (metaEl) metaEl.textContent = '';
    if (statusText) statusText.textContent = 'Ready';
  }

  syncLabLineNumbers(textarea) {
    const gutter = document.getElementById('lab-line-numbers');
    if (!gutter || !textarea) return;
    const lines = (textarea.value.match(/\n/g) || []).length + 1;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
      numbers += i + '\n';
    }
    gutter.textContent = numbers;
    gutter.scrollTop = textarea.scrollTop;
  }

  onLabEditorKeyDown(e, textarea) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.runLabCode();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      textarea.value = val.substring(0, start) + "    " + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 4;
      this.syncLabLineNumbers(textarea);
      this.syncLabHighlight(textarea);
      this.updateCursorPosition(textarea);
      return;
    }

    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const val = textarea.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const match = currentLine.match(/^\s+/);
      const indent = match ? match[0] : '';
      
      if (indent.length > 0) {
        e.preventDefault();
        const extraIndent = currentLine.trim().endsWith(':') || currentLine.trim().endsWith('{') ? '    ' : '';
        const newText = '\n' + indent + extraIndent;
        textarea.value = val.substring(0, start) + newText + val.substring(textarea.selectionEnd);
        textarea.selectionStart = textarea.selectionEnd = start + newText.length;
        this.syncLabLineNumbers(textarea);
        this.syncLabHighlight(textarea);
        this.updateCursorPosition(textarea);
        return;
      }
    }
  }

  async runLabCode() {
    const editor = document.getElementById('lab-coding-editor');
    const stdinEl = document.getElementById('lab-coding-stdin');
    const langSelect = document.getElementById('lab-compiler-language');
    const outputEl = document.getElementById('lab-compiler-output');
    const statusEl = document.getElementById('lab-compiler-status');
    const statusText = document.getElementById('lab-status-text');
    const metaEl = document.getElementById('lab-compiler-meta');
    const btnRun = document.getElementById('btn-lab-run');

    const sourceCode = editor ? editor.value : '';
    if (!sourceCode.trim()) {
      ui.showToast('Please enter some code before running.', 'warning');
      return;
    }

    const language = langSelect ? langSelect.value : 'python';
    let stdin = stdinEl ? stdinEl.value : '';

    // Auto-detect if user's code expects input (e.g. input() in Python or scanf in C)
    const codeNeedsInput = (language === 'python' && /\binput\s*\(/.test(sourceCode)) ||
                           ((language === 'c' || language === 'cpp') && /\b(scanf|cin|getchar|fgets)\b/.test(sourceCode)) ||
                           (language === 'java' && /\b(Scanner|readLine|System\.in)\b/.test(sourceCode));

    if (codeNeedsInput && !stdin.trim()) {
      // Auto-open Custom Input panel so user immediately sees it
      const stdinPanel = document.getElementById('lab-compiler-stdin-panel');
      const toggleBtn = document.getElementById('btn-lab-toggle-stdin');
      if (stdinPanel && !stdinPanel.classList.contains('active')) {
        stdinPanel.classList.add('active');
        if (toggleBtn) toggleBtn.classList.add('active');
      }

      // Prompt user for input values
      const promptInput = window.prompt("Your program expects user input (input()).\nPlease enter test input values separated by spaces or newlines:", "230 5");
      if (promptInput !== null && promptInput.trim()) {
        stdin = promptInput.replace(/ +/g, '\n').trim();
        if (stdinEl) stdinEl.value = stdin;
        const dot = document.getElementById('lab-stdin-active-dot');
        if (dot) dot.style.display = 'inline-block';
      }
    }

    const COMMAND_MAP = {
      python: 'python3 main.py',
      javascript: 'node script.js',
      c: 'gcc main.c -O2 -o main && ./main',
      cpp: 'g++ main.cpp -O2 -o main && ./main',
      java: 'javac Main.java && java Main'
    };
    const runCmd = COMMAND_MAP[language] || 'run';

    if (btnRun) btnRun.disabled = true;
    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot running"></span> <span id="lab-status-text">Running...</span>`;
    }
    if (outputEl) {
      outputEl.className = 'ide-terminal-viewport has-normal';
      outputEl.textContent = `$ ${runCmd}\nCompiling and executing code on compiler server...`;
    }
    if (metaEl) metaEl.textContent = 'Executing...';

    try {
      const JUDGE0_MAP = {
        python: 71,
        javascript: 93,
        c: 50,
        cpp: 54,
        java: 62
      };
      const langId = JUDGE0_MAP[language] || 71;
      let executionResult = null;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        const response = await fetch('https://ce.judge0.com/submissions?wait=true', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language_id: langId,
            source_code: sourceCode,
            stdin: stdin
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          executionResult = await response.json();
        } else {
          throw new Error(`Compiler service returned HTTP ${response.status}`);
        }
      } catch (netErr) {
        // Fallback to Piston API if Judge0 fails
        try {
          const pistonLangMap = { python: 'python', javascript: 'javascript', c: 'c', cpp: 'cpp', java: 'java' };
          const pResp = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              language: pistonLangMap[language] || 'python',
              version: '*',
              files: [{ content: sourceCode }],
              stdin: stdin
            })
          });
          if (pResp.ok) {
            const pData = await pResp.json();
            if (pData.run) {
              executionResult = {
                stdout: pData.run.stdout,
                stderr: pData.run.stderr,
                compile_output: pData.compile ? pData.compile.output : '',
                time: '0.02',
                status: { description: pData.run.code === 0 ? 'Accepted' : 'Runtime Error' }
              };
            }
          }
        } catch (pistonErr) {}

        if (!executionResult) {
          if (language === 'javascript') {
            executionResult = examEngine.executeBrowserJavaScript(sourceCode);
          } else {
            throw netErr;
          }
        }
      }

      const stdout = (executionResult.stdout || '').replace(/\r\n/g, '\n');
      const stderr = (executionResult.stderr || '').replace(/\r\n/g, '\n');
      const compileOut = (executionResult.compile_output || '').replace(/\r\n/g, '\n');
      const execTime = executionResult.time ? `${executionResult.time}s` : '0.01s';
      const execMem = executionResult.memory ? `${Math.round(executionResult.memory / 1024 * 10) / 10} MB` : '1.2 MB';
      const statusDesc = (executionResult.status && executionResult.status.description) || 'Completed';

      let displayOutput = '';
      let hasError = false;

      if (compileOut) {
        displayOutput = `$ ${runCmd}\n[Compilation Error]\n${compileOut}`;
        hasError = true;
      } else if (stderr) {
        displayOutput = stdout 
          ? `$ ${runCmd}\n${stdout}\n\n[Runtime Error]\n${stderr}` 
          : `$ ${runCmd}\n[Runtime Error]\n${stderr}`;
        hasError = true;

        // Helpful guidance for EOFError (missing input)
        if (/EOFError|EOF when reading a line/i.test(stderr)) {
          displayOutput += `\n\n──────────────────────────────────────────────────────────\n💡 WHY DID THIS RUNTIME ERROR OCCUR?\nYour code uses input(), but no input values were provided in "Custom Input".\n👉 The "Custom Input" panel above is now open for you.\n👉 Type your input values (e.g. 230 on line 1, 5 on line 2) and click "Run Code" again!\n──────────────────────────────────────────────────────────`;
          const stdinPanel = document.getElementById('lab-compiler-stdin-panel');
          const toggleBtn = document.getElementById('btn-lab-toggle-stdin');
          if (stdinPanel && !stdinPanel.classList.contains('active')) {
            stdinPanel.classList.add('active');
            if (toggleBtn) toggleBtn.classList.add('active');
          }
          if (stdinEl) stdinEl.focus();
        }
      } else if (stdout) {
        displayOutput = `$ ${runCmd}\n${stdout}`;
      } else {
        displayOutput = `$ ${runCmd}\n(Program executed successfully with no output)`;
      }

      if (outputEl) {
        outputEl.textContent = displayOutput;
        outputEl.className = hasError ? 'ide-terminal-viewport has-error' : 'ide-terminal-viewport';
      }
      if (metaEl) {
        metaEl.textContent = `⏱ ${execTime} | 💾 ${execMem}`;
      }
      if (statusEl) {
        statusEl.innerHTML = hasError
          ? `<span class="status-dot error"></span> <span id="lab-status-text">${statusDesc}</span>`
          : `<span class="status-dot"></span> <span id="lab-status-text">${statusDesc}</span>`;
      }
      ui.showToast(hasError ? 'Execution finished with errors.' : 'Code executed successfully.', hasError ? 'warning' : 'success');
    } catch (err) {
      console.error("Lab execution error:", err);
      if (outputEl) {
        outputEl.className = 'ide-terminal-viewport has-error';
        outputEl.textContent = `$ ${runCmd}\n[Connection Error]\nCould not connect to online compiler engine. Please check internet connection.\nDetails: ${err.message}`;
      }
      if (statusEl) statusEl.innerHTML = `<span class="status-dot error"></span> <span id="lab-status-text">Error</span>`;
      ui.showToast('Could not reach compiler engine.', 'error');
    } finally {
      if (btnRun) btnRun.disabled = false;
    }
  }

  /* ==========================================================================
     STUDENT DESCRIPTION & ANSWERS NOTEBOOK CONTROLLER
     ========================================================================== */

  openStudentNotesModal() {
    const key = `lms_student_notes_${this.currentStudent.regNo}`;
    const saved = localStorage.getItem(key) || '';
    const textarea = document.getElementById('student-notes-textarea');
    if (textarea) {
      textarea.value = saved;
      this.onNotesInput(textarea);
    }
    ui.showModal('modal-student-notes');
    if (typeof window.renderGlobalAdSlots === 'function') {
      window.renderGlobalAdSlots();
    }
    setTimeout(() => {
      if (textarea) textarea.focus();
    }, 120);
  }

  onNotesInput(textarea) {
    const countEl = document.getElementById('student-notes-word-count');
    const autoSaveStatus = document.getElementById('student-notes-status-badge');
    if (!textarea) return;
    const text = textarea.value.trim();
    const chars = textarea.value.length;
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const lines = (textarea.value.match(/\n/g) || []).length + 1;

    if (countEl) {
      countEl.textContent = `${words} word${words === 1 ? '' : 's'} • ${chars} char${chars === 1 ? '' : 's'} • ${lines} line${lines === 1 ? '' : 's'}`;
    }
    if (autoSaveStatus) {
      autoSaveStatus.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#f59e0b; margin-right:4px;"></span> Unsaved edits`;
    }
  }

  insertNotesTemplate(type) {
    const textarea = document.getElementById('student-notes-textarea');
    if (!textarea) return;
    textarea.focus();
    let snippet = '';
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const val = textarea.value;

    switch (type) {
      case 'theory':
        snippet = `[Question Title / Concept]\n\n• Definition:\n  \n• Key Principles & Characteristics:\n  1. \n  2. \n  3. \n\n• Conclusion / Summary:\n  `;
        break;
      case 'formula':
        snippet = `[Formula / Mathematical Concept]\n\n• Formula: \n• Where:\n  - Variable 1: \n  - Variable 2: \n• Units & Dimensions: \n• Application Example: \n`;
        break;
      case 'bullet':
        snippet = `• Key Point 1: \n• Key Point 2: \n• Key Point 3: \n• Important Note: \n`;
        break;
      default:
        break;
    }

    if (snippet) {
      const prefix = val.length > 0 && !val.endsWith('\n\n') ? (val.endsWith('\n') ? '\n' : '\n\n') : '';
      textarea.value = val.substring(0, start) + prefix + snippet + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + prefix.length + snippet.length;
      this.onNotesInput(textarea);
      ui.showToast('Template inserted into notebook!', 'info');
    }
  }

  async pasteToNotes() {
    const textarea = document.getElementById('student-notes-textarea');
    if (!textarea) return;
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          const start = textarea.selectionStart || 0;
          const end = textarea.selectionEnd || 0;
          const val = textarea.value;
          textarea.value = val.substring(0, start) + text + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + text.length;
          this.onNotesInput(textarea);
          ui.showToast('Pasted from clipboard! 📋', 'success');
          return;
        }
      }
    } catch (e) {
      console.warn("Clipboard read not permitted:", e);
    }
    textarea.focus();
    ui.showToast('Please press Ctrl+V to paste.', 'info');
  }

  saveStudentNotes() {
    const textarea = document.getElementById('student-notes-textarea');
    const text = textarea ? textarea.value.trim() : '';
    const key = `lms_student_notes_${this.currentStudent.regNo}`;
    localStorage.setItem(key, text);
    const autoSaveStatus = document.getElementById('student-notes-status-badge');
    if (autoSaveStatus) {
      autoSaveStatus.innerHTML = `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#10b981; margin-right:4px;"></span> Saved locally`;
    }
    ui.hideModal('modal-student-notes');
    ui.showToast('Student description & answers saved! 📝', 'success');
    this.renderAvailableSubjects();
  }

  clearStudentNotes() {
    const textarea = document.getElementById('student-notes-textarea');
    if (!textarea || !textarea.value) return;
    if (confirm('Are you sure you want to clear your description and answers?')) {
      textarea.value = '';
      this.onNotesInput(textarea);
      textarea.focus();
    }
  }

  copyStudentDescriptionNotes(btnEl = null) {
    const key = `lms_student_notes_${this.currentStudent.regNo}`;
    const textarea = document.getElementById('student-notes-textarea');
    const modal = document.getElementById('modal-student-notes');
    const isModalOpen = modal && modal.classList.contains('active');
    const textToCopy = isModalOpen && textarea ? textarea.value.trim() : (localStorage.getItem(key) || '').trim();

    if (!textToCopy) {
      ui.showToast('No description or answers saved yet! Click "Add / Edit" to write.', 'warning');
      return;
    }

    const onCopySuccess = () => {
      ui.showToast('Student answers copied to clipboard! 📋', 'success');
      if (btnEl) {
        const labelEl = btnEl.querySelector('.btn-copy-label');
        if (labelEl) {
          const originalText = labelEl.textContent;
          labelEl.textContent = 'Copied! ✓';
          setTimeout(() => {
            labelEl.textContent = originalText;
          }, 2000);
        }
      }
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(textToCopy).then(onCopySuccess).catch(() => {
        this.fallbackCopyText(textToCopy, onCopySuccess);
      });
    } else {
      this.fallbackCopyText(textToCopy, onCopySuccess);
    }
  }

  fallbackCopyText(text, callback) {
    const tempArea = document.createElement('textarea');
    tempArea.value = text;
    tempArea.style.position = 'fixed';
    tempArea.style.opacity = '0';
    document.body.appendChild(tempArea);
    tempArea.select();
    try {
      document.execCommand('copy');
      if (callback) callback();
    } catch (e) {
      ui.showToast('Could not copy automatically. Please copy manually.', 'error');
    }
    document.body.removeChild(tempArea);
  }
}



function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const studentDashboard = new StudentDashboardController();
window.studentDashboard = studentDashboard;

// Global click-outside listener to dismiss IDE language dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('lab-lang-custom-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    const menu = document.getElementById('lab-lang-menu');
    const btn = dropdown.querySelector('.ide-custom-dropdown-btn');
    if (menu) menu.classList.remove('show');
    if (btn) btn.classList.remove('active');
  }
});

// Initialize playground settings on DOM load
document.addEventListener('DOMContentLoaded', () => {
  studentDashboard.applySavedLabSettings();
});
