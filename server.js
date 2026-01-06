require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const csvParser = require('csv-parser');
const xlsx = require('xlsx');
const cron = require('node-cron');
const fs = require('fs');

const { query } = require('./db');
const { analyzeHabits } = require('./ai');
const { sendReminderEmail, sendDailyRemindersToAllUsers } = require('./email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'supersecret',
    resave: false,
    saveUninitialized: false,
  })
);

const frontendDir = path.join(__dirname, '..');
app.use(express.static(frontendDir));

function requireLogin(req, res, next) {
  // Authentication disabled: assign a default guest user if none exists
  if (!req.session) req.session = {};
  if (!req.session.userId) {
    req.session.userId = Number(process.env.DEFAULT_USER_ID) || 1;
    req.session.email = process.env.DEFAULT_USER_EMAIL || 'guest@example.com';
    req.session.name = process.env.DEFAULT_USER_NAME || 'Guest';
  }
  return next();
}

app.post('/api/login', async (req, res) => {
  // Authentication disabled: accept any credentials and set a default guest user
  const { email } = req.body;
  const user = {
    id: Number(process.env.DEFAULT_USER_ID) || 1,
    email: email || process.env.DEFAULT_USER_EMAIL || 'guest@example.com',
    name: process.env.DEFAULT_USER_NAME || 'Guest',
  };
  req.session = req.session || {};
  req.session.userId = user.id;
  req.session.email = user.email;
  req.session.name = user.name;
  return res.json(user);
});

app.post('/api/logout', (req, res) => {
  // No real session management when auth is disabled – clear session fields
  req.session = {};
  return res.json({ message: 'Logged out (auth disabled)' });
});

app.get('/api/me', async (req, res) => {
  req.session = req.session || {};
  const user = {
    id: req.session.userId || Number(process.env.DEFAULT_USER_ID) || 1,
    email: req.session.email || process.env.DEFAULT_USER_EMAIL || 'guest@example.com',
    name: req.session.name || process.env.DEFAULT_USER_NAME || 'Guest',
  };
  return res.json(user);
});

