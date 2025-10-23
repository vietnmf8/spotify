/**
 * Quản lý chức năng tìm kiếm trong "Your Library" (sidebar).
 *  - Lọc danh sách item và highlight  các từ khoá trùng khớp
 *
 * - Case:
 *  1. Click icon tìm kiếm: Chuyển sang "chế độ tìm kiếm" (ẩn nút Sort, hiện input).
 *  2. Gõ vào input: Lọc danh sách item (ẩn/hiện) và tô sáng (`<mark>`) từ khóa.
 *  3. Click nút "X": Xóa nội dung input và reset danh sách (vẫn ở chế độ tìm kiếm).
 *  4. Nhấn Escape / Click nút Sort: Thoát chế độ tìm kiếm, reset danh sách.
 *  5. Hiển thị thông báo nếu không tìm thấy kết quả..
 */

class LibrarySearch {
    constructor() {
        /* Get DOM Element */
        this.searchLibrary = document.getElementById("searchLibrary");
        this.searchBtn = document.getElementById("searchLibraryBtn");
        this.searchInput = document.getElementById("searchLibraryInput");
        this.clearBtn = document.getElementById("searchLibraryClearBtn");
        this.sortBtn = document.getElementById("sortBtn");
        this.libraryContent = document.getElementById("libraryContent");

        // Mảng chứa danh sách các DOM element `.library-item` để tìm kiếm.
        this.libraryItems = [];

        // `div` bao bọc input và các nút icon.
        this.inputWrapper = this.searchLibrary.querySelector(
            ".search-library-input-wrapper"
        );

        /* Khởi tạo mảng library-items */
        /*
            Giải thích Map():
                Đầu vào: Một danh sách cha (mảng). Trong mảng cha lại chứa những mảng con. Mỗi mảng con có 2 phần tử là một cặp key-value
                    - Phần tử thứ nhất: key
                    - Phần tử thứ hai : value

                VD:
                const obj = new Map([
                    [123, "Nguyen Van A"],
                    ["123", "Nguyen Van B"],
                    [field1, "Something 1"],
                    [field2, "Something 2"],
                ]);
        */

        // Mảng lưu trữ HTML *gốc*  của title và subtitle cho mỗi library item.
        // 1. Để reset item về trạng thái gốc khi xóa tìm kiếm.
        // 2. Để tránh việc highlight chồng lên highlight cũ.
        // 3. Để xử lý icon (vd: <i>) trong khi highlight.
        this.originalItemContents = new Map();

        // Lưu trữ DOM element của thông báo "Không tìm thấy" (nếu có).
        // Gỡ bỏ nó khỏi DOM khi thực hiện tìm kiếm mới.
        this.noResultsMessage = null;
    }

    /* Khởi tạo */
    init() {
        // Kiểm tra sự tồn tại của component và gắn các trình lắng nghe sự kiện.
        if (!this.searchLibrary) return;
        this.addEventListeners();
    }

    /* Cập nhật danh sách các item trong library:
        - Cập nhật danh sách item (`this.libraryItems`)
        - cache lại HTML gốc  vào `this.originalItemContents`.
        - Được gọi khi thư viện render lần đầu tiên hoặc khi có cập nhật (thêm/xóa).
    */
    updateItems() {
        // Lấy danh sách item mới nhất từ DOM.
        this.libraryItems =
            this.libraryContent.querySelectorAll(".library-item");
        this.originalItemContents.clear();

        // Lặp qua từng item và lưu trữ HTML gốc của title/subtitle.
        this.libraryItems.forEach((item) => {
            const title = item.querySelector(".item-title");
            const subtitle = item.querySelector(".item-subtitle");
            this.originalItemContents.set(item, {
                title: title ? title.innerHTML : "",
                subtitle: subtitle ? subtitle.innerHTML : "",
            });
        });
    }

    /* Gán sự kiện chung */
    addEventListeners() {
        // Click icon tìm kiếm -> Vào chế độ search.
        this.searchBtn.addEventListener(
            "click",
            this.enterSearchMode.bind(this)
        );

        // Gõ phím trong ô input -> Thực hiện tìm kiếm.
        this.searchInput.addEventListener(
            "input",
            this.handleSearch.bind(this)
        );

        // Click nút "Sort" (Recents) -> Thoát chế độ search.
        this.sortBtn.addEventListener("click", this.exitSearchMode.bind(this));

        // Click nút "X" -> Xóa nội dung input.
        this.clearBtn.addEventListener("click", this.clearSearch.bind(this));

        // Click ra ngoài (blur) khi input rỗng -> Thoát chế độ search.
        this.searchInput.addEventListener("blur", () => {
            if (!this.searchInput.value) {
                this.exitSearchMode();
            }
        });

        // Nhấn phím "Escape" -> Thoát chế độ search.
        document.addEventListener("keydown", (e) => {
            if (
                e.key === "Escape" &&
                this.searchLibrary.classList.contains("search-active")
            ) {
                this.exitSearchMode();
            }
        });

        /* Lắng nghe sự kiện từ Library để cập nhật danh sách item. */
        // Cập nhật danh sách item DOM khi Library tải lần đầu tiên
        document.addEventListener(
            "library:rendered",
            this.updateItems.bind(this)
        );
        // Cập nhật danh sách item DOM khi Library được cập nhật
        document.addEventListener(
            "library:updated",
            this.updateItems.bind(this)
        );
    }

