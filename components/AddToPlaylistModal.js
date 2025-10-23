import playlistService from "../features/playlist/playlistService.js";
import Toast from "./Toast.js";
import libraryService from "../features/library/libraryService.js";
import httpRequest from "../utils/httpRequest.js";
import storage from "../utils/storage.js";

class AddToPlaylistModal {
    constructor() {
        /* State */
        this.modalElement = null; // Modal Dom Element
        this.trackId = null; // Id bài hát được thêm
        this.playlists = []; // Danh sách tất cả playlist của người dùng
        this.initialSelectedIds = new Set(); // Các playlist ban đầu mà bài hát nằm trong đó
        this.currentSelectedIds = new Set(); // Các playlist đang được chọn
        this.triggerEvent = null; // Lưu sự kiện click -> tính toán vị trí hiển thị Modal
        this.pinnedIds = new Set(); // Lưu các ID của playlist đã được ghim

        // Lưu DOM đã mở Modal
        this.sourceElement = null;

        /* Các hành động */
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleCancel = this._handleCancel.bind(this);
        this._handleDone = this._handleDone.bind(this);
        this._handleSearch = this._handleSearch.bind(this);
    }

    /* Khởi tạo */
    init() {
        // Clone template & lấy các phần tử trong Modal
        const template = document.getElementById(
            "add-to-playlist-modal-template"
        );
        if (!template) {
            console.error("Add to Playlist modal template not found!");
            return;
        }
        const clone = template.content.cloneNode(true);
        this.modalElement = clone.querySelector(".add-to-playlist-modal");
        document.body.appendChild(this.modalElement);

        this.listElement = this.modalElement.querySelector(
            ".modal-playlists-list"
        );
        this.searchInput = this.modalElement.querySelector(
            ".modal-search-input"
        );
        this.cancelButton = this.modalElement.querySelector(".cancel-btn");
        this.doneButton = this.modalElement.querySelector(".done-btn");

        this._addEventListeners();
    }

    /* Mở modal */
    open(trackId, event, sourceElement) {
        // Ẩn tooltip khi mở modal
        const tooltip = document.querySelector(".tooltip.active");
        if (tooltip) {
            tooltip.classList.remove("active");
        }

        this.trackId = trackId;
        this.triggerEvent = event;

        this.sourceElement = sourceElement; // Lưu phần tử nguồn
        if (this.sourceElement) {
            this.sourceElement.classList.add("modal-source");
        }

        // Ẩn modal trước khi tính toán vị trí
        this.modalElement.classList.remove("show");

        // Focus ô input
        document.addEventListener("keydown", this._handleKeyDown);
        this.searchInput.focus();

        // Tải dữ liệu, định vị, sau đó mới hiển thị
        this._loadAndDisplayData();
    }

    // Load Data Playlist
    async _loadAndDisplayData() {
        // Render danh sách playlist từ cache ngay lập tức
        this._renderListFromCache();

        try {
            // Gọi API lấy dữ liệu Playlist được tạo
            const myPlaylists = await playlistService.getMyPlaylists();
            this.playlists = myPlaylists.filter(
                (p) => p.name !== "Liked Songs"
            );

            // Kiểm tra trạng thái của track
            await this._fetchAndUpdateTrackStatus();

            // Render lại list
            this._renderList(this.playlists);

            this._updatePosition();
            this.modalElement.classList.add("show");

            // Khi có dữ liệu mới và trạng thái tick đã đúng, render lại toàn bộ list
            this._renderList(this.playlists);
        } catch (error) {
            console.error("Lỗi khi tải dữ liệu cho modal:", error);
            Toast.error("Could not load your playlists.");
            this.listElement.innerHTML =
                '<p style="text-align:center; padding: 20px;">Failed to load.</p>';

            // Vẫn hiển thị modal lỗi ở đúng vị trí
            this._updatePosition();
            this.modalElement.classList.add("show");
        }
    }

    /* Đóng Modal & State */
    close() {
        if (this.sourceElement) {
            this.sourceElement.classList.remove("modal-source");
            this.sourceElement = null; // Dọn dẹp
        }

        this.modalElement.classList.remove("show");
        document.removeEventListener("keydown", this._handleKeyDown);
        this.trackId = null;
        this.searchInput.value = "";
        this.listElement.innerHTML = "";
        this.doneButton.classList.remove("show");
        this.triggerEvent = null;
    }

