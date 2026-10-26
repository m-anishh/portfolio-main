const loginBox = document.getElementById("loginBox");
const adminBox = document.getElementById("adminBox");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const newPostBtn = document.getElementById("newPostBtn");
const cancelBtn = document.getElementById("cancelBtn");
const postForm = document.getElementById("postForm");
const postList = document.getElementById("postList");
const postFilterTabs = document.getElementById("postFilterTabs");
const generateDraftBtn = document.getElementById("generateDraftBtn");

let allAdminPosts = [];
let postFilter = "all";

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value || "";
  return div.innerHTML;
}

postFilterTabs.querySelectorAll(".blog-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    postFilterTabs.querySelectorAll(".blog-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    postFilter = btn.getAttribute("data-filter");
    renderPostList();
  });
});

async function checkSession() {
  const res = await fetch("/api/auth/session");
  const data = await res.json();

  if (data.isAdmin) {
    loginBox.style.display = "none";
    adminBox.style.display = "block";
    loadPosts();
  } else {
    loginBox.style.display = "block";
    adminBox.style.display = "none";
  }
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const password = document.getElementById("password").value;

  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (res.ok) {
    loginForm.reset();
    checkSession();
  } else {
    const data = await res.json().catch(() => ({}));
    loginError.textContent = data.error || "Login failed";
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  checkSession();
});

function showForm(post) {
  postForm.style.display = "flex";
  postForm.style.flexDirection = "column";
  postForm.scrollIntoView({ behavior: "smooth", block: "start" });
  postForm.querySelector("h2").textContent = post ? "Edit Post" : "Create Post";
  document.querySelector(".ai-draft-controls").hidden = !!post;

  document.getElementById("postId").value = post ? post.id : "";
  document.getElementById("title").value = post ? post.title : "";
  document.getElementById("excerpt").value = post ? post.excerpt || "" : "";
  document.getElementById("coverImage").value = post ? post.cover_image || "" : "";
  document.getElementById("category").value = post ? post.category || "" : "";
  document.getElementById("content").value = post ? post.content : "";
  document.getElementById("published").checked = post ? !!post.published : false;

  document.getElementById("uploadStatus").textContent = "";
  const preview = document.getElementById("coverImagePreview");
  if (post && post.cover_image) {
    preview.src = post.cover_image;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
}

function hideForm() {
  postForm.style.display = "none";
  postForm.reset();
  document.getElementById("coverImagePreview").style.display = "none";
  document.getElementById("uploadStatus").textContent = "";
  document.getElementById("aiStatus").textContent = "";
}

generateDraftBtn.addEventListener("click", async () => {
  const topic =
    document.getElementById("aiTopic").value.trim() ||
    document.getElementById("title").value.trim();
  const status = document.getElementById("aiStatus");

  if (!topic) {
    status.textContent = "Enter a topic or title first.";
    return;
  }

  generateDraftBtn.disabled = true;
  status.textContent = "Generating...";

  try {
    const res = await fetch("/api/ai/blog-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        category: document.getElementById("category").value,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      status.textContent = data.error || "Generation failed.";
      return;
    }

    document.getElementById("title").value = data.title;
    document.getElementById("excerpt").value = data.excerpt;
    document.getElementById("content").value = data.content;
    status.textContent = "Draft generated.";
  } catch {
    status.textContent = "Generation failed.";
  } finally {
    generateDraftBtn.disabled = false;
  }
});

document.getElementById("coverImageFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById("uploadStatus");
  statusEl.textContent = "Uploading...";

  const formData = new FormData();
  formData.append("image", file);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();

    if (res.ok) {
      document.getElementById("coverImage").value = data.url;
      const preview = document.getElementById("coverImagePreview");
      preview.src = data.url;
      preview.style.display = "block";
      statusEl.textContent = "Uploaded.";
    } else {
      statusEl.textContent = data.error || "Upload failed";
    }
  } catch (err) {
    statusEl.textContent = "Upload failed";
  } finally {
    e.target.value = "";
  }
});

