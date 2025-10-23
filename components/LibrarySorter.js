import activityTracker from "../utils/activityTracker.js";
import storage from "../utils/storage.js";

/**
 * - Quản lý Menu Dropdown:
 *      - Sort by
 *      - View as
 * - Sắp xếp lại DOM của các `library item`
 * - Case:
 *      1. Mở/đóng menu khi nhấn nút "Recents". Đóng khi nhấn Escape hoặc click ra ngoài.
 *      2.  "Sort by": Sắp xếp lại các item (trừ item đã ghim):
 *          + Recents: Bài hát được phát gần đây nhất
 *          + Recently added: Bài hát được thêm gần đây nhất
 *          + Alphabetical: Bảng chữ cái
 *          + Creator: Tên người tạo
 *      3. "View as": Thay đổi CSS class trên container `.library-content` để hiển thị dạng list hoặc grid.
 *      4. Tự động sắp xếp lại khi library có thay đổi (thêm/xóa/pin)
 *      5. Lưu lựa chọn Sort và View vào localStorage và tự động áp dụng khi tải lại trang
 */

class LibrarySorter {
    constructor() {
        /* Lấy các phần tử thuộc nhóm Menu Dropdown */
        this.sortBtn = document.getElementById("sortBtn");
        this.librarySortMenu = document.getElementById("librarySortMenu");
        this.sortOptions = document.getElementById("sortOptions");
        this.viewOptions = document.getElementById("viewOptions");
        this.libraryContent = document.getElementById("libraryContent");
        this.viewSlider = document.getElementById("viewSlider");
        this.sortBtnText = this.sortBtn.querySelector(".sort-btn-text");

        /* Các biến lưu Sort by & View as */
        this.SORT_KEY = "library_sort_by"; // Lưu lựa chọn Sort By vào localStorage
        this.VIEW_KEY = "library_view_as"; // Lưu lựa chọn View as vào localStorage

        /* Giá trị mặc định */
        this.DEFAULT_SORT = "recents";
        this.DEFAULT_VIEW = "default-list";

        /* Lưu mảng DOM Element `.library-item` ban đầu khi Library đã render
            => Làm cơ sở để sắp xếp cho Recently Added
        */
        this.domOrderItems = [];

        /* Lưu trữ dữ liệu từ `activityTracker`.
            => Dùng để sắp xếp cho "Recents"
        */
        this.activityData = {};

        /* Lấy mảng ID thứ tự tạo playlist từ localStorage */
        this.CREATE_ORDER_KEY = "library_create_order";

        /* Mảng lấy riêng các ID playlist theo thứ tự được tạo
             => Làm cơ sở để sắp xếp cho Recently Added
        */
        this.createOrderIds = [];
    }

    /* Khởi tạo */
    init() {
        if (!this.sortBtn) return;
        this.addEventListeners();
    }

    /* Trạng thái ban đầu khi library render */
    initialSetup() {
        // Cập nhật mảng `domOrderItems`
        this.refreshDomOrder();

        // Lấy dữ liệu timestamp hoạt động mới nhất.
        this.activityData = activityTracker.getActivityData();

        // Lấy mảng ID theo thứ tự tạo Playlist
        this.createOrderIds = storage.get(this.CREATE_ORDER_KEY) || [];

        // Áp dụng các bộ lọc từ localStorage
        this.loadSettings();
    }

    /* Làm mới thuộc tính `domOrderItems` = Đọc lại DOM 
        - Chỉ lấy các item không phải "Liked Songs".
    */
    refreshDomOrder() {
        this.domOrderItems = Array.from(
            this.libraryContent.querySelectorAll(
                ".library-item:not(.liked-songs-item)"
            )
        );
    }

    /* Áp dụng các setting bộ lọc */
    loadSettings() {
        // Lấy ra tên của lựa chọn khi chọn trong Sort by và View As
        const savedSort =
            localStorage.getItem(this.SORT_KEY) || this.DEFAULT_SORT;
        const savedView =
            localStorage.getItem(this.VIEW_KEY) || this.DEFAULT_VIEW;

        // Áp dụng bộ lọc
        this.applyView(savedView);
        this.applySort(savedSort);
    }

