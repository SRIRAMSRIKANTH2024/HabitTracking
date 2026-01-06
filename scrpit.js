const apiBase = '';

async function apiRequest(path, options = {}) {
  const res = await fetch(apiBase + path, {
    credentials: 'include',
    headers: {
      'Content-Type': options.body instanceof FormData ? undefined : 'application/json',
    },
    ...options,
  });
  if (!res.ok) {
    let msg = 'Request failed';
    try {
      const data = await res.json();
      msg = data.message || msg;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

function setTodayIfEmpty(input) {
  if (!input) return;
  if (!input.value) {
    input.valueAsDate = new Date();
  }
}

function handleLogin() {
  // Authentication removed – no-op
}

async function fetchCurrentUser() {
  try {
    const me = await apiRequest('/api/me', { method: 'GET' });
    const title = document.getElementById('dashboardTitle');
    if (title && me && me.name) {
      title.textContent = `Welcome back, ${me.name}`;
    }
  } catch {
    // Authentication disabled – ignore if /api/me fails
  }
}

function attachLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await apiRequest('/api/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      // Stay on dashboard when logout occurs
      window.location.href = 'dashboard.html';
    }
  });
}

function initHabitForm() {
  const form = document.getElementById('addHabitForm');
  if (!form) return;
  const dateInput = document.getElementById('habitDate');
  setTodayIfEmpty(dateInput);
  const msg = document.getElementById('habitMessage');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-message';
    const habit_name = document.getElementById('habitName').value.trim();
    const date = document.getElementById('habitDate').value;
    const status = document.getElementById('habitStatus').value;
    try {
      await apiRequest('/api/habits', {
        method: 'POST',
        body: JSON.stringify({ habit_name, date, status: Number(status) }),
      });
      msg.textContent = 'Habit saved.';
      msg.classList.add('success');
      document.getElementById('habitName').value = '';
      loadCharts();
      loadAnalytics();
    } catch (err) {
      msg.textContent = err.message || 'Could not save habit.';
      msg.classList.add('error');
    }
  });
}

function initUploadForm() {
  const form = document.getElementById('uploadForm');
  if (!form) return;
  const msg = document.getElementById('uploadMessage');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-message';
    const fileInput = document.getElementById('dataFile');
    if (!fileInput.files.length) {
      msg.textContent = 'Please choose a file.';
      msg.classList.add('error');
      return;
    }
    const formData = new FormData();
    formData.append('dataFile', fileInput.files[0]);
    try {
      await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      msg.textContent = 'File uploaded and imported successfully.';
      msg.classList.add('success');
      fileInput.value = '';
    } catch {
      msg.textContent = 'Upload failed.';
      msg.classList.add('error');
    }
  });
}

function initManualDataForm() {
  const form = document.getElementById('manualDataForm');
  if (!form) return;
  const msg = document.getElementById('manualMessage');
  const dateInput = document.getElementById('manualDate');
  setTodayIfEmpty(dateInput);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    msg.className = 'form-message';
    const value = Number(document.getElementById('manualValue').value);
    const date = document.getElementById('manualDate').value;
    const source = document.getElementById('manualSource').value.trim() || 'manual';
    try {
      await apiRequest('/api/upload/manual', {
        method: 'POST',
        body: JSON.stringify({ value, date, source }),
      });
      msg.textContent = 'Manual entry saved.';
      msg.classList.add('success');
      document.getElementById('manualValue').value = '';
      document.getElementById('manualSource').value = '';
    } catch (err) {
      msg.textContent = err.message || 'Could not save entry.';
      msg.classList.add('error');
    }
  });
}

let weeklyChart;
let monthlyChart;
let successFailureChart;
let streakChart;

