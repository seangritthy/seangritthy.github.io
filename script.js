// TMDB API Configuration
const TMDB_API_KEY = '5e10bf06e4f15dae6e9ff35ff35e8df2';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500';

let allMovies = [];

// DOM Elements
const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Fetch popular movies on page load
window.addEventListener('DOMContentLoaded', () => {
    fetchPopularMovies();
});

// Search functionality
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies();
    }
});

// Fetch popular movies from TMDB
async function fetchPopularMovies() {
    try {
        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=en-US&page=1`
        );
        const data = await response.json();
        allMovies = data.results;
        displayMovies(allMovies);
    } catch (error) {
        console.error('Error fetching movies:', error);
        moviesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">Failed to load movies. Please try again later.</p>';
    }
}

// Search movies from TMDB
async function searchMovies() {
    const searchTerm = searchInput.value.trim();

    if (searchTerm === '') {
        fetchPopularMovies();
        return;
    }

    try {
        moviesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white;">Searching...</p>';
        
        const response = await fetch(
            `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&language=en-US&query=${encodeURIComponent(searchTerm)}&page=1`
        );
        const data = await response.json();
        allMovies = data.results;
        displayMovies(allMovies);
    } catch (error) {
        console.error('Error searching movies:', error);
        moviesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">Error searching movies. Please try again.</p>';
    }
}

// Display movies function
function displayMovies(moviesToDisplay) {
    moviesGrid.innerHTML = '';

    if (!moviesToDisplay || moviesToDisplay.length === 0) {
        moviesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">No movies found. Try a different search!</p>';
        return;
    }

    moviesToDisplay.forEach(movie => {
        // Skip movies without poster images
        if (!movie.poster_path) return;

        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        
        const posterUrl = `${IMAGE_BASE_URL}${movie.poster_path}`;
        const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A';
        const rating = movie.vote_average ? movie.vote_average.toFixed(1) : 'N/A';
        const title = movie.title || 'Unknown Title';

        movieCard.innerHTML = `
            <img src="${posterUrl}" alt="${title}" class="movie-poster" onerror="this.src='https://via.placeholder.com/200x300?text=No+Image'">
            <div class="movie-info">
                <div class="movie-title">${title}</div>
                <div class="movie-year">${releaseYear}</div>
                <div class="movie-rating">${rating}</div>
            </div>
        `;
        moviesGrid.appendChild(movieCard);
    });
}
