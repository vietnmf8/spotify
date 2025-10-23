import httpRequest from "../../utils/httpRequest.js";
import libraryService from "../library/libraryService.js";
import storage from "../../utils/storage.js";
import Toast from "../../components/Toast.js";
import PlaylistEditModal from "./PlaylistEditModal.js";
import DeleteConfirmModal from "../../components/DeleteConfirmModal.js";
import router from "../../router/router.js";
import playlistService from "../playlist/playlistService.js";
import AddToPlaylistModal from "../../components/AddToPlaylistModal.js";
import activityTracker from "../../utils/activityTracker.js";

class Details {
    constructor(player) {
        /* State */
        this.type = null;
        this.id = null;
        this.player = player;

        this.savedTrackIds = new Set(); // Mảng lưu Id bài hát đã lưu (thích)

        this.isFollowing = false; // Artist có đang được follow?
        this.lastPlayingId = null; // ID của bài hát cuối cùng đã phát
        this.showAllTracks = false; // Trạng thái hiển thị tất cả bài hát trong artist
        this.currentData = null; // Lưu thông tin chi tiết
        this.currentTracks = []; // Lưu danh sách các bài hát

        this.isOptionsMenuOpen = false; // Options Menu

        /* DOM Elements */
        this.mainContent = document.querySelector(".main-content");
        this.homeContent = document.getElementById("home-content");
        this.detailContent = document.getElementById("detail-content");
        this.mainHeader = document.querySelector(".main-header");

        /* Header động  */
        this.headerContent = this.detailContent.querySelector(
            ".header-dynamic-content"
        );
        this.headerTitle = this.headerContent.querySelector(
            ".header-dynamic-title"
        );
        this.headerPlayBtn = this.headerContent.querySelector(
            ".header-dynamic-play-btn"
        );

        /* Wrapper */
        this.contentWrapper = document.querySelector(".content-wrapper");

        /* Các container chính của trang chi tiết */
        // Hero
        this.heroSection = this.detailContent.querySelector(
            ".detail-hero-section"
        );

        // Control
        this.controls = this.detailContent.querySelector(".detail-controls");
        this.trackList = this.detailContent.querySelector(
            ".track-list-container"
        );

        // Track
        this.trackHeader = this.trackList.querySelector(".track-list-header");
        this.trackBody = this.trackList.querySelector(".track-list-body");
        this.trackFooter = this.trackList.querySelector(".track-list-footer");

        /* Render Hero */
        this.renderHero = {
            artist: this._renderArtistHero,
            playlist: this._renderPlaylistHero,
        };

        /* Modal edit */
        this.editModal = new PlaylistEditModal();
        this.editModal.init();

        /* Modal Delete */
        this.deleteModal = new DeleteConfirmModal();
        this.deleteModal.init();

        /* Modal Add To Playlist */
        this.addToPlaylistModal = new AddToPlaylistModal();
        this.addToPlaylistModal.init();
    }

    /* Khởi tạo trang chi tiết
        - type: 'playlist' hoặc 'artist'
        - id: ID của playlist hoặc artist
    */
    init(type, id) {
        this.resetState();
        this.type = type;
        this.id = id;
        libraryService.clearSavedTrackIdsCache();
        this._showDetailPage();
        this._loadData(type, id);

        // Đảm bảo sự kiện scroll chỉ được gán một lần
        if (!this.scrollHandler) {
            this.scrollHandler = this._handleScroll.bind(this);
            this.contentWrapper.addEventListener("scroll", this.scrollHandler);
        }
        // Đảm bảo các sự kiện click chỉ được gán một lần
        if (!this.eventListenersAttached) {
            this._addEventListeners();
            // Lắng nghe sự kiện playlist được cập nhật
            document.addEventListener("playlist:updated", (e) => {
                this._handleDetailsUpdate(e.detail);
            });

            // Lắng nghe sự kiện khi một bài hát bị xóa khỏi playlist từ modal
            document.addEventListener(
                "playlist:track-removed",
                this._handleTrackRemoved.bind(this)
            );

            // Lắng nghe sự kiện khi trạng thái "saved" của các bài hát thay đổi
            document.addEventListener(
                "savedTracks:state-changed",
                this._handleSavedTracksChange.bind(this)
            );

            // Lắng nghe sự kiện thay đổi trạng thái của player
            document.addEventListener("player:state-change", () => {
                if (!this.detailContent.classList.contains("hidden")) {
                    this._updateTrackPlayingUI();
                    this._updateDetailPlayButtons();
                }
            });

            this.eventListenersAttached = true;
        }
    }

    /* Reset trạng thái trước khi render trang mới */
    resetState() {
        // Reset State
        this.type = null;
        this.id = null;
        this.savedTrackIds.clear();
        this.isFollowing = false;
        this.lastPlayingId = null;
        this.showAllTracks = false;
        this.currentData = null;
        this.currentTracks = [];
        this.detailContent.classList.remove("fade-in");

        // Reset HTML
        this.trackBody.innerHTML = "";
        this.trackHeader.innerHTML = "";
        this.trackFooter.innerHTML = "";
        this.controls.innerHTML = "";
        this.heroSection.innerHTML = "";
        this.detailContent.style.visibility = "hidden";

        // Ẩn header động
        if (this.headerContent) {
            this.headerContent.classList.remove("visible");
        }
    }

