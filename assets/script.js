/**
 * AturAja — Praktikum 3 PABWE
 * Fitur: Tab switcher (via query string ?tab=), Expense Tracker, Bookmark Manager, Quiz App
 * Data fitur persisten memakai localStorage dengan key terpisah per fitur.
 * Tab aktif TIDAK disimpan di localStorage — melainkan lewat query string URL.
 */

/* ========== UTILITAS UMUM ========== */

function $(selector) {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Elemen tidak ditemukan: ${selector}`);
  return el;
}
function $all(selector) {
  return document.querySelectorAll(selector);
}
function formatRupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}
function formatTanggal(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/* Ikon inline (SVG) — dipakai untuk elemen yang dibuat lewat JS */
function svgIcon(paths) {
  return `<svg class="inline-block" style="width:1em;height:1em;vertical-align:-0.125em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
const ICON_PENCIL = svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>');
const ICON_TRASH = svgIcon('<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>');
const ICON_ARROW_RIGHT = svgIcon('<path d="M5 12h14"/><path d="M13 5l7 7-7 7"/>');
const ICON_FLAG = svgIcon('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/>');

/* ========== MODAL HELPERS (dipakai semua fitur) ========== */

function openModal(modal) {
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.classList.add("overflow-hidden");
}
function closeModal(modal) {
  modal.classList.add("hidden");
  modal.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");
}

$all("[data-close-modal]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const modal = $(`#modal-${btn.dataset.closeModal}`);
    closeModal(modal);
  });
});
$all(".app-modal .modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", () => closeModal(backdrop.closest(".app-modal")));
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  $all(".app-modal").forEach((modal) => {
    if (!modal.classList.contains("hidden")) closeModal(modal);
  });
});

// Modal konfirmasi hapus generik, dipakai Expense & Bookmark
const modalConfirmDelete = $("#modal-confirm-delete");
const confirmDeleteMessage = $("#confirm-delete-message");
const confirmDeleteBtn = $("#confirm-delete-btn");
let pendingDeleteAction = null;

function askDeleteConfirm(message, onConfirm) {
  confirmDeleteMessage.textContent = message;
  pendingDeleteAction = onConfirm;
  openModal(modalConfirmDelete);
}
confirmDeleteBtn.addEventListener("click", () => {
  if (typeof pendingDeleteAction === "function") pendingDeleteAction();
  pendingDeleteAction = null;
  closeModal(modalConfirmDelete);
});

/* ========================================================
   TAB SWITCHER — berbasis query string ?tab=expense|bookmark|quiz
   ======================================================== */

const VALID_TABS = ["expense", "bookmark", "quiz"];
const tabButtons = $all(".tab-btn");
const panels = {
  expense: $("#panel-expense"),
  bookmark: $("#panel-bookmark"),
  quiz: $("#panel-quiz"),
};
const TAB_ACTIVE_BG = { expense: "bg-emerald-700", bookmark: "bg-sky-700", quiz: "bg-violet-700" };
const TAB_TITLES = {
  expense: "AturAja — Catatan Pengeluaran Harian",
  bookmark: "AturAja — Bookmark Manager",
  quiz: "AturAja — Kuis Interaktif",
};

/** Baca tab aktif dari query string URL (?tab=...). Default: expense. */
function getTabFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const tab = params.get("tab");
  return VALID_TABS.includes(tab) ? tab : "expense";
}

/** Tulis tab aktif ke query string URL tanpa reload halaman */
function setTabInUrl(name) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", name);
  const newUrl = `${window.location.pathname}?${params.toString()}`;
  history.replaceState(null, "", newUrl);
}

/** Ganti tab aktif: sembunyikan panel lain, highlight tombol, atur ARIA, update query string */
function switchTab(name, updateUrl = true) {
  if (!VALID_TABS.includes(name)) name = "expense";

  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== name);
  });

  tabButtons.forEach((btn) => {
    const active = btn.dataset.tab === name;
    btn.setAttribute("aria-selected", String(active));
    btn.setAttribute("tabindex", active ? "0" : "-1");
    Object.values(TAB_ACTIVE_BG).forEach((cls) => btn.classList.remove(cls));
    if (active) btn.classList.add(TAB_ACTIVE_BG[name]);
    btn.classList.toggle("text-white", active);
    btn.classList.toggle("shadow", active);
    btn.classList.toggle("text-slate-600", !active);
    btn.classList.toggle("hover:bg-slate-100", !active);
  });

  document.title = TAB_TITLES[name] || document.title;
  if (updateUrl) setTabInUrl(name);
}

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

