import httpRequest from "../../utils/httpRequest.js";
import router from "../../router/router.js";
/**
 * Quản lý logic và render cho trang chủ ("/").
 * 1. Hiển thị/ẩn trang chủ (so với trang chi tiết).
 * 2. Tải và render các section (VD: "Today's biggest hits", "Popular artists")
 * 3. Xử lý sự kiện click trên các "card" (item) trên trang chủ:
 *  - Click vào card -> Điều hướng (navigate) đến trang chi tiết.
 *  - Click vào nút play -> Gửi yêu cầu phát nhạc (context) cho Player
 * 4. Đồng bộ hóa UI của các card (hiển thị trạng thái playing/paused)
 * với trạng thái của Player.
 * 
 * Case:
 * - Khi router điều hướng về "/", `init()` được gọi.
 * - Trang chủ hiển thị, trang chi tiết ẩn đi.
 * - Skeletons được hiển thị trong khi API đang được gọi.
 * - Dữ liệu (Trending Tracks, Artists) được render ra card.
 * - Click vào card Artist -> `router.navigate("/artist/:id")`.
 * - Click nút play trên card Playlist -> `player.requestContextPlayback` được gọi.
 * - Click nút play trên card Track (Trending) -> `player.startPlayback` được gọi
 * (với hàng đợi chỉ 1 bài hát).
 * - Khi `player:state-change` được phát, các card sẽ cập nhật class
 * `.playing-context` / `.paused-context`.
 */
class Home {
    constructor(player) {
        this.player = player;

        /* Get DOM Element 2 khu vực Big Hit Playlists và Popular Artists */
        this.playlistsContainer = document.querySelector(".hits-grid");
        this.artistsContainer = document.querySelector(".artists-grid");

        /* Get DOM Element khu vực trang Home và trang chi tiết */
        this.homeContent = document.getElementById("home-content");
        this.detailContent = document.getElementById("detail-content");

        this.trendingTracks = [];
        this.playerState = {
            playContextName: null,
            isPlaying: false,
            currentTrackId: null,
        };

        this.handleContainerClickHandler =
            this._handleContainerClick.bind(this);
        this.playerStateChangeHandler =
            this._handlePlayerStateChange.bind(this);
        this.libraryUpdateHandler = this._handleLibraryUpdate.bind(this);
    }

    /* Khởi tạo */
    init() {
        this._showHomePage();
        this._loadHomePageData();
        this._removeEventListeners();
        this._addEventListeners();

        document.addEventListener(
            "player:state-change",
            this.playerStateChangeHandler
        );

        document.addEventListener("library:updated", this.libraryUpdateHandler);
    }

    _removeEventListeners() {
        if (this.playlistsContainer) {
            this.playlistsContainer.removeEventListener(
                "click",
                this.handleContainerClickHandler
            );
        }
        if (this.artistsContainer) {
            this.artistsContainer.removeEventListener(
                "click",
                this.handleContainerClickHandler
            );
        }
        // Gỡ listener toàn cục khỏi document
        document.removeEventListener(
            "player:state-change",
            this.playerStateChangeHandler
        );
        document.removeEventListener(
            "library:updated",
            this.libraryUpdateHandler
        );
    }

    /* Ẩn trang chi tiết và hiện trang chủ */
    _showHomePage() {
        this.homeContent.classList.remove("hidden");
        this.detailContent.classList.add("hidden");
        document.querySelector(".main-header").style.backgroundColor =
            "transparent";

        this._updateAllCardStates();
    }

    /* Tải dữ liệu trang chủ ban đầu */
    async _loadHomePageData() {
        // Tải song song tracks thịnh hành và artists
        await Promise.all([
            // Nếu muốn gọi All Playlist trong Today Biggest Hit
            // this._loadAndRenderPlaylists(),

            // Nếu muốn gọi Trend Track trong Today Biggest Hit
            this._loadAndRenderTrendingTracks(),

            this._loadAndRenderArtists(),
        ]);
    }

