let scrapedData = [];
let isScrapingInProgress = false;

// Load saved state when popup opens
chrome.storage.local.get(['scrapingState'], (result) => {
  if (result.scrapingState && result.scrapingState.data) {
    scrapedData = result.scrapingState.data;
    displayData(scrapedData);
    updateStats(scrapedData);

    if (result.scrapingState.isActive) {
      document.getElementById("status").className = 'working';
      document.getElementById("status").innerText = `Scraping in progress... ${result.scrapingState.current} of ${result.scrapingState.total}`;
      document.getElementById("stopBtn").disabled = false;
    } else if (scrapedData.length > 0) {
      document.getElementById("downloadBtn").disabled = false;
      document.getElementById("clearBtn").disabled = false;
      document.getElementById("status").className = 'success';
      document.getElementById("status").innerText = `✅ ${scrapedData.length} businesses scraped`;
    }
  }
});

// Listen for updates from background worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Popup received:', message.action);

  if (message.action === 'dataUpdate') {
    scrapedData = message.data;
    displayData(scrapedData);
    updateStats(scrapedData);

    const statusDiv = document.getElementById("status");
    statusDiv.className = 'working';
    statusDiv.innerText = `Scraping... ${message.current} of ${message.total} businesses`;

  } else if (message.action === 'scrapingFinished') {
    isScrapingInProgress = false;
    scrapedData = message.data;

    const scrapeBtn = document.getElementById("scrapeBtn");
    const scrapeBtnText = document.getElementById("scrapeBtnText");
    const stopBtn = document.getElementById("stopBtn");
    const downloadBtn = document.getElementById("downloadBtn");
    const clearBtn = document.getElementById("clearBtn");
    const statusDiv = document.getElementById("status");

    scrapeBtn.disabled = false;
    scrapeBtnText.innerText = 'Start Scraping';
    stopBtn.disabled = true;
    downloadBtn.disabled = false;
    clearBtn.disabled = false;

    statusDiv.className = 'success';
    statusDiv.innerText = `✅ Success! Scraped ${message.total} businesses.`;

    displayData(scrapedData);
    updateStats(scrapedData);
  }
});

// Start scraping button
document.getElementById("scrapeBtn").addEventListener("click", async () => {
  if (isScrapingInProgress) return;

  const statusDiv = document.getElementById("status");
  const scrapeBtn = document.getElementById("scrapeBtn");
  const scrapeBtnText = document.getElementById("scrapeBtnText");
  const stopBtn = document.getElementById("stopBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");

  isScrapingInProgress = true;
  scrapeBtn.disabled = true;
  stopBtn.disabled = false;
  scrapeBtnText.innerHTML = '<span class="loading-spinner"></span> Scraping...';
  statusDiv.className = 'working';
  statusDiv.innerText = "Loading all results from Google Maps...";

  scrapedData = [];
  displayData(scrapedData);
  document.getElementById("stats").style.display = 'none';

  console.log('🚀 Scrape button clicked');

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  console.log('📑 Active tab:', tab.url);

  // Notify background that scraping started
  chrome.runtime.sendMessage({
    action: 'startScraping',
    tabId: tab.id
  });

  // Inject content script
  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"],
  }, () => {
    console.log('💉 Content script injected');

    statusDiv.innerText = "Scrolling to load all results... This may take a moment.";

    // Send signal to scrape
    chrome.tabs.sendMessage(tab.id, { action: "scrape" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Error:', chrome.runtime.lastError);
        statusDiv.className = 'error';
        statusDiv.innerText = "Error: Refresh the page and try again.";
        isScrapingInProgress = false;
        scrapeBtn.disabled = false;
        stopBtn.disabled = true;
        scrapeBtnText.innerText = 'Start Scraping';
        return;
      }

      console.log('📥 Initial response:', response);

      if (response && response.total) {
        statusDiv.innerText = `Found ${response.total} businesses. Starting to scrape...`;
      }
    });
  });
});

