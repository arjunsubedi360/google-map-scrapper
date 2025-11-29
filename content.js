chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape") {

    console.log('🔍 Google Maps Enhanced Scraper: Starting...');

    let results = [];
    let shouldStop = false;

    // Listen for stop command
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'stopScraping') {
        shouldStop = true;
      }
    });

    // Find the feed container with all business listings
    const feedContainer = document.querySelector('div[role="feed"]');
    console.log('📦 Feed container found:', feedContainer ? 'YES' : 'NO');

    if (!feedContainer) {
      console.error('❌ No feed container found');
      sendResponse({ data: [], complete: true });
      return true;
    }

    // Function to scroll and load more results
    async function scrollToLoadAll() {
      console.log('📜 Scrolling to load all results...');

      let previousCount = 0;
      let currentCount = 0;
      let noChangeCount = 0;

      while (noChangeCount < 3) {
        // Scroll to bottom of feed
        feedContainer.scrollTo(0, feedContainer.scrollHeight);

        // Wait for new results to load
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Count current results
        currentCount = feedContainer.querySelectorAll('a[class*="hfpxzc"]').length;
        console.log(`📊 Loaded ${currentCount} results`);

        if (currentCount === previousCount) {
          noChangeCount++;
        } else {
          noChangeCount = 0;
        }

        previousCount = currentCount;

        // Max 200 results to prevent infinite loop
        if (currentCount >= 200) {
          console.log('⚠️ Reached 200 results limit');
          break;
        }
      }

      console.log(`✅ Finished loading. Total: ${currentCount} results`);
      return currentCount;
    }

    // Function to extract details from the currently open business panel
    function extractBusinessDetails(fallbackName = 'N/A') {
      return new Promise((resolve) => {
        setTimeout(() => {
          try {
            const details = {
              name: fallbackName,
              phone: 'N/A',
              rating: 'N/A',
              reviews: 'N/A',
              address: 'N/A',
              website: 'N/A',
              email: 'N/A'
            };

            // Get business name
            let nameEl = document.querySelector('h1.fontHeadlineLarge');
            if (!nameEl) nameEl = document.querySelector('h1[class*="fontHeadline"]');
            if (!nameEl) nameEl = document.querySelector('h1.DUwDvf');
            if (!nameEl) {
              const activeLink = document.querySelector('a.hfpxzc[aria-current="page"]');
              if (activeLink) {
                const ariaLabel = activeLink.getAttribute('aria-label');
                if (ariaLabel) details.name = ariaLabel;
              }
            }
            if (nameEl && nameEl.innerText.trim()) {
              details.name = nameEl.innerText.trim();
            }

            // Get rating
            const ratingEl = document.querySelector('div.F7nice span[aria-label*="stars"]');
            if (ratingEl) {
              const ratingText = ratingEl.getAttribute('aria-label');
              const ratingMatch = ratingText.match(/(\d+\.?\d*)\s*stars?/i);
              if (ratingMatch) details.rating = ratingMatch[1];
            } else {
              const ratingAlt = document.querySelector('span.ceNzKf');
              if (ratingAlt) details.rating = ratingAlt.innerText.trim();
            }

            // Get review count
            const reviewEl = document.querySelector('span.F7nice span[aria-label*="reviews"]');
            if (reviewEl) {
              const reviewText = reviewEl.getAttribute('aria-label');
              const reviewMatch = reviewText.match(/([0-9,]+)\s*reviews?/i);
              if (reviewMatch) details.reviews = reviewMatch[1];
            } else {
              const reviewAlt = document.querySelector('span.F7nice button span');
              if (reviewAlt && reviewAlt.innerText.includes('(')) {
                const match = reviewAlt.innerText.match(/\(([0-9,]+)\)/);
                if (match) details.reviews = match[1];
              }
            }

            // Get phone number
            const phoneBtn = document.querySelector('button[data-item-id*="phone"], button[aria-label*="Phone:"]');
            if (phoneBtn) {
              const phoneText = phoneBtn.getAttribute('aria-label') || phoneBtn.innerText;
              const phoneMatch = phoneText.match(/[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}/);
              if (phoneMatch) {
                details.phone = phoneMatch[0];
              } else {
                const phoneDiv = phoneBtn.querySelector('div[class*="fontBodyMedium"]');
                if (phoneDiv) details.phone = phoneDiv.innerText.trim();
              }
            }

            // Get address
            const addressBtn = document.querySelector('button[data-item-id="address"], button[aria-label*="Address:"]');
            if (addressBtn) {
              const addressDiv = addressBtn.querySelector('div[class*="fontBodyMedium"]');
              if (addressDiv) {
                details.address = addressDiv.innerText.trim();
              } else {
                const addressText = addressBtn.getAttribute('aria-label');
                if (addressText) {
                  const match = addressText.match(/Address:\s*(.+)/i);
                  if (match) details.address = match[1];
                }
              }
            }

            // Get website
            const websiteLink = document.querySelector('a[data-item-id="authority"], a[aria-label*="Website:"]');
            if (websiteLink) {
              const websiteDiv = websiteLink.querySelector('div[class*="fontBodyMedium"]');
              if (websiteDiv) {
                details.website = websiteDiv.innerText.trim();
              } else {
                details.website = websiteLink.getAttribute('href') || 'N/A';
              }
            }

            // Try to find email
            const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) details.email = emailMatch[0];

            console.log('✅ Extracted:', details);
            resolve(details);

          } catch (error) {
            console.error('❌ Error extracting details:', error);
            resolve({
              name: fallbackName,
              phone: 'N/A',
              rating: 'N/A',
              reviews: 'N/A',
              address: 'N/A',
              website: 'N/A',
              email: 'N/A'
            });
          }
        }, 2000);
      });
    }

    // Main scraping function
    async function processBusinesses() {
      // First, scroll to load all results
      await scrollToLoadAll();

      // Get all business links after scrolling
      const businessLinks = Array.from(feedContainer.querySelectorAll('a[class*="hfpxzc"]'));
      console.log('📋 Total businesses to scrape:', businessLinks.length);

      if (businessLinks.length === 0) {
        console.warn('⚠️ No business listings found');
        chrome.runtime.sendMessage({
          action: 'scrapingComplete',
          data: [],
          total: 0
        });
        return;
      }

      // Send initial count
      sendResponse({
        data: [],
        complete: false,
        total: businessLinks.length,
        current: 0
      });

      // Process each business
      for (let i = 0; i < businessLinks.length; i++) {
        if (shouldStop) {
          console.log('⏹️ Scraping stopped by user');
          break;
        }

        console.log(`\n🔄 Processing ${i + 1} of ${businessLinks.length}...`);

        try {
          const linkAriaLabel = businessLinks[i].getAttribute('aria-label');
          const linkName = linkAriaLabel || 'N/A';

          businessLinks[i].click();

          const details = await extractBusinessDetails(linkName);
          results.push(details);

          // Send progress update through background
          chrome.runtime.sendMessage({
            action: 'progressUpdate',
            data: details,
            current: i + 1,
            total: businessLinks.length,
            allData: results
          });

          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error('❌ Error:', error);
        }
      }

      console.log('\n🎯 Total results:', results.length);

      // Send completion message
      chrome.runtime.sendMessage({
        action: 'scrapingComplete',
        data: results,
        total: results.length
      });
    }

    // Start processing
    processBusinesses();

    return true;
  }
});