newPostBtn.addEventListener("click", () => showForm(null));
cancelBtn.addEventListener("click", hideForm);

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const id = document.getElementById("postId").value;

  const payload = {
    title: document.getElementById("title").value,
    excerpt: document.getElementById("excerpt").value,
    cover_image: document.getElementById("coverImage").value,
    category: document.getElementById("category").value,
    content: document.getElementById("content").value,
    published: document.getElementById("published").checked,
  };

  const url = id ? `/api/posts/${id}` : "/api/posts";
  const method = id ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    hideForm();
    loadPosts();
  } else if (res.status === 401) {
    alert("Your session expired. Please log in again.");
    checkSession();
  } else {
    const data = await res.json().catch(() => ({}));
    alert(data.error || "Failed to save post");
  }
});

async function loadPosts() {
  const res = await fetch("/api/posts?all=1");
  if (res.status === 401) {
    checkSession();
    return;
  }
  if (!res.ok) {
    postList.innerHTML = "<p>Could not load posts.</p>";
    return;
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    postList.innerHTML = "<p>Could not load posts.</p>";
    return;
  }

  allAdminPosts = data;
  renderPostList();
}

function renderPostList() {
  const posts = allAdminPosts.filter((post) => {
    if (postFilter === "public") return !!post.published;
    if (postFilter === "private") return !post.published;
    return true;
  });

  if (posts.length === 0) {
    postList.innerHTML = "<p>No posts here.</p>";
    return;
  }

  postList.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Title</th>
            <th>Status</th>
            <th>Engagement</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  const tableBody = postList.querySelector("tbody");

  posts.forEach((post, index) => {
    const tableRow = document.createElement("tr");
    tableRow.innerHTML = `
      <td>${index + 1}</td>
      <td>
        <strong>${escapeHtml(post.title)}</strong>
        <small>${escapeHtml(post.excerpt || "No excerpt")}</small>
      </td>
      <td><span class="admin-status ${post.published ? "published" : "draft"}">${post.published ? "Published" : "Draft"}</span></td>
      <td class="admin-engagement">
        <div class="admin-engagement-inner">
          <span><i class="far fa-heart"></i> ${post.likes || 0}</span>
          <span><i class="far fa-comment"></i> ${post.comment_count || 0}</span>
        </div>
      </td>
      <td>
        <div class="admin-post-actions">
        <a href="blog.html?slug=${encodeURIComponent(post.slug)}" target="_blank" class="btn secondary">View</a>
        <button type="button" class="btn secondary comments-btn">Comments</button>
        <button type="button" class="btn secondary edit-btn">Edit</button>
        <button type="button" class="btn secondary delete-btn">Delete</button>
        </div>
        <div class="admin-comments" hidden></div>
      </td>
    `;

    tableRow.querySelector(".comments-btn").addEventListener("click", async (event) => {
      const commentsEl = tableRow.querySelector(".admin-comments");
      if (!commentsEl.hidden) {
        commentsEl.hidden = true;
        event.target.textContent = "Comments";
        return;
      }

      event.target.disabled = true;
      event.target.textContent = "Loading...";
      try {
        const res = await fetch(
          `/api/posts/${encodeURIComponent(post.slug)}/comments/admin`,
        );
        const comments = await res.json();
        commentsEl.innerHTML = Array.isArray(comments) && comments.length
          ? comments
              .map(
                (comment) => `
                  <div class="admin-comment">
                    <strong>${escapeHtml(comment.name)}</strong>
                    <span>${new Date(comment.created_at.replace(" ", "T") + "Z").toLocaleString()}</span>
                    <p>${escapeHtml(comment.body)}</p>
                  </div>
                `,
              )
              .join("")
          : "<p>No comments yet.</p>";
        commentsEl.hidden = false;
        event.target.textContent = "Hide Comments";
      } catch {
        commentsEl.innerHTML = "<p>Could not load comments.</p>";
        commentsEl.hidden = false;
        event.target.textContent = "Comments";
      } finally {
        event.target.disabled = false;
      }
    });

    tableRow.querySelector(".edit-btn").addEventListener("click", () => showForm(post));
    tableRow.querySelector(".delete-btn").addEventListener("click", async () => {
      if (!confirm(`Delete "${post.title}"?`)) return;

      const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });

      if (res.ok) {
        loadPosts();
      } else {
        alert("Failed to delete post");
      }
    });

    tableBody.appendChild(tableRow);
  });
}

checkSession();
