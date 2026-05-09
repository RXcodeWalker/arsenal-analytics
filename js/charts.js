/* ===================================================
   ARSENAL ANALYTICS — CHARTS MODULE
   Chart.js configurations for all visualizations
   =================================================== */

// ── Chart.js Global Defaults ─────────────────────────────────
function initChartDefaults() {
  if (typeof Chart === 'undefined') return;

  Chart.defaults.color = '#A0A0B8';
  Chart.defaults.font.family = "'JetBrains Mono', monospace";
  Chart.defaults.font.size = 11;
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
  Chart.defaults.plugins.legend.labels.usePointStyle = true;
  Chart.defaults.plugins.legend.labels.pointStyleWidth = 8;
  Chart.defaults.plugins.legend.labels.padding = 20;
  Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(18,18,30,0.96)';
  Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.10)';
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.padding = 12;
  Chart.defaults.plugins.tooltip.titleFont = { family: "'DM Sans', sans-serif", size: 13, weight: '600' };
  Chart.defaults.plugins.tooltip.bodyFont = { family: "'JetBrains Mono', monospace", size: 11 };
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.tooltip.titleColor = '#F5F5F0';
  Chart.defaults.plugins.tooltip.bodyColor = '#A0A0B8';
}

// ── Radar Chart (Player Stats) ───────────────────────────────
function createRadarChart(canvasId, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  // Destroy existing
  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  return new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 800, easing: 'easeOutQuart' },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            backdropColor: 'transparent',
            color: 'rgba(255,255,255,0.15)',
            font: { size: 9 },
          },
          grid: { color: 'rgba(255,255,255,0.06)' },
          angleLines: { color: 'rgba(255,255,255,0.06)' },
          pointLabels: {
            color: '#A0A0B8',
            font: { size: 11, family: "'DM Sans', sans-serif", weight: '500' },
          }
        }
      },
      plugins: {
        legend: { display: datasets.length > 1 },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${ctx.raw}/100`
          }
        }
      }
    }
  });
}

// ── xG Timeline Chart ────────────────────────────────────────
function createXGTimeline(canvasId, timelineData, homeTeam, awayTeam) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const minutes = timelineData.map(d => d.minute);
  const homeXG  = timelineData.map(d => d.cumHome);
  const awayXG  = timelineData.map(d => d.cumAway);
  const goals   = timelineData.filter(d => d.goal);

  // Goal annotations as point overlays
  const homeGoals = timelineData.map(d => d.goal && d.team === 'home' ? d.cumHome : null);
  const awayGoals = timelineData.map(d => d.goal && d.team === 'away' ? d.cumAway : null);

  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: minutes,
      datasets: [
        {
          label: homeTeam,
          data: homeXG,
          borderColor: '#EF0107',
          backgroundColor: 'rgba(239,1,7,0.08)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#EF0107',
        },
        {
          label: awayTeam,
          data: awayXG,
          borderColor: '#4A6CF7',
          backgroundColor: 'rgba(74,108,247,0.06)',
          borderWidth: 2.5,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHoverBackgroundColor: '#4A6CF7',
        },
        {
          label: `${homeTeam} Goals`,
          data: homeGoals,
          borderColor: 'transparent',
          backgroundColor: '#EF0107',
          pointRadius: 8,
          pointStyle: 'circle',
          showLine: false,
          pointHoverRadius: 10,
          borderWidth: 0,
        },
        {
          label: `${awayTeam} Goals`,
          data: awayGoals,
          borderColor: 'transparent',
          backgroundColor: '#4A6CF7',
          pointRadius: 8,
          pointStyle: 'circle',
          showLine: false,
          pointHoverRadius: 10,
          borderWidth: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 1000, easing: 'easeOutCubic' },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            filter: item => !item.text.includes('Goals'),
          }
        },
        tooltip: {
          filter: (item) => item.datasetIndex < 2,
          callbacks: {
            title: (items) => `Minute ${items[0].label}'`,
            label: (ctx) => ` ${ctx.dataset.label}: ${parseFloat(ctx.raw).toFixed(2)} xG`,
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            maxTicksLimit: 10,
            callback: (val, i, ticks) => `${minutes[i]}'`
          },
          title: { display: true, text: "Minute", color: '#606078', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: "Cumulative xG", color: '#606078', font: { size: 10 } },
          ticks: {
            callback: val => val.toFixed(1)
          }
        }
      }
    }
  });
}