    /* Ẩn trang chủ và hiện trang chi tiết */
    _showDetailPage() {
        this.homeContent.classList.add("hidden");
        this.detailContent.classList.remove("hidden");
    }

    /* Tải dữ liệu chi tiết và danh sách bài hát từ API */
    async _loadData(type, id) {
        // Hiện giao diện chờ
        this._renderSkeleton();

        // Lấy danh sách Id  của tất cả các bài hát đã lưu
        this.savedTrackIds = await libraryService.getSavedTrackIds();

        try {
            /* Nếu là Playlist Liked Songs */
            if (type === "playlist" && id === "liked") {
                // Lấy danh sách bài hát
                const tracksData = await libraryService.getLikedSongs();
                this.currentTracks = tracksData.tracks || [];

                // Lấy thông tin người dùng & tổng thời lượng bài hát
                const user = storage.get("user");
                const totalDuration = this.currentTracks.reduce(
                    (sum, track) => sum + (track.duration || 0),
                    0
                );

                // Dữ liệu của Liked Songs
                this.currentData = {
                    id: "liked",
                    name: "Liked Songs",
                    is_special: true,
                    user_display_name: user ? user.display_name : "You",
                    total_duration: totalDuration,
                };

                // Đánh dấu trạng thái đã Follow
                this.isFollowing = true;
            } else {
                /* Playlist & Artist */
                // Gọi API trang chi tiết
                const detailPromise = httpRequest.get(`${type}s/${id}`);

                // Gọi API các bài hát
                const tracksPromise = httpRequest.get(
                    `${type}s/${id}/tracks${
                        type === "artist" ? "/popular" : ""
                    }`
                );

                // Gọi đồng thời cả 2 API và lấy ra data
                const [detailData, tracksData] = await Promise.all([
                    detailPromise,
                    tracksPromise,
                ]);

                // Lấy ra thông tin & danh sách bài hát hiện tại
                this.currentData = detailData;
                this.currentTracks = tracksData.tracks || [];
                this.isFollowing = detailData.is_following || false;
            }

            // Render trang chi tiết
            this._renderPage(type);
        } catch (error) {
            // Hiển thị thông báo lỗi
            console.error("Error loading details:", error);
            this._renderError(
                error.status === 404
                    ? `Không tìm thấy ${type} này.`
                    : "Đã có lỗi xảy ra. Vui lòng thử lại."
            );
        }
    }

    /* Render toàn bộ trang sau khi có dữ liệu */
    _renderPage(type) {
        this._renderHero(type);
        this._renderControls(type);
        this._renderTracks(type);

        // Gắn sự kiện mở modal nếu là trang playlist
        if (type === "playlist") {
            this._attachEditModal();
        }

        // Hiện lại nội dung với hiệu ứng fade-in
        this.detailContent.style.visibility = "visible";
        this.detailContent.classList.add("fade-in");

        this._updateDetailPlayButtons();
    }

    /* Xử lý mở Modal edit */
    _attachEditModal() {
        const currentUser = storage.get("user");
        if (
            !currentUser ||
            !this.currentData ||
            currentUser.display_name !== this.currentData.user_display_name
        ) {
            return;
        }

        const coverImg = this.heroSection.querySelector(".playlist-cover-img");
        const title = this.heroSection.querySelector(".playlist-title");
        const description = this.heroSection.querySelector(
            ".playlist-description"
        );

        // Mở modal
        const openModal = (focusTarget) => {
            this.editModal.open(this.currentData, focusTarget);
        };

        // Khi nhấn vào ảnh
        if (coverImg) {
            coverImg.style.cursor = "pointer";
            coverImg.addEventListener("click", () => openModal("image"));
        }

        // Nếu là title
        if (title) {
            title.style.cursor = "pointer";
            title.addEventListener("click", () => openModal("title"));
        }

        // Nếu là description
        if (description && description.style.display !== "none") {
            description.style.cursor = "pointer";
            description.addEventListener("click", () =>
                openModal("description")
            );
        }
    }

    /* Xử lý cập nhật thông tin chi tiết */
    _handleDetailsUpdate(updatedPlaylist) {
        // Chỉ cập nhật nếu đang ở đúng trang chi tiết
        if (this.type === "playlist" && this.id === updatedPlaylist.id) {
            this.currentData = { ...this.currentData, ...updatedPlaylist };
            this._renderHero(this.type);
            this._attachEditModal();
        }
    }

