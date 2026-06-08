<?php
session_start();

// TMDB API key
$apikey = '5e10bf06e4f15dae6e9ff35ff35e8df2';

// Allow access without login for demo
$user_logged_in = isset($_SESSION['user_id']);
$user_type = $_SESSION['user_type'] ?? 'guest';
$username = $_SESSION['username'] ?? 'Guest User';

if (!isset($_GET['tmdb'])) {
    die("INVALID TMDB ID");
}

$tmdb_id = preg_replace('/[^0-9]/', '', $_GET['tmdb']);

function getMovieInfo($tmdb_id) {
    global $apikey;
    
    if (!is_dir('cache')) {
        @mkdir('cache', 0755, true);
    }
    
    $cache_file = 'cache/movie_' . $tmdb_id . '.json';
    if (file_exists($cache_file) && time() - filemtime($cache_file) < 86400) {
        return json_decode(file_get_contents($cache_file), true);
    }
    
    $url = "https://api.themoviedb.org/3/movie/{$tmdb_id}?api_key={$apikey}&language=en-US";
    $response = @file_get_contents($url);
    
    if ($response) {
        $data = json_decode($response, true);
        if (isset($data['title'])) {
            $movie = [
                'title' => $data['title'],
                'year' => substr($data['release_date'] ?? '', 0, 4),
                'rating' => round($data['vote_average'] ?? 0, 1),
                'runtime' => ($data['runtime'] ?? 0) . ' min',
                'overview' => $data['overview'] ?? '',
                'poster' => $data['poster_path'] ? 'https://image.tmdb.org/t/p/w500' . $data['poster_path'] : null,
                'genres' => isset($data['genres']) ? array_column($data['genres'], 'name') : []
            ];
            file_put_contents($cache_file, json_encode($movie));
            return $movie;
        }
    }
    
    return ['title' => 'Movie', 'year' => '', 'rating' => 'N/A', 'runtime' => 'N/A', 'overview' => '', 'poster' => null, 'genres' => []];
}

