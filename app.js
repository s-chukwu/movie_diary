const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/w342";
const IMG_BASE_LARGE = "https://image.tmdb.org/t/p/w500";
const FETCH_TIMEOUT_MS = 10000;
const FALLBACK_REGIONS = ["US", "GB", "FR", "DE"];

// ---------- State ----------

let currentMode = "discover"; // "discover" | "search"
let currentQuery = "";
let currentPage = 1;
let totalPages = 1;
let genreMap = {};
let compareList = []; // array of { id, title, poster_path }

// ---------- DOM refs ----------

const els = {
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),
  genreFilter: document.getElementById("genreFilter"),
  sortFilter: document.getElementById("sortFilter"),
  yearFilter: document.getElementById("yearFilter"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  statusBanner: document.getElementById("statusBanner"),
  resultsGrid: document.getElementById("resultsGrid"),
  pagination: document.getElementById("pagination"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageIndicator: document.getElementById("pageIndicator"),
  detailOverlay: document.getElementById("detailOverlay"),
  detailContent: document.getElementById("detailContent"),
  closeDetailBtn: document.getElementById("closeDetailBtn"),
  compareTray: document.getElementById("compareTray"),
  trayItems: document.getElementById("trayItems"),
  openCompareBtn: document.getElementById("openCompareBtn"),
  compareOverlay: document.getElementById("compareOverlay"),
  compareContent: document.getElementById("compareContent"),
  closeCompareBtn: document.getElementById("closeCompareBtn"),
  serverTag: document.getElementById("serverTag"),
  themeToggle: document.getElementById("themeToggle"),
  themeToggleLabel: document.getElementById("themeToggleLabel"),
};

// ---------- Network status ----------

function initNetworkWatcher() {
  window.addEventListener("offline", () => {
    showStatus("You're offline. Reconnect to keep browsing movies.", true);
  });
  window.addEventListener("online", () => {
    clearStatus();
  });
  if (!navigator.onLine) {
    showStatus("You're offline. Reconnect to keep browsing movies.", true);
  }
}

// ---------- Theme toggle ----------

function initTheme() {
  const saved = localStorage.getItem("movie-dairy-theme");
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  applyTheme(theme);
  els.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  els.themeToggleLabel.textContent = theme === "dark" ? "Dark" : "Light";
  localStorage.setItem("movie-dairy-theme", theme);
}

// ---------- Served-by tag ----------
// Reads the X-Served-By header nginx sets on web01/web02

async function loadServedByTag() {
  try {
    const res = await fetch(".", { method: "HEAD", cache: "no-store" });
    const servedBy = res.headers.get("X-Served-By");
    els.serverTag.textContent = servedBy ? `served by ${servedBy}` : "server unknown";
  } catch (err) {
    els.serverTag.textContent = "server unknown";
  }
}

// ---------- Fetch helper with timeout + error surfacing ----------

async function tmdbFetch(path, params = {}) {
  if (!navigator.onLine) {
    throw new Error("You appear to be offline. Check your connection and try again.");
  }

  const url = new URL(TMDB_BASE + path);
  url.searchParams.set("api_key", TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined) url.searchParams.set(k, v);
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 401) {
      throw new Error("Invalid or missing API key. Check config.js.");
    }
    if (res.status === 429) {
      throw new Error("Rate limit reached. Wait a moment and try again.");
    }
    if (!res.ok) {
      throw new Error(`TMDB returned an unexpected error (status ${res.status}).`);
    }
    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") {
      throw new Error("The request took too long and was cancelled. Try again.");
    }
    if (err instanceof TypeError) {
      throw new Error("Could not reach TMDB. Check your connection and try again.");
    }
    throw err;
  }
}

// ---------- Status banner ----------

function showStatus(message, isError = false) {
  els.statusBanner.textContent = message;
  els.statusBanner.classList.remove("hidden");
  els.statusBanner.classList.toggle("error", isError);
}

function clearStatus() {
  els.statusBanner.classList.add("hidden");
  els.statusBanner.textContent = "";
}

// ---------- Init ----------

