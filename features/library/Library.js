import libraryService from "./libraryService.js";
import router from "../../router/router.js";
import storage from "../../utils/storage.js";
import Toast from "../../components/Toast.js";
import httpRequest from "../../utils/httpRequest.js";
import activityTracker from "../../utils/activityTracker.js";

/**
 * Quản lý toàn bộ "Your Library" trong sidebar bên trái.
 * 1. Tải và hiển thị danh sách (Playlists, Artists) khi người dùng đăng nhập.
 * 2. Xóa sạch Library khi người dùng đăng xuất.
 * 3. Xử lý logic Pin/Unpin (ghim/bỏ ghim) items.
 * 4. Lắng nghe và cập nhật danh sách (thêm/xóa) khi có sự kiện
 * 5. Cập nhật số lượng bài hát trong "Liked Songs".
 * 6. Xử lý click play trên từng item, gửi đúng ngữ cảnh (context) cho Player.
 * 7. Đồng bộ hóa UI (highlight, icon loa) với trạng thái của Player
 */

class Library {
    constructor(player) {
        // `div` cha chứa tất cả các `.library-item`.
        this.libraryContent = document.getElementById("libraryContent");

        // Mảng chứa dữ liệu (data) của tất cả item (trừ Liked Songs).
        this.libraryItems = [];

        // Dùng `Set` để kiểm tra nhanh xem một ID có tồn tại trong thư viện không
        this.libraryItemIds = new Set();

        // Key để lưu item đang được active (đang xem trang chi tiết).
        this.activeItemKey = "activeLibraryItem";

        // Key để lưu mảng ID các item đã được ghim.
        this.pinnedItemsKey = "pinnedItems";

        // Giới hạn số lượng item được ghim (không tính Liked Songs).
        this.maxPinnedItems = 3;

        //  Mảng ID của các item đã ghim, đọc từ `storage`.
        this.pinnedItemIds = storage.get(this.pinnedItemsKey) || [];

        // Key để lưu mảng ID của các playlist do user TẠO,
        // sắp xếp theo thứ tự tạo (mới nhất ở đầu).
        // Dùng cho Sorter "Recently added".
        this.createOrderKey = "library_create_order";

        // Mảng ID playlist do user tạo, đọc từ `storage`.
        this.createOrderIds = storage.get(this.createOrderKey) || [];

        this.player = player;

        // Cache trạng thái của Player, dùng để cập nhật UI
        this.playerState = { playContextName: null, isPlaying: false };

        // Cờ kiểm tra xem library đã render lần đầu tiên hay chưa.
        this.isLibraryRendered = false;
    }

    /* Khởi tạo */
    init() {
        // Lắng nghe sự kiện login/logout từ module Auth.
        document.addEventListener("auth:state-changed", (e) => {
            if (e.detail.isLoggedIn) {
                // Nếu vừa đăng nhập -> Tải và render thư viện.
                this._loadAndRenderLibrary();
            } else {
                // Nếu vừa đăng xuất -> Xóa sạch thư viện.
                this._clearLibrary();
            }
        });

        // Tải và render library ngay khi khởi tạo (cho trường hợp đã đăng nhập từ phiên trước).
        this._loadAndRenderLibrary();

        /* Lắng nghe sự kiện khi có thay đổi trong thư viện */

        // (follow, unfollow, create, delete).
        // Phát ra từ: `Details.js` (follow/unfollow), `main.js` (create), `DeleteConfirmModal.js` (delete).
        document.addEventListener("library:updated", (e) =>
            this.handleLibraryUpdate(e.detail)
        );

        // Lắng nghe sự kiện yêu cầu Pin/Unpin (từ ContextMenu).
        document.addEventListener("library:toggle-pin", (e) =>
            this._togglePin(e.detail.id)
        );

        // Lắng nghe sự kiện khi chi tiết playlist (tên, ảnh) được cập nhật (từ PlaylistEditModal).
        document.addEventListener("playlist:updated", (e) => {
            this._handlePlaylistUpdate(e.detail);
        });

        // Lắng nghe sự kiện khi "Liked Songs" thay đổi (thêm/bớt bài hát).
        document.addEventListener("likedSongs:updated", () => {
            this._updateLikedSongsCount();
        });

        // Lắng nghe sự kiện từ Player (play, pause, change track).
        document.addEventListener(
            "player:state-change",
            this._handlePlayerStateChange.bind(this)
        );

        // event delegation
        this.libraryContent.addEventListener("click", (e) => {
            // Tìm nút Play và item trong Library
            const playBtn = e.target.closest(".library-play-btn");
            const item = e.target.closest(".library-item");

            if (playBtn) {
                // Click nút NÚT PLAY
                e.stopPropagation();
                this._handlePlayClick(playBtn);
            }
            // Không click vào nút Play
            else if (item && item.dataset.id) {
                const { id, type } = item.dataset;
                router.navigate(`/${type}/${id}`);
            }
        });
    }

