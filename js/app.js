import { auth, db } from "./firebase-config.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDoc, addDoc, query, where, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const recipientHeader = document.getElementById("recipientHeader");
const recipientDisplayName = document.getElementById("recipientDisplayName");
const recipientDepartment = document.getElementById("recipientDepartment");
const noRecipientNotice = document.getElementById("noRecipientNotice");

const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const submitBtn = document.getElementById("submitBtn");
const charCounter = document.getElementById("charCounter");
const alertBox = document.getElementById("alertBox");
const commentsContainer = document.getElementById("commentsContainer");

let currentUser = null;
let lastSubmissionTime = 0;
let recipientProfile = null;
let recipientId = null;

// Parse recipient ID from query string (?to=PUBLICID)
const urlParams = new URLSearchParams(window.location.search);
recipientId = urlParams.get("to");

commentInput.addEventListener("input", () => {
  const count = commentInput.value.length;
  charCounter.textContent = `${count} / 1000`;
});

// Initialize anonymous auth for the commenter
signInAnonymously(auth).catch((err) => {
  console.error("Auth error:", err);
  showAlert("Failed to connect to anonymous session.", true);
});

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    if (recipientId) {
      await loadRecipientInfo(recipientId);
    } else {
      showNoRecipientState();
    }
    listenToUserComments(user.uid);
  }
});

async function loadRecipientInfo(id) {
  try {
    const profileSnap = await getDoc(doc(db, "profiles", id));
    if (profileSnap.exists()) {
      recipientProfile = profileSnap.data();
      recipientDisplayName.textContent = recipientProfile.displayName || "Recipient";
      if (recipientProfile.department) {
        recipientDepartment.textContent = recipientProfile.department;
        recipientDepartment.style.display = "block";
      } else {
        recipientDepartment.style.display = "none";
      }
      recipientHeader.classList.remove("hidden");
      noRecipientNotice.classList.add("hidden");

      submitBtn.disabled = false;
      submitBtn.textContent = `Submit Comment for ${recipientProfile.displayName}`;
    } else {
      recipientHeader.classList.add("hidden");
      noRecipientNotice.innerHTML = `
        <p style="color: var(--error); font-weight: 600;">Recipient profile not found.</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
          The link or QR code might be outdated. Please verify with the recipient.
        </p>
      `;
      noRecipientNotice.classList.remove("hidden");
      submitBtn.disabled = true;
      submitBtn.textContent = "Recipient Not Found";
    }
  } catch (err) {
    console.error("Error fetching recipient profile:", err);
    showAlert("Error retrieving recipient information.", true);
    submitBtn.disabled = true;
    submitBtn.textContent = "Error Loading Recipient";
  }
}

function showNoRecipientState() {
  recipientHeader.classList.add("hidden");
  noRecipientNotice.innerHTML = `
    <p style="font-weight: 600; color: var(--text);">No Recipient Selected</p>
    <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
      Please scan a recipient's personal QR code or open a link with <code>?to=RECIPIENT_ID</code> to send a comment to someone.
    </p>
    <div style="margin-top: 10px;">
      <a href="signup.html" style="font-size: 0.85rem; color: var(--primary); font-weight: 500;">
        Are you a recipient? Get your personal QR card &rarr;
      </a>
    </div>
  `;
  noRecipientNotice.classList.remove("hidden");
  submitBtn.disabled = true;
  submitBtn.textContent = "Scan a QR Code to Comment";
}

// Comment submission
commentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = commentInput.value.trim();

  if (!text || !currentUser) return;

  if (!recipientId || !recipientProfile) {
    showAlert("Please scan a valid recipient QR code before submitting.", true);
    return;
  }

  const now = Date.now();
  if (now - lastSubmissionTime < 10000) {
    const remaining = Math.ceil((10000 - (now - lastSubmissionTime)) / 1000);
    showAlert(`Please wait ${remaining} seconds before submitting again.`, true);
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    // Add recipientName and recipientDepartment copied from the profile
    await addDoc(collection(db, "comments"), {
      text: text,
      uid: currentUser.uid,
      recipientId: recipientId,
      recipientUid: recipientProfile.uid,
      recipientName: recipientProfile.displayName,
      recipientDepartment: recipientProfile.department || "",
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
    submitBtn.textContent = `Submit Comment for ${recipientProfile.displayName}`;
  }
});

// Real-time listener for current user's submitted comments
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
    snapshot.forEach((docSnap) => {
      docs.push(docSnap.data());
    });

    // Client-side sorting with no orderBy plus where
    docs.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA;
    });

    docs.forEach((data) => {
      const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : "Just now";
      const recipientName = data.recipientName || "General";
      const recipientDept = data.recipientDepartment ? `<span class="badge">${escapeHtml(data.recipientDepartment)}</span>` : "";

      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <div class="comment-recipient-tag">
          To: <strong>${escapeHtml(recipientName)}</strong> ${recipientDept}
        </div>
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
