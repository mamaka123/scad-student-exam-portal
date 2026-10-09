/* ==========================================================================
   Config JS - Initial Seed Data, Constants & LocalStorage Keys
   ========================================================================== */

const APP_KEYS = {
  STUDENTS: 'lms_students',
  ADMINS: 'lms_admins',
  YEARS_SECTIONS: 'lms_years_sections',
  SUBJECTS: 'lms_subjects',
  QUESTIONS: 'lms_questions',
  EXAM_ATTEMPTS: 'lms_exam_attempts',
  VIOLATIONS: 'lms_violations',
  ACTIVE_SESSION: 'lms_active_session',
  ACTIVE_EXAM_STATE: 'lms_active_exam_state',
  CUSTOM_CARDS: 'lms_custom_cards',
  ADS: 'lms_ads'
};

const AD_PLACEMENTS = [
  { id: 'login_banner', label: 'Login Portal (Bottom Banner)', location: 'Login Page' },
  { id: 'student_dash_top', label: 'Student Dashboard (Top Header Banner)', location: 'Student Dashboard' },
  { id: 'student_dash_sidebar', label: 'Student Dashboard (Sidebar Card)', location: 'Student Dashboard' },
  { id: 'notice_board_banner', label: 'Student Notice Board (Announcement Card)', location: 'Notice Board' },
  { id: 'exam_result_banner', label: 'Exam Scorecard & Results (Below Marks)', location: 'Exam Results' },
  { id: 'notes_viewer_footer', label: 'Study Materials & Notes (Viewer Footer)', location: 'Notes & Materials' },
  { id: 'compiler_banner', label: 'Online Compiler Lab (Top Banner)', location: 'Compiler IDE' },
  { id: 'exam_header', label: 'Online Exam (Top Advisory Banner)', location: 'Exam Room' },
  { id: 'logout_screen_banner', label: 'Post-Logout Exit Screen (Farewell Banner)', location: 'Logout Screen' }
];


const AD_NETWORKS = [
  { id: 'custom_banner', label: '🖼️ Custom Image / GIF Banner (Upload or URL)', desc: 'Upload your own image (PNG, JPG, WebP) or animated GIF from device, or enter image link with click redirect URL' },
  { id: 'adsense', label: '🌐 Google AdSense', desc: 'Google AdSense responsive ad snippet / script code' },
  { id: 'meta', label: '📱 Meta Ads (Facebook/Instagram)', desc: 'Meta Ads iframe, pixel or creative embed code' },
  { id: 'amazon', label: '🛒 Amazon Ads & Affiliates', desc: 'Amazon Native Shopping Ads, Associates banners, and product widgets' },
  { id: 'medianet', label: '🔷 Media.net (Yahoo! Bing Contextual)', desc: 'Media.net contextual advertising tags and responsive blocks' },
  { id: 'propeller', label: '🚀 PropellerAds', desc: 'PropellerAds banner zone tags and interstitial code' },
  { id: 'infolinks', label: '🔗 Infolinks', desc: 'Infolinks smart in-text, in-tag and overlay script code' },
  { id: 'adsterra', label: '⭐ Adsterra Network', desc: 'Adsterra social bar, native banner and direct display scripts' },
  { id: 'custom_html', label: '💻 Custom HTML / Rich Media Script', desc: 'Arbitrary custom HTML, iframe, video embed, or banner script' }
];

const BANNER_SIZES = [
  { id: 'auto', label: '⚡ Auto Responsive (Fit to Creative / Screen)', width: null, height: null, category: 'Responsive' },
  { id: '728x90', label: 'PNG 728×90 px (Leaderboard - Wide)', width: 728, height: 90, category: 'Horizontal' },
  { id: '700x90', label: 'PNG 700×90 px (Large Banner)', width: 700, height: 90, category: 'Horizontal' },
  { id: '600x250', label: 'PNG 600×250 px (Large Rectangle)', width: 600, height: 250, category: 'Rectangle' },
  { id: '468x120', label: 'PNG 468×120 px (Extended Banner)', width: 468, height: 120, category: 'Horizontal' },
  { id: '468x60', label: 'PNG 468×60 px (Classic Banner)', width: 468, height: 60, category: 'Horizontal' },
  { id: '300x425', label: 'PNG 300×425 px (Tall Rectangle)', width: 300, height: 425, category: 'Vertical' },
  { id: '300x250', label: 'PNG 300×250 px (Medium Rectangle / MPU)', width: 300, height: 250, category: 'Rectangle' },
  { id: '250x250', label: 'PNG 250×250 px (Square)', width: 250, height: 250, category: 'Square' },
  { id: '200x200', label: 'PNG 200×200 px (Small Square)', width: 200, height: 200, category: 'Square' },
  { id: '160x600', label: 'PNG 160×600 px (Wide Skyscraper - Vertical)', width: 160, height: 600, category: 'Skyscraper' },
  { id: '120x600', label: 'PNG 120×600 px (Skyscraper - Vertical)', width: 120, height: 600, category: 'Skyscraper' },
  { id: '120x300', label: 'PNG 120×300 px (Half Skyscraper)', width: 120, height: 300, category: 'Vertical' },
  { id: '120x150', label: 'PNG 120×150 px (Small Vertical)', width: 120, height: 150, category: 'Vertical' },
  { id: '160x90', label: 'PNG 160×90 px (Small Button)', width: 160, height: 90, category: 'Button' },
  { id: '120x60', label: 'PNG 120×60 px (Mini Banner)', width: 120, height: 60, category: 'Button' },
  { id: '80x30', label: 'PNG 80×30 px (Micro Button)', width: 80, height: 30, category: 'Micro' }
];

const DEFAULT_YEARS_SECTIONS = {
  years: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  sections: ["A", "B", "C"]
};

const DEFAULT_SUPER_ADMIN_2FA_SECRET = 'SCADKASIVISHAL26';

const DEFAULT_ADMINS = [
  {
    id: "admin-super",
    username: "kasivishal",
    password: "iamkasivishal",
    name: "Kasivishal",
    role: "Super Admin",
    isSuperAdmin: true,
    twoFactorSecret: DEFAULT_SUPER_ADMIN_2FA_SECRET,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

// Clean slate: all demo arrays are completely empty
const DEFAULT_STUDENTS = [];
const DEFAULT_SUBJECTS = [];
const DEFAULT_QUESTIONS = [];
const DEFAULT_ATTEMPTS = [];
const DEFAULT_VIOLATIONS = [];

/* Firebase Configuration for Project: scad-student-test-portal */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdtGRbv1XWTROWCPyVbYBBvoe0QVnLDyE",
  authDomain: "scad-student-test-portal.firebaseapp.com",
  projectId: "scad-student-test-portal",
  storageBucket: "scad-student-test-portal.firebasestorage.app",
  messagingSenderId: "1049951251504",
  appId: "1:1049951251504:web:0a00d6849025bb42f0d1f5",
  measurementId: "G-KZEZRSK0F1",
  databaseURL: "https://scad-student-test-portal-default-rtdb.firebaseio.com"
};

window.APP_KEYS = APP_KEYS;
window.AD_PLACEMENTS = AD_PLACEMENTS;
window.AD_NETWORKS = AD_NETWORKS;
window.BANNER_SIZES = BANNER_SIZES;
window.DEFAULT_YEARS_SECTIONS = DEFAULT_YEARS_SECTIONS;
window.DEFAULT_SUPER_ADMIN_2FA_SECRET = DEFAULT_SUPER_ADMIN_2FA_SECRET;
window.DEFAULT_ADMINS = DEFAULT_ADMINS;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;