async function loadCharts() {
  const weeklyCanvas = document.getElementById('weeklyChart');
  const monthlyCanvas = document.getElementById('monthlyChart');
  const successFailureCanvas = document.getElementById('successFailureChart');
  const streakCanvas = document.getElementById('streakChart');
  if (!weeklyCanvas && !monthlyCanvas && !successFailureCanvas && !streakCanvas) return;

  try {
    const data = await apiRequest('/api/habits/summary', { method: 'GET' });

    if (weeklyCanvas) {
      const ctx = weeklyCanvas.getContext('2d');
      weeklyChart?.destroy();
      weeklyChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.weekly.labels,
          datasets: [
            {
              label: 'Completion %',
              data: data.weekly.values,
              backgroundColor: 'rgba(37, 99, 235, 0.7)',
            },
          ],
        },
        options: {
          scales: {
            y: { beginAtZero: true, max: 100 },
          },
        },
      });
    }

    if (monthlyCanvas) {
      const ctx = monthlyCanvas.getContext('2d');
      monthlyChart?.destroy();
      monthlyChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.monthly.labels,
          datasets: [
            {
              label: 'Consistency %',
              data: data.monthly.values,
              borderColor: 'rgba(34, 197, 94, 0.9)',
              fill: false,
            },
          ],
        },
        options: {
          scales: {
            y: { beginAtZero: true, max: 100 },
          },
        },
      });
    }

    if (successFailureCanvas && data.successFailure) {
      const ctx = successFailureCanvas.getContext('2d');
      successFailureChart?.destroy();
      successFailureChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Completed', 'Missed'],
          datasets: [
            {
              data: [data.successFailure.completed, data.successFailure.missed],
              backgroundColor: [
                'rgba(34, 197, 94, 0.9)',
                'rgba(248, 113, 113, 0.9)',
              ],
            },
          ],
        },
      });
    }

    if (streakCanvas && data.streaks) {
      const ctx = streakCanvas.getContext('2d');
      streakChart?.destroy();
      streakChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.streaks.labels,
          datasets: [
            {
              label: 'Current streak length',
              data: data.streaks.values,
              borderColor: 'rgba(59, 130, 246, 0.9)',
              fill: false,
            },
          ],
        },
      });
    }
  } catch {
    // Charts will just not render if data is missing
  }
}

async function loadAnalytics() {
  const behaviorList = document.getElementById('behaviorList');
  const aiDetails = document.getElementById('aiDetails');
  const aiScore = document.getElementById('aiScore');
  const aiRisk = document.getElementById('aiRisk');
  const aiMessage = document.getElementById('aiMessage');
  const aiMetrics = document.getElementById('aiMetrics');
  try {
    const data = await apiRequest('/api/analytics/insights', { method: 'GET' });
    if (aiDetails && aiScore && aiRisk && aiMessage && aiMetrics) {
      aiDetails.classList.remove('hidden');
      aiScore.textContent = `${Math.round(data.predictionScore * 100)}%`;
      aiRisk.textContent = `Risk level: ${data.riskLevel}`;
      aiMessage.textContent = data.message;
      aiMetrics.innerHTML = '';
      Object.entries(data.keyMetrics || {}).forEach(([key, value]) => {
        const li = document.createElement('li');
        li.textContent = `${key}: ${value}`;
        aiMetrics.appendChild(li);
      });
    }
    if (behaviorList) {
      behaviorList.innerHTML = '';
      (data.behavioralInsights || []).forEach((text) => {
        const li = document.createElement('li');
        li.textContent = text;
        behaviorList.appendChild(li);
      });
      if (!data.behavioralInsights || data.behavioralInsights.length === 0) {
        const li = document.createElement('li');
        li.className = 'muted';
        li.textContent = 'Not enough data yet for deep insights. Add more habit entries.';
        behaviorList.appendChild(li);
      }
    }
  } catch {
    // ignore
  }
}

function initAiRefresh() {
  const btn = document.getElementById('refreshAiBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    loadAnalytics();
  });
}

function initEmailTest() {
  const btn = document.getElementById('testEmailBtn');
  if (!btn) return;
  const msg = document.getElementById('emailMessage');
  btn.addEventListener('click', async () => {
    msg.textContent = '';
    msg.className = 'form-message';
    try {
      await apiRequest('/api/email/test-reminder', { method: 'POST' });
      msg.textContent = 'Test reminder email triggered.';
      msg.classList.add('success');
    } catch (err) {
      msg.textContent = err.message || 'Could not send email.';
      msg.classList.add('error');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  handleLogin();
  fetchCurrentUser();
  attachLogout();
  initHabitForm();
  initUploadForm();
  initManualDataForm();
  initAiRefresh();
  initEmailTest();
  loadCharts();
  loadAnalytics();
});

