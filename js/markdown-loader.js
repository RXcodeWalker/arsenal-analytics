(function () {
  const indexContainer = document.getElementById("articles-index");
  const articleContainer = document.getElementById("article-container");
  const tagFiltersContainer = document.getElementById("tag-filters");
  const featuredContainer = document.getElementById("featured-article-container");
  const gridContainer = document.getElementById("articles-grid-full");

  const state = {
    activeTag: "All",
    query: "",
    articles: [],
    currentArticle: null,
  };

  const md = window.markdownit({
    html: true,
    linkify: true,
    typographer: true,
  });

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderMarkdown(content) {
    return md.render(content);
  }

  function setCanonicalArticleParam(slug) {
    const url = new URL(window.location.href);
    url.searchParams.set("article", slug);
    window.history.replaceState({}, "", url.toString());
  }

  function clearArticleParam() {
    const url = new URL(window.location.href);
    url.searchParams.delete("article");
    window.history.replaceState({}, "", url.toString());
  }

  function buildArticleLookupMap(articles) {
    const map = new Map();
    articles.forEach((article) => {
      map.set(article.slug, article);
      (article.aliases || []).forEach((alias) => map.set(alias, article));
    });
    return map;
  }

  function getAllTags(articles) {
    const tags = new Set(["All"]);
    articles.forEach((article) => {
      (article.tags || []).forEach((tag) => tags.add(tag));
    });
    return [...tags];
  }

  function applyArticleFilters(articles) {
    const normalizedQuery = state.query.trim().toLowerCase();
    return articles.filter((article) => {
      const tagMatch = state.activeTag === "All" || article.tags.includes(state.activeTag);
      if (!tagMatch) return false;
      if (!normalizedQuery) return true;
      const text = (article.search && article.search.text) || "";
      return text.includes(normalizedQuery);
    });
  }

  function showIndexLoadingState() {
    featuredContainer.innerHTML = "";
    gridContainer.innerHTML = '<div class="card" style="padding:16px;">Loading articles...</div>';
  }

  function showIndexErrorState(message) {
    featuredContainer.innerHTML = "";
    gridContainer.innerHTML = `<div class="card" style="padding:16px;color:var(--text-secondary);">${escapeHtml(
      message
    )}</div>`;
  }

  function showArticleLoadingState() {
    articleContainer.innerHTML = '<div style="padding-top:48px;"><div class="card" style="padding:16px;">Loading article...</div></div>';
  }

  function showArticleErrorState(message) {
    articleContainer.innerHTML = `
      <div style="padding-top:48px;">
        <button class="btn btn-ghost btn-sm" onclick="goBack()" style="margin-bottom:32px;">← All Articles</button>
        <div class="card" style="padding:16px;color:var(--text-secondary);">${escapeHtml(message)}</div>
      </div>
    `;
  }

  function renderTagFilters() {
    const tags = getAllTags(state.articles);
    tagFiltersContainer.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        ${tags
          .map(
            (tag) =>
              `<button class="badge tag-btn ${
                tag === state.activeTag ? "badge-red active" : "badge-gray"
              }" onclick="filterByTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`
          )
          .join("")}
      </div>
      <div style="margin-top:12px;">
        <input id="article-search-input" type="search" placeholder="Search title, excerpt, tags..." value="${escapeHtml(
          state.query
        )}" style="width:100%;max-width:420px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;color:var(--text-primary);" />
      </div>
    `;

    const searchInput = document.getElementById("article-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        state.query = event.target.value || "";
        renderIndexView();
      });
    }
  }

  function renderIndexView() {
    indexContainer.classList.remove("hidden");
    articleContainer.innerHTML = "";

    renderTagFilters();

    const filtered = applyArticleFilters(state.articles);
    if (!filtered.length) {
      featuredContainer.innerHTML = "";
      gridContainer.innerHTML = '<div class="card" style="padding:16px;color:var(--text-secondary);">No articles match your current filters.</div>';
      return;
    }

    const featured = filtered.find((article) => article.featured) || filtered[0];
    const rest = filtered.filter((article) => article.slug !== featured.slug);

    featuredContainer.innerHTML = `
      <div class="article-featured" style="cursor:pointer;" onclick="openArticle('${escapeHtml(featured.slug)}')">
        <div class="article-featured-visual">
          <div style="font-size:4rem;opacity:0.2;z-index:1;position:relative;">${escapeHtml(featured.emoji || "📄")}</div>
          <div style="position:absolute;top:16px;left:16px;z-index:2;">
            <span class="badge badge-red">${escapeHtml((featured.tags && featured.tags[0]) || "Article")}</span>
          </div>
          <div style="position:absolute;bottom:16px;right:16px;z-index:2;">
            <span class="badge badge-gray">${escapeHtml(featured.readTime || "5 min")} read</span>
          </div>
        </div>
        <div class="article-featured-content">
          <div class="article-category">${escapeHtml(featured.category || "Tactical Analysis")} · ${escapeHtml(featured.date)}</div>
          <h2 style="font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;line-height:1.3;margin-bottom:14px;color:var(--white);">${escapeHtml(
            featured.title
          )}</h2>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.7;margin-bottom:20px;">${escapeHtml(
            featured.excerpt
          )}</p>
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:20px;flex-wrap:wrap;">
            ${(featured.tags || []).map((tag) => `<span class="badge badge-gray">${escapeHtml(tag)}</span>`).join("")}
          </div>
          <button class="btn btn-primary" onclick="event.stopPropagation();openArticle('${escapeHtml(
            featured.slug
          )}')">Read Analysis →</button>
        </div>
      </div>
    `;

    gridContainer.innerHTML = rest
      .map(
        (article) => `
      <div class="article-card" onclick="openArticle('${escapeHtml(article.slug)}')" style="cursor:pointer;">
        <div class="article-img">
          <div class="article-img-placeholder">${escapeHtml(article.emoji || "📄")}</div>
          <div style="position:absolute;top:12px;left:12px;"><span class="badge badge-red">${escapeHtml(
            (article.tags && article.tags[0]) || "Article"
          )}</span></div>
          <div style="position:absolute;top:12px;right:12px;"><span class="badge badge-gray">${escapeHtml(
            article.readTime || "5 min"
          )}</span></div>
        </div>
        <div class="article-body">
          <div class="article-category">${escapeHtml(article.category || "Tactical Analysis")}</div>
          <div class="article-title">${escapeHtml(article.title)}</div>
          <p class="article-excerpt">${escapeHtml(article.excerpt)}</p>
          <div class="article-meta">
            <span>${escapeHtml(article.date)}</span>
            <span>${escapeHtml(article.readTime || "5 min")} read</span>
          </div>
        </div>
      </div>
    `
      )
      .join("");
  }

  function extractTocFromRenderedProse(proseRoot) {
    const headings = Array.from(proseRoot.querySelectorAll("h2"));
    return headings.map((heading, index) => {
      if (!heading.id) {
        heading.id = `section-${index + 1}`;
      }
      return { id: heading.id, text: heading.textContent || `Section ${index + 1}` };
    });
  }

  async function fetchMarkdown(slug) {
    const response = await fetch(`/content/arsenal/${slug}.md?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Unable to load article (${response.status})`);
    }
    const raw = await response.text();
    return raw.replace(/^---[\s\S]*?---\s*/, "");
  }

  async function openArticleView(slugOrAlias) {
    const map = buildArticleLookupMap(state.articles);
    const article = map.get(slugOrAlias);
    if (!article) {
      showArticleErrorState("Article not found.");
      return;
    }

    indexContainer.classList.add("hidden");
    showArticleLoadingState();
    state.currentArticle = article.slug;
    setCanonicalArticleParam(article.slug);

    try {
      const markdown = await fetchMarkdown(article.slug);
      const proseHtml = renderMarkdown(markdown);

      articleContainer.innerHTML = `
        <div style="padding-top:48px;">
          <button class="btn btn-ghost btn-sm" onclick="goBack()" style="margin-bottom:32px;">← All Articles</button>
          <div style="display:grid;grid-template-columns:1fr 220px;gap:48px;align-items:start;">
            <div>
              <div style="margin-bottom:40px;">
                <div class="article-hero-tag">${escapeHtml(article.category || "Tactical Analysis")}</div>
                <h1 style="font-family:'Playfair Display',serif;font-size:clamp(1.6rem,4vw,2.6rem);font-weight:900;line-height:1.15;letter-spacing:-0.5px;margin-bottom:20px;color:var(--white);">${escapeHtml(
                  article.title
                )}</h1>
                <p style="font-size:15px;color:var(--text-secondary);line-height:1.7;margin-bottom:24px;max-width:640px;">${escapeHtml(
                  article.excerpt
                )}</p>
                <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
                  <span style="font-size:12px;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(
                    article.date
                  )}</span>
                  <span class="badge badge-gray">${escapeHtml(article.readTime || "5 min")} read</span>
                  ${(article.tags || []).map((tag) => `<span class="badge badge-gray">${escapeHtml(tag)}</span>`).join("")}
                </div>
              </div>
              <div class="divider"></div>
              <div class="prose" id="article-prose">${proseHtml}</div>
              <div class="divider"></div>
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-top:32px;">
                <button class="btn btn-ghost" onclick="goBack()">← Back to Articles</button>
                <div style="display:flex;gap:8px;">
                  ${(article.tags || []).map((tag) => `<span class="badge badge-gray">${escapeHtml(tag)}</span>`).join("")}
                </div>
              </div>
              <div style="margin-top:48px;">
                <div class="section-label">Related Reading</div>
                <div class="grid-2" style="margin-top:0;">
                  ${state.articles
                    .filter((candidate) => candidate.slug !== article.slug)
                    .slice(0, 2)
                    .map(
                      (candidate) => `
                    <div class="article-card" onclick="openArticle('${escapeHtml(candidate.slug)}')" style="cursor:pointer;">
                      <div class="article-body">
                        <div class="article-category">${escapeHtml(candidate.category || "Tactical Analysis")}</div>
                        <div class="article-title">${escapeHtml(candidate.title)}</div>
                        <div class="article-meta">
                          <span>${escapeHtml(candidate.date)}</span>
                          <span>${escapeHtml(candidate.readTime || "5 min")} read</span>
                        </div>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            </div>
            <div>
              <div class="toc">
                <div class="toc-title">In This Article</div>
                <div id="article-toc-links"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      const proseRoot = document.getElementById("article-prose");
      const tocItems = extractTocFromRenderedProse(proseRoot);
      const tocRoot = document.getElementById("article-toc-links");
      tocRoot.innerHTML = tocItems
        .map((item) => `<span class="toc-link" onclick="scrollToSection('${escapeHtml(item.id)}')">${escapeHtml(item.text)}</span>`)
        .join("");

      window.scrollTo(0, 0);
    } catch (error) {
      showArticleErrorState(error.message || "Failed to load article.");
    }
  }

  async function loadArticleIndex() {
    showIndexLoadingState();
    const response = await fetch(`/data/articles-index.json?t=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Unable to load article index (${response.status})`);
    }
    const payload = await response.json();
    return payload.articles || [];
  }

  function filterByTag(tag) {
    state.activeTag = tag;
    renderIndexView();
  }

  function goBack() {
    state.currentArticle = null;
    clearArticleParam();
    articleContainer.innerHTML = "";
    renderIndexView();
    window.scrollTo(0, 0);
  }

  function scrollToSection(sectionId) {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function init() {
    try {
      state.articles = await loadArticleIndex();
      renderIndexView();

      const requested = new URLSearchParams(window.location.search).get("article");
      if (requested) {
        await openArticleView(requested);
      }
    } catch (error) {
      showIndexErrorState(error.message || "Failed to load articles.");
    }
  }

  window.filterByTag = filterByTag;
  window.openArticle = openArticleView;
  window.goBack = goBack;
  window.scrollToSection = scrollToSection;

  init();
})();
