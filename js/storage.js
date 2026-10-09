/* ==========================================================================
   Storage JS - LocalStorage Wrapper & Data Management Service
   ========================================================================== */

class StorageService {
  constructor() {
    this.initStorage();
    this.initFirebase();
  }

  initStorage() {
    // 1. One-time purge of any previously stored demo/seed data from localStorage
    this.purgeAllDemoData();

    // 2. Ensure system configuration keys exist
    if (!localStorage.getItem(APP_KEYS.YEARS_SECTIONS)) {
      this.setItem(APP_KEYS.YEARS_SECTIONS, DEFAULT_YEARS_SECTIONS);
    }
    if (!localStorage.getItem(APP_KEYS.ADMINS)) {
      this.setItem(APP_KEYS.ADMINS, DEFAULT_ADMINS);
    }
    if (!localStorage.getItem(APP_KEYS.STUDENTS)) {
      this.setItem(APP_KEYS.STUDENTS, []);
    }
    if (!localStorage.getItem(APP_KEYS.SUBJECTS)) {
      this.setItem(APP_KEYS.SUBJECTS, []);
    }
    if (!localStorage.getItem(APP_KEYS.QUESTIONS)) {
      this.setItem(APP_KEYS.QUESTIONS, []);
    }
    if (!localStorage.getItem(APP_KEYS.EXAM_ATTEMPTS)) {
      this.setItem(APP_KEYS.EXAM_ATTEMPTS, []);
    }
    if (!localStorage.getItem(APP_KEYS.VIOLATIONS)) {
      this.setItem(APP_KEYS.VIOLATIONS, []);
    }
    if (!localStorage.getItem(APP_KEYS.ADS)) {
      this.setItem(APP_KEYS.ADS, []);
    }

    // Clean up any corrupted questions or broken active exam states
    this.cleanupCorruptedQuestions();
  }

  purgeAllDemoData() {
    const purgeFlagKey = 'lms_fresh_start_wipe_v10';
    if (localStorage.getItem(purgeFlagKey)) {
      return;
    }

    try {
      this.setItem(APP_KEYS.STUDENTS, []);
      this.setItem(APP_KEYS.SUBJECTS, []);
      this.setItem(APP_KEYS.QUESTIONS, []);
      this.setItem(APP_KEYS.EXAM_ATTEMPTS, []);
      this.setItem(APP_KEYS.VIOLATIONS, []);
      localStorage.removeItem(APP_KEYS.ACTIVE_EXAM_STATE);
      localStorage.removeItem('lms_custom_cards');
      localStorage.removeItem('lms_deleted_q_ids');
      localStorage.removeItem('lms_deleted_sub_ids');
      localStorage.removeItem('lms_deleted_student_ids');

      // Ensure admins and year/section infrastructure are set
      this.setItem(APP_KEYS.ADMINS, DEFAULT_ADMINS);
      this.setItem(APP_KEYS.YEARS_SECTIONS, DEFAULT_YEARS_SECTIONS);

      localStorage.setItem(purgeFlagKey, 'true');
      console.log('Successfully wiped all existing students, attempts, violations & demo data for a 100% fresh start.');
    } catch (e) {
      console.warn('Error purging demo data:', e);
    }
  }

  resetAllData() {
    this.setItem(APP_KEYS.STUDENTS, []);
    this.setItem(APP_KEYS.SUBJECTS, []);
    this.setItem(APP_KEYS.QUESTIONS, []);
    this.setItem(APP_KEYS.EXAM_ATTEMPTS, []);
    this.setItem(APP_KEYS.VIOLATIONS, []);
    localStorage.removeItem(APP_KEYS.ACTIVE_EXAM_STATE);
    localStorage.removeItem('lms_custom_cards');
    localStorage.removeItem('lms_deleted_q_ids');
    localStorage.removeItem('lms_deleted_sub_ids');

    // Ensure admins and year/section infrastructure are set
    this.setItem(APP_KEYS.ADMINS, DEFAULT_ADMINS);
    this.setItem(APP_KEYS.YEARS_SECTIONS, DEFAULT_YEARS_SECTIONS);
    console.log('Reset all data to 100% clean slate.');
  }

