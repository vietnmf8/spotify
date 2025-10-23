import storage from "../../utils/storage.js";
import libraryService from "../library/libraryService.js";
import AddToPlaylistModal from "../../components/AddToPlaylistModal.js";
import Toast from "../../components/Toast.js";

class Player {
    constructor() {
        /* Trạng thái của Player */
        this.isPlaying = false; // Nhạc đang không phát
        this.currentTrack = null; // Bài hát hiện tại
        this.queue = []; // Danh sách bài hát đang chờ được phát
        this.originalQueue = []; // Danh sách bài hát gốc
        this.currentIndex = -1; // Vị trí bài hát hiện tại trong hàng đợi

        this.playContextName = null;

        /* Shuffle & Repeat */
        this.isShuffle = false;
        this.repeatMode = "off"; // Các giá trị: 'off', 'all', 'one'

        /* Volume */
        this.volume = 1; // Âm lượng mặc định là 1
        this.previousVolume = 1; // Lưu âm lượng trước khi tắt tiếng

        this.isSeeking = false; // Có đang tua không?
        this.isAdjustingVolume = false; // Có đang chỉnh (kéo) âm lượng?
        this.isCurrentTrackSaved = false;

        this.PLAYER_STATE_KEY = "player_state";

        /* DOM Element (Thông tin bài hát) */
        this.playerLeft = document.querySelector(".player-left");
        this.trackImageEl = this.playerLeft.querySelector(".player-image");
        this.trackTitleEl = this.playerLeft.querySelector(".player-title");
        this.trackArtistEl = this.playerLeft.querySelector(".player-artist");
        this.playerLikeBtn = this.playerLeft.querySelector(".add-btn");
        this.playerLikeBtnIcon = this.playerLikeBtn.querySelector("i");

        /* DOM Element: (Điều khiển & Tiến trình) */
        this.playBtn = document.querySelector(".player-center .play-btn");
        this.playBtnIcon = this.playBtn.querySelector("i");

        /* DOM Element: (Các nút chức năng) */
        this.nextBtn = document.querySelector('[data-tooltip="Next"]');
        this.prevBtn = document.querySelector('[data-tooltip="Previous"]');
        this.shuffleBtn = document.querySelector('[data-tooltip*="shuffle"]');
        this.repeatBtn = document.querySelector('[data-tooltip*="repeat"]');

        this.progressContainer = document.querySelector(".progress-container");
        this.currentTimeEl =
            this.progressContainer.querySelector(".time:first-child");
        this.totalTimeEl =
            this.progressContainer.querySelector(".time:last-child");
        this.progressBar =
            this.progressContainer.querySelector(".progress-bar");
        this.progressFill =
            this.progressContainer.querySelector(".progress-fill");
        this.progressHandle =
            this.progressContainer.querySelector(".progress-handle");

        /* DOM Element: (Âm lượng) */
        this.volumeContainer = document.querySelector(".volume-container");
        this.muteBtn = this.volumeContainer.querySelector(".control-btn");
        this.muteBtnIcon = this.muteBtn.querySelector("i");
        this.volumeBar = this.volumeContainer.querySelector(".volume-bar");
        this.volumeFill = this.volumeBar.querySelector(".volume-fill");
        this.volumeHandle =
            this.volumeContainer.querySelector(".volume-handle");

        this.audioElement = new Audio();

        /* Khởi tạo Modal Add To Playlist */
        this.addToPlaylistModal = new AddToPlaylistModal();

        // Xử lý các hành động
        this.handleProgressMove = this._handleProgressMouseMove.bind(this);
        this.handleProgressUp = this._handleProgressMouseUp.bind(this);
        this.handleVolumeMove = this._handleVolumeMouseMove.bind(this);
        this.handleVolumeUp = this._handleVolumeMouseUp.bind(this);
    }

