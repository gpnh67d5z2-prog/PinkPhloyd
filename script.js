// ===== DOM ELEMENTS =====
const audioPlayer = document.getElementById('audioPlayer');
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const songTitle = document.getElementById('songTitle');
const artistName = document.getElementById('artistName');
const albumCover = document.getElementById('albumCover');
const progress = document.getElementById('progress');
const progressBar = document.querySelector('.progress-bar');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const playlistContainer = document.getElementById('playlist');
const recentlyPlayedContainer = document.getElementById('recentlyPlayed');
const sidebarSearchInput = document.getElementById('sidebarSearchInput');
const playlistSection = document.getElementById('playlistSection');

// ===== STATE =====
let currentSongIndex = 0;
let playlist = [];
let isPlaying = false;
let recentlyPlayed = [];

// ===== INITIALIZATION =====
function init() {
    setupEventListeners();
    loadRecentlyPlayed();
}

function setupEventListeners() {
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', prevSong);
    nextBtn.addEventListener('click', nextSong);
    
    audioPlayer.addEventListener('timeupdate', updateProgress);
    audioPlayer.addEventListener('ended', nextSong);
    audioPlayer.addEventListener('loadedmetadata', updateDuration);
    
    progressBar.addEventListener('click', seekTo);
    
    // Поиск в реальном времени (по мере ввода)
    sidebarSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length > 0) {
            performSearch(query);
        } else {
            playlistContainer.innerHTML = '<p class="loading">Начните поиск...</p>';
        }
    });
}

// ===== SEARCH FUNCTIONALITY =====
async function performSearch(query) {
    if (!query.trim()) {
        playlistContainer.innerHTML = '<p class="loading">Введите поисковый запрос...</p>';
        return;
    }

    playlistContainer.innerHTML = '<div class="loading-spinner"></div>';
    
    try {
        console.log('Поиск:', query);
        const results = await musicAPI.searchWithItunes(query);
        
        console.log('Результаты поиска:', results);
        
        if (!results || results.length === 0) {
            playlistContainer.innerHTML = '<p class="loading">Песни не найдены</p>';
            return;
        }

        playlist = results;
        currentSongIndex = 0;
        displayPlaylist(results);
    } catch (error) {
        console.error('Search error:', error);
        playlistContainer.innerHTML = '<p class="loading">Ошибка поиска</p>';
    }
}