  initFirebase() {
    this.firebaseInitialized = false;
    this.db = null;
    this.rtdb = null;

    if (typeof firebase !== 'undefined' && typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG.apiKey) {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(FIREBASE_CONFIG);
        }
        this.db = firebase.firestore();
        try {
          this.rtdb = firebase.database();
        } catch (rtdbErr) {
          console.log("Realtime Database not configured/used, using Firestore.");
        }
        this.firebaseInitialized = true;
        console.log("Firebase initialized successfully for Project:", FIREBASE_CONFIG.projectId);
        
        // Fetch single source of truth from Firebase Database on load
        this.syncFromFirebase();
      } catch (err) {
        console.warn("Firebase initialization skipped/failed:", err);
      }
    }
  }

  async syncFromFirebase() {
    if (!this.firebaseInitialized || !this.db) return;
    try {
      // Sync questions from Firebase Firestore (filter out locally deleted questions)
      const qSnapshot = await this.db.collection('questions').get();
      const cloudQuestions = [];
      const deletedQIds = this.getItem('lms_deleted_q_ids', []);
      qSnapshot.forEach(doc => {
        if (!deletedQIds.includes(doc.id)) {
          cloudQuestions.push({ id: doc.id, ...doc.data() });
        }
      });
      
      if (cloudQuestions.length > 0) {
        this.setItem(APP_KEYS.QUESTIONS, cloudQuestions);
        console.log(`Single source of truth: Loaded ${cloudQuestions.length} questions from Firebase Database.`);
        this.cleanupCorruptedQuestions();
      }

      // Sync subjects from Firebase Firestore (filter out locally deleted subjects)
      const sSnapshot = await this.db.collection('subjects').get();
      const cloudSubjects = [];
      const deletedSubIds = this.getItem('lms_deleted_sub_ids', []);
      sSnapshot.forEach(doc => {
        if (!deletedSubIds.includes(doc.id)) {
          cloudSubjects.push({ id: doc.id, ...doc.data() });
        }
      });
      if (cloudSubjects.length > 0) {
        this.setItem(APP_KEYS.SUBJECTS, cloudSubjects);
        console.log(`Single source of truth: Loaded ${cloudSubjects.length} subjects from Firebase Database.`);
      }

      // Sync students from Firebase Firestore
      try {
        const stSnapshot = await this.db.collection('students').get();
        const cloudStudents = [];
        const deletedStudentIds = this.getItem('lms_deleted_student_ids', []);
        stSnapshot.forEach(doc => {
          if (!deletedStudentIds.includes(doc.id)) {
            cloudStudents.push({ id: doc.id, ...doc.data() });
          }
        });
        const localStudents = this.getItem(APP_KEYS.STUDENTS, []);
        const mergedStudents = [...cloudStudents];
        localStudents.forEach(ls => {
          if (!mergedStudents.some(cs => cs.regNo === ls.regNo)) {
            mergedStudents.push(ls);
            this.syncToFirebase('students', ls.id, ls);
          }
        });
        if (mergedStudents.length > 0) {
          this.setItem(APP_KEYS.STUDENTS, mergedStudents);
          console.log(`Single source of truth: Loaded ${mergedStudents.length} students from Firebase Database.`);
        }
      } catch (stErr) {
        console.warn("Students cloud sync notice:", stErr);
      }

      // Sync attempts / quiz results from Firebase Firestore
      try {
        const attSnapshot = await this.db.collection('attempts').get();
        const cloudAttempts = [];
        attSnapshot.forEach(doc => {
          cloudAttempts.push({ id: doc.id, ...doc.data() });
        });
        const localAttempts = this.getItem(APP_KEYS.EXAM_ATTEMPTS, []);
        const mergedAttempts = [...cloudAttempts];
        localAttempts.forEach(la => {
          if (!mergedAttempts.some(ca => ca.id === la.id)) {
            mergedAttempts.push(la);
            this.syncToFirebase('attempts', la.id, la);
          }
        });
        if (mergedAttempts.length > 0) {
          this.setItem(APP_KEYS.EXAM_ATTEMPTS, mergedAttempts);
          console.log(`Single source of truth: Loaded ${mergedAttempts.length} attempts from Firebase Database.`);
        }
      } catch (attErr) {
        console.warn("Attempts cloud sync notice:", attErr);
      }

      // Clean up corrupted questions and seed missing subject questions if needed
      this.cleanupCorruptedQuestions();

      // Refresh UI if dashboards are rendered
      if (typeof adminDashboard !== 'undefined' && adminDashboard.activePanel === 'questions') {
        adminDashboard.renderQuestionsTable();
      }
      if (typeof studentDashboard !== 'undefined') {
        studentDashboard.renderDashboard();
      }
    } catch (e) {
      console.warn("Firebase cloud read error (check Security Rules):", e);
    }
  }

  cleanupCorruptedQuestions() {
    let questions = this.getItem(APP_KEYS.QUESTIONS, []);
    if (!Array.isArray(questions)) return;

    const isCorrupted = (q) => {
      if (!q) return true;
      const text = String(q.text || q.question || '');
      // Check for canvas / binary / json leakage
      if (
        text.includes('shadowOffsetX') ||
        text.includes('shadowOffsetY') ||
        text.includes('showInExport') ||
        text.includes('draggable') ||
        text.includes('resizable') ||
        text.includes('contentEditable') ||
        text.includes('styleEditable') ||
        text.includes('selectable')
      ) {
        return true;
      }
      // Check options array
      if (Array.isArray(q.options)) {
        if (q.options.some(opt => typeof opt === 'string' && (opt.startsWith('</') || opt.includes('shadowOffsetX') || opt.includes('resizable')))) {
          return true;
        }
      }
      // Check individual option fields
      if (typeof q.optionA === 'string' && (q.optionA.startsWith('</') || q.optionA.includes('shadowOffsetX'))) return true;
      return false;
    };

    const initialLen = questions.length;
    let cleaned = questions.filter(q => !isCorrupted(q));

    if (cleaned.length !== initialLen) {
      this.setItem(APP_KEYS.QUESTIONS, cleaned);
    }

    // Also clear any corrupted active exam state
    const activeExam = this.getItem(APP_KEYS.ACTIVE_EXAM_STATE, null);
    if (activeExam && activeExam.questions) {
      if (activeExam.questions.some(q => isCorrupted(q))) {
        this.setItem(APP_KEYS.ACTIVE_EXAM_STATE, null);
        console.log("Purged corrupted active exam session.");
      }
    }
  }


  async syncToFirebase(collectionName, docId, data) {
    if (!this.firebaseInitialized) return;

    try {
      // Sanitize data to remove undefined or prototype functions
      const sanitized = JSON.parse(JSON.stringify(data || {}));

      if (this.db) {
        try {
          await this.db.collection(collectionName).doc(String(docId)).set(sanitized, { merge: true });
          console.log(`Synced to Firestore cloud: ${collectionName}/${docId}`);
        } catch (e) {
          console.warn(`Firebase Firestore write notice for ${collectionName}/${docId}:`, e.message || e);
        }
      }

      if (this.rtdb) {
        try {
          await this.rtdb.ref(`${collectionName}/${docId}`).set(sanitized);
          console.log(`Synced to Realtime DB cloud: ${collectionName}/${docId}`);
        } catch (e) {
          console.warn(`Realtime DB write notice:`, e.message || e);
        }
      }
    } catch (err) {
      console.warn('Firebase payload sanitization warning:', err);
    }
  }

  async deleteFromFirebase(collectionName, docId) {
    if (!this.firebaseInitialized) return;

    if (this.db) {
      try {
        await this.db.collection(collectionName).doc(String(docId)).delete();
        console.log(`Permanently deleted from Firestore cloud DB: ${collectionName}/${docId}`);
      } catch (e) {
        console.error(`Firebase Firestore delete failed for ${collectionName}/${docId}:`, e);
        throw new Error(`Database deletion failed: ${e.message || 'Permission denied or connection issue'}`);
      }
    }

    if (this.rtdb) {
      try {
        await this.rtdb.ref(`${collectionName}/${docId}`).remove();
        console.log(`Permanently deleted from Realtime DB: ${collectionName}/${docId}`);
      } catch (e) {
        console.warn(`Realtime DB delete info:`, e);
      }
    }
  }

  syncAllToFirebase() {
    if (!this.firebaseInitialized) return;
    const questions = this.getQuestions();
    const subjects = this.getSubjects();
    const attempts = this.getAttempts();
    const students = this.getStudents();

    questions.forEach(q => this.syncToFirebase('questions', q.id, q));
    subjects.forEach(s => this.syncToFirebase('subjects', s.id, s));
    students.forEach(std => this.syncToFirebase('students', std.id, std));
    attempts.forEach(a => {
      this.syncToFirebase('attempts', a.id, a);
      this.syncToFirebase('quiz_results', a.id, {
        studentName: a.studentName || 'Student',
        studentRegNo: a.studentRegNo || '',
        quizName: a.subjectName || 'Quiz',
        score: a.score || 0,
        totalQuestions: a.totalQuestions || 0,
        percentage: a.percentage || 0,
        submittedAt: a.submittedAt || new Date().toISOString()
      });
    });
  }

  getItem(key, fallback = []) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading key "${key}" from localStorage:`, e);
      return fallback;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Error saving key "${key}" to localStorage:`, e);
      return false;
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error(`Error removing key "${key}" from localStorage:`, e);
      return false;
    }
  }

  /* --- Validation Helpers --- */
  validateRegNo(regNo) {
    const clean = (regNo || '').toString().trim();
    if (!clean) {
      throw new Error("Please enter your Register Number.");
    }
    if (!/^9528\d{8}$/.test(clean)) {
      throw new Error("Register Number must be a 12-digit number starting with 9528 (e.g., 952821104001).");
    }
    return clean;
  }

  /* --- Admins Management API (Super Admin) --- */
  getAdmins() {
    let admins = this.getItem(APP_KEYS.ADMINS, null);
    if (!Array.isArray(admins) || admins.length === 0) {
      admins = Array.isArray(DEFAULT_ADMINS) ? [...DEFAULT_ADMINS] : [];
      this.setItem(APP_KEYS.ADMINS, admins);
    }

    // Auto-migrate: Guarantee primary Super Admin 'kasivishal' always exists
    const superAdminIndex = admins.findIndex(a => (a.username || '').trim().toLowerCase() === 'kasivishal');
    if (superAdminIndex === -1) {
      admins.unshift({
        id: "admin-super",
        username: "kasivishal",
        password: "iamkasivishal",
        name: "Kasivishal",
        role: "Super Admin",
        isSuperAdmin: true,
        createdAt: new Date().toISOString()
      });
      this.setItem(APP_KEYS.ADMINS, admins);
    } else {
      admins[superAdminIndex].isSuperAdmin = true;
      if (!admins[superAdminIndex].role) admins[superAdminIndex].role = "Super Admin";
    }

    return admins;
  }

  getAdminById(id) {
    if (!id) return null;
    return this.getAdmins().find(a => a.id === id) || null;
  }

  getAdminDisplayName(username, fallback = 'Faculty Staff') {
    if (!username) return fallback;
    const cleanUser = String(username).trim().toLowerCase();
    const admins = this.getAdmins();
    const found = admins.find(a => (a.username || '').trim().toLowerCase() === cleanUser);
    if (found && found.name) return found.name;
    return username;
  }

  addAdmin(adminData) {
    const username = (adminData.username || '').trim().toLowerCase();
    const password = (adminData.password || '').trim();
    const name = (adminData.name || '').trim();
    const role = (adminData.role || 'Admin').trim();

    if (!username) throw new Error("Username is required.");
    if (username.length < 3) throw new Error("Username must be at least 3 characters.");
    if (!password) throw new Error("Password is required.");
    if (password.length < 4) throw new Error("Password must be at least 4 characters.");
    if (!name) throw new Error("Full Name is required.");

    const admins = this.getAdmins();
    const exists = admins.some(a => (a.username || '').trim().toLowerCase() === username);
    if (exists) {
      throw new Error(`Admin with username "${username}" already exists.`);
    }

    const newAdmin = {
      id: `admin-${Date.now()}`,
      username: username,
      password: password,
      name: name,
      role: role,
      isSuperAdmin: role === 'Super Admin' || username === 'kasivishal',
      createdAt: new Date().toISOString()
    };

    admins.push(newAdmin);
    this.setItem(APP_KEYS.ADMINS, admins);
    return newAdmin;
  }

  updateAdmin(id, updateData) {
    const admins = this.getAdmins();
    const index = admins.findIndex(a => a.id === id);
    if (index === -1) throw new Error("Admin not found.");

    const targetAdmin = admins[index];

    // If changing username, check uniqueness
    if (updateData.username) {
      const newUsername = updateData.username.trim().toLowerCase();
      if (newUsername.length < 3) throw new Error("Username must be at least 3 characters.");

      const duplicate = admins.some(a => a.id !== id && (a.username || '').trim().toLowerCase() === newUsername);
      if (duplicate) throw new Error(`Username "${newUsername}" is already taken by another admin.`);

      targetAdmin.username = newUsername;
    }

    if (updateData.name) {
      targetAdmin.name = updateData.name.trim();
    }

    if (updateData.password) {
      const newPass = updateData.password.trim();
      if (newPass.length < 4) throw new Error("Password must be at least 4 characters.");
      targetAdmin.password = newPass;
    }

    if (updateData.role) {
      if (targetAdmin.username.toLowerCase() === 'kasivishal') {
        targetAdmin.role = 'Super Admin';
        targetAdmin.isSuperAdmin = true;
      } else {
        targetAdmin.role = updateData.role;
        targetAdmin.isSuperAdmin = (updateData.role === 'Super Admin');
      }
    }

    targetAdmin.updatedAt = new Date().toISOString();
    admins[index] = targetAdmin;
    this.setItem(APP_KEYS.ADMINS, admins);
    return targetAdmin;
  }

  deleteAdmin(id) {
    const admins = this.getAdmins();
    const target = admins.find(a => a.id === id);
    if (!target) throw new Error("Admin not found.");

    if ((target.username || '').trim().toLowerCase() === 'kasivishal') {
      throw new Error("Cannot delete primary Super Admin account (kasivishal)!");
    }

    const currentSession = this.getActiveSession();
    if (currentSession && currentSession.user && currentSession.user.id === id) {
      throw new Error("You cannot delete the admin account you are currently logged into.");
    }

    const remaining = admins.filter(a => a.id !== id);
    this.setItem(APP_KEYS.ADMINS, remaining);
    return true;
  }

  /* --- Advertisement Management API (Super Admin Master Engine) --- */
  getAds() {
    return this.getItem(APP_KEYS.ADS, []);
  }

  getAdById(id) {
    if (!id) return null;
    return this.getAds().find(a => a.id === id) || null;
  }

  addAd(adData) {
    const title = (adData.title || '').trim();
    if (!title) throw new Error("Advertisement Campaign Title is required.");
    const placement = adData.placement || 'login_banner';
    const network = adData.network || 'custom_banner';

    const ads = this.getAds();
    const newAd = {
      id: `ad-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      title: title,
      network: network, // 'custom_banner' | 'adsense' | 'meta' | 'custom_html'
      placement: placement, // 'login_banner' | 'student_dash_top' | 'student_dash_sidebar' | 'compiler_banner' | 'exam_header'
      size: adData.size || 'auto', // 'auto' | '728x90' | '468x60' | '300x250' etc.
      imageUrl: (adData.imageUrl || '').trim(),
      targetUrl: (adData.targetUrl || '').trim(),
      altText: (adData.altText || '').trim(),
      codeSnippet: (adData.codeSnippet || '').trim(),
      status: adData.status || 'active', // 'active' | 'paused'
      impressions: 0,
      clicks: 0,
      createdAt: new Date().toISOString()
    };

    ads.unshift(newAd);
    this.setItem(APP_KEYS.ADS, ads);
    return newAd;
  }

  updateAd(id, updateData) {
    const ads = this.getAds();
    const index = ads.findIndex(a => a.id === id);
    if (index === -1) throw new Error("Advertisement not found.");

    const targetAd = ads[index];
    if (updateData.title !== undefined) targetAd.title = updateData.title.trim();
    if (updateData.network !== undefined) targetAd.network = updateData.network;
    if (updateData.placement !== undefined) targetAd.placement = updateData.placement;
    if (updateData.size !== undefined) targetAd.size = updateData.size;
    if (updateData.imageUrl !== undefined) targetAd.imageUrl = updateData.imageUrl.trim();
    if (updateData.targetUrl !== undefined) targetAd.targetUrl = updateData.targetUrl.trim();
    if (updateData.altText !== undefined) targetAd.altText = updateData.altText.trim();
    if (updateData.codeSnippet !== undefined) targetAd.codeSnippet = updateData.codeSnippet.trim();
    if (updateData.status !== undefined) targetAd.status = updateData.status;

    targetAd.updatedAt = new Date().toISOString();
    ads[index] = targetAd;
    this.setItem(APP_KEYS.ADS, ads);
    return targetAd;
  }

  toggleAdStatus(id) {
    const ads = this.getAds();
    const target = ads.find(a => a.id === id);
    if (!target) throw new Error("Advertisement not found.");
    target.status = target.status === 'active' ? 'paused' : 'active';
    this.setItem(APP_KEYS.ADS, ads);
    return target;
  }

  deleteAd(id) {
    const ads = this.getAds();
    const remaining = ads.filter(a => a.id !== id);
    this.setItem(APP_KEYS.ADS, remaining);
    return true;
  }

  getActiveAdsByPlacement(placementId) {
    return this.getAds().filter(a => a.placement === placementId && a.status === 'active');
  }

  recordAdClick(id) {
    const ads = this.getAds();
    const target = ads.find(a => a.id === id);
    if (target) {
      target.clicks = (target.clicks || 0) + 1;
      this.setItem(APP_KEYS.ADS, ads);
    }
  }

  /* --- Students API --- */
  getStudents() {
    return this.getItem(APP_KEYS.STUDENTS, []);
  }

  getStudentByRegNo(regNo) {
    if (!regNo) return null;
    const clean = regNo.toString().trim();
    return this.getStudents().find(s => s.regNo && s.regNo.toString().trim() === clean) || null;
  }

  addStudent(studentData) {
    const cleanReg = this.validateRegNo(studentData.regNo);
    studentData.regNo = cleanReg;

    const students = this.getStudents();
    const existing = students.find(s => s.regNo.toString().trim() === cleanReg);
    if (existing) {
      throw new Error(`Student with Register Number ${cleanReg} already exists.`);
    }
    const newStudent = {
      id: `std-${Date.now()}`,
      ...studentData,
      createdAt: new Date().toISOString()
    };
    students.push(newStudent);
    this.setItem(APP_KEYS.STUDENTS, students);
    this.syncToFirebase('students', newStudent.id, newStudent);
    return newStudent;
  }

  updateStudent(id, updatedFields) {
    const students = this.getStudents();
    const index = students.findIndex(s => s.id === id);
    if (index === -1) throw new Error("Student not found.");
    
    // Check regNo format & uniqueness if changing
    if (updatedFields.regNo) {
      const cleanReg = this.validateRegNo(updatedFields.regNo);
      updatedFields.regNo = cleanReg;

      const duplicate = students.find(s => s.id !== id && s.regNo.toString().trim() === cleanReg);
      if (duplicate) throw new Error(`Register Number ${cleanReg} is already used by another student.`);
    }

    students[index] = { ...students[index], ...updatedFields };
    this.setItem(APP_KEYS.STUDENTS, students);
    this.syncToFirebase('students', id, students[index]);
    return students[index];
  }

  async deleteStudent(id) {
    if (!id) return false;
    const targetId = String(id).trim().toLowerCase();
    let students = this.getStudents();

    students = students.filter(s => {
      const sId = s.id ? String(s.id).trim().toLowerCase() : '';
      const sReg = s.regNo ? String(s.regNo).trim().toLowerCase() : '';
      return sId !== targetId && sReg !== targetId;
    });
    this.setItem(APP_KEYS.STUDENTS, students);

    const deletedIds = this.getItem('lms_deleted_student_ids', []);
    if (!deletedIds.includes(targetId)) {
      deletedIds.push(targetId);
      this.setItem('lms_deleted_student_ids', deletedIds);
    }

    if (this.firebaseInitialized && this.db) {
      try {
        this.deleteFromFirebase('students', id);
      } catch (err) {
        console.warn("Cloud delete warning:", err);
      }
    }
    return true;
  }

  /* --- Subjects API --- */
  getSubjects() {
    const list = this.getItem(APP_KEYS.SUBJECTS, []);
    let updated = false;
    list.forEach(s => {
      if (!s.createdBy) {
        s.createdBy = 'admin';
        updated = true;
      }
    });
    if (updated) {
      this.setItem(APP_KEYS.SUBJECTS, list);
    }
    return list;
  }

  addSubject(subjectData) {
    const subjects = this.getSubjects();
    const duration = parseInt(subjectData.duration, 10) || 30;
    const maxWarnings = parseInt(subjectData.maxWarnings, 10) || 3;
    const session = this.getActiveSession();
    const currentUsername = (session && session.user && session.user.username) 
      ? session.user.username.trim().toLowerCase() 
      : 'admin';
    const currentName = (session && session.user && (session.user.name || session.user.username)) 
      ? session.user.name 
      : this.getAdminDisplayName(currentUsername);
    const newSubject = {
      id: `sub-${Date.now()}`,
      ...subjectData,
      createdBy: subjectData.createdBy || currentUsername,
      createdByName: subjectData.createdByName || currentName,
      duration: duration,
      maxWarnings: maxWarnings
    };
    subjects.push(newSubject);
    this.setItem(APP_KEYS.SUBJECTS, subjects);
    this.syncToFirebase('subjects', newSubject.id, newSubject);
    return newSubject;
  }

  setSubjects(subjects) {
    this.setItem(APP_KEYS.SUBJECTS, subjects);
  }

  updateSubject(id, updatedFields) {
    const subjects = this.getSubjects();
    const targetId = String(id).trim().toLowerCase();
    const index = subjects.findIndex(s => (s.id && String(s.id).trim().toLowerCase() === targetId) || (s.code && String(s.code).trim().toLowerCase() === targetId));
    if (index === -1) throw new Error("Subject not found.");
    if (updatedFields.duration !== undefined) {
      updatedFields.duration = parseInt(updatedFields.duration, 10) || 30;
    }
    if (updatedFields.maxWarnings !== undefined) {
      updatedFields.maxWarnings = parseInt(updatedFields.maxWarnings, 10) || 3;
    }
    subjects[index] = { ...subjects[index], ...updatedFields };
    this.setItem(APP_KEYS.SUBJECTS, subjects);
    this.syncToFirebase('subjects', id, subjects[index]);
    return subjects[index];
  }

  getSubjectMaxWarnings(subjectId) {
    if (!subjectId || subjectId === 'ALL') return this.getItem('lms_global_max_warnings', 3);
    const clean = String(subjectId).trim().toLowerCase();
    const subjects = this.getSubjects();
    const s = subjects.find(item => 
      (item.id && String(item.id).trim().toLowerCase() === clean) ||
      (item.name && String(item.name).trim().toLowerCase() === clean) ||
      (item.code && String(item.code).trim().toLowerCase() === clean)
    );
    if (s && s.maxWarnings) return parseInt(s.maxWarnings, 10);
    return this.getItem('lms_global_max_warnings', 3);
  }

  setSubjectMaxWarnings(subjectId, maxLimit) {
    const limit = Math.max(1, parseInt(maxLimit, 10) || 3);
    if (!subjectId || subjectId === 'ALL') {
      this.setItem('lms_global_max_warnings', limit);
      const subjects = this.getSubjects();
      subjects.forEach(s => { s.maxWarnings = limit; });
      this.setItem(APP_KEYS.SUBJECTS, subjects);
      return limit;
    }

    const clean = String(subjectId).trim().toLowerCase();
    const subjects = this.getSubjects();
    const s = subjects.find(item => 
      (item.id && String(item.id).trim().toLowerCase() === clean) ||
      (item.name && String(item.name).trim().toLowerCase() === clean) ||
      (item.code && String(item.code).trim().toLowerCase() === clean)
    );
    if (s) {
      s.maxWarnings = limit;
      this.setItem(APP_KEYS.SUBJECTS, subjects);
      this.syncToFirebase('subjects', s.id, s);
    }
    return limit;
  }

  async deleteSubject(id) {
    if (!id) return false;
    const targetId = String(id).trim().toLowerCase();

    // 1. Delete subject locally FIRST
    let subjects = this.getSubjects();
    subjects = subjects.filter(s => {
      const sId = s.id ? String(s.id).trim().toLowerCase() : '';
      const sCode = s.code ? String(s.code).trim().toLowerCase() : '';
      return sId !== targetId && sCode !== targetId;
    });
    this.setItem(APP_KEYS.SUBJECTS, subjects);

    const deletedSubIds = this.getItem('lms_deleted_sub_ids', []);
    if (!deletedSubIds.includes(targetId)) {
      deletedSubIds.push(targetId);
      this.setItem('lms_deleted_sub_ids', deletedSubIds);
    }

    // 2. Delete related questions locally FIRST
    let questions = this.getQuestions();
    const questionsToDelete = questions.filter(q => q.subjectId && String(q.subjectId).trim().toLowerCase() === targetId);
    const deletedQIds = this.getItem('lms_deleted_q_ids', []);
    questionsToDelete.forEach(q => {
      if (q.id && !deletedQIds.includes(String(q.id).toLowerCase())) {
        deletedQIds.push(String(q.id).toLowerCase());
      }
    });
    this.setItem('lms_deleted_q_ids', deletedQIds);

    questions = questions.filter(q => !q.subjectId || String(q.subjectId).trim().toLowerCase() !== targetId);
    this.setItem(APP_KEYS.QUESTIONS, questions);

    // 3. Delete related attempts locally FIRST
    let attempts = this.getAttempts();
    attempts = attempts.filter(a => !a.subjectId || String(a.subjectId).trim().toLowerCase() !== targetId);
    this.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);

    // 4. Background cloud cleanup
    if (this.firebaseInitialized && this.db) {
      try {
        this.deleteFromFirebase('subjects', id);
        for (const q of questionsToDelete) {
          this.deleteFromFirebase('questions', q.id);
        }
      } catch (err) {}
    }
    return true;
  }

  /* --- Questions API --- */
  getQuestions() {
    return this.getItem(APP_KEYS.QUESTIONS, []);
  }

  addQuestion(questionData) {
    const questions = this.getQuestions();
    const session = this.getActiveSession();
    const currentUsername = (session && session.user && session.user.username) 
      ? session.user.username.trim().toLowerCase() 
      : 'admin';
    const currentName = (session && session.user && (session.user.name || session.user.username)) 
      ? session.user.name 
      : this.getAdminDisplayName(currentUsername);
    const newQuestion = {
      id: questionData.id || `q-${Date.now()}`,
      ...questionData,
      createdBy: questionData.createdBy || currentUsername,
      createdByName: questionData.createdByName || currentName
    };
    questions.push(newQuestion);
    this.setItem(APP_KEYS.QUESTIONS, questions);
    this.syncToFirebase('questions', newQuestion.id, newQuestion);
    return newQuestion;
  }

  updateQuestion(id, updatedFields) {
    const questions = this.getQuestions();
    const targetId = String(id).trim().toLowerCase();
    const index = questions.findIndex(q => q.id && String(q.id).trim().toLowerCase() === targetId);
    if (index === -1) throw new Error("Question not found.");
    questions[index] = { ...questions[index], ...updatedFields };
    this.setItem(APP_KEYS.QUESTIONS, questions);
    this.syncToFirebase('questions', id, questions[index]);
    return questions[index];
  }

  async deleteQuestion(id) {
    if (!id) return false;
    const targetId = String(id).trim().toLowerCase();

    // 1. Delete locally FIRST (immediate & permanent)
    let questions = this.getQuestions();
    questions = questions.filter(q => {
      const qId = q.id ? String(q.id).trim().toLowerCase() : '';
      return qId !== targetId;
    });
    this.setItem(APP_KEYS.QUESTIONS, questions);

    // 2. Record deleted ID so syncFromFirebase never restores it on refresh
    const deletedQIds = this.getItem('lms_deleted_q_ids', []);
    if (!deletedQIds.includes(targetId)) {
      deletedQIds.push(targetId);
      this.setItem('lms_deleted_q_ids', deletedQIds);
    }

    // 3. Non-blocking cloud delete
    if (this.firebaseInitialized && this.db) {
      try {
        this.deleteFromFirebase('questions', id);
      } catch (err) {}
    }
    return true;
  }


  async deleteQuestionsBySubject(subjectId) {
    let questions = this.getQuestions();
    const questionsToDelete = questions.filter(q => q.subjectId === subjectId);
    const deletedQIds = this.getItem('lms_deleted_q_ids', []);
    questionsToDelete.forEach(q => {
      if (!deletedQIds.includes(q.id)) deletedQIds.push(q.id);
    });
    this.setItem('lms_deleted_q_ids', deletedQIds);

    questions = questions.filter(q => q.subjectId !== subjectId);
    this.setItem(APP_KEYS.QUESTIONS, questions);

    if (this.firebaseInitialized && this.db) {
      for (const q of questionsToDelete) {
        try {
          await this.deleteFromFirebase('questions', q.id);
        } catch (e) {}
      }
    }
    return true;
  }

  async deleteAllQuestions(filterSubjectId = null) {
    let questions = this.getQuestions();
    const deletedQIds = this.getItem('lms_deleted_q_ids', []);
    let questionsToDelete = [];

    if (filterSubjectId && filterSubjectId !== 'All') {
      const targetId = String(filterSubjectId).trim().toLowerCase();
      questionsToDelete = questions.filter(q => {
        const qSubId = q.subjectId ? String(q.subjectId).trim().toLowerCase() : '';
        const qSubName = q.subject ? String(q.subject).trim().toLowerCase() : '';
        return qSubId === targetId || qSubName === targetId;
      });
      questions = questions.filter(q => !questionsToDelete.some(dq => dq.id === q.id));
    } else {
      questionsToDelete = [...questions];
      questions = [];
    }

    questionsToDelete.forEach(q => {
      const qId = q.id ? String(q.id).trim().toLowerCase() : '';
      if (qId && !deletedQIds.includes(qId)) {
        deletedQIds.push(qId);
      }
    });

    this.setItem('lms_deleted_q_ids', deletedQIds);
    this.setItem(APP_KEYS.QUESTIONS, questions);

    if (this.firebaseInitialized && this.db) {
      for (const q of questionsToDelete) {
        try {
          await this.deleteFromFirebase('questions', q.id);
        } catch (e) {}
      }
    }
    return true;
  }


  importJsonQuestions(questionsToImport, subjectMeta, replaceExisting = true) {
    let allQuestions = this.getQuestions();
    const targetSubjectId = subjectMeta.subjectId || subjectMeta.id;
    const targetSubjectName = subjectMeta.name || subjectMeta.subject || 'Subject';
    const year = subjectMeta.year || subjectMeta.academicYear || '1st Year';
    const section = subjectMeta.section || 'All';

    if (replaceExisting) {
      // Delete questions belonging to selected Subject, Academic Year, and Section
      const deletedQuestions = allQuestions.filter(q => {
        const isSameSubject = q.subjectId === targetSubjectId || (q.subject && q.subject.toLowerCase() === targetSubjectName.toLowerCase());
        const isSameYear = !q.year || q.year === year;
        const isSameSec = !q.section || q.section === section;
        return (isSameSubject && isSameYear && isSameSec);
      });
      deletedQuestions.forEach(dq => this.deleteFromFirebase('questions', dq.id));

      allQuestions = allQuestions.filter(q => !deletedQuestions.some(dq => dq.id === q.id));
    }

    const now = new Date().toISOString();
    const formattedQuestions = questionsToImport
      .filter(q => {
        if (!q) return false;
        const text = String(q.question || q.text || '').trim();
        if (text.length < 3) return false;
        if (text.includes('shadowOffsetX') || text.includes('shadowOffsetY') || text.includes('showInExport') || text.includes('draggable')) return false;
        return true;
      })
      .map((q, idx) => {
        const qId = q.id || `q-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
        let rawOpts = Array.isArray(q.options) ? q.options : [q.options?.A || '', q.options?.B || '', q.options?.C || '', q.options?.D || ''];
        
        // Clean options: remove any redundant "A.", "A)", "(A)", etc. prefix
        const cleanOpts = rawOpts.map(o => {
          let s = String(o || '').trim();
          return s.replace(/^[(\[]?[A-Da-d1-4][)\]\.:\s-]\s*/, '').trim();
        });

        // Ensure 4 items
        while (cleanOpts.length < 4) cleanOpts.push('');

        const letterMap = ['A', 'B', 'C', 'D'];
        let cIndex = typeof q.correctIndex === 'number' ? q.correctIndex : 0;
        if (cIndex < 0 || cIndex > 3) cIndex = 0;
        let cAnswer = q.correctAnswer || letterMap[cIndex] || 'A';

        // Clean question text
        let cleanText = String(q.question || q.text || '').trim();
        cleanText = cleanText.replace(/^(?:Q(?:uestion)?\s*\d+[\.\:\)]|\d+[\.\:\)])\s*/i, '').trim();

        return {
          id: qId,
          subjectId: targetSubjectId,
          subject: targetSubjectName,
          subjectName: targetSubjectName,
          academicYear: year,
          year: year,
          section: section,
          question: cleanText,
          text: cleanText,
          optionA: cleanOpts[0] || '',
          optionB: cleanOpts[1] || '',
          optionC: cleanOpts[2] || '',
          optionD: cleanOpts[3] || '',
          options: cleanOpts,
          correctAnswer: cAnswer,
          correctIndex: cIndex,
          explanation: q.explanation || '',
          chapter: q.chapter || 'JSON Import',
          createdAt: q.createdAt || now,
          updatedAt: now
        };
      });

    if (!replaceExisting) {
      // Append non-duplicate questions
      formattedQuestions.forEach(newQ => {
        const isDup = allQuestions.some(existingQ => 
          existingQ.subjectId === newQ.subjectId && 
          existingQ.text.trim().toLowerCase() === newQ.text.trim().toLowerCase()
        );
        if (!isDup) {
          allQuestions.push(newQ);
        }
      });
    } else {
      allQuestions = allQuestions.concat(formattedQuestions);
    }

    this.setItem(APP_KEYS.QUESTIONS, allQuestions);

    // Sync imported questions to Firebase Firestore
    formattedQuestions.forEach(q => {
      this.syncToFirebase('questions', q.id, q);
    });

    return formattedQuestions;
  }

  /* --- Years & Sections API --- */
  getYearsAndSections() {
    return this.getItem(APP_KEYS.YEARS_SECTIONS, DEFAULT_YEARS_SECTIONS);
  }

  saveYearsAndSections(data) {
    this.setItem(APP_KEYS.YEARS_SECTIONS, data);
    this.syncToFirebase('meta', 'years_sections', data);
    if (typeof window !== 'undefined' && typeof window.populateGlobalYearsAndSections === 'function') {
      window.populateGlobalYearsAndSections();
    }
  }

  /* --- Attempts API --- */
  getAttempts() {
    return this.getItem(APP_KEYS.EXAM_ATTEMPTS, []);
  }

  getAttemptsByStudent(regNo) {
    if (!regNo) return [];
    const clean = regNo.toString().trim();
    return this.getAttempts().filter(a => a.studentRegNo && a.studentRegNo.toString().trim() === clean);
  }

  addAttempt(attemptData) {
    const attempts = this.getAttempts();
    let createdBy = attemptData.createdBy || '';
    let createdByName = attemptData.createdByName || '';
    if (attemptData.subjectId) {
      const sub = this.getSubjects().find(s => 
        (s.id && String(s.id).toLowerCase() === String(attemptData.subjectId).toLowerCase()) ||
        (s.code && String(s.code).toLowerCase() === String(attemptData.subjectId).toLowerCase())
      );
      if (sub) {
        if (!createdBy && sub.createdBy) createdBy = sub.createdBy;
        if (!createdByName && sub.createdByName) createdByName = sub.createdByName;
      }
    }
    if (!createdByName && createdBy) {
      createdByName = this.getAdminDisplayName(createdBy);
    }
    const newAttempt = {
      id: `att-${Date.now()}`,
      ...attemptData,
      createdBy: createdBy || '',
      createdByName: createdByName || 'Faculty Staff'
    };
    attempts.push(newAttempt);
    this.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
    this.syncToFirebase('attempts', newAttempt.id, newAttempt);
    this.syncToFirebase('quiz_results', newAttempt.id, {
      studentName: newAttempt.studentName || 'Student',
      studentRegNo: newAttempt.studentRegNo || '',
      quizName: newAttempt.subjectName || 'Quiz',
      score: newAttempt.score || 0,
      totalQuestions: newAttempt.totalQuestions || 0,
      percentage: newAttempt.percentage || 0,
      submittedAt: newAttempt.submittedAt || new Date().toISOString()
    });
    return newAttempt;
  }

  /* --- Violations API --- */
  getViolations() {
    return this.getItem(APP_KEYS.VIOLATIONS, []);
  }

  logViolation(violationData) {
    const violations = this.getViolations();
    let createdBy = violationData.createdBy || '';
    if (!createdBy && (violationData.subjectId || violationData.subjectName)) {
      const sub = this.getSubjects().find(s => 
        (s.id && String(s.id).toLowerCase() === String(violationData.subjectId || '').toLowerCase()) || 
        (s.name && String(s.name).toLowerCase() === String(violationData.subjectName || '').toLowerCase())
      );
      if (sub && sub.createdBy) createdBy = sub.createdBy;
    }
    const newViolation = {
      id: `viol-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...violationData,
      createdBy: createdBy || ''
    };
    violations.unshift(newViolation); // recent first
    this.setItem(APP_KEYS.VIOLATIONS, violations);
    this.syncToFirebase('violations', newViolation.id, newViolation);
    return newViolation;
  }

  updateViolation(id, updateData) {
    let violations = this.getViolations();
    const idx = violations.findIndex(v => v.id === id);
    if (idx !== -1) {
      violations[idx] = { ...violations[idx], ...updateData };
      this.setItem(APP_KEYS.VIOLATIONS, violations);
      this.syncToFirebase('violations', id, violations[idx]);
      return violations[idx];
    }
    return null;
  }

  deleteViolation(id) {
    let violations = this.getViolations();
    violations = violations.filter(v => v.id !== id);
    this.setItem(APP_KEYS.VIOLATIONS, violations);
    return true;
  }

  clearAllViolations() {
    this.setItem(APP_KEYS.VIOLATIONS, []);
    return true;
  }

  unlockStudentExamAttempt(studentRegNo, subjectNameOrId) {
    const cleanReg = String(studentRegNo || '').trim().toLowerCase();
    const cleanSub = String(subjectNameOrId || '').trim().toLowerCase();

    // 1. Remove or unlock any attempt for this student & subject so they can retake
    let attempts = this.getAttempts();
    attempts = attempts.filter(a => {
      const matchReg = String(a.studentRegNo || '').trim().toLowerCase() === cleanReg;
      const matchSub = (a.subjectId && String(a.subjectId).trim().toLowerCase() === cleanSub) ||
                       (a.subjectName && String(a.subjectName).trim().toLowerCase() === cleanSub);
      return !(matchReg && matchSub);
    });
    this.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);

    // 2. Clear violations for this student and subject
    let violations = this.getViolations();
    violations = violations.filter(v => {
      const matchReg = String(v.studentRegNo || '').trim().toLowerCase() === cleanReg;
      const matchSub = (v.subjectName && String(v.subjectName).trim().toLowerCase() === cleanSub) ||
                       (v.subjectId && String(v.subjectId).trim().toLowerCase() === cleanSub);
      return !(matchReg && matchSub);
    });
    this.setItem(APP_KEYS.VIOLATIONS, violations);

    // 3. Clear active exam session if present
    localStorage.removeItem(APP_KEYS.ACTIVE_EXAM_STATE);
    return true;
  }

  /* --- Active Session API --- */
  getActiveSession() {
    return this.getItem(APP_KEYS.ACTIVE_SESSION, null);
  }

  setActiveSession(sessionObj) {
    this.setItem(APP_KEYS.ACTIVE_SESSION, sessionObj);
  }

  clearActiveSession() {
    this.removeItem(APP_KEYS.ACTIVE_SESSION);
    try {
      localStorage.removeItem('college_exam_active_session');
    } catch (e) {}
    return true;
  }

  /* --- Custom Student Subject / Topic Cards API --- */
  getCustomCards(studentRegNo = null) {
    const cards = this.getItem(APP_KEYS.CUSTOM_CARDS, []);
    if (!studentRegNo) return cards;
    return cards.filter(c => !c.studentRegNo || String(c.studentRegNo).trim().toLowerCase() === String(studentRegNo).trim().toLowerCase());
  }

  saveCustomCard(cardData) {
    let cards = this.getItem(APP_KEYS.CUSTOM_CARDS, []);
    const existingIdx = cards.findIndex(c => c.id === cardData.id);
    if (existingIdx !== -1) {
      cards[existingIdx] = { ...cards[existingIdx], ...cardData, updatedAt: new Date().toISOString() };
    } else {
      cards.push({
        ...cardData,
        id: cardData.id || `custom-card-${Date.now()}`,
        createdAt: new Date().toISOString()
      });
    }
    this.setItem(APP_KEYS.CUSTOM_CARDS, cards);
    return true;
  }

  deleteCustomCard(cardId) {
    let cards = this.getItem(APP_KEYS.CUSTOM_CARDS, []);
    cards = cards.filter(c => c.id !== cardId);
    this.setItem(APP_KEYS.CUSTOM_CARDS, cards);
    return true;
  }

  /* --- Demo Data Purge & Database Clean Slate API --- */
  purgeAllDemoData() {
    const PURGE_FLAG = 'lms_all_demo_data_purged_v5';
    if (localStorage.getItem(PURGE_FLAG)) return;

    // 1. Clear demo students (std-1 to std-6)
    let students = this.getItem(APP_KEYS.STUDENTS, []);
    if (Array.isArray(students)) {
      students = students.filter(s => {
        const id = String(s.id || '');
        const name = String(s.name || '').toLowerCase();
        return !id.startsWith('std-') && !['alex johnson', 'sophia martinez', 'ethan brown', 'emma davis', 'liam wilson', 'olivia taylor'].includes(name);
      });
      this.setItem(APP_KEYS.STUDENTS, students);
    }

    // 2. Clear demo attempts & coding lab attempts
    let attempts = this.getItem(APP_KEYS.EXAM_ATTEMPTS, []);
    if (Array.isArray(attempts)) {
      attempts = attempts.filter(a => {
        const id = String(a.id || '');
        return !id.startsWith('att-seed') && !id.startsWith('att-coding-seed');
      });
      this.setItem(APP_KEYS.EXAM_ATTEMPTS, attempts);
    }

    // 3. Clear demo violations
    let violations = this.getItem(APP_KEYS.VIOLATIONS, []);
    if (Array.isArray(violations)) {
      violations = violations.filter(v => !String(v.id || '').startsWith('viol-seed'));
      this.setItem(APP_KEYS.VIOLATIONS, violations);
    }

    // 4. Clear demo questions
    let questions = this.getItem(APP_KEYS.QUESTIONS, []);
    if (Array.isArray(questions)) {
      questions = questions.filter(q => {
        const id = String(q.id || '');
        return !id.startsWith('q-101-') && !id.startsWith('q-102-') && !id.startsWith('q-201-') && !id.startsWith('q-301-') && !id.startsWith('q-401-') && !id.startsWith('q-code-init-');
      });
      this.setItem(APP_KEYS.QUESTIONS, questions);
    }

    // 5. Clear demo subjects
    let subjects = this.getItem(APP_KEYS.SUBJECTS, []);
    if (Array.isArray(subjects)) {
      subjects = subjects.filter(s => {
        const id = String(s.id || '');
        return !['sub-101', 'sub-102', 'sub-201', 'sub-301', 'sub-401'].includes(id);
      });
      this.setItem(APP_KEYS.SUBJECTS, subjects);
    }

    localStorage.setItem(PURGE_FLAG, 'true');
    console.log("Single source of truth: All demo data successfully purged from localStorage.");
  }

  resetAllData() {
    this.setItem(APP_KEYS.STUDENTS, []);
    this.setItem(APP_KEYS.SUBJECTS, []);
    this.setItem(APP_KEYS.QUESTIONS, []);
    this.setItem(APP_KEYS.EXAM_ATTEMPTS, []);
    this.setItem(APP_KEYS.VIOLATIONS, []);
    this.setItem(APP_KEYS.CUSTOM_CARDS, []);
    this.removeItem(APP_KEYS.ACTIVE_EXAM_STATE);
    localStorage.setItem('lms_all_demo_data_purged_v5', 'true');
    return true;
  }

  /* Super Admin Two-Factor Authentication (2FA) Storage */
  getSuperAdmin2FAConfig() {
    return this.getItem('lms_superadmin_2fa_config', null);
  }

  setSuperAdmin2FAConfig(config) {
    this.setItem('lms_superadmin_2fa_config', config);
    return config;
  }

  isSuperAdmin2FAConfigured() {
    const cfg = this.getSuperAdmin2FAConfig();
    return !!(cfg && cfg.enabled && cfg.secret);
  }

  resetSuperAdmin2FAConfig() {
    localStorage.removeItem('lms_superadmin_2fa_config');
    return true;
  }
}

const storage = new StorageService();
window.storage = storage;

