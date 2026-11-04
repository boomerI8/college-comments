import { auth, db } from "./firebase-config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, query, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const loginSection = document.getElementById("loginSection");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const adminEmail = document.getElementById("adminEmail");
const adminPassword = document.getElementById("adminPassword");
const loginAlert = document.getElementById("loginAlert");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminTableBody = document.getElementById("adminTableBody");
const searchInput = document.getElementById("searchInput");
const adminUserStatus = document.getElementById("adminUserStatus");

let allComments = [];

onAuthStateChanged(auth, (user) => {
  if (user && !user.isAnonymous) {
    loginSection.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    if (adminUserStatus) {
      adminUserStatus.textContent = `Logged in: ${user.email || "Admin"} (UID: ${user.uid})`;
    }
    loadAllComments();
  } else {
    loginSection.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    if (adminUserStatus) {
      adminUserStatus.textContent = "";
    }
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginAlert.style.display = "none";
  const email = adminEmail.value.trim();
  const password = adminPassword.value;

  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    console.error("Login error:", err);
    loginAlert.textContent = "Invalid email or password.";
    loginAlert.className = "alert alert-error";
    loginAlert.style.display = "block";
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Login";
  }
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
});

function loadAllComments() {
  // Query comments collection directly and sort client-side (avoids index or null timestamp issues)
  const q = collection(db, "comments");

  onSnapshot(q, (snapshot) => {
    allComments = [];
    snapshot.forEach((doc) => {
      allComments.push({ id: doc.id, ...doc.data() });
    });

    // Client-side sorting by createdAt desc
    allComments.sort((a, b) => {
      const timeA = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
      const timeB = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
      return timeB - timeA;
    });

    renderTable(allComments);
  }, (error) => {
    console.error("Admin load error:", error);
    const currentUser = auth.currentUser;
    const userEmail = currentUser ? (currentUser.email || "Unknown email") : "Not signed in";
    const userUid = currentUser ? currentUser.uid : "None";

    adminTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 24px;">
          <p style="color: var(--error); font-weight: 600; font-size: 1rem; margin-bottom: 6px;">
            Missing or Insufficient Permissions
          </p>
          <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">
            Current account: <strong>${escapeHtml(userEmail)}</strong><br>
            <span style="font-family: monospace; font-size: 0.8rem;">UID: ${escapeHtml(userUid)}</span>
          </p>
          <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 500px; margin: 0 auto 16px auto;">
            Ensure the updated <code>firestore.rules</code> are published in your Firebase Console, or log in with an authorized admin account.
          </p>
          <button id="switchAdminBtn" class="btn-secondary" style="width: auto; margin: 0 auto; padding: 6px 16px; font-size: 0.85rem;">
            Sign Out & Switch Account
          </button>
        </td>
      </tr>
    `;

    const switchBtn = document.getElementById("switchAdminBtn");
    if (switchBtn) {
      switchBtn.addEventListener("click", () => signOut(auth));
    }
  });
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.toLowerCase().trim();
  const filtered = allComments.filter(c => 
    (c.recipientName && c.recipientName.toLowerCase().includes(term)) ||
    (c.recipientDepartment && c.recipientDepartment.toLowerCase().includes(term)) ||
    (c.text && c.text.toLowerCase().includes(term)) ||
    (c.uid && c.uid.toLowerCase().includes(term))
  );
  renderTable(filtered);
});

function renderTable(comments) {
  adminTableBody.innerHTML = "";
  if (comments.length === 0) {
    adminTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 18px;">No comments found.</td></tr>`;
    return;
  }

  comments.forEach((c) => {
    let dateStr = "N/A";
    if (c.createdAt) {
      if (typeof c.createdAt.toDate === "function") {
        dateStr = new Date(c.createdAt.toDate()).toLocaleString();
      } else if (c.createdAt.seconds) {
        dateStr = new Date(c.createdAt.seconds * 1000).toLocaleString();
      } else {
        dateStr = new Date(c.createdAt).toLocaleString();
      }
    }

    const shortUid = c.uid ? c.uid.substring(0, 8) + "..." : "Anonymous";
    const recipientName = c.recipientName || "General / Unknown";
    const department = c.recipientDepartment || "—";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(recipientName)}</strong></td>
      <td>${escapeHtml(department)}</td>
      <td>${escapeHtml(c.text || "")}</td>
      <td style="white-space: nowrap;">${dateStr}</td>
      <td style="font-family: monospace;">${shortUid}</td>
    `;
    adminTableBody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