    /* Khởi tạo */
    init() {
        // Gán sự kiện click cho nút play/pause
        this.playBtn.addEventListener("click", () => this._togglePlayPause());

        // Gán sự kiện cho các nút chức năng
        this.nextBtn.addEventListener("click", () => this._handleNext());
        this.prevBtn.addEventListener("click", () => this._handlePrevious());
        this.shuffleBtn.addEventListener("click", () => this._toggleShuffle());
        this.repeatBtn.addEventListener("click", () => this._toggleRepeat());

        // Tự động chuyển bài khi bài hát kết thúc
        this.audioElement.addEventListener("ended", () => this._handleNext());

        // Lấy thời lượng của bài hát khi được tải xong
        this.audioElement.addEventListener("loadedmetadata", () => {
            this.totalTimeEl.textContent = this._formatTime(
                this.audioElement.duration
            );
        });

        // Cập nhật thời gian và thanh tiến trình
        this.audioElement.addEventListener("timeupdate", () => {
            // Chỉ xử lý khi không kéo
            if (this.isSeeking) return;

            // Nếu bài hát chưa được tải
            const { currentTime, duration } = this.audioElement;
            if (isNaN(duration)) return;

            // Cập nhật width của thanh tiến trình
            const percentage = (currentTime / duration) * 100;
            this._updateProgressBarUI(percentage, currentTime);
            this._saveState();
        });

        // Mute
        this.muteBtn.addEventListener("click", () => this._toggleMute());
        this.progressBar.addEventListener(
            "mousedown",
            this._handleProgressMouseDown.bind(this)
        );
        this.volumeBar.addEventListener(
            "mousedown",
            this._handleVolumeMouseDown.bind(this)
        );

        // Khởi tạo Modal và các sự kiện cho nút "Like"
        this.addToPlaylistModal.init();
        this.playerLikeBtn.addEventListener(
            "click",
            this._handleLikeClick.bind(this)
        );
        document.addEventListener(
            "savedTracks:state-changed",
            this._handleSavedTracksChange.bind(this)
        );

        // Khôi phục trạng thái từ localStorage
        this._restoreStateFromLocalStorage();
    }

    /* Lưu trạng thái vào localStorage */
    _saveState() {
        const state = {
            currentTrack: this.currentTrack,
            queue: this.queue,
            originalQueue: this.originalQueue,
            playContextName: this.playContextName,
            isShuffle: this.isShuffle,
            repeatMode: this.repeatMode,
            volume: this.volume,
            currentTime: this.audioElement.currentTime,
        };
        storage.set(this.PLAYER_STATE_KEY, state);
    }

    /* Khôi phục */
    _restoreStateFromLocalStorage() {
        const savedState = storage.get(this.PLAYER_STATE_KEY);
        if (!savedState || !savedState.currentTrack) return;

        this.currentTrack = savedState.currentTrack;
        this.queue = savedState.queue || [];
        this.originalQueue = savedState.originalQueue || this.queue;
        this.playContextName = savedState.playContextName || null;
        this.isShuffle = savedState.isShuffle || false;
        this.repeatMode = savedState.repeatMode || "off";
        this.currentIndex = this.queue.findIndex(
            (t) => t.id === this.currentTrack.id
        );

        this._updateTrackInfo(this.currentTrack);
        this._updateShuffleButtonUI();
        this._updateRepeatButtonUI();
        this._checkAndUpdateLikeStatus();

        this.audioElement.src = this.currentTrack.audio_url;
        this.audioElement.addEventListener(
            "loadedmetadata",
            () => {
                const savedTime = savedState.currentTime || 0;
                this.audioElement.currentTime = savedTime;
                if (!isNaN(this.audioElement.duration)) {
                    const percentage =
                        (savedTime / this.audioElement.duration) * 100;
                    this._updateProgressBarUI(percentage, savedTime);
                }
            },
            { once: true }
        );

        this._setVolume(
            savedState.volume !== undefined ? savedState.volume : 1
        );

        document.dispatchEvent(
            new CustomEvent("player:state-change", {
                detail: {
                    isPlaying: this.isPlaying,
                    playContextName: this.playContextName,
                    currentTrackId: this.currentTrack
                        ? this.currentTrack.id
                        : null,
                },
            })
        );
    }

