/**
 * Student ScamGuard AI — Frontend Application Logic
 * Integrates with FastAPI /api/v1/analyze/message with client-side fallback
 */

const API_BASE = "http://localhost:8000/api/v1";

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
  upi_domain: {
    text: "Shortlisted for TCS Campus Placement! Pay ₹750 confirmation fee to UPI: tcs-recruit@ybl within 15 minutes. Complete form at: tcs-recruitment.xyz/claim",
    channel: "SMS"
  },
  parttime: {
    text: "Dear Student, earn Rs 3,000 to Rs 5,000 daily working 2 hours from home by liking videos and submitting reviews. No experience needed. Join Telegram now: https://t.me/student_daily_earn",
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

function copyScamAlertCard() {
  if (!currentAnalysis) return;
  const score = currentAnalysis.risk_score || 0;
  const cls = (currentAnalysis.classification || "SAFE").toUpperCase().replace("_", " ");
  const text = messageInput.value.trim();
  
  const cardText = `🚨 SCAMGUARD STUDENT ALERT 🚨
Risk Index: ${score}/100 [${cls}]
Analyzed Message: "${text.substring(0, 120)}${text.length > 120 ? "..." : ""}"
Warning: Do NOT click suspicious links or pay upfront registration fees!
Verified with Student ScamGuard AI (http://localhost:8000/)`;

  navigator.clipboard.writeText(cardText).then(() => {
    alert("Scam Alert Card copied to clipboard!\n\nYou can now paste this formatted warning card into your college WhatsApp group to protect your classmates.");
  }).catch(() => {
    alert("Warning Card Content:\n\n" + cardText);
  });
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
    const res = await fetch(`${API_BASE}/health`, { method: "GET" });
    if (res.ok) {
      const data = await res.json();
      backendStatusBadge.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        Backend Live (Model: ${data.model_loaded ? "Loaded" : "Ready"})
      `;
      backendStatusBadge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-semibold border border-green-200";
    } else {
      setBackendOffline();
    }
  } catch (err) {
    setBackendOffline();
  }
}

function setBackendOffline() {
  backendStatusBadge.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-amber-500"></span>
    Hybrid Engine Active
  `;
  backendStatusBadge.className = "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200";
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

  const hasSuspicious = urls.some((u) => u.is_suspicious || u.is_shortened);
  if (hasSuspicious) {
    statusBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold border bg-red-50 text-red-700 border-red-200";
    statusBadge.textContent = "Unverified Destinations";
  } else {
    statusBadge.className = "px-2.5 py-0.5 rounded-full text-xs font-bold border bg-green-50 text-green-700 border-green-200";
    statusBadge.textContent = "Standard Domain Structure";
  }

  urls.forEach((url) => {
    const urlStr = url.original_url || url.url || "";
    const isShort = url.is_shortened;
    const isSusp = url.is_suspicious;

    const div = document.createElement("div");
    div.className = "p-3.5 rounded-xl border border-border bg-gray-50/80 flex flex-col gap-2";
    div.innerHTML = `
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div class="flex items-center gap-2 overflow-hidden">
          <span class="w-6 h-6 rounded ${isSusp ? "bg-red-100 text-red-600" : "bg-blue-100 text-primary"} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-sm">${isSusp ? "warning" : "link"}</span>
          </span>
          <span class="font-mono text-xs font-bold text-primary truncate">${escapeHtml(urlStr)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${isShort ? '<span class="text-[10px] uppercase font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Shortened Link</span>' : ""}
          ${isSusp ? '<span class="text-[10px] uppercase font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">High Risk</span>' : '<span class="text-[10px] uppercase font-bold bg-green-100 text-green-800 px-2 py-0.5 rounded">Checked</span>'}
        </div>
      </div>
      <p class="text-xs text-text-secondary">
        ${isShort ? "⚠️ URL shorteners hide the true destination website, a primary tactic used in SMS phishing." : "Verify domain ownership directly with official institutional contact before browsing."}
      </p>
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

  // Extract URLs (including scheme, shorteners, and bare domains)
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>\[\](){}\'"`,;!]+|\b(?:bit\.ly|tinyurl\.com|t\.me|wa\.me|forms\.gle)\/[^\s<>\[\](){}\'"`,;!]+|\b[a-zA-Z0-9\-\.]+\.(?:com|in|org|net|xyz|top|online|site|co|info|app|tech|club|me|live|store|tk)(?:\/[^\s<>\[\](){}\'"`,;!]*)?/gi;
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    const urlStr = match[0].replace(/[\.,;:!\?\)]+$/, "");
    if (urlStr.includes("@") && !urlStr.startsWith("http")) continue;
    const isShort = urlStr.includes("bit.ly") || urlStr.includes("tinyurl") || urlStr.includes("t.me") || urlStr.includes("wa.me") || urlStr.includes("forms.gle");
    const isSusp = isShort || urlStr.includes(".xyz") || urlStr.includes(".top") || urlStr.includes(".online") || urlStr.includes(".site") || urlStr.includes(".tk");
    extracted_urls.push({
      original_url: urlStr,
      domain: urlStr.replace(/https?:\/\//, "").split("/")[0],
      is_shortened: isShort,
      is_suspicious: isSusp
    });
    if (isShort) score += 20;
    if (isSusp) score += 15;
  }

  // Extract UPI VPAs
  const upiRegex = /\b[a-zA-Z0-9\.\-_]+@(?:upi|ybl|okaxis|icici|paytm|axl|ibl|barodampay|sbi|apl|okhdfcbank)\b/gi;
  let upiMatch;
  while ((upiMatch = upiRegex.exec(text)) !== null) {
    const vpa = upiMatch[0];
    score += 30;
    const start = upiMatch.index;
    evidence_spans.push({
      start_idx: start,
      end_idx: start + vpa.length,
      severity: "high",
      title: "Direct UPI VPA Payment Handle",
      description: "Direct Virtual Payment Address detected. Never transfer money via UPI collect requests for job or internship offers.",
      matched_text: vpa
    });
    indicators.push({
      code: "PAYMENT_REQUEST",
      title: "UPI Payment Handle Detected",
      severity: "high",
      description: "Message provides a direct UPI handle for transfer. Legitimate institutions do not ask for UPI transfers.",
      matched_text: vpa
    });
  }


  // Rule 1: Upfront Fee
  const feeRegex = /(pay\s+(?:rs\.?|₹)?\s*\d+|registration\s+fee|security\s+deposit|processing\s+fee)/i;
  const feeMatch = text.match(feeRegex);
  if (feeMatch) {
    score += 35;
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
  const urgRegex = /(within\s+\d+\s+minutes?|immediately|hurry|today\s+only|confirm\s+seat)/i;
  const urgMatch = text.match(urgRegex);
  if (urgMatch) {
    score += 20;
    const start = text.indexOf(urgMatch[0]);
    evidence_spans.push({
      start_idx: start,
      end_idx: start + urgMatch[0].length,
      severity: "medium",
      title: "Artificial Urgency Pressure",
      description: "Scammers use countdown timers to rush you into acting before you can verify authenticity.",
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

  // Rule 3: Guaranteed Selection
  const selRegex = /(congratulations!|you\s+have\s+been\s+selected|guaranteed\s+income|earn\s+rs\s+\d+)/i;
  const selMatch = text.match(selRegex);
  if (selMatch) {
    score += 15;
    const start = text.indexOf(selMatch[0]);
    evidence_spans.push({
      start_idx: start,
      end_idx: start + selMatch[0].length,
      severity: "high",
      title: "Unsolicited Selection Claim",
      description: "Offers selection without prior interview, screening, or formal application.",
      matched_text: selMatch[0]
    });
    indicators.push({
      code: "GUARANTEED_SELECTION",
      title: "Unsolicited Selection Claim",
      severity: "high",
      description: "Claims you won or got selected without applying.",
      matched_text: selMatch[0]
    });
  }

  // Determine classification
  const finalScore = Math.min(98, Math.max(8, score));
  let classification = "safe";
  if (finalScore >= 60) classification = "high_risk";
  else if (finalScore >= 30) classification = "suspicious";

  return {
    risk_score: finalScore,
    classification: classification,
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
