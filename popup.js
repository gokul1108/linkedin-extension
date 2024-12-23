document.getElementById('startScraping').addEventListener('click', () => {
    const statusEl = document.getElementById('status');
    statusEl.textContent = 'Scraping in progress...';
  
    // Send message to background script to start scraping
    chrome.runtime.sendMessage({ action: 'START_SCRAPING' }, (response) => {
      if (response.success) {
        statusEl.textContent = 'Scraping completed!';
        // Fetch and display profiles
        fetchProfiles();
      } else {
        statusEl.textContent = 'Scraping failed.';
      }
    });
  });
  
  function fetchProfiles() {
    const profileListEl = document.getElementById('profileList');
    profileListEl.innerHTML = ''; // Clear previous results
  
    chrome.runtime.sendMessage({ action: 'GET_PROFILES' }, (response) => {
      if (response.profiles && response.profiles.length > 0) {
        response.profiles.forEach(profile => {
          const profileEl = document.createElement('div');
          profileEl.classList.add('profile-item');
          profileEl.innerHTML = `
            <strong>Name:</strong> ${profile.profileName}<br>
            <strong>Email:</strong> ${profile.email}<br>
            <a href="${profile.profileUrl}" target="_blank">View Profile</a>
          `;
          profileListEl.appendChild(profileEl);
        });
      } else {
        profileListEl.textContent = 'No profiles found.';
      }
    });
  }
  
  // Initial profile fetch on popup load
  fetchProfiles();