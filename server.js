const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

let users = {
  'user1': {
    id: 'user1',
    name: 'Rahul Sharma',
    trustScore: 75,
    transactions: [
      { id: 1, amount: 500, type: 'sent', to: 'Raju Store', note: 'Groceries', date: '2026-06-12', risk: 'low' },
      { id: 2, amount: 1200, type: 'received', from: 'Priya', note: 'Shared rent', date: '2026-06-10', risk: 'low' },
      { id: 3, amount: 300, type: 'sent', to: 'Amit', note: 'Movie tickets', date: '2026-06-09', risk: 'low' },
      { id: 4, amount: 5000, type: 'sent', to: 'Unknown', note: 'Urgent payment', date: '2026-06-07', risk: 'medium' },
      { id: 5, amount: 2500, type: 'received', from: 'Office', note: 'Salary advance', date: '2026-06-05', risk: 'low' },
      { id: 6, amount: 1500, type: 'sent', to: 'Tech Support', note: 'Refund required', date: '2026-06-03', risk: 'high' }
    ],
    loans: [
      { id: 1, amount: 1000, term: '14 days', status: 'granted', date: '2026-05-20', dueDate: '2026-06-03' }
    ],
    lendingEligible: true
  },
  'user2': {
    id: 'user2',
    name: 'Amit Patel',
    trustScore: 45,
    transactions: [
      { id: 1, amount: 300, type: 'received', from: 'Rahul', note: 'Movie tickets', date: '2026-06-09', risk: 'low' }
    ],
    loans: [],
    lendingEligible: false
  }
};

// ──────────────────────────────────────────────
// Layer 1: Weighted Rule-Based Scoring
// ──────────────────────────────────────────────
const WEIGHTED_FLAGS = [
  { terms: ['otp', 'one time password'], score: 0.95, label: 'OTP sharing request' },
  { terms: ['pin', 'password'], score: 0.90, label: 'Password/PIN request' },
  { terms: ['kidnap', 'threat', 'police', 'fbi', 'arrest'], score: 0.90, label: 'Authority impersonation or threat' },
  { terms: ['bitcoin', 'crypto', 'usdt', 'wallet'], score: 0.85, label: 'Cryptocurrency payment' },
  { terms: ['lottery', 'prize', 'won', 'winner', 'reward'], score: 0.85, label: 'Lottery or prize scam' },
  { terms: ['gift card', 'amazon card', 'google pay card'], score: 0.85, label: 'Gift card payment' },
  { terms: ['irs', 'income tax', 'gst refund', 'tds refund'], score: 0.80, label: 'Fake tax authority' },
  { terms: ['social security', 'ssn', 'aadhaar', 'pan card'], score: 0.80, label: 'Identity document request' },
  { terms: ['verify account', 'kyc update', 'account verify'], score: 0.75, label: 'Fake KYC verification' },
  { terms: ['refund required', 'refund processing', 'cashback'], score: 0.65, label: 'Advance fee / refund scam' },
  { terms: ['click here', 'link below', 'tap below'], score: 0.60, label: 'Suspicious link prompt' },
  { terms: ['limited time', 'act now', 'expires today'], score: 0.55, label: 'Urgency pressure' },
  { terms: ['urgent', 'emergency', 'immediately'], score: 0.45, label: 'Urgency language' },
  { terms: ['family emergency', 'friend in trouble', 'stuck abroad'], score: 0.70, label: 'Social engineering story' },
  { terms: ['invest', 'guaranteed return', 'double money', '100% profit'], score: 0.80, label: 'Investment fraud' },
];

function computeRuleScore(text) {
  const lower = text.toLowerCase();
  let totalScore = 0;
  const signals = [];

  for (const flag of WEIGHTED_FLAGS) {
    for (const term of flag.terms) {
      if (lower.includes(term)) {
        totalScore = Math.min(1, totalScore + flag.score * 0.5); // diminishing accumulation
        if (!signals.includes(flag.label)) signals.push(flag.label);
        break;
      }
    }
  }

  return { score: totalScore, signals };
}

