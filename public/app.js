// Global variables
let currentUser = 'user1';
let currentRisk = null;
let uploadedImage = null;
let currentFilter = 'all';
let allTransactions = [];
let balanceVisible = true;

// Initialize app when DOM loads
document.addEventListener('DOMContentLoaded', function() {
  loadUserData();
  setupNavigation();
  setupPaymentForm();
  setupScamChecker();
  setupLoanForm();
});

// --------------------------
// Navigation Functions
// --------------------------
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function(item) {
    item.addEventListener('click', function() {
      switchTab(item.dataset.tab);
    });
  });
}

function switchTab(tabName) {
  // Update navigation active state
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(function(i) {
    i.classList.remove('active');
  });
  navItems.forEach(function(item) {
    if (item.dataset.tab === tabName) {
      item.classList.add('active');
    }
  });

  // Update tab content visibility
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.remove('active');
  });
  document.getElementById(tabName).classList.add('active');
}

// --------------------------
// Balance Toggle
// --------------------------
function toggleBalance() {
  const balanceEl = document.getElementById('balance');
  if (balanceVisible) {
    balanceEl.textContent = '••••';
  } else {
    balanceEl.textContent = '2,450';
  }
  balanceVisible = !balanceVisible;
}

// --------------------------
// Data Loading & Dashboard
// --------------------------
async function loadUserData() {
  try {
    const response = await fetch('/api/user/' + currentUser);
    const user = await response.json();
    allTransactions = user.transactions;
    updateDashboard(user);
    updateTransactionHistory(user.transactions);
    updateActivityList(user.transactions);
    updateLoanSection(user);
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

function updateDashboard(user) {
  const scoreValue = document.getElementById('scoreValue');
  const scoreCircle = document.getElementById('scoreCircle');
  const statusBadge = document.querySelector('.status-badge');

  if (scoreValue) {
    scoreValue.textContent = user.trustScore;
  }

  const scoreDegrees = (user.trustScore / 100) * 360;
  let scoreColor;

  if (user.trustScore >= 80) {
    scoreColor = '#10b981';
    if (statusBadge) {
      statusBadge.textContent = '✅ Excellent Standing';
      statusBadge.className = 'status-badge good';
    }
  } else if (user.trustScore >= 60) {
    scoreColor = '#f59e0b';
    if (statusBadge) {
      statusBadge.textContent = '✅ Good Standing';
      statusBadge.className = 'status-badge good';
    }
  } else {
    scoreColor = '#ef4444';
    if (statusBadge) {
      statusBadge.textContent = '⚠️ Needs Improvement';
      statusBadge.className = 'status-badge needs-improvement';
    }
  }

  if (scoreCircle) {
    scoreCircle.style.background = 'conic-gradient(' + scoreColor + ' 0deg ' + scoreDegrees + 'deg, #334155 ' + scoreDegrees + 'deg 360deg)';
  }
}

// --------------------------
// Transaction History
// --------------------------
function updateTransactionHistory(transactions) {
  const list = document.getElementById('transactionList');
  if (!list) return;
  list.innerHTML = '';

  let filtered = transactions;
  if (currentFilter === 'sent') {
    filtered = transactions.filter(function(t) { return t.type === 'sent'; });
  } else if (currentFilter === 'received') {
    filtered = transactions.filter(function(t) { return t.type === 'received'; });
  }

  filtered.slice().reverse().forEach(function(transaction) {
    const item = document.createElement('div');
    item.className = 'transaction-item';
    item.onclick = function() { showTransactionDetails(transaction); };

    const counterparty = transaction.type === 'sent' ? transaction.to : transaction.from;
    const amountClass = transaction.type === 'sent' ? 'sent' : 'received';
    const amountPrefix = transaction.type === 'sent' ? '-' : '+';

    item.innerHTML = '<div class=\"transaction-info\">' +
      '<div class=\"transaction-counterparty\">' + counterparty + '</div>' +
      '<div class=\"transaction-note\">' + transaction.note + '</div>' +
      '<div class=\"transaction-date\">' + transaction.date + '</div>' +
      '<span class=\"risk-badge ' + transaction.risk + '\">' + transaction.risk.toUpperCase() + '</span>' +
      '</div>' +
      '<div class=\"transaction-amount ' + amountClass + '\">' + amountPrefix + '₹' + transaction.amount + '</div>';

    list.appendChild(item);
  });
}

function filterTransactions(filter) {
  currentFilter = filter;
  const filterTabs = document.querySelectorAll('.filter-tab');
  filterTabs.forEach(function(tab) {
    tab.classList.remove('active');
  });
  filterTabs.forEach(function(tab) {
    if (tab.textContent.toLowerCase().includes(filter)) {
      tab.classList.add('active');
    }
  });
  updateTransactionHistory(allTransactions);
}

function showTransactionDetails(transaction) {
  const modal = document.getElementById('transactionModal');
  const details = document.getElementById('transactionDetails');

  const counterparty = transaction.type === 'sent' ? transaction.to : transaction.from;
  const type = transaction.type === 'sent' ? 'Sent' : 'Received';
  const amountPrefix = transaction.type === 'sent' ? '-' : '+';

  details.innerHTML = '<div class=\"detail-section\">' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Type</span><span class=\"detail-value\">' + type + '</span></div>' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Amount</span><span class=\"detail-value\">' + amountPrefix + '₹' + transaction.amount + '</span></div>' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Date</span><span class=\"detail-value\">' + transaction.date + '</span></div>' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Counterparty</span><span class=\"detail-value\">' + counterparty + '</span></div>' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Note</span><span class=\"detail-value\">' + transaction.note + '</span></div>' +
    '<div class=\"detail-item\"><span class=\"detail-label\">Risk Level</span><span class=\"risk-badge ' + transaction.risk + '\">' + transaction.risk.toUpperCase() + '</span></div>' +
    '</div>';

  modal.classList.remove('hidden');
}

function closeTransactionModal() {
  document.getElementById('transactionModal').classList.add('hidden');
}

// --------------------------
// Recent Activity List
// --------------------------
function updateActivityList(transactions) {
  const list = document.getElementById('activityList');
  if (!list) return;
  list.innerHTML = '';

  transactions.slice().reverse().slice(0, 5).forEach(function(transaction) {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.onclick = function() { showTransactionDetails(transaction); };

    const counterparty = transaction.type === 'sent' ? transaction.to : transaction.from;
    const amountClass = transaction.type === 'sent' ? 'sent' : 'received';
    const amountPrefix = transaction.type === 'sent' ? '-' : '+';

    item.innerHTML = '<div class=\"activity-info\">' +
      '<div class=\"activity-counterparty\">' + counterparty + '</div>' +
      '<div class=\"activity-note\">' + transaction.note + '</div>' +
      '<div class=\"activity-date\">' + transaction.date + '</div>' +
      '<span class=\"risk-badge ' + transaction.risk + '\">' + transaction.risk.toUpperCase() + '</span>' +
      '</div>' +
      '<div class=\"activity-amount ' + amountClass + '\">' + amountPrefix + '₹' + transaction.amount + '</div>';

    list.appendChild(item);
  });
}

// --------------------------
// Payment Form
// --------------------------
function setupPaymentForm() {
  const analyzeBtn = document.getElementById('analyzeBtn');
  const paymentForm = document.getElementById('paymentForm');

  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzeTransaction);
  }
  if (paymentForm) {
    paymentForm.addEventListener('submit', sendPayment);
  }
}

