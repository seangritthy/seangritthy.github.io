const TMDB_API_KEY = '5e10bf06e4f15dae6e9ff35ff35e8df2';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

window.addEventListener('DOMContentLoaded', fetchPopularMovies);
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchMovies(); });

function setGridMessage(message) {
    moviesGrid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">${message}</p>`;
}

async function fetchPopularMovies() {
    try {
        setGridMessage('Loading CyberCinema Data...');
        const res = await fetch(`${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`);
        if (!res.ok) throw new Error(`HTTP error!`);
        const data = await res.json();
        displayMovies(data.results);
    } catch (error) { setGridMessage('Network Failure. Retrying...'); }
}

async function searchMovies() {
    const term = searchInput.value.trim();
    if (!term) return fetchPopularMovies();
    try {
        setGridMessage('Scanning Databases...');
        const res = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(term)}`);
        const data = await res.json();
        displayMovies(data.results);
    } catch (error) { setGridMessage('Error locating target.'); }
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
        
        // This is where it sends the user to play.html
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
