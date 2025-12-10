// iTunes API и Deezer API для поиска музыки
const API_CONFIG = {
    ITUNES_API_URL: 'https://itunes.apple.com/search',
    DEEZER_API_URL: 'https://api.deezer.com/search',
    CORS_PROXY: 'https://corsproxy.io/?'
};

// Кеш для поиска (10 минут)
const searchCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 минут в миллисекундах

function getCachedSearch(query) {
    const cached = searchCache.get(query.toLowerCase());
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        logAPI(`Cache hit для: "${query}"`);
        return cached.results;
    }
    if (cached) {
        searchCache.delete(query.toLowerCase());
    }
    return null;
}

function setCachedSearch(query, results) {
    searchCache.set(query.toLowerCase(), {
        results,
        timestamp: Date.now()
    });
}



// Поиск песен в iTunes
async function searchItunesSongs(query) {
    try {
        if (!query) return [];

        const url = `${API_CONFIG.ITUNES_API_URL}?term=${encodeURIComponent(query)}&media=music&entity=song&limit=20`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`iTunes API Error: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data || !data.results || data.results.length === 0) return [];
        
        return data.results
            .filter(item => item && item.trackName && item.artistName && item.previewUrl)
            .map(item => ({
                id: item.trackId,
                title: item.trackName || 'Неизвестная песня',
                artist: item.artistName || 'Неизвестный исполнитель',
                duration: Math.floor((item.trackTimeMillis || 0) / 1000),
                cover: (item.artworkUrl100 || '').replace('100x100', '300x300') || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E',
                url: item.previewUrl,
                album: item.collectionName || 'Неизвестный альбом',
                itunesUrl: item.trackViewUrl
            }));
    } catch (error) {
        logAPI('Ошибка поиска iTunes:', error);
        return [];
    }
}

// Поиск песен в Deezer
async function searchDeezerSongs(query) {
    try {
        if (!query) return [];

        const deezerUrl = `${API_CONFIG.DEEZER_API_URL}?q=${encodeURIComponent(query)}&limit=30`;
        const url = `${API_CONFIG.CORS_PROXY}${encodeURIComponent(deezerUrl)}`;
        
        const res = await fetch(url, {
            timeout: 5000
        });
        
        if (!res.ok) {
            throw new Error(`Deezer API Error: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data || !data.data || data.data.length === 0) return [];
        
        logAPI(`Deezer найдено результатов для "${query}": ${data.data.length}`);
        
        const results = data.data
            .map(item => ({
                id: item.id,
                title: item.title || 'Неизвестная песня',
                artist: (item.artist && item.artist.name) || 'Неизвестный исполнитель',
                duration: item.duration || 0,
                cover: item.album && item.album.cover_big ? item.album.cover_big : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E',
                url: item.preview || null,
                album: (item.album && item.album.title) || 'Неизвестный альбом',
                deezerUrl: item.link
            }));
        
        const filtered = results.filter(song => song.title && song.artist);
        
        if (results.length !== filtered.length) {
            logAPI(`Deezer: отфильтровано ${results.length - filtered.length} песен без названия/артиста`);
        }
        
        return filtered;
    } catch (error) {
        logAPI('Ошибка поиска Deezer:', error);
        return [];
    }
}

// Поиск альбомов в iTunes
async function searchItunesAlbums(query) {
    try {
        if (!query) return [];

        const url = `${API_CONFIG.ITUNES_API_URL}?term=${encodeURIComponent(query)}&media=music&entity=album&limit=20`;
        
        const res = await fetch(url);
        
        if (!res.ok) {
            throw new Error(`iTunes API Error: ${res.status}`);
        }
        
        const data = await res.json();
        
        if (!data || !data.results || data.results.length === 0) return [];
        
        // Удаляем дубликаты по названию альбома
        const uniqueAlbums = [];
        const seen = new Set();
        
        for (const item of data.results) {
            if (item.collectionType === 'Album' && item.collectionName) {
                const key = `${item.collectionName}|${item.artistName}`.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueAlbums.push({
                        id: item.collectionId,
                        title: item.collectionName,
                        artist: item.artistName,
                        cover: (item.artworkUrl100 || '').replace('100x100', '300x300') || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E',
                        releaseDate: item.releaseDate ? item.releaseDate.split('-')[0] : 'N/A',
                        totalTracks: item.trackCount || 0,
                        itunesUrl: item.collectionViewUrl,
                        collectionId: item.collectionId
                    });
                }
            }
        }
        
        return uniqueAlbums;
    } catch (error) {
        logAPI('Ошибка поиска альбомов iTunes:', error);
        return [];
    }
}