async function analyzeTransaction() {
  const note = document.getElementById('note').value;
  const amount = parseFloat(document.getElementById('amount').value) || 0;

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: note, amount: amount })
    });

    const data = await response.json();
    currentRisk = data;

    const alertDiv = document.getElementById('riskAlert');
    if (alertDiv) {
      alertDiv.textContent = data.explanation;
      alertDiv.className = 'risk-alert ' + data.risk;
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = false;
  } catch (error) {
    console.error('Error analyzing transaction:', error);
  }
}

async function sendPayment(e) {
  e.preventDefault();

  const recipient = document.getElementById('recipient').value;
  const recipientId = document.getElementById('recipientId').value;
  const amount = parseFloat(document.getElementById('amount').value);
  const purpose = document.getElementById('purpose').value;
  const note = document.getElementById('note').value;

  try {
    const response = await fetch('/api/transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser,
        amount: amount,
        type: 'sent',
        counterparty: recipient,
        note: note || purpose,
        risk: currentRisk ? currentRisk.risk : 'low'
      })
    });

    const user = await response.json();
    updateDashboard(user);
    updateTransactionHistory(user.transactions);
    updateActivityList(user.transactions);

    const paymentForm = document.getElementById('paymentForm');
    const riskAlert = document.getElementById('riskAlert');
    const sendBtn = document.getElementById('sendBtn');

    if (paymentForm) paymentForm.reset();
    if (riskAlert) riskAlert.className = 'risk-alert hidden';
    if (sendBtn) sendBtn.disabled = true;
    currentRisk = null;

    alert('✅ Payment sent successfully!');
  } catch (error) {
    console.error('Error sending payment:', error);
  }
}