    /* Kiểm tra xem modal có đang mở cho một track cụ thể không. */
    isOpenedFor(trackId) {
        return (
            this.modalElement.classList.contains("show") &&
            this.trackId === trackId
        );
    }

    /* Xử lý các hành động trong Modal */
    _addEventListeners() {
        this.cancelButton.addEventListener("click", this._handleCancel);
        this.doneButton.addEventListener("click", this._handleDone);
        this.searchInput.addEventListener("input", this._handleSearch);
        this.listElement.addEventListener("click", (e) => {
            const itemRow = e.target.closest(".playlist-item-row");
            if (itemRow) {
                this._toggleSelection(itemRow);
            }
        });

        // Đóng modal khi click ra ngoài
        document.addEventListener("click", (e) => {
            if (
                this.modalElement.classList.contains("show") &&
                !this.modalElement.contains(e.target) &&
                !e.target.closest(".track-add-btn")
            ) {
                this.close();
            }
        });
    }

    /* Render danh sách từ cache */
    _renderListFromCache() {
        // Lấy danh sách playlist từ cache
        this.playlists = playlistService
            .getPlaylistsFromCache()
            .filter((p) => p.name !== "Liked Songs");

        // Lấy danh sách ID các playlist đã ghim
        this.pinnedIds = new Set(storage.get("pinnedItems") || []);

        // Reset trạng thái chọn
        this.initialSelectedIds.clear();
        this.currentSelectedIds.clear();

        // Render danh sách (chưa có tick)
        this._renderList(this.playlists);
    }

    /* Lấy trạng thái của track và cập nhật các dấu tick */
    async _fetchAndUpdateTrackStatus() {
        if (!this.trackId) return;

        // Xóa các ID cũ
        this.initialSelectedIds.clear();
        this.currentSelectedIds.clear();

        try {
            // Lấy chi tiết track và kiểm tra trong các playlist
            const [trackDetails, checkedPlaylistIds] = await Promise.all([
                httpRequest.get(`tracks/${this.trackId}`),
                this._checkTrackInPlaylists(),
            ]);

            // Nếu bài hát đã liked => tick chọn sẵn
            if (trackDetails.is_liked) {
                this.initialSelectedIds.add("liked-songs");
                this.currentSelectedIds.add("liked-songs");
            }

            // Đồng bộ trạng thái tick với các playlist khác
            checkedPlaylistIds.forEach((playlistId) => {
                if (playlistId) {
                    this.initialSelectedIds.add(playlistId);
                    this.currentSelectedIds.add(playlistId);
                }
            });

            // Cập nhật lại DOM để hiển thị các tick
            this._updateSelectionsInDOM();
        } catch (error) {
            console.error("Lỗi khi kiểm tra trạng thái bài hát:", error);
            Toast.error("Couldn't check track status.");
        }
    }

    /* Kiểm tra track có trong playlist nào */
    async _checkTrackInPlaylists() {
        // Lấy danh sách playlist hiện tại của modal để kiểm tra
        const playlistsToCheck = this.playlists;
        if (!playlistsToCheck || playlistsToCheck.length === 0) {
            return [];
        }

        const playlistCheckPromises = playlistsToCheck.map(async (playlist) => {
            try {
                const response = await httpRequest.get(
                    `playlists/${playlist.id}/tracks`
                );
                const hasTrack = response.tracks.some(
                    (track) => track.track_id === this.trackId
                );
                return hasTrack ? playlist.id : null;
            } catch (error) {
                console.error(
                    `Không thể kiểm tra playlist ${playlist.id}:`,
                    error
                );
                return null;
            }
        });
        return Promise.all(playlistCheckPromises);
    }

    /* Render List */
    _renderList(playlistsToRender) {
        this.listElement.innerHTML = "";

        // Thêm "Liked Songs" vào đầu danh sách
        const likedSongsData = {
            id: "liked-songs",
            name: "Liked Songs",
            isLikedSongs: true,
        };

        // Thêm Liked Songs vào cuối Modal
        const likedSongsHTML = this._createPlaylistItemHTML(likedSongsData);
        this.listElement.insertAdjacentHTML("beforeend", likedSongsHTML);

        // Render Playlist HTML vào cuối Modal
        if (playlistsToRender && playlistsToRender.length > 0) {
            const itemsHTML = playlistsToRender
                .map((playlist) => this._createPlaylistItemHTML(playlist))
                .join("");
            this.listElement.insertAdjacentHTML("beforeend", itemsHTML);
        }

        // Cập nhật trạng thái chọn Playlist trong Modal
        this._updateSelectionsInDOM();
    }