    /* Tải và render danh sách Tracks thịnh hành */
    async _loadAndRenderTrendingTracks() {
        this._renderSkeletons(6, "playlist", this.playlistsContainer);
        try {
            const trendingData = await httpRequest.get(
                "tracks/trending?limit=6"
            );
            this.trendingTracks = trendingData.tracks || [];
            this._renderTracks(this.trendingTracks);
        } catch (error) {
            console.error("Lỗi khi tải trending tracks:", error);
            this._renderError(
                this.playlistsContainer,
                "Không thể tải các bài hát thịnh hành."
            );
        }
    }

    /* Tải và render danh sách Playlists */
    async _loadAndRenderPlaylists() {
        this._renderSkeletons(6, "playlist", this.playlistsContainer);
        try {
            const playlistsData = await httpRequest.get("playlists?limit=6");
            this._renderPlaylists(playlistsData.playlists);
        } catch (error) {
            console.error("Lỗi khi tải playlists:", error);
            this._renderError(
                this.playlistsContainer,
                "Không thể tải các playlist."
            );
        }
    }

    /* Tải và render danh sách Artists */
    async _loadAndRenderArtists() {
        this._renderSkeletons(5, "artist", this.artistsContainer);
        try {
            const artistsData = await httpRequest.get("artists?limit=5");
            this._renderArtists(artistsData.artists);
        } catch (error) {
            console.error("Lỗi khi tải artists:", error);
            this._renderError(
                this.artistsContainer,
                "Không thể tải các nghệ sĩ."
            );
        }
    }

    /* Render Loading dạng Skeletons */
    _renderSkeletons(count, type, container) {
        if (!container) return;
        const skeletonsHTML = this._generateSkeletonHTML(count, type);
        container.innerHTML = skeletonsHTML;
    }

    /* Tạo HTML khung với số lượng item (6 Card Playlist/Track * 5 Card Artists) */
    _generateSkeletonHTML(count, type) {
        let skeletons = "";
        for (let i = 0; i < count; i++) {
            // Kiểm tra xem có phải mục Artist không?
            const isArtist = type === "artist";
            skeletons += `
                <div class="skeleton-card ${isArtist ? "artist-skeleton" : ""}">
                    <div class="skeleton-image"></div>
                    <div class="skeleton-text skeleton-title"></div>
                    <div class="skeleton-text skeleton-subtitle"></div>
                </div>
            `;
        }

        return skeletons;
    }

    /* Render danh sách Tracks */
    _renderTracks(tracks) {
        if (!this.playlistsContainer) return;

        // Nếu không có Track nào, hiển thị thông báo lỗi
        if (!tracks || tracks.length === 0) {
            this.playlistsContainer.innerHTML =
                '<p class="no-data-message">Không có bài hát thịnh hành nào.</p>';
            return;
        }

        // Render HTML - Tái sử dụng cấu trúc của hit-card
        const tracksHTML = tracks
            .map(
                (track) => `
            <div class="hit-card" data-id="${track.id}" data-type="track">
                <div class="hit-card-cover">
                    <img
                        src="${track.image_url || "placeholder.svg"}"
                        alt="${track.title}"
                        onerror="this.onerror=null;this.src='placeholder.svg';"
                    >
                    <button class="hit-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="hit-card-info">
                    <h3 class="hit-card-title">${track.title}</h3>
                    <p class="hit-card-artist">${
                        track.artist_name || "Nghệ sĩ"
                    }</p>
                </div>
            </div>
        `
            )
            .join("");

        this.playlistsContainer.innerHTML = tracksHTML;
        this._updateAllCardStates();
    }