    /* Xóa sạch thư viện khi đăng xuất */
    _clearLibrary() {
        // Reset lại HTML của library content về trạng thái ban đầu
        const initialLikedSongsHTML = `
            <div
                class="library-item liked-songs-item"
                data-type="playlist"
                data-id="liked"
                data-pinned="true"
            >
                <div class="item-image-wrapper">
                    <div class="item-icon liked-songs">
                        <i class="fas fa-heart"></i>
                    </div>
                    <button
                        class="library-play-btn"
                        data-tooltip="Play Liked Songs"
                        data-context-name="Liked Songs"
                    >
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="item-info">
                    <div class="item-title">Liked Songs</div>
                    <div class="item-subtitle">
                        <i class="fas fa-thumbtack"></i>
                        Playlist
                    </div>
                </div>
            </div>`;
        this.libraryContent.innerHTML = initialLikedSongsHTML;

        // Reset lại các thuộc tính state của class
        this.libraryItems = [];
        this.libraryItemIds.clear();
        this.pinnedItemIds = [];

        this.createOrderIds = [];
        storage.remove(this.createOrderKey);

        // Xoá cache số lượng "Liked Songs"
        storage.remove("likedSongsCount");

        this.isLibraryRendered = false; // Đánh dấu là chưa render
    }

    /*  Tải dữ liệu thư viện từ `libraryService` và render ra DOM */
    async _loadAndRenderLibrary() {
        // Đọc số lượng "Liked Songs" từ cache (storage) và hiển thị ngay
        const cachedCount = storage.get("likedSongsCount");
        if (cachedCount !== null) {
            this._updateLikedSongsCountUI(cachedCount);
        }

        // Gọi API để cập nhật lại số lượng "Liked Songs" chính xác.
        this._updateLikedSongsCount();

        // Gọi API chính để lấy danh sách (Playlists, Artists)
        const { playlists, artists } = await libraryService.getLibraryContent();

        // Tạo một `Set` các ID đã ghim để tra cứu nhanh (duy nhất)
        const pinnedIdSet = new Set(this.pinnedItemIds);

        // Lọc bỏ "Liked Songs" khỏi danh sách
        const filteredPlaylists = playlists.filter(
            (p) => p.name !== "Liked Songs"
        );

        // Chuẩn hóa dữ liệu: Thêm `item_type` và `isPinned` vào data.
        const playlistItems = filteredPlaylists.map((p) => ({
            ...p,
            item_type: "playlist",
            isPinned: pinnedIdSet.has(p.id),
        }));
        const artistItems = artists.map((a) => ({
            ...a,
            item_type: "artist",
            isPinned: pinnedIdSet.has(a.id),
        }));

        // Gộp 2 mảng lại thành mảng chung.
        this.libraryItems = [...playlistItems, ...artistItems];

        // Đồng bộ `libraryItemIds` (Set) từ `libraryItems` (Array).
        this._updateLibraryIds();

        // Bắt đầu render DOM.
        this.renderLibrary();

        this.isLibraryRendered = true; // Đánh dấu đã render xong

        // Lấy trạng thái player hiện tại (nếu có).
        if (this.player) {
            this.playerState = {
                playContextName: this.player.playContextName,
                isPlaying: this.player.isPlaying,
            };
        }

        // Cập nhật UI (highlight, icon loa) dựa trên trạng thái player.
        this._updateLibraryItemStates();

        // Phát sự kiện đi thông báo library đã render xong!
        document.dispatchEvent(new CustomEvent("library:rendered"));
    }