// Dukungan tombol back/forward browser (mengubah riwayat query string)
window.addEventListener("popstate", () => switchTab(getTabFromUrl(), false));

/* ================================================================
   FITUR 1: EXPENSE TRACKER (Catatan Pengeluaran Harian)
   ================================================================ */

const EXPENSE_KEY = "pabwe-p3-expenses";

let expenses = loadExpenses();
let editingExpenseId = null;

const expenseForm = $("#expense-form");
const expenseTitleInput = $("#expense-title");
const expenseCategoryInput = $("#expense-category");
const expenseAmountInput = $("#expense-amount");
const expenseTypeInput = $("#expense-type");
const expenseDateInput = $("#expense-date");
const expenseFormError = $("#expense-form-error");

const expenseSearch = $("#expense-search");
const expenseFilterType = $("#expense-filter-type");
const expenseFilterCategory = $("#expense-filter-category");
const expenseSort = $("#expense-sort");

const expenseEmpty = $("#expense-empty");
const expenseList = $("#expense-list");
const expenseTotalIncomeEl = $("#expense-total-income");
const expenseTotalExpenseEl = $("#expense-total-expense");
const expenseBalanceEl = $("#expense-balance");

const modalExpenseEdit = $("#modal-expense-edit");
const expenseEditForm = $("#expense-edit-form");
const expenseEditError = $("#expense-edit-error");
const expenseEditTitle = $("#expense-edit-title");
const expenseEditCategory = $("#expense-edit-category");
const expenseEditAmount = $("#expense-edit-amount");
const expenseEditType = $("#expense-edit-type");
const expenseEditDate = $("#expense-edit-date");