    /* Render danh sách Playlists */
    _renderPlaylists(playlists) {
        if (!this.playlistsContainer) return;

        // Nếu không có Playlist nào, hiển thị thông báo lỗi
        if (!playlists || playlists.length === 0) {
            this.playlistsContainer.innerHTML =
                '<p class="no-data-message">Không có playlist nào.</p>';
            return;
        }

        // Render HTML
        const playlistsHTML = playlists
            .map(
                (playlist) => `
            <div class="hit-card" data-id="${
                playlist.id
            }" data-type="playlist" data-context-name="${playlist.name}">
                <div class="hit-card-cover">
                    <img
                        src="${playlist.image_url || "placeholder.svg"}"
                        alt="${playlist.name}"
                        onerror="this.onerror=null;this.src='placeholder.svg';"
                    >
                    <button class="hit-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="hit-card-info">
                    <h3 class="hit-card-title">${playlist.name}</h3>
                    <p class="hit-card-artist">${
                        playlist.user_display_name ||
                        playlist.description ||
                        "Spotify"
                    }</p>
                </div>
            </div>
        `
            )
            .join("");

        this.playlistsContainer.innerHTML = playlistsHTML;
        this._updateAllCardStates();
    }

    /* Render danh sách Artists */
    _renderArtists(artists) {
        if (!this.artistsContainer) return;

        // Nếu không có dữ liệu, hiển thị thông báo
        if (!artists || artists.length === 0) {
            this.artistsContainer.innerHTML =
                '<p class="no-data-message">Không có nghệ sĩ nào.</p>';
            return;
        }

        const artistsHTML = artists
            .map(
                (artist) => `
            <div class="artist-card" data-id="${
                artist.id
            }" data-type="artist" data-context-name="${artist.name}">
                <div class="artist-card-cover">
                    <img
                        src="${artist.image_url || "placeholder.svg"}"
                        alt="${artist.name}"
                        onerror="this.onerror=null;this.src='placeholder.svg';"
                    >
                    <button class="artist-play-btn">
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="artist-card-info">
                    <h3 class="artist-card-name">${artist.name}</h3>
                    <p class="artist-card-type">Artist</p>
                </div>
            </div>
        `
            )
            .join("");

        this.artistsContainer.innerHTML = artistsHTML;
        this._updateAllCardStates();
    }

    /* Render thông báo lỗi */
    _renderError(container, message) {
        if (container) {
            container.innerHTML = `
                <div class="error-message-full">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>${message}</p>
                </div>`;
        }
    }

    /* Gán sự kiện click cho các Card Playlist & Artist */
    _handleContainerClick(event) {
        const card = event.target.closest(".hit-card, .artist-card");
        if (!card) return;
        const playButton = event.target.closest(
            ".hit-play-btn, .artist-play-btn"
        );
        if (playButton) {
            this._handlePlayClick(card, event);
        } else {
            this._handleNavClick(card);
        }
    }

    /* Gán sự kiện click */
    _addEventListeners() {
        // Sử dụng handler đã lưu trữ
        if (this.playlistsContainer) {
            this.playlistsContainer.addEventListener(
                "click",
                this.handleContainerClickHandler
            );
        }
        if (this.artistsContainer) {
            this.artistsContainer.addEventListener(
                "click",
                this.handleContainerClickHandler
            );
        }
    }

