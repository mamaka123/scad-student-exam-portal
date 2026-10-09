/* ==========================================================================
   Exam JS - Anti-Cheating Engine, Fullscreen, Timer, Question Wizard & Multi-Tab Protection
   ========================================================================== */

class AntiCheatingExamEngine {
  constructor() {
    this.currentSubject = null;
    this.questions = [];
    this.currentIndex = 0;
    this.answersMap = {}; // qId -> selectedOptionIndex
    this.codingAnswersMap = {}; // qId -> { code, language, stdin, output, passed, tested }
    this.compilerRunning = false;

    this.warningCount = 0;
    this.maxWarnings = 3;
    this.examActive = false;

    this.timerInterval = null;
    this.endTimeStamp = 0;

    this.broadcastChannel = null;
    this.boundKeyHandler = null;
    this.boundContextMenuHandler = null;
    this.boundVisibilityHandler = null;
    this.boundFullscreenHandler = null;

    this.initBroadcastChannel();
    this.checkPersistentExamState();
  }

  /* BroadcastChannel for Multi-Tab Protection */
  initBroadcastChannel() {
    if ('BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel('lms_exam_lock_channel');
      this.broadcastChannel.onmessage = (event) => {
        if (this.examActive && event.data && event.data.type === 'EXAM_OPENED_ELSEWHERE') {
          this.handleViolation('Multiple Exam Tab');
        }
      };
    }
  }

  /* Restore active exam state if student refreshed page */
  checkPersistentExamState() {
    const saved = storage.getItem(APP_KEYS.ACTIVE_EXAM_STATE, null);
    if (saved && saved.examActive) {
      const now = Date.now();
      if (saved.endTimeStamp > now) {
        // Resume active exam
        this.currentSubject = saved.subject;
        this.questions = saved.questions;
        this.currentIndex = saved.currentIndex || 0;
        this.answersMap = saved.answersMap || {};
        this.codingAnswersMap = saved.codingAnswersMap || {};
        this.warningCount = saved.warningCount || 0;
        this.maxWarnings = saved.maxWarnings || (this.currentSubject ? (this.currentSubject.maxWarnings || storage.getSubjectMaxWarnings(this.currentSubject.id)) : 3);
        this.endTimeStamp = saved.endTimeStamp;

        setTimeout(() => {
          this.resumeExamView();
        }, 300);
      } else {
        // Expired active exam, auto-submit
        storage.setItem(APP_KEYS.ACTIVE_EXAM_STATE, null);
      }
    }
  }

  /* Show Pre-Exam Rules Modal */
  showRulesModal(subject) {
    this.currentSubject = subject;
    const maxWarn = subject.maxWarnings || storage.getSubjectMaxWarnings(subject.id) || 3;
    const modalTitle = document.getElementById('rules-modal-subject-name');
    if (modalTitle) modalTitle.textContent = `${subject.code || ''} - ${subject.name}`;

    const facultyEl = document.getElementById('rules-modal-faculty-name');
    if (facultyEl) {
      const facName = subject.createdByName || storage.getAdminDisplayName(subject.createdBy, 'Faculty Staff');
      facultyEl.textContent = `👨‍🏫 Staff: ${facName}`;
    }

    const durEl = document.getElementById('rules-modal-duration');
    if (durEl) durEl.textContent = subject.duration || 30;

    const warnRuleEl = document.getElementById('rules-modal-max-warnings');
    if (warnRuleEl) warnRuleEl.textContent = maxWarn;

    ui.showModal('modal-exam-rules');
  }

  /* Start Exam Flow */
  startExam() {
    ui.hideModal('modal-exam-rules');

    const session = storage.getActiveSession();
    if (!session || session.role !== 'student') return;

    // Fetch questions for this subject matching year
    const allQuestions = storage.getQuestions();
    const rawQuestions = allQuestions.filter(q => 
      (q.subjectId && this.currentSubject.id && String(q.subjectId).trim().toLowerCase() === String(this.currentSubject.id).trim().toLowerCase()) ||
      (q.subjectName && this.currentSubject.name && q.subjectName.trim().toLowerCase() === this.currentSubject.name.trim().toLowerCase()) ||
      (q.subject && this.currentSubject.name && q.subject.trim().toLowerCase() === this.currentSubject.name.trim().toLowerCase())
    );

    if (rawQuestions.length === 0) {
      ui.showToast("No questions available for this subject.", "error");
      return;
    }

    // Randomize Questions and Options
    this.questions = this.prepareRandomizedQuestions(rawQuestions);
    this.currentIndex = 0;
    this.answersMap = {};
    this.codingAnswersMap = {};
    this.warningCount = 0;
    this.maxWarnings = (this.currentSubject && this.currentSubject.maxWarnings)
      ? parseInt(this.currentSubject.maxWarnings, 10)
      : (storage.getSubjectMaxWarnings(this.currentSubject ? this.currentSubject.id : null) || 3);
    this.examActive = true;

    // Configured duration for this specific subject/exam (default: 30 minutes)
    const durationMinutes = parseInt(this.currentSubject && this.currentSubject.duration, 10) || 30;
    const durationMs = durationMinutes * 60 * 1000;
    this.startTimeStamp = Date.now();
    this.endTimeStamp = Date.now() + durationMs;

    // Broadcast tab lock
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({ type: 'EXAM_OPENED_ELSEWHERE' });
    }

    // Enter Fullscreen
    this.requestFullscreen();

    // Attach Anti-Cheating Event Listeners
    this.attachSecurityListeners();

    // Start Persistent Timer
    this.startTimer();

