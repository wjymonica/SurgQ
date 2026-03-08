const questionSelect = document.getElementById("questionSelect");
const loadButton = document.getElementById("loadQuestion");
const questionCard = document.getElementById("questionCard");
const questionStem = document.getElementById("questionStem");
const optionsGrid = document.getElementById("optionsGrid");
const openEndedContainer = document.getElementById("openEndedContainer");
const openEndedAnswer = document.getElementById("openEndedAnswer");
const mcqHint = document.getElementById("mcqHint");
const toggleImagesButton = document.getElementById("toggleImages");
const submitButton = document.getElementById("submitAnswer");
const nextQuestionInCard = document.getElementById("nextQuestionInCard");
const dontKnowButton = document.getElementById("dontKnowButton");
const feedbackCard = document.getElementById("feedbackCard");
const feedbackText = document.getElementById("feedbackText");
const feedbackImage = document.getElementById("feedbackImage");
const feedbackImageWrapper = document.getElementById("feedbackImageWrapper");
const correctAnswer = document.getElementById("correctAnswer");
const errorCard = document.getElementById("errorCard");
const authCard = document.getElementById("authCard");
const appContent = document.getElementById("appContent");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authSubmit = document.getElementById("authSubmit");
const authError = document.getElementById("authError");
const authSuccess = document.getElementById("authSuccess");
const authLinkFallback = document.getElementById("authLinkFallback");
const sendLinkBtn = document.getElementById("sendLinkBtn");
const userEmailEl = document.getElementById("userEmail");
const exportFeedbackPdfBtn = document.getElementById("exportFeedbackPdf");
const signOutButton = document.getElementById("signOut");
const progressPretestCount = document.getElementById("progressPretestCount");
const progressPretestFill = document.getElementById("progressPretestFill");
const progressMainCount = document.getElementById("progressMainCount");
const progressMainFill = document.getElementById("progressMainFill");
const progressPosttestCount = document.getElementById("progressPosttestCount");
const progressPosttestFill = document.getElementById("progressPosttestFill");
const questionPositionEl = document.getElementById("questionPosition");
const nextButton = document.getElementById("nextQuestion");
const transitionCard = document.getElementById("transitionCard");
const transitionTitle = document.getElementById("transitionTitle");
const transitionMessage = document.getElementById("transitionMessage");
const transitionContinueBtn = document.getElementById("transitionContinue");
const imageLightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");
const completionCard = document.getElementById("completionCard");

// Debug panel: only injected into the DOM in debug mode
const _appMode = (window.APP_CONFIG && window.APP_CONFIG.mode) || "debug";
let debugPanel = null, debugJumpSelect = null, debugJumpGoBtn = null;
if (_appMode === "debug") {
  const _dp = document.createElement("div");
  _dp.id = "debugPanel";
  _dp.className = "debug-panel";
  _dp.innerHTML = `<span class="debug-badge">DEBUG MODE</span>
    <div class="debug-jump">
      <label for="debugJumpSelect">Jump to:</label>
      <select id="debugJumpSelect"></select>
      <button type="button" id="debugJumpGo">Go</button>
    </div>`;
  document.getElementById("appContent").insertBefore(_dp, document.getElementById("questionCard"));
  debugPanel = _dp;
  debugJumpSelect = document.getElementById("debugJumpSelect");
  debugJumpGoBtn = document.getElementById("debugJumpGo");
}
const versionBadge = document.getElementById("versionBadge");
const sessionTimerEl = document.getElementById("sessionTimer");
const sessionTimerDisplayEl = document.getElementById("sessionTimerDisplay");

const EMAIL_LINK_STORAGE_KEY = "surgQ_emailForSignIn";
const PRETEST_COUNT = 8;
const POSTTEST_COUNT = 10; // default fallback; overridden per-index via posttestCount field
let currentPosttestCount = POSTTEST_COUNT;
const SESSION_DURATIONS_MS = { pretest: 10 * 60 * 1000, main: 30 * 60 * 1000, posttest: 10 * 60 * 1000 };
const PASSWORD_STORAGE_PREFIX = "surgQ_pw_";
const IMAGE_V = Date.now(); // cache-bust images on every page load

// ── Mode helpers ──────────────────────────────────────────
function getAppMode() {
  return (window.APP_CONFIG && window.APP_CONFIG.mode) || "debug";
}
function isDebugMode() { return getAppMode() === "debug"; }
function getIndexUrl() {
  const m = getAppMode();
  if (m === "v1") return "./questions/index_v1.json";
  if (m === "v2") return "./questions/index_v2.json";
  return "./questions/index.json";
}

let transitionNextIndex = 0;

function getSessionBoundaries() {
  const n = questionList.length;
  const pretestEnd = Math.min(PRETEST_COUNT, n);
  const mainEnd = Math.max(pretestEnd, n - currentPosttestCount);
  return { pretestEnd, mainEnd, posttestStart: mainEnd };
}

function showTransitionToNextSession(nextIndex) {
  const { pretestEnd, posttestStart } = getSessionBoundaries();
  if (nextIndex === pretestEnd) {
    if (transitionTitle) transitionTitle.textContent = "Pretest complete";
    if (transitionMessage) transitionMessage.textContent = "You have finished the pretest. Click Continue to start the main session.";
    transitionNextIndex = nextIndex;
    if (transitionCard) transitionCard.classList.remove("hidden");
    if (questionCard) questionCard.classList.add("hidden");
    if (feedbackCard) feedbackCard.classList.add("hidden");
    return true;
  }
  if (nextIndex === posttestStart) {
    if (transitionTitle) transitionTitle.textContent = "Main session complete";
    if (transitionMessage) transitionMessage.textContent = "You have finished the main session. Click Continue to start the posttest.";
    transitionNextIndex = nextIndex;
    if (transitionCard) transitionCard.classList.remove("hidden");
    if (questionCard) questionCard.classList.add("hidden");
    if (feedbackCard) feedbackCard.classList.add("hidden");
    return true;
  }
  return false;
}

function isPretestOrPosttest() {
  return currentFolder && (currentFolder.startsWith("pretest") || currentFolder.startsWith("posttest"));
}

function storageKeyForEmail(email) {
  try {
    return PASSWORD_STORAGE_PREFIX + btoa(encodeURIComponent(email.trim().toLowerCase()));
  } catch (_) {
    return PASSWORD_STORAGE_PREFIX + email.trim().toLowerCase().replace(/[^a-z0-9._%+-]/g, "_");
  }
}

function getStoredPassword(email) {
  if (!email) return null;
  return window.localStorage.getItem(storageKeyForEmail(email));
}

function setStoredPassword(email, password) {
  if (!email || !password) return;
  window.localStorage.setItem(storageKeyForEmail(email), password);
}

function clearStoredPassword(email) {
  if (!email) return;
  window.localStorage.removeItem(storageKeyForEmail(email));
}

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 16; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function emailToDbKey(email) {
  // Firebase keys cannot contain . so replace with ,
  return email.replace(/\./g, ",");
}

async function getPasswordFromDb(email) {
  if (!db) return null;
  try {
    const snap = await db.ref("emailPasswords/" + emailToDbKey(email)).once("value");
    return snap.val() || null;
  } catch (e) {
    return null;
  }
}

