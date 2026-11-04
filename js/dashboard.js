import { auth, db } from "./firebase-config.js";
import { 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  doc, 
  getDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// DOM elements
const displayRecipientName = document.getElementById("displayRecipientName");
const displayRecipientDept = document.getElementById("displayRecipientDept");
const toggleEditBtn = document.getElementById("toggleEditBtn");
const editSection = document.getElementById("editSection");
const editForm = document.getElementById("editForm");
const editFullName = document.getElementById("editFullName");
const editDepartment = document.getElementById("editDepartment");
const editAlert = document.getElementById("editAlert");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const qrCardName = document.getElementById("qrCardName");
const qrCardDept = document.getElementById("qrCardDept");
const qrcodeContainer = document.getElementById("qrcode");
const qrTargetUrlEl = document.getElementById("qrTargetUrl");
const downloadPngBtn = document.getElementById("downloadPngBtn");
const printBtn = document.getElementById("printBtn");
const previewPageLink = document.getElementById("previewPageLink");

const commentsList = document.getElementById("commentsList");
const commentCountBadge = document.getElementById("commentCountBadge");
const logoutBtn = document.getElementById("logoutBtn");

let currentUser = null;
let currentPublicId = null;
let currentProfile = null;
let qrcodeInstance = null;
let targetUrl = "";

onAuthStateChanged(auth, async (user) => {
  if (!user || user.isAnonymous) {
    window.location.href = "signup.html?mode=login";
    return;
  }
  currentUser = user;
  await loadRecipientProfile(user.uid);
});

async function loadRecipientProfile(uid) {
  try {
    // 1. Check if publicId is in URL query (?id=...)
    const urlParams = new URLSearchParams(window.location.search);
    const paramId = urlParams.get("id") || localStorage.getItem("currentPublicId");

    if (paramId) {
      const snap = await getDoc(doc(db, "profiles", paramId));
      if (snap.exists() && snap.data().uid === uid) {
        currentPublicId = paramId;
        currentProfile = snap.data();
      }
    }

    // 2. If not found via URL/storage, query profiles by uid
    if (!currentProfile) {
      const q = query(collection(db, "profiles"), where("uid", "==", uid));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const firstDoc = qSnap.docs[0];
        currentPublicId = firstDoc.id;
        currentProfile = firstDoc.data();
        localStorage.setItem("currentPublicId", currentPublicId);
      }
    }

    if (!currentProfile) {
      displayRecipientName.textContent = "Profile Not Found";
      displayRecipientDept.textContent = "Please sign up to create your profile.";
      return;
    }

    updateUI();
    generateQR();
    listenToReceivedComments(uid);
  } catch (err) {
    console.error("Error loading profile:", err);
    displayRecipientName.textContent = "Error loading profile";
  }
}

function updateUI() {
  displayRecipientName.textContent = currentProfile.displayName || "Unknown Name";
  displayRecipientDept.textContent = currentProfile.department || "No department specified";

  qrCardName.textContent = currentProfile.displayName || "Your Name";
  qrCardDept.textContent = currentProfile.department || "";
  qrCardDept.style.display = currentProfile.department ? "block" : "none";

  editFullName.value = currentProfile.displayName || "";
  editDepartment.value = currentProfile.department || "";
}

function generateQR() {
  const loc = window.location;
  const path = loc.pathname.substring(0, loc.pathname.lastIndexOf("/") + 1);
  targetUrl = `${loc.origin}${path}index.html?to=${currentPublicId}`;

  qrTargetUrlEl.textContent = targetUrl;
  previewPageLink.href = targetUrl;

  qrcodeContainer.innerHTML = "";
  // Generate QR code using qrcodejs
  if (window.QRCode) {
    qrcodeInstance = new window.QRCode(qrcodeContainer, {
      text: targetUrl,
      width: 200,
      height: 200,
      colorDark: "#0f172a",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.H
    });
  }
}

// Edit name toggle
toggleEditBtn.addEventListener("click", () => {
  editSection.classList.toggle("hidden");
  editAlert.style.display = "none";
});

cancelEditBtn.addEventListener("click", () => {
  editSection.classList.add("hidden");
  editAlert.style.display = "none";
});

