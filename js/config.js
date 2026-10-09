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

const DEFAULT_YEARS_SECTIONS = {
  years: ["1st Year", "2nd Year", "3rd Year", "4th Year"],
  sections: ["A", "B", "C"]
};

const DEFAULT_ADMINS = [
  {
    id: "admin-super",
    username: "kasivishal",
    password: "iamkasivishal",
    name: "Kasivishal",
    role: "Super Admin",
    isSuperAdmin: true,
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "admin-1",
    username: "admin",
    password: "admin123",
    name: "System Administrator",
    role: "Admin",
    isSuperAdmin: false,
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];

// Clean slate: all demo arrays are completely empty
const DEFAULT_STUDENTS = [];
const DEFAULT_SUBJECTS = [];
const DEFAULT_QUESTIONS = [];
const DEFAULT_ATTEMPTS = [];
const DEFAULT_VIOLATIONS = [];

/* Firebase Configuration from google-services.json */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCwHHLNywFW7zO0i3vxS0RJO52s8akBdx4",
  authDomain: "student-login-19524.firebaseapp.com",
  projectId: "student-login-19524",
  storageBucket: "student-login-19524.firebasestorage.app",
  messagingSenderId: "717546985351",
  appId: "1:717546985351:android:197296f553de495918e522",
  databaseURL: "https://student-login-19524-default-rtdb.firebaseio.com"
};

window.APP_KEYS = APP_KEYS;
window.AD_PLACEMENTS = AD_PLACEMENTS;
window.AD_NETWORKS = AD_NETWORKS;
window.DEFAULT_YEARS_SECTIONS = DEFAULT_YEARS_SECTIONS;
window.DEFAULT_ADMINS = DEFAULT_ADMINS;
window.FIREBASE_CONFIG = FIREBASE_CONFIG;