    /* Render phần Hero Section (Banner) */
    _renderHero(type) {
        // Xóa nội dung cũ
        this.heroSection.innerHTML = "";

        // Render Hero của Liked Songs
        if (type === "playlist" && this.id === "liked") {
            this.heroSection.innerHTML = this._createLikedSongsHeroHTML(
                this.currentData
            );
            return;
        }

        // Quyết định lấy template Playlist/Artist phụ thuộc vào type
        const templateId = `${type}-hero-template`;
        const template = document.getElementById(templateId);
        if (!template) return;
        const clone = template.content.cloneNode(true);

        // Quyết định render Hero của Playlist/Artist
        const renderHeroType = this.renderHero[type];

        if (renderHeroType) {
            renderHeroType.call(this, clone, this.currentData);
            this.heroSection.appendChild(clone);
        } else {
            console.error(`No render hero found for type: ${type}`);
        }
    }

    /* Artist Hero */
    _renderArtistHero(clone, artist) {
        clone.querySelector(".hero-image").src =
            artist.background_image_url || "placeholder.svg";
        clone.querySelector(".hero-image").alt = artist.name;
        clone.querySelector(".artist-name").textContent = artist.name;
        clone.querySelector(
            ".monthly-listeners"
        ).textContent = `${artist.monthly_listeners.toLocaleString()} monthly listeners`;

        if (artist.is_verified) {
            clone.querySelector(".verified-badge").style.display = "flex";
        }
    }

    /* Playlist Hero */
    _renderPlaylistHero(clone, playlist) {
        // Quy đổi định dạng HH:MM:SS
        const totalDurationS = playlist.total_duration;
        const hours = Math.floor(totalDurationS / 3600);
        const minutes = Math.floor((totalDurationS % 3600) / 60);
        let durationString = "";
        if (hours > 0) durationString += `${hours} hr `;
        if (minutes > 0 || hours > 0) durationString += `${minutes} min`;

        // Render
        clone.querySelector(".playlist-cover-img").src =
            playlist.image_url || "placeholder.svg";
        clone.querySelector(".playlist-cover-img").alt = playlist.name;
        clone.querySelector(".playlist-title").textContent = playlist.name;

        if (playlist.description) {
            const descEl = clone.querySelector(".playlist-description");
            descEl.textContent = playlist.description;
            descEl.style.display = "block";
        }

        clone.querySelector(".creator-avatar").src =
            playlist.user_avatar_url || "placeholder.svg";
        clone.querySelector(".creator-avatar").alt = playlist.user_display_name;
        clone.querySelector(".creator-name").textContent =
            playlist.user_display_name;

        if (this.currentTracks.length > 0) {
            clone.querySelector(
                ".song-count"
            ).textContent = `${this.currentTracks.length} songs, `;
            clone.querySelector(".meta-separator").style.display = "inline";
        }

        clone.querySelector(".total-duration").textContent = durationString;
    }

    /* Render các nút điều khiển */
    _renderControls(type) {
        // Kiểm tra quyền sử hữu
        const currentUser = storage.get("user");
        const isOwner =
            this.type === "playlist" &&
            currentUser &&
            this.currentData.user_display_name === currentUser.display_name;

        let followBtnHTML = "";
        if (this.currentData.is_special) {
            // Nếu là Liked Songs => Không có Follow
        } else if (type === "artist") {
            // Nếu là Artist
            followBtnHTML = `<button class="follow-btn ${
                this.isFollowing ? "following" : ""
            }">${this.isFollowing ? "FOLLOWING" : "FOLLOW"}</button>`;
        } else {
            // Nếu là Playlist
            const tooltipText = this.isFollowing
                ? "Remove from Your Library"
                : "Save to Your Library";

            // Không hiển thị nút follow/unfollow nếu là chủ sở hữu
            if (!isOwner) {
                followBtnHTML = `<button class="add-btn control-btn ${
                    this.isFollowing ? "saved" : ""
                }" data-tooltip="${tooltipText}"><i class="fas ${
                    this.isFollowing ? "fa-check" : "fa-plus"
                }"></i></button>`;
            }
        }

        this.controls.innerHTML = `
            <button class="play-btn-large"><i class="fas fa-play"></i></button>
            ${followBtnHTML}
            <div class="more-options-container" style="position: relative;">
                <button class="more-btn control-btn" data-tooltip="More options"><i class="fas fa-ellipsis-h"></i></button>
                <div class="context-menu options-menu"></div>
            </div>`;

        this.optionsMenu = this.controls.querySelector(".options-menu");
        this._renderOptionsMenu(isOwner);
    }

    /* Render Menu Option */
    _renderOptionsMenu(isOwner) {
        if (!isOwner) {
            this.optionsMenu.style.display = "none";
            return;
        }

        this.optionsMenu.innerHTML = `
            <ul class="context-menu-list">
                <li class="context-menu-item" data-action="edit-details">
                    <i class="fas fa-pencil-alt"></i>
                    <span>Edit details</span>
                </li>
                <li class="context-menu-item" data-action="delete">
                    <i class="fas fa-trash"></i>
                    <span>Delete</span>
                </li>
            </ul>
        `;
    }

