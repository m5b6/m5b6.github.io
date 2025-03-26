async function fetchGitHubContributions() {
  try {
    const response = await fetch(
      "https://github-contributions-api.jogruber.de/v4/m5b6"
    );
    const data = await response.json();

    // Process the data
    const contributionData = {};
    const today = new Date().toISOString().split("T")[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    let todayCount = 0;
    let monthCount = 0;
    let yearCount = 0;
    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    data.contributions.forEach((contribution) => {
      const date = contribution.date;
      const count = contribution.count;
      contributionData[date] = count;

      if (date === today) todayCount = count;
      if (date >= lastMonth.toISOString().split("T")[0]) monthCount += count;
      if (date >= lastYear.toISOString().split("T")[0]) yearCount += count;

      if (count > 0) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
        if (date === today) currentStreak = tempStreak;
      } else {
        tempStreak = 0;
      }
    });

    const totalContributions = Object.values(data.total).reduce(
      (a, b) => a + b,
      0
    );

    return {
      contributions: contributionData,
      stats: {
        totalContributions,
        totalCommits: yearCount,
        currentStreak,
        maxStreak,
      },
    };
  } catch (error) {
    console.error("Error fetching GitHub contributions:", error);
    return { contributions: {}, stats: {} };
  }
}

function calculateStats(contributions, stats) {
  const today = new Date().toISOString().split("T")[0];
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  let todayCount = contributions[today] || 0;
  let monthCount = 0;
  let yearCount = 0;

  Object.entries(contributions).forEach(([date, count]) => {
    if (date >= lastMonth.toISOString().split("T")[0]) monthCount += count;
    if (date >= lastYear.toISOString().split("T")[0]) yearCount += count;
  });

  return {
    todayCount,
    monthCount,
    yearCount,
    totalContributions: stats.totalContributions || 0,
    currentStreak: stats.currentStreak || 0,
    maxStreak: stats.maxStreak || 0,
  };
}

