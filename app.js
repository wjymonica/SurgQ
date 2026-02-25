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
const resetButton = document.getElementById("resetAnswer");
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
const signOutButton = document.getElementById("signOut");
const progressPretestCount = document.getElementById("progressPretestCount");
const progressPretestFill = document.getElementById("progressPretestFill");
const progressMainCount = document.getElementById("progressMainCount");
const progressMainFill = document.getElementById("progressMainFill");
const progressPosttestCount = document.getElementById("progressPosttestCount");
const progressPosttestFill = document.getElementById("progressPosttestFill");
const questionPositionEl = document.getElementById("questionPosition");
const prevButton = document.getElementById("prevQuestion");
const nextButton = document.getElementById("nextQuestion");
const imageLightbox = document.getElementById("imageLightbox");
const lightboxImage = document.getElementById("lightboxImage");
const lightboxClose = document.getElementById("lightboxClose");

const EMAIL_LINK_STORAGE_KEY = "surgQ_emailForSignIn";
const PRETEST_COUNT = 8;
const POSTTEST_COUNT = 8;
const PASSWORD_STORAGE_PREFIX = "surgQ_pw_";

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

let currentMeta = null;
let currentFolder = null;
let currentQuestionIndex = 0;
let questionList = []; // order from index.json
let isSubmitting = false;
let showingFeedbackImages = false;
let userProgress = {}; // { questionId: { completed, selectedOptionIds?, openEndedAnswer?, submittedAt? } }
let firebaseReady = false;
let db = null;

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
  if (!db || !uid) return;
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

function getSessionBoundaries() {
  const n = questionList.length;
  const pretestEnd = Math.min(PRETEST_COUNT, n);
  const mainEnd = Math.max(pretestEnd, n - POSTTEST_COUNT);
  return { pretestEnd, mainEnd, posttestStart: mainEnd };
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
}

async function loadQuestionList() {
  try {
    const response = await fetch("./questions/index.json");
    if (!response.ok) {
      throw new Error("questions/index.json not found.");
    }
    const list = await response.json();
    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("questions/index.json is empty.");
    }
    questionList = list;
    updateProgressBar();
    loadQuestionAtIndex(0);
  } catch (error) {
    showError(
      `${error.message} Add folder names to questions/index.json.`
    );
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
    stemImage.src = `./questions/${folder}/${meta.stem.image}`;
    stemImage.alt = meta.stem.image;
    questionStem.appendChild(stemImage);
  }
  if (!meta.stem?.text && !meta.stem?.image) {
    const stemText = document.createElement("h2");
    stemText.textContent = "Untitled question";
    questionStem.appendChild(stemText);
  }
  optionsGrid.innerHTML = "";
  resetFeedback();

  if (isOpenEndedQuestion(meta)) {
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
        img.src = `./questions/${folder}/${optionData.image}`;
        img.alt = optionData.image ?? `Option ${idx + 1}`;
        img.dataset.originalSrc = img.src;
        img.dataset.hasOriginal = "true";
        const fallbackFeedback =
          optionData.image?.replace(".jpg", "_feedback.jpg") ?? null;
        img.dataset.feedbackSrc = optionData.feedback?.image
          ? `./questions/${folder}/${optionData.feedback.image}`
          : fallbackFeedback
          ? `./questions/${folder}/${fallbackFeedback}`
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
    const correctLabel =
      correctIndexes.length === 0
        ? "No correct options."
        : `Correct answer: ${correctIndexes
            .map((index) => String.fromCharCode(65 + index))
            .join(", ")}`;

    feedbackText.textContent =
      currentMeta.feedback?.text ?? "General feedback not provided.";
    correctAnswer.textContent = correctLabel;

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
        feedbackImage.src = `./questions/${currentFolder}/${feedbackImageName}`;
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

  userProgress[currentFolder] = { ...userProgress[currentFolder], completed: true, selectedOptionIds: selectedIds };
  updateProgressBar();
  updatePrevNextVisibility();

  const user = getCurrentUser();
  if (user && currentFolder) {
    saveProgress(user.uid, currentFolder, {
      completed: true,
      selectedOptionIds: selectedIds,
    });
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
      const feedbackSrc = `./questions/${currentFolder}/${feedbackName}`;
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
    const response = await fetch(GRADE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answer,
        rubric: currentMeta?.rubric ?? [],
        stem: currentMeta?.stem ?? {},
      }),
    });
    if (!response.ok) {
      throw new Error("Unable to grade the answer.");
    }
    const result = await response.json();
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
      correctAnswer.textContent = isCorrect ? "Correct" : "Wrong";
      if (isCorrect) {
        feedbackText.textContent = result.reason ?? "Graded as correct.";
        feedbackImageWrapper.classList.add("hidden");
        feedbackImage.removeAttribute("src");
      } else {
        feedbackText.textContent =
          currentMeta?.feedback?.text ?? "Answer did not meet the rubric.";
        if (currentMeta?.feedback?.image) {
          feedbackImage.src = `./questions/${currentFolder}/${currentMeta.feedback.image}`;
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
      });
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
    } else if (!meta?.options?.length) {
      throw new Error(`${folder}/meta.json has no options.`);
    }
    currentMeta = meta;
    currentFolder = folder;
    renderQuestion(meta, folder);
  } catch (error) {
    showError(error.message);
    throw error;
  }
}

