class LibraryFilter {
    constructor() {
        // Lưu trạng thái vào localStorage
        this.FILTER_KEY = "library_active_filter";

        // Get DOM Element
        this.filterContainer = document.querySelector(".library-filters");
        if (!this.filterContainer) return;

        this.navTabs = this.filterContainer.querySelector(".nav-tabs");
        this.filterButtons = this.navTabs.querySelectorAll(".nav-tab");
        this.clearFilterBtn = this.filterContainer.querySelector(
            ".library-clear-filter-btn"
        );
        this.libraryContent = document.getElementById("libraryContent");
    }

    /* Khởi tạo */
    init() {
        if (!this.filterContainer) return;
        this.addEventListeners();
        this.loadSavedFilter();
    }

    /* Lắng nghe sự kiện chung */
    addEventListeners() {
        // Click: 2 nút Playlists hoặc Artists
        this.navTabs.addEventListener("click", (e) => {
            const clickedButton = e.target.closest(".nav-tab");
            if (clickedButton) {
                this.handleFilterClick(clickedButton);
            }
        });

        // Click: nút Clear
        this.clearFilterBtn.addEventListener("click", () => {
            this.clearFilter();
        });
    }

    /* Lấy Item ngoại trừ Liked Songs */
    getNotLikedSongsItem() {
        return this.libraryContent.querySelectorAll(
            ".library-item:not(.liked-songs-item)"
        );
    }

    /* Áp dụng bộ lọc cho danh sách */
    applyFilter(filterType) {
        // Cập nhật trạng thái active/hidden cho các nút filter
        this.filterButtons.forEach((btn) => {
            const isCurrentButton = btn.dataset.filter === filterType;
            btn.classList.toggle("active", isCurrentButton);

            // Ẩn nút không được chọn
            btn.classList.toggle("filter-hidden", !isCurrentButton);
        });

        // Hiện thị nút Clear
        this.clearFilterBtn.classList.add("show");

        // Lọc danh sách
        const singularFilterType = filterType.slice(0, -1); // Playlists -> playlist (lấy dạng số ít để so sánh)
        this.getNotLikedSongsItem().forEach((item) => {
            const itemType = item.dataset.type;
            const matchesFilter = itemType === singularFilterType;
            item.classList.toggle("hidden", !matchesFilter);
        });

        // Lưu lựa chọn vào localStorage
        localStorage.setItem(this.FILTER_KEY, filterType);
    }

    /* Xoá bộ lọc */
    clearFilter() {
        // Ẩn nút Clear, hiện lại 2 bộ lọc
        this.clearFilterBtn.classList.remove("show");
        this.filterButtons.forEach((btn) => {
            btn.classList.remove("active");
            btn.classList.remove("filter-hidden");
        });

        // Hiện lại tất cả item trong danh sách
        this.getNotLikedSongsItem().forEach((item) => {
            item.classList.remove("hidden");
        });

        // Xoá lựa chọn khỏi localStorage
        localStorage.removeItem(this.FILTER_KEY);
    }

    /* Click: vào nút Playlists/Artists */
    handleFilterClick(button) {
        const filterType = button.dataset.filter;
        console.log(filterType);
        const isActive = button.classList.contains("active");

        if (isActive) {
            // Nếu nút đang active, click sẽ xoá filter
            this.clearFilter();
        } else {
            // Nếu chưa active, click sẽ áp dụng filter mới
            this.applyFilter(filterType);
        }
    }

    /* Cập nhật giao diện sau khi lọc ngay khi tải trang */
    loadSavedFilter() {
        const savedFilter = localStorage.getItem(this.FILTER_KEY);
        if (savedFilter) {
            this.applyFilter(savedFilter);
        }
    }
}

export default LibraryFilter;