async function init() {
  initTheme();
  initNetworkWatcher();
  await loadServedByTag();
  populateYearFilter();
  await loadGenres();
  await runDiscover();

  els.searchBtn.addEventListener("click", handleSearch);
  els.searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });
  els.genreFilter.addEventListener("change", () => { currentPage = 1; runCurrentMode(); });
  els.sortFilter.addEventListener("change", () => { currentPage = 1; runCurrentMode(); });
  els.yearFilter.addEventListener("change", () => { currentPage = 1; runCurrentMode(); });
  els.clearFiltersBtn.addEventListener("click", clearFilters);
  els.prevPageBtn.addEventListener("click", () => changePage(-1));
  els.nextPageBtn.addEventListener("click", () => changePage(1));
  els.closeDetailBtn.addEventListener("click", () => els.detailOverlay.classList.add("hidden"));
  els.closeCompareBtn.addEventListener("click", () => els.compareOverlay.classList.add("hidden"));
  els.openCompareBtn.addEventListener("click", openCompareView);
}

function populateYearFilter() {
  const thisYear = new Date().getFullYear();
  for (let y = thisYear + 1; y >= 1970; y--) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    els.yearFilter.appendChild(opt);
  }
}

async function loadGenres() {
  try {
    const data = await tmdbFetch("/genre/movie/list");
    data.genres.forEach((g) => {
      genreMap[g.id] = g.name;
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      els.genreFilter.appendChild(opt);
    });
  } catch (err) {
    console.warn("Could not load genre list:", err.message);
  }
}

function clearFilters() {
  els.genreFilter.value = "";
  els.sortFilter.value = "popularity.desc";
  els.yearFilter.value = "";
  els.searchInput.value = "";
  currentMode = "discover";
  currentPage = 1;
  runDiscover();
}

function runCurrentMode() {
  if (currentMode === "search") {
    runSearch();
  } else {
    runDiscover();
  }
}

function handleSearch() {
  const query = els.searchInput.value.trim();
  currentPage = 1;
  if (query === "") {
    currentMode = "discover";
    runDiscover();
  } else {
    currentMode = "search";
    currentQuery = query;
    runSearch();
  }
}

