# MovieFlix - A Movie Website

A simple, responsive movie website built with HTML, CSS, and JavaScript.

## Features

✅ Browse a collection of movies
✅ Search movies by title
✅ Responsive design (works on mobile, tablet, desktop)
✅ Beautiful gradient background
✅ Movie cards with ratings and year
✅ Hover effects and smooth animations

## Getting Started

1. Clone this repository
2. Open `index.html` in your browser
3. Start exploring movies!

## Technologies Used

- HTML5
- CSS3
- Vanilla JavaScript

## How to Use

1. **Browse Movies**: All movies are displayed on page load
2. **Search**: Type a movie title in the search box and click "Search" or press Enter
3. **Clear Search**: Delete the search text and search again to see all movies

## Customization

To add more movies, edit the `movies` array in `script.js`:

```javascript
const movies = [
    {
        id: 1,
        title: "Movie Title",
        year: 2024,
        rating: 8.5,
        poster: "image-url"
    },
    // Add more movies here
];
```

## Future Enhancements

- Integration with real movie APIs (TMDB, OMDB)
- User ratings and reviews
- Favorites/watchlist functionality
- Movie details page
- Filter by genre, year, rating

## Google Sign-In Setup (keeps client ID out of source)

1. In the Google Cloud Console create an OAuth 2.0 Client ID (Web application). Add these Authorized JavaScript origins:
    - https://seangritthy.github.io
    - http://localhost:3000 (optional for local testing)
2. In your GitHub repository go to Settings → Secrets and variables → Actions → New repository secret. Add a secret named `G_CLIENT_ID` with the Client ID value (the part ending in `.apps.googleusercontent.com`).
3. The repository already includes a GitHub Actions workflow `.github/workflows/deploy-pages.yml` which will inject the client ID at deploy time. Just push to `main` and the workflow will run.
4. Locally you can test by creating a file `local.env` and replacing the `GOOGLE_CLIENT_ID` placeholder in `script.js` (not recommended to commit).

Security note: Do not commit your Client ID to the repository. Use the `G_CLIENT_ID` secret instead which the workflow injects during deploy.

## License

Free to use and modify!
