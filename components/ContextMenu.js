import libraryService from "../features/library/libraryService.js";
import storage from "../utils/storage.js";
import Toast from "./Toast.js";
import DeleteConfirmModal from "./DeleteConfirmModal.js";
import playlistService from "../features/playlist/playlistService.js";
import router from "../router/router.js";

class ContextMenu {
    constructor(library) {
        /* Phần tử Menu & trạng thái active */
        this.library = library; // Tham chiếu đối tượng Library
        this.menuElement = null; // Phần tử Menu Context
        this.active = false; // Trạng thái mở/đóng Menu Context
        this.currentTargetItem = null; // Item được click chuột phải
        this.deleteModal = new DeleteConfirmModal(); // Modal xoá

        /* Menu Artist (trong Library) */
        this.libraryArtistMenuItems = [
            { label: "Follow", icon: "fa-user-plus", action: "follow" },
            {
                label: "Don't play this artist",
                icon: "fa-ban",
                action: "dont-play",
            },
            { label: "Pin artist", icon: "fa-thumbtack", action: "toggle-pin" },
            {
                label: "Go to artist radio",
                icon: "fa-broadcast-tower",
                action: "radio",
            },
            { type: "separator" },
            {
                label: "Report",
                icon: "fa-flag",
                action: "report",
                hasExternalLink: true,
            },
            {
                label: "Share",
                icon: "fa-share",
                action: "share",
                hasSubMenu: true,
            },
        ];

        /* Menu Playlist (trong Library) */
        this.libraryPlaylistMenuItems = [
            // Section 1
            {
                label: "Add to queue",
                icon: "fa-stream",
                action: "add-to-queue",
            },
            {
                label: "Remove from Your Library",
                icon: "fa-minus-circle",
                action: "unfollow",
            },
            {
                label: "Remove from profile",
                icon: "fa-user-slash",
                action: "remove-from-profile",
            },
            { type: "separator" },
            // Section 2
            {
                label: "Edit details",
                icon: "fa-pencil-alt",
                action: "edit-details",
            },
            { label: "Delete", icon: "fa-trash", action: "delete" },
            {
                label: "Download",
                icon: "fa-download",
                action: "download",
                disabled: true,
            },
            { type: "separator" },
            // Section 3
            {
                label: "Create playlist",
                icon: "fa-plus-square",
                action: "create-playlist",
            },
            {
                label: "Create folder",
                icon: "fa-folder-plus",
                action: "create-folder",
            },
            { type: "separator" },
            // Section 4
            { label: "Make private", icon: "fa-lock", action: "make-private" },
            {
                label: "Invite collaborators",
                icon: "fa-user-plus",
                action: "invite-collaborators",
            },
            {
                label: "Exclude from your taste profile",
                icon: "fa-times-circle",
                action: "exclude-taste-profile",
            },
            {
                label: "Move to folder",
                icon: "fa-folder",
                action: "move-to-folder",
                hasSubMenu: true,
            },
            {
                label: "Add to other playlist",
                icon: "fa-plus-circle",
                action: "add-to-other-playlist",
                hasSubMenu: true,
            },
            {
                label: "Pin playlist",
                icon: "fa-thumbtack",
                action: "toggle-pin",
            },
            {
                label: "Share",
                icon: "fa-share",
                action: "share",
                hasSubMenu: true,
            },
        ];

        /* Menu Liked Songs (Library) */
        this.likedSongsMenuItems = [
            {
                label: "Download",
                icon: "fa-download",
                action: "download",
                disabled: true,
            },
            {
                label: "Pin Playlist",
                icon: "fa-thumbtack",
                action: "pin-disabled",
                disabled: true,
            },
        ];

        /* Menu cho Playlist Card (trang Home) */
        this.homePlaylistCardMenuItems = [
            { label: "Add to Your Library", icon: "fa-plus", action: "follow" },
            {
                label: "Add to queue",
                icon: "fa-stream",
                action: "add-to-queue",
            },
            { type: "separator" },
            {
                label: "Report",
                icon: "fa-flag",
                action: "report",
                hasExternalLink: true,
            },
            {
                label: "Download",
                icon: "fa-download",
                action: "download",
                disabled: true,
            },
            {
                label: "Exclude from your taste profile",
                icon: "fa-times-circle",
                action: "exclude-taste-profile",
            },
            { type: "separator" },
            {
                label: "Add to folder",
                icon: "fa-folder",
                action: "add-to-folder",
                hasSubMenu: true,
            },
            {
                label: "Add to other playlist",
                icon: "fa-plus-circle",
                action: "add-to-other-playlist",
                hasSubMenu: true,
            },
            {
                label: "Share",
                icon: "fa-share",
                action: "share",
                hasSubMenu: true,
            },
        ];

        /* Menu cho Artist Card (trang Home) */
        this.homeArtistCardMenuItems = [
            { label: "Follow", icon: "fa-user-plus", action: "follow" },
            {
                label: "Don't play this artist",
                icon: "fa-ban",
                action: "dont-play",
            },
            {
                label: "Go to artist radio",
                icon: "fa-broadcast-tower",
                action: "radio",
            },
            { type: "separator" },
            {
                label: "Report",
                icon: "fa-flag",
                action: "report",
                hasExternalLink: true,
            },
            {
                label: "Share",
                icon: "fa-share",
                action: "share",
                hasSubMenu: true,
            },
        ];

        /* Trỏ this về object được tạo ra từ Context Menu */
        this._handleRightClick = this._handleRightClick.bind(this);
        this._handleOutsideClick = this._handleOutsideClick.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    /* Khởi tạo */
    init() {
        // Giao diện cho menuElement
        this.menuElement = document.createElement("div");
        this.menuElement.classList.add("context-menu");
        document.body.appendChild(this.menuElement);

        // Khởi tạo modal
        this.deleteModal.init();

        // Lắng nghe sự kiện ContextMenu
        document.addEventListener("contextmenu", this._handleRightClick);

        // Lắng nghe sự kiện click vào các item trong Menu Context
        this.menuElement.addEventListener(
            "click",
            this._handleMenuItemClick.bind(this)
        );
    }

    /* Xử lý khi click chuột phải */
    _handleRightClick(e) {
        // Phần tử cần click chuột phải:
        const targetItem = e.target.closest(
            ".library-item, .hit-card, .artist-card"
        );

        // Cho phép chuột phải vào Input & textContent => paste,...
        const targetNode = e.target.nodeName;
        if (
            !targetItem &&
            targetNode !== "INPUT" &&
            targetNode !== "TEXTAREA"
        ) {
            e.preventDefault();
        }

        // Nếu tìm thấy, hiển thị menu
        if (targetItem) {
            e.preventDefault();
            this.show(e, targetItem);
        } else {
            this.hide();
        }
    }

    /* Hiển thị Context Menu */
    show(e, targetItem) {
        this.currentTargetItem = targetItem;
        this.active = true;

        // Kiểm tra xem item có trong Library không? (đã follow)
        const isLibraryItem =
            this.currentTargetItem.classList.contains("library-item");
        let isFollowed = isLibraryItem;

        // Nếu không phải trong Library, kiểm tra trạng thái đã follow chưa
        if (!isLibraryItem) {
            const itemId = this.currentTargetItem.dataset.id;
            isFollowed = this.library.isItemInLibrary(itemId);
        }

        // Xác định loại card và data-type
        const dataType = targetItem.dataset.type;
        const isHitCard = targetItem.classList.contains("hit-card");
        const isArtistCard = targetItem.classList.contains("artist-card");

        let menuItems;
        // Lấy thông tin người dùng hiện tại
        const currentUser = storage.get("user");
        let isOwner = false;

        // Logic để xác định quyền sở hữu ở Library và Trang chủ
        if (dataType === "playlist") {
            if (isLibraryItem) {
                const libraryItemData = this.library.libraryItems.find(
                    (item) => item.id === targetItem.dataset.id
                );
                if (libraryItemData) {
                    isOwner =
                        currentUser &&
                        libraryItemData.user_display_name ===
                            currentUser.display_name;
                }
            } else if (isHitCard) {
                const creatorNameEl =
                    targetItem.querySelector(".hit-card-artist");
                const creatorName = creatorNameEl
                    ? creatorNameEl.textContent.trim()
                    : null;
                isOwner =
                    currentUser && creatorName === currentUser.display_name;
            }
        }

        // Logic để chọn menu cần hiển thị
        // Khu vực library
        if (isLibraryItem) {
            const isLikedSongs =
                targetItem.classList.contains("liked-songs-item");
            if (isLikedSongs) {
                menuItems = this.likedSongsMenuItems;
            } else if (dataType === "artist") {
                menuItems = this._getUpdatedMenuItems(
                    this.libraryArtistMenuItems,
                    isFollowed,
                    "artist",
                    isOwner
                );
            } else {
                menuItems = this._getUpdatedMenuItems(
                    this.libraryPlaylistMenuItems,
                    isFollowed,
                    "playlist",
                    isOwner
                );
            }
        }
        // Khu vực Playlist
        else if (isHitCard && dataType === "playlist") {
            const baseMenuItems = isOwner
                ? this.libraryPlaylistMenuItems
                : this.homePlaylistCardMenuItems;

            menuItems = this._getUpdatedMenuItems(
                baseMenuItems,
                isFollowed,
                "playlist",
                isOwner
            );
        }
        // Khu vực Artist
        else if (isArtistCard && dataType === "artist") {
            menuItems = this._getUpdatedMenuItems(
                this.homeArtistCardMenuItems,
                isFollowed,
                "artist",
                isOwner
            );
        }

        // Nếu không có menu phù hợp, ẩn đi
        if (!menuItems) {
            this.hide();
            return;
        }

        // Gỡ Transition
        this.menuElement.style.transition = "none";
        this.menuElement.classList.remove("show");

        // // Render các menu items
        this.menuElement.innerHTML = this._renderMenuItems(menuItems);

        // Vị trí chuột
        this._updatePosition(e);

        // Kích hoạt transition
        void this.menuElement.offsetHeight;
        this.menuElement.style.transition = "";
        this.menuElement.classList.add("show");

        // Đóng menu
        document.addEventListener("click", this._handleOutsideClick, {
            once: true,
        });
        document.addEventListener("keydown", this._handleKeyDown, {
            once: true,
        });
    }

    /* Đóng Context Menu */
    hide() {
        if (!this.active) return;

        this.active = false;
        this.menuElement.classList.remove("show");
        this.currentTargetItem = null; // Reset item khi đóng Menu Context
    }

    /* Đóng Menu: Click ra ngoài  */
    _handleOutsideClick(e) {
        if (!this.menuElement.contains(e.target)) {
            this.hide();
        }
    }

    /* Đóng Menu: Escape */
    _handleKeyDown(e) {
        if (e.key === "Escape") {
            this.hide();
        }
    }

    /* Vị trí chuột */
    _updatePosition(e) {
        // Lấy toạ độ của chuột
        const { clientX, clientY } = e;

        // Lấy kích thước của viewport
        const { innerWidth: viewportWidth, innerHeight: viewportHeight } =
            window;

        // Lấy kích thước của Menu
        const { offsetWidth: menuWidth, offsetHeight: menuHeight } =
            this.menuElement;

        // Lấy vị trí của Menu hiển thị
        let left = clientX;
        let top = clientY;

        // Xử lý Menu bị tràn ra ngoài
        if (left + menuWidth > viewportWidth) {
            left = viewportWidth - menuWidth - 8;
        }

        if (top + menuHeight > viewportHeight) {
            top = viewportHeight - menuHeight - 8;
        }

        // Thêm CSS
        this.menuElement.style.top = `${top}px`;
        this.menuElement.style.left = `${left}px`;
    }

    /* Cập nhật item trong Context Menu */
    _getUpdatedMenuItems(menuItems, isFollowed, type, isOwner = false) {
        let updatedItems = menuItems.map((item) => {
            if (item.action === "follow" || item.action === "unfollow") {
                // Đã follow
                if (isFollowed) {
                    return {
                        ...item,
                        label:
                            type === "artist"
                                ? "Unfollow"
                                : "Remove from Your Library",
                        icon:
                            type === "artist" ? "fa-times" : "fa-minus-circle",
                        action: "unfollow",
                        className: type === "artist" ? "action-unfollow" : "",
                    };
                }
                // Chưa follow
                else {
                    return {
                        ...item,
                        label:
                            type === "artist"
                                ? "Follow"
                                : "Add to Your Library",
                        icon: type === "artist" ? "fa-user-plus" : "fa-plus",
                        action: "follow",
                        className: "",
                    };
                }
            }
            return item;
        });

        // Lọc các item trong menu dựa trên quyền sở hữu
        if (type === "playlist") {
            if (isOwner) {
                // Nếu là chủ sở hữu, loại bỏ "Remove from Your Library"
                updatedItems = updatedItems.filter(
                    (item) => item.action !== "unfollow"
                );
            } else {
                // Nếu không phải chủ sở hữu, loại bỏ "Edit details" và "Delete"
                updatedItems = updatedItems.filter(
                    (item) =>
                        item.action !== "edit-details" &&
                        item.action !== "delete"
                );
            }
        }
        return updatedItems;
    }

    /* Render Menu */
    _renderMenuItems(items) {
        const menuList = document.createElement("ul");
        menuList.className = "context-menu-list";

        items.forEach((item) => {
            if (item.type === "separator") {
                const separator = document.createElement("hr");
                separator.className = "context-menu-separator";
                menuList.appendChild(separator);
            } else {
                const listItem = document.createElement("li");
                listItem.className = "context-menu-item";
                listItem.dataset.action = item.action;

                // Nếu có thuộc tính className
                if (item.className) listItem.classList.add(item.className);

                // Kiểm tra disabled
                if (item.disabled) listItem.classList.add("disabled");

                // Xử lý Pin/Unpin
                let finalLabel = item.label;
                if (
                    item.action === "toggle-pin" &&
                    this.currentTargetItem.classList.contains("library-item")
                ) {
                    const isPinned =
                        this.currentTargetItem.dataset.pinned === "true";
                    const itemType = this.currentTargetItem.dataset.type;

                    // Kiểm tra xem có phải Liked Songs không?
                    const isLikedSongs =
                        this.currentTargetItem.classList.contains(
                            "liked-songs-item"
                        );

                    // Hiển thị chữ
                    let typeText = isLikedSongs
                        ? "Playlist"
                        : itemType === "artist"
                        ? "artist"
                        : "playlist";

                    finalLabel = isPinned
                        ? `Unpin ${typeText}`
                        : `Pin ${typeText}`;

                    if (isPinned) listItem.classList.add("pinned");
                }

                // HTML
                listItem.innerHTML = `
                   <i class="fas ${item.icon}"></i>
                   <span>${finalLabel}</span>
                   ${
                       item.hasSubMenu
                           ? '<i class="fas fa-chevron-right sub-indicator"></i>'
                           : ""
                   }
                   ${
                       item.hasExternalLink
                           ? '<i class="fas fa-external-link-alt external-indicator"></i>'
                           : ""
                   }
                `;

                menuList.appendChild(listItem);
            }
        });

        return menuList.outerHTML;
    }

    /* Xử lý khi click vào một item trong Menu Context */
    _handleMenuItemClick(e) {
        const menuItem = e.target.closest(".context-menu-item");
        if (!menuItem || menuItem.classList.contains("disabled")) return;

        const action = menuItem.dataset.action;

        // Nếu hành động là follow - unfollow
        if (action === "follow" || action === "unfollow") {
            this._handleFollow(action);
        }
        // Nếu hành động là Pin
        else if (action === "toggle-pin") {
            document.dispatchEvent(
                // Phát sự kiện 'toggle-pin'
                new CustomEvent("library:toggle-pin", {
                    detail: { id: this.currentTargetItem.dataset.id },
                })
            );
        }

        // Nếu hành động là Xoá
        else if (action === "delete") {
            this._handleDelete();
        }

        this.hide();
    }

    /* Hành động xoá */
    _handleDelete() {
        if (!this.currentTargetItem) return;

        // Lấy ra playlist cần xoá
        const playlistId = this.currentTargetItem.dataset.id;
        const playlist = this.library.libraryItems.find(
            (p) => p.id === playlistId
        );

        if (playlist) {
            this.deleteModal.open(playlist, async (id) => {
                try {
                    await playlistService.deletePlaylist(id);
                    Toast.success("Playlist deleted");

                    // Phát sự kiện để Library cập nhật
                    document.dispatchEvent(
                        new CustomEvent("library:updated", {
                            detail: {
                                type: "playlist",
                                action: "delete",
                                data: { id },
                            },
                        })
                    );

                    // Nếu đang ở trang chi tiết thì về trang chủ
                    if (window.location.hash === `#/playlist/${id}`) {
                        router.navigate("/");
                    }

                    // Đóng modal
                    this.deleteModal.close();
                } catch (error) {
                    Toast.error("Could not delete playlist. Please try again.");
                    console.error("Delete failed:", error);
                    throw error;
                }
            });
        }
    }

    /* Hành động Follow/Unfollow */
    async _handleFollow(action) {
        // Kiểm tra nếu chưa đăng nhập thì cần đăng nhập
        if (!this.currentTargetItem) return;
        if (!storage.get("access_token")) {
            document.querySelector(".login-btn").click();
            return;
        }

        // Lấy thông tin từ DOM
        const type = this.currentTargetItem.dataset.type;
        const id = this.currentTargetItem.dataset.id;
        const name = this.currentTargetItem.querySelector(
            ".item-title, .hit-card-title, .artist-card-name"
        ).textContent;

        // Khởi tạo Payload
        const itemData = {
            id,
            name,
            image_url: this.currentTargetItem.querySelector("img")?.src,
            item_type: type,
        };

        // Lấy ra tên người tạo Playlist
        if (type === "playlist") {
            itemData.user_display_name =
                this.currentTargetItem
                    .querySelector(".item-subtitle, .hit-card-artist")
                    ?.textContent.split("•")
                    .pop()
                    .trim() || "Spotify";
        }

        try {
            // Hành động Follow
            if (action === "follow") {
                await libraryService.followItem(type, id);
                Toast.success(`Đã thêm '${name}' vào Thư viện.`);
            }
            // Còn lại là unfollow
            else {
                await libraryService.unfollowItem(type, id);
                Toast.info(`Đã xóa '${name}' khỏi Thư viện.`);
            }

            // Phát sự kiện update library
            document.dispatchEvent(
                new CustomEvent("library:updated", {
                    detail: { type, action, data: itemData },
                })
            );
        } catch (error) {
            console.error("Context menu action failed:", error);
            Toast.error("Đã có lỗi xảy ra. Vui lòng thử lại.");
        }
    }
}

export default ContextMenu;
