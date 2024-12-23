// Content script for LinkedIn Profile Scraper

// Logging function
function logError(context, error) {
    console.error(`[LinkedIn Scraper Content Script Error - ${context}]`, {
        message: error.message,
        stack: error.stack,
        name: error.name,
        toString: error.toString()
    });
}

// Main scraping function with improved error handling
async function scrapeLinkedIn(config) {
    let results = [];

    try {
        // Step 1: Log in to LinkedIn
        const loginProcess = () => {
            return new Promise((resolve, reject) => {
                try {
                    const usernameInput = document.getElementById('username');
                    const passwordInput = document.getElementById('password');
                    const loginButton = document.querySelector('button[type="submit"]');

                    if (!usernameInput || !passwordInput || !loginButton) {
                        reject(new Error('Login elements not found'));
                        return;
                    }

                    usernameInput.value = config.username;
                    passwordInput.value = config.password;
                    
                    // Trigger input events to ensure value is set
                    const event = new Event('input', { bubbles: true });
                    usernameInput.dispatchEvent(event);
                    passwordInput.dispatchEvent(event);

                    // Small delay before clicking
                    setTimeout(() => {
                        loginButton.click();
                        resolve();
                    }, 500);
                } catch (error) {
                    logError('Login Process', error);
                    reject(error);
                }
            });
        };

        // Attempt login
        await loginProcess();

        // Wait for login
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Check if login was successful
        if (window.location.href.includes('/feed/')) {
            console.log('Login successful');
        } else {
            throw new Error('Login failed');
        }

        // Step 2: Navigate to search query
        window.location.href = config.searchQuery;

        // Wait for search results
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 3: Scrape profile URLs
        const scrapedProfileUrls = await getProfileUrls();
        const formattedUrls = formatLinkedInUrls(scrapedProfileUrls);

        // Step 4: Scrape contact info for each profile
        for (let profileUrl of formattedUrls) {
            try {
                console.log(`Scraping profile: ${profileUrl}`);
                const contactInfo = await getContactInfo(profileUrl);
                results.push(contactInfo);
            } catch (profileError) {
                logError(`Profile Scraping Error (${profileUrl})`, profileError);
            }
        }

        return results;
    } catch (error) {
        logError('Scraping Process', error);
        throw error;
    }
}

// Function to scrape profile URLs from the search page
async function getProfileUrls() {
    let profileUrls = [];
    try {
        const profileLinks = document.querySelectorAll('a[href*="/in/"]');
        
        profileLinks.forEach(link => {
            const url = link.href;
            if (url && !profileUrls.includes(url)) {
                profileUrls.push(url);
            }
        });

        if (profileUrls.length === 0) {
            throw new Error('No profile URLs found');
        }
    } catch (error) {
        logError('Get Profile URLs', error);
        throw error;
    }
    return profileUrls;
}

// Function to format profile URLs
function formatLinkedInUrls(urls) {
    return urls.map(url => {
        const match = url.match(/https:\/\/www\.linkedin\.com\/in\/[^/?]+/);
        return match ? `${match[0]}/overlay/contact-info` : null;
    }).filter(formattedUrl => formattedUrl !== null);
}

// Function to scrape contact info from a profile
async function getContactInfo(profileUrl) {
    try {
        // Navigate to profile
        window.location.href = profileUrl;
        
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 5000));

        let profileName = 'N/A';
        let email = 'N/A';

        // Get profile name
        try {
            const profileNameElement = document.querySelector('h1');
            profileName = profileNameElement ? profileNameElement.textContent.trim() : 'N/A';
        } catch (nameError) {
            logError(`Profile Name Error (${profileUrl})`, nameError);
        }

        // Get email
        try {
            const emailElement = document.querySelector("a[href^='mailto:']");
            email = emailElement ? emailElement.href.replace('mailto:', '').trim() : 'N/A';
        } catch (emailError) {
            logError(`Email Error (${profileUrl})`, emailError);
        }

        return { profileUrl, profileName, email };
    } catch (error) {
        logError(`Contact Info Error (${profileUrl})`, error);
        return { profileUrl, profileName: 'N/A', email: 'N/A' };
    }
}

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'START_SCRAPING') {
        scrapeLinkedIn(request.config)
            .then(results => {
                sendResponse({ 
                    results: results,
                    success: true 
                });
            })
            .catch(error => {
                logError('Scraping Message Listener', error);
                sendResponse({ 
                    results: [],
                    success: false,
                    error: error.toString() 
                });
            });
        return true; // Indicates async response
    }
});