async function savePasswordToDb(email, password) {
  if (!db) return;
  try {
    await db.ref("emailPasswords/" + emailToDbKey(email)).set(password);
  } catch (e) {
    console.warn("Failed to save password to db", e);
  }
}

let currentMeta = null;
let currentFolder = null;
let currentQuestionIndex = 0;
let questionList = []; // order from index.json
let isSubmitting = false;
let showingFeedbackImages = false;
let userProgress = {}; // { questionId: { completed, selectedOptionIds?, openEndedAnswer?, submittedAt? } }
let firebaseReady = false;
let db = null;
let sessionTimerInterval = null;
let sessionTimerEndMs = {};  // { pretest: epochMs, main: epochMs, posttest: epochMs }
let activeTimerSession = null;

const GRADE_ENDPOINT = "http://localhost:8002/grade";

function isFirebaseEnabled() {
  const config = typeof window !== "undefined" && window.FIREBASE_CONFIG;
  return config && config.projectId && config.projectId !== "YOUR_PROJECT_ID";
}

function initFirebase() {
  if (!isFirebaseEnabled()) return null;
  try {
    const app = firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    firebaseReady = true;
    return app;
  } catch (e) {
    console.warn("Firebase init failed", e);
    return null;
  }
}

function showAuthError(msg) {
  authError.textContent = msg || "";
  authError.classList.toggle("hidden", !msg);
  if (msg) authSuccess.classList.add("hidden");
}

function showAuthSuccess(msg) {
  authSuccess.textContent = msg || "";
  authSuccess.classList.toggle("hidden", !msg);
  if (msg) authError.classList.add("hidden");
}

function showAppForUser(user) {
  authCard.classList.add("hidden");
  appContent.classList.remove("hidden");
  if (userEmailEl) userEmailEl.textContent = user.email || "";
  loadUserProgress(user.uid).then(() => {
    loadQuestionList();
  });
}

function getEmailLinkActionUrl() {
  return window.location.origin + window.location.pathname;
}

async function trySignInWithEmailLink() {
  if (!isFirebaseEnabled() || !firebase.auth().isSignInWithEmailLink(window.location.href)) {
    return;
  }
  const email = window.localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
  if (!email) {
    showAuth();
    showAuthError("Please enter your email again, then click the link from your email.");
    return;
  }
  try {
    await firebase.auth().signInWithEmailLink(email, window.location.href);
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, getEmailLinkActionUrl());
    }
  } catch (e) {
    showAuthError(e.message || "Sign-in link failed. Request a new link.");
    window.localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
  }
}

function showAuth() {
  stopSessionTimer();
  sessionTimerEndMs = {};
  appContent.classList.add("hidden");
  authCard.classList.remove("hidden");
  userProgress = {};
}

