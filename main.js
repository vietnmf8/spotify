import Auth from "./features/auth/Auth.js";
import Tooltip from "./components/Tooltip.js";
import LibrarySorter from "./components/LibrarySorter.js";
import LibrarySearch from "./components/LibrarySearch.js";
import LibraryFilter from "./components/LibraryFilter.js";
import ContextMenu from "./components/ContextMenu.js";
import Home from "./features/home/Home.js";
import Details from "./features/details/Details.js";
import router from "./router/router.js";
import Library from "./features/library/Library.js";
import storage from "./utils/storage.js";
import playlistService from "./features/playlist/playlistService.js";
import Toast from "./components/Toast.js";
import Player from "./features/player/Player.js";
import QueuePanel from "./components/QueuePanel.js";

/**
 * Global Initializations
 */
document.addEventListener("DOMContentLoaded", function () {
    const loadingOverlay = document.getElementById("loadingOverlay");

    /* Vô hiệu hóa context menu (chuột phải) toàn trang */
    document.addEventListener("contextmenu", (e) => {
        // Chúng ta vẫn cho phép mở context menu trên các input và textarea
        const targetNode = e.target.nodeName;
        if (targetNode !== "INPUT" && targetNode !== "TEXTAREA") {
            e.preventDefault();
        }
    });

    /* Khởi tạo Tooltip */
    const tooltip = new Tooltip();
    tooltip.init();

    /* Khởi tạo Xác thực */
    const auth = new Auth(router);
    auth.init();

    /* Khởi tạo Player */
    const player = new Player();
    player.init();

    /* Khởi tạo Library */
    const library = new Library(player);
    library.init();

    /* Khởi tạo Menu Dropdown LibrarySorter */
    const librarySorter = new LibrarySorter();
    librarySorter.init();

    /* Khởi tạo Library Search */
    const librarySearch = new LibrarySearch();
    librarySearch.init();

    /* Khởi tạo Filter Playlists/Artists */
    const libraryFilter = new LibraryFilter();
    libraryFilter.init();

    /* Khởi tạo Context Menu */
    const contextMenu = new ContextMenu(library);
    contextMenu.init();

    /* Khởi tạo Queue */
    const queuePanel = new QueuePanel(player);
    queuePanel.init();

    /* Khởi tạo trang Home */
    const home = new Home(player);

    /* Khởi tạo trang chi tiết */
    const details = new Details(player);

    /* Cấu hình Router */
    router.add("/", () => {
        home.init(player);
        library.clearActiveItem(); // Xóa highlight khi về trang chủ
    });
    router.add("/playlist/liked", () => {
        details.init("playlist", "liked");
        library.setActiveItem("playlist", "liked"); // Highlight Liked Songs
    });
    router.add("/playlist/:id", (id) => {
        details.init("playlist", id);
        library.setActiveItem("playlist", id); // Highlight playlist
    });
    router.add("/artist/:id", (id) => {
        details.init("artist", id);
        library.setActiveItem("artist", id); // Highlight artist
    });

    /* Điều hướng về trang chủ 2 button Home và Logo */
    const homeBtn = document.querySelector(".home-btn");
    const logo = document.querySelector(".logo");
    homeBtn.addEventListener("click", () => router.navigate("/"));
    logo.addEventListener("click", () => router.navigate("/"));

    /**
     * User Menu Dropdown Functionality
     */

    const userAvatar = document.getElementById("userAvatar");
    const userDropdown = document.getElementById("userDropdown");
    const logoutBtn = document.getElementById("logoutBtn");

    /* Toggle dropdown when clicking avatar */
    userAvatar.addEventListener("click", function (e) {
        e.stopPropagation();
        userDropdown.classList.toggle("show");
    });

    /* Close dropdown when clicking outside */
    document.addEventListener("click", function (e) {
        if (
            !userAvatar.contains(e.target) &&
            !userDropdown.contains(e.target)
        ) {
            userDropdown.classList.remove("show");
        }
    });

    /* Close dropdown when pressing Escape */
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && userDropdown.classList.contains("show")) {
            userDropdown.classList.remove("show");
        }
    });

    /* Handle logout button click */
    logoutBtn.addEventListener("click", function () {
        // Close dropdown first
        userDropdown.classList.remove("show");

        auth.logout();
    });

    /* Hiển thị lại các phần nội dung chính sau khi mọi thứ đã sẵn sàng */
    const contentWrapper = document.querySelector(".content-wrapper");

    // Lắng nghe sự kiện animation kết thúc trên vùng nội dung chính
    contentWrapper.addEventListener(
        "animationend",
        () => {
            if (loadingOverlay) {
                loadingOverlay.classList.add("hidden");
            }
        },
        { once: true }
    );

    /**
     * Xử lý chức năng tạo Playlist
     */
    // Lấy nút Create
    const createBtn = document.querySelector(".create-btn");
    createBtn.addEventListener("click", async () => {
        // Kiểm tra đăng nhập
        if (!storage.get("access_token")) {
            const loginBtn = document.querySelector(".main-header .login-btn");
            if (loginBtn) loginBtn.click();
            return;
        }

        try {
            // Lấy playlist từ API
            const { playlist } = await playlistService.createPlaylist();

            // Thông báo thành công
            Toast.success("Playlist created successfully.");

            // Phát sự kiện để Library cập nhật
            document.dispatchEvent(
                new CustomEvent("library:updated", {
                    detail: {
                        type: "playlist",
                        action: "create",
                        data: playlist,
                    },
                })
            );

            // Chuyển hướng đến trang chi tiết của playlist mới
            router.navigate(`/playlist/${playlist.id}`);
        } catch (error) {
            console.error("Không thể tạo playlist:", error);
            Toast.error("Error: Could not create playlist. Please try again.");
        }
    });
});