    /* Tạo Playlist HTML */
    _createPlaylistItemHTML(playlist) {
        // Clone Playlist in Modal
        const template = document.getElementById("playlist-item-template");
        const clone = template.content.cloneNode(true);
        const itemRow = clone.querySelector(".playlist-item-row");
        itemRow.dataset.playlistId = playlist.id;

        // Ảnh bìa của Playlist
        const coverImg = itemRow.querySelector(".playlist-item-cover");
        if (playlist.isLikedSongs) {
            const iconDiv = document.createElement("div");
            iconDiv.className = "playlist-item-cover liked-songs-cover";
            iconDiv.innerHTML = '<i class="fas fa-heart"></i>';
            coverImg.replaceWith(iconDiv);
        } else {
            coverImg.src = playlist.image_url || "placeholder.svg";
        }

        // Tên playlist
        itemRow.querySelector(".playlist-item-name").textContent =
            playlist.name;

        // Số lượng Playlist
        const countElement = itemRow.querySelector(".playlist-item-count");
        const pinIconHTML =
            '<i class="fas fa-thumbtack" style="color: var(--accent-primary); font-size: 10px; margin-right: 4px; vertical-align: middle;"></i>';

        // Liked Songs luôn được ghim
        if (playlist.isLikedSongs) {
            countElement.innerHTML = `${pinIconHTML}Playlist`;
        } else {
            const isPinned = this.pinnedIds.has(playlist.id);
            const totalTracks = playlist.total_tracks ?? 0;
            const trackText = totalTracks === 1 ? "song" : "songs";
            countElement.innerHTML = `${
                isPinned ? pinIconHTML : ""
            }${totalTracks} ${trackText}`;
        }

        return itemRow.outerHTML;
    }

    /* Chọn/Bỏ chọn Playlist */
    _toggleSelection(itemRow) {
        // Lấy ra id của playlist
        // Nếu đang chọn thì bỏ chọn
        const id = itemRow.dataset.playlistId;
        itemRow.classList.toggle("selected");

        // Nếu đang selected -> playlist này được chọn -> thêm playlistId
        if (itemRow.classList.contains("selected")) {
            this.currentSelectedIds.add(id);
        } else {
            this.currentSelectedIds.delete(id);
        }

        // Cập nhật nút Done
        this._updateDoneButtonState();
    }

    /* Cập nhật ẩn/hiện nút Done */
    _updateDoneButtonState() {
        // Kiểm tra nếu có sự thay đổi ->  thì hiện nút Done
        const initial = JSON.stringify([...this.initialSelectedIds].sort());
        const current = JSON.stringify([...this.currentSelectedIds].sort());
        const hasChanged = initial !== current;
        this.doneButton.classList.toggle("show", hasChanged);
    }

    /* Cập nhật trạng thái chọn Playlist */
    _updateSelectionsInDOM() {
        this.listElement
            .querySelectorAll(".playlist-item-row")
            .forEach((row) => {
                const id = row.dataset.playlistId;
                row.classList.toggle(
                    "selected",
                    this.currentSelectedIds.has(id)
                );
            });
    }

    /* Xử lý tìm kiếm */
    _handleSearch(e) {
        const query = e.target.value.toLowerCase();
        // Lọc playlist dựa theo từ khoá tìm kiếm
        const filtered = this.playlists.filter((p) =>
            p.name.toLowerCase().includes(query)
        );
        // Render lại Playlist
        this._renderList(filtered);
    }