async function ensureUserProfile(uid, email) {
  if (!db) return;
  const ref = db.ref("users/" + uid);
  const snap = await ref.once("value");
  if (!snap.exists()) {
    await ref.set({
      email: email || "",
      createdAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }
}

async function loadUserProgress(uid) {
  if (!db || !uid) return;
  try {
    const snap = await db.ref("users/" + uid + "/progress").once("value");
    const val = snap.val();
    userProgress = val && typeof val === "object" ? val : {};
  } catch (e) {
    console.warn("Load progress failed", e);
    userProgress = {};
  }
}

async function saveProgress(uid, questionId, data) {
  if (!uid) return;
  if (!db) {
    console.warn("Firebase Realtime Database not initialized. Add databaseURL to FIREBASE_CONFIG in firebase-config.js.");
    return;
  }
  try {
    await db.ref("users/" + uid + "/progress/" + questionId).set({
      ...data,
      updatedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    userProgress[questionId] = { ...userProgress[questionId], ...data };
  } catch (e) {
    console.warn("Save progress failed", e);
  }
}

function getCurrentUser() {
  return isFirebaseEnabled() && firebase.auth().currentUser;
}

function updateProgressBar() {
  const n = questionList.length;
  if (n === 0) return;
  const { pretestEnd, mainEnd, posttestStart } = getSessionBoundaries();
  const pretestTotal = pretestEnd;
  const mainTotal = mainEnd - pretestEnd;
  const posttestTotal = n - posttestStart;

  const completedInPretest = questionList.slice(0, pretestEnd).filter((id) => userProgress[id] && userProgress[id].completed).length;
  const completedInMain = mainTotal > 0 ? questionList.slice(pretestEnd, mainEnd).filter((id) => userProgress[id] && userProgress[id].completed).length : 0;
  const completedInPosttest = posttestTotal > 0 ? questionList.slice(posttestStart).filter((id) => userProgress[id] && userProgress[id].completed).length : 0;

  if (progressPretestCount) progressPretestCount.textContent = `${completedInPretest}/${pretestTotal}`;
  if (progressPretestFill) progressPretestFill.style.width = pretestTotal ? (100 * completedInPretest / pretestTotal) + "%" : "0%";
  if (progressMainCount) progressMainCount.textContent = `${completedInMain}/${mainTotal}`;
  if (progressMainFill) progressMainFill.style.width = mainTotal ? (100 * completedInMain / mainTotal) + "%" : "0%";
  if (progressPosttestCount) progressPosttestCount.textContent = `${completedInPosttest}/${posttestTotal}`;
  if (progressPosttestFill) progressPosttestFill.style.width = posttestTotal ? (100 * completedInPosttest / posttestTotal) + "%" : "0%";
  syncDebugPanel();
}

// ── Debug panel ───────────────────────────────────────────
function addDebugOptgroup(label, start, end) {
  if (start >= end || !debugJumpSelect) return;
  const grp = document.createElement("optgroup");
  grp.label = label;
  for (let i = start; i < end; i++) {
    const q = questionList[i];
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = (userProgress[q]?.completed ? "✓ " : "") + q;
    grp.appendChild(opt);
  }
  debugJumpSelect.appendChild(grp);
}

function buildDebugPanel() {
  if (!isDebugMode() || !debugPanel || !debugJumpSelect) return;
  if (questionList.length === 0) return;
  debugPanel.classList.remove("hidden");
  debugJumpSelect.innerHTML = "";
  const { pretestEnd, posttestStart } = getSessionBoundaries();

  // Pretest
  addDebugOptgroup("Pretest", 0, pretestEnd);

  // Main session — group by category prefix (strip trailing digits)
  const seenCats = [];
  const catMap = {};
  for (let i = pretestEnd; i < posttestStart; i++) {
    const q = questionList[i];
    const cat = q.replace(/\d+$/, "");
    if (!catMap[cat]) { catMap[cat] = []; seenCats.push(cat); }
    catMap[cat].push(i);
  }
  seenCats.forEach(cat => {
    const grp = document.createElement("optgroup");
    grp.label = "Main – " + cat;
    catMap[cat].forEach(absIdx => {
      const q = questionList[absIdx];
      const opt = document.createElement("option");
      opt.value = absIdx;
      opt.textContent = (userProgress[q]?.completed ? "✓ " : "") + q;
      grp.appendChild(opt);
    });
    debugJumpSelect.appendChild(grp);
  });

  // Posttest
  addDebugOptgroup("Posttest", posttestStart, questionList.length);

  debugJumpSelect.value = String(currentQuestionIndex);
}

function syncDebugPanel() {
  if (!isDebugMode() || !debugJumpSelect || questionList.length === 0) return;
  Array.from(debugJumpSelect.options).forEach(opt => {
    const idx = parseInt(opt.value, 10);
    if (isNaN(idx) || !questionList[idx]) return;
    const q = questionList[idx];
    const base = opt.textContent.replace(/^✓ /, "");
    opt.textContent = (userProgress[q]?.completed ? "✓ " : "") + base;
  });
  debugJumpSelect.value = String(currentQuestionIndex);
}

// ── Mode UI setup ─────────────────────────────────────────
function updateModeUI() {
  const mode = getAppMode();
  // Version badge
  if (versionBadge) {
    if (mode === "v1") {
      versionBadge.textContent = "Version 1";
      versionBadge.className = "version-badge v1";
    } else if (mode === "v2") {
      versionBadge.textContent = "Version 2";
      versionBadge.className = "version-badge v2";
    } else if (mode === "review") {
      versionBadge.textContent = "REVIEW";
      versionBadge.className = "version-badge review";
    } else {
      versionBadge.className = "version-badge hidden";
    }
  }
  // Export PDF: debug only
  if (exportFeedbackPdfBtn) exportFeedbackPdfBtn.style.display = isDebugMode() ? "" : "none";
  // In debug mode, hide auth controls (no login)
  if (isDebugMode()) {
    if (userEmailEl) userEmailEl.style.display = "none";
    if (signOutButton) signOutButton.style.display = "none";
  }
  // In review mode, hide quiz progress UI
  if (mode === "review") {
    const progressSessions = document.querySelector(".progress-sessions");
    if (progressSessions) progressSessions.style.display = "none";
    const questionNavInfo = document.querySelector(".question-nav-info");
    if (questionNavInfo) questionNavInfo.style.display = "none";
    if (exportFeedbackPdfBtn) exportFeedbackPdfBtn.style.display = "none";
  }
}

// ── Review mode ────────────────────────────────────────────
async function renderReviewReport() {
  const reviewCard = document.getElementById("reviewCard");
  const reviewLoading = document.getElementById("reviewLoading");
  const reviewContent = document.getElementById("reviewContent");

  [questionCard, feedbackCard, transitionCard, completionCard].forEach((el) => el && el.classList.add("hidden"));
  if (reviewCard) reviewCard.classList.remove("hidden");

  try {
    const resp = await fetch("./questions/index.json");
    const indexData = await resp.json();
    const allQuestions = Array.isArray(indexData) ? indexData : indexData.questions;
    const reviewPosttestCount = Array.isArray(indexData) ? POSTTEST_COUNT : (indexData.posttestCount ?? POSTTEST_COUNT);

    const metas = {};
    await Promise.all(allQuestions.map(async (qid) => {
      try {
        const r = await fetch(`./questions/${qid}/meta.json`);
        if (r.ok) metas[qid] = await r.json();
      } catch {}
    }));

    const snap = await db.ref("users").once("value");
    const allUsers = snap.val() || {};
    const userEntries = Object.entries(allUsers);

    if (!userEntries.length) {
      reviewContent.innerHTML = "<p class='review-empty'>No student data found.</p>";
      reviewLoading.classList.add("hidden");
      reviewContent.classList.remove("hidden");
      return;
    }

    const n = allQuestions.length;
    const pretestEnd = Math.min(PRETEST_COUNT, n);
    const posttestStart = Math.max(pretestEnd, n - reviewPosttestCount);

    // Summary table
    let html = `<table class="review-summary">
      <thead><tr>
        <th>Student</th>
        <th>Pretest (${pretestEnd})</th>
        <th>Main (${posttestStart - pretestEnd})</th>
        <th>Posttest (${n - posttestStart})</th>
      </tr></thead><tbody>`;
    for (const [uid, user] of userEntries) {
      const email = user.email || uid;
      const prog = user.progress || {};
      const ptDone = allQuestions.slice(0, pretestEnd).filter((q) => prog[q]?.completed).length;
      const mainDone = allQuestions.slice(pretestEnd, posttestStart).filter((q) => prog[q]?.completed).length;
      const pstDone = allQuestions.slice(posttestStart).filter((q) => prog[q]?.completed).length;
      html += `<tr><td><a href="#ru-${uid}">${email}</a></td><td>${ptDone}/${pretestEnd}</td><td>${mainDone}/${posttestStart - pretestEnd}</td><td>${pstDone}/${n - posttestStart}</td></tr>`;
    }
    html += "</tbody></table>";

    // Per-user detail
    const sections = [
      { label: "Pretest", qs: allQuestions.slice(0, pretestEnd) },
      { label: "Main", qs: allQuestions.slice(pretestEnd, posttestStart) },
      { label: "Posttest", qs: allQuestions.slice(posttestStart) },
    ];

    for (const [uid, user] of userEntries) {
      const email = user.email || uid;
      const prog = user.progress || {};
      html += `<div class="review-user" id="ru-${uid}"><h3>${email}</h3>
        <table class="review-table"><thead><tr>
          <th>Question</th><th>Type</th><th>Answer given</th><th>Result</th>
        </tr></thead><tbody>`;

      for (const { label, qs } of sections) {
        html += `<tr class="review-section-row"><td colspan="4">${label}</td></tr>`;
        for (const qid of qs) {
          const p = prog[qid];
          const meta = metas[qid];
          if (!p?.completed) {
            html += `<tr><td>${qid}</td><td>—</td><td class="rv-skip">Not answered</td><td>—</td></tr>`;
            continue;
          }
          const type = meta?.question_type || "—";
          let ansStr = "—", resStr = "—", resCls = "";
          if (type === "open_ended") {
            ansStr = p.openEndedAnswer?.trim() ? p.openEndedAnswer.trim() : "<em>(blank)</em>";
          } else {
            const selected = p.selectedOptionIds || [];
            const correct = (meta?.options || []).filter((o) => o.answer === "Y").map((o) => o.id);
            if (!selected.length) {
              ansStr = "<em>(skipped)</em>";
              resStr = "Skipped";
              resCls = "rv-skip";
            } else {
              ansStr = selected.map((id) => String.fromCharCode(65 + id)).join(", ");
              const isCorrect = selected.length === correct.length && selected.every((id) => correct.includes(id));
              const correctLabel = correct.map((id) => String.fromCharCode(65 + id)).join(", ") || "—";
              resStr = isCorrect ? "✓ Correct" : `✗ (correct: ${correctLabel})`;
              resCls = isCorrect ? "rv-correct" : "rv-incorrect";
            }
          }
          html += `<tr><td>${qid}</td><td>${type}</td><td>${ansStr}</td><td class="${resCls}">${resStr}</td></tr>`;
        }
      }
      html += "</tbody></table></div>";
    }

    reviewContent.innerHTML = html;
    reviewLoading.classList.add("hidden");
    reviewContent.classList.remove("hidden");
  } catch (err) {
    if (reviewLoading) reviewLoading.textContent = "Error loading data: " + (err.message || err);
  }
}

async function startReviewMode() {
  initFirebase();
  trySignInWithEmailLink().then(() => {
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        appContent.classList.remove("hidden");
        authCard.classList.add("hidden");
        if (userEmailEl) userEmailEl.textContent = user.email || "";
        await renderReviewReport();
      } else {
        showAuth();
      }
    });
  });
}

async function loadQuestionList() {
  try {
    const response = await fetch(getIndexUrl());
    if (!response.ok) {
      throw new Error("Question index not found.");
    }
    const data = await response.json();
    const list = Array.isArray(data) ? data : data.questions;
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("Question index is empty.");
    }
    currentPosttestCount = Array.isArray(data) ? POSTTEST_COUNT : (data.posttestCount ?? POSTTEST_COUNT);
    questionList = list;
    updateProgressBar();
    buildDebugPanel();
    const firstIncomplete = list.findIndex((id) => !userProgress[id]?.completed);
    const resumeIndex = firstIncomplete === -1 ? list.length - 1 : firstIncomplete;
    loadQuestionAtIndex(resumeIndex);
  } catch (error) {
    showError(`${error.message} Check the question index file.`);
  }
}

