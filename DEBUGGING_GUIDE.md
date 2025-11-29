# 🔍 Debugging Guide for Google Maps Scraper

## Quick Start: Loading the Extension

1. **Open Chrome Extensions Page**
   - Navigate to `chrome://extensions/`
   - Or click the three dots menu → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Toggle "Developer mode" switch in the top-right corner

3. **Load the Extension**
   - Click "Load unpacked" button
   - Navigate to and select this folder: `/Users/arjunsubedi/Desktop/Arjun Projects/Chrome Extension Scrapper/restaurant-scraper`
   - The extension should now appear in your extensions list

4. **Pin the Extension** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Google Maps Business Scraper"
   - Click the pin icon to keep it visible

---

## Testing the Extension

### Step 1: Go to Google Maps
- Open a new tab and go to https://maps.google.com
- Search for something like: **"restaurants in New York"** or **"coffee shops in San Francisco"**
- Wait for the results to load in the left panel

### Step 2: Open the Extension
- Click the extension icon (or puzzle piece → Google Maps Business Scraper)
- You should see the popup with "Download Leads (CSV)" button

### Step 3: Scrape Data
- Click the "Download Leads (CSV)" button
- Check the status message
- If successful, a CSV file should download automatically

---

## 🐛 Debugging Methods

### Method 1: Console Logs (Recommended)

#### A. Check Content Script Console
1. On the Google Maps page, right-click anywhere → "Inspect"
2. Go to the **Console** tab
3. Click the scrape button in the extension
4. Look for any error messages or logs

#### B. Check Extension Popup Console
1. Right-click the extension icon → "Inspect popup"
2. A DevTools window will open for the popup
3. Go to the **Console** tab
4. Click the scrape button
5. Look for errors or messages

#### C. Check Background/Service Worker (if needed)
1. Go to `chrome://extensions/`
2. Find "Google Maps Business Scraper"
3. Click "Inspect views: service worker" (if available)
4. Check console for errors

### Method 2: Add Debug Logging

Add console.log statements to see what's happening:

**In `content.js`**, add these logs:

```javascript
// After line 14 (after finding feedContainer)
console.log('Feed container found:', feedContainer);
console.log('Result items count:', resultItems.length);

// Inside the forEach loop (after line 30)
console.log('Processing item:', name, phone);

// Before sendResponse (after line 95)
console.log('Total results found:', uniqueResults.length);
console.log('Results:', uniqueResults);
```

**In `popup.js`**, add these logs:

```javascript
// After line 20
console.log('Response received:', response);
console.log('Data length:', response.data.length);
```

### Method 3: Inspect Google Maps HTML Structure

If scraping isn't working, the HTML structure may have changed:

1. On Google Maps search results, right-click a business listing → "Inspect"
2. Look at the HTML structure
3. Find the container that holds all results
4. Find the element that contains the business name
5. Find the element that contains the phone number
6. Update the selectors in `content.js` accordingly

**Current selectors we're using:**
- Feed container: `div[role="feed"]`
- Result items: `div[role="article"]`, `a[class*="hfpxzc"]`
- Business names: `div[class*="fontHeadlineSmall"]`, `div[class*="qBF1Pd"]`
- Phone numbers: Regex pattern or `a[href^="tel:"]`

---

## 🔧 Common Issues & Solutions

### Issue 1: "No data found" message

**Possible causes:**
- Google Maps HTML structure changed
- Results haven't loaded yet
- Wrong page (not on search results)

**Solutions:**
1. Wait for results to fully load
2. Scroll down in the results panel to load more
3. Inspect the HTML and update selectors
4. Check console for errors

### Issue 2: Extension doesn't appear

**Solutions:**
1. Make sure Developer mode is enabled
2. Check for errors in `chrome://extensions/`
3. Click "Reload" button on the extension card
4. Check `manifest.json` for syntax errors

### Issue 3: Phone numbers showing "N/A"

**Possible causes:**
- Phone numbers aren't visible in the search results (need to click each business)
- Phone number format doesn't match our regex

**Solutions:**
1. Google Maps often requires clicking into each business to see phone numbers
2. Consider adding a feature to click each result and extract detailed info
3. Update the phone regex pattern in `content.js`

### Issue 4: Duplicate results

**Solutions:**
- Already handled! We have duplicate removal code
- If still seeing duplicates, check the `seenNames` Set logic

---

## 📝 Making Changes

### After editing any file:

1. **Save the file**
2. **Go to `chrome://extensions/`**
3. **Click the reload icon** (circular arrow) on the extension card
4. **Test again** on Google Maps

### Quick Edit Workflow:

```bash
# 1. Edit files in your code editor
# 2. Save changes
# 3. Reload extension in Chrome
# 4. Refresh the Google Maps page
# 5. Test the scraper again
```

---

## 🎯 Advanced: Scraping More Details

If you want to scrape additional information (address, rating, reviews, etc.):

1. **Inspect the HTML** to find the selectors
2. **Update `content.js`** to extract more fields:

```javascript
results.push({
  name: name,
  phone: phone,
  address: addressEl ? addressEl.innerText.trim() : "N/A",
  rating: ratingEl ? ratingEl.innerText.trim() : "N/A",
  reviews: reviewsEl ? reviewsEl.innerText.trim() : "N/A"
});
```

3. **Update `popup.js`** CSV headers:

```javascript
const csvContent = "data:text/csv;charset=utf-8," 
  + "Business Name,Phone Number,Address,Rating,Reviews\n" 
  + data.map(e => `"${e.name}","${e.phone}","${e.address}","${e.rating}","${e.reviews}"`).join("\n");
```

---

## 📊 Testing Checklist

- [ ] Extension loads without errors
- [ ] Extension icon appears in toolbar
- [ ] Popup opens when clicking icon
- [ ] Can scrape at least some business names
- [ ] Phone numbers are extracted (or show "N/A")
- [ ] CSV file downloads successfully
- [ ] CSV file opens correctly in Excel/Sheets
- [ ] No duplicate entries in results
- [ ] Console shows no errors

---

## 🆘 Need Help?

If you encounter issues:

1. Check the browser console for errors
2. Verify the HTML selectors are still correct
3. Make sure you're on a Google Maps search results page
4. Try a different search query
5. Check if Google Maps updated their layout

**Note:** Google Maps frequently updates their HTML structure, so selectors may need periodic updates.