// ──────────────────────────────────────────────
// Layer 2: Behavioural Scoring
// ──────────────────────────────────────────────
function computeBehaviouralScore(user, amount, recipient) {
  const transactions = user.transactions;
  const signals = [];
  let score = 0;

  // 1. Velocity: more than 3 transactions in last hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = transactions.filter(t => new Date(t.date) > oneHourAgo).length;
  if (recentCount >= 3) {
    score += 0.3;
    signals.push(`High velocity: ${recentCount} transactions in the last hour`);
  }

  // 2. Amount deviation vs user average
  const sentAmounts = transactions.filter(t => t.type === 'sent').map(t => t.amount);
  if (sentAmounts.length > 0) {
    const avg = sentAmounts.reduce((a, b) => a + b, 0) / sentAmounts.length;
    if (amount > avg * 3) {
      score += 0.35;
      signals.push(`Amount Rs ${amount} is ${(amount / avg).toFixed(1)}x your usual average of Rs ${Math.round(avg)}`);
    } else if (amount > avg * 1.5) {
      score += 0.15;
      signals.push(`Amount is above your typical transaction size`);
    }
  }

  // 3. Recipient novelty
  const knownRecipients = transactions
    .filter(t => t.type === 'sent' && t.to)
    .map(t => t.to.toLowerCase());
  if (recipient && !knownRecipients.includes(recipient.toLowerCase())) {
    score += 0.25;
    signals.push('First-time recipient — never paid this person before');
  }

  // 4. Time anomaly: midnight to 5 AM
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 5) {
    score += 0.15;
    signals.push('Transaction initiated during unusual hours (midnight–5 AM)');
  }

  return { score: Math.min(1, score), signals };
}

// ──────────────────────────────────────────────
// Layer 3: LLM Analysis via Claude
// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// Layer 3: LLM Analysis via Groq
// ──────────────────────────────────────────────
async function computeLLMScore(recipient, amount, note, userContext) {
  // Layer 3 — LLM with SMS-specific system prompt
  const systemPrompt = `You are a fraud SMS detection assistant for Indian mobile users.
Analyze the SMS text and return ONLY a valid JSON object with no markdown, no code fences, no extra text:
{
  "risk": "low" | "medium" | "high",
  "score": 0-100,
  "signals": ["list of specific red flags found, or empty array if none"],
  "explanation": "plain language explanation for the user in 1-2 sentences",
  "category": "promotional" | "scam" | "legitimate_bank" | "otp" | "social_engineering" | "unknown"
}

Common Indian SMS scams to detect: fake KYC updates, fake prize/lottery wins, SIM block threats, UPI fraud links, impersonation of banks or TRAI or income tax, OTP phishing, investment fraud.`;

  let llmResult = { score: 0, signals: [], explanation: '', category: 'unknown', risk: 'low' };
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `SMS text: "${smsText}"` }
        ]
      })
    });

    const data = await response.json();
    
    // Extract using Groq's structure
    const text = data.choices?.[0]?.message?.content || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    
    llmResult = {
      score: (parsed.score || 0) / 100,
      signals: parsed.signals || [],
      explanation: parsed.explanation || '',
      category: parsed.category || 'unknown',
      risk: parsed.risk || 'low'
    };
  } catch (err) {
    console.error('SMS LLM error:', err);
  }
}

// ──────────────────────────────────────────────
// Layer 4: Weighted Aggregation
// ──────────────────────────────────────────────
function aggregateScores(ruleResult, behaviourResult, llmResult) {
  const finalScore =
    ruleResult.score * 0.2 +
    behaviourResult.score * 0.3 +
    llmResult.score * 0.5;

  const allSignals = [
    ...ruleResult.signals,
    ...behaviourResult.signals,
    ...llmResult.signals
  ];

  let risk;
  if (finalScore >= 0.65) risk = 'high';
  else if (finalScore >= 0.30) risk = 'medium';
  else risk = 'low';

  return {
    risk,
    finalScore: Math.round(finalScore * 100),
    signals: allSignals,
    explanation: llmResult.explanation,
    intent: llmResult.intent,
    layerBreakdown: {
      rule: Math.round(ruleResult.score * 100),
      behaviour: Math.round(behaviourResult.score * 100),
      llm: Math.round(llmResult.score * 100)
    }
  };
}