// Stop scraping button
document.getElementById("stopBtn").addEventListener("click", () => {
  console.log('⏹️ Stop button clicked');

  // Send stop message to background
  chrome.runtime.sendMessage({ action: 'stopScraping' });

  // Send stop message to content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'stopScraping' });
    }
  });

  isScrapingInProgress = false;

  const scrapeBtn = document.getElementById("scrapeBtn");
  const scrapeBtnText = document.getElementById("scrapeBtnText");
  const stopBtn = document.getElementById("stopBtn");
  const downloadBtn = document.getElementById("downloadBtn");
  const clearBtn = document.getElementById("clearBtn");
  const statusDiv = document.getElementById("status");

  scrapeBtn.disabled = false;
  scrapeBtnText.innerText = 'Start Scraping';
  stopBtn.disabled = true;

  if (scrapedData.length > 0) {
    downloadBtn.disabled = false;
    clearBtn.disabled = false;
    statusDiv.className = 'success';
    statusDiv.innerText = `⏹️ Stopped. Scraped ${scrapedData.length} businesses.`;
  } else {
    statusDiv.className = '';
    statusDiv.innerText = "Scraping stopped.";
  }
});

// Download button
document.getElementById("downloadBtn").addEventListener("click", () => {
  if (scrapedData.length > 0) {
    downloadCSV(scrapedData);
    const statusDiv = document.getElementById("status");
    statusDiv.className = 'success';
    statusDiv.innerText = `✅ Downloaded ${scrapedData.length} results as CSV!`;
  }
});

// Clear button
document.getElementById("clearBtn").addEventListener("click", () => {
  scrapedData = [];

  // Clear storage
  chrome.storage.local.set({
    scrapingState: {
      isActive: false,
      data: [],
      current: 0,
      total: 0
    }
  });

  const tableContainer = document.getElementById("tableContainer");
  tableContainer.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📊</div>
      <div class="empty-state-text">No data yet. Start scraping to see results here.</div>
    </div>
  `;

  document.getElementById("downloadBtn").disabled = true;
  document.getElementById("clearBtn").disabled = true;
  document.getElementById("stats").style.display = 'none';

  const statusDiv = document.getElementById("status");
  statusDiv.className = '';
  statusDiv.innerText = "Data cleared. Ready to scrape again.";
});

function displayData(data) {
  const tableContainer = document.getElementById("tableContainer");

  if (data.length === 0) {
    tableContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <div class="empty-state-text">No data yet. Start scraping to see results here.</div>
      </div>
    `;
    return;
  }

  let tableHTML = `
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th style="width: 180px;">Business Name</th>
          <th style="width: 120px;">Phone</th>
          <th style="width: 60px;">Rating</th>
          <th style="width: 80px;">Reviews</th>
          <th style="width: 200px;">Address</th>
          <th style="width: 120px;">Website</th>
          <th style="width: 120px;">Email</th>
        </tr>
      </thead>
      <tbody>
  `;

  data.forEach((item, index) => {
    tableHTML += `
      <tr>
        <td>${index + 1}</td>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td>${escapeHtml(item.phone)}</td>
        <td>${item.rating !== 'N/A' ? '⭐ ' + escapeHtml(item.rating) : 'N/A'}</td>
        <td>${escapeHtml(item.reviews)}</td>
        <td style="font-size: 11px;">${escapeHtml(item.address)}</td>
        <td style="font-size: 11px;">${escapeHtml(item.website)}</td>
        <td style="font-size: 11px;">${escapeHtml(item.email)}</td>
      </tr>
    `;
  });

  tableHTML += `
      </tbody>
    </table>
  `;

  tableContainer.innerHTML = tableHTML;

  // Auto-scroll to bottom to show latest entry
  tableContainer.scrollTop = tableContainer.scrollHeight;
}

function updateStats(data) {
  const statsDiv = document.getElementById("stats");
  statsDiv.style.display = 'flex';

  document.getElementById("totalCount").innerText = data.length;

  const withPhone = data.filter(item => item.phone !== 'N/A').length;
  document.getElementById("phoneCount").innerText = withPhone;

  const ratings = data
    .map(item => parseFloat(item.rating))
    .filter(rating => !isNaN(rating));

  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : 'N/A';

  document.getElementById("avgRating").innerText = avgRating;
}

function downloadCSV(data) {
  const csvContent = "data:text/csv;charset=utf-8,"
    + "Business Name,Phone Number,Rating,Reviews,Address,Website,Email\n"
    + data.map(e => `"${e.name}","${e.phone}","${e.rating}","${e.reviews}","${e.address}","${e.website}","${e.email}"`).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);

  const timestamp = new Date().toISOString().slice(0, 10);
  link.setAttribute("download", `google_maps_leads_${timestamp}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
