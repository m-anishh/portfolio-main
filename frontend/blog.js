let allPosts = [];
let showingAllPosts = false;

async function fetchPosts() {
  const res = await fetch("/api/posts");
  if (res.ok) return res.json();

  const seedRes = await fetch("data/blog-posts.json");
  if (!seedRes.ok) {
    throw new Error(`Unable to load posts: ${res.status}`);
  }

  return seedRes.json();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatDate(iso) {
  return new Date(iso.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function readTime(content) {
  const words = content.replace(/<[^>]*>/g, " ").trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

function tableOfContents(content) {
  const headings = [...content.matchAll(/^#{1,3}\s+(.+)$/gm)]
    .map((match) => match[1].replace(/[*_`]/g, "").trim())
    .filter(Boolean)
    .slice(0, 12);

  if (headings.length === 0) return "";

  return `
    <details class="blog-toc">
      <summary>Table of Contents <span>+</span></summary>
      <ol>
        ${headings.map((heading) => `<li>${escapeHtml(heading)}</li>`).join("")}
      </ol>
    </details>
  `;
}

function coverImgHtml(post) {
  if (post.cover_image) {
    return `<img src="${escapeHtml(post.cover_image)}" alt="" />`;
  }

  const initial = (post.title || "?").trim().charAt(0).toUpperCase();
  return `<div class="blog-img-placeholder"><span>${escapeHtml(initial)}</span></div>`;
}

function postCardHtml(post) {
  return `
    <a href="blog.html?slug=${encodeURIComponent(post.slug)}" class="blog-card">
      <div class="blog-card-img">
        ${coverImgHtml(post)}
      </div>
      <div class="blog-card-body">
        <div class="blog-meta">
          <span>${formatDate(post.created_at)}</span>
          <span>&middot;</span>
          <span>${readTime(post.content)} min read</span>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <div class="blog-stats">
          <span><i class="far fa-comment"></i> ${post.comment_count || 0}</span>
          <span><i class="fas fa-heart"></i> ${post.likes || 0}</span>
        </div>
      </div>
    </a>
  `;
}

function renderList() {
  const gridEl = document.getElementById("blogGrid");
  const showMoreButton = document.getElementById("showMorePosts");

  if (allPosts.length === 0) {
    gridEl.innerHTML = "<p>No posts in this category yet.</p>";
    showMoreButton.hidden = true;
    return;
  }

  const visiblePosts = showingAllPosts ? allPosts : allPosts.slice(0, 3);

  gridEl.innerHTML = visiblePosts.map(postCardHtml).join("");
  showMoreButton.hidden = showingAllPosts || allPosts.length <= 3;
}

async function loadList() {
  try {
    allPosts = await fetchPosts();

    const withCounts = await Promise.all(
      allPosts.map(async (post) => {
        try {
          const cRes = await fetch(`/api/posts/${encodeURIComponent(post.slug)}/comments`);
          const comments = await cRes.json();
          post.comment_count = Array.isArray(comments) ? comments.length : 0;
        } catch {
          post.comment_count = 0;
        }
        return post;
      }),
    );

    allPosts = withCounts;
    renderList();
  } catch (err) {
    document.getElementById("blogGrid").innerHTML = "<p>Failed to load posts.</p>";
  }
}

document.getElementById("showMorePosts")?.addEventListener("click", () => {
  showingAllPosts = true;
  renderList();
});

async function loadComments(slug, listEl) {
  const res = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`);
  const comments = await res.json();

  listEl.innerHTML =
    comments.length === 0
      ? "<p style='color: var(--gray-text)'>No comments yet. Be the first!</p>"
      : comments
          .map(
            (c) => `
          <div class="blog-comment">
            <strong>${escapeHtml(c.name)}</strong>
            <span class="blog-meta">${formatDate(c.created_at)}</span>
            <p>${escapeHtml(c.body)}</p>
          </div>
        `,
          )
          .join("");

  return comments.length;
}

async function loadSinglePost(slug) {
  document.body.classList.add("blog-single-page");
  document.getElementById("blogListView").style.display = "none";
  const postView = document.getElementById("blogPostView");
  postView.style.display = "block";

  try {
    const res = await fetch(`/api/posts/${encodeURIComponent(slug)}`);
    let post;

    if (res.ok) {
      post = await res.json();
    } else {
      const posts = await fetchPosts();
      post = posts.find((item) => item.slug === slug);
    }

    if (!post) {
      postView.innerHTML = "<p>Post not found.</p><a href='blog.html' class='btn secondary'>Back to Blog</a>";
      return;
    }

    postView.innerHTML = `
      <a href="blog.html" class="blog-back-link">&larr; Back to all posts</a>
      <div class="blog-post-header">
        <h1>${escapeHtml(post.title)}</h1>
        <div class="blog-post-meta">
          <span>Manish Bista</span>
          <span>&middot;</span>
          <span>${formatDate(post.created_at)}</span>
          <span>&middot;</span>
          <span>${readTime(post.content)} min read</span>
          <span>&middot;</span>
          <span>${escapeHtml(post.category || "General")}</span>
        </div>
        <p class="blog-post-excerpt">${escapeHtml(post.excerpt)}</p>
      </div>
      ${post.cover_image ? `<img class="blog-post-cover" src="${escapeHtml(post.cover_image)}" alt="" />` : ""}
      ${tableOfContents(post.content)}
      <div class="blog-content">${marked.parse(post.content)}</div>

      <div class="blog-like-row">
        <button id="likeBtn" class="btn secondary"><i class="fas fa-heart"></i> <span id="likeCount">${post.likes || 0}</span></button>
      </div>

      <div class="blog-comments">
        <h3>Comments</h3>
        <div id="commentList"></div>

        <form id="commentForm" class="contact-form" style="margin-top: 20px">
          <div class="form-group">
            <input type="text" id="commentName" placeholder="Your Name" required maxlength="80" />
          </div>
          <div class="form-group">
            <textarea id="commentBody" placeholder="Write a comment..." required maxlength="2000"></textarea>
          </div>
          <button type="submit" class="btn primary">Post Comment</button>
        </form>
      </div>

      <div id="relatedPosts"></div>
    `;

    loadComments(slug, document.getElementById("commentList"));
    loadRelatedPosts(post);

    document.getElementById("likeBtn").addEventListener("click", async () => {
      const r = await fetch(`/api/posts/${encodeURIComponent(slug)}/like`, { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        document.getElementById("likeCount").textContent = data.likes;
      }
    });

    document.getElementById("commentForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("commentName").value;
      const body = document.getElementById("commentBody").value;

      const r = await fetch(`/api/posts/${encodeURIComponent(slug)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });

      if (r.ok) {
        document.getElementById("commentForm").reset();
        loadComments(slug, document.getElementById("commentList"));
      } else {
        const data = await r.json().catch(() => ({}));
        alert(data.error || "Failed to post comment");
      }
    });
  } catch (err) {
    postView.innerHTML = "<p>Failed to load post.</p>";
  }
}

async function loadRelatedPosts(currentPost) {
  const container = document.getElementById("relatedPosts");
  if (!container) return;

  try {
    const posts = await fetchPosts();

    const others = posts.filter((p) => p.slug !== currentPost.slug);
    const sameCategory = others.filter((p) => p.category === currentPost.category);
    const rest = others.filter((p) => p.category !== currentPost.category);
    const related = [...sameCategory, ...rest].slice(0, 3);

    if (related.length === 0) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
      <h3 class="blog-related-title">You might also like</h3>
      <div class="blog-grid">${related.map(postCardHtml).join("")}</div>
    `;
  } catch (err) {
    container.innerHTML = "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (slug) {
    loadSinglePost(slug);
  } else {
    loadList();
  }
});