    /* Nút Like */
    async _handleLikeClick(event) {
        if (!storage.get("access_token")) {
            document.querySelector(".login-btn").click();
            return;
        }
        if (!this.currentTrack) return;

        const trackId = this.currentTrack.id;

        if (this.isCurrentTrackSaved) {
            // Nếu modal đã mở cho bài hát này, thì đóng lại
            if (this.addToPlaylistModal.isOpenedFor(trackId)) {
                this.addToPlaylistModal.close();
            } else {
                // Nếu chưa, thì mở modal
                this.addToPlaylistModal.open(
                    trackId,
                    event,
                    this.playerLikeBtn
                );
            }
        } else {
            this.isCurrentTrackSaved = true;
            this._updateLikeButtonUI();
            this.playerLikeBtn.classList.add("pop");
            this.playerLikeBtn.addEventListener(
                "animationend",
                () => this.playerLikeBtn.classList.remove("pop"),
                { once: true }
            );

            try {
                await libraryService.likeTrack(trackId);
                Toast.success("Added to Liked Songs");
                document.dispatchEvent(
                    new CustomEvent("savedTracks:state-changed")
                );
                document.dispatchEvent(new CustomEvent("likedSongs:updated"));
            } catch (error) {
                this.isCurrentTrackSaved = false;
                this._updateLikeButtonUI();
                Toast.error("Couldn't add to Liked Songs.");
                console.error("Like track failed:", error);
            }
        }
    }

    /* Cập nhật trạng thái nút like */
    async _checkAndUpdateLikeStatus() {
        if (!this.currentTrack) {
            this.isCurrentTrackSaved = false;
            this._updateLikeButtonUI();
            return;
        }
        const savedIds = await libraryService.getSavedTrackIds();
        this.isCurrentTrackSaved = savedIds.has(this.currentTrack.id);
        this._updateLikeButtonUI();
    }

    /* Cập nhật giao diện nút Like */
    _updateLikeButtonUI() {
        if (!this.playerLikeBtn) return;
        this.playerLikeBtn.classList.toggle("liked", this.isCurrentTrackSaved);
        this.playerLikeBtnIcon.className = this.isCurrentTrackSaved
            ? "fa-solid fa-check"
            : "fa-solid fa-plus";
        this.playerLikeBtn.dataset.tooltip = this.isCurrentTrackSaved
            ? "Add to playlist"
            : "Add to Liked Songs";
    }

    _handleSavedTracksChange() {
        if (this.currentTrack) {
            this._checkAndUpdateLikeStatus();
        }
    }

    /* Phát ngữ cảnh (Playlist) */
    async requestContextPlayback(contextName, getTracksFunction) {
        // Người dùng nhấn Play/Pause trên Playlist đang phát
        if (contextName === this.playContextName) {
            this._togglePlayPause();
            return;
        }

        // Người dùng nhấn Play trên một Playlist mới
        try {
            const tracks = await getTracksFunction();

            if (!tracks || tracks.length === 0) {
                Toast.error("This playlist is empty.");
                return;
            }

            // Lấy bài hát đầu tiên để bắt đầu phát
            const firstTrack = tracks[0];

            // Bắt đầu phát ngữ cảnh mới
            this.startPlayback(firstTrack, tracks, contextName);
        } catch (error) {
            console.error("Failed to get tracks for context:", error);
            Toast.error("Could not load tracks to play.");
        }
    }