$movie = getMovieInfo($tmdb_id);
$player_url = "https://vidsrc.to/embed/movie/$tmdb_id";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MVHD | <?= htmlspecialchars($movie['title']) ?></title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Exo+2:wght@300;400;600&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
    :root {
        --primary: #00ff9d;
        --secondary: #7b61ff;
        --dark-bg: #0a0a0f;
        --cyber-blue: #00ccff;
        --cyber-yellow: #fff200;
    }

    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        background: var(--dark-bg);
        color: white;
        font-family: 'Exo 2', sans-serif;
        min-height: 100vh;
        padding: 20px;
        background-image: 
            linear-gradient(rgba(0, 255, 157, 0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(123, 97, 255, 0.02) 1px, transparent 1px);
        background-size: 50px 50px;
    }

    header {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: rgba(10, 10, 15, 0.98);
        padding: 15px 0;
        z-index: 1000;
        border-bottom: 2px solid var(--primary);
        box-shadow: 0 0 30px rgba(0, 255, 157, 0.5);
    }

    .header-content {
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .title {
        font-family: 'Orbitron', sans-serif;
        color: var(--primary);
        font-size: 1.5rem;
        text-shadow: 0 0 10px rgba(0, 255, 157, 0.7);
        letter-spacing: 2px;
    }

    .nav-link {
        color: var(--primary);
        text-decoration: none;
        padding: 8px 15px;
        border: 1px solid var(--primary);
        font-family: 'Share Tech Mono', monospace;
        font-size: 0.9rem;
        transition: all 0.3s;
    }

    .nav-link:hover {
        background: var(--primary);
        color: #000;
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.5);
    }

    .container {
        max-width: 1400px;
        margin: 80px auto 0;
        padding: 20px;
    }

    .movie-header {
        background: rgba(19, 19, 31, 0.9);
        border: 2px solid var(--primary);
        padding: 25px;
        margin-bottom: 30px;
        box-shadow: 0 0 30px rgba(0, 255, 157, 0.3);
        display: flex;
        gap: 30px;
        flex-wrap: wrap;
    }

    .movie-poster {
        flex: 0 0 200px;
    }

    .movie-poster img {
        width: 100%;
        border: 2px solid var(--primary);
        box-shadow: 0 0 20px rgba(0, 255, 157, 0.3);
    }

    .movie-info {
        flex: 1;
        min-width: 300px;
    }

    .movie-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 2.5rem;
        color: var(--primary);
        margin-bottom: 15px;
        text-shadow: 0 0 15px rgba(0, 255, 157, 0.7);
    }

    .meta {
        display: flex;
        gap: 20px;
        margin-bottom: 20px;
        flex-wrap: wrap;
        font-family: 'Share Tech Mono', monospace;
        color: var(--cyber-blue);
        font-size: 0.95rem;
    }

    .overview {
        line-height: 1.6;
        margin: 20px 0;
        color: rgba(255, 255, 255, 0.9);
    }

    .genres {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 15px;
    }

    .genre {
        padding: 5px 15px;
        background: rgba(123, 97, 255, 0.2);
        border: 1px solid var(--secondary);
        font-size: 0.9rem;
        font-family: 'Share Tech Mono', monospace;
    }

    .player-section {
        background: #000;
        border: 3px solid var(--primary);
        border-radius: 10px;
        overflow: hidden;
        box-shadow: 0 0 50px rgba(0, 255, 157, 0.3);
        margin-bottom: 30px;
        position: relative;
    }

    .player-section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 5px;
        background: linear-gradient(90deg, #ff003c, #fff200, var(--primary), var(--cyber-blue), #ff00e5);
        z-index: 2;
    }

    iframe {
        width: 100%;
        height: 650px;
        display: block;
        border: none;
    }

    .info-box {
        background: rgba(19, 19, 31, 0.9);
        border: 2px solid var(--primary);
        padding: 20px;
        box-shadow: 0 0 30px rgba(0, 255, 157, 0.3);
    }

    .info-label {
        color: var(--cyber-yellow);
        font-family: 'Share Tech Mono', monospace;
        font-size: 0.9rem;
        text-transform: uppercase;
    }

    .info-value {
        color: white;
        font-size: 1.1rem;
        margin-top: 10px;
    }

    @media (max-width: 768px) {
        iframe {
            height: 400px;
        }
        
        .movie-title {
            font-size: 2rem;
        }
        
        .movie-header {
            flex-direction: column;
        }
    }
    </style>
</head>
<body>
    <header>
        <div class="header-content">
            <div class="title">🎬 MVHD CYBERCINEMA</div>
            <a href="index.php" class="nav-link">← BACK</a>
        </div>
    </header>

    <div class="container">
        <div class="movie-header">
            <?php if ($movie['poster']): ?>
            <div class="movie-poster">
                <img src="<?= htmlspecialchars($movie['poster']) ?>" alt="<?= htmlspecialchars($movie['title']) ?>" onerror="this.src='https://via.placeholder.com/300x450/1a1a1a/ffffff?text=MVHD'">
            </div>
            <?php endif; ?>
            
            <div class="movie-info">
                <h1 class="movie-title">🎥 <?= htmlspecialchars($movie['title']) ?></h1>
                
                <div class="meta">
                    <span>⭐ RATING: <?= $movie['rating'] ?>/10</span>
                    <span>📅 YEAR: <?= $movie['year'] ?></span>
                    <span>⏱️ RUNTIME: <?= $movie['runtime'] ?></span>
                </div>
                
                <div class="overview">
                    <?= htmlspecialchars($movie['overview']) ?: 'No description available.' ?>
                </div>
                
                <?php if (!empty($movie['genres'])): ?>
                <div class="genres">
                    <?php foreach ($movie['genres'] as $genre): ?>
                        <span class="genre"><?= htmlspecialchars($genre) ?></span>
                    <?php endforeach; ?>
                </div>
                <?php endif; ?>
            </div>
        </div>

        <div class="player-section">
            <iframe src="<?= htmlspecialchars($player_url) ?>" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe>
        </div>

        <div class="info-box">
            <div class="info-label">📡 STREAMING STATUS</div>
            <div class="info-value">✅ ACTIVE - TMDB ID: <?= $tmdb_id ?></div>
        </div>
    </div>
</body>
</html>