function changePage(delta) {
  const next = currentPage + delta;
  if (next < 1 || next > totalPages) return;
  currentPage = next;
  runCurrentMode();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- Discover / Search ----------

async function runDiscover() {
  clearStatus();
  els.resultsGrid.innerHTML = "";
  showStatus("Loading movies...");

  try {
    const params = {
      page: currentPage,
      sort_by: els.sortFilter.value,
      with_genres: els.genreFilter.value,
      primary_release_year: els.yearFilter.value,
    };
    const data = await tmdbFetch("/discover/movie", params);
    handleResults(data);
  } catch (err) {
    showStatus(err.message, true);
  }
}

async function runSearch() {
  clearStatus();
  els.resultsGrid.innerHTML = "";
  showStatus(`Searching for "${currentQuery}"...`);

  try {
    const data = await tmdbFetch("/search/movie", {
      query: currentQuery,
      page: currentPage,
    });
    handleResults(data);
  } catch (err) {
    showStatus(err.message, true);
  }
}

function handleResults(data) {
  totalPages = Math.min(data.total_pages || 1, 500); // TMDB caps at 500 pages
  currentPage = data.page || 1;

  if (!data.results || data.results.length === 0) {
    els.resultsGrid.innerHTML = "";
    els.pagination.classList.add("hidden");
    showStatus(
      currentMode === "search"
        ? `No results for "${currentQuery}". Try a different title or check the spelling.`
        : "No movies matched these filters. Try widening your search."
    );
    return;
  }

  clearStatus();
  renderGrid(data.results);
  renderPagination();
}

function renderGrid(movies) {
  els.resultsGrid.innerHTML = "";
  movies.forEach((movie) => {
    const card = document.createElement("div");
    card.className = "movie-card";

    const posterHtml = movie.poster_path
      ? `<img src="${IMG_BASE}${movie.poster_path}" alt="${escapeHtml(movie.title)} poster" loading="lazy">`
      : `<div class="no-poster">No poster available</div>`;

    const year = movie.release_date ? movie.release_date.slice(0, 4) : "TBA";
    const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "—";

    card.innerHTML = `
      ${posterHtml}
      <button class="card-compare-toggle" data-id="${movie.id}" aria-label="Add to comparison">+</button>
      <div class="card-body">
        <p class="card-title">${escapeHtml(movie.title)}</p>
        <p class="card-meta">${year} · ★ ${rating}</p>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.closest(".card-compare-toggle")) return;
      openDetail(movie.id);
    });

    const toggleBtn = card.querySelector(".card-compare-toggle");
    if (compareList.some((m) => m.id === movie.id)) toggleBtn.classList.add("active");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCompare(movie, toggleBtn);
    });

    els.resultsGrid.appendChild(card);
  });
}

function renderPagination() {
  if (totalPages <= 1) {
    els.pagination.classList.add("hidden");
    return;
  }
  els.pagination.classList.remove("hidden");
  els.pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  els.prevPageBtn.disabled = currentPage <= 1;
  els.nextPageBtn.disabled = currentPage >= totalPages;
}

// ---------- Detail view ----------

async function openDetail(movieId) {
  els.detailOverlay.classList.remove("hidden");
  els.detailContent.innerHTML = `<p>Loading details...</p>`;

  try {
    const [details, providers] = await Promise.all([
      tmdbFetch(`/movie/${movieId}`),
      tmdbFetch(`/movie/${movieId}/watch/providers`),
    ]);
    els.detailContent.innerHTML = renderDetailHtml(details, providers);
  } catch (err) {
    els.detailContent.innerHTML = `<p class="provider-empty">Could not load details: ${escapeHtml(err.message)}</p>`;
  }
}

function renderDetailHtml(movie, providersData) {
  const year = movie.release_date ? movie.release_date.slice(0, 4) : "TBA";
  const genres = (movie.genres || []).map((g) => g.name).join(", ") || "Unlisted";
  const runtime = movie.runtime ? `${movie.runtime} min` : "Runtime unknown";
  const posterHtml = movie.poster_path
    ? `<img src="${IMG_BASE_LARGE}${movie.poster_path}" alt="${escapeHtml(movie.title)} poster">`
    : "";

  return `
    <div class="detail-header">
      ${posterHtml}
      <div>
        <h2 class="detail-title">${escapeHtml(movie.title)}</h2>
        <p class="detail-meta">${year} · ${genres} · ${runtime} · ★ ${movie.vote_average?.toFixed(1) ?? "—"} (${movie.vote_count ?? 0} votes)</p>
        <p class="detail-overview">${escapeHtml(movie.overview || "No overview available.")}</p>
      </div>
    </div>
    <h3 class="section-label">Where to watch</h3>
    ${renderProviders(providersData)}
  `;
}

function renderProviders(providersData) {
  const results = providersData.results || {};
  const regions = Object.keys(results);

  if (regions.length === 0) {
    return `<p class="provider-empty">Not yet available to stream, rent, or buy anywhere TMDB tracks. This is common for very new releases.</p>`;
  }

  // Fall back to whatever is available.
  const preferred = FALLBACK_REGIONS.filter((r) => results[r]);
  const regionsToShow = preferred.length > 0 ? preferred : regions.slice(0, 3);

  let html = "";
  regionsToShow.forEach((region) => {
    const entry = results[region];
    const allProviders = [
      ...(entry.flatrate || []),
      ...(entry.rent || []),
      ...(entry.buy || []),
    ];
    const seen = new Set();
    const unique = allProviders.filter((p) => {
      if (seen.has(p.provider_id)) return false;
      seen.add(p.provider_id);
      return true;
    });

    html += `
      <div class="provider-region">
        <p class="provider-region-name">${regionName(region)}</p>
        <div class="provider-list">
          ${unique.map((p) => `
            <span class="provider-chip">
              <img src="https://image.tmdb.org/t/p/w45${p.logo_path}" alt="">
              ${escapeHtml(p.provider_name)}
            </span>
          `).join("")}
        </div>
      </div>
    `;
  });

  if (preferred.length === 0) {
    html = `<p class="provider-empty">No listing for common regions yet. Showing what's available elsewhere:</p>` + html;
  }

  return html;
}

function regionName(code) {
  const names = { US: "United States", GB: "United Kingdom", FR: "France", DE: "Germany" };
  return names[code] || code;
}

// ---------- Compare ----------

function toggleCompare(movie, btnEl) {
  const idx = compareList.findIndex((m) => m.id === movie.id);
  if (idx >= 0) {
    compareList.splice(idx, 1);
    btnEl.classList.remove("active");
  } else {
    if (compareList.length >= 3) {
      showStatus("You can compare up to 3 movies at a time. Remove one to add another.");
      return;
    }
    compareList.push(movie);
    btnEl.classList.add("active");
  }
  renderTray();
}

function renderTray() {
  if (compareList.length === 0) {
    els.compareTray.classList.add("hidden");
    return;
  }
  els.compareTray.classList.remove("hidden");
  els.trayItems.innerHTML = compareList.map((m) => `
    <div class="tray-item">
      ${m.poster_path ? `<img src="${IMG_BASE}${m.poster_path}" alt="">` : ""}
      <span>${escapeHtml(m.title)}</span>
      <button data-id="${m.id}" aria-label="Remove from comparison">&times;</button>
    </div>
  `).join("");

  els.trayItems.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      compareList = compareList.filter((m) => m.id !== id);
      document.querySelectorAll(`.card-compare-toggle[data-id="${id}"]`).forEach((b) => b.classList.remove("active"));
      renderTray();
    });
  });

  els.openCompareBtn.disabled = compareList.length < 2;
}

