// ...existing code...
require('dotenv').config();
const nodemailer = require('nodemailer');
const { query } = require('./db');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendReminderEmail(toEmail, subject, text) {
  if (!toEmail) throw new Error('Missing recipient email');
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: toEmail,
    subject,
    text,
  });
  return info;
}

async function sendDailyHabitReminder(user, stats) {
  if (!user || !user.email) return;
  const subject = 'Don’t forget to complete your habit today!';
  const completionRate = stats?.completionRate ?? 'N/A';
  const text =
    `Hi ${user.name || 'there'},\n\n` +
    `This is your friendly AI Habit Tracker checking in.\n\n` +
    `Take a few minutes to complete your key habits today and log them in the dashboard so we can keep generating insights for you.\n\n` +
    `Recent completion rate: ${completionRate}.\n\n` +
    `Stay consistent – small daily actions lead to big results. 💪\n\n` +
    `— AI Habit Tracker`;
  return sendReminderEmail(user.email, subject, text);
}

async function sendDailyRemindersToAllUsers() {
  const users = await query('SELECT id, email, name FROM users', []);
  for (const u of users) {
    try {
      await sendDailyHabitReminder(u);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to send reminder to', u.email, err.message);
    }
  }
}

module.exports = {
  sendReminderEmail,
  sendDailyHabitReminder,
  sendDailyRemindersToAllUsers,
};
// ...existing code...