// Получить треки альбома
async function getItunesAlbumTracks(collectionId) {
    try {
        if (!collectionId) return [];

        const url = `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`;
        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`iTunes API Error: ${res.status}`);
        
        const data = await res.json();
        
        if (!data.results || data.results.length === 0) return [];
        
        // Первый результат - это сам альбом, остальные - треки
        return data.results.slice(1)
            .filter(track => track.previewUrl)
            .map((track, index) => ({
                id: track.trackId,
                title: track.trackName || 'Неизвестный трек',
                artist: track.artistName || 'Неизвестный исполнитель',
                duration: Math.floor((track.trackTimeMillis || 0) / 1000),
                cover: (track.artworkUrl100 || '').replace('100x100', '300x300') || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E',
                url: track.previewUrl,
                trackNumber: track.trackNumber || index + 1,
                itunesUrl: track.trackViewUrl
            }));
    } catch (error) {
        logAPI('Ошибка получения треков альбома:', error);
        return [];
    }
}

// Получить информацию об альбоме
async function getItunesAlbumDetails(collectionId, collectionName, artistName) {
    try {
        const tracks = await getItunesAlbumTracks(collectionId);
        
        if (!tracks || tracks.length === 0) return null;
        
        return {
            id: collectionId,
            title: collectionName,
            artist: artistName,
            cover: tracks[0]?.cover || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E',
            releaseDate: new Date().getFullYear().toString(),
            totalTracks: tracks.length,
            description: 'Альбом',
            tracks: tracks
        };
    } catch (error) {
        logAPI('Ошибка получения деталей альбома:', error);
        return null;
    }
}

// API класс для управления поиском
class MusicAPI {
    constructor() {
        this.songs = [];
    }

    async getAllSongs() {
        return [];
    }

    async searchSongs(query) {
        return [];
    }

    async getSongById(id) {
        return null;
    }

    // Поиск в iTunes и Deezer с кешем
    async searchWithItunes(query) {
        // Проверяем кеш первым
        const cached = getCachedSearch(query);
        if (cached) {
            return cached;
        }

        // Сначала пытаемся искать в Deezer (лучше для русской музыки)
        const deezerResults = await searchDeezerSongs(query);
        if (deezerResults.length > 0) {
            setCachedSearch(query, deezerResults);
            return deezerResults;
        }
        
        // Если Deezer не дал результатов, используем iTunes
        const itunesResults = await searchItunesSongs(query);
        setCachedSearch(query, itunesResults);
        return itunesResults;
    }

    async getRecommendations() {
        return [];
    }

    async addSong(song) {
        return null;
    }

    async getPopularSongs() {
        return [];
    }

    async searchSpotifyAlbums(query) {
        return searchItunesAlbums(query);
    }

    async getSpotifyAlbumDetails(collectionId, collectionName, artistName) {
        return getItunesAlbumDetails(collectionId, collectionName, artistName);
    }

    async getSpotifyTopTracks() {
        return this.songs.slice(0, 10);
    }

    async searchSpotify(query) {
        return searchItunesSongs(query);
    }

    async getSpotifyRecommendations(seedTracks = []) {
        return this.songs.slice(0, 10);
    }
}

// Форматирование времени (сек в MM:SS)
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Логирование для отладки
 */
function logAPI(message, data = null) {
    console.log(`[MusicAPI] ${message}`, data || '');
}

// Создаем глобальный экземпляр API
const musicAPI = new MusicAPI();
