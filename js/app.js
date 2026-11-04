import { auth, db } from "./firebase-config.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const submitBtn = document.getElementById("submitBtn");
const charCounter = document.getElementById("charCounter");
const alertBox = document.getElementById("alertBox");
const commentsContainer = document.getElementById("commentsContainer");

let currentUser = null;
let lastSubmissionTime = 0;

commentInput.addEventListener("input", () => {
  const count = commentInput.value.length;
  charCounter.textContent = `${count} / 1000`;
});

signInAnonymously(auth).catch((err) => {
  console.error("Auth error:", err);
  showAlert("Failed to connect to anonymous session.", true);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Comment";
    listenToUserComments(user.uid);
  }
});

function listenToUserComments(uid) {
  const q = query(
    collection(db, "comments"),
    where("uid", "==", uid)
  );

  onSnapshot(q, (snapshot) => {
    commentsContainer.innerHTML = "";
    if (snapshot.empty) {
      commentsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">No comments submitted yet.</p>`;
      return;
    }

    const docs = [];
    snapshot.forEach((doc) => {
      docs.push(doc.data());
    });

    docs.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA;
    });

    docs.forEach((data) => {
      const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : "Just now";

      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <div class="comment-text">${escapeHtml(data.text)}</div>
        <div class="comment-date">${dateStr}</div>
      `;
      commentsContainer.appendChild(el);
    });
  }, (error) => {
    console.error("Firestore error:", error);
    commentsContainer.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem;">Error loading comments.</p>`;
  });
}

commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();

  if (!text || !currentUser) return;

  const now = Date.now();
  if (now - lastSubmissionTime < 10000) {
    const remaining = Math.ceil((10000 - (now - lastSubmissionTime)) / 1000);
    showAlert(`Please wait ${remaining} seconds before submitting again.`, true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    await addDoc(collection(db, "comments"), {
      text: text,
      uid: currentUser.uid,
      createdAt: serverTimestamp()
    });

    lastSubmissionTime = Date.now();
    commentInput.value = "";
    charCounter.textContent = "0 / 1000";
    showAlert("Comment submitted successfully!", false);
  } catch (err) {
    console.error("Submit error:", err);
    showAlert("Error submitting comment. Please try again.", true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Comment";
  }
});

function showAlert(msg, isError) {
  alertBox.textContent = msg;
  alertBox.className = `alert ${isError ? "alert-error" : "alert-success"}`;
  alertBox.style.display = "block";
  setTimeout(() => {
    alertBox.style.display = "none";
  }, 4000);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
