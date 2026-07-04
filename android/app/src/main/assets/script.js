const TMDB_API_KEY = '5e10bf06e4f15dae6e9ff35ff35e8df2';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const APP_VERSION = 'v1.0.12';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

window.addEventListener('DOMContentLoaded', () => {
    fetchPopularMovies();
    setTimeout(checkForUpdates, 2000);
});
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMovies(); });

// Menu buttons (profile only)
const menuProfileBtn = document.getElementById('menuProfileBtn');
const menuLoginBtn = document.getElementById('menuLoginBtn');

function openProfileModal() {
    updateProfileModal();
    document.getElementById('profileModal').classList.add('active');
}

function openWalletModal() {
    document.getElementById('walletModal').style.display = 'block';
    document.getElementById('walletModalOverlay').style.display = 'block';
}

function closeWalletModal() {
    document.getElementById('walletModal').style.display = 'none';
    document.getElementById('walletModalOverlay').style.display = 'none';
}

// Wire menu buttons if present
if (menuLoginBtn) menuLoginBtn.addEventListener('click', openWalletModal);
if (menuProfileBtn) menuProfileBtn.addEventListener('click', openProfileModal);

// Wallet modal listeners
const walletModalClose = document.getElementById('walletModalClose');
const walletModalOverlay = document.getElementById('walletModalOverlay');
const connectMetaMask = document.getElementById('connectMetaMask');

if (walletModalClose) walletModalClose.addEventListener('click', closeWalletModal);
if (walletModalOverlay) walletModalOverlay.addEventListener('click', closeWalletModal);

// Connect from modal
if (connectMetaMask) {
    connectMetaMask.addEventListener('click', async () => {
        closeWalletModal();
        const result = await web3Auth.connectMetaMask();
        if (result) handleWeb3Login(result, 'MetaMask');
    });
}

// Profile modal listeners
const profileClose = document.getElementById('profileClose');
if (profileClose) profileClose.addEventListener('click', () => document.getElementById('profileModal').classList.remove('active'));
const profileSignOut = document.getElementById('profileSignOut');
if (profileSignOut) profileSignOut.addEventListener('click', () => { signOutWeb3(); document.getElementById('profileModal').classList.remove('active'); });

function setGridMessage(message) {
    moviesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--primary); font-family: 'Share Tech Mono', monospace; font-size: 1.2rem;">${message}</p>`;
}

async function fetchPopularMovies() {
    try {
        setGridMessage('Loading CyberCinema Data...');
        const res = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        if (!res.ok) throw new Error(`HTTP error!`);
        const data = await res.json();
        displayMovies(data.results);
    } catch (error) { 
        setGridMessage('Network Failure. Retrying...'); 
        setTimeout(fetchPopularMovies, 3000);
    }
}