    /* Gán tất cả trình lắng nghe sự kiện */
    addEventListeners() {
        // Mở/đóng menu khi nhấn nút Sort
        this.sortBtn.addEventListener("click", this.toggleMenu.bind(this));

        // Khi click chọn 1 option trong Sort by
        this.sortOptions.addEventListener(
            "click",
            this.handleSortClick.bind(this)
        );

        // Khi click chọn 1 option trong View as
        this.viewOptions.addEventListener(
            "click",
            this.handleViewClick.bind(this)
        );

        // Đóng menu khi nhấn Escape
        document.addEventListener("keydown", this.handleEscKey.bind(this));

        // Đóng menu khi click ra ngoài
        document.addEventListener("click", this.handleClickOutside.bind(this));

        /* Lắng nghe sự kiện khi Library Render xong LẦN ĐẦU */
        document.addEventListener(
            "library:rendered",
            () => this.initialSetup(),
            { once: true } // Chạy 1 lần duy nhất
        );

        /* Lắng nghe sự kiện sắp xếp lại danh sách */
        // "library:updated": Khi thêm/xóa/pin/unpin item.
        document.addEventListener("library:updated", this.resort.bind(this));

        // "library:rerendered": Khi Library render lại.
        document.addEventListener("library:rerendered", this.resort.bind(this));

        // "player:state-change": Khi player phát nhạc (cần cập nhật "Recents").
        document.addEventListener(
            "player:state-change",
            this.resort.bind(this)
        );
    }

    /* Sắp xếp lại danh sách item */
    resort() {
        // Lấy thứ tự DOM mới nhất
        this.refreshDomOrder();

        // Lấy dữ liệu "Recents" mới nhất.
        this.activityData = activityTracker.getActivityData();

        // Lấy mảng ID thứ tự tạo playlist mới nhất.
        this.createOrderIds = storage.get(this.CREATE_ORDER_KEY) || [];

        // Lấy kiểu sort đang được áp dụng.
        const currentSort =
            localStorage.getItem(this.SORT_KEY) || this.DEFAULT_SORT;

        // Áp dụng lại kiểu sort đó với dữ liệu mới.
        this.applySort(currentSort);
    }

    /**
     * Mở/đóng Menu
     */

    /* Bật/tắt Menu thủ công */
    toggleMenu(e) {
        e.stopPropagation(); // Ngăn sự kiện nổi bọt
        const isShown = this.librarySortMenu.classList.toggle("show");
        this.sortBtn.classList.toggle("active", isShown);
    }

    /* Đóng Menu */
    closeMenu() {
        this.librarySortMenu.classList.remove("show");
        this.sortBtn.classList.remove("active");
    }

    /* Đóng Menu với phím Escape */
    handleEscKey(e) {
        if (
            e.key === "Escape" &&
            this.librarySortMenu.classList.contains("show")
        ) {
            this.closeMenu();
        }
    }

    /* Click ra ngoài => Đóng Menu */
    handleClickOutside(e) {
        if (
            !this.sortBtn.contains(e.target) &&
            !this.librarySortMenu.contains(e.target)
        ) {
            this.closeMenu();
        }
    }

    /**
     * Áp dụng trạng thái sắp xếp
     */

    /* Sort by */
    applySort(sortValue) {
        // Cập nhật text trên nút bấm
        this.sortBtnText.textContent = sortValue.replace("-", " ");

        // Xóa class 'selected' khỏi tất cả các tùy chọn
        this.sortOptions.querySelectorAll(".sort-option").forEach((opt) => {
            opt.classList.remove("selected");
        });

        // Thêm class 'selected' cho tùy chọn hiện tại.
        const selectedOption = this.sortOptions.querySelector(
            `[data-sort="${sortValue}"]`
        );
        if (selectedOption) {
            selectedOption.classList.add("selected");
        }

        // Gọi hàm sắp xếp lại các item trong DOM.
        this.sortLibraryItems(sortValue);
    }