function loadExpenses() {
  try {
    const raw = localStorage.getItem(EXPENSE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveExpenses() {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(expenses));
}

function showFormError(el, message) {
  el.textContent = message;
  el.classList.remove("hidden");
}
function hideFormError(el) {
  el.classList.add("hidden");
  el.textContent = "";
}

/** Hitung & tampilkan ringkasan saldo */
function updateExpenseSummary() {
  const income = expenses
    .filter((e) => e.type === "Pemasukan")
    .reduce((sum, e) => sum + e.amount, 0);
  const expense = expenses
    .filter((e) => e.type === "Pengeluaran")
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = income - expense;

  expenseTotalIncomeEl.textContent = formatRupiah(income);
  expenseTotalExpenseEl.textContent = formatRupiah(expense);
  expenseBalanceEl.textContent = formatRupiah(balance);
  expenseBalanceEl.classList.toggle("text-rose-700", balance < 0);
  expenseBalanceEl.classList.toggle("text-slate-900", balance >= 0);
}

/** Filter, sort, lalu render daftar transaksi ke DOM */
function renderExpenses() {
  const query = expenseSearch.value.trim().toLowerCase();
  const typeFilter = expenseFilterType.value;
  const categoryFilter = expenseFilterCategory.value;
  const sort = expenseSort.value;

  let items = expenses.filter((e) => {
    const matchQuery = e.title.toLowerCase().includes(query);
    const matchType = typeFilter === "all" || e.type === typeFilter;
    const matchCategory = categoryFilter === "all" || e.category === categoryFilter;
    return matchQuery && matchType && matchCategory;
  });

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.createdAt - b.createdAt;
      case "amount-desc":
        return b.amount - a.amount;
      case "amount-asc":
        return a.amount - b.amount;
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const noData = expenses.length === 0;
  expenseEmpty.classList.toggle("hidden", !noData);
  expenseList.classList.toggle("hidden", noData);

  expenseList.innerHTML = "";

  if (noData) return;

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600";
    li.textContent = "Tidak ada transaksi yang cocok dengan pencarian/filter.";
    expenseList.appendChild(li);
    return;
  }

  items.forEach((tx) => {
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-slate-200 px-4 py-3";
    li.dataset.id = tx.id;

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const titleEl = document.createElement("p");
    titleEl.className = "font-medium text-slate-900 truncate";
    titleEl.textContent = tx.title;

    const metaEl = document.createElement("div");
    metaEl.className = "flex flex-wrap items-center gap-2 mt-1";

    const typeBadge = document.createElement("span");
    const isIncome = tx.type === "Pemasukan";
    typeBadge.className = `inline-flex text-xs font-semibold px-2 py-0.5 rounded-md ${
      isIncome ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
    }`;
    typeBadge.textContent = tx.type;

    const categoryBadge = document.createElement("span");
    categoryBadge.className = "inline-flex text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700";
    categoryBadge.textContent = tx.category;

    const dateEl = document.createElement("span");
    dateEl.className = "text-xs text-slate-500";
    dateEl.textContent = formatTanggal(tx.date);

    metaEl.append(typeBadge, categoryBadge, dateEl);
    info.append(titleEl, metaEl);

    const amountEl = document.createElement("p");
    amountEl.className = `font-display font-bold text-base shrink-0 ${isIncome ? "text-emerald-700" : "text-rose-700"}`;
    amountEl.textContent = `${isIncome ? "+" : "-"}${formatRupiah(tx.amount)}`;

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5 shrink-0";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
    editBtn.innerHTML = `${ICON_PENCIL} Ubah`;
    editBtn.setAttribute("aria-label", `Ubah transaksi ${tx.title}`);
    editBtn.addEventListener("click", () => openExpenseEditModal(tx.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50";
    deleteBtn.innerHTML = `${ICON_TRASH} Hapus`;
    deleteBtn.setAttribute("aria-label", `Hapus transaksi ${tx.title}`);
    deleteBtn.addEventListener("click", () => {
      askDeleteConfirm(`Yakin ingin menghapus transaksi "${tx.title}"?`, () => {
        expenses = expenses.filter((e) => e.id !== tx.id);
        saveExpenses();
        renderExpenses();
        updateExpenseSummary();
      });
    });

    actions.append(editBtn, deleteBtn);
    li.append(info, amountEl, actions);
    expenseList.appendChild(li);
  });
}

/** Validasi input transaksi. Mengembalikan pesan error, atau null jika valid. */
function validateExpenseInput(title, amount, date) {
  if (!title) return "Judul tidak boleh kosong.";
  if (!Number.isFinite(amount) || amount <= 0) return "Jumlah harus berupa angka lebih dari 0.";
  if (!date) return "Tanggal wajib diisi.";
  return null;
}

expenseForm.addEventListener("submit", (e) => {
  e.preventDefault();
  hideFormError(expenseFormError);

  const title = expenseTitleInput.value.trim();
  const amount = Number(expenseAmountInput.value);
  const date = expenseDateInput.value;

  const error = validateExpenseInput(title, amount, date);
  if (error) {
    showFormError(expenseFormError, error);
    return;
  }

  expenses.push({
    id: crypto.randomUUID(),
    title,
    category: expenseCategoryInput.value,
    amount,
    type: expenseTypeInput.value,
    date,
    createdAt: Date.now(),
  });

  saveExpenses();
  expenseForm.reset();
  expenseDateInput.value = new Date().toISOString().slice(0, 10);
  renderExpenses();
  updateExpenseSummary();
});

function openExpenseEditModal(id) {
  const tx = expenses.find((e) => e.id === id);
  if (!tx) return;

  editingExpenseId = id;
  hideFormError(expenseEditError);
  expenseEditTitle.value = tx.title;
  expenseEditCategory.value = tx.category;
  expenseEditAmount.value = tx.amount;
  expenseEditType.value = tx.type;
  expenseEditDate.value = tx.date;
  openModal(modalExpenseEdit);
  expenseEditTitle.focus();
}

expenseEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  hideFormError(expenseEditError);

  const title = expenseEditTitle.value.trim();
  const amount = Number(expenseEditAmount.value);
  const date = expenseEditDate.value;

  const error = validateExpenseInput(title, amount, date);
  if (error) {
    showFormError(expenseEditError, error);
    return;
  }

  const tx = expenses.find((e) => e.id === editingExpenseId);
  if (tx) {
    tx.title = title;
    tx.category = expenseEditCategory.value;
    tx.amount = amount;
    tx.type = expenseEditType.value;
    tx.date = date;
    saveExpenses();
    renderExpenses();
    updateExpenseSummary();
  }

  editingExpenseId = null;
  closeModal(modalExpenseEdit);
});

[expenseSearch, expenseFilterType, expenseFilterCategory, expenseSort].forEach((el) => {
  el.addEventListener("input", renderExpenses);
  el.addEventListener("change", renderExpenses);
});

expenseDateInput.value = new Date().toISOString().slice(0, 10);

renderExpenses();
updateExpenseSummary();

/* ================================================================
   FITUR 2: BOOKMARK / LINK MANAGER
   ================================================================ */

const BOOKMARK_KEY = "pabwe-p3-bookmarks";
const URL_REGEX = /^https?:\/\/.+/i;

let bookmarks = loadBookmarks();
let editingBookmarkId = null;

const bookmarkForm = $("#bookmark-form");
const bookmarkNameInput = $("#bookmark-name");
const bookmarkUrlInput = $("#bookmark-url");
const bookmarkCategoryInput = $("#bookmark-category");
const bookmarkNoteInput = $("#bookmark-note");
const bookmarkFormError = $("#bookmark-form-error");

const bookmarkSearch = $("#bookmark-search");
const bookmarkSort = $("#bookmark-sort");
const bookmarkEmpty = $("#bookmark-empty");
const bookmarkList = $("#bookmark-list");

const modalBookmarkEdit = $("#modal-bookmark-edit");
const bookmarkEditForm = $("#bookmark-edit-form");
const bookmarkEditError = $("#bookmark-edit-error");
const bookmarkEditName = $("#bookmark-edit-name");
const bookmarkEditUrl = $("#bookmark-edit-url");
const bookmarkEditCategory = $("#bookmark-edit-category");
const bookmarkEditNote = $("#bookmark-edit-note");

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveBookmarks() {
  localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmarks));
}