    // Render View
    this.saveExamState();
    this.renderExamViewport();
  }

  resumeExamView() {
    this.examActive = true;
    this.attachSecurityListeners();
    this.startTimer();
    this.renderExamViewport();
  }

  /* Shuffler Helper for Randomization */
  prepareRandomizedQuestions(rawList) {
    // Deep clone
    const cloned = JSON.parse(JSON.stringify(rawList));
    const shuffledQuestions = this.shuffleArray(cloned);

    return shuffledQuestions.map(q => {
      // For coding questions, do not shuffle options
      if (q.type === 'coding') {
        let cleanText = String(q.text || q.question || '').trim();
        cleanText = cleanText.replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, '').trim();
        return {
          ...q,
          text: cleanText,
          question: cleanText,
          options: []
        };
      }

      let rawOptions = Array.isArray(q.options) && q.options.length > 0 
        ? q.options 
        : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

      // Clean option strings - strip any redundant prefix like "A. ", "A) ", "(A) "
      const cleanOptions = rawOptions.map(opt => {
        let s = String(opt || '').trim();
        return s.replace(/^[(\[]?[A-Da-d1-4][)\]\.:\s-]\s*/, '').trim();
      });

      const originalCorrectOption = cleanOptions[q.correctIndex] || cleanOptions[0];
      const shuffledOptions = this.shuffleArray([...cleanOptions]);
      let newCorrectIndex = shuffledOptions.indexOf(originalCorrectOption);
      if (newCorrectIndex === -1) newCorrectIndex = 0;

      // Clean question text: strip any "Q1. ", "Question 1: " prefix
      let cleanText = String(q.text || q.question || '').trim();
      cleanText = cleanText.replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, '').trim();

      return {
        ...q,
        text: cleanText,
        question: cleanText,
        options: shuffledOptions,
        correctIndex: newCorrectIndex
      };
    });
  }

  shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* Fullscreen Request */
  requestFullscreen() {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(err => console.log("Fullscreen request declined/unsupported:", err));
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
    }
  }

  /* Anti-Cheating Event Listeners */
  attachSecurityListeners() {
    // 1. Context Menu (Right Click) & Text Selection
    this.boundContextMenuHandler = (e) => {
      if (!this.examActive) return;
      if (e.target && (e.target.id === 'coding-editor-textarea' || e.target.id === 'coding-stdin-textarea' || e.target.closest('.coding-compiler-wrapper'))) {
        return; // Allow context menu in code editor
      }
      e.preventDefault();
      this.handleViolation('Copy Attempt');
    };
    document.addEventListener('contextmenu', this.boundContextMenuHandler);

    // 2. Keyboard Shortcut Locking (Ctrl+C, Ctrl+V, Ctrl+U, F12, DevTools)
    this.boundKeyHandler = (e) => {
      if (!this.examActive) return;

      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Quick Run with Ctrl+Enter or Cmd+Enter inside compiler
      if (ctrlOrCmd && key === 'enter') {
        if (e.target && (e.target.id === 'coding-editor-textarea' || e.target.closest('.coding-compiler-wrapper'))) {
          e.preventDefault();
          this.runCompilerCode(false);
          return false;
        }
      }

      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+U (except inside coding editor)
      if (ctrlOrCmd && ['c', 'v', 'x', 'u'].includes(key)) {
        if (e.target && (e.target.id === 'coding-editor-textarea' || e.target.id === 'coding-stdin-textarea' || e.target.closest('.coding-compiler-wrapper'))) {
          return; // Allow clipboard operations within code editor
        }
        e.preventDefault();
        e.stopPropagation();
        this.handleViolation(key === 'c' || key === 'x' ? 'Copy Attempt' : 'Paste Attempt');
        return false;
      }

      // Block F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
      if (e.key === 'F12' || (ctrlOrCmd && e.shiftKey && ['i', 'j', 'c'].includes(key))) {
        e.preventDefault();
        e.stopPropagation();
        this.handleViolation('Developer Shortcut');
        return false;
      }
    };
    document.addEventListener('keydown', this.boundKeyHandler, true);

    // 3. Visibility & Window Blur Detection (Tab / App / Slide Switch for Laptop & Mobile)
    this.lastViolationTime = 0;

    this.boundVisibilityHandler = () => {
      if (!this.examActive) return;
      if (document.hidden || document.visibilityState === 'hidden') {
        this.handleViolation('Tab / Slide Switch');
      }
    };
    document.addEventListener('visibilitychange', this.boundVisibilityHandler);

    this.boundBlurHandler = () => {
      if (!this.examActive) return;
      this.handleViolation('Window / App Focus Lost');
    };
    window.addEventListener('blur', this.boundBlurHandler);

    this.boundPageHideHandler = () => {
      if (!this.examActive) return;
      this.handleViolation('Tab / Slide Switch');
    };
    window.addEventListener('pagehide', this.boundPageHideHandler);

    // 4. Fullscreen Exit Detection
    this.boundFullscreenHandler = () => {
      if (!this.examActive) return;
      const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
      if (!isFull) {
        this.handleViolation('Fullscreen Exit');
      }
    };
    document.addEventListener('fullscreenchange', this.boundFullscreenHandler);
    document.addEventListener('webkitfullscreenchange', this.boundFullscreenHandler);
  }

  removeSecurityListeners() {
    if (this.boundContextMenuHandler) document.removeEventListener('contextmenu', this.boundContextMenuHandler);
    if (this.boundKeyHandler) document.removeEventListener('keydown', this.boundKeyHandler, true);
    if (this.boundVisibilityHandler) document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
    if (this.boundBlurHandler) window.removeEventListener('blur', this.boundBlurHandler);
    if (this.boundPageHideHandler) window.removeEventListener('pagehide', this.boundPageHideHandler);
    if (this.boundFullscreenHandler) {
      document.removeEventListener('fullscreenchange', this.boundFullscreenHandler);
      document.removeEventListener('webkitfullscreenchange', this.boundFullscreenHandler);
    }
  }

  /* Handle Anti-Cheating Violation */
  handleViolation(violationType) {
    if (!this.examActive) return;

    // Cooldown check (prevent dual trigger within 1.5s from blur + visibilitychange on a single tab switch)
    const now = Date.now();
    if (this.lastViolationTime && (now - this.lastViolationTime < 1500)) {
      return;
    }
    this.lastViolationTime = now;

    this.warningCount++;

    const session = storage.getActiveSession();
    const student = session ? session.user : { name: 'Unknown', regNo: '952800000000', year: '1st Year', section: 'A' };

    // Log to LocalStorage Violations table
    storage.logViolation({
      studentRegNo: student.regNo,
      studentName: student.name,
      year: student.year,
      section: student.section,
      subjectName: this.currentSubject ? this.currentSubject.name : 'Exam',
      violationType: violationType,
      count: this.warningCount,
      examStatus: this.warningCount >= this.maxWarnings ? 'Auto Submitted' : 'Active'
    });

    this.saveExamState();
    this.updateWarningPillUI();

    if (this.warningCount >= this.maxWarnings) {
      ui.showToast(`3 WARNINGS REACHED! Anti-cheating violation detected. Exam auto-submitted!`, 'error', 6000);
      this.submitExam('Auto Submitted');
    } else {
      ui.showToast(`WARNING (${this.warningCount}/${this.maxWarnings}): ${violationType} detected! Do not leave exam screen, switch slides or change apps.`, 'warning', 5000);
    }
  }

  /* Timer Logic */
  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      const remainingMs = this.endTimeStamp - Date.now();
      if (remainingMs <= 0) {
        clearInterval(this.timerInterval);
        ui.showToast("Time expired! Exam Automatically Submitted.", "warning");
        this.submitExam('Auto Submitted');
      } else {
        this.updateTimerDisplay();
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const remainingSecs = Math.max(0, Math.floor((this.endTimeStamp - Date.now()) / 1000));
    const hours = Math.floor(remainingSecs / 3600);
    const mins = Math.floor((remainingSecs % 3600) / 60);
    const secs = remainingSecs % 60;
    const formatted = hours > 0
      ? `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
      : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    const timerEl = document.getElementById('exam-timer-display');
    if (timerEl) {
      timerEl.textContent = formatted;
      if (remainingSecs <= 300) {
        timerEl.parentElement.classList.remove('normal');
      } else {
        timerEl.parentElement.classList.add('normal');
      }
    }
  }

  saveExamState() {
    storage.setItem(APP_KEYS.ACTIVE_EXAM_STATE, {
      examActive: this.examActive,
      subject: this.currentSubject,
      questions: this.questions,
      currentIndex: this.currentIndex,
      answersMap: this.answersMap,
      codingAnswersMap: this.codingAnswersMap,
      warningCount: this.warningCount,
      maxWarnings: this.maxWarnings,
      startTimeStamp: this.startTimeStamp,
      endTimeStamp: this.endTimeStamp,
      durationMinutes: parseInt(this.currentSubject && this.currentSubject.duration, 10) || 30
    });
  }

  /* Render Fullscreen Exam UI */
  renderExamViewport() {
    const viewport = document.getElementById('exam-viewport-section');
    if (viewport) viewport.classList.add('active');

    // Header info
    document.getElementById('exam-header-subject').textContent = this.currentSubject ? `${this.currentSubject.code || ''} ${this.currentSubject.name}` : 'Exam';
    const headerFaculty = document.getElementById('exam-header-faculty');
    if (headerFaculty) {
      const subFaculty = this.currentSubject 
        ? (this.currentSubject.createdByName || storage.getAdminDisplayName(this.currentSubject.createdBy, 'Faculty Staff'))
        : 'Faculty Staff';
      headerFaculty.textContent = `👨‍🏫 Faculty: ${subFaculty}`;
    }
    this.updateWarningPillUI();

    this.renderCurrentQuestion();
    this.renderNavigatorGrid();
  }

  updateWarningPillUI() {
    const warnEl = document.getElementById('exam-warning-pill');
    if (warnEl) warnEl.textContent = `Warnings: ${this.warningCount}/${this.maxWarnings}`;
  }

  formatQuestionText(rawText) {
    if (!rawText) return '';
    let text = escapeHtml(rawText);
    
    // Markdown bold **text** or __text__
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="q-highlight-strong">$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong class="q-highlight-strong">$1</strong>');
    
    // Markdown italic *text* or _text_
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code `code`
    text = text.replace(/`([^`]+)`/g, '<code class="q-inline-code">$1</code>');
    
    // Section highlight tags for common programming problem headers
    text = text.replace(/(<strong class="q-highlight-strong">(?:Input Format|Output Format|Constraints|Example \d+|Explanation|Note|Input:|Output:):?<\/strong>)/gi, 
      '<div class="q-section-title-wrap">$1</div>');
    
    // Split into readable paragraphs
    const blocks = text.split(/\n\s*\n/).filter(Boolean);
    if (blocks.length > 1) {
      return blocks.map(b => `<p class="q-text-para">${b.replace(/\n/g, '<br>')}</p>`).join('');
    }
    
    return `<div class="q-text-body">${text.replace(/\n/g, '<br>')}</div>`;
  }

  renderCurrentQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    // Progress bar fill
    const fill = document.getElementById('exam-progress-bar-fill');
    if (fill) {
      const pct = Math.round(((this.currentIndex + 1) / this.questions.length) * 100);
      fill.style.width = `${pct}%`;
    }

    // Meta & Text
    document.getElementById('exam-q-number').textContent = `Question ${this.currentIndex + 1} of ${this.questions.length}`;
    document.getElementById('exam-q-topic').textContent = q.chapter || 'Topic';

    const facultyPill = document.getElementById('exam-q-faculty-pill');
    if (facultyPill) {
      const qFaculty = q.createdByName || 
        storage.getAdminDisplayName(q.createdBy, '') || 
        (this.currentSubject ? (this.currentSubject.createdByName || storage.getAdminDisplayName(this.currentSubject.createdBy, '')) : '') || 
        'Faculty Staff';
      facultyPill.textContent = `👨‍🏫 Staff: ${qFaculty}`;
    }
    
    const marksPill = document.getElementById('exam-q-marks-pill');
    const qMarks = parseInt(q.marks || (q.type === 'coding' ? 10 : 1), 10);
    if (marksPill) {
      marksPill.innerHTML = `🏆 ${qMarks} ${qMarks === 1 ? 'Mark' : 'Marks'}`;
    }

    const textEl = document.getElementById('exam-q-text');
    if (textEl) {
      let qText = String(q.text || q.question || '').trim();
      qText = qText.replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, '').trim();
      textEl.innerHTML = this.formatQuestionText(qText);
    }

    const cardWrapper = document.getElementById('exam-card-wrapper') || document.querySelector('.question-card-wrapper');
    const optionsContainer = document.getElementById('exam-options-container');

    // Nav Buttons
    const btnPrev = document.getElementById('exam-btn-prev');
    const btnNext = document.getElementById('exam-btn-next');

    if (btnPrev) btnPrev.style.display = this.currentIndex === 0 ? 'none' : 'inline-flex';
    if (btnNext) btnNext.textContent = this.currentIndex === this.questions.length - 1 ? 'Review & Submit' : 'Next Question';

    // If Coding Question -> Render Online Compiler Workspace
    if (q.type === 'coding') {
      if (cardWrapper) cardWrapper.classList.add('coding-card-mode');
      this.renderCodingQuestionWorkspace(q, optionsContainer);
      return;
    }

    // If MCQ Question -> Render Options
    if (cardWrapper) cardWrapper.classList.remove('coding-card-mode');
    const letters = ['A', 'B', 'C', 'D'];
    const selectedIdx = this.answersMap[q.id];

    const currentOptions = Array.isArray(q.options) && q.options.length > 0 
      ? q.options 
      : [q.optionA, q.optionB, q.optionC, q.optionD].filter(Boolean);

    optionsContainer.innerHTML = currentOptions.map((optText, idx) => {
      const isSelected = selectedIdx === idx;
      let cleanOpt = String(optText || '').trim();
      cleanOpt = cleanOpt.replace(/^[(\[]?[A-Da-d1-4][)\]\.:\s-]\s*/, '').trim();
      return `
        <div class="option-item ${isSelected ? 'selected' : ''}" onclick="examEngine.selectOption(${idx})" tabindex="0" role="button" aria-pressed="${isSelected}">
          <div class="option-letter">${letters[idx] || (idx + 1)}</div>
          <div class="option-text">${escapeHtml(cleanOpt)}</div>
        </div>
      `;
    }).join('');
  }

  renderNavigatorGrid() {
    const grid = document.getElementById('exam-nav-q-grid');
    if (!grid) return;

    grid.innerHTML = this.questions.map((q, idx) => {
      const isAnswered = q.type === 'coding'
        ? !!(this.codingAnswersMap[q.id] && this.codingAnswersMap[q.id].code && this.codingAnswersMap[q.id].code.trim().length > 0)
        : this.answersMap.hasOwnProperty(q.id);

      const isCurrent = idx === this.currentIndex;

      let classes = 'q-grid-btn';
      if (isAnswered) classes += ' answered';
      if (isCurrent) classes += ' current';

      return `<button class="${classes}" onclick="examEngine.jumpToQuestion(${idx})">${idx + 1}</button>`;
    }).join('');
  }

  selectOption(optionIndex) {
    const q = this.questions[this.currentIndex];
    this.answersMap[q.id] = optionIndex;
    this.saveExamState();
    this.renderCurrentQuestion();
    this.renderNavigatorGrid();
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      this.saveExamState();
      this.renderCurrentQuestion();
      this.renderNavigatorGrid();
    } else {
      if (confirm("Are you ready to submit your exam answers?")) {
        this.submitExam('Submitted');
      }
    }
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.saveExamState();
      this.renderCurrentQuestion();
      this.renderNavigatorGrid();
    }
  }

  toggleMobilePalette(forceClose = false) {
    const nav = document.getElementById('exam-question-navigator');
    const backdrop = document.getElementById('exam-palette-backdrop');
    if (!nav) return;
    const isOpen = nav.classList.contains('open');
    if (forceClose || isOpen) {
      nav.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    } else {
      nav.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
    }
  }

  jumpToQuestion(index) {
    this.currentIndex = index;
    this.saveExamState();
    this.renderCurrentQuestion();
    this.renderNavigatorGrid();
    this.toggleMobilePalette(true);
  }

  /* Submit Exam & Compute Results */
  submitExam(submitStatus = 'Submitted') {
    if (!this.examActive) return;

    this.examActive = false;
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.removeSecurityListeners();

    // Clear active exam state from localStorage
    storage.setItem(APP_KEYS.ACTIVE_EXAM_STATE, null);

    // Hide viewport
    const viewport = document.getElementById('exam-viewport-section');
    if (viewport) viewport.classList.remove('active');

    // Exit Fullscreen if active
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }

    // Evaluate answers & compute marks
    let totalMarks = 0;
    let earnedMarks = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    const evaluatedAnswers = this.questions.map(q => {
      const qMarks = parseInt(q.marks || (q.type === 'coding' ? 10 : 1), 10);
      totalMarks += qMarks;

      // Evaluate coding question
      if (q.type === 'coding') {
        const studentCoding = this.codingAnswersMap[q.id] || { code: '', language: q.language || 'python', output: '', passed: false, earnedMarks: 0 };
        const codeText = (studentCoding.code || '').trim();
        let isCorrect = false;
        let isUnanswered = false;
        let earned = 0;

        if (!codeText) {
          unansweredCount++;
          isUnanswered = true;
          earned = 0;
        } else {
          // Coding question is strictly marked correct ONLY if all test cases (including dynamic edge cases) passed
          if (studentCoding.passed === true) {
            isCorrect = true;
            earned = qMarks;
            correctCount++;
          } else {
            wrongCount++;
            earned = 0;
          }
        }
        earnedMarks += earned;

        return {
          questionId: q.id,
          type: 'coding',
          text: q.text,
          marks: qMarks,
          earnedMarks: earned,
          language: studentCoding.language || q.language || 'python',
          submittedCode: studentCoding.code || '',
          actualOutput: studentCoding.output || '',
          expectedOutput: q.expectedOutput || '',
          sampleInput: q.sampleInput || '',
          isCorrect: isCorrect,
          isUnanswered: isUnanswered,
          explanation: q.explanation
        };
      }

      // Evaluate standard MCQ question
      const userSelected = this.answersMap[q.id];
      let isCorrect = false;
      let isUnanswered = false;
      let earned = 0;

      if (userSelected === undefined || userSelected === null) {
        unansweredCount++;
        isUnanswered = true;
        earned = 0;
      } else if (userSelected === q.correctIndex) {
        correctCount++;
        isCorrect = true;
        earned = qMarks;
      } else {
        wrongCount++;
        earned = 0;
      }
      earnedMarks += earned;

      return {
        questionId: q.id,
        type: 'mcq',
        text: q.text,
        marks: qMarks,
        earnedMarks: earned,
        options: q.options,
        userSelected: userSelected,
        correctIndex: q.correctIndex,
        isCorrect: isCorrect,
        isUnanswered: isUnanswered,
        explanation: q.explanation
      };
    });

    const totalQ = this.questions.length;
    const percentage = totalMarks > 0 ? Math.round((earnedMarks / totalMarks) * 100) : 0;
    const durationMinutes = parseInt(this.currentSubject && this.currentSubject.duration, 10) || 30;

    const session = storage.getActiveSession();
    const student = session ? session.user : { name: 'Student', regNo: '952800000000', year: '1st Year', section: 'A' };

    const attemptRecord = storage.addAttempt({
      studentRegNo: student.regNo,
      studentName: student.name,
      year: student.year,
      section: student.section,
      subjectId: this.currentSubject.id,
      subjectName: this.currentSubject.name,
      score: earnedMarks,
      totalQuestions: totalQ,
      totalMarks: totalMarks,
      earnedMarks: earnedMarks,
      correctCount: correctCount,
      wrongCount: wrongCount,
      unansweredCount: unansweredCount,
      percentage: percentage,
      durationMinutes: durationMinutes,
      status: submitStatus,
      startedAt: new Date(this.startTimeStamp || (Date.now() - durationMinutes * 60 * 1000)).toISOString(),
      submittedAt: new Date().toISOString(),
      evaluatedAnswers: evaluatedAnswers
    });

    // Refresh student dashboard and render attempt result modal
    studentDashboard.renderDashboard();
    this.renderResultModal(attemptRecord);
  }

  /* Result Modal Display */
  renderResultModal(attempt) {
    if (!attempt) return;

    try {
      const titleEl = document.getElementById('result-modal-subject');
      if (titleEl) titleEl.textContent = attempt.subjectName || attempt.problemTitle || 'Exam Results Breakdown';

      const facultyEl = document.getElementById('result-modal-faculty');
      if (facultyEl) {
        const facName = attempt.createdByName || storage.getAdminDisplayName(attempt.createdBy, 'Faculty Staff');
        facultyEl.textContent = `👨‍🏫 Staff: ${facName}`;
      }

      const totalPossible = attempt.totalMarks || attempt.totalQuestions || 10;
      const earnedVal = attempt.earnedMarks !== undefined ? attempt.earnedMarks : (attempt.score !== undefined ? attempt.score : 0);
      const pct = attempt.percentage !== undefined ? attempt.percentage : (totalPossible > 0 ? Math.round((earnedVal / totalPossible) * 100) : 0);

      const numEl = document.getElementById('result-score-num');
      if (numEl) numEl.textContent = `${earnedVal}/${totalPossible} Marks`;

      const pctEl = document.getElementById('result-score-pct');
      if (pctEl) pctEl.textContent = `${pct}% Score`;

      const totalEl = document.getElementById('result-stat-total');
      if (totalEl) totalEl.textContent = attempt.totalQuestions !== undefined ? attempt.totalQuestions : 1;

      const correctEl = document.getElementById('result-stat-correct');
      if (correctEl) correctEl.textContent = attempt.correctCount !== undefined ? attempt.correctCount : (earnedVal > 0 ? 1 : 0);

      const wrongEl = document.getElementById('result-stat-wrong');
      if (wrongEl) wrongEl.textContent = attempt.wrongCount !== undefined ? attempt.wrongCount : (earnedVal === 0 ? 1 : 0);

      const unansEl = document.getElementById('result-stat-unanswered');
      if (unansEl) {
        const uCount = attempt.unansweredCount !== undefined ? attempt.unansweredCount : 0;
        unansEl.textContent = Math.max(0, uCount);
      }

      const statusBadgeContainer = document.getElementById('result-stat-status-badge');
      if (statusBadgeContainer) {
        const isAuto = attempt.status === 'Auto Submitted';
        const isPassed = pct >= 50;
        statusBadgeContainer.innerHTML = isAuto
          ? `<div class="badge badge-danger" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">Auto Submitted (Anti-Cheating Violations)</div>`
          : `<div class="badge ${isPassed ? 'badge-success' : 'badge-danger'}" style="font-size: 0.9rem; padding: 0.4rem 0.8rem;">${attempt.status || (isPassed ? 'PASSED' : 'FAILED')} (${pct}%)</div>`;
      }

      // Review List
      const reviewContainer = document.getElementById('result-review-list');
      if (reviewContainer) {
        const evaluated = Array.isArray(attempt.evaluatedAnswers) && attempt.evaluatedAnswers.length > 0
          ? attempt.evaluatedAnswers
          : [{
              text: attempt.problemTitle || attempt.subjectName || 'Coding Challenge',
              type: 'coding',
              language: attempt.language || 'python',
              submittedCode: attempt.submittedCode || attempt.code || '',
              marks: attempt.earnedMarks || attempt.score || 0,
              isCorrect: (attempt.earnedMarks || attempt.score || 0) > 0,
              explanation: ''
            }];

        const letters = ['A', 'B', 'C', 'D'];
        reviewContainer.innerHTML = evaluated.map((q, idx) => {
          const qText = String(q.text || q.questionText || q.title || q.question || 'Problem Statement').trim();
          let statusBadge = '<span class="badge badge-danger">Incorrect</span>';
          let cardClass = 'wrong';

          if (q.isCorrect || q.passed) {
            statusBadge = '<span class="badge badge-success">Correct</span>';
            cardClass = 'correct';
          } else if (q.isUnanswered) {
            statusBadge = '<span class="badge badge-warning">Unanswered</span>';
            cardClass = 'unanswered';
          }

          // Render Coding Review Item
          if (q.type === 'coding' || attempt.type === 'coding_lab') {
            const qMarks = q.marks || q.maxMarks || 10;
            const qEarned = q.earnedMarks !== undefined ? q.earnedMarks : (q.marks !== undefined ? q.marks : (q.isCorrect ? qMarks : 0));
            const codingBadge = (q.isCorrect || q.passed)
              ? `<span class="badge badge-success" style="font-size: 0.82rem; padding: 0.3rem 0.65rem;">✓ Passed (+${qEarned} / ${qMarks} Marks)</span>`
              : (q.isUnanswered
                ? `<span class="badge badge-warning" style="font-size: 0.82rem; padding: 0.3rem 0.65rem;">Unanswered (0 / ${qMarks} Marks)</span>`
                : `<span class="badge badge-danger" style="font-size: 0.82rem; padding: 0.3rem 0.65rem;">✗ Failed (${qEarned} / ${qMarks} Marks)</span>`);

            return `
              <div class="answer-review-item ${cardClass}">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                  <strong>Q${idx + 1}. [Coding Solution] ${escapeHtml(qText.substring(0, 120))}${qText.length > 120 ? '...' : ''}</strong>
                  ${codingBadge}
                </div>
                <div style="font-size: 0.82rem; color: #94a3b8; margin-bottom: 0.4rem;">
                  Language: <strong style="color: var(--primary-300);">${(q.language || attempt.language || 'python').toUpperCase()}</strong> • Earned: <strong style="color: #fbbf24;">${qEarned} / ${qMarks} Marks</strong>
                </div>
                <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #cbd5e1; margin-top: 0.5rem;">Submitted Code:</div>
                <div class="coding-review-box" style="white-space: pre; font-family: var(--font-mono, monospace); font-size: 0.85rem; max-height: 200px; overflow: auto; background: #060911; padding: 0.65rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">${escapeHtml(q.submittedCode || attempt.submittedCode || attempt.code || '// No code submitted')}</div>
                ${q.expectedOutput ? `
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem;">
                    <div>
                      <div style="font-size: 0.72rem; font-weight: 700; color: #94a3b8;">Expected Output:</div>
                      <div class="coding-review-box" style="margin: 0.25rem 0; background: #060911; padding: 0.4rem 0.6rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">${escapeHtml(q.expectedOutput)}</div>
                    </div>
                    <div>
                      <div style="font-size: 0.72rem; font-weight: 700; color: #94a3b8;">Your Output:</div>
                      <div class="coding-review-box" style="margin: 0.25rem 0; color: ${(q.isCorrect || q.passed) ? '#34d399' : '#f87171'}; background: #060911; padding: 0.4rem 0.6rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.08);">${escapeHtml(q.actualOutput || '(None)')}</div>
                    </div>
                  </div>
                ` : ''}
                ${q.explanation ? `<div class="review-explanation" style="margin-top: 0.5rem;"><strong>Explanation / Solution:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
              </div>
            `;
          }

          // Render MCQ Review Item
          return `
            <div class="answer-review-item ${cardClass}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <strong>Q${idx + 1}. ${escapeHtml(qText)}</strong>
                ${statusBadge}
              </div>
              <div>
                ${(Array.isArray(q.options) ? q.options : []).map((opt, oIdx) => {
                  let optClasses = 'review-opt';
                  if (q.userSelected === oIdx) optClasses += ' user-selected';
                  if (q.correctIndex === oIdx) optClasses += ' correct-target';

                  return `
                    <div class="${optClasses}">
                      ${letters[oIdx] || (oIdx + 1)}. ${escapeHtml(opt)}
                      ${q.correctIndex === oIdx ? ' ✓ (Correct Answer)' : ''}
                      ${q.userSelected === oIdx && !q.isCorrect ? ' ✗ (Your Answer)' : ''}
                    </div>
                  `;
                }).join('')}
              </div>
              ${q.explanation ? `<div class="review-explanation"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
            </div>
          `;
        }).join('');
      }

      ui.showModal('modal-exam-result');
      if (typeof window.renderGlobalAdSlots === 'function') {
        window.renderGlobalAdSlots();
      }
    } catch (err) {
      console.error('Error rendering result modal:', err);
      ui.showToast('Error opening result details.', 'error');
    }
  }

  /* ==========================================================================
     ONLINE COMPILER WORKSPACE & RUNNER METHODS
     ========================================================================== */

  renderCodingQuestionWorkspace(q, container) {
    if (!container) return;

    // Initialize student's code state if not present
    if (!this.codingAnswersMap[q.id]) {
      const defaultLang = q.language || 'python';
      this.codingAnswersMap[q.id] = {
        code: q.starterCode || this.getDefaultStarterCode(defaultLang),
        language: defaultLang,
        stdin: q.sampleInput || '',
        output: '',
        passed: false,
        tested: false
      };
    }

    const state = this.codingAnswersMap[q.id];
    const currentCode = state.code !== undefined ? state.code : (q.starterCode || this.getDefaultStarterCode(state.language || 'python'));
    const currentLang = state.language || q.language || 'python';
    const currentStdin = state.stdin !== undefined ? state.stdin : (q.sampleInput || '');

    const testCases = this.getQuestionTestCases(q);
    const hasTestCases = testCases.length > 0;
    const qFaculty = q.createdByName || 
      storage.getAdminDisplayName(q.createdBy, '') || 
      (this.currentSubject ? (this.currentSubject.createdByName || storage.getAdminDisplayName(this.currentSubject.createdBy, '')) : '') || 
      'Faculty Staff';

    const sampleIoHtml = hasTestCases ? `
      <div class="coding-problem-meta-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem;">
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 0.45rem;">
            <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #38bdf8; width: 16px; height: 16px;"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span>Problem Test Specifications (${testCases.length} Test Cases)</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
            <span style="font-size: 0.72rem; color: #818cf8; background: rgba(99, 102, 241, 0.12); border: 1px solid rgba(99, 102, 241, 0.3); padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 700;">
              👨‍🏫 Staff: ${escapeHtml(qFaculty)}
            </span>
            <span style="font-size: 0.72rem; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.2rem 0.6rem; border-radius: 999px; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">
              <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%;"></span>
              Dynamic Anti-Cheat Active
            </span>
          </div>
        </div>
        <div class="coding-sample-io-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem;">
          ${testCases.map((tc, idx) => `
            <div class="sample-io-card" style="background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.75rem 0.95rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.45rem;">
                <span style="font-size: 0.78rem; font-weight: 800; color: #a5b4fc; display: flex; align-items: center; gap: 0.3rem;">
                  ⚡ ${escapeHtml(tc.name || `Test Case ${idx + 1}`)}
                </span>
                ${tc.input ? `
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 0.15rem 0.5rem; font-size: 0.7rem; border-radius: 4px;" onclick="examEngine.loadInputToStdin('${escapeHtml(tc.input.replace(/'/g, "\\'"))}')" title="Copy this input into Stdin box">
                    Load to Stdin
                  </button>
                ` : ''}
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem; font-family: var(--font-mono, monospace);">
                ${tc.input ? `
                  <div>
                    <span style="color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Input (stdin):</span>
                    <div style="color: #f1f5f9; background: #090d16; padding: 0.25rem 0.5rem; border-radius: 4px; margin-top: 0.2rem; border: 1px solid rgba(255,255,255,0.06);">${escapeHtml(tc.input)}</div>
                  </div>
                ` : ''}
                <div>
                  <span style="color: #94a3b8; font-size: 0.68rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Expected Output:</span>
                  <div style="color: #38bdf8; background: #090d16; padding: 0.25rem 0.5rem; border-radius: 4px; margin-top: 0.2rem; border: 1px solid rgba(56, 189, 248, 0.2); font-weight: 600;">${escapeHtml(tc.expected)}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : '';

    const qMarks = parseInt(q.marks || 10, 10);
    const isPassed = !!state.passed;
    const isTested = !!state.tested;

    const marksBannerHtml = `
      <div id="compiler-marks-banner" class="compiler-marks-banner ${isPassed ? 'passed' : (isTested ? 'failed' : '')}">
        <div class="marks-banner-title" id="compiler-marks-banner-title">
          ${isPassed
            ? `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #10b981; width: 20px; height: 20px;"><polyline points="20 6 9 17 4 12"/></svg>
               <span><strong>Solution Passed!</strong> Output matches all required test cases.</span>`
            : (isTested
              ? `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #ef4444; width: 20px; height: 20px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                 <span><strong>Test Case Failed:</strong> Output did not match expected solution. Check diff below and revise your code.</span>`
              : `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #f59e0b; width: 20px; height: 20px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                 <span>Question Weight: <strong>${qMarks} Marks</strong>. Click <strong>Test Solution</strong> to evaluate your code and earn marks.</span>`
              )
          }
        </div>
        <div class="marks-award-chip ${isPassed ? 'earned' : (isTested ? 'zero' : 'pending')}" id="compiler-marks-chip">
          ${isPassed ? `🎉 ${qMarks} / ${qMarks} Marks Awarded` : (isTested ? `0 / ${qMarks} Marks` : `Value: ${qMarks} Marks`)}
        </div>
      </div>
    `;

    container.innerHTML = `
      ${marksBannerHtml}
      ${sampleIoHtml}

      <div class="coding-compiler-wrapper" id="compiler-main-box">
        <!-- Top Chrome Header Bar with Window Controls & Custom Dropdown -->
        <div class="ide-chrome-header">
          <div class="ide-chrome-left">
            <div class="ide-window-dots">
              <span class="dot-btn close-dot" title="Editor Window"></span>
              <span class="dot-btn reset-dot" onclick="examEngine.resetCompilerCode()" title="Reset Code"></span>
              <span class="dot-btn max-dot" title="Active"></span>
            </div>

            <!-- File Tab Pill -->
            <div class="ide-tab-pill active">
              <span class="ide-tab-icon" id="exam-file-icon">${this.getLangIcon(currentLang)}</span>
              <span class="ide-tab-filename" id="exam-file-name">${this.getLangFileName(currentLang)}</span>
              <span class="ide-tab-status"></span>
            </div>

            <!-- Custom Language Dropdown (No native select ugly styling) -->
            <div class="ide-custom-dropdown" id="exam-lang-custom-dropdown">
              <button type="button" class="ide-custom-dropdown-btn" onclick="examEngine.toggleExamLangMenu(event)">
                <span class="ide-lang-code-tag">&lt;/&gt;</span>
                <span class="ide-lang-selected-label" id="exam-selected-lang-label">${this.getLangLabel(currentLang)}</span>
                <span class="ide-lang-version-pill" id="exam-selected-lang-ver">${this.getLangVer(currentLang)}</span>
                <svg class="svg-icon ide-chevron" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="ide-custom-dropdown-menu" id="exam-lang-menu">
                <div class="ide-dropdown-item ${currentLang === 'python' ? 'active' : ''}" data-lang="python" onclick="examEngine.selectExamLanguage('python', 'Python 3', '3.8.1', '🐍')">
                  <div class="item-left">
                    <span class="lang-item-icon">🐍</span>
                    <div class="lang-item-info">
                      <span class="lang-item-name">Python 3</span>
                      <span class="lang-item-desc">CPython 3.8.1 • Fast Execution</span>
                    </div>
                  </div>
                  <div class="item-right">
                    <span class="lang-item-ver-tag">v3.8</span>
                    <svg class="svg-icon lang-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="ide-dropdown-item ${currentLang === 'javascript' ? 'active' : ''}" data-lang="javascript" onclick="examEngine.selectExamLanguage('javascript', 'JavaScript', 'Node 18', '⚡')">
                  <div class="item-left">
                    <span class="lang-item-icon">⚡</span>
                    <div class="lang-item-info">
                      <span class="lang-item-name">JavaScript</span>
                      <span class="lang-item-desc">Node.js 18.15 • V8 Engine</span>
                    </div>
                  </div>
                  <div class="item-right">
                    <span class="lang-item-ver-tag">Node 18</span>
                    <svg class="svg-icon lang-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="ide-dropdown-item ${currentLang === 'c' ? 'active' : ''}" data-lang="c" onclick="examEngine.selectExamLanguage('c', 'C (GCC)', '9.2.0', '⚙️')">
                  <div class="item-left">
                    <span class="lang-item-icon">⚙️</span>
                    <div class="lang-item-info">
                      <span class="lang-item-name">C (GCC)</span>
                      <span class="lang-item-desc">GNU GCC 9.2.0 • ISO C11</span>
                    </div>
                  </div>
                  <div class="item-right">
                    <span class="lang-item-ver-tag">GCC 9.2</span>
                    <svg class="svg-icon lang-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="ide-dropdown-item ${currentLang === 'cpp' ? 'active' : ''}" data-lang="cpp" onclick="examEngine.selectExamLanguage('cpp', 'C++ (GCC)', '9.2.0', '🚀')">
                  <div class="item-left">
                    <span class="lang-item-icon">🚀</span>
                    <div class="lang-item-info">
                      <span class="lang-item-name">C++ (GCC)</span>
                      <span class="lang-item-desc">GNU G++ 9.2.0 • ISO C++17</span>
                    </div>
                  </div>
                  <div class="item-right">
                    <span class="lang-item-ver-tag">C++17</span>
                    <svg class="svg-icon lang-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
                <div class="ide-dropdown-item ${currentLang === 'java' ? 'active' : ''}" data-lang="java" onclick="examEngine.selectExamLanguage('java', 'Java (OpenJDK)', '13.0.1', '☕')">
                  <div class="item-left">
                    <span class="lang-item-icon">☕</span>
                    <div class="lang-item-info">
                      <span class="lang-item-name">Java (OpenJDK)</span>
                      <span class="lang-item-desc">OpenJDK 13.0.1 • HotSpot JVM</span>
                    </div>
                  </div>
                  <div class="item-right">
                    <span class="lang-item-ver-tag">JDK 13</span>
                    <svg class="svg-icon lang-check-icon" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                </div>
              </div>
              <select id="compiler-language-select" style="display: none;">
                <option value="python" ${currentLang === 'python' ? 'selected' : ''}>Python 3</option>
                <option value="javascript" ${currentLang === 'javascript' ? 'selected' : ''}>JavaScript</option>
                <option value="c" ${currentLang === 'c' ? 'selected' : ''}>C</option>
                <option value="cpp" ${currentLang === 'cpp' ? 'selected' : ''}>C++</option>
                <option value="java" ${currentLang === 'java' ? 'selected' : ''}>Java</option>
              </select>
            </div>
          </div>

          <div class="ide-chrome-right">
            <!-- Custom Input Drawer Toggle -->
            <button type="button" class="ide-tool-btn ${currentStdin ? 'active' : ''}" id="btn-toggle-stdin" onclick="examEngine.toggleCompilerStdin()" title="Toggle custom input (stdin)">
              <svg class="svg-icon" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/></svg>
              <span>Custom Input</span>
              <span class="ide-badge-dot" id="exam-stdin-active-dot" style="${currentStdin ? 'display: inline-block;' : 'display: none;'}"></span>
            </button>
            <button type="button" class="ide-tool-btn" onclick="examEngine.resetCompilerCode()" title="Reset to starter code">
              <svg class="svg-icon" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              <span>Reset</span>
            </button>
            <button type="button" class="ide-tool-btn" onclick="examEngine.clearCompilerOutput()" title="Clear console output">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Clear</span>
            </button>
          </div>
        </div>

        <!-- Custom Input Drawer -->
        <div id="compiler-stdin-panel" class="ide-stdin-panel ${currentStdin ? 'active' : ''}">
          <div class="ide-stdin-header">
            <div class="ide-stdin-header-left">
              <span class="ide-stdin-pill">STDIN</span>
              <span class="ide-stdin-title">Custom Program Input</span>
              <span class="ide-stdin-hint">Passed to input() / scanf()</span>
            </div>
            <button type="button" class="ide-stdin-clear-btn" onclick="examEngine.clearExamStdin()" title="Clear standard input">
              <svg class="svg-icon" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Clear</span>
            </button>
          </div>
          <textarea id="coding-stdin-textarea" class="ide-stdin-textarea" placeholder="Enter input values here..." oninput="examEngine.onStdinInput(this)">${escapeHtml(currentStdin)}</textarea>
        </div>

        <!-- Editor with Gutter Line Numbers, Syntax Highlighter and Statusbar -->
        <div class="compiler-editor-container" style="display: flex; flex-direction: column;">
          <div style="display: flex; flex: 1; min-height: 280px; position: relative;" class="ide-code-container">
            <div class="coding-line-numbers ide-line-gutter" id="coding-line-numbers">1</div>
            <div class="ide-editor-wrapper">
              <pre class="ide-highlight-layer" id="exam-highlight-layer" aria-hidden="true"><code id="exam-highlight-code" class="code-highlight"></code></pre>
              <textarea id="coding-editor-textarea" class="coding-editor-textarea ide-textarea"
                placeholder="// Write your code here..."
                spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
                oninput="examEngine.onCodeEditorInput(this)"
                onkeydown="examEngine.onCodeEditorKeyDown(event, this)"
                onkeyup="examEngine.updateExamCursorPosition(this)"
                onclick="examEngine.updateExamCursorPosition(this)"
                onscroll="examEngine.syncExamScroll(this)">${escapeHtml(currentCode)}</textarea>
            </div>
          </div>

          <!-- Mobile & Tablet Quick Symbol Assistant Bar -->
          <div class="ide-quick-symbol-bar" id="exam-quick-symbol-bar">
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('Tab')">Tab ⇥</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('{}')">{ }</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('()')">( )</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('[]')">[ ]</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('\"\"')">" "</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('\'\'')">' '</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor(';')">;</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor(':')">:</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('=')">=</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('==')">==</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('!=')">!=</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('&lt;')">&lt;</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('&gt;')">&gt;</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('+')">+</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('-')">-</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('*')">*</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('/')">/</button>
            <button type="button" class="symbol-btn" onclick="examEngine.insertSymbolAtCursor('%')">%</button>
          </div>

          <!-- Editor Status Footer -->
          <div class="ide-editor-statusbar">
            <div class="statusbar-left">
              <span class="statusbar-item" id="exam-statusbar-pos">Ln 1, Col 1</span>
              <span class="statusbar-item">Spaces: 4</span>
              <span class="statusbar-item">UTF-8</span>
            </div>
            <div class="statusbar-right">
              <span class="statusbar-item" id="exam-statusbar-lang"><span class="status-lang-dot"></span> ${this.getLangLabel(currentLang)}</span>
              <span class="statusbar-item shortcut-hint"><kbd>Ctrl</kbd>+<kbd>Enter</kbd> to Run</span>
            </div>
          </div>
        </div>

        <!-- Actions Bar -->
        <div class="compiler-actions-bar">
          <div class="compiler-actions-left">
            <button type="button" class="btn-run-code" id="btn-compiler-run" onclick="examEngine.runCompilerCode(false)" title="Execute code (Ctrl+Enter)">
              <svg class="svg-icon" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Run Code</span>
              <span style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.2); font-size: 0.68rem; padding: 0.1rem 0.35rem; border-radius: 4px; margin-left: 0.3rem;">Ctrl+↵</span>
            </button>

            ${hasTestCases ? `
              <button type="button" class="btn-test-code" id="btn-compiler-test" onclick="examEngine.runCompilerCode(true)" title="Run all positive and negative edge test cases">
                <svg class="svg-icon" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                <span>Test Solution</span>
                <span style="background: rgba(255,255,255,0.2); font-size: 0.72rem; padding: 0.15rem 0.45rem; border-radius: 999px; margin-left: 0.35rem; font-weight: 800;">+${qMarks} Marks</span>
              </button>
            ` : ''}
          </div>

          <div class="compiler-actions-right">
            <span id="compiler-run-status" class="compiler-status-indicator">
              <span class="status-dot"></span> <span id="exam-status-text">Ready</span>
            </span>
          </div>
        </div>

        <!-- Terminal Console Output Box -->
        <div class="compiler-terminal-box">
          <div class="compiler-terminal-header">
            <div style="display: flex; align-items: center; gap: 0.45rem;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="width: 13px; height: 13px;"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
              <span>Terminal / Console Output</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span id="compiler-meta-stats" class="compiler-meta-stats"></span>
              <button type="button" class="ide-terminal-mini-btn" onclick="examEngine.copyExamOutput()" title="Copy Console Output">
                <svg class="svg-icon" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span id="exam-copy-text">Copy</span>
              </button>
            </div>
          </div>
          <div id="compiler-terminal-output" class="compiler-terminal-output ${state.output ? 'has-normal' : ''}">${state.output ? escapeHtml(state.output) : '$ Ready. Click "Run Code" or "Test Solution" to compile and execute program...'}</div>
          <div id="compiler-test-result" class="compiler-test-result" style="display: none;"></div>
        </div>
      </div>
    `;

    // Initialize line numbers & syntax highlight
    const editor = document.getElementById('coding-editor-textarea');
    if (editor) {
      this.syncLineNumbers(editor);
      this.syncExamHighlight(editor);
    }
  }

  loadInputToStdin(val) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    const stdinEl = document.getElementById('coding-stdin-textarea');
    const panel = document.getElementById('compiler-stdin-panel');
    const dot = document.getElementById('exam-stdin-active-dot');
    if (stdinEl) stdinEl.value = val;
    if (panel) panel.classList.add('active');
    if (dot) dot.style.display = val ? 'inline-block' : 'none';
    if (this.codingAnswersMap[q.id]) this.codingAnswersMap[q.id].stdin = val;
    this.saveExamState();
    ui.showToast(`Loaded "${val}" into stdin.`, 'info');
  }

  loadSampleInputToStdin() {
    const q = this.questions[this.currentIndex];
    if (!q || !q.sampleInput) return;
    this.loadInputToStdin(q.sampleInput);
  }

  updateMarksBanner(isPassed, isTested, qMarks) {
    const banner = document.getElementById('compiler-marks-banner');
    const title = document.getElementById('compiler-marks-banner-title');
    const chip = document.getElementById('compiler-marks-chip');
    if (!banner || !chip) return;

    banner.className = `compiler-marks-banner ${isPassed ? 'passed' : (isTested ? 'failed' : '')}`;
    chip.className = `marks-award-chip ${isPassed ? 'earned' : (isTested ? 'zero' : 'pending')}`;
    chip.textContent = isPassed ? `🎉 ${qMarks} / ${qMarks} Marks Awarded` : (isTested ? `0 / ${qMarks} Marks` : `Value: ${qMarks} Marks`);

    if (title) {
      if (isPassed) {
        title.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #10b981; width: 20px; height: 20px;"><polyline points="20 6 9 17 4 12"/></svg>
          <span><strong>Solution Passed!</strong> Output matches all required test cases (Primary &amp; Edge Cases).</span>`;
      } else if (isTested) {
        title.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #ef4444; width: 20px; height: 20px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          <span><strong>Test Case Failed:</strong> Output did not match all expected edge test cases. Check diff and revise code.</span>`;
      } else {
        title.innerHTML = `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #f59e0b; width: 20px; height: 20px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>Question Weight: <strong>${qMarks} Marks</strong>. Click <strong>Test Solution</strong> to evaluate your code and earn marks.</span>`;
      }
    }
  }

  getDefaultStarterCode(lang) {
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
        return `# Python 3 Solution\ndef solution():\n    # Read dynamic input:\n    # n = input()\n    pass\n\nif __name__ == '__main__':\n    solution()`;
    }
  }

  getLangIcon(lang) {
    const MAP = { python: '🐍', javascript: '⚡', c: '⚙️', cpp: '🚀', java: '☕' };
    return MAP[lang] || '🐍';
  }

  getLangFileName(lang) {
    const MAP = { python: 'solution.py', javascript: 'solution.js', c: 'solution.c', cpp: 'solution.cpp', java: 'Solution.java' };
    return MAP[lang] || 'solution.py';
  }

  getLangLabel(lang) {
    const MAP = { python: 'Python 3', javascript: 'JavaScript', c: 'C (GCC)', cpp: 'C++ (GCC)', java: 'Java (OpenJDK)' };
    return MAP[lang] || 'Python 3';
  }

  getLangVer(lang) {
    const MAP = { python: '3.8.1', javascript: 'Node 18', c: '9.2.0', cpp: '9.2.0', java: '13.0.1' };
    return MAP[lang] || '3.8.1';
  }

  toggleExamLangMenu(e) {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const menu = document.getElementById('exam-lang-menu');
    const btn = document.querySelector('#exam-lang-custom-dropdown .ide-custom-dropdown-btn');
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

  selectExamLanguage(langKey, label, ver, icon) {
    const q = this.questions[this.currentIndex];
    const lbl = document.getElementById('exam-selected-lang-label');
    const verEl = document.getElementById('exam-selected-lang-ver');
    const hiddenSelect = document.getElementById('compiler-language-select');
    const statusLang = document.getElementById('exam-statusbar-lang');
    const fileIcon = document.getElementById('exam-file-icon');
    const fileName = document.getElementById('exam-file-name');
    const menu = document.getElementById('exam-lang-menu');
    const btn = document.querySelector('#exam-lang-custom-dropdown .ide-custom-dropdown-btn');

    if (lbl) lbl.textContent = label;
    if (verEl) verEl.textContent = ver;
    if (hiddenSelect) hiddenSelect.value = langKey;
    if (statusLang) statusLang.innerHTML = `<span class="status-lang-dot"></span> ${label}`;

    const FILE_MAP = {
      python: { icon: '🐍', name: 'solution.py' },
      javascript: { icon: '⚡', name: 'solution.js' },
      c: { icon: '⚙️', name: 'solution.c' },
      cpp: { icon: '🚀', name: 'solution.cpp' },
      java: { icon: '☕', name: 'Solution.java' }
    };
    const fInfo = FILE_MAP[langKey] || FILE_MAP.python;
    if (fileIcon) fileIcon.textContent = fInfo.icon;
    if (fileName) fileName.textContent = fInfo.name;

    if (menu) {
      menu.querySelectorAll('.ide-dropdown-item').forEach(item => {
        item.classList.toggle('active', item.getAttribute('data-lang') === langKey);
      });
      menu.classList.remove('show');
    }
    if (btn) btn.classList.remove('active');

    this.onCompilerLanguageChange(langKey);
  }

  updateExamCursorPosition(textarea) {
    const posEl = document.getElementById('exam-statusbar-pos');
    if (!posEl || !textarea) return;
    const start = textarea.selectionStart || 0;
    const textBefore = textarea.value.substring(0, start);
    const lines = textBefore.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    posEl.textContent = `Ln ${lineNum}, Col ${colNum}`;
  }

  insertSymbolAtCursor(symbol) {
    const editor = document.getElementById('coding-editor-textarea');
    if (!editor) return;
    editor.focus();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const val = editor.value;

    let insertText = symbol;
    let newCursorPos = start + symbol.length;

    if (symbol === '{}' || symbol === '()' || symbol === '[]' || symbol === '""' || symbol === "''") {
      newCursorPos = start + 1;
    } else if (symbol === 'Tab') {
      insertText = '    ';
      newCursorPos = start + 4;
    }

    editor.value = val.substring(0, start) + insertText + val.substring(end);
    editor.selectionStart = editor.selectionEnd = newCursorPos;
    this.onCodeEditorInput(editor);
    this.updateExamCursorPosition(editor);
  }

  clearExamStdin() {
    const q = this.questions[this.currentIndex];
    const stdinEl = document.getElementById('coding-stdin-textarea');
    const dot = document.getElementById('exam-stdin-active-dot');
    if (stdinEl) stdinEl.value = '';
    if (dot) dot.style.display = 'none';
    if (q && this.codingAnswersMap[q.id]) {
      this.codingAnswersMap[q.id].stdin = '';
      this.saveExamState();
    }
    ui.showToast('Stdin cleared.', 'info');
  }

  copyExamOutput() {
    const outputEl = document.getElementById('compiler-terminal-output');
    const copyText = document.getElementById('exam-copy-text');
    if (!outputEl) return;
    const textToCopy = outputEl.textContent.replace(/^\$ [^\n]+\n*/, '');
    navigator.clipboard.writeText(textToCopy).then(() => {
      if (copyText) copyText.textContent = 'Copied!';
      ui.showToast('Terminal output copied.', 'success');
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copy';
      }, 1500);
    }).catch(() => {
      ui.showToast('Could not copy output.', 'warning');
    });
  }

  onCompilerLanguageChange(newLang) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (!this.codingAnswersMap[q.id]) this.codingAnswersMap[q.id] = {};
    const oldCode = (this.codingAnswersMap[q.id].code || '').trim();
    this.codingAnswersMap[q.id].language = newLang;

    const editor = document.getElementById('coding-editor-textarea');
    if (editor && (!oldCode || oldCode.includes('Solution') || oldCode === (q.starterCode || '').trim())) {
      const template = this.getDefaultStarterCode(newLang);
      editor.value = template;
      this.codingAnswersMap[q.id].code = template;
      this.syncLineNumbers(editor);
      this.syncExamHighlight(editor);
      this.updateExamCursorPosition(editor);
    } else if (editor) {
      this.syncExamHighlight(editor);
    }
    this.saveExamState();
    ui.showToast(`Switched language to ${newLang.toUpperCase()}`, 'info');
  }

  onCodeEditorInput(textarea) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (!this.codingAnswersMap[q.id]) this.codingAnswersMap[q.id] = {};
    this.codingAnswersMap[q.id].code = textarea.value;
    this.syncLineNumbers(textarea);
    this.syncExamHighlight(textarea);
    this.saveExamState();
    this.renderNavigatorGrid();
  }

  syncExamHighlight(textarea) {
    const codeEl = document.getElementById('exam-highlight-code');
    if (!codeEl || !textarea) return;
    const q = this.questions[this.currentIndex];
    const currentLang = (this.codingAnswersMap[q.id] && this.codingAnswersMap[q.id].language) || q.language || 'python';
    let text = textarea.value;
    if (text.endsWith('\n')) {
      text += ' ';
    }
    codeEl.innerHTML = this.highlightCode(text, currentLang);
  }

  syncExamScroll(textarea) {
    const gutter = document.getElementById('coding-line-numbers');
    const highlightLayer = document.getElementById('exam-highlight-layer');
    if (gutter) {
      gutter.scrollTop = textarea.scrollTop;
    }
    if (highlightLayer) {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    }
  }

  highlightCode(code, lang = 'python') {
    if (!code) return '';

    const escape = (str) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const LANG_DATA = {
      python: {
        keywords: new Set([
          'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
          'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from',
          'global', 'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not',
          'or', 'pass', 'raise', 'return', 'try', 'while', 'with', 'yield'
        ]),
        datatypes: new Set([
          'int', 'float', 'str', 'bool', 'list', 'dict', 'tuple', 'set',
          'bytes', 'bytearray', 'complex', 'object', 'type'
        ]),
        constants: new Set(['True', 'False', 'None', 'Ellipsis']),
        builtins: new Set([
          'print', 'len', 'range', 'input', 'open', 'sum', 'min', 'max',
          'abs', 'round', 'map', 'filter', 'zip', 'enumerate', 'sorted',
          'reversed', 'all', 'any', 'isinstance', 'issubclass', 'id',
          'super', 'iter', 'next', 'pow', 'dir', 'help', 'bin', 'hex', 'oct'
        ])
      },
      javascript: {
        keywords: new Set([
          'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
          'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
          'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
          'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
          'var', 'void', 'while', 'with', 'yield', 'let', 'static', 'enum',
          'await', 'async'
        ]),
        datatypes: new Set([
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
          'System', 'out', 'println', 'print', 'printf', 'Math', 'Arrays', 'Collections', 'main', 'nextInt', 'nextLine', 'next'
        ])
      }
    };

    const cfg = LANG_DATA[lang] || LANG_DATA.python;

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
      '(' + commentPattern + ')' +
      '|(' + stringPattern + ')' +
      '|(' + preprocessorPattern + ')' +
      '|(\\b0x[0-9a-fA-F]+\\b|\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?(?:[uUlLfFdD]+)?\\b)' +
      '|(\\b[a-zA-Z_$][a-zA-Z0-9_$]*\\b)' +
      '|(===|!==|==|!=|<=|>=|=>|->|::|\\+\\+|--|\\+=|-=|\\*=|/=|%=|&&|\\|\\||<<|>>|[+\\-*/%=<>!&|^~?:])' +
      '|([[{}\\]();,.])' +
      '|(\\s+|[^\\s\'"`a-zA-Z0-9_$+\\-*/%=<>!&|^~?:[{}\\]();,.]+)',
      'g'
    );

    let html = '';
    let match;

    while ((match = masterRegex.exec(code)) !== null) {
      if (match[1]) {
        html += `<span class="token-comment">${escape(match[1])}</span>`;
      } else if (match[2]) {
        html += `<span class="token-string">${escape(match[2])}</span>`;
      } else if (match[3]) {
        html += `<span class="token-preprocessor">${escape(match[3])}</span>`;
      } else if (match[4]) {
        html += `<span class="token-number">${escape(match[4])}</span>`;
      } else if (match[5]) {
        const word = match[5];
        if (cfg.datatypes && cfg.datatypes.has(word)) {
          html += `<span class="token-datatype">${escape(word)}</span>`;
        } else if (cfg.keywords && cfg.keywords.has(word)) {
          html += `<span class="token-keyword">${escape(word)}</span>`;
        } else if (cfg.constants && cfg.constants.has(word)) {
          html += `<span class="token-constant">${escape(word)}</span>`;
        } else if (cfg.builtins && cfg.builtins.has(word)) {
          html += `<span class="token-builtin">${escape(word)}</span>`;
        } else {
          const remaining = code.substring(masterRegex.lastIndex);
          if (/^\s*\(/.test(remaining)) {
            html += `<span class="token-function">${escape(word)}</span>`;
          } else {
            html += escape(word);
          }
        }
      } else if (match[6]) {
        html += `<span class="token-operator">${escape(match[6])}</span>`;
      } else if (match[7]) {
        html += `<span class="token-punctuation">${escape(match[7])}</span>`;
      } else if (match[8]) {
        html += escape(match[8]);
      }
    }

    return html;
  }

  onCodeEditorKeyDown(e, textarea) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      this.runCompilerCode(false);
      return;
    }

    // 1. SMART ENTER INDENTATION & ALIGNMENT
    if (e.key === 'Enter') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      const match = currentLine.match(/^\s*/);
      const currentIndent = match ? match[0] : '';

      const charBefore = val.charAt(start - 1);
      const charAfter = val.charAt(start);

      // Case A: Cursor is between { and } or ( and ) or [ and ]
      if ((charBefore === '{' && charAfter === '}') ||
          (charBefore === '(' && charAfter === ')') ||
          (charBefore === '[' && charAfter === ']')) {
        e.preventDefault();
        const childIndent = currentIndent + '    ';
        const newText = '\n' + childIndent + '\n' + currentIndent;
        textarea.value = val.substring(0, start) + newText + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + childIndent.length + 1;
        this.onCodeEditorInput(textarea);
        this.updateExamCursorPosition(textarea);
        return;
      }

      // Case B: Current line ends with { or : or ( or [ -> add 4 spaces
      const trimmedBefore = currentLine.trim();
      if (trimmedBefore.endsWith('{') || trimmedBefore.endsWith(':') || trimmedBefore.endsWith('(') || trimmedBefore.endsWith('[')) {
        e.preventDefault();
        const newText = '\n' + currentIndent + '    ';
        textarea.value = val.substring(0, start) + newText + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + newText.length;
        this.onCodeEditorInput(textarea);
        this.updateExamCursorPosition(textarea);
        return;
      }

      // Case C: Standard Enter with matching indentation
      if (currentIndent.length > 0) {
        e.preventDefault();
        const newText = '\n' + currentIndent;
        textarea.value = val.substring(0, start) + newText + val.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + newText.length;
        this.onCodeEditorInput(textarea);
        this.updateExamCursorPosition(textarea);
        return;
      }
    }

    // 2. AUTO-CLOSING BRACKETS & PAIRS
    const AUTO_PAIRS = {
      '{': '}',
      '(': ')',
      '[': ']',
      '"': '"',
      "'": "'"
    };

    if (AUTO_PAIRS[e.key]) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const closeChar = AUTO_PAIRS[e.key];

      // If text selected, wrap it
      if (start !== end) {
        e.preventDefault();
        const selected = val.substring(start, end);
        textarea.value = val.substring(0, start) + e.key + selected + closeChar + val.substring(end);
        textarea.selectionStart = start + 1;
        textarea.selectionEnd = end + 1;
        this.onCodeEditorInput(textarea);
        this.updateExamCursorPosition(textarea);
        return;
      }

      // If quotes and next char is already that quote, step over
      if ((e.key === '"' || e.key === "'") && val.charAt(start) === e.key) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        this.updateExamCursorPosition(textarea);
        return;
      }

      // Auto insert matching pair
      e.preventDefault();
      textarea.value = val.substring(0, start) + e.key + closeChar + val.substring(end);
      textarea.selectionStart = textarea.selectionEnd = start + 1;
      this.onCodeEditorInput(textarea);
      this.updateExamCursorPosition(textarea);
      return;
    }

    // 3. STEP OVER CLOSING BRACKETS
    if (['}', ')', ']'].includes(e.key)) {
      const start = textarea.selectionStart;
      const val = textarea.value;
      if (val.charAt(start) === e.key) {
        e.preventDefault();
        textarea.selectionStart = textarea.selectionEnd = start + 1;
        this.updateExamCursorPosition(textarea);
        return;
      }
    }

    // 4. AUTO-UNINDENT ON '}' TYPED ON EMPTY INDENTED LINE
    if (e.key === '}') {
      const start = textarea.selectionStart;
      const val = textarea.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      const currentLine = val.substring(lineStart, start);
      if (/^\s+$/.test(currentLine) && currentLine.length >= 4) {
        e.preventDefault();
        const unindented = currentLine.substring(4) + '}';
        textarea.value = val.substring(0, lineStart) + unindented + val.substring(start);
        textarea.selectionStart = textarea.selectionEnd = lineStart + unindented.length;
        this.onCodeEditorInput(textarea);
        this.updateExamCursorPosition(textarea);
        return;
      }
    }

    // 5. SMART BACKSPACE
    if (e.key === 'Backspace') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start === end && start > 0) {
        const charBefore = val.charAt(start - 1);
        const charAfter = val.charAt(start);

        // Delete both if between empty pairs
        if ((charBefore === '{' && charAfter === '}') ||
            (charBefore === '(' && charAfter === ')') ||
            (charBefore === '[' && charAfter === ']') ||
            (charBefore === '"' && charAfter === '"') ||
            (charBefore === "'" && charAfter === "'")) {
          e.preventDefault();
          textarea.value = val.substring(0, start - 1) + val.substring(start + 1);
          textarea.selectionStart = textarea.selectionEnd = start - 1;
          this.onCodeEditorInput(textarea);
          this.updateExamCursorPosition(textarea);
          return;
        }

        // Delete 4 spaces at once if on indented line
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const lineBeforeCursor = val.substring(lineStart, start);
        if (/^ {4,}$/.test(lineBeforeCursor) && lineBeforeCursor.length % 4 === 0) {
          e.preventDefault();
          textarea.value = val.substring(0, start - 4) + val.substring(start);
          textarea.selectionStart = textarea.selectionEnd = start - 4;
          this.onCodeEditorInput(textarea);
          this.updateExamCursorPosition(textarea);
          return;
        }
      }
    }

    // 6. TAB & SHIFT+TAB INDENTATION
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;

      if (start === end) {
        if (!e.shiftKey) {
          textarea.value = val.substring(0, start) + "    " + val.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 4;
        } else {
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const currentLine = val.substring(lineStart, start);
          if (currentLine.startsWith('    ')) {
            textarea.value = val.substring(0, lineStart) + currentLine.substring(4) + val.substring(start);
            textarea.selectionStart = textarea.selectionEnd = Math.max(lineStart, start - 4);
          }
        }
      } else {
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        let lineEnd = val.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = val.length;
        const lines = val.substring(lineStart, lineEnd).split('\n');
        
        let modifiedLines;
        if (!e.shiftKey) {
          modifiedLines = lines.map(l => '    ' + l);
        } else {
          modifiedLines = lines.map(l => l.startsWith('    ') ? l.substring(4) : (l.startsWith(' ') ? l.trimStart() : l));
        }
        const replacement = modifiedLines.join('\n');
        textarea.value = val.substring(0, lineStart) + replacement + val.substring(lineEnd);
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart + replacement.length;
      }
      this.onCodeEditorInput(textarea);
      this.updateExamCursorPosition(textarea);
      return;
    }

    // 7. TOGGLE LINE / BLOCK COMMENT (Ctrl + /)
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      const q = this.questions[this.currentIndex];
      const lang = ((this.codingAnswersMap[q.id] && this.codingAnswersMap[q.id].language) || q.language || 'python').toLowerCase();
      const commentPrefix = lang === 'python' ? '# ' : '// ';
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = val.indexOf('\n', end);
      if (lineEnd === -1) lineEnd = val.length;

      const lines = val.substring(lineStart, lineEnd).split('\n');
      const allCommented = lines.every(l => l.trim().startsWith(commentPrefix.trim()));
      const newLines = lines.map(l => {
        if (allCommented) {
          const idx = l.indexOf(commentPrefix.trim());
          if (idx !== -1) {
            return l.substring(0, idx) + l.substring(idx + (l.startsWith(commentPrefix) ? commentPrefix.length : commentPrefix.trim().length));
          }
          return l;
        } else {
          return commentPrefix + l;
        }
      });
      const replacement = newLines.join('\n');
      textarea.value = val.substring(0, lineStart) + replacement + val.substring(lineEnd);
      textarea.selectionStart = lineStart;
      textarea.selectionEnd = lineStart + replacement.length;
      this.onCodeEditorInput(textarea);
      this.updateExamCursorPosition(textarea);
      return;
    }

    // 8. DUPLICATE CURRENT LINE (Ctrl + D)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const val = textarea.value;
      const lineStart = val.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = val.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = val.length;
      const currentLine = val.substring(lineStart, lineEnd);
      textarea.value = val.substring(0, lineEnd) + '\n' + currentLine + val.substring(lineEnd);
      textarea.selectionStart = textarea.selectionEnd = start + currentLine.length + 1;
      this.onCodeEditorInput(textarea);
      this.updateExamCursorPosition(textarea);
      return;
    }
  }

  syncLineNumbers(textarea) {
    const gutter = document.getElementById('coding-line-numbers');
    if (!gutter || !textarea) return;
    const lines = (textarea.value.match(/\n/g) || []).length + 1;
    let numbers = '';
    for (let i = 1; i <= lines; i++) {
      numbers += i + '\n';
    }
    gutter.textContent = numbers;
    gutter.scrollTop = textarea.scrollTop;
  }

  onStdinInput(textarea) {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (!this.codingAnswersMap[q.id]) this.codingAnswersMap[q.id] = {};
    this.codingAnswersMap[q.id].stdin = textarea.value;
    this.saveExamState();
  }

  toggleCompilerStdin() {
    const panel = document.getElementById('compiler-stdin-panel');
    if (panel) {
      panel.classList.toggle('active');
    }
  }

  resetCompilerCode() {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (confirm("Reset code back to original starter template? Your current edits will be replaced.")) {
      const defaultLang = (this.codingAnswersMap[q.id] && this.codingAnswersMap[q.id].language) || q.language || 'python';
      const template = q.starterCode || this.getDefaultStarterCode(defaultLang);
      const editor = document.getElementById('coding-editor-textarea');
      if (editor) {
        editor.value = template;
        this.syncLineNumbers(editor);
        this.syncExamHighlight(editor);
        this.updateExamCursorPosition(editor);
      }
      if (!this.codingAnswersMap[q.id]) this.codingAnswersMap[q.id] = {};
      this.codingAnswersMap[q.id].code = template;
      this.saveExamState();
      ui.showToast('Code reset to starter template.', 'info');
    }
  }

  clearCompilerOutput() {
    const outputEl = document.getElementById('compiler-terminal-output');
    const testResultEl = document.getElementById('compiler-test-result');
    const metaStatsEl = document.getElementById('compiler-meta-stats');
    if (outputEl) {
      outputEl.textContent = 'Terminal cleared.';
      outputEl.className = 'compiler-terminal-output';
    }
    if (testResultEl) testResultEl.style.display = 'none';
    if (metaStatsEl) metaStatsEl.textContent = '';
  }

  getQuestionTestCases(q) {
    if (!q) return [];
    let testCases = [];

    // 1. Structured testCases array if present
    if (Array.isArray(q.testCases) && q.testCases.length > 0) {
      testCases = q.testCases.map((tc, idx) => ({
        id: tc.id || (idx + 1),
        name: tc.name || `Test Case ${idx + 1}`,
        input: String(tc.input !== undefined ? tc.input : (tc.stdin !== undefined ? tc.stdin : '')).trim(),
        expected: String(tc.expectedOutput !== undefined ? tc.expectedOutput : (tc.output !== undefined ? tc.output : (tc.expected || ''))).trim().replace(/\r\n/g, '\n'),
        marks: tc.marks || 0
      })).filter(tc => tc.expected.length > 0 || tc.input.length > 0);
    }

    // 2. Primary / Sample Test Case fallback
    if (testCases.length === 0 && (q.sampleInput !== undefined || q.expectedOutput !== undefined)) {
      testCases.push({
        id: 1,
        name: 'Test Case 1 (Sample / Primary)',
        input: String(q.sampleInput || '').trim(),
        expected: String(q.expectedOutput || '').trim().replace(/\r\n/g, '\n'),
        marks: q.marks || 10
      });
    }

    // 3. Secondary Test Case
    if (q.output2 !== undefined && String(q.output2).trim()) {
      const in2 = String(q.input2 || '').trim();
      const out2 = String(q.output2 || '').trim().replace(/\r\n/g, '\n');
      if (!testCases.some(tc => tc.expected === out2 && tc.input === in2)) {
        testCases.push({
          id: testCases.length + 1,
          name: `Test Case ${testCases.length + 1} (Edge / Verification)`,
          input: in2,
          expected: out2,
          marks: 0
        });
      }
    }

    // 4. Anti-Hardcoding Multi-Case Generator & Opposing Test Suite:
    // Gather all keywords from the question metadata
    const qTextContext = [
      q.text || '',
      q.question || '',
      q.title || '',
      q.chapter || '',
      q.topic || '',
      q.subjectName || '',
      q.name || '',
      q.explanation || ''
    ].join(' ').toLowerCase();

    const exp1 = testCases.length > 0 ? testCases[0].expected.trim() : '';
    const in1 = testCases.length > 0 ? testCases[0].input.trim() : '';

    // Check if test suite currently lacks negative / opposing branch cases
    const uniqueOutputs = new Set(testCases.map(tc => tc.expected.trim().toLowerCase()));
    const needsNegativeCase = testCases.length < 3 || uniqueOutputs.size === 1;

    if (needsNegativeCase) {
      if (qTextContext.includes('palin') || /palindrome/i.test(exp1)) {
        // 1. Palindrome: Guarantee multiple negative and boundary test cases
        const negInput1 = in1 === '121' ? '123' : (in1 === 'madam' ? 'hello' : (isNaN(in1) ? 'program' : '1234'));
        const negInput2 = isNaN(in1) ? 'antigravity' : '9876';

        if (!testCases.some(tc => /not\s*palindrome/i.test(tc.expected))) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Not Palindrome)`,
            input: negInput1,
            expected: 'Not Palindrome',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: Palindrome)`,
            input: isNaN(in1) ? 'racecar' : '1221',
            expected: 'Palindrome',
            marks: 0
          });
        }
        if (testCases.length < 4) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Asymmetric)`,
            input: negInput2,
            expected: 'Not Palindrome',
            marks: 0
          });
        }
      } else if (qTextContext.includes('prime') || /prime/i.test(exp1)) {
        // 2. Prime Number: Guarantee composite & edge test cases
        if (!testCases.some(tc => /not\s*prime|composite/i.test(tc.expected))) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Composite)`,
            input: (in1 === '5' || in1 === '7' || in1 === '29') ? '20' : '4',
            expected: 'Not Prime',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: Non-Prime 1)`,
            input: '1',
            expected: 'Not Prime',
            marks: 0
          });
        }
        if (testCases.length < 4) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary Prime: 2)`,
            input: '2',
            expected: 'Prime',
            marks: 0
          });
        }
      } else if (qTextContext.includes('even') || qTextContext.includes('odd') || /even|odd/i.test(exp1)) {
        // 3. Even/Odd: Guarantee opposing branch
        const isExpEven = /even/i.test(exp1);
        if (!testCases.some(tc => isExpEven ? /odd/i.test(tc.expected) : /even/i.test(tc.expected))) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: ${isExpEven ? 'Odd' : 'Even'})`,
            input: in1 && !isNaN(in1) ? String(parseInt(in1, 10) + 1) : (isExpEven ? '17' : '24'),
            expected: isExpEven ? 'Odd' : 'Even',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: 0)`,
            input: '0',
            expected: 'Even',
            marks: 0
          });
        }
        if (testCases.length < 4) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: 101)`,
            input: '101',
            expected: 'Odd',
            marks: 0
          });
        }
      } else if (qTextContext.includes('reverse') || /reverse/i.test(qTextContext)) {
        // 4. Reverse a Number / String
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Reverse 908)`,
            input: isNaN(in1) ? 'world' : '908',
            expected: isNaN(in1) ? 'dlrow' : '809',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: Trailing Zeroes 700)`,
            input: isNaN(in1) ? 'coding' : '700',
            expected: isNaN(in1) ? 'gnidoc' : '7',
            marks: 0
          });
        }
      } else if (qTextContext.includes('sum of digit') || qTextContext.includes('sum of digits') || (qTextContext.includes('digits') && qTextContext.includes('sum'))) {
        // 5. Sum of Digits
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: 1005)`,
            input: '1005',
            expected: '6',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: 999)`,
            input: '999',
            expected: '27',
            marks: 0
          });
        }
      } else if (qTextContext.includes('factorial') || /factorial/i.test(qTextContext)) {
        // 6. Factorial
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: 0!)`,
            input: '0',
            expected: '1',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: 7!)`,
            input: '7',
            expected: '5040',
            marks: 0
          });
        }
      } else if (qTextContext.includes('fibonacci') || /fibonacci/i.test(qTextContext)) {
        // 7. Fibonacci Series
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: N=5)`,
            input: '5',
            expected: '0 1 1 2 3',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: N=1)`,
            input: '1',
            expected: '0',
            marks: 0
          });
        }
      } else if (qTextContext.includes('largest') || qTextContext.includes('greatest') || (qTextContext.includes('three numbers') && qTextContext.includes('max'))) {
        // 8. Largest of Three Numbers
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: 90 34 67)`,
            input: '90 34 67',
            expected: '90',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: Duplicates 8 8 3)`,
            input: '8 8 3',
            expected: '8',
            marks: 0
          });
        }
      } else if (qTextContext.includes('vowel') || /vowel/i.test(qTextContext)) {
        // 9. Count Vowels in a String
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Uppercase)`,
            input: 'PROGRAMMING',
            expected: '3',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: No Vowels)`,
            input: 'sky',
            expected: '0',
            marks: 0
          });
        }
      } else if (qTextContext.includes('anagram') || /anagram/i.test(qTextContext)) {
        // 10. Anagram Check
        if (!testCases.some(tc => /not\s*anagram/i.test(tc.expected))) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Not Anagram)`,
            input: 'hello\nworld',
            expected: 'Not Anagram',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Boundary: Case & Space Insensitive)`,
            input: 'Dormitory\nDirty room',
            expected: 'Anagram',
            marks: 0
          });
        }
      } else if (qTextContext.includes('leap') || /leap/i.test(exp1)) {
        // Leap Year
        if (!testCases.some(tc => /not\s*leap/i.test(tc.expected))) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Not Leap Year)`,
            input: '1900',
            expected: 'Not Leap Year',
            marks: 0
          });
        }
        if (testCases.length < 3) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Century Leap: 2000)`,
            input: '2000',
            expected: 'Leap Year',
            marks: 0
          });
        }
      } else if (/^true$/i.test(exp1) || /^yes$/i.test(exp1) || /^false$/i.test(exp1) || /^no$/i.test(exp1)) {
        // Boolean / Binary Answer
        const isPositive = /^true$/i.test(exp1) || /^yes$/i.test(exp1);
        const isYes = /^yes$/i.test(exp1) || /^no$/i.test(exp1);
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat: Opposite Condition)`,
            input: in1 && !isNaN(in1) ? String(parseInt(in1, 10) + 1) : '0',
            expected: isYes ? (isPositive ? 'No' : 'Yes') : (isPositive ? 'False' : 'True'),
            marks: 0
          });
        }
      } else if (in1 && !isNaN(in1) && exp1 && !isNaN(exp1)) {
        // Generic Numeric Math / Calculation
        const numIn = parseInt(in1, 10);
        if (testCases.length < 2) {
          testCases.push({
            id: testCases.length + 1,
            name: `Test Case ${testCases.length + 1} (Anti-Cheat Verification)`,
            input: String(numIn + 5),
            expected: String(parseInt(exp1, 10) + 5),
            marks: 0
          });
        }
      }
    }

    return testCases;
  }

  validateCodeInputUsage(code, lang, hasRequiredInput) {
    if (!code) return { valid: false, error: 'No code provided.' };

    // Strip comments to check if code actually reads stdin
    const cleanCode = code.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').replace(/#.*/g, '').trim();

    // 1. Input usage check (if problem requires input)
    if (hasRequiredInput) {
      const INPUT_PATTERNS = {
        python: /\b(input\s*\(|sys\.stdin)/,
        c: /\b(scanf\s*\(|getchar\s*\(|fgets\s*\(|gets\s*\(|cin\s*>>)/,
        cpp: /\b(cin\s*>>|scanf\s*\(|getline\s*\(|getchar\s*\()/i,
        java: /\b(Scanner|BufferedReader|System\.in|read\s*\(|nextLine\s*\(|nextInt\s*\(|next\s*\()/i,
        javascript: /\b(prompt\s*\(|readline|readFileSync|process\.stdin|input)/i
      };

      const pattern = INPUT_PATTERNS[lang.toLowerCase()] || INPUT_PATTERNS.python;
      const readsInput = pattern.test(cleanCode);

      if (!readsInput) {
        return {
          valid: false,
          error: 'Hardcoding Detected: Your code does not read input from stdin (e.g. input() in Python, scanf() in C, Scanner in Java). You must read and process the dynamic input variable to solve the challenge!'
        };
      }
    }

    // 2. Anti-Hardcoding Trivial Print Check:
    // If student only reads input and prints a static constant without any logic / transformation
    const LOGIC_PATTERNS = {
      python: /\b(if|else|elif|for|while|match|case|def|lambda|in|and|or|not)\b|[!=<>]=?|%|\/\/|\[::-1\]|reversed\s*\(|abs\s*\(|pow\s*\(|sum\s*\(|len\s*\(|count\s*\(|strip\s*\(|split\s*\(|\+|\-|\*|\//,
      java: /\b(if|else|switch|case|for|while|do|return)\b|[!=<>]=?|%|\?|:|\.equals|\.charAt|\.reverse|\.length|\.substring|\+|\-|\*|\//,
      c: /\b(if|else|switch|case|for|while|do|return)\b|[!=<>]=?|%|\?|:|strlen|strcmp|\+|\-|\*|\//,
      cpp: /\b(if|else|switch|case|for|while|do|return)\b|[!=<>]=?|%|\?|:|reverse|length|size|\+|\-|\*|\//,
      javascript: /\b(if|else|switch|case|for|while|do|return|function|map|filter|reduce)\b|[!=<>]=?|%|\?|:|\.reverse|\.split|\.includes|\+|\-|\*|\//
    };

    const logicPattern = LOGIC_PATTERNS[lang.toLowerCase()] || LOGIC_PATTERNS.python;
    const hasLogic = logicPattern.test(cleanCode);

    // Strip input reading lines to check remaining statement
    const codeWithoutInputs = cleanCode
      .replace(/^(?:[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*)?(?:int|str|float|list)?\s*\(?\s*input\s*\([^)]*\)\s*\)?\s*;?$/gm, '')
      .replace(/^(?:Scanner\s+\w+\s*=\s*new\s+Scanner\s*\(\s*System\.in\s*\)\s*;?)/gm, '')
      .replace(/^\s*\w+\.(?:next|nextInt|nextLine)\s*\([^)]*\)\s*;?/gm, '')
      .replace(/^\s*scanf\s*\([^)]*\)\s*;?/gm, '')
      .trim();

    const TRIVIAL_PRINT_PATTERNS = {
      python: /^print\s*\(\s*(["'][^"']*["']|\d+)\s*\)$/,
      java: /^(?:System\.out\.println|System\.out\.print)\s*\(\s*(["'][^"']*["']|\d+)\s*\)\s*;?$/,
      c: /^printf\s*\(\s*(["'][^"']*["']|\d+)\s*\)\s*;?$/,
      cpp: /^(?:cout\s*<<\s*(["'][^"']*["']|\d+)\s*(?:<<\s*endl)?\s*;?)$/,
      javascript: /^console\.log\s*\(\s*(["'][^"']*["']|\d+)\s*\)\s*;?$/
    };

    const isTrivialPrint = TRIVIAL_PRINT_PATTERNS[lang.toLowerCase()] && TRIVIAL_PRINT_PATTERNS[lang.toLowerCase()].test(codeWithoutInputs);

    if (isTrivialPrint && !hasLogic) {
      return {
        valid: false,
        error: 'Hardcoding Detected: Your code only prints a fixed static value without any conditional logic (if/else), loops, or data processing. Please implement the actual algorithm to dynamically solve the problem!'
      };
    }

    return { valid: true };
  }

  async executeCodeOnEngine(sourceCode, language, stdin) {
    if (language === 'javascript' && (!stdin || stdin.trim() === '')) {
      return this.executeBrowserJavaScript(sourceCode);
    }

    const JUDGE0_MAP = {
      python: 71,
      javascript: 93,
      c: 50,
      cpp: 54,
      java: 62
    };
    const langId = JUDGE0_MAP[language] || 71;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('https://ce.judge0.com/submissions?wait=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language_id: langId,
          source_code: sourceCode,
          stdin: stdin || ''
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Judge0 HTTP ${response.status}`);
      }
    } catch (netErr) {
      // Fallback to Piston API
      try {
        const pistonLangMap = { python: 'python', javascript: 'javascript', c: 'c', cpp: 'cpp', java: 'java' };
        const pResp = await fetch('https://emkc.org/api/v2/piston/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            language: pistonLangMap[language] || 'python',
            version: '*',
            files: [{ content: sourceCode }],
            stdin: stdin || ''
          })
        });
        if (pResp.ok) {
          const pData = await pResp.json();
          if (pData.run) {
            return {
              stdout: pData.run.stdout,
              stderr: pData.run.stderr,
              compile_output: pData.compile ? pData.compile.output : '',
              status: { description: pData.run.code === 0 ? 'Accepted' : 'Runtime Error' },
              time: '0.050',
              memory: 'Piston Engine'
            };
          }
        }
      } catch (pistonErr) {
        console.warn("Piston fallback also failed:", pistonErr);
      }
      throw netErr;
    }
  }

  async runCompilerCode(isTesting = false) {
    const q = this.questions[this.currentIndex];
    if (!q || this.compilerRunning) return;

    const editor = document.getElementById('coding-editor-textarea');
    const stdinEl = document.getElementById('coding-stdin-textarea');
    const statusEl = document.getElementById('compiler-run-status');
    const outputEl = document.getElementById('compiler-terminal-output');
    const metaStatsEl = document.getElementById('compiler-meta-stats');
    const testResultEl = document.getElementById('compiler-test-result');
    const btnRun = document.getElementById('btn-compiler-run');
    const btnTest = document.getElementById('btn-compiler-test');

    const sourceCode = editor ? editor.value : '';
    if (!sourceCode.trim()) {
      ui.showToast('Please write some code before running.', 'warning');
      return;
    }

    const langSelect = document.getElementById('compiler-language-select');
    const language = langSelect ? langSelect.value : (q.language || 'python');
    const customStdin = stdinEl ? stdinEl.value : '';

    const testCases = this.getQuestionTestCases(q);
    const qMarks = parseInt(q.marks || 10, 10);
    const hasRequiredInput = testCases.some(tc => tc.input && tc.input.trim().length > 0);

    // 1. Anti-Hardcoding Static Analysis Check
    const inputUsage = this.validateCodeInputUsage(sourceCode, language, hasRequiredInput);
    if (!inputUsage.valid) {
      if (outputEl) {
        outputEl.className = 'compiler-terminal-output has-error';
        outputEl.textContent = `[EVALUATION REJECTED - ZERO MARKS]\n❌ ${inputUsage.error}`;
      }
      if (testResultEl) {
        testResultEl.style.display = 'block';
        testResultEl.className = 'compiler-test-result failed';
        testResultEl.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 0.95rem; margin-bottom: 0.5rem;">
            <span style="display: flex; align-items: center; gap: 0.4rem; color: #ef4444;">
              <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #ef4444; width: 18px; height: 18px;"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              Anti-Cheat Triggered (0 / ${qMarks} Marks)
            </span>
            <span style="padding: 0.15rem 0.55rem; border-radius: 999px; font-size: 0.78rem; background: rgba(239, 68, 68, 0.2); color: #ef4444; font-weight: 800;">
              0 / ${qMarks} MARKS
            </span>
          </div>
          <div style="font-size: 0.84rem; color: #fca5a5; line-height: 1.5;">
            ${escapeHtml(inputUsage.error)}
          </div>
        `;
      }
      if (statusEl) {
        statusEl.innerHTML = `<span class="status-dot error"></span> Hardcoded Output`;
      }
      this.codingAnswersMap[q.id] = {
        code: sourceCode,
        language,
        stdin: customStdin,
        output: inputUsage.error,
        passed: false,
        tested: true
      };
      this.updateMarksBanner(false, true, qMarks);
      this.saveExamState();
      this.renderNavigatorGrid();
      ui.showToast('Hardcoded output rejected! Code must read input dynamically.', 'error');
      return;
    }

    this.compilerRunning = true;
    if (btnRun) btnRun.disabled = true;
    if (btnTest) btnTest.disabled = true;

    if (statusEl) {
      statusEl.innerHTML = `<span class="status-dot running"></span> ${isTesting ? 'Running All Test Cases...' : 'Compiling & Running...'}`;
    }
    if (outputEl) {
      outputEl.className = 'compiler-terminal-output has-normal';
      outputEl.textContent = `$ ${language} ${this.getLangFileName(language)}\nExecuting on cloud compiler server...`;
    }
    if (metaStatsEl) metaStatsEl.textContent = 'Running...';
    if (testResultEl) testResultEl.style.display = 'none';

    try {
      if (isTesting && testCases.length > 0) {
        // Run all test cases sequentially
        const caseResults = [];
        let allPassed = true;
        let lastStdout = '';

        for (let i = 0; i < testCases.length; i++) {
          const tc = testCases[i];
          if (statusEl) {
            statusEl.innerHTML = `<span class="status-dot running"></span> Testing Case ${i + 1} of ${testCases.length}...`;
          }

          const res = await this.executeCodeOnEngine(sourceCode, language, tc.input);
          const rawStdout = String(res.stdout || '').trim();
          const normActual = rawStdout.replace(/\r\n/g, '\n');
          const normExpected = String(tc.expected || '').trim().replace(/\r\n/g, '\n');
          const hasError = !!(res.stderr || res.compile_output || (res.status && res.status.description !== 'Accepted'));
          
          const passed = !hasError && normActual === normExpected;
          if (!passed) allPassed = false;
          if (i === 0) lastStdout = rawStdout;

          caseResults.push({
            id: tc.id,
            name: tc.name || `Test Case ${i + 1}`,
            input: tc.input,
            expected: tc.expected,
            actual: normActual,
            passed: passed,
            hasError: hasError,
            error: res.stderr || res.compile_output || ''
          });
        }

        const passedCount = caseResults.filter(r => r.passed).length;
        const totalCount = caseResults.length;

        // Render Terminal Output
        if (outputEl) {
          outputEl.className = allPassed ? 'compiler-terminal-output has-success' : 'compiler-terminal-output has-error';
          outputEl.textContent = `$ Testing completed: ${passedCount}/${totalCount} Test Cases Passed.\n\nLatest Output:\n${lastStdout || '(No output)'}`;
        }
        if (metaStatsEl) {
          metaStatsEl.textContent = allPassed ? `ALL ${totalCount} PASSED` : `${passedCount}/${totalCount} PASSED`;
        }
        if (statusEl) {
          statusEl.innerHTML = allPassed 
            ? `<span class="status-dot"></span> All Cases Passed` 
            : `<span class="status-dot error"></span> ${passedCount}/${totalCount} Passed`;
        }

        // Render Test Results Diff Breakdown Card
        if (testResultEl) {
          testResultEl.style.display = 'block';
          testResultEl.className = `compiler-test-result ${allPassed ? 'passed' : 'failed'}`;
          testResultEl.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; font-weight: 800; font-size: 0.95rem; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <span style="display: flex; align-items: center; gap: 0.45rem; color: ${allPassed ? '#10b981' : '#ef4444'};">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: ${allPassed ? '#10b981' : '#ef4444'}; width: 20px; height: 20px;">
                  ${allPassed ? '<polyline points="20 6 9 17 4 12"/>' : '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'}
                </svg>
                ${allPassed ? `All Test Cases Passed! (${passedCount}/${totalCount} Passed)` : `Test Cases Failed (${passedCount}/${totalCount} Passed)`}
              </span>
              <span style="padding: 0.2rem 0.65rem; border-radius: 999px; font-size: 0.8rem; background: ${allPassed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${allPassed ? '#10b981' : '#ef4444'}; font-weight: 800;">
                ${allPassed ? `🎉 +${qMarks} / ${qMarks} MARKS` : `0 / ${qMarks} MARKS`}
              </span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.6rem;">
              ${caseResults.map(cr => `
                <div style="background: rgba(0,0,0,0.5); border: 1px solid ${cr.passed ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}; border-radius: 6px; padding: 0.6rem 0.85rem; font-size: 0.82rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                    <span style="font-weight: 800; color: ${cr.passed ? '#34d399' : '#f87171'}; display: flex; align-items: center; gap: 0.35rem;">
                      ${cr.passed ? '✓' : '✗'} ${escapeHtml(cr.name)}
                    </span>
                    <span style="font-size: 0.72rem; text-transform: uppercase; font-weight: 800; color: ${cr.passed ? '#34d399' : '#f87171'}; background: ${cr.passed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; padding: 0.1rem 0.45rem; border-radius: 4px;">
                      ${cr.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.45rem; font-family: var(--font-mono, monospace); font-size: 0.78rem;">
                    ${cr.input ? `<div><span style="color:#94a3b8; font-size: 0.68rem; text-transform: uppercase;">Input:</span> <div style="background: #090d16; padding: 0.2rem 0.4rem; border-radius: 4px; color: #f8fafc; margin-top: 0.15rem;">${escapeHtml(cr.input)}</div></div>` : ''}
                    <div><span style="color:#94a3b8; font-size: 0.68rem; text-transform: uppercase;">Expected:</span> <div style="background: #090d16; padding: 0.2rem 0.4rem; border-radius: 4px; color: #38bdf8; font-weight: 600; margin-top: 0.15rem;">${escapeHtml(cr.expected)}</div></div>
                    <div><span style="color:#94a3b8; font-size: 0.68rem; text-transform: uppercase;">Your Output:</span> <div style="background: #090d16; padding: 0.2rem 0.4rem; border-radius: 4px; color:${cr.passed ? '#34d399' : '#f87171'}; font-weight: 600; margin-top: 0.15rem;">${escapeHtml(cr.actual || '(No output)')}</div></div>
                  </div>
                  ${cr.error ? `<div style="color: #f87171; margin-top: 0.35rem; font-size: 0.74rem; font-family: var(--font-mono, monospace); background: rgba(239,68,68,0.1); padding: 0.3rem 0.5rem; border-radius: 4px;">${escapeHtml(cr.error)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          `;
        }

        this.codingAnswersMap[q.id] = {
          code: sourceCode,
          language,
          stdin: customStdin,
          output: lastStdout,
          passed: allPassed,
          tested: true
        };

        this.updateMarksBanner(allPassed, true, qMarks);
        this.saveExamState();
        this.renderNavigatorGrid();

        if (allPassed) {
          ui.showToast(`🎉 All Test Cases Passed! ${qMarks} / ${qMarks} Marks Awarded!`, 'success');
        } else {
          ui.showToast(`Test Failed (${passedCount}/${totalCount} Passed). 0 / ${qMarks} Marks. Check output diff!`, 'error');
        }
      } else {
        // Run code with custom stdin (or sampleInput if empty)
        const runStdin = customStdin || (q.sampleInput || '');
        const executionResult = await this.executeCodeOnEngine(sourceCode, language, runStdin);

        const stdout = executionResult.stdout || '';
        const stderr = executionResult.stderr || '';
        const compileOut = executionResult.compile_output || '';
        const hasError = !!(stderr || compileOut || (executionResult.status && executionResult.status.description !== 'Accepted'));

        const fullOutput = (compileOut ? `[Compilation Error]\n${compileOut}\n` : '') +
                           (stderr ? `[Runtime Error]\n${stderr}\n` : '') +
                           (stdout ? stdout : (hasError ? '' : '(Program executed successfully with no output)'));

        if (outputEl) {
          outputEl.className = hasError ? 'compiler-terminal-output has-error' : 'compiler-terminal-output has-normal';
          outputEl.textContent = fullOutput;
        }

        const timeStr = executionResult.time ? `${executionResult.time}s` : '0.012s';
        const memStr = executionResult.memory ? `${executionResult.memory}` : '3.2 MB';
        if (metaStatsEl) {
          metaStatsEl.textContent = `${executionResult.status ? executionResult.status.description : 'Done'} | Time: ${timeStr} | Mem: ${memStr}`;
        }
        if (statusEl) {
          statusEl.innerHTML = hasError 
            ? `<span class="status-dot error"></span> Error` 
            : `<span class="status-dot"></span> Accepted`;
        }

        this.codingAnswersMap[q.id] = {
          code: sourceCode,
          language,
          stdin: customStdin,
          output: stdout || fullOutput,
          passed: this.codingAnswersMap[q.id] ? !!this.codingAnswersMap[q.id].passed : false,
          tested: this.codingAnswersMap[q.id] ? !!this.codingAnswersMap[q.id].tested : false
        };

        this.saveExamState();
        this.renderNavigatorGrid();
        ui.showToast(hasError ? 'Execution finished with errors.' : 'Code executed. Click "Test Solution" to run full test suite!', hasError ? 'warning' : 'info');
      }
    } catch (err) {
      console.error("Execution error:", err);
      if (outputEl) {
        outputEl.className = 'compiler-terminal-output has-error';
        outputEl.textContent = `[Connection / Execution Error]\nCould not connect to online compiler engine. Please check your internet connection and try again.\nDetails: ${err.message}`;
      }
      if (statusEl) {
        statusEl.innerHTML = `<span class="status-dot error"></span> Error`;
      }
      ui.showToast('Execution error. Please check your network connection.', 'error');
    } finally {
      this.compilerRunning = false;
      if (btnRun) btnRun.disabled = false;
      if (btnTest) btnTest.disabled = false;
    }
  }

  executeBrowserJavaScript(sourceCode) {
    const logs = [];
    const customConsole = {
      log: (...args) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args) => logs.push('[ERROR] ' + args.map(a => String(a)).join(' ')),
      warn: (...args) => logs.push('[WARN] ' + args.map(a => String(a)).join(' ')),
      info: (...args) => logs.push(args.map(a => String(a)).join(' '))
    };
    try {
      const runFn = new Function('console', sourceCode);
      const startTime = performance.now();
      runFn(customConsole);
      const timeSec = ((performance.now() - startTime) / 1000).toFixed(3);
      return {
        stdout: logs.join('\n') || '(Program executed successfully with no output)',
        stderr: '',
        compile_output: '',
        status: { description: 'Accepted' },
        time: timeSec,
        memory: 'Browser Sandbox'
      };
    } catch (err) {
      return {
        stdout: logs.join('\n'),
        stderr: err.toString(),
        compile_output: '',
        status: { description: 'Runtime Error' },
        time: '0.000',
        memory: 'Browser Sandbox'
      };
    }
  }
}

const examEngine = new AntiCheatingExamEngine();

// Global click-outside listener to dismiss exam compiler language dropdown
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('exam-lang-custom-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    const menu = document.getElementById('exam-lang-menu');
    const btn = dropdown.querySelector('.ide-custom-dropdown-btn');
    if (menu) menu.classList.remove('show');
    if (btn) btn.classList.remove('active');
  }
});