    /* Cập nhật giao diện sau khi Sort:
        - Tách item đã ghim (pinned) và chưa ghim (unpinned).
        - Chỉ sắp xếp nhóm "unpinned" theo `sortValue`.
        - Nhóm "pinned" luôn ở trên cùng và giữ nguyên thứ tự ghim.
    */
    sortLibraryItems(sortValue) {
        // Cập nhật lại dữ liệu mới nhất cho "Recent"
        this.activityData = activityTracker.getActivityData();

        // Lấy tất cả item (trừ "Liked Songs").
        const allItems = Array.from(
            this.libraryContent.querySelectorAll(
                ".library-item:not(.liked-songs-item)"
            )
        );

        // Chia thành mảng item Pin
        const pinnedItems = allItems.filter(
            (item) => item.dataset.pinned === "true"
        );

        // Chia ra mảng item Unpin
        const unpinnedItems = allItems.filter(
            (item) => item.dataset.pinned === "false"
        );

        // Hàm sắp xếp chung
        const sortFunction = (a, b) => {
            // Lấy text title và subtitle của 2 item
            const titleA = a
                .querySelector(".item-title")
                .textContent.trim()
                .toLowerCase();
            const titleB = b
                .querySelector(".item-title")
                .textContent.trim()
                .toLowerCase();
            const subtitleA = a
                .querySelector(".item-subtitle")
                .textContent.trim()
                .toLowerCase();
            const subtitleB = b
                .querySelector(".item-subtitle")
                .textContent.trim()
                .toLowerCase();

            switch (sortValue) {
                case "recents":
                    // Sắp xếp "Mới phát"
                    // Lấy timestamp từ `activityData`, nếu không có (chưa phát) thì là 0.
                    const timestampA = this.activityData[a.dataset.id] || 0;
                    const timestampB = this.activityData[b.dataset.id] || 0;

                    // Nếu timestamp khác nhau -> Sắp xếp giảm dần (mới nhất lên đầu)
                    if (timestampB !== timestampA) {
                        return timestampB - timestampA;
                    }

                    // Nếu timestamp bằng nhau (cùng là 0) -> Dùng "Recently Added" làm tiêu chí phụ
                    const indexA = this.createOrderIds.indexOf(a.dataset.id);
                    const indexB = this.createOrderIds.indexOf(b.dataset.id);

                    if (indexA !== -1 && indexB !== -1) {
                        return indexA - indexB; // Cả 2 đều có, so sánh index (nhỏ = mới hơn)
                    }
                    if (indexA !== -1) return -1; // Chỉ A có -> A lên trước
                    if (indexB !== -1) return 1; // Chỉ B có -> B lên trước

                    // Nếu không có trong cả 2 danh sách
                    return (
                        this.domOrderItems.indexOf(a) -
                        this.domOrderItems.indexOf(b)
                    );

                case "alphabetical":
                    // // Sắp xếp theo tên (A-Z).
                    /* Giải thích: Hàm sort(): VD:
                        localeCompare: Phương thức so sánh, sắp xếp 'chuỗi':
                            "A".localeCompare("B")  // -1 (A < B)
                            "B".localeCompare("A")  //  1 (B > A)
                            "A".localeCompare("A")  //  0 (A == A) 

                            < 0: a đứng trước b
                            > 0: a đứng sau B
                              0: giữ nguyên vị trí
                    */
                    return titleA.localeCompare(titleB);

                case "creator":
                    // Sắp xếp theo tên Creator.
                    // Tách subtitle "Playlist • User Name" -> "User Name".
                    // "zzz" là giá trị dự phòng để item không có creator bị đẩy xuống cuối.
                    const creatorA = subtitleA.split("•")[1]?.trim() || "zzz";
                    const creatorB = subtitleB.split("•")[1]?.trim() || "zzz";
                    return creatorA.localeCompare(creatorB);

                case "recently-added":
                default:
                    // Sắp xếp "Mới thêm"
                    // Lấy index của item trong mảng `createOrderIds`.
                    const indexA_added = this.createOrderIds.indexOf(
                        a.dataset.id
                    );
                    const indexB_added = this.createOrderIds.indexOf(
                        b.dataset.id
                    );

                    // Cả hai đều là playlist do người dùng tạo (có trong mảng)
                    if (indexA_added !== -1 && indexB_added !== -1) {
                        return indexA_added - indexB_added; // So sánh theo thứ tự mảng (index nhỏ = mới hơn)
                    }
                    // Chỉ A là playlist mới tạo
                    if (indexA_added !== -1) return -1; // A lên trước
                    // Chỉ B là playlist mới tạo
                    if (indexB_added !== -1) return 1; // B lên trước

                    // Cả hai đều không có trong mảng (ví dụ: artist, playlist follow)
                    // Giữ thứ tự DOM
                    return (
                        this.domOrderItems.indexOf(a) -
                        this.domOrderItems.indexOf(b)
                    );
            }
        };

        // Chỉ sắp xếp nhóm CHƯA GHIM.
        const sortedUnpinnedItems = [...unpinnedItems].sort(sortFunction);

        // Gỡ tất cả item (trừ Liked Songs) khỏi DOM.
        allItems.forEach((item) => item.remove());

        // Thêm lại theo đúng thứ tự: Pinned (giữ nguyên) -> Sorted Unpinned.
        pinnedItems.forEach((item) => {
            this.libraryContent.appendChild(item);
        });
        sortedUnpinnedItems.forEach((item) => {
            this.libraryContent.appendChild(item);
        });
    }