// ──────────────────────────────────────────────
// Routes
// ──────────────────────────────────────────────
app.get('/api/user/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Full 4-layer analysis endpoint (used by payment form)
app.post('/api/analyze', async (req, res) => {
  const { note, amount, recipient, userId } = req.body;
  const user = users[userId || 'user1'];

  const text = `${recipient || ''} ${note || ''}`;

  // Layer 1
  const ruleResult = computeRuleScore(text);

  // Layer 2
  const behaviourResult = user
    ? computeBehaviouralScore(user, amount || 0, recipient)
    : { score: 0, signals: [] };

  // Layer 3 (user context string for prompt)
  const sentAmounts = user?.transactions.filter(t => t.type === 'sent').map(t => t.amount) || [];
  const avg = sentAmounts.length > 0 ? Math.round(sentAmounts.reduce((a, b) => a + b, 0) / sentAmounts.length) : 0;
  const userContext = `Average transaction: Rs ${avg}, ${sentAmounts.length} transactions this month, trust score: ${user?.trustScore || 'unknown'}`;

  const llmResult = await computeLLMScore(recipient, amount || 0, note, userContext);

  // Layer 4
  const result = aggregateScores(ruleResult, behaviourResult, llmResult);
  res.json(result);
});

// SMS / text analysis endpoint
app.post('/api/analyze-sms', async (req, res) => {
  const { smsText } = req.body;

  if (!smsText || smsText.trim().length < 5) {
    return res.status(400).json({ error: 'Please provide SMS text to analyze' });
  }

  // Layer 1 on SMS text
  const ruleResult = computeRuleScore(smsText);

  // Layer 3 — LLM with SMS-specific system prompt
  const systemPrompt = `You are a fraud SMS detection assistant for Indian mobile users.
Analyze the SMS text and return ONLY a valid JSON object with no markdown, no code fences, no extra text:
{
  "risk": "low" | "medium" | "high",
  "score": 0-100,
  "signals": ["list of specific red flags found, or empty array if none"],
  "explanation": "plain language explanation for the user in 1-2 sentences",
  "category": "promotional" | "scam" | "legitimate_bank" | "otp" | "social_engineering" | "unknown"
}

Common Indian SMS scams to detect: fake KYC updates, fake prize/lottery wins, SIM block threats, UPI fraud links, impersonation of banks or TRAI or income tax, OTP phishing, investment fraud.`;

  let llmResult = { score: 0, signals: [], explanation: '', category: 'unknown', risk: 'low' };
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: systemPrompt,
        messages: [{ role: 'user', content: `SMS text: "${smsText}"` }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    llmResult = {
      score: (parsed.score || 0) / 100,
      signals: parsed.signals || [],
      explanation: parsed.explanation || '',
      category: parsed.category || 'unknown',
      risk: parsed.risk || 'low'
    };
  } catch (err) {
    console.error('SMS LLM error:', err);
  }

  const finalScore = ruleResult.score * 0.35 + llmResult.score * 0.65;
  const allSignals = [...ruleResult.signals, ...llmResult.signals];

  let risk;
  if (finalScore >= 0.60) risk = 'high';
  else if (finalScore >= 0.25) risk = 'medium';
  else risk = 'low';

  res.json({
    risk,
    finalScore: Math.round(finalScore * 100),
    signals: allSignals,
    explanation: llmResult.explanation,
    category: llmResult.category,
    layerBreakdown: {
      rule: Math.round(ruleResult.score * 100),
      llm: Math.round(llmResult.score * 100)
    }
  });
});

app.post('/api/transaction', (req, res) => {
  const { userId, amount, type, counterparty, note, risk } = req.body;
  const user = users[userId];

  if (user) {
    const newTransaction = {
      id: user.transactions.length + 1,
      amount,
      type,
      to: type === 'sent' ? counterparty : undefined,
      from: type === 'received' ? counterparty : undefined,
      note,
      date: new Date().toISOString().split('T')[0],
      risk
    };

    user.transactions.push(newTransaction);

    if (risk === 'low') {
      user.trustScore = Math.min(100, user.trustScore + 2);
    } else if (risk === 'high') {
      user.trustScore = Math.max(0, user.trustScore - 10);
    }

    user.lendingEligible = user.trustScore >= 70;
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/loan', (req, res) => {
  const { userId, amount, term, fullName, phone, email, address, income } = req.body;
  const user = users[userId];

  if (user) {
    const activeLoan = user.loans.find(loan => loan.status === 'pending' || loan.status === 'granted');
    if (activeLoan) {
      return res.status(400).json({ error: 'You already have an active loan' });
    }

    let status = 'pending';
    if (user.trustScore >= 80) status = 'granted';
    else if (user.trustScore < 50) status = 'failed';

    const today = new Date();
    const dueDate = new Date(today);
    if (term === '7 days') dueDate.setDate(today.getDate() + 7);
    else if (term === '14 days') dueDate.setDate(today.getDate() + 14);
    else if (term === '30 days') dueDate.setDate(today.getDate() + 30);

    const newLoan = {
      id: user.loans.length + 1,
      amount, term, status,
      fullName, phone, email, address, income,
      date: today.toISOString().split('T')[0],
      dueDate: dueDate.toISOString().split('T')[0]
    };

    user.loans.push(newLoan);
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