function showError(message) {
  errorCard.textContent = message;
  errorCard.classList.remove("hidden");
}

function clearError() {
  errorCard.textContent = "";
  errorCard.classList.add("hidden");
}

function resetFeedback() {
  feedbackCard.classList.add("hidden");
  feedbackCard.classList.remove("no-feedback-content");
  feedbackText.textContent = "";
  correctAnswer.textContent = "";
  feedbackImageWrapper.classList.add("hidden");
  feedbackImage.removeAttribute("src");
  const optionFeedbacks = optionsGrid.querySelectorAll(".option-feedback");
  optionFeedbacks.forEach((item) => {
    item.textContent = "";
    item.classList.add("hidden");
  });
  const optionImages = optionsGrid.querySelectorAll(".option-card img");
  optionImages.forEach((img) => {
    const original = img.dataset.originalSrc;
    if (original) {
      img.src = original;
      img.classList.remove("hidden");
    } else {
      img.removeAttribute("src");
      img.classList.add("hidden");
    }
  });
  showingFeedbackImages = false;
  if (toggleImagesButton) {
    toggleImagesButton.classList.add("hidden");
    toggleImagesButton.textContent = "Show Feedback Images";
  }
  if (openEndedAnswer) {
    openEndedAnswer.value = "";
  }
}

function isOpenEndedQuestion(meta) {
  return meta?.question_type === "open_ended";
}

function isDisplayQuestion(meta) {
  return meta?.question_type === "display";
}

// ── Session timers (v1/v2 only) ───────────────────────────
function isTimedMode() {
  const m = getAppMode();
  return m === "v1" || m === "v2";
}

function getCurrentSessionName() {
  if (!questionList.length) return null;
  const { pretestEnd, posttestStart } = getSessionBoundaries();
  const i = currentQuestionIndex;
  if (i < pretestEnd) return "pretest";
  if (i < posttestStart) return "main";
  return "posttest";
}

function formatTime(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function stopSessionTimer() {
  if (sessionTimerInterval !== null) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }
  activeTimerSession = null;
  if (sessionTimerEl) sessionTimerEl.classList.add("hidden");
}

function onTimerExpired(session) {
  stopSessionTimer();
  const { pretestEnd, posttestStart } = getSessionBoundaries();
  let nextIndex;
  if (session === "pretest") {
    nextIndex = pretestEnd;
  } else if (session === "main") {
    nextIndex = posttestStart;
  } else {
    return; // posttest end — nothing to advance to
  }
  if (nextIndex < questionList.length) {
    if (questionCard) questionCard.classList.add("hidden");
    if (feedbackCard) feedbackCard.classList.add("hidden");
    showTransitionToNextSession(nextIndex);
  }
}

function startSessionTimer(session) {
  if (activeTimerSession === session && sessionTimerInterval !== null) return;

  if (sessionTimerInterval !== null) {
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
  }

  if (!sessionTimerEndMs[session]) {
    sessionTimerEndMs[session] = Date.now() + SESSION_DURATIONS_MS[session];
  }

  activeTimerSession = session;
  if (sessionTimerEl) sessionTimerEl.classList.remove("hidden");

  function tick() {
    const remaining = sessionTimerEndMs[session] - Date.now();
    if (sessionTimerDisplayEl) sessionTimerDisplayEl.textContent = formatTime(remaining);
    if (sessionTimerEl) sessionTimerEl.classList.toggle("timer-warning", remaining < 60 * 1000);
    if (remaining <= 0) {
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
      onTimerExpired(session);
    }
  }
  tick();
  sessionTimerInterval = setInterval(tick, 1000);
}

function updateSessionTimer() {
  if (!isTimedMode()) return;
  const session = getCurrentSessionName();
  if (session) startSessionTimer(session);
}

function setSubmitting(state) {
  isSubmitting = state;
  submitButton.disabled = state;
  submitButton.textContent = state ? "Checking..." : "Submit Answer";
}

function renderQuestion(meta, folder) {
  questionStem.innerHTML = "";
  if (meta.stem?.text) {
    const stemText = document.createElement("h2");
    stemText.textContent = meta.stem.text;
    questionStem.appendChild(stemText);
  }
  if (meta.stem?.image) {
    const stemImage = document.createElement("img");
    stemImage.src = `./questions/${folder}/${meta.stem.image}?v=${IMAGE_V}`;
    stemImage.alt = meta.stem.image;
    stemImage.onerror = function () {
      this.title = "Image failed to load. Use a local server (e.g. python -m http.server 8000) from the project folder.";
    };
    questionStem.appendChild(stemImage);
  }
  if (!meta.stem?.text && !meta.stem?.image) {
    const stemText = document.createElement("h2");
    stemText.textContent = "Untitled question";
    questionStem.appendChild(stemText);
  }
  optionsGrid.innerHTML = "";
  resetFeedback();

  if (isDisplayQuestion(meta)) {
    optionsGrid.classList.add("hidden");
    openEndedContainer.classList.add("hidden");
    if (mcqHint) mcqHint.classList.add("hidden");
    if (toggleImagesButton) toggleImagesButton.classList.add("hidden");
    if (submitButton) submitButton.classList.add("hidden");
    if (dontKnowButton) dontKnowButton.classList.add("hidden");
    if (nextQuestionInCard) nextQuestionInCard.classList.remove("hidden");
  } else if (isOpenEndedQuestion(meta)) {
    optionsGrid.classList.add("hidden");
    openEndedContainer.classList.remove("hidden");
    if (mcqHint) {
      mcqHint.classList.add("hidden");
    }
    if (toggleImagesButton) {
      toggleImagesButton.classList.add("hidden");
    }
  } else {
    optionsGrid.classList.remove("hidden");
    optionsGrid.classList.remove("options-disabled");
    optionsGrid.classList.toggle("options-4", meta.options.length === 4);
    openEndedContainer.classList.add("hidden");
    if (mcqHint) {
      mcqHint.classList.remove("hidden");
    }
    if (toggleImagesButton) {
      toggleImagesButton.classList.add("hidden");
    }

    meta.options.forEach((optionData, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const wrapper = document.createElement("label");
      wrapper.className = "option-card";

      const label = document.createElement("div");
      label.className = "option-label";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.name = "answer";
      checkbox.value = optionData.id;
      label.appendChild(checkbox);

      const labelText = document.createElement("span");
      labelText.textContent = letter;
      label.appendChild(labelText);

      wrapper.appendChild(label);
      if (optionData.text) {
        const text = document.createElement("div");
        text.className = "option-text";
        text.textContent = optionData.text;
        wrapper.appendChild(text);
      }
      if (optionData.image) {
        const img = document.createElement("img");
        img.src = `./questions/${folder}/${optionData.image}?v=${IMAGE_V}`;
        img.alt = optionData.image ?? `Option ${idx + 1}`;
        img.dataset.originalSrc = img.src;
        img.dataset.hasOriginal = "true";
        const fallbackFeedback =
          optionData.image?.replace(".jpg", "_feedback.jpg") ?? null;
        img.dataset.feedbackSrc = optionData.feedback?.image
          ? `./questions/${folder}/${optionData.feedback.image}?v=${IMAGE_V}`
          : fallbackFeedback
          ? `./questions/${folder}/${fallbackFeedback}?v=${IMAGE_V}`
          : "";
        wrapper.appendChild(img);
      }
      const feedback = document.createElement("div");
      feedback.className = "option-feedback";
      feedback.textContent = "";
      wrapper.appendChild(feedback);
      optionsGrid.appendChild(wrapper);
    });
  }

  questionCard.classList.remove("hidden");
  restoreSavedProgress();
}