    /* Render (vẽ) lại toàn bộ danh sách item ra DOM. 
        - Hàm này tách riêng "Liked Songs", "pinned" và "unpinned" items.
    */
    renderLibrary() {
        // Tìm và lưu lại "Liked Songs"
        const likedSongsItem =
            this.libraryContent.querySelector(".liked-songs-item");
        const likedSongsHTML = likedSongsItem ? likedSongsItem.outerHTML : "";

        // Xóa sạch `libraryContent` và render lại "Liked Songs".
        this.libraryContent.innerHTML = likedSongsHTML;

        // Lấy các item đã ghim (theo đúng thứ tự trong mảng `pinnedItemIds`).
        const pinnedItems = this.pinnedItemIds
            .map((id) => this.libraryItems.find((item) => item.id === id))
            .filter(Boolean);

        // Lấy các item chưa ghim.
        const unpinnedItems = this.libraryItems.filter(
            (item) => !item.isPinned
        );

        // Render 2 nhóm này (nếu có item).
        if (this.libraryItems.length > 0) {
            // HTML pin item
            const pinnedItemsHTML = pinnedItems
                .map((item) => this._createLibraryItemHTML(item))
                .join("");

            // HTML unpin item
            const unpinnedItemsHTML = unpinnedItems
                .map((item) => this._createLibraryItemHTML(item))
                .join("");

            // Thêm HTML vào DOM (sau "Liked Songs")
            this.libraryContent.insertAdjacentHTML(
                "beforeend",
                pinnedItemsHTML + unpinnedItemsHTML
            );
        }

        // Áp dụng lại trạng thái `.active` (nếu đang xem chi tiết).
        this._applyActiveState();

        // Cập nhật lại trạng thái play/pause (nếu đã render).
        if (this.isLibraryRendered) {
            this._updateLibraryItemStates();
        }

        // Phát sự kiện sau khi render để Sorter hoạt động
        document.dispatchEvent(new CustomEvent("library:rerendered"));
    }

    /* Áp dụng trạng thái active cho item từ localStorage */
    _applyActiveState() {
        // Bỏ active của item hiện tại
        const currentActive = this.libraryContent.querySelector(
            ".library-item.active"
        );
        if (currentActive) {
            currentActive.classList.remove("active");
        }

        // Lấy thông tin item active từ storage
        const activeItem = storage.get(this.activeItemKey);

        if (activeItem && activeItem.type && activeItem.id) {
            const itemElement = this.libraryContent.querySelector(
                `[data-type="${activeItem.type}"][data-id="${activeItem.id}"]`
            );
            if (itemElement) {
                itemElement.classList.add("active");
            }
        }
    }

    /* Lưu item active vào storage */
    setActiveItem(type, id) {
        storage.set(this.activeItemKey, { type, id });
        this._applyActiveState();
    }

    /* Xóa trạng thái active */
    clearActiveItem() {
        storage.remove(this.activeItemKey);
        const currentActive = this.libraryContent.querySelector(
            ".library-item.active"
        );
        if (currentActive) {
            currentActive.classList.remove("active");
        }
    }

