/* ────────────────────────────────────────────
   TrustPay — Frontend JS
   ──────────────────────────────────────────── */
let currentUser = 'user1';
let currentRisk = null;
let allTransactions = [];
let currentFilter = 'all';
let balanceVisible = true;

document.addEventListener('DOMContentLoaded', function () {
  loadUserData();
  setupLoanForm();
});

// ──────────────────────────────────────────────
// Tab Switching
// ──────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const tab = document.getElementById(tabId);
  if (tab) tab.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if (navBtn) navBtn.classList.add('active');
}

// ──────────────────────────────────────────────
// Balance Toggle
// ──────────────────────────────────────────────
function toggleBalance() {
  const el = document.getElementById('balanceAmount');
  balanceVisible = !balanceVisible;
  el.textContent = balanceVisible ? '2,450' : '••••';
}

// ──────────────────────────────────────────────
// Load User Data
// ──────────────────────────────────────────────
async function loadUserData() {
  try {
    const res = await fetch('/api/user/' + currentUser);
    const user = await res.json();
    allTransactions = user.transactions;
    updateTrustScore(user);
    renderTransactions(user.transactions, 'activityList', 5);
    renderTransactions(user.transactions, 'transactionList');
    updateLoanSection(user);
  } catch (e) {
    console.error('Error loading user:', e);
  }
}

function updateTrustScore(user) {
  const score = user.trustScore;
  const scoreEl = document.getElementById('scoreValue');
  const arc = document.getElementById('scoreArc');
  const chip = document.getElementById('trustChip');

  if (scoreEl) scoreEl.textContent = score;

  // Stroke-dashoffset: full circle = 251.2, offset = 251.2 * (1 - score/100)
  if (arc) {
    const offset = 251.2 * (1 - score / 100);
    arc.style.strokeDashoffset = offset;
    if (score >= 75) arc.style.stroke = '#06b6d4';
    else if (score >= 50) arc.style.stroke = '#f59e0b';
    else arc.style.stroke = '#ef4444';
  }

  if (chip) {
    if (score >= 75) { chip.textContent = 'Good'; chip.className = 'trust-chip good'; }
    else if (score >= 50) { chip.textContent = 'Fair'; chip.className = 'trust-chip medium'; }
    else { chip.textContent = 'Poor'; chip.className = 'trust-chip poor'; }
  }
}