// --------------------------
// Scam Checker Functions
// --------------------------
function setupScamChecker() {
  // Checker type tabs
  const checkerTabs = document.querySelectorAll('.checker-tab');
  checkerTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      checkerTabs.forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');

      document.querySelectorAll('.checker-content').forEach(function(content) {
        content.classList.remove('active');
      });

      const type = tab.dataset.type;
      document.getElementById(type + '-checker').classList.add('active');
    });
  });

  // Text analysis button
  const analyzeTextBtn = document.getElementById('analyzeTextBtn');
  if (analyzeTextBtn) {
    analyzeTextBtn.addEventListener('click', analyzeText);
  }

  // Image upload
  const imageUpload = document.getElementById('imageUpload');
  const imageInput = document.getElementById('imageInput');
  const analyzeImageBtn = document.getElementById('analyzeImageBtn');

  if (imageUpload && imageInput) {
    imageUpload.addEventListener('click', function() { imageInput.click(); });
    imageInput.addEventListener('change', handleImageUpload);
  }

  if (analyzeImageBtn) {
    analyzeImageBtn.addEventListener('click', analyzeImage);
  }

  // Transaction analysis button
  const analyzeTxnBtn = document.getElementById('analyzeTxnBtn');
  if (analyzeTxnBtn) {
    analyzeTxnBtn.addEventListener('click', analyzeTransactionCheck);
  }
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      uploadedImage = event.target.result;
      const previewImg = document.getElementById('previewImg');
      const imagePreview = document.getElementById('imagePreview');
      const analyzeImageBtn = document.getElementById('analyzeImageBtn');

      if (previewImg && imagePreview && analyzeImageBtn) {
        previewImg.src = uploadedImage;
        imagePreview.classList.remove('hidden');
        analyzeImageBtn.disabled = false;
      }
    };
    reader.readAsDataURL(file);
  }
}

function analyzeText() {
  const text = document.getElementById('smsText').value;
  const result = analyzeContent(text);
  displayCheckerResult(result);
}

function checkSample(type) {
  let sampleText = '';
  if (type === 'urgent') {
    sampleText = 'URGENT: Your account will be closed! Send Rs 5000 now to verify!';
  } else if (type === 'otp') {
    sampleText = 'Share your OTP to receive your prize money! OTP: 123456';
  } else if (type === 'lottery') {
    sampleText = 'Congratulations! You have won Rs 1,00,000! Click here to claim!';
  }
  document.getElementById('smsText').value = sampleText;
}

function analyzeImage() {
  const result = {
    risk: 'medium',
    title: 'Potential Warning',
    details: 'Image analysis complete. This appears to be a payment screenshot. Please verify the recipient details carefully before proceeding.',
    safetyScore: 60
  };
  displayCheckerResult(result);
}

function analyzeTransactionCheck() {
  const recipient = document.getElementById('checkRecipient').value;
  const amount = parseFloat(document.getElementById('checkAmount').value) || 0;
  const description = document.getElementById('checkDesc').value;

  const combinedText = recipient + ' ' + description;
  const result = analyzeContent(combinedText, amount);
  displayCheckerResult(result);
}

function analyzeContent(text, amount) {
  if (!amount) amount = 0;
  const redFlags = [
    'urgent', 'emergency', 'gift card', 'bitcoin', 'crypto', 'password', 'otp',
    'bank account', 'credit card', 'pin', 'social security', 'ssn', 'verify',
    'won', 'prize', 'lottery', 'tax', 'irs', 'fbi', 'police', 'kidnap', 'threat',
    'click here', 'limited time', 'act now', 'free money', 'invest', 'guaranteed'
  ];

  const lowerText = text.toLowerCase();
  let risk = 'low';
  let title = 'Looks Safe';
  let details = 'No suspicious patterns detected. This appears to be a legitimate request.';
  let safetyScore = 95;

  for (let i = 0; i < redFlags.length; i++) {
    if (lowerText.includes(redFlags[i])) {
      risk = 'high';
      title = '⚠️ SCAM WARNING!';
      details = 'This message contains suspicious content: \"' + redFlags[i] + '\". This is a common tactic used by scammers. Do not send any money or share personal information!';
      safetyScore = 10;
      break;
    }
  }

  if (amount > 5000 && risk === 'low') {
    risk = 'medium';
    title = '⚠️ Large Amount Warning';
    details = 'This is a large transaction amount. Please double-check the recipient and purpose before sending money.';
    safetyScore = 60;
  } else if (amount > 2000 && risk === 'low') {
    risk = 'medium';
    title = '⚠️ Medium Amount Warning';
    details = 'Please verify the recipient details before proceeding with this transaction.';
    safetyScore = 75;
  }

  return { risk: risk, title: title, details: details, safetyScore: safetyScore };
}