// Save edited name and department (updates displayName and department only)
editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  editAlert.style.display = "none";

  const rawName = editFullName.value;
  const trimmedName = rawName.trim();

  // Validate Full Name
  if (!trimmedName || trimmedName.length < 2) {
    showEditAlert("Full name must be at least 2 characters.", true);
    return;
  }
  if (trimmedName.length > 60) {
    showEditAlert("Full name must not exceed 60 characters.", true);
    return;
  }
  const nameRegex = /^[\p{L}\s.\-]+$/u;
  if (!nameRegex.test(trimmedName)) {
    showEditAlert("Full name can only contain letters, spaces, dots, and hyphens.", true);
    return;
  }

  // Validate Department
  const trimmedDept = editDepartment.value.trim();
  if (trimmedDept.length > 60) {
    showEditAlert("Department must not exceed 60 characters.", true);
    return;
  }

  saveEditBtn.disabled = true;
  saveEditBtn.textContent = "Saving...";

  try {
    // Only displayName and department are updated
    await updateDoc(doc(db, "profiles", currentPublicId), {
      displayName: trimmedName,
      department: trimmedDept
    });

    currentProfile.displayName = trimmedName;
    currentProfile.department = trimmedDept;

    updateUI();
    showEditAlert("Profile updated successfully!", false);
    setTimeout(() => {
      editSection.classList.add("hidden");
      editAlert.style.display = "none";
    }, 1500);
  } catch (err) {
    console.error("Update error:", err);
    showEditAlert("Error updating profile. Please try again.", true);
  } finally {
    saveEditBtn.disabled = false;
    saveEditBtn.textContent = "Save Changes";
  }
});

function showEditAlert(msg, isError) {
  editAlert.textContent = msg;
  editAlert.className = `alert ${isError ? "alert-error" : "alert-success"}`;
  editAlert.style.display = "block";
}

// Download PNG with full name, department, and QR code rendered on single canvas
downloadPngBtn.addEventListener("click", () => {
  const qrImg = qrcodeContainer.querySelector("canvas") || qrcodeContainer.querySelector("img");
  if (!qrImg) {
    alert("QR code is still generating. Please try again in a moment.");
    return;
  }

  // Create high-res canvas
  const canvas = document.createElement("canvas");
  const width = 640;
  const height = 760;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  // Top header accent line
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, 0, width, 14);

  // Logo text
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#1e3a8a";
  ctx.textAlign = "center";
  ctx.fillText("CAMPUS VOICE", width / 2, 55);

  // Full Name
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(currentProfile.displayName || "Recipient", width / 2, 98);

  // Department line
  let nextY = 130;
  if (currentProfile.department) {
    ctx.font = "16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText(currentProfile.department, width / 2, nextY);
    nextY += 30;
  }

  // Draw QR code centered
  const qrSize = 360;
  const qrX = (width - qrSize) / 2;
  const qrY = nextY + 10;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Subtitle instructions
  const footerY = qrY + qrSize + 40;
  ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("Scan with any camera to leave an anonymous comment", width / 2, footerY);

  // Direct URL
  ctx.font = "12px monospace";
  ctx.fillStyle = "#1e3a8a";
  ctx.fillText(targetUrl, width / 2, footerY + 28);

  // Trigger download
  const safeName = (currentProfile.displayName || "qr-card").replace(/[^a-zA-Z0-9_\-]/g, "_");
  const link = document.createElement("a");
  link.download = `${safeName}-qr.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Print QR Card
printBtn.addEventListener("click", () => {
  window.print();
});

// Logout
logoutBtn.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem("currentPublicId");
  window.location.href = "signup.html?mode=login";
});

// Listen to comments received for this recipient
function listenToReceivedComments(uid) {
  const q = query(
    collection(db, "comments"),
    where("recipientUid", "==", uid)
  );

  onSnapshot(q, (snapshot) => {
    commentsList.innerHTML = "";
    commentCountBadge.textContent = snapshot.size;

    if (snapshot.empty) {
      commentsList.innerHTML = `
        <div class="card" style="text-align: center; color: var(--text-muted);">
          No comments received yet. Share your QR card to start receiving feedback!
        </div>`;
      return;
    }

    const docs = [];
    snapshot.forEach((docSnap) => {
      docs.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Client-side sorting by createdAt desc (no orderBy in query)
    docs.sort((a, b) => {
      const timeA = a.createdAt ? a.createdAt.toMillis() : Date.now();
      const timeB = b.createdAt ? b.createdAt.toMillis() : Date.now();
      return timeB - timeA;
    });

    docs.forEach((data) => {
      const dateStr = data.createdAt ? new Date(data.createdAt.toDate()).toLocaleString() : "Just now";
      const shortUid = data.uid ? data.uid.substring(0, 8) + "..." : "Anonymous";

      const el = document.createElement("div");
      el.className = "comment-item";
      el.innerHTML = `
        <div class="comment-text">${escapeHtml(data.text || "")}</div>
        <div class="meta-row" style="margin-bottom: 0;">
          <span class="comment-date">${dateStr}</span>
          <span style="font-family: monospace; font-size: 0.75rem; color: var(--text-muted);">From: ${shortUid}</span>
        </div>
      `;
      commentsList.appendChild(el);
    });
  }, (err) => {
    console.error("Comments error:", err);
    commentsList.innerHTML = `<div class="card" style="color: var(--error);">Error loading comments: ${escapeHtml(err.message)}</div>`;
  });
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]);
}