async function openCompareView() {
  els.compareOverlay.classList.remove("hidden");
  els.compareContent.innerHTML = `<p>Loading comparison...</p>`;

  try {
    const detailsList = await Promise.all(
      compareList.map((m) =>
        Promise.all([
          tmdbFetch(`/movie/${m.id}`),
          tmdbFetch(`/movie/${m.id}/watch/providers`),
        ])
      )
    );
    els.compareContent.innerHTML = renderCompareTable(detailsList);
  } catch (err) {
    els.compareContent.innerHTML = `<p class="provider-empty">Could not load comparison: ${escapeHtml(err.message)}</p>`;
  }
}

function renderCompareTable(detailsList) {
  const cols = detailsList.length;
  const gridStyle = `grid-template-columns: 140px repeat(${cols}, 1fr);`;

  function row(label, cells) {
    return `
      <div class="compare-row" style="${gridStyle}">
        <div class="compare-cell label">${label}</div>
        ${cells.map((c) => `<div class="compare-cell">${c}</div>`).join("")}
      </div>
    `;
  }

  const titles = detailsList.map(([d]) => `<strong>${escapeHtml(d.title)}</strong>`);
  const years = detailsList.map(([d]) => d.release_date ? d.release_date.slice(0, 4) : "TBA");
  const ratings = detailsList.map(([d]) => `★ ${d.vote_average?.toFixed(1) ?? "—"} (${d.vote_count ?? 0})`);
  const genresRow = detailsList.map(([d]) => (d.genres || []).map((g) => g.name).join(", ") || "Unlisted");
  const runtimes = detailsList.map(([d]) => d.runtime ? `${d.runtime} min` : "Unknown");
  const providersRow = detailsList.map(([, p]) => {
    const results = p.results || {};
    const preferred = FALLBACK_REGIONS.find((r) => results[r]);
    if (!preferred) return `<span class="provider-empty">Not listed</span>`;
    const entry = results[preferred];
    const names = [
      ...(entry.flatrate || []),
      ...(entry.rent || []),
      ...(entry.buy || []),
    ].map((x) => x.provider_name);
    const unique = [...new Set(names)];
    return unique.length ? unique.slice(0, 4).join(", ") : `<span class="provider-empty">Not listed</span>`;
  });

  return `
    <h2 class="detail-title" style="margin-bottom:16px;">Comparison</h2>
    <div class="compare-table">
      ${row("", titles)}
      ${row("Year", years)}
      ${row("Rating", ratings)}
      ${row("Genres", genresRow)}
      ${row("Runtime", runtimes)}
      ${row("Watch on", providersRow)}
    </div>
  `;
}

// ---------- Utils ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Boot ----------

if (typeof TMDB_API_KEY === "undefined" || TMDB_API_KEY === "YOUR_TMDB_API_KEY_HERE") {
  document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initNetworkWatcher();
    loadServedByTag();
    showStatus("No TMDB API key set. Add your key to config.js to load movies.", true);
  });
} else {
  document.addEventListener("DOMContentLoaded", init);
}