function restoreSavedProgress() {
  if (!currentFolder || !userProgress[currentFolder]) return;
  const saved = userProgress[currentFolder];
  if (isOpenEndedQuestion(currentMeta)) {
    if (saved.openEndedAnswer != null && openEndedAnswer) {
      openEndedAnswer.value = saved.openEndedAnswer;
    }
  } else {
    const ids = saved.selectedOptionIds;
    if (Array.isArray(ids)) {
      document.querySelectorAll("input[name=\"answer\"]").forEach((input) => {
        input.checked = ids.includes(Number(input.value));
      });
    }
  }
}

function findCorrectOptions(meta) {
  return meta.options.filter((opt) => opt.answer === "Y");
}

function getSelectedOptionIds() {
  const checked = Array.from(
    document.querySelectorAll("input[name=\"answer\"]:checked")
  );
  return checked.map((item) => Number(item.value));
}

function markOptions(selectedIds) {
  const optionCards = optionsGrid.querySelectorAll(".option-card");
  optionCards.forEach((card, index) => {
    const option = currentMeta.options[index];
    const isCorrect = option.answer === "Y";
    card.classList.toggle("correct", isCorrect);
    card.classList.toggle(
      "incorrect",
      selectedIds.includes(option.id) && !isCorrect
    );
    const feedback = card.querySelector(".option-feedback");
    if (feedback) {
      feedback.textContent = option.feedback?.text ?? "";
      feedback.classList.toggle("hidden", !feedback.textContent);
    }
  });
}

function toggleOptionImages() {
  const optionImages = optionsGrid.querySelectorAll(".option-card img");
  optionImages.forEach((img) => {
    const original = img.dataset.originalSrc;
    const feedback = img.dataset.feedbackSrc;
    if (!feedback) {
      return;
    }
    if (showingFeedbackImages) {
      if (original) {
        img.src = original;
        img.classList.remove("hidden");
      } else {
        img.removeAttribute("src");
        img.classList.add("hidden");
      }
    } else {
      img.src = feedback;
      img.classList.remove("hidden");
    }
  });
  showingFeedbackImages = !showingFeedbackImages;
  if (toggleImagesButton) {
    toggleImagesButton.textContent = showingFeedbackImages
      ? "Show Original Images"
      : "Show Feedback Images";
  }
}

function showFeedback(selectedIds) {
  if (isPretestOrPosttest()) {
    feedbackText.textContent = "";
    correctAnswer.textContent = "";
    feedbackImageWrapper.classList.add("hidden");
    feedbackImage.removeAttribute("src");
    feedbackCard.classList.add("no-feedback-content");
  } else {
    feedbackCard.classList.remove("no-feedback-content");
    const correctOptions = findCorrectOptions(currentMeta);
    const correctIds = new Set(correctOptions.map((opt) => opt.id));
    const selectedSet = new Set(selectedIds);
    const correctIndexes = correctOptions
      .map((opt) => currentMeta.options.findIndex((item) => item.id === opt.id))
      .filter((index) => index >= 0);
    const isCorrect =
      correctIds.size === 0
        ? true
        : correctIds.size === selectedSet.size &&
          [...correctIds].every((id) => selectedSet.has(id));

    if (!isCorrect) {
      const correctLabel =
        correctIndexes.length === 0
          ? "No correct options."
          : `The correct answer is ${correctIndexes
              .map((index) => String.fromCharCode(65 + index))
              .join(", ")}.`;
      feedbackText.textContent = `Your answer is incorrect. ${correctLabel}`;
    } else {
      feedbackText.textContent = "Your answer is correct.";
    }
    correctAnswer.textContent = "";

    const hasGeneralFeedback =
      Boolean(currentMeta.feedback?.text) || Boolean(currentMeta.feedback?.image);
    if (hasGeneralFeedback) {
      let feedbackImageName = currentMeta.feedback?.image ?? null;
      if (!feedbackImageName) {
        const selectedWithImage = currentMeta.options.find(
          (opt) => selectedSet.has(opt.id) && opt.feedback?.image
        );
        feedbackImageName = selectedWithImage?.feedback?.image ?? null;
      }
      if (feedbackImageName) {
        feedbackImage.src = `./questions/${currentFolder}/${feedbackImageName}?v=${IMAGE_V}`;
        feedbackImageWrapper.classList.remove("hidden");
      } else {
        feedbackImageWrapper.classList.add("hidden");
        feedbackImage.removeAttribute("src");
      }
    } else {
      feedbackImageWrapper.classList.add("hidden");
      feedbackImage.removeAttribute("src");
    }
  }

  feedbackCard.classList.remove("hidden");

  optionsGrid.classList.add("options-disabled");
  optionsGrid.querySelectorAll("input[name=\"answer\"]").forEach((input) => {
    input.disabled = true;
  });
  if (submitButton) submitButton.classList.add("hidden");
  if (nextQuestionInCard) nextQuestionInCard.classList.remove("hidden");

  userProgress[currentFolder] = { ...userProgress[currentFolder], completed: true, selectedOptionIds: selectedIds };
  updateProgressBar();
  updatePrevNextVisibility();

  const user = getCurrentUser();
  if (user && currentFolder) {
    saveProgress(user.uid, currentFolder, {
      completed: true,
      selectedOptionIds: selectedIds,
    }).catch((e) => console.warn("Firebase save failed", e));
  }

  if (!isPretestOrPosttest() && toggleImagesButton) {
    const optionCards = optionsGrid.querySelectorAll(".option-card");
    let hasFeedback = false;
    optionCards.forEach((card, index) => {
      const option = currentMeta.options[index];
      const feedbackName = option.feedback?.image ?? null;
      if (!feedbackName) {
        return;
      }
      const feedbackSrc = `./questions/${currentFolder}/${feedbackName}?v=${IMAGE_V}`;
      let img = card.querySelector("img");
      if (!img) {
        img = document.createElement("img");
        img.dataset.originalSrc = "";
        img.dataset.hasOriginal = "false";
        card.appendChild(img);
      }
      img.dataset.feedbackSrc = feedbackSrc;
      img.src = feedbackSrc;
      img.classList.remove("hidden");
      hasFeedback = true;
    });
    showingFeedbackImages = true;
    toggleImagesButton.textContent = "Show Original Images";
    toggleImagesButton.classList.toggle("hidden", !hasFeedback);
  }
  updateProgressBar();
  updatePrevNextVisibility();
}

