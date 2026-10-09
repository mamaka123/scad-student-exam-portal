/* ==========================================================================
   Auth JS - Authentication, Dynamic Year/Section Selectors & Sessions
   ========================================================================== */

class AuthService {
  constructor() {
    this.currentSession = storage.getActiveSession();
  }

  /* Existing Student Login (Login with Register Number only) - ALWAYS retrieves latest record from Database */
  async loginExistingStudent(regNo) {
    const cleanRegNo = (regNo || '').toString().trim();
    if (!cleanRegNo) throw new Error("Please enter your Register Number.");
    if (!/^9528\d{8}$/.test(cleanRegNo)) {
      throw new Error("Register Number must be a 12-digit number starting with 9528 (e.g., 952821104001).");
    }

    // Always query database first to retrieve latest data and verify student
    let student = null;
    if (window.storage && typeof storage.getStudentByRegNoFromDb === 'function') {
      try {
        student = await storage.getStudentByRegNoFromDb(cleanRegNo);
      } catch (dbErr) {
        console.warn("Live database check failed, using local storage fallback:", dbErr);
      }
    }

    if (!student) {
      student = (window.storage && typeof storage.getStudentByRegNo === 'function')
        ? storage.getStudentByRegNo(cleanRegNo)
        : storage.getStudents().find(s => s.regNo && s.regNo.toString().trim() === cleanRegNo);
    }

    if (!student) {
      throw new Error(`Register Number ${cleanRegNo} not found in student database. If you are a new student, please register first.`);
    }

    const session = {
      role: 'student',
      user: student,
      loginTime: new Date().toISOString()
    };

    storage.setActiveSession(session);
    this.currentSession = session;
    return session;
  }

  /* New Student Registration (First-Time Signup) - Saves directly to Database */
  async registerStudent(name, regNo, year, section) {
    if (!name || !name.trim()) throw new Error("Please enter your Full Name.");
    
    const cleanRegNo = (regNo || '').toString().trim();
    if (!cleanRegNo) throw new Error("Please enter your Register Number.");
    if (!/^9528\d{8}$/.test(cleanRegNo)) {
      throw new Error("Register Number must be a 12-digit number starting with 9528 (e.g., 952821104001).");
    }

    if (!year) throw new Error("Please select your Academic Year.");
    if (!section) throw new Error("Please select your Section.");

    // Check if already registered in Database or LocalStorage
    let existing = null;
    if (window.storage && typeof storage.getStudentByRegNoFromDb === 'function') {
      existing = await storage.getStudentByRegNoFromDb(cleanRegNo);
    } else if (window.storage && typeof storage.getStudentByRegNo === 'function') {
      existing = storage.getStudentByRegNo(cleanRegNo);
    }

    if (existing) {
      throw new Error(`Student with Register Number ${cleanRegNo} is already registered (${existing.name}). Please use 'Existing Student Login'.`);
    }

    const addFn = (window.storage && typeof storage.addStudentAsync === 'function')
      ? storage.addStudentAsync.bind(storage)
      : storage.addStudent.bind(storage);

    const newStudent = await addFn({
      name: name.trim(),
      regNo: cleanRegNo,
      year: year,
      section: section
    });

    const session = {
      role: 'student',
      user: newStudent,
      loginTime: new Date().toISOString()
    };

    storage.setActiveSession(session);
    this.currentSession = session;
    return session;
  }

  /* Unified Student Login Fallback */
  async loginStudent(name, regNo, year, section) {
    const cleanRegNo = (regNo || '').toString().trim();
    if (!cleanRegNo) throw new Error("Please enter your Register Number.");

    let existing = null;
    if (window.storage && typeof storage.getStudentByRegNoFromDb === 'function') {
      existing = await storage.getStudentByRegNoFromDb(cleanRegNo);
    } else if (window.storage && typeof storage.getStudentByRegNo === 'function') {
      existing = storage.getStudentByRegNo(cleanRegNo);
    }

    // If student already exists and name/year/section were omitted, perform fast login
    if (existing && (!name || !year || !section)) {
      return await this.loginExistingStudent(cleanRegNo);
    }

    // If new student registering through combined form
    if (!existing) {
      return await this.registerStudent(name, cleanRegNo, year, section);
    }

    // Existing student logging in with updated details
    const updated = storage.updateStudent(existing.id, {
      name: name.trim(),
      year: year,
      section: section
    });

    const session = {
      role: 'student',
      user: updated,
      loginTime: new Date().toISOString()
    };

    storage.setActiveSession(session);
    this.currentSession = session;
    return session;
  }