// ===== PLAYLIST DISPLAY =====
function displayPlaylist(songs) {
    console.log('displayPlaylist called with:', songs);
    
    if (!songs || songs.length === 0) {
        playlistContainer.innerHTML = '<p class="loading">Нет результатов</p>';
        return;
    }

    const html = songs.map((song, index) => {
        const cover = song.cover || song.artworkUrl100 || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E';
        const title = song.title || song.trackName || 'Unknown';
        const artist = song.artist || song.artistName || 'Unknown';
        const duration = song.duration || Math.floor((song.trackTimeMillis || 0) / 1000);
        
        return `
            <div class="playlist-item ${index === currentSongIndex ? 'active' : ''}" data-index="${index}">
                <div class="playlist-item-cover">
                    <img src="${cover}" alt="Cover" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E'">
                </div>
                <div class="playlist-item-info">
                    <div class="playlist-item-title">${title}</div>
                    <div class="playlist-item-artist">${artist}</div>
                    <div class="playlist-item-duration">${formatTime(duration)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    playlistContainer.innerHTML = html;

    // Add click handlers
    document.querySelectorAll('.playlist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            loadSong(index);
            playAudio();
        });
    });
}

// ===== PLAYBACK CONTROL =====
function loadSong(index) {
    if (!playlist || playlist.length === 0) return;
    
    currentSongIndex = index % playlist.length;
    const song = playlist[currentSongIndex];
    
    console.log('Loading song:', song);
    
    const title = song.title || song.trackName || 'Unknown';
    const artist = song.artist || song.artistName || 'Unknown';
    const cover = song.cover || song.artworkUrl100 || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E';
    const url = song.url || song.previewUrl || '';
    
    songTitle.textContent = title;
    artistName.textContent = artist;
    albumCover.src = cover;
    audioPlayer.src = url;
    
    console.log('Audio source:', url);
    
    // Update active state in playlist
    document.querySelectorAll('.playlist-item').forEach((item, i) => {
        item.classList.toggle('active', i === currentSongIndex);
    });

    // Add to recently played
    addToRecentlyPlayed(song);
}

function playAudio() {
    if (!audioPlayer.src) {
        alert('Нет доступного превью для этой песни');
        return;
    }
    audioPlayer.play();
    isPlaying = true;
    updatePlayButton();
    albumCover.classList.remove('paused');
}

function pauseAudio() {
    audioPlayer.pause();
    isPlaying = false;
    updatePlayButton();
    albumCover.classList.add('paused');
}

function togglePlay() {
    if (playlist.length === 0) {
        alert('Выберите песню для воспроизведения');
        return;
    }
    
    if (isPlaying) {
        pauseAudio();
    } else {
        if (!audioPlayer.src) {
            loadSong(currentSongIndex);
        }
        playAudio();
    }
}

function nextSong() {
    loadSong(currentSongIndex + 1);
    playAudio();
}

function prevSong() {
    loadSong(currentSongIndex - 1);
    playAudio();
}

function updatePlayButton() {
    const icon = playBtn.querySelector('.icon-play');
    if (isPlaying) {
        icon.innerHTML = '⏸';
    } else {
        icon.innerHTML = '▶';
    }
}

// ===== PROGRESS & SEEKING =====
function updateProgress() {
    if (audioPlayer.duration) {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progress.style.width = percent + '%';
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }
}

function updateDuration() {
    durationEl.textContent = formatTime(audioPlayer.duration || 0);
}

function seekTo(e) {
    if (!audioPlayer.duration) return;
    
    const percent = e.offsetX / progressBar.offsetWidth;
    audioPlayer.currentTime = percent * audioPlayer.duration;
}

// ===== RECENTLY PLAYED =====
function addToRecentlyPlayed(song) {
    const exists = recentlyPlayed.find(s => s.trackId === song.trackId);
    
    if (exists) {
        recentlyPlayed = recentlyPlayed.filter(s => s.trackId !== song.trackId);
    }
    
    recentlyPlayed.unshift(song);
    recentlyPlayed = recentlyPlayed.slice(0, 20);
    
    saveRecentlyPlayed();
    displayRecentlyPlayed();
}

function displayRecentlyPlayed() {
    if (recentlyPlayed.length === 0) {
        recentlyPlayedContainer.innerHTML = '<p class="loading">Ничего не прослушано</p>';
        return;
    }

    recentlyPlayedContainer.innerHTML = recentlyPlayed.map(song => `
        <div class="recently-played-item" data-track-id="${song.id || song.trackId}">
            <img src="${song.cover || song.artworkUrl100 || 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E'}" alt="Cover" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 300 300%22%3E%3Crect fill=%22%23333%22 width=%22300%22 height=%22300%22/%3E%3C/svg%3E'">
            <div class="recently-played-info">
                <div class="recently-played-title">${song.title || song.trackName || 'Unknown'}</div>
                <div class="recently-played-artist">${song.artist || song.artistName || 'Unknown'}</div>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.recently-played-item').forEach(item => {
        item.addEventListener('click', () => {
            const trackId = item.dataset.trackId;
            const song = recentlyPlayed.find(s => (s.id || s.trackId) == trackId);
            
            playlist = [song];
            currentSongIndex = 0;
            displayPlaylist([song]);
            loadSong(0);
            playAudio();
        });
    });
}

function saveRecentlyPlayed() {
    localStorage.setItem('recentlyPlayed', JSON.stringify(recentlyPlayed));
}

function loadRecentlyPlayed() {
    const saved = localStorage.getItem('recentlyPlayed');
    recentlyPlayed = saved ? JSON.parse(saved) : [];
    displayRecentlyPlayed();
}

// ===== UTILITIES =====
function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== START APPLICATION =====
init();