async function searchMovies() {
    const term = searchInput.value.trim();
    if (!term) return fetchPopularMovies();
    try {
        setGridMessage('Scanning Databases...');
        const res = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(term)}`);
        const data = await res.json();
        displayMovies(data.results);
    } catch (error) { 
        setGridMessage('Error locating target.'); 
    }
}

function displayMovies(moviesToDisplay) {
    moviesGrid.innerHTML = '';
    if (!moviesToDisplay || moviesToDisplay.length === 0) {
        setGridMessage('No matches found in the mainframe.');
        return;
    }
    const fragment = document.createDocumentFragment();
    moviesToDisplay.forEach(movie => {
        if (!movie.poster_path) return;
        const card = document.createElement('div');
        card.className = 'movie-card';
        
        card.onclick = () => window.location.href = `play.html?tmdb=${movie.id}`;

        card.innerHTML = `
            <img src="${IMAGE_BASE_URL}${movie.poster_path}" class="movie-poster">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-year">${movie.release_date ? movie.release_date.substring(0,4) : 'N/A'}</div>
                <div class="movie-rating">⭐ ${movie.vote_average.toFixed(1)}</div>
            </div>
        `;
        fragment.appendChild(card);
    });
    moviesGrid.appendChild(fragment);
}

// --- WEB3 SIGN OUT ---
function signOutWeb3() {
    web3Auth.disconnect();
    localStorage.removeItem('g_user');
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('walletInfo').style.display = 'none';
    document.getElementById('signOutBtn').style.display = 'none';
}

// Wire up Web3 auth UI on load
window.addEventListener('DOMContentLoaded', () => {
    // Restore UI from localStorage if possible
    const stored = localStorage.getItem('g_user');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (parsed.type === 'web3') {
                document.getElementById('userInfo').innerText = parsed.shortAddress;
                document.getElementById('userInfo').style.display = 'block';
                document.getElementById('walletInfo').innerText = `Connected via ${parsed.provider}`;
                document.getElementById('walletInfo').style.display = 'block';
                document.getElementById('signOutBtn').style.display = 'inline-block';
            }
        } catch (e) { console.warn(e); }
    }

    const outBtn = document.getElementById('signOutBtn');
    if (outBtn) outBtn.addEventListener('click', signOutWeb3);
});

// ===== WEB3 WALLET HANDLERS =====
// Handlers moved to modal click listeners above

// Handle Web3 login
function handleWeb3Login(walletData, provider) {
    const userInfo = document.getElementById('userInfo');
    const walletInfo = document.getElementById('walletInfo');
    const signOutBtn = document.getElementById('signOutBtn');

    // Update UI
    userInfo.innerText = `Wallet: ${walletData.shortAddress}`;
    userInfo.style.display = 'block';
    walletInfo.innerText = `Connected via ${provider}`;
    walletInfo.style.display = 'block';
    signOutBtn.style.display = 'inline-block';

    // Store wallet data in localStorage
    localStorage.setItem('g_user', JSON.stringify({
        type: 'web3',
        provider: provider,
        address: walletData.address,
        shortAddress: walletData.shortAddress,
        balance: walletData.balance,
        chainId: walletData.chainId,
        chainName: walletData.chainName,
        email: walletData.shortAddress
    }));

    console.log(`Connected to ${provider}:`, walletData);
}

// Update profile modal with wallet data
function updateProfileModal() {
    const profileModal = document.getElementById('profileModal');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const walletAssetsSection = document.getElementById('walletAssetsSection');
    const walletAddress = document.getElementById('walletAddress');
    const walletBalance = document.getElementById('walletBalance');
    const walletChain = document.getElementById('walletChain');

    const stored = localStorage.getItem('g_user');
    if (!stored) return;

    try {
        const userData = JSON.parse(stored);

        if (userData.type === 'web3') {
            // Web3 wallet login
            profileName.innerText = userData.provider;
            profileEmail.innerText = userData.shortAddress;
            walletAssetsSection.style.display = 'block';
            walletAddress.innerHTML = `<strong>Address:</strong> ${userData.address}`;
            walletBalance.innerHTML = `<strong>Balance:</strong> ${userData.balance} ${userData.chainName.includes('Polygon') ? 'MATIC' : userData.chainName.includes('Binance') ? 'BNB' : 'ETH'}`;
            walletChain.innerHTML = `<strong>Network:</strong> ${userData.chainName}`;
        }
    } catch (e) {
        console.error('Profile update error:', e);
    }
}

// Open profile modal from wallet info
document.getElementById('userInfo')?.addEventListener('click', () => {
    updateProfileModal();
    document.getElementById('profileModal').classList.add('active');
});

document.getElementById('walletInfo')?.addEventListener('click', () => {
    updateProfileModal();
    document.getElementById('profileModal').classList.add('active');
});

// Refresh wallet balance
document.getElementById('walletRefresh')?.addEventListener('click', async () => {
    if (web3Auth.isConnected()) {
        const balance = await web3Auth.refreshBalance();
        const walletBalance = document.getElementById('walletBalance');
        const userData = JSON.parse(localStorage.getItem('g_user'));
        walletBalance.innerHTML = `<strong>Balance:</strong> ${balance} ${userData.chainName.includes('Polygon') ? 'MATIC' : userData.chainName.includes('Binance') ? 'BNB' : 'ETH'}`;
        
        // Update localStorage
        userData.balance = balance;
        localStorage.setItem('g_user', JSON.stringify(userData));
    }
});
async function checkForUpdates() {
    try {
        const response = await fetch('https://api.github.com/repos/seangritthy/seangritthy.github.io/releases/latest');
        const release = await response.json();
        if (release.tag_name && release.tag_name !== APP_VERSION) {
            const current = parseFloat(APP_VERSION.replace('v', '').split('.').join('.'));
            const latest = parseFloat(release.tag_name.replace('v', '').split('.').join('.'));
            if (latest > current) {
                showUpdatePrompt(release);
            }
        }
    } catch (e) {
        console.error('Failed to check for updates:', e);
    }
}

function showUpdatePrompt(release) {
    const apkAsset = release.assets.find(a => a.name.endsWith('.apk'));
    const downloadUrl = apkAsset ? apkAsset.browser_download_url : release.html_url;
    
    const updateModal = document.createElement('div');
    updateModal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.8); z-index: 99999;
        display: flex; align-items: center; justify-content: center;
        backdrop-filter: blur(5px);
    `;
    updateModal.innerHTML = `
        <div style="background: #1e1e2d; padding: 30px; border-radius: 12px; text-align: center; max-width: 90%; width: 400px; border: 1px solid #333; font-family: 'Inter', sans-serif;">
            <h2 style="color: #fff; margin-bottom: 15px; font-family: 'Space Grotesk', sans-serif;">New Update Available!</h2>
            <p style="color: #aaa; margin-bottom: 25px;">Version ${release.tag_name} is now available. Please update to enjoy the latest features and bug fixes.</p>
            <a href="${downloadUrl}" target="_blank" style="display: inline-block; background: #6f5cff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; width: 100%; box-sizing: border-box; margin-bottom: 15px;">Download Update</a>
            <button onclick="this.parentElement.parentElement.remove()" style="background: transparent; border: 1px solid #555; color: #888; padding: 10px 24px; border-radius: 8px; cursor: pointer; width: 100%;">Remind Me Later</button>
        </div>
    `;
    document.body.appendChild(updateModal);
}