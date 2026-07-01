const TMDB_API_KEY = '5e10bf06e4f15dae6e9ff35ff35e8df2';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

window.addEventListener('DOMContentLoaded', fetchPopularMovies);
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMovies(); });

// Menu buttons (profile only)
const menuProfileBtn = document.getElementById('menuProfileBtn');

function openProfileModal() {
    updateProfileModal();
    document.getElementById('profileModal').classList.add('active');
}

// Wire profile button if present
if (menuProfileBtn) menuProfileBtn.addEventListener('click', openProfileModal);

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
    document.getElementById('metamaskBtn').style.display = 'inline-block';
    document.getElementById('trustwalletBtn').style.display = 'inline-block';
    document.getElementById('signOutBtn').style.display = 'none';
}

// Wire up Web3 auth UI on load
window.addEventListener('DOMContentLoaded', () => {
    // Show Web3 buttons
    document.getElementById('metamaskBtn').style.display = 'inline-block';
    document.getElementById('trustwalletBtn').style.display = 'inline-block';

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
                document.getElementById('metamaskBtn').style.display = 'none';
                document.getElementById('trustwalletBtn').style.display = 'none';
                document.getElementById('signOutBtn').style.display = 'inline-block';
            }
        } catch (e) { console.warn(e); }
    }

    const outBtn = document.getElementById('signOutBtn');
    if (outBtn) outBtn.addEventListener('click', signOutWeb3);
});

// ===== WEB3 WALLET HANDLERS =====

// Connect MetaMask
document.getElementById('metamaskBtn')?.addEventListener('click', async () => {
    const result = await web3Auth.connectMetaMask();
    if (result) {
        handleWeb3Login(result, 'MetaMask');
    }
});

// Connect Trust Wallet
document.getElementById('trustwalletBtn')?.addEventListener('click', async () => {
    const result = await web3Auth.connectTrustWallet();
    if (result) {
        handleWeb3Login(result, 'Trust Wallet');
    }
});

// Handle Web3 login
function handleWeb3Login(walletData, provider) {
    const userInfo = document.getElementById('userInfo');
    const walletInfo = document.getElementById('walletInfo');
    const metamaskBtn = document.getElementById('metamaskBtn');
    const trustwalletBtn = document.getElementById('trustwalletBtn');
    const signOutBtn = document.getElementById('signOutBtn');

    // Update UI
    userInfo.innerText = `Wallet: ${walletData.shortAddress}`;
    userInfo.style.display = 'block';
    walletInfo.innerText = `Connected via ${provider}`;
    walletInfo.style.display = 'block';
    metamaskBtn.style.display = 'none';
    trustwalletBtn.style.display = 'none';
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
});