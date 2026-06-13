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

app.get('/api/user/:userId', (req, res) => {
  const user = users[req.params.userId];
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

app.post('/api/analyze', (req, res) => {
  const { note, amount } = req.body;
  
  let risk = 'low';
  let explanation = 'Transaction looks safe.';
  
  const redFlags = [
    'urgent', 'emergency', 'gift card', 'bitcoin', 'crypto', 'password', 'otp',
    'bank account', 'credit card', 'pin', 'social security', 'ssn', 'verify',
    'won', 'prize', 'lottery', 'tax', 'irs', 'fbi', 'police', 'kidnap', 'threat'
  ];
  
  const lowerNote = note.toLowerCase();
  for (let flag of redFlags) {
    if (lowerNote.includes(flag)) {
      risk = 'high';
      explanation = `Warning: This transaction contains potential scam indicator: "${flag}". Please verify before sending money.`;
      break;
    }
  }
  
  if (amount > 500 && risk === 'low') {
    risk = 'medium';
    explanation = 'This is a larger amount than usual. Please double-check the recipient.';
  }
  
  res.json({ risk, explanation });
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
    // Check if user already has an active loan
    const activeLoan = user.loans.find(loan => loan.status === 'pending' || loan.status === 'granted');
    if (activeLoan) {
      return res.status(400).json({ error: 'You already have an active loan' });
    }
    
    // Determine loan status based on trust score
    let status = 'pending';
    if (user.trustScore >= 80) {
      status = 'granted';
    } else if (user.trustScore < 50) {
      status = 'failed';
    }
    
    const today = new Date();
    const dueDate = new Date(today);
    if (term === '7 days') dueDate.setDate(today.getDate() + 7);
    else if (term === '14 days') dueDate.setDate(today.getDate() + 14);
    else if (term === '30 days') dueDate.setDate(today.getDate() + 30);
    
    const newLoan = {
      id: user.loans.length + 1,
      amount,
      term,
      status,
      fullName,
      phone,
      email,
      address,
      income,
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
