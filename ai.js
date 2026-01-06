function calculateCompletionRate(records) {
  if (!records.length) return 0;
  const completed = records.filter((r) => r.status === 1 || r.status === '1').length;
  return completed / records.length;
}

function calculateStreaks(records) {
  if (!records.length) return { currentStreak: 0, longestStreak: 0, timeline: [] };
  const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
  let currentStreak = 0;
  let longestStreak = 0;
  let lastDate = null;
  const timeline = [];

  for (const r of sorted) {
    const d = new Date(r.date);
    if (r.status === 1 || r.status === '1') {
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
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    }
    timeline.push({ date: r.date, streak: currentStreak });
    lastDate = d;
  }
  return { currentStreak, longestStreak, timeline };
}

function calculateWeeklyTrend(records) {
  if (!records.length) return { currentWeekRate: 0, lastWeekRate: 0, trend: 'stable' };
  const now = new Date();
  const getWeek = (d) => {
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
  };
  const currentWeek = getWeek(now);
  const lastWeek = currentWeek - 1;
  let curTotal = 0;
  let curCompleted = 0;
  let lastTotal = 0;
  let lastCompleted = 0;

  for (const r of records) {
    const d = new Date(r.date);
    const w = getWeek(d);
    const isCompleted = r.status === 1 || r.status === '1';
    if (w === currentWeek) {
      curTotal += 1;
      if (isCompleted) curCompleted += 1;
    } else if (w === lastWeek) {
      lastTotal += 1;
      if (isCompleted) lastCompleted += 1;
    }
  }

  const currentWeekRate = curTotal ? curCompleted / curTotal : 0;
  const lastWeekRate = lastTotal ? lastCompleted / lastTotal : 0;
  let trend = 'stable';
  if (currentWeekRate > lastWeekRate + 0.05) trend = 'improving';
  else if (currentWeekRate + 0.05 < lastWeekRate) trend = 'declining';

  return { currentWeekRate, lastWeekRate, trend };
}

function analyzeHabits(records) {
  const completionRate = calculateCompletionRate(records);
  const { currentStreak, longestStreak, timeline } = calculateStreaks(records);
  const { currentWeekRate, lastWeekRate, trend } = calculateWeeklyTrend(records);

  let predictionScore = 0.5;
  let riskLevel = 'medium';
  let message = 'Keep tracking your habits to unlock personalized insights.';

  if (completionRate > 0.75) {
    predictionScore = 0.85;
    riskLevel = 'low';
    message = 'Excellent consistency. You are highly likely to sustain this habit long-term.';
  } else if (completionRate >= 0.5) {
    predictionScore = 0.7;
    riskLevel = 'medium';
    message = 'You have a decent completion rate. Consider focusing on fewer key habits to increase success.';
  } else {
    predictionScore = 0.4;
    riskLevel = 'high';
    message = 'Your current pattern suggests a risk of habit drop-off. Try reducing difficulty or changing habit timing.';
  }

  const behavioralInsights = [];
  if (trend === 'improving') {
    behavioralInsights.push('Your weekly trend is improving—recent changes in your routine are working.');
  } else if (trend === 'declining') {
    behavioralInsights.push('Your recent weeks show a decline in completion. Identify obstacles and adjust your plan.');
  } else {
    behavioralInsights.push('Your performance is stable. Small adjustments could lead to further gains.');
  }

  if (currentStreak >= 5) {
    behavioralInsights.push(`You have a strong current streak of ${currentStreak} days—protect it by planning ahead.`);
  } else if (longestStreak >= 5) {
    behavioralInsights.push(`Your best streak was ${longestStreak} days. Aim to beat that record with small daily wins.`);
  }

  return {
    predictionScore,
    riskLevel,
    message,
    keyMetrics: {
      completionRate: (completionRate * 100).toFixed(1) + '%',
      currentStreak,
      longestStreak,
      currentWeekRate: (currentWeekRate * 100).toFixed(1) + '%',
      lastWeekRate: (lastWeekRate * 100).toFixed(1) + '%',
      trend,
    },
    behavioralInsights,
    streakTimeline: timeline,
  };
}

module.exports = {
  analyzeHabits,
};