function createContributionVisualization(data) {
  const container = document.createElement("div");
  container.className = "github-contributions";

  const stats = calculateStats(data.contributions, data.stats);

  const statsContainer = document.createElement("div");
  statsContainer.className = "contribution-stats";

  const headerContainer = document.createElement("div");
  headerContainer.className = "contribution-header";

  const helpButton = document.createElement("button");
  helpButton.className = "help-button";
  helpButton.textContent = "?";
  helpButton.setAttribute("aria-label", "About Contributions");
  headerContainer.appendChild(helpButton);

  container.appendChild(headerContainer);

  const todayStat = document.createElement("div");
  todayStat.className = "stat-item";
  todayStat.innerHTML = `<span class="stat-number">${stats.todayCount}</span> <span class="stat-text">hoy</span>`;

  const monthStat = document.createElement("div");
  monthStat.className = "stat-item";
  monthStat.innerHTML = `<span class="stat-number">${stats.monthCount}</span> <span class="stat-text">este mes</span>`;

  const yearStat = document.createElement("div");
  yearStat.className = "stat-item";
  yearStat.innerHTML = `<span class="stat-number">${stats.yearCount}</span> <span class="stat-text">este año</span>`;

  const streakStat = document.createElement("div");
  streakStat.className = "stat-item";
  streakStat.innerHTML = `<span class="stat-number">${stats.currentStreak}</span> <span class="stat-text">racha</span>`;

  statsContainer.appendChild(todayStat);
  statsContainer.appendChild(monthStat);
  statsContainer.appendChild(yearStat);
  statsContainer.appendChild(streakStat);
  container.appendChild(statsContainer);

  const grid = document.createElement("div");
  grid.className = "contribution-grid";

  const maxCount = Math.max(...Object.values(data.contributions));
  
  // Restructure grid to match GitHub style - weeks as columns, days as rows
  const today = new Date();
  const days = [];
  
  // Collect all days first
  for (let i = 364; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    const count = data.contributions[dateStr] || 0;
    const normalizedCount =
      maxCount > 0 ? Math.min(10, Math.ceil((count / maxCount) * 10)) : 0;
      
    days.push({
      date: dateStr,
      count,
      normalizedCount,
      dayOfWeek: date.getDay()
    });
  }
  
  // Organize by weeks (columns)
  const weeks = [];
  let currentWeek = [];
  let lastDayOfWeek = -1;
  
  days.forEach(day => {
    // Start a new week when we reach Sunday (0) after having higher day numbers
    if (day.dayOfWeek < lastDayOfWeek) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
    currentWeek.push(day);
    lastDayOfWeek = day.dayOfWeek;
  });
  
  // Add the last week
  if (currentWeek.length > 0) {
    weeks.push([...currentWeek]);
  }
  
  // Create cells for each week (column)
  weeks.forEach(week => {
    const weekColumn = document.createElement("div");
    weekColumn.className = "week-column";
    
    // Create cells for each day in the week (rows)
    week.forEach(day => {
      const cell = document.createElement("div");
      cell.className = "contribution-cell";
      cell.setAttribute("data-date", day.date);
      cell.setAttribute("data-count", day.normalizedCount);
      
      const tooltip = document.createElement("div");
      tooltip.className = "contribution-tooltip";
      tooltip.textContent = `${day.date}: ${day.count} contribuciones`;
      cell.appendChild(tooltip);
      
      weekColumn.appendChild(cell);
    });
    
    grid.appendChild(weekColumn);
  });

  container.appendChild(grid);

  // Create modal
  const modal = document.createElement("div");
  modal.className = "contribution-modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Contribuciones</h3>
      <p>Cada celda representa un día de los ultimos 365 días</p>
      <p>La intensidad del color indica el número de contribuciones (código) que hice ese día</p>
      <button class="close-modal">OK</button>
    </div>
  `;
  container.appendChild(modal);

  // Add event listeners
  helpButton.addEventListener("click", () => {
    modal.classList.add("active");
    document.body.classList.add("modal-open");
  });

  modal.querySelector(".close-modal").addEventListener("click", () => {
    modal.classList.remove("active");
    document.body.classList.remove("modal-open");
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) {
      modal.classList.remove("active");
      document.body.classList.remove("modal-open");
    }
  });

  return container;
}

function addContributionStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .contribution-header {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
    }
    
    .help-button {
      width: 24px;
      height: 24px;
      background: var(--text-color);
      color: var(--bg-color);
      border: 1px solid var(--text-color);
      font-weight: normal;
      font-size: 14px;
      cursor: pointer;
      font-family: monospace;
    }
    
    .contribution-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(var(--text-color-rgb), 0.8);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }
    
    .contribution-modal.active {
      display: flex;
    }
    
    .modal-content {
      background: var(--bg-color);
      padding: 1rem;
      border: 1px solid var(--text-color);
      max-width: 450px;
      text-align: left;
    }
    
    .modal-content h3 {
      font-size: 1.2rem;
      margin-top: 0;
      margin-bottom: 0.8rem;
      font-weight: bold;
      font-family: monospace;
      border-bottom: 1px solid var(--text-color);
      padding-bottom: 5px;
      color: var(--text-color);
    }
    
    .modal-content p {
      font-size: 0.9rem;
      line-height: 1.4;
      margin-bottom: 0.8rem;
      font-family: monospace;
      color: var(--text-color);
    }
    
    .close-modal {
      background: var(--text-color);
      color: var(--bg-color);
      border: 1px solid var(--text-color);
      padding: 0.3rem 0.7rem;
      font-family: monospace;
      font-size: 0.9rem;
      cursor: pointer;
    }
    
    body.modal-open {
      overflow: hidden;
    }
    
    .contribution-grid {
      display: flex;
      gap: 2px;
      width: 100%;
      margin: 0 auto;
      background-color: var(--text-color);
      padding: 2px;
      border: 1px solid var(--text-color);
      overflow-x: auto;
    }
    
    .week-column {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
  `;
  document.head.appendChild(style);
}

async function initGitHubContributions() {
  addContributionStyles();
  const data = await fetchGitHubContributions();
  const visualization = createContributionVisualization(data);

  const main = document.querySelector("main");
  main.appendChild(visualization);
}

document.addEventListener("DOMContentLoaded", initGitHubContributions);
