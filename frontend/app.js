/**
 * Student ScamGuard AI — Frontend Application Logic
 * Integrates with FastAPI /api/v1/analyze/message with client-side fallback
 */

function getApiBase() {
  const custom = localStorage.getItem("scamguard_api_base");
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }

  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "" ||
    window.location.hostname.startsWith("192.168.");

  if (isLocal) {
    return "http://localhost:8000/api/v1";
  }

  // Deployed production default (Render cloud service)
  return window.RENDER_API_BASE || "https://scamalert-gdzg.onrender.com/api/v1";
}

let API_BASE = getApiBase();

let selectedChannel = "SMS";
let currentAnalysis = null;

// DOM Elements
const messageInput = document.getElementById("message-input");
const charCounter = document.getElementById("char-counter");
const analyzeBtn = document.getElementById("analyze-btn");
const btnIcon = document.getElementById("btn-icon");
const btnText = document.getElementById("btn-text");
const stepperSection = document.getElementById("stepper-section");
const resultsSection = document.getElementById("results-section");
const popover = document.getElementById("highlight-popover");
const backendStatusBadge = document.getElementById("backend-status-badge");

// Sample data for quick hackathon demonstrations
const SAMPLES = {
  internship: {
    text: "Congratulations! You have been selected for Google Summer Internship 2026. Pay Rs 499 registration fee within 10 minutes to confirm your seat: bit.ly/intern-confirm",
    channel: "SMS"
  },
  parttime: {
    text: "Dear Student, earn Rs 3,000 to Rs 5,000 daily working 2 hours from home by liking videos and submitting reviews. No experience needed. Join Telegram now: https://t.me/student_daily_earn",
    channel: "WhatsApp"
  },
  delivery: {
    text: "India Post: Your parcel #IN839201 is held at distribution hub due to incorrect pincode. Update your address within 24 hours at indiapost-tracking.xyz/update to avoid return.",
    channel: "SMS"
  },
  form: {
    text: "Urgent: College Placement Cell registration form for 2026 batch is closing today. Fill details and verify UPI for stipend release: https://forms.gle/xY7291a8Kd91",
    channel: "WhatsApp"
  },
  college: {
    text: "Dear Student, the last date for submitting your 4th semester examination registration fee is 25th October. Please pay via your student portal at https://student.university.ac.in. Do not pay through any unofficial links or UPI IDs.",
    channel: "SMS"
  },
  bank: {
    text: "Dear SBI Customer, your account ending in 4102 was debited with INR 250.00 for UPI transaction on 08-Oct. Available balance is INR 4,820.50. If this was not done by you, forward this SMS to 9223008333 to lock UPI access.",
    channel: "SMS"
  }
};

let soundEnabled = true;

function toggleSound() {
  soundEnabled = !soundEnabled;
  const icon = document.getElementById("sound-icon");
  const text = document.getElementById("sound-text");
  if (soundEnabled) {
    if (icon) icon.textContent = "volume_up";
    if (text) text.textContent = "Sound: ON";
    showToast("Audio feedback enabled", "info");
  } else {
    if (icon) icon.textContent = "volume_off";
    if (text) text.textContent = "Sound: OFF";
    showToast("Audio feedback muted", "info");
  }
}

