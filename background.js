// Background script for LinkedIn Profile Scraper

let db = null;

// Configuration (to be secured in future)
const CONFIG = {
  USERNAME: 'lakshmanangokul2q@gmail.com',
  PASSWORD: 'gokulgokul1108@',
  SEARCH_QUERY: 'https://www.linkedin.com/search/results/people/?keywords=Ramasamy'
};

// Improved Logging Function
function logError(context, error) {
  console.error(`[LinkedIn Scraper Error - ${context}]`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    toString: error.toString()
  });
}

// Database Initialization with Improved Error Handling
function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open('LinkedInScraperDB', 1);
      
      request.onupgradeneeded = (event) => {
        const database = event.target.result;
        if (!database.objectStoreNames.contains('profiles')) {
          database.createObjectStore('profiles', { 
            keyPath: 'profileUrl', 
            unique: true 
          });
        }
      };
      
      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };
      
      request.onerror = (event) => {
        const error = event.target.error;
        logError('Database Initialization', error);
        reject(error);
      };
    } catch (error) {
      logError('Database Initialization', error);
      reject(error);
    }
  });
}

// Save profile to IndexedDB with Comprehensive Error Handling
function saveProfile(profile) {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const transaction = db.transaction(['profiles'], 'readwrite');
      const objectStore = transaction.objectStore('profiles');
      
      const request = objectStore.put(profile);
      
      request.onsuccess = () => resolve(profile);
      request.onerror = (event) => {
        const error = event.target.error;
        logError('Save Profile', error);
        reject(error);
      };
    } catch (error) {
      logError('Save Profile', error);
      reject(error);
    }
  });
}

// Retrieve all profiles with Error Handling
function getAllProfiles() {
  return new Promise((resolve, reject) => {
    try {
      if (!db) {
        throw new Error('Database not initialized');
      }

      const transaction = db.transaction(['profiles'], 'readonly');
      const objectStore = transaction.objectStore('profiles');
      
      const request = objectStore.getAll();
      
      request.onsuccess = (event) => {
        const profiles = event.target.result || [];
        resolve(profiles);
      };
      
      request.onerror = (event) => {
        const error = event.target.error;
        logError('Get All Profiles', error);
        reject(error);
      };
    } catch (error) {
      logError('Get All Profiles', error);
      reject(error);
    }
  });
}

// Main Scraping Function with Comprehensive Error Handling
async function scrapeLinkedInProfiles() {
  return new Promise((resolve, reject) => {
    try {
      // Send message to content script to start scraping
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs || tabs.length === 0) {
          throw new Error('No active tab found');
        }

        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'START_SCRAPING',
          config: {
            username: CONFIG.USERNAME,
            password: CONFIG.PASSWORD,
            searchQuery: CONFIG.SEARCH_QUERY
          }
        }, async (response) => {
          // Check for runtime errors
          if (chrome.runtime.lastError) {
            logError('Scraping Message', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
            return;
          }

          // Validate response
          if (!response) {
            const error = new Error('No response received from content script');
            logError('Scraping', error);
            reject(error);
            return;
          }

          // Handle scraping errors
          if (!response.success) {
            const error = new Error(response.error || 'Unknown scraping error');
            logError('Scraping', error);
            reject(error);
            return;
          }

          // Process and save scraped profiles
          try {
            const savedProfiles = [];
            if (response.results && response.results.length > 0) {
              for (let profile of response.results) {
                try {
                  const savedProfile = await saveProfile(profile);
                  savedProfiles.push(savedProfile);
                } catch (saveError) {
                  logError(`Save Individual Profile`, saveError);
                }
              }
            }
            
            resolve(savedProfiles);
          } catch (processingError) {
            logError('Profile Processing', processingError);
            reject(processingError);
          }
        });
      });
    } catch (error) {
      logError('Scrape LinkedIn Profiles', error);
      reject(error);
    }
  });
}

// Message Listener for Communication
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'START_SCRAPING') {
    // Initialize database first
    initDatabase()
      .then(() => scrapeLinkedInProfiles())
      .then(profiles => {
        sendResponse({ 
          success: true, 
          message: `Scraped ${profiles.length} profiles`,
          profiles: profiles
        });
      })
      .catch(error => {
        logError('Scraping Process', error);
        sendResponse({ 
          success: false, 
          message: error.toString(),
          error: error
        });
      });
    return true; // Indicates async response
  } else if (request.action === 'GET_PROFILES') {
    getAllProfiles()
      .then(profiles => {
        sendResponse({ 
          success: true,
          profiles: profiles 
        });
      })
      .catch(error => {
        logError('Get Profiles', error);
        sendResponse({ 
          success: false,
          profiles: [], 
          error: error.toString() 
        });
      });
    return true;
  }
});

// Logging any uncaught exceptions
window.addEventListener('error', (event) => {
  logError('Uncaught Exception', event.error);
});