    /* Render danh sách bài hát */
    _renderTracks(type) {
        // Kiểm tra nếu không có bài hát nào
        if (!this.currentTracks || this.currentTracks.length === 0) {
            this.trackBody.innerHTML =
                "<p class='no-data-message'>Không có bài hát nào.</p>";
            this.trackHeader.innerHTML = "";
            this.trackFooter.innerHTML = "";
            return;
        }

        const headerHTML =
            type === "artist"
                ? `
                <div class="track-number">#</div>
                <div class="track-title">Title</div>
                <div class="track-plays">Plays</div>
                <div class="track-duration"><i class="far fa-clock"></i></div>`
                : `
                <div class="track-number">#</div>
                <div class="track-title">Title</div>
                <div class="track-album">Album</div>
                <div class="track-date">Date added</div>
                <div class="track-duration"><i class="far fa-clock"></i></div>`;

        this.trackHeader.innerHTML = headerHTML;
        this.trackHeader.className = `track-list-header ${type}-header`;

        // Hiển thị danh sách bài hát
        // Playlist: Hiện tất cả
        // Artist: Hiện 5 bài phổ biến
        const tracksToRender =
            type === "artist" && !this.showAllTracks
                ? this.currentTracks.slice(0, 5)
                : this.currentTracks;

        this.trackBody.innerHTML = tracksToRender
            .map((track, index) => this._createTrackHTML(track, index, type))
            .join("");

        // Hiển thị nút "Xem thêm" cho Artist
        if (type === "artist" && this.currentTracks.length > 5) {
            this.trackFooter.innerHTML = `
                <button class="see-more-btn">
                    ${this.showAllTracks ? "Show less" : "See more"}
                </button>`;
        } else {
            this.trackFooter.innerHTML = "";
        }

        this.lastPlayingId = this.player.currentTrack
            ? this.player.currentTrack.id
            : null;
    }

    /* Cập nhật giao diện bài hát đang được phát */
    _updateTrackPlayingUI() {
        const currentTrackId = this.player.currentTrack
            ? this.player.currentTrack.id
            : null;

        // Clean trạng thái của bài hát cũ
        if (this.lastPlayingId && this.lastPlayingId !== currentTrackId) {
            const lastTrackEl = this.trackBody.querySelector(
                `[data-track-id="${this.lastPlayingId}"]`
            );
            if (lastTrackEl) {
                lastTrackEl.classList.remove("playing", "paused");
            }
        }

        // Cập nhật trạng thái cho bài hát mới
        if (currentTrackId) {
            const currentTrackEl = this.trackBody.querySelector(
                `[data-track-id="${currentTrackId}"]`
            );
            if (currentTrackEl) {
                currentTrackEl.classList.add("playing");
                currentTrackEl.classList.toggle(
                    "paused",
                    !this.player.isPlaying
                );
            }
        }

        //  Lưu ID hiện tại
        this.lastPlayingId = currentTrackId;
    }

    /* Cập nhật núi Play tại trang chi tiết */
    _updateDetailPlayButtons() {
        if (!this.currentData) return;

        const playBtnLarge = this.controls.querySelector(".play-btn-large");
        const playBtnHeader = this.headerPlayBtn;

        if (!playBtnLarge || !playBtnHeader) return;

        // Kiểm tra xem player có đang phát ĐÚNG ngữ cảnh này không
        const isCurrentContextPlaying =
            this.player.playContextName === this.currentData.name;

        // Quyết định icon
        const iconClass =
            isCurrentContextPlaying && this.player.isPlaying
                ? "fa-pause"
                : "fa-play";

        // Cập nhật cả 2 nút
        playBtnLarge.innerHTML = `<i class="fas ${iconClass}"></i>`;
        playBtnHeader.innerHTML = `<i class="fas ${iconClass}"></i>`;
    }

    /* Liked Songs Hero HTML */
    _createLikedSongsHeroHTML(data) {
        // Quy đổi thời gian HH:MM:SS
        const totalDurationS = data.total_duration;
        const hours = Math.floor(totalDurationS / 3600);
        const minutes = Math.floor((totalDurationS % 3600) / 60);
        let durationString = "";
        if (hours > 0) durationString += `${hours} hr `;
        if (minutes > 0 || hours > 0) durationString += `${minutes} min`;

        // HTML
        return `
        <div class="playlist-hero">
            <div class="item-icon liked-songs playlist-cover-img" style="width: 232px; height: 232px; font-size: 80px; box-shadow: 0 4px 60px var(--shadow);">
                <i class="fas fa-heart"></i>
            </div>
            <div class="playlist-info">
                <span class="playlist-type">PLAYLIST</span>
                <h1 class="playlist-title">${data.name}</h1>
                <div class="playlist-meta">
                    <span class="creator-name">${data.user_display_name}</span>
                    ${
                        this.currentTracks.length > 0
                            ? `
                        <span class="meta-separator">•</span>
                        <span class="song-count">${this.currentTracks.length} songs</span>
                    `
                            : ""
                    }
                    ${
                        durationString
                            ? `, <span class="total-duration">${durationString}</span>`
                            : ""
                    }
                </div>
            </div>
        </div>
        `;
    }