    /* Xử lý khi nhấn Done */
    async _handleDone() {
        // Playlist được chọn
        const toAdd = [...this.currentSelectedIds].filter(
            (id) => !this.initialSelectedIds.has(id)
        );

        // Playlist bị bỏ chọn
        const toRemove = [...this.initialSelectedIds].filter(
            (id) => !this.currentSelectedIds.has(id)
        );

        try {
            const addPromises = [];
            const removePromises = [];

            // Nếu các playlist được chọn (ngoại trừ Liked-songs) -> gọi API Add Track to Playlist
            toAdd.forEach((playlistId) => {
                if (playlistId !== "liked-songs") {
                    addPromises.push(
                        playlistService.addTrackToPlaylist(
                            playlistId,
                            this.trackId
                        )
                    );
                } else {
                    addPromises.push(libraryService.likeTrack(this.trackId));
                }
            });

            // Nếu là Playlist Liked Songs -> Unlike
            toRemove.forEach((playlistId) => {
                if (playlistId === "liked-songs") {
                    removePromises.push(
                        libraryService.unlikeTrack(this.trackId)
                    );
                } else {
                    // Còn không phải -> Remove Track
                    removePromises.push(
                        playlistService.removeTrackFromPlaylist(
                            playlistId,
                            this.trackId
                        )
                    );
                }

                // Phát sự kiện thông báo đã gỡ track
                document.dispatchEvent(
                    new CustomEvent("playlist:track-removed", {
                        detail: {
                            trackId: this.trackId,
                            playlistId: playlistId,
                        },
                    })
                );
            });

            // Gọi song song các API thêm/xóa
            await Promise.all([...addPromises, ...removePromises]);

            // Lấy URL ảnh từ DOM element nguồn
            const trackImageUrl =
                this.sourceElement.querySelector(".track-title-img")?.src;

            // Promise cập nhật ảnh Playlist
            const updateCoverPromises = [];

            // Kiểm tra các playlist vừa được thêm bài hát vào
            if (trackImageUrl) {
                toAdd.forEach((playlistId) => {
                    if (playlistId === "liked-songs") return;

                    // Tìm playlist trong danh sách hiện tại để kiểm tra số lượng bài hát
                    const playlistData = this.playlists.find(
                        (p) => p.id === playlistId
                    );

                    // Nếu playlist trước đó rỗng, gửi sự kiện để cập nhật ảnh
                    if (playlistData && playlistData.total_tracks === 0) {
                        // Cập nhạt ảnh avatar playlist
                        updateCoverPromises.push(
                            playlistService.updatePlaylist(playlistId, {
                                image_url: trackImageUrl,
                            })
                        );

                        // Phát sự kiện cập nhật UI
                        document.dispatchEvent(
                            new CustomEvent("playlist:updated", {
                                detail: {
                                    id: playlistId,
                                    image_url: trackImageUrl, // Ảnh của bài hát đầu tiên
                                },
                            })
                        );
                    }
                });
            }

            // Chạy Promise cập nhật avatar
            if (updateCoverPromises.length > 0) {
                await Promise.all(updateCoverPromises);
            }

            // Reset cache
            playlistService.invalidatePlaylistsCache();

            // Thêm thành công thì bắn ra Toast
            if (toAdd.length > 0) {
                if (toAdd.includes("liked-songs")) {
                    Toast.success("Added to Liked Songs.");
                } else {
                    Toast.success(`Saved to your playlists.`);
                }
            }
            if (toRemove.length > 0) {
                if (toRemove.includes("liked-songs")) {
                    Toast.info(`Removed from Liked Songs.`);
                } else {
                    Toast.info(`Removed from playlists.`);
                }
            }

            // Phát sự kiện Update Liked Songs
            document.dispatchEvent(new CustomEvent("likedSongs:updated"));

            // Xoá cache và phát sự kiện thay đổi của savedTracks
            libraryService.clearSavedTrackIdsCache();
            document.dispatchEvent(
                new CustomEvent("savedTracks:state-changed")
            );
        } catch (error) {
            Toast.error("An error occurred. Please try again.");
        } finally {
            this.close();
        }
    }

    /* Đóng Modal khi nhấn Cancel & Escape */
    _handleCancel() {
        this.close();
    }

    _handleKeyDown(e) {
        if (e.key === "Escape") {
            this.close();
        }
    }

    /* Cập nhật vị trí Modal */
    _updatePosition() {
        if (!this.triggerEvent) return;

        const { clientX: mouseX, clientY: mouseY } = this.triggerEvent;
        const modalRect = this.modalElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const margin = 8; // Khoảng cách với cạnh màn hình

        let top = mouseY + 25; //10
        let left = mouseX + 25;

        // Nếu modal tràn ra ngoài cạnh dưới, hiển thị nó ở trên con trỏ
        if (top + modalRect.height > viewportHeight - margin) {
            top = mouseY - modalRect.height - 25;
        }

        // Nếu modal tràn ra ngoài cạnh phải, hiển thị nó ở bên trái con trỏ
        if (left + modalRect.width > viewportWidth - margin) {
            left = mouseX - modalRect.width - 25;
        }

        // Đảm bảo modal không bị đẩy ra khỏi màn hình (trên và trái)
        if (top < margin) {
            top = margin;
        }
        if (left < margin) {
            left = margin;
        }

        this.modalElement.style.top = `${top}px`;
        this.modalElement.style.left = `${left}px`;
    }
}

export default AddToPlaylistModal;