async function gradeOpenEnded(answer) {
  if (isSubmitting) {
    return;
  }
  setSubmitting(true);
  try {
    const apiKey = window.OPENAI_CONFIG?.apiKey;
    if (!apiKey) throw new Error("OpenAI API key not configured.");
    const model = window.OPENAI_CONFIG?.model || "gpt-4o-mini";
    const rubric = currentMeta?.rubric ?? [];
    const stemText = currentMeta?.stem?.text || "";
    const rubricLines = rubric.length ? rubric.map((r) => `- ${r}`).join("\n") : "- (none)";
    const systemPrompt = "You are a strict grader. For each rubric item, decide whether the student's answer correctly mentions and addresses it. Return JSON with two keys: \"verdict\" (\"pass\" if every rubric item is addressed correctly, otherwise \"fail\"), and \"missing\" (array of rubric item strings that were not addressed or were incorrect — empty array if verdict is pass).";
    const userPrompt = `Question: ${stemText}\n\nRubric items:\n${rubricLines}\n\nStudent answer:\n${answer}\n\nRespond with JSON only.`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0,
      }),
    });
    if (!response.ok) {
      throw new Error("Unable to grade the answer.");
    }
    const raw = await response.json();
    const content = raw.choices?.[0]?.message?.content || "";
    let result;
    try { result = JSON.parse(content); } catch { result = {}; }
    if (isPretestOrPosttest()) {
      correctAnswer.textContent = "";
      feedbackText.textContent = "";
      feedbackImageWrapper.classList.add("hidden");
      feedbackImage.removeAttribute("src");
      feedbackCard.classList.add("no-feedback-content");
    } else {
      feedbackCard.classList.remove("no-feedback-content");
      const verdictRaw =
        typeof result.verdict === "string" ? result.verdict.toLowerCase() : "";
      const isCorrect = verdictRaw === "pass";
      correctAnswer.textContent = "";
      if (isCorrect) {
        feedbackText.textContent = "Your response is correct.";
        feedbackImageWrapper.classList.add("hidden");
        feedbackImage.removeAttribute("src");
      } else {
        const missing = Array.isArray(result.missing) && result.missing.length
          ? result.missing
          : rubric;
        let msg;
        if (missing.length === 1) {
          msg = `Your response is incorrect — you did not mention ${missing[0]}.`;
        } else {
          const last = missing[missing.length - 1];
          const rest = missing.slice(0, -1).join(", ");
          msg = `Your response is incorrect — you did not mention ${rest} and ${last}.`;
        }
        feedbackText.textContent = msg;
        if (currentMeta?.feedback?.image) {
          feedbackImage.src = `./questions/${currentFolder}/${currentMeta.feedback.image}?v=${IMAGE_V}`;
          feedbackImageWrapper.classList.remove("hidden");
        } else {
          feedbackImageWrapper.classList.add("hidden");
          feedbackImage.removeAttribute("src");
        }
      }
    }

    feedbackCard.classList.remove("hidden");

    userProgress[currentFolder] = { ...userProgress[currentFolder], completed: true, openEndedAnswer: answer };
    updateProgressBar();
    updatePrevNextVisibility();

    const user = getCurrentUser();
    if (user && currentFolder) {
      saveProgress(user.uid, currentFolder, {
        completed: true,
        openEndedAnswer: answer,
      }).catch((e) => console.warn("Firebase save failed", e));
    }
  } catch (error) {
    showError(error.message);
  } finally {
    setSubmitting(false);
  }
}

async function loadQuestionByFolder(folder) {
  if (!folder) return;
  clearError();
  resetFeedback();
  if (transitionCard) transitionCard.classList.add("hidden");
  if (submitButton) submitButton.classList.remove("hidden");
  if (nextQuestionInCard) nextQuestionInCard.classList.add("hidden");
  try {
    const cacheBuster = Date.now();
    const response = await fetch(
      `./questions/${folder}/meta.json?cache=${cacheBuster}`
    );
    if (!response.ok) {
      throw new Error(`Unable to load ${folder}/meta.json`);
    }
    const meta = await response.json();
    if (isOpenEndedQuestion(meta)) {
      if (!Array.isArray(meta?.rubric) || meta.rubric.length === 0) {
        throw new Error(`${folder}/meta.json has no rubric.`);
      }
    } else if (!isDisplayQuestion(meta) && !meta?.options?.length) {
      throw new Error(`${folder}/meta.json has no options.`);
    }
    currentMeta = meta;
    currentFolder = folder;
    renderQuestion(meta, folder);
    if (isDisplayQuestion(meta)) {
      userProgress[folder] = { ...userProgress[folder], completed: true };
      updateProgressBar();
      updatePrevNextVisibility();
      const user = getCurrentUser();
      if (user) {
        saveProgress(user.uid, folder, { completed: true }).catch((e) => console.warn("Firebase save failed", e));
      }
    }
  } catch (error) {
    showError(error.message);
    throw error;
  }
}

function updateQuestionPosition() {
  if (!questionPositionEl || questionList.length === 0) return;
  const { pretestEnd, mainEnd, posttestStart } = getSessionBoundaries();
  const i = currentQuestionIndex;
  let pos, total, label;
  if (i < pretestEnd) {
    pos = i + 1;
    total = pretestEnd;
    label = "pretest questions";
  } else if (i < posttestStart) {
    pos = i - pretestEnd + 1;
    total = mainEnd - pretestEnd;
    label = "main session questions";
  } else {
    pos = i - posttestStart + 1;
    total = questionList.length - posttestStart;
    label = "posttest questions";
  }
  questionPositionEl.textContent = `Question ${pos} of ${total} ${label}`;
}

function updatePrevNextVisibility() {
  const hasNext = currentQuestionIndex < questionList.length - 1;
  if (nextButton) nextButton.style.display = hasNext ? "" : "none";
  if (nextQuestionInCard) nextQuestionInCard.style.display = hasNext ? "" : "none";
}

function updateDontKnowVisibility() {
  if (dontKnowButton) {
    dontKnowButton.classList.add("hidden");
  }
}

async function loadQuestionAtIndex(i) {
  if (i < 0 || i >= questionList.length) return;
  currentQuestionIndex = i;
  const folder = questionList[i];
  await loadQuestionByFolder(folder);
  updateQuestionPosition();
  updateProgressBar();
  updatePrevNextVisibility();
  updateDontKnowVisibility();
  updateSessionTimer();
  if (debugJumpSelect) debugJumpSelect.value = String(i);
}

function showCompletion() {
  [questionCard, feedbackCard, transitionCard, errorCard].forEach((el) => el && el.classList.add("hidden"));
  if (completionCard) completionCard.classList.remove("hidden");
  stopSessionTimer();
}

function goToNextQuestion() {
  const nextIndex = currentQuestionIndex + 1;
  if (nextIndex >= questionList.length) { showCompletion(); return; }
  if (showTransitionToNextSession(nextIndex)) return;
  loadQuestionAtIndex(nextIndex);
}