    /* Định dạng thời gian tương đối */
    _formatRelativeTime(dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        const now = new Date();
        // Tính toán sự chênh lệch và đảm bảo nó không phải là số âm
        const diffInSeconds = Math.round(
            Math.max(0, now.getTime() - date.getTime()) / 1000
        );

        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

        if (diffInSeconds < 60) {
            return rtf.format(-diffInSeconds, "second");
        }
        const minutes = Math.round(diffInSeconds / 60);
        if (minutes < 60) {
            return rtf.format(-minutes, "minute");
        }
        const hours = Math.round(minutes / 60);
        if (hours < 24) {
            return rtf.format(-hours, "hour");
        }
        const days = Math.round(hours / 24);
        if (days < 7) {
            return rtf.format(-days, "day");
        }
        // Nếu hơn 1 tuần, hiển thị ngày tháng cụ thể
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
        });
    }

    /* Tạo HTML cho mỗi item trong danh sách bài hát */
    _createTrackHTML(item, index, type) {
        let track;
        let trackId;

        if (this.id === "liked") {
            // Case 1: Trang Liked Songs
            track = item;
            trackId = item.id;
        } else if (type === "playlist") {
            // Case 2: Trang Playlist thông thường
            track = {
                title: item.track_title,
                duration: item.track_duration,
                image_url: item.track_image_url,
                artist_name: item.artist_name,
                album_title: item.album_title,
            };
            trackId = item.track_id;
        } else {
            // Case 3: Trang Artist, API trả về cấu trúc phẳng
            track = item;
            trackId = item.id;
        }

        if (!track || !trackId) return "";

        // Kiểm tra bài hát có được "lưu" (thích hoặc trong playlist) hay không
        const isSaved = this.savedTrackIds.has(trackId);
        const isPlaylist = type === "playlist";

        // Xác định trạng thái play/pause của bài hát hiện tại
        const isCurrentTrack =
            this.player &&
            this.player.currentTrack &&
            this.player.currentTrack.id === trackId;
        const isPlaying = isCurrentTrack && this.player.isPlaying;
        const isPaused = isCurrentTrack && !this.player.isPlaying;

        // Lấy ra các trường trong API Artist
        const imageUrl = track.image_url || "placeholder.svg";
        const title = track.title;
        const artistName = track.artist_name || this.currentData.name;
        const albumTitle = track.album_title || "";
        const dateAddedTimestamp = item.saved_at || item.added_at;
        const dateAdded = this._formatRelativeTime(dateAddedTimestamp);

        const duration = track.duration;
        const playCount = item.play_count;

        // Trạng thái của Add-btn & tooltip
        const addBtnIconClass = isSaved
            ? "fa-solid fa-check"
            : "fa-solid fa-plus";
        const addBtnSavedClass = isSaved ? "liked" : "";
        const tooltipText = isSaved ? "Add to playlist" : "Add to Liked Songs";

        return `
           <div class="track-list-item ${type}-item ${
            isPlaying ? "playing" : ""
        } ${isPaused ? "playing paused" : ""}" data-track-id="${trackId}">
                <div class="track-number">
                    <span class="track-number-text">${index + 1}</span>
                    <i class="fas fa-play track-play-icon"></i>
                    <i class="fas fa-pause track-pause-icon"></i>
                    <div class="equalizer">
                        <div class="equalizer-bar"></div>
                        <div class="equalizer-bar"></div>
                        <div class="equalizer-bar"></div>
                    </div>
                </div>
                <div class="track-title">
                    <img src="${imageUrl}" alt="${title}" class="track-title-img">
                    <div class="track-title-info">
                        <div class="track-name">${title}</div>
                        <div class="track-artist">${artistName}</div>
                    </div>
                </div>
                ${
                    isPlaylist
                        ? `<div class="track-album">${albumTitle}</div>`
                        : `<div class="track-plays">${(
                              playCount || 0
                          ).toLocaleString()}</div>`
                }
                ${
                    isPlaylist
                        ? `<div class="track-date">${dateAdded}</div>`
                        : ""
                }
                <div class="track-duration-container">
                    <div class="track-actions">
                        <button class="track-add-btn ${addBtnSavedClass}" data-tooltip="${tooltipText}">
                            <i class="${addBtnIconClass}"></i>
                        </button>
                    </div>
                    <div class="track-duration">${this._formatDuration(
                        duration
                    )}</div>
                    <div class="track-actions">
                        <button class="more-btn"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                </div>
            </div>`;
    }

    /* Xử lý hiệu ứng khi cuộn trang */
    _handleScroll() {
        if (
            !this.detailContent.classList.contains("hidden") &&
            this.currentData
        ) {
            // Lấy nút Play trong trang chi tiết
            const playBtn = this.controls.querySelector(".play-btn-large");
            if (!playBtn) return;

            // Lấy vị trí nút play và header chính
            const playBtnRect = playBtn.getBoundingClientRect();
            const mainHeaderRect = this.mainHeader.getBoundingClientRect();

            // Hiển thị header động nếu nút Play đã cuộn qua khỏi header chính
            if (playBtnRect.bottom < mainHeaderRect.bottom) {
                this.headerContent.classList.add("visible");
                this.headerTitle.textContent = this.currentData.name;
            } else {
                this.headerContent.classList.remove("visible");
            }

            // Neo: track list header
            // const scrollTop = this.contentWrapper.scrollTop;
            // const trackListTop = this.trackList.offsetTop;
            // const headerHeight = 64; // Chiều cao của main header
            // if (scrollTop >= trackListTop - headerHeight) {
            //     this.trackHeader.classList.add("stuck");
            // } else {
            //     this.trackHeader.classList.remove("stuck");
            // }
        }
    }

    /* Chuẩn hoá dữ liệu của track */
    _getNormalizedTracks() {
        return this.currentTracks.map((rawTrack) => {
            // Kiểm tra xem đây là cấu trúc từ 'playlist' (có track_id) hay 'artist'/'liked' (cấu trúc phẳng)
            const isFromPlaylist = "track_id" in rawTrack;
            const isFromArtistOrLiked = "artist_name" in rawTrack; // Giả định artist/liked có artist_name

            if (isFromPlaylist) {
                return {
                    id: rawTrack.track_id,
                    name: rawTrack.track_title,
                    artist: rawTrack.artist_name,
                    image_url: rawTrack.track_image_url,
                    audio_url: rawTrack.track_audio_url,
                    // Thêm duration nếu có, quan trọng cho Player
                    duration: rawTrack.track_duration,
                };
            } else {
                // Đây là cấu trúc phẳng (từ /artist/:id/tracks/popular hoặc /me/tracks/liked)
                return {
                    id: rawTrack.id,
                    name: rawTrack.title,
                    artist:
                        rawTrack.artist_name ||
                        (this.type === "artist" ? this.currentData.name : ""),
                    image_url: rawTrack.image_url,
                    audio_url: rawTrack.audio_url,
                    duration: rawTrack.duration,
                };
            }
        });
    }

    /* Gán các sự kiện click */
    _addEventListeners() {
        this.detailContent.addEventListener("click", (e) => {
            // Lấy ra bài hát
            const trackItem = e.target.closest(".track-list-item");

            // Không nhấn vào các nút chức năng
            if (trackItem && !e.target.closest(".track-add-btn, .more-btn")) {
                // Lấy id của track
                const trackId = trackItem.dataset.trackId;

                // Xử lý play/pause cho bài hát hiện tại
                const isCurrentTrack =
                    this.player.currentTrack &&
                    this.player.currentTrack.id === trackId;

                // Kiểm tra xem có đang phát đúng ngữ cảnh này không
                const isCurrentContext =
                    this.player.playContextName === this.currentData.name;

                if (isCurrentTrack && isCurrentContext) {
                    this.player._togglePlayPause();
                    return;
                }

                // Lấy danh sách bài hát đã được chuẩn hóa
                const normalizedQueue = this._getNormalizedTracks();

                const trackToPlay = normalizedQueue.find(
                    (track) => track.id === trackId
                );

                if (trackToPlay) {
                    // Gọi Player để bắt đầu phát nhạc
                    activityTracker.trackItemActivity(this.id);
                    this.player.startPlayback(
                        trackToPlay,
                        normalizedQueue,
                        this.currentData.name
                    );
                }

                return;
            }

            /* Nút Play large */
            const playBtnLarge = e.target.closest(".play-btn-large");
            if (playBtnLarge) {
                activityTracker.trackItemActivity(this.id);
                this.player.requestContextPlayback(this.currentData.name, () =>
                    this._getNormalizedTracks()
                );
                return;
            }

            /* Nút play trên Header */
            const playBtnHeader = e.target.closest(".header-dynamic-play-btn");
            if (playBtnHeader) {
                activityTracker.trackItemActivity(this.id);
                this.player.requestContextPlayback(this.currentData.name, () =>
                    this._getNormalizedTracks()
                );
                return;
            }

            // Khi click vào nút Follow
            const followSaveBtn = e.target.closest(
                ".follow-btn, .add-btn.control-btn"
            );
            if (followSaveBtn) this._handleFollow(followSaveBtn);

            // Khi click vào nút like/add to playlist
            const trackAddBtn = e.target.closest(".track-add-btn");
            if (trackAddBtn) {
                const trackId =
                    trackAddBtn.closest(".track-list-item").dataset.trackId;
                this._handleTrackSaveToggle(trackId, trackAddBtn, e);
                return;
            }

            // Khi click vào nút 'Xem thêm'
            const seeMoreBtn = e.target.closest(".see-more-btn");
            if (seeMoreBtn) {
                this.showAllTracks = !this.showAllTracks;
                this._renderTracks("artist");
            }

            // Click vào Options More
            const moreBtn = e.target.closest(".more-btn.control-btn");
            const optionsMenuItem = e.target.closest(
                ".options-menu .context-menu-item"
            );

            // Mở Menu
            if (moreBtn) {
                this._toggleOptionsMenu();
                return;
            }

            // Xử lý hành động xoá Playlist
            if (optionsMenuItem) {
                const action = optionsMenuItem.dataset.action;
                if (action === "delete") {
                    this._handleDeleteAction();
                } else if (action === "edit-details") {
                    this.editModal.open(this.currentData);
                }
                this._toggleOptionsMenu(false); // Đóng menu sau khi chọn
                return;
            }

            // Đóng menu nếu click ra ngoài
            if (
                this.isOptionsMenuOpen &&
                !e.target.closest(".more-options-container")
            ) {
                this._toggleOptionsMenu(false);
            }
        });
    }

    /* Xử lý logic nút save/add to playlist */
    async _handleTrackSaveToggle(trackId, button, event) {
        if (!storage.get("access_token")) {
            document.querySelector(".login-btn").click();
            return;
        }

        // Kiểm tra xem bài hát hiện tại có được lưu không?
        const trackItem = button.closest(".track-list-item");
        const isCurrentlySaved = this.savedTrackIds.has(trackId);

        if (isCurrentlySaved) {
            // Nếu đã lưu -> mở modal để thêm vào playlist khác
            if (this.addToPlaylistModal.isOpenedFor(trackId)) {
                this.addToPlaylistModal.close();
            } else {
                // Nếu chưa, thì mở modal
                this.addToPlaylistModal.open(trackId, event, trackItem);
            }
        } else {
            // Nếu chưa được lưu -> "Thích" (thêm vào Liked Songs)
            this.savedTrackIds.add(trackId);
            this._updateTrackSaveButton(trackItem, true, true);
            Toast.success("Added to Liked Songs");

            try {
                await libraryService.likeTrack(trackId);
                // Phát sự kiện để Library cập nhật số lượng bài hát
                document.dispatchEvent(new CustomEvent("likedSongs:updated"));
            } catch (error) {
                this.savedTrackIds.delete(trackId);
                this._updateTrackSaveButton(trackItem, false);
                Toast.error("Couldn't add to Liked Songs.");
                console.error("Like track failed:", error);
            }
        }
    }

    /* Cập nhật UI nút Like */
    _updateTrackSaveButton(trackRow, isSaved, withAnimation = false) {
        if (!trackRow) return;
        const button = trackRow.querySelector(".track-add-btn");
        const icon = button.querySelector("i");

        // Đổi sang trạng thái liked nếu thích bài hát
        button.classList.toggle("liked", isSaved);
        icon.className = isSaved ? "fa-solid fa-check" : "fa-solid fa-plus";
        button.dataset.tooltip = isSaved
            ? "Add to playlist"
            : "Add to Liked Songs";

        if (withAnimation) {
            button.classList.add("pop");
            button.addEventListener(
                "animationend",
                () => {
                    button.classList.remove("pop");
                },
                { once: true }
            );
        }
    }

    /* Mở/đóng Menu Options */
    _toggleOptionsMenu(state) {
        this.isOptionsMenuOpen =
            state !== undefined ? state : !this.isOptionsMenuOpen;
        if (this.optionsMenu) {
            this.optionsMenu.classList.toggle("show", this.isOptionsMenuOpen);
        }
    }

    /* Xử lý hành động xoá */
    _handleDeleteAction() {
        if (!this.currentData) return;

        // Mở modal và xoá
        this.deleteModal.open(this.currentData, async (id) => {
            try {
                // Gọi API xoá
                await playlistService.deletePlaylist(id);
                Toast.success("Playlist deleted");

                // Phát sự kiện cập nhật Library
                document.dispatchEvent(
                    new CustomEvent("library:updated", {
                        detail: {
                            type: "playlist",
                            action: "delete",
                            data: { id },
                        },
                    })
                );

                // Chuyển hướng về trang chủ
                router.navigate("/");
                this.deleteModal.close();
            } catch (error) {
                Toast.error("Could not delete playlist. Please try again.");
                console.error("Delete failed from details page:", error);
                throw error;
            }
        });
    }

    /* Chuyển đổi giây thành định dạng MM:SS */
    _formatDuration(seconds) {
        if (typeof seconds !== "number" || seconds < 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    /* Xử lý khi click vào Follow */
    async _handleFollow(button) {
        // Kiểm tra đã đăng nhập chưa
        if (!storage.get("access_token")) {
            document.querySelector(".login-btn").click();
            return;
        }
        // Lưu trạng thái trước đó
        const wasFollowing = this.isFollowing;
        // Đảo ngược trạng thái
        this.isFollowing = !this.isFollowing;
        this._updateFollowBtn(button);

        try {
            // Nếu đang theo dõi => huỷ theo dõi
            if (wasFollowing) {
                await libraryService.unfollowItem(this.type, this.id);
                Toast.info(
                    this.type === "artist"
                        ? `Đã bỏ theo dõi ${this.currentData.name}.`
                        : `Đã xóa '${this.currentData.name}' khỏi Thư viện.`
                );
            }
            // Nếu chưa theo dõi => theo dõi
            else {
                await libraryService.followItem(this.type, this.id);
                Toast.success(
                    this.type === "artist"
                        ? `Đã theo dõi ${this.currentData.name}`
                        : `Đã thêm '${this.currentData.name}' vào Thư viện.`
                );
            }

            // Phát sự kiện update Library
            document.dispatchEvent(
                new CustomEvent("library:updated", {
                    detail: {
                        type: this.type,
                        action: wasFollowing ? "unfollow" : "follow",
                        data: this.currentData,
                    },
                })
            );
        } catch (error) {
            console.error("Follow/Save action failed:", error);
            this.isFollowing = wasFollowing;
            this._updateFollowBtn(button);
            Toast.error("Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
    }

    /* Cập nhật trạng thái nút Follow/Unfollow */
    _updateFollowBtn(button) {
        // Artist
        if (this.type === "artist") {
            button.classList.toggle("following", this.isFollowing);
            button.textContent = this.isFollowing ? "FOLLOWING" : "FOLLOW";
        }
        // Playlist
        else {
            button.classList.toggle("saved", this.isFollowing);
            button.querySelector("i").className = `fas ${
                this.isFollowing ? "fa-check" : "fa-plus"
            }`;
            button.dataset.tooltip = this.isFollowing
                ? "Remove from Your Library"
                : "Save to Your Library";
        }
    }

    /* Render giao diện chờ (skeleton) */
    _renderSkeleton() {
        this.heroSection.innerHTML = "";
        this.trackBody.innerHTML = "";

        const template = document.getElementById("detail-skeleton-template");
        if (!template) return;

        const clone = template.content.cloneNode(true);

        const skeletonHero = clone.querySelector(".playlist-hero");
        const skeletonTracks = clone.querySelector(".skeleton-tracks-body");

        this.heroSection.appendChild(skeletonHero);
        this.trackBody.appendChild(skeletonTracks);
    }

    /* Render thông báo lỗi */
    _renderError(message) {
        const errorHTML = `
             <div class="error-message-full" style="padding-top: 100px;">
                 <i class="fas fa-exclamation-circle"></i>
                 <p>${message}</p>
             </div>`;
        this.detailContent.innerHTML = errorHTML;
        this.detailContent.style.visibility = "visible";
    }

    /* Xử lý khi đã được thông báo gỡ track */
    _handleTrackRemoved(e) {
        const { trackId, playlistId } = e.detail;

        // Chuyển đổi ID đặc biệt 'liked-songs' của modal thành 'liked' của trang chi tiết -> chuẩn hoá
        const relevantPlaylistId =
            playlistId === "liked-songs" ? "liked" : playlistId;

        // Chỉ xử lý nếu trang chi tiết hiện tại là của Playlist được chọn
        if (this.type === "playlist" && this.id === relevantPlaylistId) {
            const trackRow = this.trackBody.querySelector(
                `[data-track-id="${trackId}"]`
            );
            if (trackRow) {
                // Tìm thông tin của bài hát sắp bị xóa
                const removedTrack = this.currentTracks.find((item) => {
                    const currentTrackId = item.track_id || item.id;
                    return currentTrackId === trackId;
                });

                // Lấy URL ảnh của bài hát đó
                const removedTrackImageUrl = removedTrack?.track_image_url;

                // Chỉ cập nhật khi ảnh của bài hát bị xóa đang là ảnh bìa của playlist
                const needsAvatarUpdate =
                    removedTrackImageUrl &&
                    this.currentData.image_url === removedTrackImageUrl;

                // Lọc bài hát khỏi mảng để có danh sách mới
                const newTracks = this.currentTracks.filter((item) => {
                    const currentTrackId = item.track_id || item.id;
                    return currentTrackId !== trackId;
                });
                this.currentTracks = newTracks;

                // Avatar mới
                let newImageUrl = null;

                if (needsAvatarUpdate) {
                    //  URL ảnh bìa mới
                    if (newTracks.length > 0) {
                        // Nếu còn bài hát, lấy ảnh của bài đầu tiên
                        newImageUrl = newTracks[0].track_image_url;
                    }
                    // Nếu không còn bài hát (newTracks.length === 0), newImageUrl mặc định là null

                    // Cập nhật Avatar
                    playlistService
                        .updatePlaylist(this.id, { image_url: newImageUrl })
                        .then(() => {
                            // Cập nhật cho Library ở sidebar sau khi API thành công
                            document.dispatchEvent(
                                new CustomEvent("playlist:updated", {
                                    detail: {
                                        id: this.id,
                                        image_url: newImageUrl,
                                    },
                                })
                            );
                        })
                        .catch((err) => {
                            console.error(
                                "Failed to update playlist cover:",
                                err
                            );
                            Toast.error("Couldn't update playlist cover.");
                        });

                    // 5. Cập nhật UI ngay lập tức
                    this.currentData.image_url = newImageUrl;
                }

                // Render lại danh sách bài hát và Hero
                this._renderTracks(this.type);
                this._renderHero(this.type);
            }
        }
    }

    // Xử lý khi trạng thái "saved" của các bài hát thay đổi
    async _handleSavedTracksChange() {
        if (!this.detailContent.classList.contains("hidden")) {
            this.savedTrackIds = await libraryService.getSavedTrackIds();
            this._renderTracks(this.type);
        }
    }
}

export default Details;