function playResultSound(severity) {
  if (!soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (severity === "high_risk") {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.25);
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.25);

      setTimeout(() => {
        if (ctx.state === "closed") return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "sawtooth";
        osc2.frequency.setValueAtTime(380, ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.3);
        gain2.gain.setValueAtTime(0.15, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.3);
      }, 140);
    } else if (severity === "suspicious") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "triangle";
      osc1.frequency.setValueAtTime(440, ctx.currentTime);
      gain1.gain.setValueAtTime(0.1, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.2);

      setTimeout(() => {
        if (ctx.state === "closed") return;
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime);
        gain2.gain.setValueAtTime(0.1, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.35);
      }, 100);
    }
  } catch (e) {
    console.debug("Audio autoplay unsupported or disabled:", e);
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  const bg = type === "error" ? "bg-red-600 text-white" : type === "success" ? "bg-emerald-600 text-white" : "bg-gray-900 text-white";
  toast.className = `toast-item ${bg} px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 max-w-sm`;
  toast.innerHTML = `
    <span class="material-symbols-outlined text-sm">${type === "success" ? "check_circle" : type === "error" ? "error" : "info"}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    if (toast.parentElement) toast.remove();
  }, 3000);
}

function shareToWhatsApp() {
  if (!currentAnalysis) {
    showToast("Please analyze a message first", "error");
    return;
  }
  const score = currentAnalysis.risk_score || 0;
  const sev = (currentAnalysis.classification || "Safe").toUpperCase();
  const cat = currentAnalysis.scam_category || "Suspicious Message";
  const actions = (currentAnalysis.safety_actions || []).map(a => `• ${a.action}: ${a.description}`).join("\n");

  const text = `🚨 *Student ScamGuard AI Alert*\n\n*Verdict:* ${sev} (${score}/100 Risk Index)\n*Category:* ${cat}\n\n*Safety Advice:*\n${actions}\n\n⚠️ *Do not send money or click unverified links!* Checked via Student ScamGuard AI.`;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
}

function copyReport() {
  if (!currentAnalysis) {
    showToast("Please analyze a message first", "error");
    return;
  }
  const score = currentAnalysis.risk_score || 0;
  const sev = (currentAnalysis.classification || "Safe").toUpperCase();
  const cat = currentAnalysis.scam_category || "Suspicious Message";
  const indicators = (currentAnalysis.indicators || []).map(i => `- [${(i.severity || 'high').toUpperCase()}] ${i.title}: ${i.description}`).join("\n");
  const actions = (currentAnalysis.safety_actions || []).map(a => `${a.step || 1}. ${a.action} - ${a.description}`).join("\n");

  const reportText = `STUDENT SCAMGUARD AI — SECURITY REPORT
-----------------------------------------
Risk Index: ${score}/100 (${sev})
Category: ${cat}
Source: ${selectedChannel}

DETECTED INDICATORS:
${indicators || "None"}

DEFENSIVE ACTION CHECKLIST:
${actions}

Zero retention student cyber safety evaluation.`;

  navigator.clipboard.writeText(reportText).then(() => {
    showToast("Report copied to clipboard! Ready to paste.", "success");
    const copyBtnText = document.getElementById("copy-btn-text");
    if (copyBtnText) {
      copyBtnText.textContent = "Copied!";
      setTimeout(() => { copyBtnText.textContent = "Copy Warning"; }, 2000);
    }
  }).catch(() => {
    showToast("Could not copy to clipboard", "error");
  });
}

function openLinkInspector(urlData) {
  if (!urlData) return;
  const modal = document.getElementById("link-inspector-modal");
  if (!modal) return;

  const urlStr = urlData.original_url || urlData.url || "";
  const domain = urlData.domain || urlStr.replace(/^https?:\/\//i, "").split("/")[0];
  const verdict = urlData.safety_verdict || (urlData.is_suspicious ? "High Risk (Unverified)" : "Verified Safe");
  const threat = urlData.threat_type || (urlData.is_shortened ? "URL Shortener Mask" : "Web Destination");
  const riskScore = urlData.risk_score !== undefined ? `${urlData.risk_score} / 100` : (urlData.is_suspicious ? "80 / 100" : "10 / 100");
  const explanation = urlData.risk_explanation || (urlData.is_shortened 
    ? "This URL shortener obfuscates the real web destination, frequently utilized in SMS phishing to bypass keyword filters." 
    : "Review domain name carefully before submitting credentials or payments.");

  document.getElementById("inspect-full-url").textContent = urlStr;
  document.getElementById("inspect-domain").textContent = domain;
  
  const verdEl = document.getElementById("inspect-verdict");
  verdEl.textContent = verdict;
  if (verdict.toLowerCase().includes("high") || verdict.toLowerCase().includes("malicious")) {
    verdEl.className = "text-xs font-bold text-red-600";
  } else if (verdict.toLowerCase().includes("suspicious")) {
    verdEl.className = "text-xs font-bold text-amber-600";
  } else {
    verdEl.className = "text-xs font-bold text-emerald-600";
  }

  document.getElementById("inspect-threat").textContent = threat;
  
  const scoreEl = document.getElementById("inspect-score");
  scoreEl.textContent = riskScore;
  scoreEl.className = (parseInt(riskScore) || 0) >= 60 ? "text-xs font-bold text-red-600" : "text-xs font-bold text-emerald-600";

  document.getElementById("inspect-explanation").textContent = explanation;

  modal.classList.remove("hidden");
}


// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Check backend health
  checkBackendHealth();

  // Character counter
  messageInput.addEventListener("input", () => {
    const len = messageInput.value.length;
    charCounter.textContent = `${len} / 5000 characters`;
    if (len > 5000) {
      charCounter.classList.add("text-red-600");
    } else {
      charCounter.classList.remove("text-red-600");
    }
  });

  // Ctrl+Enter keyboard shortcut
  messageInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleAnalyze();
    }
  });

  // Close popover when clicking outside
  document.addEventListener("click", (e) => {
    if (!popover.contains(e.target) && !e.target.closest(".hl-span")) {
      hidePopover();
    }
  });
});

// Channel selector
function setChannel(channel) {
  selectedChannel = channel;
  document.querySelectorAll(".channel-chip").forEach((chip) => {
    if (chip.getAttribute("data-channel") === channel) {
      chip.className = "channel-chip active px-3 py-1 rounded-lg text-xs font-semibold transition-all bg-white text-primary shadow-xs";
    } else {
      chip.className = "channel-chip px-3 py-1 rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary transition-all";
    }
  });
}

// Load sample message
function loadSample(key) {
  const sample = SAMPLES[key];
  if (!sample) return;
  messageInput.value = sample.text;
  setChannel(sample.channel);
  messageInput.dispatchEvent(new Event("input"));
  messageInput.focus();
}

function clearMessage() {
  messageInput.value = "";
  messageInput.dispatchEvent(new Event("input"));
  resultsSection.classList.add("hidden");
  messageInput.focus();
}

function scrollToChecker() {
  document.getElementById("checker-section").scrollIntoView({ behavior: "smooth" });
  messageInput.focus();
}

// Modal management
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

// Check Backend Health
async function checkBackendHealth() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${API_BASE}/health`, { method: "GET", signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const isCloud = API_BASE.includes("onrender.com") || API_BASE.includes("https://");
      backendStatusBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        <span>${isCloud ? "Cloud API Live" : "Backend Live"} (${data.model_loaded ? "Model Ready" : "Standby"})</span>
      `;
      backendStatusBadge.className = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200 hover:border-green-400 transition-all shadow-2xs cursor-pointer";
      backendStatusBadge.title = `Connected to ${API_BASE} (Click to change)`;
      return true;
    } else {
      setBackendOffline();
      return false;
    }
  } catch (err) {
    setBackendOffline();
    return false;
  }
}

function setBackendOffline() {
  const isCloud = API_BASE.includes("onrender.com") || API_BASE.includes("https://");
  backendStatusBadge.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
    <span>${isCloud ? "Cloud Standby" : "Hybrid Engine Active"}</span>
  `;
  backendStatusBadge.className = "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 hover:border-amber-400 transition-all shadow-2xs cursor-pointer";
  backendStatusBadge.title = `Could not reach ${API_BASE}. Click to configure Render endpoint or check wake-up.`;
}

function openApiSettingsModal() {
  const modal = document.getElementById("api-settings-modal");
  const input = document.getElementById("api-url-input");
  const feedback = document.getElementById("api-test-feedback");
  if (modal && input) {
    input.value = API_BASE;
    if (feedback) feedback.innerHTML = "";
    modal.classList.remove("hidden");
    input.focus();
  }
}

async function saveApiSettings() {
  const input = document.getElementById("api-url-input");
  const feedback = document.getElementById("api-test-feedback");
  let val = input.value.trim();

  if (!val) {
    localStorage.removeItem("scamguard_api_base");
    API_BASE = getApiBase();
  } else {
    // Automatically attach /api/v1 if omitted
    if (!val.endsWith("/api/v1")) {
      val = val.replace(/\/+$/, "") + "/api/v1";
    }
    localStorage.setItem("scamguard_api_base", val);
    API_BASE = val;
  }

  if (feedback) {
    feedback.innerHTML = `<span class="text-blue-600 font-semibold flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span> Testing connection to ${escapeHtml(API_BASE)}...</span>`;
  }

  const success = await checkBackendHealth();
  if (feedback) {
    if (success) {
      feedback.innerHTML = `<span class="text-green-600 font-bold">✓ Successfully connected to backend! Model is loaded.</span>`;
      setTimeout(() => closeModal("api-settings-modal"), 1200);
      showToast("API endpoint updated & verified", "success");
    } else {
      feedback.innerHTML = `<span class="text-amber-700 font-medium">⚠️ Endpoint saved. Note: Free Render services take 30–50s to wake up on first ping. Retrying automatically.</span>`;
      showToast("API endpoint saved (instance waking up)", "info");
    }
  }
}

function resetApiSettings() {
  localStorage.removeItem("scamguard_api_base");
  API_BASE = getApiBase();
  const input = document.getElementById("api-url-input");
  if (input) input.value = API_BASE;
  const feedback = document.getElementById("api-test-feedback");
  if (feedback) feedback.innerHTML = `<span class="text-text-secondary">Reset to auto-detected default: <code>${escapeHtml(API_BASE)}</code></span>`;
  checkBackendHealth();
}

// Main Analyze Handler
async function handleAnalyze() {
  const text = messageInput.value.trim();
  if (!text) {
    alert("Please paste or type a message to analyze.");
    messageInput.focus();
    return;
  }

  // Set loading state
  analyzeBtn.disabled = true;
  btnIcon.textContent = "hourglass_top";
  btnIcon.classList.add("animate-spin");
  btnText.textContent = "Analyzing...";

  // Show and run Stepper animation
  stepperSection.classList.remove("hidden");
  stepperSection.scrollIntoView({ behavior: "smooth", block: "nearest" });

  let analysisResult = null;

  // Run stepper visual sequence in parallel with fetch
  const stepperPromise = runStepperAnimation();

  try {
    const response = await fetch(`${API_BASE}/analyze/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: text,
        source_channel: selectedChannel.toLowerCase()
      })
    });

    if (response.ok) {
      analysisResult = await response.json();
    } else {
      console.warn("Backend API responded with error, falling back to local hybrid engine");
      analysisResult = localFallbackAnalyze(text, selectedChannel);
    }
  } catch (err) {
    console.warn("Network error connecting to backend, using local hybrid engine:", err);
    analysisResult = localFallbackAnalyze(text, selectedChannel);
  }

  // Wait for stepper animation to finish smoothly
  await stepperPromise;

  // Render Result
  renderAnalysisResult(analysisResult, text);

  // Reset button state
  analyzeBtn.disabled = false;
  btnIcon.textContent = "radar";
  btnIcon.classList.remove("animate-spin");
  btnText.textContent = "Analyze Message";

  // Hide stepper & show results
  stepperSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  resultsSection.scrollIntoView({ behavior: "smooth" });
}

// Stepper visual animation
async function runStepperAnimation() {
  const steps = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
    document.getElementById("step-4"),
    document.getElementById("step-5")
  ];

  for (let i = 0; i < steps.length; i++) {
    // activate current step
    steps.forEach((s, idx) => {
      if (idx === i) {
        s.className = "step-card active p-3 rounded-xl border border-primary bg-blue-50/60 flex flex-col gap-1 transition-all";
        s.querySelector("span:first-child").className = "w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[10px]";
      } else if (idx < i) {
        s.className = "step-card done p-3 rounded-xl border border-green-300 bg-green-50/50 flex flex-col gap-1 transition-all";
        s.querySelector("span:first-child").className = "w-4 h-4 rounded-full bg-green-600 text-white flex items-center justify-center text-[10px]";
      } else {
        s.className = "step-card p-3 rounded-xl border border-border bg-gray-50 flex flex-col gap-1 transition-all";
        s.querySelector("span:first-child").className = "w-4 h-4 rounded-full bg-gray-300 text-white flex items-center justify-center text-[10px]";
      }
    });
    await new Promise((r) => setTimeout(r, 180));
  }
}

// Render Results based on API response
function renderAnalysisResult(result, rawText) {
  currentAnalysis = result;

  const score = result.risk_score || 0;
  const severity = (result.classification || "safe").toLowerCase();

  // 1. Breadcrumb bar
  const reportId = "SG-" + Math.floor(10000 + Math.random() * 90000);
  document.getElementById("report-id-label").textContent = `Scam Report #${reportId}`;
  document.getElementById("analyzed-timestamp").textContent = `Analyzed just now · Source: ${selectedChannel}`;

  const headerPill = document.getElementById("header-risk-pill");
  const headerDot = document.getElementById("header-risk-dot");
  const headerText = document.getElementById("header-risk-text");

  if (severity === "high_risk") {
    headerPill.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-red-50 text-red-700 border-red-200";
    headerDot.className = "w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse";
    headerText.textContent = "CRITICAL RISK ALERT";
  } else if (severity === "suspicious") {
    headerPill.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-amber-50 text-amber-700 border-amber-200";
    headerDot.className = "w-1.5 h-1.5 rounded-full bg-amber-500";
    headerText.textContent = "SUSPICIOUS WARNING";
  } else {
    headerPill.className = "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border bg-green-50 text-green-700 border-green-200";
    headerDot.className = "w-1.5 h-1.5 rounded-full bg-green-600";
    headerText.textContent = "SAFE MESSAGE";
  }

  // 2. Result Assessment Hero Card
  const scoreDisplay = document.getElementById("risk-score-display");
  scoreDisplay.textContent = score;

  const severityBadge = document.getElementById("severity-badge-container");
  const severityIcon = document.getElementById("severity-icon");
  const severityLabel = document.getElementById("severity-text");
  const summaryCopy = document.getElementById("summary-copy");
  const threatLabel = document.getElementById("meter-threat-label");
  const pin = document.getElementById("meter-pin");
  const pinArrow = document.getElementById("pin-arrow");
  const pinBar = document.getElementById("pin-bar");
  const modelTag = document.getElementById("model-tag");

  // Format ML model info
  if (result.ml_prediction) {
    const prob = Math.round((result.ml_prediction.spam_probability || 0) * 100);
    const lbl = result.ml_prediction.label || "evaluated";
    modelTag.textContent = `Model: ${lbl}, ${prob}%`;
  } else {
    modelTag.textContent = "Model: calibrated rules";
  }

  // Position pin needle
  const clampedScore = Math.max(2, Math.min(98, score));
  pin.style.left = `${clampedScore}%`;

  if (severity === "high_risk") {
    scoreDisplay.className = "font-display text-5xl lg:text-6xl font-extrabold leading-none tracking-tight text-high-risk-main";
    severityBadge.className = "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-xs bg-high-risk-bg text-high-risk-text border-high-risk-main/40";
    severityIcon.textContent = "shield_alert";
    severityIcon.className = "material-symbols-outlined text-xl text-high-risk-main";
    severityLabel.textContent = "HIGH RISK";
    summaryCopy.textContent = "This message contains multiple severe warning signs typical of scams targeting students.";
    threatLabel.textContent = `${score}% High Threat`;
    threatLabel.className = "text-xs font-bold text-high-risk-main";
    pinArrow.className = "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-high-risk-main";
    pinBar.className = "w-1.5 h-3 bg-high-risk-main rounded-full";
  } else if (severity === "suspicious") {
    scoreDisplay.className = "font-display text-5xl lg:text-6xl font-extrabold leading-none tracking-tight text-suspicious-main";
    severityBadge.className = "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-xs bg-suspicious-bg text-suspicious-text border-suspicious-main/40";
    severityIcon.textContent = "warning";
    severityIcon.className = "material-symbols-outlined text-xl text-suspicious-main";
    severityLabel.textContent = "SUSPICIOUS";
    summaryCopy.textContent = "A few warning signs were found. Exercise extreme caution before clicking links or replying.";
    threatLabel.textContent = `${score}% Moderate Suspicion`;
    threatLabel.className = "text-xs font-bold text-suspicious-main";
    pinArrow.className = "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-suspicious-main";
    pinBar.className = "w-1.5 h-3 bg-suspicious-main rounded-full";
  } else {
    scoreDisplay.className = "font-display text-5xl lg:text-6xl font-extrabold leading-none tracking-tight text-safe-main";
    severityBadge.className = "inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-xs bg-safe-bg text-safe-text border-safe-main/40";
    severityIcon.textContent = "shield_check";
    severityIcon.className = "material-symbols-outlined text-xl text-safe-main";
    severityLabel.textContent = "SAFE MESSAGE";
    summaryCopy.textContent = "No major warning signs detected. The message is consistent with legitimate college/transaction alerts.";
    threatLabel.textContent = `${score}% Low Risk`;
    threatLabel.className = "text-xs font-bold text-safe-main";
    pinArrow.className = "w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[6px] border-b-safe-main";
    pinBar.className = "w-1.5 h-3 bg-safe-main rounded-full";
  }

  // Scam Category Badge
  const catBadge = document.getElementById("scam-category-badge");
  const catText = document.getElementById("scam-category-text");
  if (catBadge && catText) {
    if (result.scam_category && result.scam_category !== "Generic Scam") {
      catText.textContent = result.scam_category;
      catBadge.classList.remove("hidden");
    } else if (severity === "high_risk" || severity === "suspicious") {
      const firstInd = (result.indicators && result.indicators[0]) ? result.indicators[0].title : "Suspicious Pattern";
      catText.textContent = firstInd;
      catBadge.classList.remove("hidden");
    } else {
      catBadge.classList.add("hidden");
    }
  }

  // Play audio cue
  playResultSound(severity);

  // 3. Highlighted Message Evidence
  renderHighlightedMessage(rawText, result.evidence_spans || [], result.extracted_urls || []);

  // 4. Extracted Links
  renderExtractedLinks(result.extracted_urls || []);

  // 5. Why We Flagged It (Indicators)
  renderIndicators(result.indicators || []);

  // 6. What You Should Do (Actions)
  renderActions(result.safety_actions || [], severity);
}

// Render highlighted spans in raw text
function renderHighlightedMessage(text, evidenceSpans, urls) {
  const container = document.getElementById("highlighted-message-container");
  container.innerHTML = "";

  document.getElementById("source-meta-snippet").textContent = `Channel source: ${selectedChannel}`;

  if (!evidenceSpans.length && !urls.length) {
    container.textContent = text;
    return;
  }

  // Build sorted list of highlight spans
  const highlights = [];

  evidenceSpans.forEach((span, idx) => {
    highlights.push({
      start: span.start_idx,
      end: span.end_idx,
      type: "indicator",
      severity: (span.severity || "high").toLowerCase(),
      title: span.title || span.indicator_name || "Suspicious Signal",
      description: span.description || "Identified scam pattern.",
      number: idx + 1,
      targetId: `indicator-card-${idx + 1}`
    });
  });

  // Also highlight URLs if not already covered
  urls.forEach((url, idx) => {
    const urlStr = url.original_url || url.url || "";
    const startIdx = text.indexOf(urlStr);
    if (startIdx !== -1) {
      const endIdx = startIdx + urlStr.length;
      // check overlap
      const overlaps = highlights.some((h) => !(endIdx <= h.start || startIdx >= h.end));
      if (!overlaps) {
        highlights.push({
          start: startIdx,
          end: endIdx,
          type: "link",
          severity: url.is_suspicious ? "high" : "link",
          title: "Link Destination",
          description: url.is_shortened ? "Shortened unverified link URL" : "Embedded hyperlink",
          number: highlights.length + 1,
          targetId: "extracted-links-card"
        });
      }
    }
  });

  // Sort by start index
  highlights.sort((a, b) => a.start - b.start);

  // Render text with spans
  let currentIdx = 0;
  highlights.forEach((hl) => {
    if (hl.start > currentIdx) {
      container.appendChild(document.createTextNode(text.substring(currentIdx, hl.start)));
    }

    const spanEl = document.createElement("span");
    const matchedSubstring = text.substring(hl.start, hl.end);

    let hlClass = "hl-high";
    let badgeBg = "bg-high-risk-main text-white";
    if (hl.type === "link") {
      hlClass = "hl-link";
      badgeBg = "bg-primary text-white";
    } else if (hl.severity === "medium" || hl.severity === "suspicious") {
      hlClass = "hl-medium";
      badgeBg = "bg-suspicious-main text-white";
    } else if (hl.severity === "low" || hl.severity === "safe") {
      hlClass = "hl-low";
      badgeBg = "bg-amber-600 text-white";
    }

    spanEl.className = `${hlClass} hl-span relative`;
    spanEl.textContent = matchedSubstring;

    const badge = document.createElement("span");
    badge.className = `hl-badge ${badgeBg}`;
    badge.textContent = hl.number;
    spanEl.appendChild(badge);

    // Interactive event listeners
    spanEl.addEventListener("mouseenter", (e) => showPopover(e, hl));
    spanEl.addEventListener("click", (e) => {
      e.stopPropagation();
      showPopover(e, hl);
      jumpToCard(hl.targetId);
    });

    container.appendChild(spanEl);
    currentIdx = hl.end;
  });

  if (currentIdx < text.length) {
    container.appendChild(document.createTextNode(text.substring(currentIdx)));
  }
}

// Popover Tooltip for Highlights
function showPopover(e, hl) {
  const rect = e.target.getBoundingClientRect();
  popover.classList.remove("hidden");

  document.getElementById("popover-badge-num").textContent = hl.number;
  document.getElementById("popover-title").textContent = hl.title;
  document.getElementById("popover-desc").textContent = hl.description;
  document.getElementById("popover-category").textContent = `Signal ${hl.number} · ${hl.severity.toUpperCase()}`;

  const sevBadge = document.getElementById("popover-severity");
  if (hl.severity === "high" || hl.type === "high") {
    sevBadge.className = "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-red-100 text-red-800";
    sevBadge.textContent = "High Risk";
  } else if (hl.severity === "medium") {
    sevBadge.className = "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800";
    sevBadge.textContent = "Suspicious";
  } else {
    sevBadge.className = "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800";
    sevBadge.textContent = "Detected";
  }

  const jumpBtn = document.getElementById("popover-jump-btn");
  jumpBtn.onclick = () => {
    hidePopover();
    jumpToCard(hl.targetId);
  };

  // Position popover
  const top = window.scrollY + rect.bottom + 8;
  const left = Math.max(16, Math.min(window.innerWidth - 340, window.scrollX + rect.left));
  popover.style.top = `${top}px`;
  popover.style.left = `${left}px`;
}

function hidePopover() {
  popover.classList.add("hidden");
}

function jumpToCard(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("card-flash");
    setTimeout(() => el.classList.remove("card-flash"), 1200);
  }
}

// Render Extracted Links Card
function renderExtractedLinks(urls) {
  const card = document.getElementById("extracted-links-card");
  const countHeader = document.getElementById("links-header");
  const statusBadge = document.getElementById("links-status-badge");
  const list = document.getElementById("links-list-container");

  list.innerHTML = "";

  if (!urls.length) {
    card.classList.add("hidden");
    return;
  }

  card.classList.remove("hidden");
  countHeader.textContent = `Detected Links (${urls.length})`;

  // Cache for modal inspector
  window.lastExtractedUrls = urls;

  const hasHighRisk = urls.some((u) => u.safety_verdict === "High Risk" || u.is_suspicious || u.is_shortened);
  const hasSuspicious = urls.some((u) => u.safety_verdict === "Suspicious");

  if (hasHighRisk) {
    statusBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200";
    statusBadge.textContent = "High Risk Destinations";
  } else if (hasSuspicious) {
    statusBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200";
    statusBadge.textContent = "Unverified Destinations";
  } else {
    statusBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold border bg-green-50 text-green-700 border-green-200";
    statusBadge.textContent = "Verified Educational / Safe";
  }

  urls.forEach((url, idx) => {
    const urlStr = url.original_url || url.url || "";
    const isShort = url.is_shortened;
    const verdict = url.safety_verdict || (url.is_suspicious ? "High Risk" : "Verified Safe");
    const threatType = url.threat_type || (isShort ? "URL Shortener Mask" : "Standard Web Link");
    const explanation = url.risk_explanation || (isShort ? "URL shorteners hide the true destination website, a primary tactic used in SMS phishing." : "Verify domain ownership before accessing.");
    const isHigh = verdict.toLowerCase().includes("high") || verdict.toLowerCase().includes("malicious") || url.is_suspicious;

    const div = document.createElement("div");
    div.className = "p-3.5 rounded-xl border border-border bg-gray-50/80 flex flex-col gap-2.5 transition-all";
    div.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="w-6 h-6 rounded ${isHigh ? "bg-red-100 text-red-600" : "bg-blue-100 text-primary"} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-sm">${isHigh ? "warning" : "link"}</span>
          </span>
          <span class="font-mono text-xs font-bold text-primary truncate" title="${escapeHtml(urlStr)}">${escapeHtml(urlStr)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] uppercase font-bold ${isHigh ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"} px-2 py-0.5 rounded">
            ${escapeHtml(verdict)}
          </span>
          <button type="button" onclick="openLinkInspector(window.lastExtractedUrls[${idx}])" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white hover:bg-gray-100 border border-gray-300 text-text-primary transition-colors shadow-2xs">
            <span class="material-symbols-outlined text-xs text-primary">travel_explore</span>
            Inspect
          </button>
        </div>
      </div>
      <div class="flex flex-col gap-1 text-xs">
        <div class="flex items-center gap-2 text-[11px] text-text-secondary">
          <span class="font-semibold text-text-primary">Threat Type:</span>
          <span>${escapeHtml(threatType)}</span>
          ${url.domain ? `<span class="text-border">·</span><span class="font-mono text-gray-600">${escapeHtml(url.domain)}</span>` : ""}
        </div>
        <p class="text-xs text-text-secondary leading-relaxed">
          ${escapeHtml(explanation)}
        </p>
      </div>
    `;
    list.appendChild(div);
  });
}

// Render Why We Flagged It (Indicators)
function renderIndicators(indicators) {
  const badge = document.getElementById("indicator-count-badge");
  const list = document.getElementById("indicators-list-container");
  list.innerHTML = "";

  badge.textContent = `${indicators.length} indicator${indicators.length === 1 ? "" : "s"}`;

  if (!indicators.length) {
    list.innerHTML = `
      <div class="p-4 rounded-xl border border-green-200 bg-green-50 text-xs text-green-800 flex items-center gap-2">
        <span class="material-symbols-outlined text-green-600">check_circle</span>
        <span>No known scam indicators or pressure patterns detected in this message.</span>
      </div>
    `;
    return;
  }

  indicators.forEach((ind, idx) => {
    const num = idx + 1;
    const sev = (ind.severity || "high").toLowerCase();

    let icon = "warning";
    let iconBg = "bg-red-100 text-red-600";
    let sevBadge = "bg-red-100 text-red-800";
    if (sev === "medium") {
      icon = "report_problem";
      iconBg = "bg-amber-100 text-amber-600";
      sevBadge = "bg-amber-100 text-amber-800";
    } else if (sev === "low") {
      icon = "info";
      iconBg = "bg-blue-100 text-primary";
      sevBadge = "bg-blue-100 text-blue-800";
    }

    const card = document.createElement("div");
    card.id = `indicator-card-${num}`;
    card.className = "p-4 rounded-xl border border-border bg-surface shadow-xs transition-all";
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="flex items-center gap-2">
          <span class="w-6 h-6 rounded-full ${iconBg} flex items-center justify-center text-xs font-bold">
            ${num}
          </span>
          <h3 class="font-display font-bold text-sm text-text-primary">
            ${escapeHtml(ind.title || ind.code || "Scam Pattern")}
          </h3>
        </div>
        <span class="text-[10px] uppercase font-bold px-2 py-0.5 rounded ${sevBadge}">
          ${escapeHtml(sev)}
        </span>
      </div>
      <p class="text-xs text-text-secondary leading-relaxed mb-2.5">
        ${escapeHtml(ind.description || ind.reason || "Suspicious linguistic or structural indicator.")}
      </p>
      ${ind.matched_text ? `
        <div class="bg-gray-50 border border-gray-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs text-text-primary">
          <span class="text-text-secondary text-[11px] font-semibold">Matched:</span>
          <span class="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200 text-red-700">"${escapeHtml(ind.matched_text)}"</span>
        </div>
      ` : ""}
    `;
    list.appendChild(card);
  });
}

// Render Defensive Actions
function renderActions(actions, severity) {
  const list = document.getElementById("actions-list-container");
  list.innerHTML = "";

  if (!actions.length) {
    actions = [
      { step: 1, action: "Verify independently", description: "If in doubt, contact your college administration or official helpline directly." },
      { step: 2, action: "Never share OTP or PINs", description: "Legitimate organizations will never ask for your passwords or one-time codes." }
    ];
  }

  actions.forEach((act, idx) => {
    const num = act.step || idx + 1;
    const item = document.createElement("div");
    item.className = "p-3.5 rounded-xl border border-border bg-surface shadow-xs flex items-start gap-3";
    item.innerHTML = `
      <span class="w-6 h-6 rounded-full bg-blue-100 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        ${num}
      </span>
      <div class="flex flex-col gap-0.5">
        <h4 class="font-bold text-xs text-text-primary">
          ${escapeHtml(act.action || act.title || "Defensive Step")}
        </h4>
        <p class="text-xs text-text-secondary leading-relaxed">
          ${escapeHtml(act.description || act.detail || "")}
        </p>
      </div>
    `;
    list.appendChild(item);
  });
}

// Local Fallback Heuristic Engine (Ensures 100% demo resilience)
function localFallbackAnalyze(text, channel) {
  const lower = text.toLowerCase();
  const evidence_spans = [];
  const indicators = [];
  const extracted_urls = [];
  let score = 5;

  // Extract URLs (multi-pattern matching backend preprocessing)
  const urlPatterns = [
    /https?:\/\/[^\s<>"'()]+/gi,
    /\b(?:t\.me|wa\.me|chat\.whatsapp\.com|forms\.gle|bit\.ly|tinyurl\.com|goo\.gl|is\.gd|cutt\.ly)\/[^\s<>"'()]+/gi,
    /\b[a-zA-Z0-9-]+\.(?:xyz|top|site|club|buzz|guru|click|fit|cfd|work|vip)(?:\/[^\s<>"'()]*)?/gi
  ];

  const foundUrls = new Set();
  urlPatterns.forEach((pat) => {
    let match;
    while ((match = pat.exec(text)) !== null) {
      let rawUrl = match[0].replace(/[.,;:!?)]+$/, "");
      if (rawUrl) foundUrls.add(rawUrl);
    }
  });

  let detectedCategory = "Generic Suspicion";

  foundUrls.forEach((urlStr) => {
    const isShort = /bit\.ly|tinyurl|goo\.gl|cutt\.ly|is\.gd/i.test(urlStr);
    const isHighTld = /\.(xyz|top|site|club|buzz|click|fit|cfd|work|vip)/i.test(urlStr);
    const isMessaging = /t\.me|wa\.me|chat\.whatsapp/i.test(urlStr);
    const isForm = /forms\.gle|docs\.google\.com\/forms/i.test(urlStr);
    const isWhitelisted = /\.(ac\.in|edu\.in|gov\.in)\b/i.test(urlStr);

    let verdict = "Verified Safe";
    let threatType = "Standard Link";
    let riskExplanation = "Standard web link; verify domain ownership before browsing.";
    let linkRisk = 10;
    let isSusp = false;

    if (isWhitelisted) {
      verdict = "Verified Legitimate";
      threatType = "Verified Institutional Domain";
      riskExplanation = "Domain belongs to recognized educational or government institution (.ac.in / .gov.in).";
      linkRisk = 0;
    } else if (isShort) {
      verdict = "High Risk";
      threatType = "URL Shortener Mask";
      riskExplanation = "URL shortener disguises actual landing address, commonly used to bypass filters.";
      linkRisk = 85;
      isSusp = true;
      score += 25;
      detectedCategory = "Phishing Redirect Scam";
    } else if (isHighTld) {
      verdict = "High Risk";
      threatType = "High-Risk Domain Extension (TLD)";
      riskExplanation = "Disposable domain extension frequently registered for phishing operations.";
      linkRisk = 90;
      isSusp = true;
      score += 30;
      detectedCategory = "Phishing Site Scam";
    } else if (isMessaging) {
      verdict = "Suspicious";
      threatType = "Off-Platform Messaging Channel";
      riskExplanation = "Attempts to divert student to untracked channel (Telegram/WhatsApp group) where moderation is absent.";
      linkRisk = 75;
      isSusp = true;
      score += 25;
      detectedCategory = "Part-Time Task Scam";
    } else if (isForm) {
      verdict = "Suspicious";
      threatType = "Unverified Public Form";
      riskExplanation = "Free form submission link with zero institutional access control.";
      linkRisk = 60;
      isSusp = true;
      score += 15;
      detectedCategory = "Fake Placement Form Scam";
    }

    const domain = urlStr.replace(/^https?:\/\//i, "").split("/")[0];
    extracted_urls.push({
      original_url: urlStr,
      domain: domain,
      is_shortened: isShort,
      is_suspicious: isSusp,
      safety_verdict: verdict,
      threat_type: threatType,
      risk_score: linkRisk,
      risk_explanation: riskExplanation
    });
  });

  // Rule 1: Upfront Fee
  const feeRegex = /(pay\s+(?:rs\.?|₹)?\s*\d+|registration\s+fee|security\s+deposit|processing\s+fee)/i;
  const feeMatch = text.match(feeRegex);
  if (feeMatch) {
    score += 35;
    detectedCategory = "Internship Registration Scam";
    const start = text.indexOf(feeMatch[0]);
    evidence_spans.push({
      start_idx: start,
      end_idx: start + feeMatch[0].length,
      severity: "high",
      title: "Upfront Fee Demand",
      description: "Legitimate internships and student opportunities never require upfront registration or security fees.",
      matched_text: feeMatch[0]
    });
    indicators.push({
      code: "PAYMENT_REQUEST",
      title: "Upfront Payment Request",
      severity: "high",
      description: "The message requests an upfront monetary fee. Authentic student job offers do not demand registration money.",
      matched_text: feeMatch[0]
    });
  }

  // Rule 2: Urgency
  const urgRegex = /(within\s+\d+\s+(?:minutes?|hours?)|immediately|hurry|today\s+only|confirm\s+seat|held\s+at\s+distribution|avoid\s+return)/i;
  const urgMatch = text.match(urgRegex);
  if (urgMatch) {
    score += 20;
    const start = text.indexOf(urgMatch[0]);
    evidence_spans.push({
      start_idx: start,
      end_idx: start + urgMatch[0].length,
      severity: "medium",
      title: "Artificial Urgency Pressure",
      description: "Scammers use countdown timers and panic triggers to rush you into acting before you can verify authenticity.",
      matched_text: urgMatch[0]
    });
    indicators.push({
      code: "URGENCY",
      title: "Artificial Urgency Pressure",
      severity: "medium",
      description: "Creates artificial panic or FOMO to prevent you from conducting due diligence.",
      matched_text: urgMatch[0]
    });
  }

  // Rule 3: Guaranteed Selection or Task Lure
  const selRegex = /(congratulations!|you\s+have\s+been\s+selected|guaranteed\s+income|earn\s+rs\s+\d+|daily\s+working\s+\d+\s+hours|by\s+liking\s+videos)/i;
  const selMatch = text.match(selRegex);
  if (selMatch) {
    score += 20;
    if (text.toLowerCase().includes("liking") || text.toLowerCase().includes("telegram")) {
      detectedCategory = "Telegram Part-Time Task Ponzi";
    } else {
      detectedCategory = "Unsolicited Internship Scam";
    }
    const start = text.indexOf(selMatch[0]);
    evidence_spans.push({
      start_idx: start,
      end_idx: start + selMatch[0].length,
      severity: "high",
      title: "Unsolicited Selection / High Income Promise",
      description: "Offers high earnings or selection without prior interview, screening, or formal application.",
      matched_text: selMatch[0]
    });
    indicators.push({
      code: "GUARANTEED_SELECTION",
      title: "Unsolicited Selection / Ponzi Lure",
      severity: "high",
      description: "Promises easy money or claims selection without legitimate credentials.",
      matched_text: selMatch[0]
    });
  }

  // Check institutional safe indicators
  if (text.includes(".ac.in") && !feeMatch && !selMatch) {
    score = 5;
    detectedCategory = "Legitimate Institutional Notice";
  }

  // Determine classification
  const finalScore = Math.min(98, Math.max(5, score));
  let classification = "safe";
  if (finalScore >= 60) classification = "high_risk";
  else if (finalScore >= 30) classification = "suspicious";

  return {
    risk_score: finalScore,
    classification: classification,
    scam_category: detectedCategory,
    ml_prediction: {
      label: finalScore >= 50 ? "spam" : "ham",
      spam_probability: roundTo(finalScore / 100, 2),
      ham_probability: roundTo(1 - finalScore / 100, 2)
    },
    evidence_spans: evidence_spans,
    indicators: indicators,
    extracted_urls: extracted_urls,
    safety_actions: [
      { step: 1, action: "Do not pay any fee", description: "Never send money via UPI, QR code, or payment links for job offers." },
      { step: 2, action: "Do not click unverified links", description: "Avoid clicking shortened or suspicious web links from unknown numbers." },
      { step: 3, action: "Verify with official channels", description: "Check company careers portals or university placement offices directly." }
    ]
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function roundTo(num, decimals) {
  return Number(Math.round(num + "e" + decimals) + "e-" + decimals);
}