function loadQuestion() {
  if (questionList.length > 0) {
    loadQuestionAtIndex(currentQuestionIndex);
  } else if (questionSelect && questionSelect.value) {
    loadQuestionByFolder(questionSelect.value);
  }
}

if (loadButton) loadButton.addEventListener("click", loadQuestion);

if (nextButton) {
  nextButton.addEventListener("click", goToNextQuestion);
}
if (nextQuestionInCard) {
  nextQuestionInCard.addEventListener("click", goToNextQuestion);
}

if (transitionContinueBtn) {
  transitionContinueBtn.addEventListener("click", () => {
    if (transitionCard) transitionCard.classList.add("hidden");
    if (questionCard) questionCard.classList.remove("hidden");
    loadQuestionAtIndex(transitionNextIndex);
  });
}

function openLightbox(imgSrc) {
  if (!lightboxImage || !imageLightbox) return;
  lightboxImage.src = imgSrc;
  imageLightbox.classList.remove("hidden");
  imageLightbox.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (!imageLightbox) return;
  imageLightbox.classList.add("hidden");
  imageLightbox.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

document.body.addEventListener("click", (e) => {
  if (e.target.tagName !== "IMG") return;
  const img = e.target;
  if (!img.src) return;
  if (imageLightbox && imageLightbox.contains(img)) return;
  if (img.id === "lightboxImage") return;
  e.preventDefault();
  openLightbox(img.src);
});

if (imageLightbox) {
  imageLightbox.addEventListener("click", (e) => {
    if (e.target === imageLightbox || e.target === lightboxClose) closeLightbox();
  });
}
if (lightboxImage) {
  lightboxImage.addEventListener("click", (e) => e.stopPropagation());
}
if (lightboxClose) {
  lightboxClose.addEventListener("click", closeLightbox);
}
if (feedbackImage) {
  feedbackImage.addEventListener("click", () => {
    if (feedbackImage.src) openLightbox(feedbackImage.src);
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageLightbox && !imageLightbox.classList.contains("hidden")) {
    closeLightbox();
  }
});

// Debug jump
if (debugJumpGoBtn && debugJumpSelect) {
  debugJumpGoBtn.addEventListener("click", () => {
    const idx = parseInt(debugJumpSelect.value, 10);
    if (!isNaN(idx) && idx >= 0 && idx < questionList.length) {
      loadQuestionAtIndex(idx);
    }
  });
  // Also jump on Enter key inside select
  debugJumpSelect.addEventListener("keydown", (e) => {
    if (e.key === "Enter") debugJumpGoBtn.click();
  });
}

submitButton.addEventListener("click", async () => {
  if (isOpenEndedQuestion(currentMeta)) {
    const answer = openEndedAnswer.value.trim();
    if (!answer) {
      showError("Enter your answer before submitting.");
      return;
    }
    clearError();
    if (isPretestOrPosttest()) {
      const payload = { completed: true, openEndedAnswer: answer };
      userProgress[currentFolder] = { ...userProgress[currentFolder], ...payload };
      updateProgressBar();
      const user = getCurrentUser();
      if (user) saveProgress(user.uid, currentFolder, payload).catch((e) => console.warn("Firebase save failed", e));
      goToNextQuestion();
      return;
    }
    await gradeOpenEnded(answer);
    return;
  }

  const selectedIds = getSelectedOptionIds();
  clearError();
  if (isPretestOrPosttest()) {
    const payload = { completed: true, selectedOptionIds: selectedIds };
    userProgress[currentFolder] = { ...userProgress[currentFolder], ...payload };
    updateProgressBar();
    const user = getCurrentUser();
    if (user) saveProgress(user.uid, currentFolder, payload).catch((e) => console.warn("Firebase save failed", e));
    goToNextQuestion();
    return;
  }
  markOptions(selectedIds);
  showFeedback(selectedIds);
});

if (dontKnowButton) {
  dontKnowButton.addEventListener("click", async () => {
    if (!currentFolder || !questionList.length) return;
    const payload = currentMeta && isOpenEndedQuestion(currentMeta)
      ? { completed: true, openEndedAnswer: "" }
      : { completed: true, selectedOptionIds: [] };
    userProgress[currentFolder] = { ...userProgress[currentFolder], ...payload };
    updateProgressBar();
    updatePrevNextVisibility();
    const user = getCurrentUser();
    if (user) {
      saveProgress(user.uid, currentFolder, payload).catch((e) => console.warn("Firebase save failed", e));
    }
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questionList.length) {
      feedbackCard.classList.add("hidden");
      questionCard.classList.remove("hidden");
      if (showTransitionToNextSession(nextIndex)) return;
      try {
        await loadQuestionAtIndex(nextIndex);
      } catch (err) {
        showError(err && err.message ? err.message : "Failed to load next question.");
      }
    } else {
      showCompletion();
    }
  });
}

if (toggleImagesButton) {
  toggleImagesButton.addEventListener("click", () => {
    toggleOptionImages();
  });
}

function hideAuthLinkFallback() {
  if (authLinkFallback) authLinkFallback.classList.add("hidden");
}

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const rawEmail = (authEmail && authEmail.value) ? authEmail.value.trim() : "";
  const email = rawEmail.toLowerCase();
  showAuthError("");
  showAuthSuccess("");
  hideAuthLinkFallback();
  if (!rawEmail) {
    showAuthError("Enter your email.");
    return;
  }
  authSubmit.disabled = true;
  try {
    // 1) Same device: try sign in with stored password
    const storedPw = getStoredPassword(email);
    if (storedPw) {
      try {
        await firebase.auth().signInWithEmailAndPassword(email, storedPw);
        return;
      } catch (err) {
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          clearStoredPassword(email);
        } else {
          showAuthError(err.message || "Sign in failed.");
          authSubmit.disabled = false;
          return;
        }
      }
    }

    // 2) Try to create new account
    const password = randomPassword();
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      setStoredPassword(email, password);
      await savePasswordToDb(email, password);
      await ensureUserProfile(cred.user.uid, email);
      showAppForUser(cred.user);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        // 3) Existing user on new device — look up password from DB and sign in directly
        const dbPw = await getPasswordFromDb(email);
        if (dbPw) {
          try {
            await firebase.auth().signInWithEmailAndPassword(email, dbPw);
            setStoredPassword(email, dbPw);
          } catch (signInErr) {
            showAuthError(signInErr.message || "Sign in failed.");
          }
        } else {
          // Old account without DB password — fall back to email link
          if (authLinkFallback) authLinkFallback.classList.remove("hidden");
          showAuthSuccess("This email is registered on another device. Use “Send sign-in link” to access your account.");
        }
      } else {
        showAuthError(err.message || "Sign up failed.");
      }
    }
  } finally {
    authSubmit.disabled = false;
  }
});

