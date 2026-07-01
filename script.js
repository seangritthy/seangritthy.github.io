const TMDB_API_KEY = '5e10bf06e4f15dae6e9ff35ff35e8df2';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

window.addEventListener('DOMContentLoaded', fetchPopularMovies);
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMovies(); });

// Menu buttons (login/profile)
const menuLoginBtn = document.getElementById('menuLoginBtn');
const menuProfileBtn = document.getElementById('menuProfileBtn');

function openProfileModal() {
    const stored = localStorage.getItem('g_user');
    if (!stored) return alert('Not signed in');
    const parsed = JSON.parse(stored);
    document.getElementById('profileName').innerText = parsed.name || parsed.email || 'Profile';
    document.getElementById('profileEmail').innerText = parsed.email || '';
    document.getElementById('profileModal').classList.add('active');
}

// Wire menu buttons if present
if (menuLoginBtn) {
    menuLoginBtn.addEventListener('click', () => {
        if (window.google && google.accounts && google.accounts.id) {
            google.accounts.id.prompt();
        } else {
            // fallback: scroll to header sign-in UI
            const s = document.getElementById('gSignInDiv'); if (s) s.scrollIntoView({behavior:'smooth'});
        }
    });
}
if (menuProfileBtn) menuProfileBtn.addEventListener('click', openProfileModal);

// Profile modal listeners
const profileClose = document.getElementById('profileClose');
if (profileClose) profileClose.addEventListener('click', () => document.getElementById('profileModal').classList.remove('active'));
const profileSignOut = document.getElementById('profileSignOut');
if (profileSignOut) profileSignOut.addEventListener('click', () => { signOut(); document.getElementById('profileModal').classList.remove('active'); });

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

// --- GOOGLE SIGN-IN (Client-only) ---
// NOTE: Replace with your Google OAuth Client ID from Google Cloud Console.
const GOOGLE_CLIENT_ID = '977612649614-l0573h7jas2dqrnm87tf5s2o0dfm080g.apps.googleusercontent.com';

function handleCredentialResponse(response) {
    try {
        const jwt = response.credential;
        const payload = JSON.parse(atob(jwt.split('.')[1]));
        const name = payload.name || payload.email || 'User';
        document.getElementById('userInfo').innerText = `Hello, ${name}`;
        document.getElementById('userInfo').style.display = 'block';
        document.getElementById('gSignInDiv').style.display = 'none';
        document.getElementById('signOutBtn').style.display = 'inline-block';
        localStorage.setItem('g_user', JSON.stringify(payload));
    } catch (e) { console.warn('Google sign-in parse failed', e); }
}

function initializeGoogleSignIn() {
    if (!window.google || !google.accounts || !google.accounts.id) return;
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('REPLACE_')) {
        console.warn('Google Sign-In not initialized: set GOOGLE_CLIENT_ID in script.js');
        return;
    }
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleCredentialResponse });
    google.accounts.id.renderButton(document.getElementById('gSignInDiv'), { theme: 'outline', size: 'medium' });
}

function signOut() {
    const stored = localStorage.getItem('g_user');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (window.google && google.accounts && google.accounts.id && parsed.email) {
                google.accounts.id.revoke(parsed.email, () => console.log('revoked'));
            }
        } catch (e) {}
    }
    localStorage.removeItem('g_user');
    document.getElementById('userInfo').style.display = 'none';
    document.getElementById('gSignInDiv').style.display = 'block';
    document.getElementById('signOutBtn').style.display = 'none';
}

// Wire up auth UI on load
window.addEventListener('DOMContentLoaded', () => {
    // Initialize Google Sign-In (if client lib loaded)
    initializeGoogleSignIn();

    // Restore UI from localStorage if possible
    const stored = localStorage.getItem('g_user');
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            const name = parsed.name || parsed.email || 'User';
            document.getElementById('userInfo').innerText = `Hello, ${name}`;
            document.getElementById('userInfo').style.display = 'block';
            document.getElementById('gSignInDiv').style.display = 'none';
            document.getElementById('signOutBtn').style.display = 'inline-block';
        } catch (e) { console.warn(e); }
    }

    const outBtn = document.getElementById('signOutBtn');
    if (outBtn) outBtn.addEventListener('click', signOut);
});