// ── Monthly xG / Goals Bar Chart ─────────────────────────────
function createMonthlyXGChart(canvasId, monthlyData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthlyData.map(d => d.month),
      datasets: [
        {
          label: 'xG For',
          data: monthlyData.map(d => d.xGFor),
          backgroundColor: 'rgba(239,1,7,0.7)',
          borderColor: '#EF0107',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'xG Against',
          data: monthlyData.map(d => d.xGAgainst),
          backgroundColor: 'rgba(74,108,247,0.5)',
          borderColor: '#4A6CF7',
          borderWidth: 1,
          borderRadius: 4,
          borderSkipped: false,
        },
        {
          label: 'Goals',
          data: monthlyData.map(d => d.goals),
          type: 'line',
          borderColor: '#C8A84B',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#C8A84B',
          tension: 0.4,
          yAxisID: 'y1',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { position: 'top' },
        tooltip: {
          callbacks: {
            label: ctx => {
              if (ctx.datasetIndex < 2) return ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}`;
              return ` ${ctx.dataset.label}: ${ctx.raw}`;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          title: { display: true, text: 'xG', color: '#606078', font: { size: 10 } }
        },
        y1: {
          position: 'right',
          grid: { display: false },
          title: { display: true, text: 'Goals', color: '#606078', font: { size: 10 } },
          ticks: { color: '#C8A84B' }
        }
      }
    }
  });
}

// ── Shot Map (Canvas-based) ───────────────────────────────────
function createShotMap(canvasId, shots, homeTeam) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx2d = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Clear
  ctx2d.clearRect(0, 0, W, H);

  // Draw pitch
  drawPitch(ctx2d, W, H);

  if (shots.length === 0) {
    ctx2d.fillStyle = 'rgba(255,255,255,0.35)';
    ctx2d.font = '14px sans-serif';
    ctx2d.textAlign = 'center';
    ctx2d.fillText('Shot data not available for this match', W / 2, H / 2);
    return;
  }

  // Draw shots
  shots.forEach(shot => {
    const isHome = shot.team === homeTeam || !shot.team;
    // Understat stores all shots from attacker's perspective (high x = near goal).
    // Home team attacks right; away team shots must be mirrored so they appear on the left half.
    const px = isHome ? (shot.x / 100) * W : ((100 - shot.x) / 100) * W;
    const py = isHome ? (shot.y / 100) * H : ((100 - shot.y) / 100) * H;

    const r = 4 + shot.xG * 14; // Size by xG
    const isGoal = shot.outcome === 'Goal';

    ctx2d.beginPath();
    ctx2d.arc(px, py, r, 0, Math.PI * 2);

    if (isGoal) {
      ctx2d.fillStyle = isHome ? 'rgba(239,1,7,0.85)' : 'rgba(74,108,247,0.85)';
      ctx2d.strokeStyle = isHome ? '#FF6B6B' : '#7B9EFF';
      ctx2d.lineWidth = 2;
      ctx2d.fill();
      ctx2d.stroke();
    } else if (shot.outcome === 'Saved') {
      ctx2d.fillStyle = 'transparent';
      ctx2d.strokeStyle = isHome ? 'rgba(239,1,7,0.6)' : 'rgba(74,108,247,0.6)';
      ctx2d.lineWidth = 2;
      ctx2d.stroke();
    } else {
      ctx2d.fillStyle = isHome ? 'rgba(239,1,7,0.25)' : 'rgba(74,108,247,0.25)';
      ctx2d.strokeStyle = isHome ? 'rgba(239,1,7,0.4)' : 'rgba(74,108,247,0.4)';
      ctx2d.lineWidth = 1.5;
      ctx2d.fill();
      ctx2d.stroke();
    }
  });
}

function drawPitch(ctx, W, H) {
  ctx.fillStyle = '#0D1F0D';
  ctx.fillRect(0, 0, W, H);

  // Pitch stripes
  const stripeWidth = W / 8;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent';
    ctx.fillRect(i * stripeWidth, 0, stripeWidth, H);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1.5;

  // Outer boundary
  ctx.strokeRect(4, 4, W - 8, H - 8);

  // Half-way line
  ctx.beginPath();
  ctx.moveTo(W / 2, 4);
  ctx.lineTo(W / 2, H - 4);
  ctx.stroke();

  // Centre circle
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, H * 0.12, 0, Math.PI * 2);
  ctx.stroke();

  // Left penalty area (away)
  const paW = W * 0.16;
  const paH = H * 0.42;
  ctx.strokeRect(4, (H - paH) / 2, paW, paH);

  // Left 6-yard box
  const syardW = W * 0.06;
  const syardH = H * 0.20;
  ctx.strokeRect(4, (H - syardH) / 2, syardW, syardH);

  // Right penalty area (home)
  ctx.strokeRect(W - 4 - paW, (H - paH) / 2, paW, paH);
  ctx.strokeRect(W - 4 - syardW, (H - syardH) / 2, syardW, syardH);

  // Penalty spots
  const dotR = 2.5;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';

  // Left penalty spot
  ctx.beginPath();
  ctx.arc(W * 0.12, H / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Right penalty spot
  ctx.beginPath();
  ctx.arc(W * 0.88, H / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Centre spot
  ctx.beginPath();
  ctx.arc(W / 2, H / 2, dotR, 0, Math.PI * 2);
  ctx.fill();

  // Goals
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  const goalW = H * 0.10;
  const goalD = 6;

  // Left goal
  ctx.strokeRect(4 - goalD, (H - goalW) / 2, goalD, goalW);
  // Right goal
  ctx.strokeRect(W - 4, (H - goalW) / 2, goalD, goalW);
}

// ── Possession Doughnut ───────────────────────────────────────
function createPossessionChart(canvasId, homePoss, awayPoss, homeTeam, awayTeam) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: [homeTeam, awayTeam],
      datasets: [{
        data: [homePoss, awayPoss],
        backgroundColor: ['rgba(239,1,7,0.8)', 'rgba(74,108,247,0.8)'],
        borderColor: ['#EF0107', '#4A6CF7'],
        borderWidth: 2,
        hoverBorderWidth: 3,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '72%',
      animation: { animateRotate: true, duration: 1000 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

// ── Season Stats Line Chart ───────────────────────────────────
function createSeasonLineChart(canvasId, labels, datasets) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800 },
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

// ── Horizontal Bar Chart ──────────────────────────────────────
function createHorizontalBar(canvasId, labels, data, color = '#EF0107') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: `${color}CC`,
        borderColor: color,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.raw}`
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { grid: { display: false } }
      }
    }
  });
}

