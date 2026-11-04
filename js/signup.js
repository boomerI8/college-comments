import { auth, db } from "./firebase-config.js";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  doc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const signupForm = document.getElementById("signupForm");
const signupFields = document.getElementById("signupFields");
const fullNameInput = document.getElementById("fullName");
const departmentInput = document.getElementById("department");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const alertBox = document.getElementById("alertBox");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");
const toggleModeBtn = document.getElementById("toggleModeBtn");
const toggleText = document.getElementById("toggleText");

let isLoginMode = false;

// Check if user came with ?mode=login
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("mode") === "login") {
  setLoginMode(true);
}

// Check auth state
onAuthStateChanged(auth, async (user) => {
  if (user && !user.isAnonymous) {
    // If user already logged in, check if they have a profile and go to dashboard
    window.location.href = "dashboard.html";
  }
});

toggleModeBtn.addEventListener("click", (e) => {
  e.preventDefault();
  setLoginMode(!isLoginMode);
});

function setLoginMode(login) {
  isLoginMode = login;
  if (isLoginMode) {
    signupFields.style.display = "none";
    fullNameInput.removeAttribute("required");
    pageTitle.textContent = "Recipient Login";
    pageSubtitle.textContent = "Log in to manage your comments and view your QR card";
    submitBtn.textContent = "Log In to Dashboard";
    toggleText.textContent = "Don't have an account yet?";
    toggleModeBtn.textContent = "Sign up here";
  } else {
    signupFields.style.display = "block";
    fullNameInput.setAttribute("required", "true");
    pageTitle.textContent = "Receive Comments";
    pageSubtitle.textContent = "Create your profile and get your personal QR code";
    submitBtn.textContent = "Create My QR Profile";
    toggleText.textContent = "Already have an account?";
    toggleModeBtn.textContent = "Log in here";
  }
  clearAlert();
}

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (isLoginMode) {
    // Login flow
    submitBtn.disabled = true;
    submitBtn.textContent = "Logging in...";
    try {
      await signInWithEmailAndPassword(auth, email, password);
      window.location.href = "dashboard.html";
    } catch (err) {
      console.error("Login error:", err);
      showAlert(getReadableAuthError(err.code || err.message), true);
      submitBtn.disabled = false;
      submitBtn.textContent = "Log In to Dashboard";
    }
    return;
  }

  // Sign-up flow: Validate Full Name
  const rawName = fullNameInput.value;
  const trimmedName = rawName.trim();

  // Block sign-up if full name is empty or too short
  if (!trimmedName || trimmedName.length < 2) {
    showAlert("Full name is required and must be between 2 and 60 characters.", true);
    fullNameInput.focus();
    return;
  }

  if (trimmedName.length > 60) {
    showAlert("Full name must not exceed 60 characters.", true);
    fullNameInput.focus();
    return;
  }

  // Allowed characters: letters, spaces, dots, hyphens only
  const nameRegex = /^[\p{L}\s.\-]+$/u;
  if (!nameRegex.test(trimmedName)) {
    showAlert("Full name can only contain letters, spaces, dots, and hyphens.", true);
    fullNameInput.focus();
    return;
  }

  // Validate optional department
  const trimmedDept = departmentInput.value.trim();
  if (trimmedDept.length > 60) {
    showAlert("Department or class must not exceed 60 characters.", true);
    departmentInput.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating Profile...";

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid = cred.user.uid;

    // Generate publicId for profile
    const profileRef = doc(collection(db, "profiles"));
    const publicId = profileRef.id;

    // Save in profiles/{publicId}: { uid, displayName, department, createdAt }
    await setDoc(profileRef, {
      uid: uid,
      displayName: trimmedName,
      department: trimmedDept || "",
      createdAt: serverTimestamp()
    });

    // Store in localStorage for instant access and redirect
    localStorage.setItem("currentPublicId", publicId);
    window.location.href = `dashboard.html?id=${publicId}`;
  } catch (err) {
    console.error("Sign-up error:", err);
    showAlert(getReadableAuthError(err.code || err.message), true);
    submitBtn.disabled = false;
    submitBtn.textContent = "Create My QR Profile";
  }
});

function showAlert(message, isError) {
  alertBox.textContent = message;
  alertBox.className = `alert ${isError ? "alert-error" : "alert-success"}`;
  alertBox.style.display = "block";
}

function clearAlert() {
  alertBox.style.display = "none";
  alertBox.textContent = "";
}

function getReadableAuthError(code) {
  if (code.includes("email-already-in-use")) return "This email is already registered. Please log in.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid email address.";
  if (code.includes("user-not-found") || code.includes("wrong-password") || code.includes("invalid-credential")) {
    return "Invalid email or password.";
  }
  return "An error occurred: " + code;
}
