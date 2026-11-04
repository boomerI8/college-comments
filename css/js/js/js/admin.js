import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginSection = document.getElementById("loginSection");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginAlert = document.getElementById("loginAlert");
const logoutBtn = document.getElementById("logoutBtn");
const adminTableBody = document.getElementById("adminTableBody");
const searchInput = document.getElementById("searchInput");

let allComments = [];

onAuthStateChanged(auth, (user) => {
  if (user && !user.isAnonymous) {
    loginSection.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    loadAllComments();
  } else {
    loginSection.classList.remove("hidden");
    adminPanel.classList.add("hidden");
  }
});

// Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = adminEmail.value.trim();
  const password = adminPassword.value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    loginAlert.textContent = "Invalid credentials.";
    loginAlert.className = "alert alert-error";
    loginAlert.style.display = "block";
  }
});

// Logout
logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

// Load all comments (Admin view)
function loadAllComments() {
  const q = query(collection(db, "comments"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snapshot) => {
    allComments = [];
    snapshot.forEach((doc) => {
      allComments.push({ id: doc.id, ...doc.data() });
    });
    renderTable(allComments);
  }, (error) => {
    adminTableBody.innerHTML = `<tr><td colspan="3" style="color: var(--error);">Permission denied or load error.</td></tr>`;
  });
}

// Search Filter
searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase();
  const filtered = allComments.filter(c => 
    (c.text && c.text.toLowerCase().includes(term)) ||
    (c.uid && c.uid.toLowerCase().includes(term))
  );
  renderTable(filtered);
});

function renderTable(comments) {
  adminTableBody.innerHTML = "";
  if (comments.length === 0) {
    adminTableBody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">No comments found.</td></tr>`;
    return;
  }

  comments.forEach((c) => {
    const dateStr = c.createdAt ? new Date(c.createdAt.toDate()).toLocaleString() : "N/A";
    const shortUid = c.uid ? c.uid.substring(0, 8) + "..." : "Anonymous";
    
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="white-space: nowrap;">${dateStr}</td>
      <td style="font-family: monospace;">${shortUid}</td>
      <td>${escapeHtml(c.text || "")}</td>
    `;
    adminTableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