function validateBookmarkInput(name, url) {
  if (!name) return "Nama tidak boleh kosong.";
  if (!URL_REGEX.test(url)) return "URL harus diawali dengan http:// atau https://";
  return null;
}

function renderBookmarks() {
  const query = bookmarkSearch.value.trim().toLowerCase();
  const sort = bookmarkSort.value;

  let items = bookmarks.filter((b) => {
    return (
      b.name.toLowerCase().includes(query) ||
      b.url.toLowerCase().includes(query) ||
      (b.category || "").toLowerCase().includes(query)
    );
  });

  items = [...items].sort((a, b) => {
    switch (sort) {
      case "title-asc":
        return a.name.localeCompare(b.name, "id");
      case "title-desc":
        return b.name.localeCompare(a.name, "id");
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  const noData = bookmarks.length === 0;
  bookmarkEmpty.classList.toggle("hidden", !noData);
  bookmarkList.classList.toggle("hidden", noData);

  bookmarkList.innerHTML = "";
  if (noData) return;

  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600";
    li.textContent = "Tidak ada bookmark yang cocok dengan pencarian.";
    bookmarkList.appendChild(li);
    return;
  }

  items.forEach((bm) => {
    const li = document.createElement("li");
    li.className = "flex flex-col sm:flex-row sm:items-start gap-3 rounded-xl border border-slate-200 px-4 py-3";
    li.dataset.id = bm.id;

    const info = document.createElement("div");
    info.className = "flex-1 min-w-0";

    const link = document.createElement("a");
    link.href = bm.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "font-medium text-sky-700 hover:underline break-words";
    link.textContent = bm.name;

    const urlEl = document.createElement("p");
    urlEl.className = "text-xs text-slate-500 truncate";
    urlEl.textContent = bm.url;

    const metaEl = document.createElement("div");
    metaEl.className = "flex flex-wrap items-center gap-2 mt-1";

    if (bm.category) {
      const categoryBadge = document.createElement("span");
      categoryBadge.className = "inline-flex text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-800";
      categoryBadge.textContent = bm.category;
      metaEl.appendChild(categoryBadge);
    }
    if (bm.note) {
      const noteEl = document.createElement("span");
      noteEl.className = "text-xs text-slate-500";
      noteEl.textContent = bm.note;
      metaEl.appendChild(noteEl);
    }

    info.append(link, urlEl, metaEl);

    const actions = document.createElement("div");
    actions.className = "flex items-center gap-1.5 shrink-0";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";
    editBtn.innerHTML = `${ICON_PENCIL} Ubah`;
    editBtn.setAttribute("aria-label", `Ubah bookmark ${bm.name}`);
    editBtn.addEventListener("click", () => openBookmarkEditModal(bm.id));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50";
    deleteBtn.innerHTML = `${ICON_TRASH} Hapus`;
    deleteBtn.setAttribute("aria-label", `Hapus bookmark ${bm.name}`);
    deleteBtn.addEventListener("click", () => {
      askDeleteConfirm(`Yakin ingin menghapus bookmark "${bm.name}"?`, () => {
        bookmarks = bookmarks.filter((b) => b.id !== bm.id);
        saveBookmarks();
        renderBookmarks();
      });
    });

    actions.append(editBtn, deleteBtn);
    li.append(info, actions);
    bookmarkList.appendChild(li);
  });
}

bookmarkForm.addEventListener("submit", (e) => {
  e.preventDefault();
  hideFormError(bookmarkFormError);

  const name = bookmarkNameInput.value.trim();
  const url = bookmarkUrlInput.value.trim();

  const error = validateBookmarkInput(name, url);
  if (error) {
    showFormError(bookmarkFormError, error);
    return;
  }

  bookmarks.push({
    id: crypto.randomUUID(),
    name,
    url,
    category: bookmarkCategoryInput.value.trim(),
    note: bookmarkNoteInput.value.trim(),
    createdAt: Date.now(),
  });

  saveBookmarks();
  bookmarkForm.reset();
  renderBookmarks();
});

function openBookmarkEditModal(id) {
  const bm = bookmarks.find((b) => b.id === id);
  if (!bm) return;

  editingBookmarkId = id;
  hideFormError(bookmarkEditError);
  bookmarkEditName.value = bm.name;
  bookmarkEditUrl.value = bm.url;
  bookmarkEditCategory.value = bm.category || "";
  bookmarkEditNote.value = bm.note || "";
  openModal(modalBookmarkEdit);
  bookmarkEditName.focus();
}

bookmarkEditForm.addEventListener("submit", (e) => {
  e.preventDefault();
  hideFormError(bookmarkEditError);

  const name = bookmarkEditName.value.trim();
  const url = bookmarkEditUrl.value.trim();

  const error = validateBookmarkInput(name, url);
  if (error) {
    showFormError(bookmarkEditError, error);
    return;
  }

  const bm = bookmarks.find((b) => b.id === editingBookmarkId);
  if (bm) {
    bm.name = name;
    bm.url = url;
    bm.category = bookmarkEditCategory.value.trim();
    bm.note = bookmarkEditNote.value.trim();
    saveBookmarks();
    renderBookmarks();
  }

  editingBookmarkId = null;
  closeModal(modalBookmarkEdit);
});

[bookmarkSearch, bookmarkSort].forEach((el) => {
  el.addEventListener("input", renderBookmarks);
  el.addEventListener("change", renderBookmarks);
});

renderBookmarks();

/* ================================================================
   FITUR 3: QUIZ APP
   ================================================================ */

const QUIZ_HIGHSCORE_KEY = "pabwe-p3-quiz-highscore";

// Soal disimpan sebagai array of object, bukan hardcode HTML per soal
const QUIZ_QUESTIONS = [
  {
    question: "Apa kepanjangan dari DOM?",
    options: ["Document Object Model", "Data Object Management", "Digital Ordering Method", "Document Oriented Markup"],
    correctIndex: 0,
  },
  {
    question: "Method array JavaScript mana yang menambahkan elemen di akhir array?",
    options: ["pop()", "shift()", "push()", "splice()"],
    correctIndex: 2,
  },
  {
    question: "Agar data tetap ada meski halaman di-refresh dan browser ditutup, kita gunakan?",
    options: ["sessionStorage", "localStorage", "variabel global", "cookies bawaan"],
    correctIndex: 1,
  },
  {
    question: "Fungsi apa yang mengubah string JSON menjadi objek JavaScript?",
    options: ["JSON.stringify()", "JSON.parse()", "Object.convert()", "JSON.toObject()"],
    correctIndex: 1,
  },
  {
    question: "Event mana yang paling tepat untuk mendeteksi ketikan pengguna secara real-time pada input?",
    options: ["click", "submit", "input", "load"],
    correctIndex: 2,
  },
  {
    question: "Method mana yang mengambil SEMUA elemen dengan class tertentu?",
    options: ["document.querySelector()", "document.getElementById()", "document.querySelectorAll()", "document.forEach()"],
    correctIndex: 2,
  },
];

let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;

const quizStartScreen = $("#quiz-start");
const quizQuestionScreen = $("#quiz-question");
const quizResultScreen = $("#quiz-result");

const quizHighscoreEl = $("#quiz-highscore");
const quizStartBtn = $("#quiz-start-btn");
const quizProgress = $("#quiz-progress");
const quizScoreLive = $("#quiz-score-live");
const quizQuestionText = $("#quiz-question-text");
const quizOptions = $("#quiz-options");
const quizFeedback = $("#quiz-feedback");
const quizNextBtn = $("#quiz-next-btn");
const quizScoreEl = $("#quiz-score");
const quizHighscoreResultEl = $("#quiz-highscore-result");
const quizRestartBtn = $("#quiz-restart-btn");

function getQuizHighscore() {
  const v = localStorage.getItem(QUIZ_HIGHSCORE_KEY);
  return v ? Number(v) : null;
}
function showQuizHighscore() {
  const top = getQuizHighscore();
  quizHighscoreEl.textContent = top === null ? "—" : `${top} / ${QUIZ_QUESTIONS.length}`;
}

function showQuizScreen(name) {
  quizStartScreen.classList.toggle("hidden", name !== "start");
  quizQuestionScreen.classList.toggle("hidden", name !== "question");
  quizResultScreen.classList.toggle("hidden", name !== "result");
}

function startQuiz() {
  quizIndex = 0;
  quizScore = 0;
  showQuizScreen("question");
  renderQuizQuestion();
}

function renderQuizQuestion() {
  quizAnswered = false;
  const q = QUIZ_QUESTIONS[quizIndex];

  quizProgress.textContent = `Soal ${quizIndex + 1} dari ${QUIZ_QUESTIONS.length}`;
  quizScoreLive.textContent = `Skor: ${quizScore}`;
  quizQuestionText.textContent = q.question;

  quizFeedback.classList.add("hidden");
  quizNextBtn.classList.add("hidden");
  quizOptions.innerHTML = "";

  q.options.forEach((optionText, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "quiz-option text-left rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:border-violet-400 hover:bg-violet-50 transition";
    btn.textContent = optionText;
    btn.addEventListener("click", () => handleQuizAnswer(index));
    quizOptions.appendChild(btn);
  });
}

function handleQuizAnswer(selectedIndex) {
  if (quizAnswered) return;
  quizAnswered = true;

  const q = QUIZ_QUESTIONS[quizIndex];
  const isCorrect = selectedIndex === q.correctIndex;
  if (isCorrect) quizScore += 1;

  // Beri highlight benar/salah pada tombol opsi
  $all("#quiz-options .quiz-option").forEach((btn, index) => {
    btn.disabled = true;
    if (index === q.correctIndex) {
      btn.classList.add("bg-emerald-100", "border-emerald-400", "text-emerald-800");
    } else if (index === selectedIndex) {
      btn.classList.add("bg-rose-100", "border-rose-400", "text-rose-800");
    }
  });

  quizFeedback.classList.remove("hidden");
  quizFeedback.className = `rounded-xl border px-4 py-3 text-sm mb-4 ${
    isCorrect ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"
  }`;
  quizFeedback.textContent = isCorrect ? "Benar!" : `Kurang tepat. Jawaban yang benar: "${q.options[q.correctIndex]}"`;

  quizScoreLive.textContent = `Skor: ${quizScore}`;

  const isLastQuestion = quizIndex === QUIZ_QUESTIONS.length - 1;
  quizNextBtn.innerHTML = isLastQuestion
    ? `${ICON_FLAG} Lihat Hasil`
    : `Lanjut ${ICON_ARROW_RIGHT}`;
  quizNextBtn.classList.remove("hidden");
}

quizNextBtn.addEventListener("click", () => {
  if (quizIndex < QUIZ_QUESTIONS.length - 1) {
    quizIndex += 1;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
});

function finishQuiz() {
  showQuizScreen("result");
  quizScoreEl.textContent = `${quizScore} / ${QUIZ_QUESTIONS.length}`;

  const top = getQuizHighscore();
  let isNewRecord = false;
  if (top === null || quizScore > top) {
    localStorage.setItem(QUIZ_HIGHSCORE_KEY, String(quizScore));
    isNewRecord = true;
  }

  quizHighscoreResultEl.textContent = isNewRecord
    ? `Rekor baru! Skor tertinggi: ${quizScore} / ${QUIZ_QUESTIONS.length}`
    : `Skor tertinggi: ${getQuizHighscore()} / ${QUIZ_QUESTIONS.length}`;
}

quizStartBtn.addEventListener("click", startQuiz);
quizRestartBtn.addEventListener("click", () => showQuizScreen("start"));

showQuizHighscore();
showQuizScreen("start");

/* ========== INISIALISASI TAB AWAL (dari query string URL) ========== */
switchTab(getTabFromUrl(), false);