  /* Admin Login Validation */
  loginAdmin(username, password) {
    if (!username || !username.trim()) throw new Error("Please enter Admin Username.");
    if (!password || !password.trim()) throw new Error("Please enter Admin Password.");

    const cleanUser = username.trim().toLowerCase();
    const admins = (window.storage && typeof storage.getAdmins === 'function')
      ? storage.getAdmins()
      : storage.getItem(APP_KEYS.ADMINS, DEFAULT_ADMINS);

    const admin = admins.find(a => (a.username || '').toLowerCase() === cleanUser && a.password === password);

    if (!admin) {
      throw new Error("Invalid Admin username or password. Please try again.");
    }

    const isSuper = cleanUser === 'kasivishal' || admin.isSuperAdmin === true || admin.role === 'Super Admin';

    if (isSuper) {
      // Super Admin REQUIRES mandatory Two-Factor Authentication (2FA) verification
      const isConfigured = (window.storage && typeof storage.isSuperAdmin2FAConfigured === 'function')
        ? storage.isSuperAdmin2FAConfigured()
        : false;

      return {
        requires2FA: true,
        isFresher: !isConfigured,
        user: {
          id: admin.id,
          name: admin.name,
          username: admin.username,
          role: admin.role,
          isSuperAdmin: true
        }
      };
    }

    const session = {
      role: 'admin',
      isSuperAdmin: false,
      user: {
        id: admin.id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
        isSuperAdmin: false
      },
      loginTime: new Date().toISOString()
    };

    storage.setActiveSession(session);
    this.currentSession = session;
    return session;
  }

  /* Super Admin 2FA TOTP Code Verification & Session Grant */
  verifySuperAdmin2FALogin(code, secret) {
    if (!code || !code.toString().trim()) {
      throw new Error("Please enter the 6-digit authentication code.");
    }
    if (!window.totpService) {
      throw new Error("Authentication service is not loaded.");
    }

    const cleanCode = code.toString().replace(/[^0-9]/g, '');
    if (cleanCode.length !== 6) {
      throw new Error("Authentication code must be exactly 6 digits.");
    }

    const isValid = window.totpService.verifyCode(cleanCode, secret);
    if (!isValid) {
      throw new Error("Invalid 6-digit authentication code! Please check your Google Authenticator or Microsoft Authenticator app and try again.");
    }

    // Persist verified 2FA configuration in storage
    storage.setSuperAdmin2FAConfig({
      enabled: true,
      secret: secret,
      verifiedAt: new Date().toISOString(),
      username: 'kasivishal'
    });

    const session = {
      role: 'admin',
      isSuperAdmin: true,
      isSuperAdmin2FAVerified: true,
      user: {
        id: 'admin-super',
        name: 'Kasivishal',
        username: 'kasivishal',
        role: 'Super Admin',
        isSuperAdmin: true
      },
      loginTime: new Date().toISOString()
    };

    storage.setActiveSession(session);
    this.currentSession = session;
    return session;
  }

  logout() {
    try {
      if (window.storage && typeof storage.clearActiveSession === 'function') {
        storage.clearActiveSession();
      } else {
        localStorage.removeItem(typeof APP_KEYS !== 'undefined' ? APP_KEYS.ACTIVE_SESSION : 'lms_active_session');
      }
    } catch (e) {
      console.warn("Auth logout warning:", e);
    }
    this.currentSession = null;
  }

  isAuthenticated() {
    return !!storage.getActiveSession();
  }

  isStudent() {
    const s = storage.getActiveSession();
    return s && s.role === 'student';
  }

  isAdmin() {
    const s = storage.getActiveSession();
    return s && s.role === 'admin';
  }

  isSuperAdmin() {
    const s = storage.getActiveSession();
    if (!s || s.role !== 'admin') return false;
    // Strict 2FA check: Must be 2FA verified
    if (s.isSuperAdmin2FAVerified !== true) return false;
    if (s.isSuperAdmin === true) return true;
    if (s.user) {
      const u = (s.user.username || '').toLowerCase();
      if (u === 'kasivishal' || s.user.isSuperAdmin === true || s.user.role === 'Super Admin') {
        return true;
      }
    }
    return false;
  }
}

const auth = new AuthService();
window.auth = auth;