    /* Bắt đầu phát một danh sách nhạc mới */
    startPlayback(track, contextTracks, contextName = "Queue") {
        // Lưu state
        this.originalQueue = [...contextTracks];
        this.queue = [...this.originalQueue];
        this.playContextName = contextName;

        // Tìm vị trí của bài hát được click
        this.currentIndex = this.queue.findIndex(
            (item) => item.id === track.id
        );
        if (this.currentIndex === -1) return;

        // Bật chế độ Shuffle
        if (this.isShuffle) {
            const nextUp = this.queue.slice(this.currentIndex + 1);
            this._shuffleArray(nextUp);
            this.queue = [
                ...this.queue.slice(0, this.currentIndex + 1),
                ...nextUp,
            ];
        }

        // Tải và phát bài hát hiện tại
        this._loadAndPlayCurrentTrack();
    }

    /* Phát bài hát hiện tại */
    _loadAndPlayCurrentTrack() {
        // Nếu nằm ngoài danh sách
        if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) {
            return;
        }

        this.currentTrack = this.queue[this.currentIndex];

        // Lấy src bài hát
        this.audioElement.src = this.currentTrack.audio_url;

        // Cập nhật giao diện thanh Player
        this._updateTrackInfo(this.currentTrack);

        // Lên nhạc!!!
        this.play();

        // Kiểm tra trạng thái "thích"
        this._checkAndUpdateLikeStatus();