    /* View as */
    applyView(viewValue) {
        // Reset tất cả class view cũ
        this.libraryContent.className = "library-content";
        // Thêm class view mới
        this.libraryContent.classList.add(`view-${viewValue}`);

        // Xóa class 'active' khỏi tất cả các nút view
        this.viewOptions.querySelectorAll(".view-btn").forEach((btn) => {
            btn.classList.remove("active");
        });

        // Thêm class 'active' cho nút được chọn
        const selectedBtn = this.viewOptions.querySelector(
            `[data-view="${viewValue}"]`
        );
        if (selectedBtn) {
            selectedBtn.classList.add("active");
            this.updateViewSlider(selectedBtn); // Cập nhật vị trí thanh trượt
        }
    }

    /**
     * Logic
     */

    /* Khi chọn một tuỳ chọn Sort by */
    handleSortClick(e) {
        // Tìm `<li>` cha gần nhất
        const target = e.target.closest(".sort-option");
        if (!target) return;

        // Lấy giá trị sort từ `data-sort`
        const newSort = target.dataset.sort;

        // Lưu vào localStorage
        localStorage.setItem(this.SORT_KEY, newSort);

        // Áp dụng kiểu sort mới.
        this.applySort(newSort);

        // Đóng menu
        this.closeMenu();
    }

    /* Khi chọn một tuỳ chọn View as */
    handleViewClick(e) {
        // Tìm `<button>` cha gần nhất.
        const target = e.target.closest(".view-btn");
        if (!target) return;

        // Lấy giá trị view
        const newView = target.dataset.view;

        // Lưu vào localStorage
        localStorage.setItem(this.VIEW_KEY, newView);

        // Áp dụng kiểu view mới
        this.applyView(newView);
    }

    /* Cập nhật vị trí và kích thước của thanh trượt */
    updateViewSlider(targetButton) {
        // Lấy vị trí của nút (target) và container (viewOptions).
        const targetRect = targetButton.getBoundingClientRect();
        const containerRect = this.viewOptions.getBoundingClientRect();

        // Tính toán kích thước và vị trí tương đối.
        const width = targetRect.width;
        const left = targetRect.left - containerRect.left;

        // Cập nhật CSS
        this.viewSlider.style.width = `${width}px`;
        this.viewSlider.style.transform = `translateX(${left}px)`;
    }
}

export default LibrarySorter;