    /* Tạo HTML cho các item Playlist/Artist */
    _createLibraryItemHTML(item) {
        // Có phải Artist không?
        const isArtist = item.item_type === "artist";
        const subtitleText = isArtist
            ? "Artist"
            : `Playlist • ${item.user_display_name}`;

        const pinIconHTML = item.isPinned
            ? '<i class="fas fa-thumbtack"></i> '
            : "";
        const subtitle = `${pinIconHTML}${subtitleText}`;

        return `
            <div class="library-item" data-type="${item.item_type}" data-id="${
            item.id
        }" 
            data-pinned="${!!item.isPinned}"> 
                <div class="item-image-wrapper">
                    <img
                        src="${item.image_url || "placeholder.svg"}"
                        alt="${item.name}"
                        class="item-image"
                        onerror="this.onerror=null;this.src='placeholder.svg';"
                    />
                    <button
                        class="library-play-btn"
                        data-tooltip="Play ${item.name}"
                        data-context-name="${item.name}"
                    >
                        <i class="fas fa-play"></i>
                    </button>
                </div>
                <div class="item-info">
                    <div class="item-title">${item.name}</div>
                    <div class="item-subtitle">${subtitle}</div>
                </div>
            </div>
        `;
    }

    /* Cập nhật Library */
    handleLibraryUpdate({ type, action, data }) {
        const likedSongsItem =
            this.libraryContent.querySelector(".liked-songs-item");

        // Khi nhấn follow
        if (action === "follow" || action === "create") {
            if (action === "create") {
                // Hiển thị thông tin vào playlist
                const user = storage.get("user");
                if (user && !data.user_display_name) {
                    data.user_display_name = user.display_name;
                }
            }

            this.createOrderIds.unshift(data.id);
            storage.set(this.createOrderKey, this.createOrderIds);

            // Thêm một item mới lên đầu & đồng bộ ID
            const newItem = { ...data, item_type: type, isPinned: false };
            this.libraryItems.unshift(newItem);
            this._updateLibraryIds();
            this.renderLibrary();
        }

        // Khi nhấn Unfollow
        else if (action === "unfollow" || action === "delete") {
            // Nếu item bị unfollow/delete đang được ghim, hãy bỏ ghim nó
            if (this.pinnedItemIds.includes(data.id)) {
                this.pinnedItemIds = this.pinnedItemIds.filter(
                    (id) => id !== data.id
                );
                storage.set(this.pinnedItemsKey, this.pinnedItemIds);
            }

            // Xóa khỏi createOrderIds
            const wasInCreateOrder = this.createOrderIds.includes(data.id);
            if (wasInCreateOrder) {
                this.createOrderIds = this.createOrderIds.filter(
                    (id) => id !== data.id
                );
                storage.set(this.createOrderKey, this.createOrderIds);
            }

            // Lấy Id của item đó và gỡ khỏi DOM
            const itemToRemove = this.libraryContent.querySelector(
                `[data-id="${data.id}"]`
            );
            if (itemToRemove) {
                itemToRemove.remove();
            }

            // Cập nhật Library item và đồng bộ ID duy nhất
            this.libraryItems = this.libraryItems.filter(
                (item) => item.id !== data.id
            );
            this._updateLibraryIds();

            // Nếu là 'delete', không cần render lại
            if (action === "unfollow") {
                this.renderLibrary();
            }
        }
    }

    /* Xử lý cập nhật thông tin Playlist */
    _handlePlaylistUpdate(updatedPlaylist) {
        // Xác định Index của item được cập nhật
        const itemIndex = this.libraryItems.findIndex(
            (item) => item.id === updatedPlaylist.id
        );

        if (itemIndex > -1) {
            // Cập nhật thông tin trong mảng
            const item = this.libraryItems[itemIndex];
            if (updatedPlaylist.name !== undefined) {
                item.name = updatedPlaylist.name;
            }
            if (updatedPlaylist.image_url !== undefined) {
                item.image_url = updatedPlaylist.image_url;
            }

            // Render lại toàn bộ library để đảm bảo thứ tự ghim đúng
            this.renderLibrary();
        }
    }