// ── Bubble Chart (Progressive Passes) ────────────────────────
function createBubbleChart(canvasId, playerData) {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const colors = ['#EF0107', '#C8A84B', '#4ADE80', '#60A5FA', '#F97316', '#A78BFA'];

  return new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: playerData.map((p, i) => ({
        label: p.name,
        data: [{
          x: p.stats.progressivePasses,
          y: p.stats.progressiveCarries,
          r: Math.sqrt(p.stats.xG) * 4 + 4
        }],
        backgroundColor: `${colors[i % colors.length]}55`,
        borderColor: colors[i % colors.length],
        borderWidth: 2,
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 800 },
      plugins: {
        legend: { position: 'right' },
        tooltip: {
          callbacks: {
            label: ctx => [
              ` ${ctx.dataset.label}`,
              ` Prog. Passes: ${ctx.raw.x}`,
              ` Prog. Carries: ${ctx.raw.y}`,
              ` xG: ${(((ctx.raw.r - 4) / 4) ** 2).toFixed(1)}`
            ]
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Progressive Passes', color: '#606078', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        },
        y: {
          title: { display: true, text: 'Progressive Carries', color: '#606078', font: { size: 10 } },
          grid: { color: 'rgba(255,255,255,0.04)' }
        }
      }
    }
  });
}

// ── Season Comparison Polar Chart ────────────────────────────
function createPolarChart(canvasId, labels, data, label = 'Team') {
  const ctx = document.getElementById(canvasId);
  if (!ctx) return null;

  const existing = Chart.getChart(canvasId);
  if (existing) existing.destroy();

  const colors = ['rgba(239,1,7,0.6)','rgba(200,168,75,0.6)','rgba(74,222,128,0.6)',
                  'rgba(96,165,250,0.6)','rgba(249,115,22,0.6)','rgba(167,139,250,0.6)'];

  return new Chart(ctx, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.6', '1')),
        borderWidth: 1.5,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 800, animateRotate: true },
      plugins: { legend: { position: 'right' } },
      scales: {
        r: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: {
            backdropColor: 'transparent',
            color: 'rgba(255,255,255,0.2)',
            font: { size: 9 }
          }
        }
      }
    }
  });
}

// Initialize chart defaults when DOM ready
document.addEventListener('DOMContentLoaded', initChartDefaults);