    /* Xử lý khi click vào nút Play trên card */
    _handlePlayClick(card, event) {
        event.stopPropagation();
        if (!this.player) return;

        const { id, type } = card.dataset;
        const contextName = card.dataset.contextName;

        if (type === "track") {
            // Trường hợp đặc biệt: Nhấn play trên một track trending
            const trackToPlay = this.trendingTracks.find((t) => t.id === id);
            if (!trackToPlay) return;

            // Chuẩn hóa track này
            const normalizedTrack = this._normalizeTracks(
                [trackToPlay],
                "track"
            )[0];
            if (!normalizedTrack) return;

            // Kiểm tra xem có phải đang nhấn play/pause chính bài đó không
            if (
                this.player.currentTrack &&
                this.player.currentTrack.id === id
            ) {
                this.player._togglePlayPause();
            } else {
                // Phát bài hát này như một ngữ cảnh riêng lẻ
                // Chúng ta đặt tên ngữ cảnh bằng chính tên bài hát (hoặc ID) để đảm bảo tính duy nhất
                this.player.startPlayback(
                    normalizedTrack,
                    [normalizedTrack], // Hàng đợi chỉ có 1 bài
                    normalizedTrack.name // Tên ngữ cảnh là tên bài hát
                );
            }
        } else {
            // Xử lý cho playlist và artist (có contextName)
            if (!id || !type || !contextName) return;

            let getTracksFunction;

            getTracksFunction = async () => {
                const apiPath =
                    type === "artist"
                        ? `artists/${id}/tracks/popular`
                        : `playlists/${id}/tracks`;
                const data = await httpRequest.get(apiPath);
                return this._normalizeTracks(data.tracks, type, contextName);
            };

            // Gửi yêu cầu đến Player
            this.player.requestContextPlayback(contextName, getTracksFunction);
        }
    }

    /* Xử lý khi click vào card để điều hướng */
    _handleNavClick(card) {
        const { id, type } = card.dataset;
        if (id && (type === "playlist" || type === "artist")) {
            router.navigate(`/${type}/${id}`);
        }
    }

    /* Chuẩn hóa (normalize) track data cho Player */
    _normalizeTracks(tracks, type = "track", contextName = "") {
        // Thêm contextName
        if (!tracks) return [];
        return tracks.map((rawTrack) => {
            if (type === "playlist") {
                return {
                    id: rawTrack.track_id,
                    name: rawTrack.track_title,
                    artist: rawTrack.artist_name,
                    image_url: rawTrack.track_image_url,
                    audio_url: rawTrack.track_audio_url,
                    duration: rawTrack.track_duration,
                };
            }
            return {
                id: rawTrack.id,
                name: rawTrack.title,
                artist: rawTrack.artist_name || contextName,
                image_url: rawTrack.image_url,
                audio_url: rawTrack.audio_url,
                duration: rawTrack.duration,
            };
        });
    }

    /* Xử lý khi trạng thái Player thay đổi */
    _handlePlayerStateChange(e) {
        const { playContextName, isPlaying, currentTrackId } = e.detail;
        // Cache lại trạng thái
        this.playerState = { playContextName, isPlaying, currentTrackId };
        this._updateAllCardStates();
    }

    /* Cập nhật trạng thái (class) cho tất cả card */
    _updateAllCardStates() {
        const allCards = document.querySelectorAll(".hit-card, .artist-card");
        allCards.forEach((card) => {
            const cardContext = card.dataset.contextName;
            const cardType = card.dataset.type;
            const cardId = card.dataset.id;

            let isPlayingThisCard = false;
            let isPausedOnThisCard = false;

            if (cardType === "track") {
                // Xử lý cho các card bài hát riêng lẻ
                isPlayingThisCard = this.playerState.currentTrackId === cardId;
                isPausedOnThisCard =
                    isPlayingThisCard && !this.playerState.isPlaying;
            } else {
                // Xử lý cho các card ngữ cảnh (playlist/artist)
                isPlayingThisCard =
                    cardContext === this.playerState.playContextName;
                isPausedOnThisCard =
                    isPlayingThisCard && !this.playerState.isPlaying;
            }

            card.classList.toggle("playing-context", isPlayingThisCard);
            card.classList.toggle("paused-context", isPausedOnThisCard);
        });
    }

    /* Xử lý khi Library có sự thay đổi (xoá, follow) */
    _handleLibraryUpdate(e) {
        const { type, action, data } = e.detail;

        // Chỉ xử lý playlist bị xóa hoặc unfollow
        if (
            type === "playlist" &&
            (action === "delete" || action === "unfollow")
        ) {
            this._loadAndRenderTrendingTracks();
        }
    }
}

export default Home;