        // Phát sự kiện hàng đợi cập nhật
        document.dispatchEvent(new CustomEvent("player:queue-updated"));
    }

    /* Phát nhạc */
    play() {
        // Chỉ phát nhạc khi có bài hát được chọn
        if (!this.currentTrack) return;

        this.isPlaying = true;
        this.audioElement.play();
        this._updatePlayButtonUI();
        this._saveState();

        // Phát sự kiện khi nhạc được phát
        document.dispatchEvent(
            new CustomEvent("player:state-change", {
                detail: {
                    isPlaying: this.isPlaying,
                    playContextName: this.playContextName,
                    currentTrackId: this.currentTrack
                        ? this.currentTrack.id
                        : null,
                },
            })
        );
    }

    /* Dừng nhạc */
    pause() {
        this.isPlaying = false;
        this.audioElement.pause();
        this._updatePlayButtonUI();
        this._saveState();

        // Phát sự kiện khi nhạc tạm dừng
        document.dispatchEvent(
            new CustomEvent("player:state-change", {
                detail: {
                    isPlaying: this.isPlaying,
                    playContextName: this.playContextName,
                    currentTrackId: this.currentTrack
                        ? this.currentTrack.id
                        : null,
                },
            })
        );
    }

    /* Bật/tắt chế độ phát ngẫu nhiên */
    _toggleShuffle() {
        this.isShuffle = !this.isShuffle;

        if (this.currentTrack) {
            if (this.isShuffle) {
                // Lấy ra danh sách các bài hát tiếp theo
                const nextUp = this.queue.slice(this.currentIndex + 1);

                // Xáo trộn danh sách đó
                this._shuffleArray(nextUp);

                // Cập nhật lại hàng đợi
                this.queue = [
                    ...this.queue.slice(0, this.currentIndex + 1),
                    ...nextUp,
                ];
            } else {
                // Khôi phục hàng đợi về trạng thái ban đầu
                const currentTrackId = this.currentTrack.id;
                this.queue = [...this.originalQueue];

                // Tìm lại index của bài hát hiện tại trong hàng đợi gốc
                this.currentIndex = this.queue.findIndex(
                    (t) => t.id === currentTrackId
                );
            }

            // Phát sự kiện để QueuePanel cập nhật giao diện
            document.dispatchEvent(new CustomEvent("player:queue-updated"));
        }
        this._updateShuffleButtonUI();
        this._saveState();
    }

    /* Chế độ Repeat */
    _toggleRepeat() {
        const modes = ["off", "all", "one"];
        const currentModeIndex = modes.indexOf(this.repeatMode);
        this.repeatMode = modes[(currentModeIndex + 1) % modes.length];
        this._updateRepeatButtonUI();
        this._saveState();
    }

    /* Nhả chuột */
    _handleProgressMouseUp(event) {
        if (!this.isSeeking) return;

        this.isSeeking = false;
        this.progressContainer.classList.remove("seeking");
        document.removeEventListener("mousemove", this.handleProgressMove);
        document.removeEventListener("mouseup", this.handleProgressUp);

        const rect = this.progressBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const width = this.progressBar.clientWidth;
        let percentage = Math.max(0, Math.min(1, offsetX / width));

        this.audioElement.currentTime = percentage * this.audioElement.duration;
        this._saveState();
    }

    /* Đặt giá trị volume */
    _setVolume(percentage) {
        this.volume = percentage;
        this.audioElement.volume = percentage;

        // Cập nhật UI volume
        this.volumeFill.style.width = `${percentage * 100}%`;

        // Nếu volume > 0 và đang tắt tiếng => bật lại
        if (percentage > 0 && this.audioElement.muted) {
            this.audioElement.muted = false;
        }

        this._updateMuteButtonUI();
        this._saveState(); // Lưu âm lượng
    }

    /* Xáo trộn mảng */
    _shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /* Cập nhật thông tin bài hát trên giao diện */
    _updateTrackInfo(track) {
        if (!track) return;
        this.trackImageEl.src = track.image_url || "placeholder.svg";
        this.trackImageEl.alt = track.name;
        this.trackTitleEl.textContent = track.name;
        this.trackArtistEl.textContent = track.artist;
    }

    /* Định dạng thời gian */
    _formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return "0:00";
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
    }

    /* Chuyển giữa Play và Pause nhạc */
    _togglePlayPause() {
        if (!this.currentTrack) return;
        this.isPlaying ? this.pause() : this.play();
    }

    /* Cập nhật giao diện nút Play */
    _updatePlayButtonUI() {
        this.playBtnIcon.className = `fas ${
            this.isPlaying ? "fa-pause" : "fa-play"
        }`;
        this.playBtn.dataset.tooltip = this.isPlaying ? "Pause" : "Play";
    }

    /**
     * Các nút chức năng
     */

    /* Next */
    _handleNext() {
        if (!this.queue.length) return;

        // Xử lý chế độ lặp lại một bài
        if (this.repeatMode === "one") {
            this.audioElement.currentTime = 0;
            this.play();
            return;
        }

        // Chuyển sang bài hát tiếp theo trong danh sách
        let newIndex = this.currentIndex + 1;

        // Xử lý khi đến cuối danh sách
        if (newIndex >= this.queue.length) {
            if (this.repeatMode === "all") {
                newIndex = 0; // Quay lại bài đầu tiên
            } else {
                // Dừng phát nhạc nếu không lặp lại
                this.pause();
                this.audioElement.currentTime = 0;
                this._updateProgressBarUI(0, 0);
                return;
            }
        }

        this.currentIndex = newIndex;
        this._loadAndPlayCurrentTrack();
    }

    /* Back */
    _handlePrevious() {
        if (!this.queue.length) return;

        // Nếu bài hát đã phát > 3 giây, quay lại đầu bài hát hiện tại
        if (this.audioElement.currentTime > 3) {
            this.audioElement.currentTime = 0;
            return;
        }

        // Chuyển về bài hát trước đó trong danh sách
        let newIndex = this.currentIndex - 1;

        // Nếu đang ở bài đầu tiên, quay về bài cuối cùng
        if (newIndex < 0) {
            newIndex = this.queue.length - 1;
        }

        this.currentIndex = newIndex;
        this._loadAndPlayCurrentTrack();
    }

    _updateShuffleButtonUI() {
        this.shuffleBtn.classList.toggle("active", this.isShuffle);
        this.shuffleBtn.dataset.tooltip = this.isShuffle
            ? "Disable shuffle"
            : "Enable shuffle";
    }

    _updateRepeatButtonUI() {
        const tooltips = {
            off: "Enable repeat",
            all: "Enable repeat one",
            one: "Disable repeat",
        };
        this.repeatBtn.classList.toggle("active", this.repeatMode !== "off");
        this.repeatBtn.classList.toggle(
            "repeat-one",
            this.repeatMode === "one"
        );
        this.repeatBtn.dataset.tooltip = tooltips[this.repeatMode];
    }

    /**
     * Thanh process
     */

    /* Nhấn chuột xuống */
    _handleProgressMouseDown(event) {
        this.isSeeking = true;
        this.progressContainer.classList.add("seeking");
        this._handleProgressMouseMove(event); // Cập nhật ngay khi nhấn chuột
        document.addEventListener("mousemove", this.handleProgressMove);
        document.addEventListener("mouseup", this.handleProgressUp);
    }

    /* Khi di chuột */
    _handleProgressMouseMove(event) {
        if (!this.isSeeking || isNaN(this.audioElement.duration)) return;

        const rect = this.progressBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const width = this.progressBar.clientWidth;
        let percentage = Math.max(0, Math.min(1, offsetX / width));

        const currentTime = percentage * this.audioElement.duration;
        this._updateProgressBarUI(percentage * 100, currentTime);
    }

    /* Cập nhật UI thanh Process */
    _updateProgressBarUI(percentage, currentTime) {
        this.progressFill.style.width = `${percentage}%`;
        this.currentTimeEl.textContent = this._formatTime(currentTime);
    }

    /**
     * Volume
     */

    /* Nhấn chuột */
    _handleVolumeMouseDown(event) {
        this.isAdjustingVolume = true;
        this.volumeContainer.classList.add("seeking");
        this._handleVolumeMouseMove(event); // Cập nhật ngay khi nhấn chuột
        document.addEventListener("mousemove", this.handleVolumeMove);
        document.addEventListener("mouseup", this.handleVolumeUp);
    }

    /* Di chuột */
    _handleVolumeMouseMove(event) {
        if (!this.isAdjustingVolume) return;
        const rect = this.volumeBar.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const width = this.volumeBar.clientWidth;
        let percentage = Math.max(0, Math.min(1, offsetX / width));
        this.previousVolume = this.audioElement.volume;
        this._setVolume(percentage);
    }

    /* Nhả chuột */
    _handleVolumeMouseUp() {
        this.isAdjustingVolume = false;
        this.volumeContainer.classList.remove("seeking");
        document.removeEventListener("mousemove", this.handleVolumeMove);
        document.removeEventListener("mouseup", this.handleVolumeUp);
    }

    /* Bật/Tắt volume */
    _toggleMute() {
        if (this.audioElement.muted) {
            // Nếu đang tắt tiếng -> Bật lại và khôi phục âm lượng trước đó
            this.audioElement.muted = false;
            this._setVolume(this.previousVolume || 1);
        } else {
            // Nếu đang bật -> Lưu âm lượng hiện tại, rồi tắt tiếng
            this.previousVolume = this.audioElement.volume;
            this.audioElement.muted = true;

            // Cập nhật UI về 0
            this._setVolume(0);
        }
    }

    /* Cập nhật icon của nút Mute */
    _updateMuteButtonUI() {
        // Nếu đang mute hoặc volume = 0
        if (this.audioElement.muted || this.audioElement.volume === 0) {
            this.muteBtnIcon.className = "fas fa-volume-mute";
            this.muteBtn.dataset.tooltip = "Unmute";
        } else {
            this.muteBtnIcon.className = `fas ${
                this.audioElement.volume > 0.5
                    ? "fa-volume-up"
                    : "fa-volume-down"
            }`;
            this.muteBtn.dataset.tooltip = "Mute";
        }
    }
}

export default Player;
