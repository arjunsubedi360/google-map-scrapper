// Background service worker to manage scraping state
let scrapingState = {
    isActive: false,
    data: [],
    current: 0,
    total: 0,
    tabId: null
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.action);

    if (message.action === 'startScraping') {
        scrapingState.isActive = true;
        scrapingState.data = [];
        scrapingState.current = 0;
        scrapingState.total = 0;
        scrapingState.tabId = message.tabId;

        // Save to storage
        chrome.storage.local.set({ scrapingState });
        sendResponse({ success: true });

    } else if (message.action === 'stopScraping') {
        scrapingState.isActive = false;
        chrome.storage.local.set({ scrapingState });
        sendResponse({ success: true });

    } else if (message.action === 'progressUpdate') {
        // Update state with new data
        scrapingState.data = message.allData;
        scrapingState.current = message.current;
        scrapingState.total = message.total;

        // Save to storage
        chrome.storage.local.set({ scrapingState });

        // Broadcast to all popup instances
        chrome.runtime.sendMessage({
            action: 'dataUpdate',
            data: scrapingState.data,
            current: scrapingState.current,
            total: scrapingState.total
        }).catch(() => {
            // Popup might be closed, that's ok
        });

    } else if (message.action === 'scrapingComplete') {
        scrapingState.isActive = false;
        scrapingState.data = message.data;
        scrapingState.current = message.total;
        scrapingState.total = message.total;

        // Save to storage
        chrome.storage.local.set({ scrapingState });

        // Broadcast completion
        chrome.runtime.sendMessage({
            action: 'scrapingFinished',
            data: message.data,
            total: message.total
        }).catch(() => {
            // Popup might be closed, that's ok
        });

    } else if (message.action === 'getState') {
        // Return current state
        sendResponse(scrapingState);
    }

    return true;
});

// Initialize state from storage on startup
chrome.storage.local.get(['scrapingState'], (result) => {
    if (result.scrapingState) {
        scrapingState = result.scrapingState;
        // Reset active state on extension reload
        scrapingState.isActive = false;
        chrome.storage.local.set({ scrapingState });
    }
});
