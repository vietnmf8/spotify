class QueuePanel {
    constructor(player) {
        this.player = player;
        this.isOpen = false;

        /* DOM Elements */
        this.appContainer = document.querySelector(".app-container");
        this.queueBtn = document.getElementById("queue-btn");
        this.queuePanel = document.getElementById("queue-panel");
    }

    /* Khởi tạo */
    init() {
        // Bật/tắt panel
        this.queueBtn.addEventListener("click", () => this.toggle());

        // Render lại nội dung panel
        document.addEventListener("player:queue-updated", () => this.render());
        document.addEventListener("player:state-change", () => this.render());

        // Đóng panel khi click ra ngoài
        // document
        //     .querySelector(".main-content")
        //     .addEventListener("click", () => {
        //         if (this.isOpen) {
        //             this.close();
        //         }
        //     });
    }

    /* Bật/tắt Queue */
    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    /* Mở Queue */
    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        this.appContainer.classList.add("queue-panel-open");
        this.queueBtn.classList.add("active");
        this.render();
    }

    /* Đóng Queue */
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.appContainer.classList.remove("queue-panel-open");
        this.queueBtn.classList.remove("active");
    }

    /* Render */
    render() {
        if (!this.isOpen) return;

        // Lưu lại vị trí cũ của các track
        const oldPositions = new Map();
        const trackItems =
            this.queuePanel.querySelectorAll(".queue-track-item");
        if (trackItems.length > 0) {
            trackItems.forEach((item) => {
                oldPositions.set(
                    item.dataset.trackId,
                    item.getBoundingClientRect()
                );
            });
        }

        const { currentTrack, queue, currentIndex, playContextName } =
            this.player;

        if (!currentTrack) {
            this.queuePanel.innerHTML = `
                <div class="queue-panel-header">
                    <h2 class="queue-panel-title">Queue</h2>
                </div>
                <p style="text-align: center; color: var(--text-secondary); margin-top: 20px;">
                    Start playing something to see the queue.
                </p>
            `;
            return;
        }

        // Render bài hát hiện tại
        const nowPlayingHTML = this._createTrackItemHTML(currentTrack, true);

        // Render các bài hát tiếp theo
        const nextUpTracks = queue.slice(currentIndex + 1);
        const nextUpHTML = nextUpTracks
            .map((track) => this._createTrackItemHTML(track, false))
            .join("");

        const nextUpTitle = playContextName
            ? `Next from: ${playContextName}`
            : "Next up";

        this.queuePanel.innerHTML = `
            <div class="queue-panel-header">
                <h2 class="queue-panel-title">Queue</h2>
            </div>
            <div class="queue-section">
                <h3 class="queue-section-title">Now playing</h3>
                <div class="queue-track-list">
                    ${nowPlayingHTML}
                </div>
            </div>
            ${
                nextUpTracks.length > 0
                    ? `
            <div class="queue-section">
                <h3 class="queue-section-title">${nextUpTitle}</h3>
                <div class="queue-track-list">
                    ${nextUpHTML}
                </div>
            </div>
            `
                    : ""
            }
        `;

        const newTrackItems =
            this.queuePanel.querySelectorAll(".queue-track-item");
        newTrackItems.forEach((item) => {
            const oldPos = oldPositions.get(item.dataset.trackId);
            if (!oldPos) return;

            // Lấy vị trí mới
            const newPos = item.getBoundingClientRect();

            // Tính toán sự chênh lệch vị trí
            const deltaX = oldPos.left - newPos.left;
            const deltaY = oldPos.top - newPos.top;

            // Chỉ animate khi có sự thay đổi vị trí
            if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                requestAnimationFrame(() => {
                    // Di chuyển item về vị trí cũ ngay lập tức (không có transition)
                    item.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
                    item.style.transition = "transform 0s";

                    // Bật transition và trả item về vị trí mới (trống) để trình duyệt tự động tạo animation
                    requestAnimationFrame(() => {
                        item.style.transition = "transform 0.4s ease-in-out";
                        item.style.transform = "";
                    });
                });

                // Dọn dẹp thuộc tính transition sau khi animation kết thúc
                item.addEventListener(
                    "transitionend",
                    () => {
                        item.style.transition = "";
                    },
                    { once: true }
                );
            }
        });

        this._handleTrack();
    }

    /* Render các bài hát */
    _createTrackItemHTML(trackData, isNowPlaying) {
        const track = {
            id: trackData.id,
            name: trackData.name,
            artist: trackData.artist,
            image_url: trackData.image_url,
        };

        return `
            <div class="queue-track-item ${
                isNowPlaying ? "now-playing" : ""
            }" data-track-id="${track.id}">
                <img src="${track.image_url || "placeholder.svg"}" alt="${
            track.name
        }" class="track-title-img">
                <div class="track-title-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-artist">${track.artist}</div>
                </div>
            </div>
        `;
    }

    /* Khi nhấn vào Track trong Queue */
    _handleTrack() {
        this.queuePanel
            .querySelectorAll(".queue-track-item:not(.now-playing)")
            .forEach((item) => {
                item.addEventListener("click", () => {
                    const trackId = item.dataset.trackId;
                    const trackToPlayData = this.player.queue.find(
                        (t) => t.id === trackId
                    );
                    if (trackToPlayData) {
                        this.player.startPlayback(
                            trackToPlayData,
                            this.player.queue
                        );
                    }
                });
            });
    }
}

export default QueuePanel;
