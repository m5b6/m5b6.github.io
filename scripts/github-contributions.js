/* async function fetchGitHubContributions() {
  try {
    // Fetch the contribution graph data from GitHub profile
    const response = await fetch('https://github.com/users/m5b6/contributions');
    const html = await response.text();
    
    // Create a temporary div to parse the HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    // Find the contribution graph data
    const contributionData = {};
    const today = new Date().toISOString().split('T')[0];
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastYear = new Date();
    lastYear.setFullYear(lastYear.getFullYear() - 1);

    let todayCount = 0;
    let monthCount = 0;
    let yearCount = 0;

    // Find all contribution cells
    const cells = doc.querySelectorAll('.ContributionCalendar-day');
    cells.forEach(cell => {
      const date = cell.getAttribute('data-date');
      const count = parseInt(cell.getAttribute('data-count') || '0');
      contributionData[date] = count;
      
      if (date === today) todayCount = count;
      if (date >= lastMonth.toISOString().split('T')[0]) monthCount += count;
      if (date >= lastYear.toISOString().split('T')[0]) yearCount += count;
    });

    // Get total contributions from the stats
    const totalContributions = parseInt(doc.querySelector('.js-yearly-contributions h2')?.textContent?.match(/\d+/)?.[0] || '0');

    return {
      contributions: contributionData,
      stats: {
        totalContributions,
        totalCommits: yearCount,
        totalRepositories: 0 // We don't need this anymore
      }
    };
  } catch (error) {
    console.error('Error fetching GitHub contributions:', error);
    return { contributions: {}, stats: {} };
  }
}

function calculateStats(contributions, stats) {
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date();
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastYear = new Date();
  lastYear.setFullYear(lastYear.getFullYear() - 1);

  let todayCount = contributions[today] || 0;
  let monthCount = 0;
  let yearCount = 0;

  Object.entries(contributions).forEach(([date, count]) => {
    if (date >= lastMonth.toISOString().split('T')[0]) monthCount += count;
    if (date >= lastYear.toISOString().split('T')[0]) yearCount += count;
  });

  return {
    todayCount,
    monthCount,
    yearCount,
    totalContributions: stats.totalContributions || 0,
    totalCommits: stats.totalCommits || 0
  };
}

function createContributionVisualization(data) {
  const container = document.createElement('div');
  container.className = 'github-contributions';
  
  const stats = calculateStats(data.contributions, data.stats);
  
  const title = document.createElement('h2');
  title.textContent = 'GitHub Activity';
  container.appendChild(title);

  const statsContainer = document.createElement('div');
  statsContainer.className = 'contribution-stats';
  
  const todayStat = document.createElement('div');
  todayStat.className = 'stat-item';
  todayStat.innerHTML = `<span class="stat-number">${stats.todayCount}</span> <span class="stat-text">commits hoy</span>`;
  
  const monthStat = document.createElement('div');
  monthStat.className = 'stat-item';
  monthStat.innerHTML = `<span class="stat-number">${stats.monthCount}</span> <span class="stat-text">commits este mes</span>`;
  
  const yearStat = document.createElement('div');
  yearStat.className = 'stat-item';
  yearStat.innerHTML = `<span class="stat-number">${stats.yearCount}</span> <span class="stat-text">commits este año</span>`;
  
  const totalStat = document.createElement('div');
  totalStat.className = 'stat-item';
  totalStat.innerHTML = `<span class="stat-number">${stats.totalContributions}</span> <span class="stat-text">total commits</span>`;
  
  statsContainer.appendChild(todayStat);
  statsContainer.appendChild(monthStat);
  statsContainer.appendChild(yearStat);
  statsContainer.appendChild(totalStat);
  container.appendChild(statsContainer);

  const grid = document.createElement('div');
  grid.className = 'contribution-grid';
  
  // Create a grid of the last 7x7 days (49 days)
  const today = new Date();
  for (let i = 48; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const cell = document.createElement('div');
    cell.className = 'contribution-cell';
    cell.setAttribute('data-date', dateStr);
    cell.setAttribute('data-count', data.contributions[dateStr] || 0);
    
    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'contribution-tooltip';
    tooltip.textContent = `${dateStr}: ${data.contributions[dateStr] || 0} commits`;
    cell.appendChild(tooltip);
    
    grid.appendChild(cell);
  }
  
  container.appendChild(grid);
  return container;
}

async function initGitHubContributions() {
  const data = await fetchGitHubContributions();
  const visualization = createContributionVisualization(data);
  
  // Add the visualization after the main content
  const main = document.querySelector('main');
  main.appendChild(visualization);
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initGitHubContributions);  */