// ──────────────────────────────────────────────
// Render Transaction Lists
// ──────────────────────────────────────────────
function renderTransactions(transactions, containerId, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  let list = [...transactions].reverse();

  if (currentFilter === 'sent') list = list.filter(t => t.type === 'sent');
  if (currentFilter === 'received') list = list.filter(t => t.type === 'received');
  if (limit) list = list.slice(0, limit);

  if (list.length === 0) {
    container.innerHTML = '<div style="padding:24px;text-align:center;color:#8b90a0;font-size:14px;">No transactions found</div>';
    return;
  }

  list.forEach(txn => {
    const counterparty = txn.type === 'sent' ? txn.to : txn.from;
    const initials = (counterparty || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const prefix = txn.type === 'sent' ? '-' : '+';

    const item = document.createElement('div');
    item.className = 'txn-item';
    item.onclick = () => showTxnModal(txn);
    item.innerHTML = `
      <div class="txn-av">${initials}</div>
      <div class="txn-meta">
        <div class="txn-name">${counterparty || 'Unknown'}</div>
        <div class="txn-note">${txn.note || ''}</div>
        <div class="txn-date">${txn.date}</div>
      </div>
      <div class="txn-right">
        <span class="txn-amount ${txn.type}">${prefix}₹${txn.amount.toLocaleString('en-IN')}</span>
        <span class="risk-pill ${txn.risk}">${txn.risk.toUpperCase()}</span>
      </div>
    `;
    container.appendChild(item);
  });
}

function filterTxn(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransactions(allTransactions, 'transactionList');
}

// ──────────────────────────────────────────────
// Transaction Modal
// ──────────────────────────────────────────────
function showTxnModal(txn) {
  const modal = document.getElementById('txnModal');
  const body = document.getElementById('txnModalBody');
  const counterparty = txn.type === 'sent' ? txn.to : txn.from;
  const prefix = txn.type === 'sent' ? '-' : '+';

  body.innerHTML = `
    <div class="detail-row"><span class="detail-lbl">Type</span><span class="detail-val">${txn.type === 'sent' ? 'Sent' : 'Received'}</span></div>
    <div class="detail-row"><span class="detail-lbl">Amount</span><span class="detail-val">${prefix}₹${txn.amount.toLocaleString('en-IN')}</span></div>
    <div class="detail-row"><span class="detail-lbl">${txn.type === 'sent' ? 'To' : 'From'}</span><span class="detail-val">${counterparty || 'Unknown'}</span></div>
    <div class="detail-row"><span class="detail-lbl">Note</span><span class="detail-val">${txn.note || '—'}</span></div>
    <div class="detail-row"><span class="detail-lbl">Date</span><span class="detail-val">${txn.date}</span></div>
    <div class="detail-row"><span class="detail-lbl">Risk Level</span><span class="risk-pill ${txn.risk}" style="margin:0">${txn.risk.toUpperCase()}</span></div>
  `;
  modal.classList.remove('hidden');
}

function closeTxnModal() {
  document.getElementById('txnModal').classList.add('hidden');
}

// ──────────────────────────────────────────────
// Payment Risk Analysis (4-layer)
// ──────────────────────────────────────────────
async function analyzePayment() {
  const recipient = document.getElementById('recipient').value.trim();
  const amount = parseFloat(document.getElementById('amount').value) || 0;
  const note = document.getElementById('note').value.trim();

  if (!amount && !note && !recipient) {
    alert('Please enter at least an amount or a note to analyze.');
    return;
  }

  const btn = document.getElementById('analyzeBtn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, amount, recipient, userId: currentUser })
    });
    const data = await res.json();

    currentRisk = data.risk;
    displayPaymentRisk(data);

    document.getElementById('sendBtn').disabled = false;
  } catch (e) {
    console.error('Analyze error:', e);
    alert('Analysis failed. Please try again.');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

function displayPaymentRisk(data) {
  const banner = document.getElementById('riskAlert');
  const breakdown = document.getElementById('layerBreakdown');

  // Risk banner
  banner.className = `risk-banner ${data.risk}`;

  const riskTitles = {
    low: 'This transaction looks safe',
    medium: 'Proceed with caution',
    high: 'High fraud risk detected'
  };

  let signalsHTML = '';
  if (data.signals && data.signals.length > 0) {
    signalsHTML = '<div class="risk-banner-signals">' +
      data.signals.map(s => `<div class="risk-banner-signal-item">${s}</div>`).join('') +
      '</div>';
  }

  banner.innerHTML = `
    <div class="risk-banner-title">${riskTitles[data.risk] || 'Analysis complete'}</div>
    <div>${data.explanation || ''}</div>
    ${signalsHTML}
  `;

  // Layer breakdown bars
  if (data.layerBreakdown) {
    const lb = data.layerBreakdown;
    setBar('barRule', 'pctRule', lb.rule);
    setBar('barBeh', 'pctBeh', lb.behaviour);
    setBar('barLLM', 'pctLLM', lb.llm);
    breakdown.classList.remove('hidden');
  }

  banner.classList.remove('hidden');
}

function setBar(barId, pctId, value) {
  const bar = document.getElementById(barId);
  const pct = document.getElementById(pctId);
  if (bar) {
    bar.style.width = value + '%';
    if (value >= 60) bar.style.background = '#ef4444';
    else if (value >= 30) bar.style.background = '#f59e0b';
    else bar.style.background = '#06b6d4';
  }
  if (pct) pct.textContent = value + '%';
}

// ──────────────────────────────────────────────
// Send Payment
// ──────────────────────────────────────────────
async function sendPayment() {
  if (!currentRisk) {
    alert('Please analyze the risk first.');
    return;
  }

  if (currentRisk === 'high') {
    const proceed = confirm('Warning: This transaction has been flagged as high risk. Are you sure you want to proceed?');
    if (!proceed) return;
  }

  const recipient = document.getElementById('recipient').value.trim();
  const amount = parseFloat(document.getElementById('amount').value);
  const note = document.getElementById('note').value.trim();

  if (!recipient || !amount) {
    alert('Please fill in recipient and amount.');
    return;
  }

  try {
    const res = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser,
        amount, type: 'sent',
        counterparty: recipient, note,
        risk: currentRisk
      })
    });

    if (res.ok) {
      const user = await res.json();
      allTransactions = user.transactions;
      updateTrustScore(user);
      renderTransactions(user.transactions, 'activityList', 5);
      renderTransactions(user.transactions, 'transactionList');

      // Reset form
      document.getElementById('recipient').value = '';
      document.getElementById('amount').value = '';
      document.getElementById('note').value = '';
      document.getElementById('riskAlert').className = 'risk-banner hidden';
      document.getElementById('layerBreakdown').classList.add('hidden');
      document.getElementById('sendBtn').disabled = true;
      currentRisk = null;

      switchTab('tab-home');
    } else {
      const err = await res.json();
      alert(err.error || 'Transaction failed.');
    }
  } catch (e) {
    console.error('Transaction error:', e);
  }
}

// ──────────────────────────────────────────────
// SMS Analysis
// ──────────────────────────────────────────────
function loadSampleSMS(type) {
  const samples = {
    otp: 'ALERT: Your SBI account will be blocked in 24 hours. Share your OTP 847291 to verify your KYC immediately. Call 9876543210.',
    lottery: 'Congratulations! You have won Rs 5,00,000 in the Jio Lucky Draw. To claim your prize, transfer Rs 2,000 processing fee to account 1234567890 IFSC HDFC0001.',
    kyc: 'Dear customer, your UPI ID has been suspended due to incomplete KYC. Click here to update: bit.ly/kyc-update. Failure to update within 12 hours will result in permanent block.',
    bank: 'Your HDFC Bank account XXXX4521 has been credited with Rs 12,500 on 13-Jun-26. Available balance: Rs 18,450. If not done by you, call 1800-XXX-XXXX.'
  };
  document.getElementById('smsText').value = samples[type] || '';
}