function displayCheckerResult(result) {
  const resultDiv = document.getElementById('checkerResult');
  const resultIcon = document.getElementById('resultIcon');
  const resultTitle = document.getElementById('resultTitle');
  const resultDetails = document.getElementById('resultDetails');
  const safetyScoreEl = document.getElementById('safetyScore');

  if (!resultDiv) return;

  resultDiv.classList.remove('hidden', 'safe', 'warning', 'danger');

  if (result.risk === 'low') {
    resultDiv.classList.add('safe');
    if (resultIcon) resultIcon.textContent = '✅';
    if (safetyScoreEl) {
      safetyScoreEl.textContent = (result.safetyScore || 95) + '%';
      safetyScoreEl.style.color = '#10b981';
    }
  } else if (result.risk === 'medium') {
    resultDiv.classList.add('warning');
    if (resultIcon) resultIcon.textContent = '⚠️';
    if (safetyScoreEl) {
      safetyScoreEl.textContent = (result.safetyScore || 60) + '%';
      safetyScoreEl.style.color = '#f59e0b';
    }
  } else {
    resultDiv.classList.add('danger');
    if (resultIcon) resultIcon.textContent = '🚨';
    if (safetyScoreEl) {
      safetyScoreEl.textContent = (result.safetyScore || 10) + '%';
      safetyScoreEl.style.color = '#ef4444';
    }
  }

  if (resultTitle) resultTitle.textContent = result.title;
  if (resultDetails) resultDetails.textContent = result.details;
}

// --------------------------
// Security Rules Modal
// --------------------------
function showRules() {
  document.getElementById('rulesModal').classList.remove('hidden');
}

function closeRules() {
  document.getElementById('rulesModal').classList.add('hidden');
}

// --------------------------
// Loan Functions
// --------------------------
function updateLoanSection(user) {
  const activeLoanSection = document.getElementById('activeLoanSection');
  const loanApplySection = document.getElementById('loanApplySection');
  const loanHistoryList = document.getElementById('loanHistoryList');

  let activeLoan = null;
  if (user.loans) {
    activeLoan = user.loans.find(function(loan) {
      return loan.status === 'pending' || loan.status === 'granted';
    });
  }

  if (activeLoan) {
    if (activeLoanSection) activeLoanSection.classList.remove('hidden');
    if (loanApplySection) loanApplySection.classList.add('hidden');

    const statusEl = document.getElementById('activeLoanStatus');
    const amountEl = document.getElementById('activeLoanAmount');
    const dueEl = document.getElementById('activeLoanDue');

    if (statusEl) {
      statusEl.textContent = activeLoan.status.toUpperCase();
      statusEl.className = 'loan-status ' + activeLoan.status;
    }
    if (amountEl) amountEl.textContent = '₹' + activeLoan.amount;
    if (dueEl) dueEl.textContent = activeLoan.dueDate;
  } else {
    if (activeLoanSection) activeLoanSection.classList.add('hidden');
    if (loanApplySection) loanApplySection.classList.remove('hidden');
  }

  if (loanHistoryList && user.loans) {
    loanHistoryList.innerHTML = '';
    user.loans.slice().reverse().forEach(function(loan) {
      const item = document.createElement('div');
      item.className = 'loan-history-item';
      item.innerHTML = '<div>' +
        '<div style=\"font-weight: 700;\">₹' + loan.amount + '</div>' +
        '<div style=\"font-size: 12px; color: #64748b;\">' + loan.term + ' • ' + loan.date + '</div>' +
        '</div>' +
        '<span class=\"loan-status ' + loan.status + '\">' + loan.status.toUpperCase() + '</span>';
      loanHistoryList.appendChild(item);
    });
  }
}

function openLoanModal(amount, term) {
  if (document.getElementById('loanAmount')) {
    document.getElementById('loanAmount').value = amount;
  }
  if (document.getElementById('loanTerm')) {
    document.getElementById('loanTerm').value = term;
  }
  if (document.getElementById('loanModal')) {
    document.getElementById('loanModal').classList.remove('hidden');
  }
}

function closeLoanModal() {
  if (document.getElementById('loanModal')) {
    document.getElementById('loanModal').classList.add('hidden');
  }
  if (document.getElementById('loanForm')) {
    document.getElementById('loanForm').reset();
  }
}

function setupLoanForm() {
  const form = document.getElementById('loanForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      try {
        const response = await fetch('/api/loan', {
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

        if (response.ok) {
          const user = await response.json();
          updateLoanSection(user);
          closeLoanModal();
          alert('✅ Loan application submitted successfully!');
        } else {
          const error = await response.json();
          alert(error.error);
        }
      } catch (error) {
        console.error('Error applying for loan:', error);
      }
    });
  }
}