    /* Xử lý logic Pin/Unpin */
    _togglePin(id) {
        const item = this.libraryItems.find((item) => item.id === id);
        if (!item) return;

        // Logic GHIM
        if (!item.isPinned) {
            // Kiểm tra giới hạn ghim
            if (this.pinnedItemIds.length >= this.maxPinnedItems) {
                Toast.error(
                    `Chỉ có thể ghim tối đa ${this.maxPinnedItems + 1} mục.`
                );
                return;
            }
            // Push vào cuối mảng & gán là đã ghim
            this.pinnedItemIds.push(id);
            item.isPinned = true;
        }

        // Logic BỎ GHIM
        else {
            this.pinnedItemIds = this.pinnedItemIds.filter(
                (pinnedId) => pinnedId !== id
            );

            item.isPinned = false;
        }

        // Cập nhật localStorage
        storage.set(this.pinnedItemsKey, this.pinnedItemIds);

        // Render lại danh sách
        this.renderLibrary();
    }

    /* Đồng bộ Set ID với mảng items để kiểm tra nhanh. */
    _updateLibraryIds() {
        // Dọn dẹp mảng Set và thêm item libraryItems và object Set để lọc trùng
        this.libraryItemIds.clear();
        this.libraryItems.forEach((item) => this.libraryItemIds.add(item.id));
    }

    /* Kiểm tra item đã tồn tại trong Library thông qua Id */
    isItemInLibrary(id) {
        return this.libraryItemIds.has(id);
    }

    /* Click vào nút Play trên item */
    _handlePlayClick(buttonEl) {
        if (!this.player) return;

        const item = buttonEl.closest(".library-item");
        const { id, type } = item.dataset;
        const contextName = buttonEl.dataset.contextName;

        if (!id || !type || !contextName) return;

        activityTracker.trackItemActivity(id);

        if (contextName === this.player.playContextName) {
            // Nếu đúng, chỉ cần toggle play/pause
            this.player._togglePlayPause();
            return;
        }

        let getTracksFunction;

        // Lấy danh sách bài hát
        if (id === "liked") {
            // Liked Songs
            getTracksFunction = async () => {
                const data = await libraryService.getLikedSongs();
                // 'liked' có cấu trúc track phẳng, giống artist
                return this._normalizeTracks(data.tracks || [], "liked");
            };
        } else {
            // Playlist hoặc Artist
            getTracksFunction = async () => {
                const apiPath =
                    type === "artist"
                        ? `artists/${id}/tracks/popular`
                        : `playlists/${id}/tracks`;
                const data = await httpRequest.get(apiPath);
                return this._normalizeTracks(data.tracks || [], type);
            };
        }

        // Gửi yêu cầu đến Player
        this.player.requestContextPlayback(contextName, getTracksFunction);
    }

    /* Chuẩn hoá dữ liệu */
    _normalizeTracks(tracks, type = "track") {
        if (!tracks) return [];
        return tracks.map((rawTrack) => {
            // Cấu trúc track từ API playlist (/playlists/:id/tracks)
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
            // Cấu trúc track phẳng (từ artist, liked songs, trending)
            return {
                id: rawTrack.id,
                name: rawTrack.title,
                artist: rawTrack.artist_name,
                image_url: rawTrack.image_url,
                audio_url: rawTrack.audio_url,
                duration: rawTrack.duration,
            };
        });
    }
    /* Chỉ cập nhật UI của Liked Songs count */
    _updateLikedSongsCountUI(count) {
        const likedSongsItem =
            this.libraryContent.querySelector(".liked-songs-item");
        if (!likedSongsItem) return;

        const subtitleElement = likedSongsItem.querySelector(".item-subtitle");
        if (!subtitleElement) return;

        const songText = count === 1 ? "song" : "songs";
        subtitleElement.innerHTML = `
            <i class="fas fa-thumbtack"></i>
            Playlist • ${count} ${songText}
        `;
    }

