const CACHE_TTL_MS = 60 * 60 * 1000;
const cacheStore = globalThis.__movieCache || new Map();
globalThis.__movieCache = cacheStore;

function getTmdbApiKey() {
    return process.env.TMDB_API_KEY || '5e10bf06e4f15dae6e9ff35ff35e8df2';
}

function mapUiLangToTmdb(uiLang) {
    if (uiLang === 'km') return 'km-KH';
    if (uiLang === 'zh') return 'zh-CN';
    return 'en-US';
}

function buildBaseEndpoint({ type, category, search, actor, genre, country, lang, languageFilter }) {
    if (search) return `search/${type}`;
    if (actor || genre || country || lang || languageFilter) return `discover/${type}`;
    if (category === 'trending') return `trending/${type}/week`;
    if (category === 'top_rated') return `${type}/top_rated`;
    return `${type}/popular`;
}

function buildParams({ apiKey, page, tmdbLang, category, search, actor, genre, country, lang, languageFilter }) {
    const params = new URLSearchParams({
        api_key: apiKey,
        page: String(page),
        language: tmdbLang
    });

    if (search) params.set('query', search);

    // discover endpoint filters
    if (actor) params.set('with_cast', actor);
    if (genre) params.set('with_genres', genre);
    if (country) params.set('with_origin_country', country);
    if (lang) params.set('with_original_language', lang);

    if (languageFilter) {
        params.set('with_original_language', languageFilter);
        if (category === 'top_rated') {
            params.set('sort_by', 'vote_average.desc');
            params.set('vote_count.gte', '200');
        } else {
            params.set('sort_by', 'popularity.desc');
        }
    }

    // non-filtered discover fallback ordering
    if ((actor || genre || country || lang) && !params.get('sort_by')) {
        params.set('sort_by', 'popularity.desc');
    }

    return params;
}

async function fetchTmdbBatch({ type, category, search, actor, genre, country, lang, languageFilter, page, uiLang }) {
    const apiKey = getTmdbApiKey();
    const tmdbLang = mapUiLangToTmdb(uiLang);
    const endpoint = buildBaseEndpoint({ type, category, search, actor, genre, country, lang, languageFilter });

    const allResults = [];
    let totalResults = 0;

    for (let i = 1; i <= 5; i += 1) {
        const tmdbPage = (page - 1) * 5 + i;
        const params = buildParams({
            apiKey,
            page: tmdbPage,
            tmdbLang,
            category,
            search,
            actor,
            genre,
            country,
            lang,
            languageFilter
        });

        const url = `https://api.themoviedb.org/3/${endpoint}?${params.toString()}`;
        const response = await fetch(url);
        if (!response.ok) continue;

        const payload = await response.json();
        if (!Array.isArray(payload.results)) continue;

        if (!totalResults && payload.total_results) {
            totalResults = payload.total_results;
        }

        allResults.push(...payload.results);
        if (allResults.length >= 100) break;
    }

    const results = allResults.slice(0, 100);
    return {
        page,
        results,
        total_results: totalResults || results.length,
        total_pages: Math.max(1, Math.ceil((totalResults || results.length) / 100))
    };
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
        const type = req.query.type === 'tv' ? 'tv' : 'movie';
        const category = req.query.category || 'popular';
        const uiLang = req.query.uiLang || 'en';

        const search = (req.query.search || '').trim();
        const actor = (req.query.actor || '').trim();
        const genre = (req.query.genre || '').trim();
        const country = (req.query.country || '').trim();
        const lang = (req.query.lang || '').trim();
        const languageFilter = (req.query.languageFilter || '').trim();

        const cacheKey = JSON.stringify({ page, type, category, uiLang, search, actor, genre, country, lang, languageFilter });
        const cached = cacheStore.get(cacheKey);
        if (cached && (Date.now() - cached.createdAt) < CACHE_TTL_MS) {
            return res.status(200).json(cached.payload);
        }

        const payload = await fetchTmdbBatch({
            type,
            category,
            search,
            actor,
            genre,
            country,
            lang,
            languageFilter,
            page,
            uiLang
        });

        cacheStore.set(cacheKey, { payload, createdAt: Date.now() });
        return res.status(200).json(payload);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Failed to fetch movies from TMDB' });
    }
}