app.post('/api/habits', requireLogin, async (req, res) => {
  const { habit_name, date, status } = req.body;
  if (!habit_name || !date) {
    return res.status(400).json({ message: 'habit_name and date are required' });
  }
  try {
    await query(
      'INSERT INTO habits (user_id, habit_name, date, status) VALUES (?, ?, ?, ?)',
      [req.session.userId, habit_name, date, Number(status) ? 1 : 0]
    );
    return res.json({ message: 'Habit saved' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not save habit' });
  }
});

app.get('/api/habits/summary', requireLogin, async (req, res) => {
  try {
    const habits = await query(
      'SELECT date, status FROM habits WHERE user_id = ? ORDER BY date DESC LIMIT 365',
      [req.session.userId]
    );

    const byDate = {};
    habits.forEach((h) => {
      const key = h.date.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = { total: 0, completed: 0 };
      byDate[key].total += 1;
      if (h.status === 1 || h.status === '1') byDate[key].completed += 1;
    });

    const today = new Date();
    const weeklyLabels = [];
    const weeklyValues = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      weeklyLabels.push(key.slice(5));
      const entry = byDate[key];
      const rate = entry ? (entry.completed / entry.total) * 100 : 0;
      weeklyValues.push(Math.round(rate));
    }

    const monthlyLabels = [];
    const monthlyValues = [];
    const byMonth = {};
    habits.forEach((h) => {
      const d = new Date(h.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!byMonth[key]) byMonth[key] = { total: 0, completed: 0 };
      byMonth[key].total += 1;
      if (h.status === 1 || h.status === '1') byMonth[key].completed += 1;
    });
    const nowMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(nowMonth);
      d.setMonth(nowMonth.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyLabels.push(key);
      const entry = byMonth[key];
      const rate = entry ? (entry.completed / entry.total) * 100 : 0;
      monthlyValues.push(Math.round(rate));
    }

    const successFailure = { completed: 0, missed: 0 };
    habits.forEach((h) => {
      if (h.status === 1 || h.status === '1') successFailure.completed += 1;
      else successFailure.missed += 1;
    });

    const streaks = { labels: [], values: [] };
    let currentStreak = 0;
    let lastDate = null;
    const sortedAsc = [...habits].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedAsc.forEach((h) => {
      const d = new Date(h.date);
      if (h.status === 1 || h.status === '1') {
        if (lastDate) {
          const diffDays = Math.round((d - lastDate) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            currentStreak += 1;
          } else {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }
      }
      lastDate = d;
      streaks.labels.push(h.date.toISOString().slice(5, 10));
      streaks.values.push(currentStreak);
    });

    return res.json({
      weekly: { labels: weeklyLabels, values: weeklyValues },
      monthly: { labels: monthlyLabels, values: monthlyValues },
      successFailure,
      streaks,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not compute summary' });
  }
});

app.get('/api/analytics/insights', requireLogin, async (req, res) => {
  try {
    const records = await query(
      'SELECT date, status FROM habits WHERE user_id = ? ORDER BY date ASC',
      [req.session.userId]
    );
    const analysis = analyzeHabits(
      records.map((r) => ({
        date: r.date,
        status: r.status,
      }))
    );
    return res.json(analysis);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not compute analytics' });
  }
});

const upload = multer({ dest: path.join(__dirname, 'uploads') });

app.post('/api/upload', requireLogin, upload.single('dataFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const filePath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();
  const habitsToInsert = [];
  const uploadsToInsert = [];

  function pushRow(row) {
    const hasHabitFields = row.habit_name && row.date && row.status !== undefined;
    const hasGenericFields = row.value && row.date;
    if (hasHabitFields) {
      habitsToInsert.push({
        habit_name: String(row.habit_name),
        date: String(row.date),
        status: Number(row.status) ? 1 : 0,
      });
    } else if (hasGenericFields) {
      uploadsToInsert.push({
        value: Number(row.value),
        date: String(row.date),
        source: row.source ? String(row.source) : 'csv/excel',
      });
    }
  }

  try {
    if (ext === '.csv') {
      await new Promise((resolve, reject) => {
        const stream = fs
          .createReadStream(filePath)
          .pipe(csvParser())
          .on('data', (row) => {
            pushRow(row);
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
        stream.on('error', (err) => reject(err));
      });
    } else if (ext === '.xlsx') {
      const workbook = xlsx.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json(sheet);
      rows.forEach((row) => pushRow(row));
    } else {
      return res.status(400).json({ message: 'Unsupported file type' });
    }

    for (const h of habitsToInsert) {
      // eslint-disable-next-line no-await-in-loop
      await query(
        'INSERT INTO habits (user_id, habit_name, date, status) VALUES (?, ?, ?, ?)',
        [req.session.userId, h.habit_name, h.date, h.status]
      );
    }
    for (const u of uploadsToInsert) {
      // eslint-disable-next-line no-await-in-loop
      await query(
        'INSERT INTO uploaded_data (user_id, source, value, date) VALUES (?, ?, ?, ?)',
        [req.session.userId, u.source, u.value, u.date]
      );
    }

    fs.unlink(filePath, () => {});
    return res.json({ message: 'File processed', habitsImported: habitsToInsert.length, entriesImported: uploadsToInsert.length });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not process file' });
  }
});

app.post('/api/upload/manual', requireLogin, async (req, res) => {
  const { value, date, source } = req.body;
  if (!value || !date) {
    return res.status(400).json({ message: 'value and date are required' });
  }
  try {
    await query(
      'INSERT INTO uploaded_data (user_id, source, value, date) VALUES (?, ?, ?, ?)',
      [req.session.userId, source || 'manual', Number(value), date]
    );
    return res.json({ message: 'Manual entry saved' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not save entry' });
  }
});

app.post('/api/email/reminder', requireLogin, async (req, res) => {
  try {
    await sendReminderEmail(
      req.session.email,
      'Habit Reminder',
      'This is a reminder from AI Habit Tracker to complete your habits today!'
    );
    return res.json({ message: 'Reminder email sent' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not send email' });
  }
});

app.post('/api/email/test-reminder', requireLogin, async (req, res) => {
  try {
    await sendReminderEmail(
      req.session.email,
      'Test Habit Reminder',
      'This is a test reminder from AI Habit Tracker.'
    );
    return res.json({ message: 'Test reminder email triggered' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: 'Could not send test email' });
  }
});

cron.schedule('0 8 * * *', async () => {
  try {
    await sendDailyRemindersToAllUsers();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Daily reminder job failed', err);
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});