function updateQuestionPosition() {
  if (questionPositionEl && questionList.length > 0) {
    questionPositionEl.textContent = `Question ${currentQuestionIndex + 1} of ${questionList.length}`;
  }
}

function updatePrevNextVisibility() {
  if (prevButton) prevButton.style.display = currentQuestionIndex > 0 ? "" : "none";
  if (nextButton) nextButton.style.display = currentQuestionIndex < questionList.length - 1 ? "" : "none";
}

function updateDontKnowVisibility() {
  if (dontKnowButton) {
    if (isPretestOrPosttest()) {
      dontKnowButton.classList.remove("hidden");
    } else {
      dontKnowButton.classList.add("hidden");
    }
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
}

function loadQuestion() {
  if (questionList.length > 0) {
    loadQuestionAtIndex(currentQuestionIndex);
  } else if (questionSelect && questionSelect.value) {
    loadQuestionByFolder(questionSelect.value);
  }
}

if (loadButton) loadButton.addEventListener("click", loadQuestion);

if (prevButton) {
  prevButton.addEventListener("click", () => {
    loadQuestionAtIndex(currentQuestionIndex - 1);
  });
}
if (nextButton) {
  nextButton.addEventListener("click", () => {
    loadQuestionAtIndex(currentQuestionIndex + 1);
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
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && imageLightbox && !imageLightbox.classList.contains("hidden")) {
    closeLightbox();
  }
});

submitButton.addEventListener("click", async () => {
  if (isOpenEndedQuestion(currentMeta)) {
    const answer = openEndedAnswer.value.trim();
    if (!answer) {
      showError("Enter your answer before submitting.");
      return;
    }
    clearError();
    await gradeOpenEnded(answer);
    return;
  }

  const selectedIds = getSelectedOptionIds();
  if (selectedIds.length === 0) {
    showError("Select at least one option before submitting.");
    return;
  }
  clearError();
  if (!isPretestOrPosttest()) {
    markOptions(selectedIds);
  }
  showFeedback(selectedIds);
});

resetButton.addEventListener("click", () => {
  if (isOpenEndedQuestion(currentMeta)) {
    resetFeedback();
    return;
  }

  const checks = document.querySelectorAll("input[name=\"answer\"]");
  checks.forEach((check) => {
    check.checked = false;
  });
  const optionCards = optionsGrid.querySelectorAll(".option-card");
  optionCards.forEach((card) => {
    card.classList.remove("correct", "incorrect");
  });
  resetFeedback();
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
      saveProgress(user.uid, currentFolder, payload);
    }
    const nextIndex = currentQuestionIndex + 1;
    if (nextIndex < questionList.length) {
      feedbackCard.classList.add("hidden");
      questionCard.classList.remove("hidden");
      try {
        await loadQuestionAtIndex(nextIndex);
      } catch (err) {
        showError(err && err.message ? err.message : "Failed to load next question.");
      }
    } else {
      feedbackText.textContent = "";
      correctAnswer.textContent = "";
      feedbackImageWrapper.classList.add("hidden");
      feedbackImage.removeAttribute("src");
      feedbackCard.classList.add("no-feedback-content");
      feedbackCard.classList.remove("hidden");
      questionCard.classList.add("hidden");
      updatePrevNextVisibility();
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

    // 2) First time: create account with auto-generated password and go in
    const password = randomPassword();
    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      setStoredPassword(email, password);
      await ensureUserProfile(cred.user.uid, email);
      showAppForUser(cred.user);
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        if (authLinkFallback) authLinkFallback.classList.remove("hidden");
        showAuthSuccess("Enter your email above, then click “Send sign-in link” to sign in on this device.");
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

signOutButton.addEventListener("click", () => {
  firebase.auth().signOut();
});

function startApp() {
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
    appContent.classList.remove("hidden");
    authCard.classList.add("hidden");
    const headerUser = document.querySelector(".header-user");
    if (headerUser) headerUser.style.display = "none";
    loadQuestionList();
  }
}

startApp();