if (sendLinkBtn) {
  sendLinkBtn.addEventListener("click", async () => {
    const email = (authEmail && authEmail.value) ? authEmail.value.trim().toLowerCase() : "";
    if (!email) {
      showAuthError("Enter your email first.");
      return;
    }
    const actionUrl = getEmailLinkActionUrl();
    if (!actionUrl || actionUrl.startsWith("file://") || actionUrl.startsWith("null")) {
      showAuthError("Open the app from a web server (e.g. http://localhost:8000), not by opening the file directly.");
      return;
    }
    sendLinkBtn.disabled = true;
    showAuthError("");
    try {
      await firebase.auth().sendSignInLinkToEmail(email, { url: actionUrl, handleCodeInApp: true });
      window.localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
      showAuthSuccess("Check your email for the sign-in link. Click it to sign in.");
      hideAuthLinkFallback();
    } catch (err) {
      showAuthError(err.code === "auth/configuration-not-found"
        ? "Email link not set up in Firebase Console. Enable Email/Password and Email link, and add this domain to Authorized domains."
        : (err.message || "Failed to send link."));
    } finally {
      sendLinkBtn.disabled = false;
    }
  });
}

function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fetch image from same-origin URL and return as data URL so it is embedded in export and shows in PDF. */
async function fetchImageAsDataUrl(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const blob = await r.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return null;
  }
}

async function openExportFeedbackHtml() {
  let list;
  try {
    const r = await fetch(getIndexUrl());
    if (!r.ok) throw new Error("Failed to load index");
    list = await r.json();
    if (!Array.isArray(list) || list.length === 0) throw new Error("Empty index");
  } catch (e) {
    showError(e.message || "Failed to load question list.");
    return;
  }
  const questionsBase = new URL("./questions/", window.location.href).href;
  const sections = [];
  for (let i = 0; i < list.length; i++) {
    const qid = list[i];
    let meta;
    try {
      const r = await fetch(`./questions/${qid}/meta.json`);
      if (!r.ok) throw new Error("Missing");
      meta = await r.json();
    } catch (_) {
      sections.push(`<section class="q-block"><h2>Question ${i + 1}: ${escHtml(qid)}</h2><p>No meta.json found.</p></section>`);
      continue;
    }
    const stem = meta.stem || {};
    const stemText = stem.text || "(No stem text)";
    const stemImage = stem.image;
    const parts = [`<h2>Question ${i + 1}: ${escHtml(qid)}</h2>`, `<p class="stem">${escHtml(stemText)}</p>`];
    if (stemImage) {
      const stemSrc = `${questionsBase}${encodeURIComponent(qid)}/${encodeURIComponent(stemImage)}`;
      const stemDataUrl = await fetchImageAsDataUrl(stemSrc);
      parts.push(`<img src="${stemDataUrl || stemSrc}" alt="Stem" class="thumb" />`);
    }
    if (meta.question_type === "open_ended") {
      const rubric = meta.rubric || [];
      parts.push("<p class=\"rubric\"><strong>Rubric:</strong> " + escHtml(rubric.join(", ")) + "</p>");
      const fb = (meta.feedback || {}).text || "";
      if (fb) parts.push(`<pre class="feedback">${escHtml(fb)}</pre>`);
    } else {
      const options = meta.options || [];
      for (let j = 0; j < options.length; j++) {
        const opt = options[j];
        const letter = String.fromCharCode(65 + j);
        const correct = (opt.answer || "").toUpperCase() === "Y";
        const optText = opt.text || opt.image || "(image option)";
        parts.push(`<div class="option"><strong>Option ${letter}</strong> (${correct ? "Correct" : "Incorrect"}): ${escHtml(String(optText))}</div>`);
        if (opt.image) {
          const optSrc = `${questionsBase}${encodeURIComponent(qid)}/${encodeURIComponent(opt.image)}`;
          const optDataUrl = await fetchImageAsDataUrl(optSrc);
          parts.push(`<img src="${optDataUrl || optSrc}" alt="Option ${letter}" class="thumb" />`);
        }
        const fb = (opt.feedback || {}).text;
        if (fb) parts.push(`<pre class="feedback option-feedback">${escHtml(fb)}</pre>`);
        const fbImg = (opt.feedback || {}).image;
        if (fbImg) {
          const fbSrc = `${questionsBase}${encodeURIComponent(qid)}/${encodeURIComponent(fbImg)}`;
          const fbDataUrl = await fetchImageAsDataUrl(fbSrc);
          parts.push(`<img src="${fbDataUrl || fbSrc}" alt="Feedback ${letter}" class="thumb" />`);
        }
      }
      const overall = (meta.feedback || {}).text;
      if (overall) parts.push(`<pre class="feedback overall">${escHtml(overall)}</pre>`);
    }
    sections.push("<section class=\"q-block\">" + parts.join("\n") + "</section>");
  }
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>All question feedback</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1b1d21; background: #fff; }
    .print-note { margin-bottom: 24px; padding: 12px 16px; background: #e8eaef; border-radius: 8px; font-size: 14px; }
    .print-note strong { display: block; margin-bottom: 4px; }
    .q-block { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e8eaef; page-break-inside: avoid; }
    .q-block h2 { font-size: 1.1rem; margin: 0 0 8px; color: #2f5bea; }
    .stem { margin: 0 0 12px; font-size: 15px; line-height: 1.5; }
    .stem-img { margin: 0 0 8px; font-size: 13px; color: #6b7280; }
    .rubric { margin: 8px 0; font-size: 14px; color: #4a4f57; }
    .option { margin: 8px 0 4px; font-size: 14px; }
    .feedback { white-space: pre-wrap; font-size: 13px; margin: 4px 0 12px; padding: 10px; background: #f8f9fc; border-radius: 6px; border-left: 3px solid #2f5bea; }
    .option-feedback { margin-left: 16px; }
    .thumb { max-width: 180px; height: auto; display: block; margin: 4px 0 8px; border-radius: 6px; }
    @media print { body { padding: 16px; } .print-note { background: #f0f0f0; } }
  </style>
</head>
<body>
  <div class="print-note">
    <strong>Export to PDF</strong>
    Use your browser's Print dialog (Ctrl+P / Cmd+P) and choose <strong>Save as PDF</strong> or <strong>Print to PDF</strong>.
  </div>
  <h1>All question feedback</h1>
  ${sections.join("\n")}
</body>
</html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  } else {
    showError("Allow pop-ups to open the feedback page, then use Print → Save as PDF.");
  }
}

if (exportFeedbackPdfBtn) {
  exportFeedbackPdfBtn.addEventListener("click", () => {
    clearError();
    openExportFeedbackHtml();
  });
}

signOutButton.addEventListener("click", () => {
  firebase.auth().signOut();
});

function startApp() {
  updateModeUI();

  if (isDebugMode()) {
    // Debug mode: no auth, load all questions directly
    if (isFirebaseEnabled()) initFirebase();
    appContent.classList.remove("hidden");
    authCard.classList.add("hidden");
    loadQuestionList();
    return;
  }

  if (getAppMode() === "review") {
    startReviewMode();
    return;
  }

  // Deploy mode (v1 / v2): require Firebase auth
  if (isFirebaseEnabled()) {
    initFirebase();
    trySignInWithEmailLink().then(() => {
      firebase.auth().onAuthStateChanged((user) => {
        if (user) {
          ensureUserProfile(user.uid, user.email).then(() => {
            showAppForUser(user);
          });
        } else {
          showAuth();
        }
      });
    });
  } else {
    // Firebase not configured — fallback (no auth, no sync)
    appContent.classList.remove("hidden");
    authCard.classList.add("hidden");
    const headerUser = document.querySelector(".header-user");
    if (headerUser) headerUser.style.display = "none";
    loadQuestionList();
  }
}

startApp();
