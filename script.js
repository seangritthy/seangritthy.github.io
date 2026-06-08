// Sample movie data
const movies = [
    {
        id: 1,
        title: "The Shawshank Redemption",
        year: 2023,
        rating: 9.3,
        poster: "https://via.placeholder.com/200x300?text=Shawshank"
    },
    {
        id: 2,
        title: "The Dark Knight",
        year: 2023,
        rating: 9.0,
        poster: "https://via.placeholder.com/200x300?text=Dark+Knight"
    },
    {
        id: 3,
        title: "Inception",
        year: 2023,
        rating: 8.8,
        poster: "https://via.placeholder.com/200x300?text=Inception"
    },
    {
        id: 4,
        title: "Pulp Fiction",
        year: 2023,
        rating: 8.9,
        poster: "https://via.placeholder.com/200x300?text=Pulp+Fiction"
    },
    {
        id: 5,
        title: "Forrest Gump",
        year: 2023,
        rating: 8.8,
        poster: "https://via.placeholder.com/200x300?text=Forrest+Gump"
    },
    {
        id: 6,
        title: "The Matrix",
        year: 2023,
        rating: 8.7,
        poster: "https://via.placeholder.com/200x300?text=The+Matrix"
    },
    {
        id: 7,
        title: "Interstellar",
        year: 2023,
        rating: 8.6,
        poster: "https://via.placeholder.com/200x300?text=Interstellar"
    },
    {
        id: 8,
        title: "Gladiator",
        year: 2023,
        rating: 8.5,
        poster: "https://via.placeholder.com/200x300?text=Gladiator"
    }
];

// DOM Elements
const moviesGrid = document.getElementById('moviesGrid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Display all movies on page load
window.addEventListener('DOMContentLoaded', () => {
    displayMovies(movies);
});

// Search functionality
searchBtn.addEventListener('click', searchMovies);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchMovies();
    }
});

// Display movies function
function displayMovies(moviesToDisplay) {
    moviesGrid.innerHTML = '';

    if (moviesToDisplay.length === 0) {
        moviesGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: white; font-size: 1.2rem;">No movies found. Try a different search!</p>';
        return;
    }

    moviesToDisplay.forEach(movie => {
        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.innerHTML = `
            <img src="${movie.poster}" alt="${movie.title}" class="movie-poster">
            <div class="movie-info">
                <div class="movie-title">${movie.title}</div>
                <div class="movie-year">${movie.year}</div>
                <div class="movie-rating">${movie.rating}</div>
            </div>
        `;
        moviesGrid.appendChild(movieCard);
    });
}

// Search movies function
function searchMovies() {
    const searchTerm = searchInput.value.toLowerCase().trim();

    if (searchTerm === '') {
        displayMovies(movies);
        return;
    }

    const filtered = movies.filter(movie =>
        movie.title.toLowerCase().includes(searchTerm)
    );

    displayMovies(filtered);
}