/**
 * Hiển thị & định vị các chú thích:
 * - Lắng nghe sự kiện trên document.body
 * - Xử lý tất cả các phần tử có thuộc tính [data-tooltip]
 * - Case:
 *      + Khi di chuột vào phần tử có [data-tooltip]: Tooltip xuất hiện sau 300ms.
 *      + Khi di chuột vào `.library-item`: Tooltip xuất hiện sau 700ms (độ trễ dài hơn).
 *      + Khi di chuột ra khỏi phần tử: Tooltip ẩn ngay lập tức.
 *      + Vị trí: Tooltip ưu tiên hiển thị bên trên. Nếu không đủ không gian,
 *      nó sẽ tự động lật xuống dưới và căn chỉnh ngang để không bị tràn viewport.
 */

class Tooltip {
    // Độ trễ khi hiển thị Tooltip với các phần tử thông thường
    static DEFAULT_SHOW_DELAY = 300;

    // Độ trễ khi hiển thị Tooltip với các phần tử `.library-item`
    // Mục tiêu:  Tránh tooltip vô tình kích hoạt khi người dùng lướt chuột nhanh qua danh sách.
    static LIBRARY_ITEM_DELAY = 700;

    // Khoản cách (px) giữa tooltip và phần tử mục tiêu (target element)
    static OFFSET = 8;

    constructor() {
        /* Tạo phần tử Tooltip */
        this.tooltipElement = document.createElement("div");
        this.tooltipElement.classList.add("tooltip");
        document.body.appendChild(this.tooltipElement);

        //Lưu trữ ID của `setTimeout` -> quản lý độ trễ hiển thị:
        // -> Giúp có thể `clearTimeout` nếu di chuột ra ngoài
        this.showTimeout = null;
    }

    /* Khởi tạo Tooltip */
    init() {
        // Xử lý khi di chuột `vào` bất kỳ phần tử nào trên trang
        document.body.addEventListener(
            "mouseover",
            this.handleMouseOver.bind(this)
        );

        // Xử lý khi di chuột `ra` bất kỳ phần tử nào trên trang
        document.body.addEventListener(
            "mouseout",
            this.handleMouseOut.bind(this)
        );
    }

    /* Khi di chuột vào phần tử */
    handleMouseOver(e) {
        // Tìm phần tử cha gần nhất có [data-tooltip]
        const target = e.target.closest("[data-tooltip]");
        if (!target) return; // Nếu không có -> thoát hàm

        // Huỷ bỏ độ trễ cũ -> Ngăn hiển thị Tooltip cũ
        clearTimeout(this.showTimeout);

        // Kiểm tra xem mục tiêu có phải là một item thư viện không.
        const isLibraryItem = target.closest(".library-item");

        // Xác định độ trễ dựa trên loại phần tử
        const delay = isLibraryItem
            ? Tooltip.LIBRARY_ITEM_DELAY
            : Tooltip.DEFAULT_SHOW_DELAY;

        // Đặt độ trễ mới & hiển thị Tooltip
        this.showTimeout = setTimeout(() => {
            this.show(target);
        }, delay);
    }

    /* Khi chuột rời đi khỏi phần tử */
    handleMouseOut() {
        // Huỷ bỏ độ trễ và ẩn Tooltip ngay lập tức
        clearTimeout(this.showTimeout);
        this.hide();
    }

    /* Hiển thị Tooltip */
    show(target) {
        // Lấy nội dung text từ thuộc tính `data-tooltip`
        const text = target.getAttribute("data-tooltip");
        if (!text) return;

        // Cập nhật nội dung  cho Tooltip
        this.tooltipElement.textContent = text;

        // Tính toán và cập nhật vị trí (top, left) cho Tooltip.
        this.updatePosition(target);

        // Thêm '.active' để hiển thị Tooltip
        this.tooltipElement.classList.add("active");
    }

    /* Ẩn Tooltip */
    hide() {
        // Gỡ `.active' để ẩn Tooltip
        this.tooltipElement.classList.remove("active");
    }

    /* Cập nhật vị trí của Tooltip
        - Tính toán và cập nhật vị trí (top, left)
        - Hiển thị đúng vị trí và không bị tràn ra ngoài viewport.
    */
    updatePosition(target) {
        // Lấy thông tin vị trí (coordinates) và kích thước của phần tử mục tiêu.
        const targetRect = target.getBoundingClientRect();

        // Lấy thông tin kích thước của chính tooltip element.
        const tooltipRect = this.tooltipElement.getBoundingClientRect();

        // Lấy kích thước của cửa sổ trình duyệt (viewport).
        const { innerWidth: viewportWidth, innerHeight: viewportHeight } =
            window;

        // Lấy toạ độ để hiển thị cho Tooltip
        let top, left;

        // Mặc định: Hiển thị bên trên, căn giữa
        top = targetRect.top - tooltipRect.height - Tooltip.OFFSET;
        left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;

        // Nếu bị tràn lên cạnh trên của màn hình
        if (top < 0) {
            top = targetRect.bottom + Tooltip.OFFSET;
        }

        // Nếu bị tràn sang cạnh trái màn hình
        if (left < 0) {
            left = Tooltip.OFFSET;
        }

        // Nếu bị tràn sang cạnh phải màn hình
        else if (left + tooltipRect.width > viewportWidth) {
            left = viewportWidth - tooltipRect.width - Tooltip.OFFSET;
        }

        // Thêm CSS
        this.tooltipElement.style.top = `${top}px`;
        this.tooltipElement.style.left = `${left}px`;
    }
}

export default Tooltip;