async function analyzeSMS() {
  const smsText = document.getElementById('smsText').value.trim();
  if (!smsText) {
    alert('Please paste an SMS to analyze.');
    return;
  }

  const btn = document.querySelector('#tab-sms .btn-primary');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<span class="spinner"></span> Analyzing...';
  btn.disabled = true;

  const resultEl = document.getElementById('smsResult');
  resultEl.className = 'sms-result hidden';

  try {
    const res = await fetch('/api/analyze-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsText })
    });
    const data = await res.json();
    displaySMSResult(data);
  } catch (e) {
    console.error('SMS analyze error:', e);
    alert('Analysis failed. Please try again.');
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
}

function displaySMSResult(data) {
  const el = document.getElementById('smsResult');

  const iconSVG = {
    low: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    medium: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/><circle cx="12" cy="12" r="10"/></svg>`,
    high: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polygon points="10.29 3.86 1.82 18 22.18 18 13.71 3.86 10.29 3.86"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };

  const titles = {
    low: 'SMS appears safe',
    medium: 'Suspicious content detected',
    high: 'Scam SMS detected'
  };

  let signalsHTML = '';
  if (data.signals && data.signals.length > 0) {
    signalsHTML = `<div class="sms-result-signals">` +
      data.signals.map(s => `<div class="sms-result-signal">${s}</div>`).join('') +
      `</div>`;
  }

  const categoryLabel = data.category ? data.category.replace(/_/g, ' ') : '';

  el.className = `sms-result ${data.risk}`;
  el.innerHTML = `
    <div class="sms-result-icon">${iconSVG[data.risk]}</div>
    <div class="sms-result-title">${titles[data.risk]}</div>
    <div class="sms-result-text">${data.explanation || 'Analysis complete.'}</div>
    ${signalsHTML}
    <div class="sms-result-score">
      Risk Score: ${data.finalScore}/100
      ${categoryLabel ? `<span class="sms-result-cat">${categoryLabel}</span>` : ''}
    </div>
  `;
}

// ──────────────────────────────────────────────
// Loan Section
// ──────────────────────────────────────────────
function updateLoanSection(user) {
  const activeSection = document.getElementById('activeLoanSection');
  const applySection = document.getElementById('loanApplySection');
  const historyList = document.getElementById('loanHistoryList');

  const activeLoan = user.loans && user.loans.find(l => l.status === 'pending' || l.status === 'granted');

  if (activeLoan) {
    activeSection.classList.remove('hidden');
    if (applySection) applySection.style.display = 'none';

    const statusEl = document.getElementById('activeLoanStatus');
    if (statusEl) {
      statusEl.textContent = activeLoan.status.toUpperCase();
      statusEl.className = `loan-chip ${activeLoan.status}`;
    }
    const amtEl = document.getElementById('activeLoanAmount');
    if (amtEl) amtEl.textContent = '₹' + activeLoan.amount.toLocaleString('en-IN');
    const dueEl = document.getElementById('activeLoanDue');
    if (dueEl) dueEl.textContent = activeLoan.dueDate;
  } else {
    activeSection.classList.add('hidden');
    if (applySection) applySection.style.display = '';
  }

  if (historyList && user.loans) {
    historyList.innerHTML = '';
    [...user.loans].reverse().forEach(loan => {
      const item = document.createElement('div');
      item.className = 'loan-history-item';
      item.innerHTML = `
        <div>
          <div class="lh-amt">₹${loan.amount.toLocaleString('en-IN')}</div>
          <div class="lh-meta">${loan.term} &bull; ${loan.date}</div>
        </div>
        <span class="loan-chip ${loan.status}">${loan.status.toUpperCase()}</span>
      `;
      historyList.appendChild(item);
    });
  }
}

function openLoanModal(amount, term) {
  document.getElementById('loanAmount').value = amount;
  document.getElementById('loanTerm').value = term;
  document.getElementById('loanModal').classList.remove('hidden');
}

function closeLoanModal() {
  document.getElementById('loanModal').classList.add('hidden');
  document.getElementById('loanForm').reset();
}

function setupLoanForm() {
  const form = document.getElementById('loanForm');
  if (!form) return;
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/loan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser,
          amount: parseInt(document.getElementById('loanAmount').value),
          term: document.getElementById('loanTerm').value,
          fullName: document.getElementById('loanFullName').value,
          phone: document.getElementById('loanPhone').value,
          email: document.getElementById('loanEmail').value,
          address: document.getElementById('loanAddress').value,
          income: parseFloat(document.getElementById('loanIncome').value)
        })
      });

      if (res.ok) {
        const user = await res.json();
        updateLoanSection(user);
        closeLoanModal();
        alert('Application submitted successfully.');
      } else {
        const err = await res.json();
        alert(err.error || 'Application failed.');
      }
    } catch (e) {
      console.error('Loan error:', e);
    }
  });
}