    /* Kích hoạt "chế độ tìm kiếm"
        - Thay đổi UI và focus vào ô input
    */
    enterSearchMode(e) {
        // Ngăn chặn 'click' khi ở chế độ tìm kiếm
        if (this.searchLibrary.classList.contains("search-active")) {
            e.stopPropagation();
            return;
        }

        // Hiển thị ô input và tự động focus
        this.searchLibrary.classList.add("search-active");
        this.searchInput.focus(); // Tự động focus
    }

    /* Thoát chế độ tìm kiếm */
    exitSearchMode() {
        // Chỉ chạy nếu đang ở chế độ tìm kiếm
        if (!this.searchLibrary.classList.contains("search-active")) return;

        // Xoá nội dung tìm kiếm
        this.searchInput.value = "";

        // Reset lại highlight và hiển thị tất cả item.
        this.handleSearch();
        this.searchLibrary.classList.remove("search-active");
    }

    /* Xoá nội dung tìm kiếm */
    clearSearch() {
        this.searchInput.value = "";
        this.handleSearch(); // Reset danh sách và highlight
        this.searchInput.focus(); // Focus lại vào input
    }

    /* Xử lý logic tìm kiếm và hiển thị */
    handleSearch() {
        // Lấy giá trị được nhập
        const searchTerm = this.searchInput.value;

        // Lấy giá trị đã trim() để tìm kiếm
        const trimmedSearchTerm = searchTerm.trim().toLowerCase();

        // Cờ để theo dõi xem có kết quả nào không
        let hasResults = false;

        /* Cập nhật UI cho Input */
        // Kiểm tra xem input có text hay không
        const hasText = searchTerm.length > 0;

        // Hiển thị/ẩn nút "X" (clearBtn) dựa trên `hasText`
        this.clearBtn.classList.toggle("show", hasText);
        this.inputWrapper.classList.toggle("has-text", hasText);

        /* Lọc và Highlight */
        this.libraryItems.forEach((item) => {
            // Lấy HTML gốc
            const originalContent = this.originalItemContents.get(item);
            if (!originalContent) return;

            const titleEl = item.querySelector(".item-title");
            const subtitleEl = item.querySelector(".item-subtitle");

            // Reset lại nội dung trước khi tìm kiếm
            if (titleEl) titleEl.innerHTML = originalContent.title;
            if (subtitleEl) subtitleEl.innerHTML = originalContent.subtitle;

            // Lấy toàn bộ text từ trong library-item
            const titleText = titleEl ? titleEl.textContent.toLowerCase() : "";
            const subtitleText = subtitleEl
                ? subtitleEl.textContent.toLowerCase()
                : "";
            const fullText = `${titleText} ${subtitleText}`;

            /* Xử lý hiển thị item  */
            // Nếu có từ khóa & text của item chứa từ khóa đó:
            if (trimmedSearchTerm && fullText.includes(trimmedSearchTerm)) {
                item.style.display = ""; // Hiển thị item
                hasResults = true; // Đánh dấu là có kết quả.

                // Gọi hàm để bọc từ khóa trong <mark>.
                this.highlightText(titleEl, trimmedSearchTerm);
                this.highlightText(subtitleEl, trimmedSearchTerm);
            }

            // Nếu không có từ khóa (ô search rỗng):
            else if (!trimmedSearchTerm) {
                item.style.display = "";  // Hiển thị tất cả item
                hasResults = true; // Có kết quả: Rỗng!
            }
            
            // Nếu có từ khóa NHƯNG item không khớp:
            else {
                item.style.display = "none"; // Ẩn item không khớp
            }
        });

        // Hiển thị thông báo nếu không tìm thấy kết quả
        this.toggleNoResultsMessage(!hasResults, trimmedSearchTerm);
    }

    /* Highlight từ khoá khớp */
    highlightText(element, searchTerm) {
        if (!element || !searchTerm) return;

        // Kiểm tra thẻ có class 'item.title' hoặc 'item-subtitle'
        const originalHTML = this.originalItemContents.get(
            element.closest(".library-item")
        )[element.classList.contains("item-title") ? "title" : "subtitle"];

        // Highlight từ khoá
        const regex = new RegExp(`(${searchTerm})`, "gi");
        element.innerHTML = originalHTML.replace(regex, `<mark>$1</mark>`);

        // Tạo một div tạm để xử lý khi có icon trong khi search
        // tempDiv: Lưu chuỗi gốc
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = originalHTML;

        // Tách icon ra khỏi chuỗi
        const icon = tempDiv.querySelector("i");
        let iconHTML = "";
        if (icon) {
            iconHTML = icon.outerHTML;
            icon.remove(); // Xóa icon khỏi div tạm
        }

        // Lấy phần text còn lại và highlight
        const textContent = tempDiv.innerHTML;
        const highlightedText = textContent.replace(regex, `<mark>$1</mark>`);

        // Gộp lại và gán vào element
        element.innerHTML = iconHTML + highlightedText;
    }

    /* Ẩn/hiện thông báo không tìm thấy kết quả */
    toggleNoResultsMessage(show, searchTerm) {
        // Luôn gỡ bỏ thông báo cũ (nếu có)
        if (this.noResultsMessage) {
            this.noResultsMessage.remove(); // Gỡ khỏi DOM
            this.noResultsMessage = null; // Reset thuộc tính.
        }

        // Nếu `show` là true và `searchTerm` không rỗng -> Tạo thông báo mới.
        if (show && searchTerm) {
            this.noResultsMessage = document.createElement("div");
            this.noResultsMessage.className = "no-results-message";
            this.noResultsMessage.innerHTML = `Không tìm thấy: "<strong>${searchTerm}</strong>".`;
            this.libraryContent.appendChild(this.noResultsMessage);
        }
    }
}

export default LibrarySearch;