    /* Cập nhật số lượng bài hát trong Liked Songs */
    async _updateLikedSongsCount() {
        const likedSongsItem =
            this.libraryContent.querySelector(".liked-songs-item");
        if (!likedSongsItem) return;

        // Nếu chưa đăng nhập, chỉ hiển thị "Playlist"
        if (!storage.get("access_token")) {
            const subtitleElement =
                likedSongsItem.querySelector(".item-subtitle");
            if (subtitleElement) {
                subtitleElement.innerHTML = `<i class="fas fa-thumbtack"></i> Playlist`;
            }
            storage.remove("likedSongsCount"); // Xoá cache nếu logout
            return;
        }
        try {
            // Lấy dữ liệu từ API
            const likedSongsData = await libraryService.getLikedSongs();
            const count = likedSongsData.pagination.total;

            // Lưu count vào localStorage
            storage.set("likedSongsCount", count);

            // Cập nhật DOM
            this._updateLikedSongsCountUI(count);
        } catch (error) {
            console.error("Failed to update liked songs count:", error);
            // storage.remove("likedSongsCount");
        }
    }

    /* Xử lý khi trạng thái Player thay đổi */
    _handlePlayerStateChange(e) {
        const { playContextName, isPlaying } = e.detail;
        this.playerState = { playContextName, isPlaying };

        if (this.isLibraryRendered) {
            this._updateLibraryItemStates();
        }
    }

    /* Cập nhật giao diện (highlight, icon loa) cho các item trong Library */
    _updateLibraryItemStates() {
        if (!this.libraryContent) return;

        // Lấy tất cả item trong thư viện
        const allItems = this.libraryContent.querySelectorAll(".library-item");

        allItems.forEach((item) => {
            const titleEl = item.querySelector(".item-title");
            if (!titleEl) return;

            // Lấy context name từ nút play để so sánh
            const playBtn = item.querySelector(".library-play-btn");
            const itemContextName = playBtn
                ? playBtn.dataset.contextName
                : titleEl.textContent;

            // Kiểm tra xem item này có phải là context đang phát không
            const isPlayingThisContext =
                // So sánh với itemContextName
                this.playerState.playContextName === itemContextName;
            const isPlaying =
                isPlayingThisContext && this.playerState.isPlaying;
            const isPaused =
                isPlayingThisContext && !this.playerState.isPlaying;

            // Xóa icon loa cũ (nếu có)
            const oldSpeakerIcon = item.querySelector(".speaker-icon");
            if (oldSpeakerIcon) {
                oldSpeakerIcon.remove();
            }

            // Xóa các class trạng thái cũ
            item.classList.remove("playing", "paused");

            if (isPlaying) {
                // Đang phát: Highlight (class .playing) + Icon Loa
                item.classList.add("playing");

                const speakerIcon = document.createElement("i");
                speakerIcon.className = "fas fa-volume-up speaker-icon";
                item.appendChild(speakerIcon); // Thêm icon vào
            } else if (isPaused) {
                // Tạm dừng: Highlight (class .paused) + KHÔNG Icon Loa
                item.classList.add("paused");
            }

            // Cập nhật nút Play/Pause trên ảnh bìa
            // const playBtn = item.querySelector(".library-play-btn"); // Đã lấy ở trên
            if (!playBtn) return;

            const playBtnIcon = playBtn.querySelector("i");
            // Đã lấy context name ở trên
            const contextName = itemContextName;

            if (isPlaying) {
                // Đang phát -> Hiện icon Pause
                playBtnIcon.className = "fas fa-pause";
                playBtn.dataset.tooltip = `Pause, ${contextName}`;
            } else if (isPaused) {
                // Đang tạm dừng -> Hiện icon Play
                playBtnIcon.className = "fas fa-play";
                playBtn.dataset.tooltip = `Play ${contextName}`;
            } else {
                // Không phát context này -> Hiện icon Play
                playBtnIcon.className = "fas fa-play";
                playBtn.dataset.tooltip = `Play ${contextName}`;
            }

            // Đảm bảo căn chỉnh icon play (nếu là fa-play)
            playBtnIcon.classList.toggle(
                "fa-play",
                playBtnIcon.classList.contains("fa-play")
            );
        });
    }
}

export default Library;
