class Router {
    constructor() {
        this.routes = []; // Mảng lưu trữ các object route
        this.mainContent = document.querySelector(".main-content");

        /* Kích hoạt khi # (hash) thay đổi (nút Back/Forward mặc định của trình duyệt) */
        window.addEventListener(
            "hashchange",
            this._handleRouteChange.bind(this)
        );

        /* Kích hoạt khi mỗi lần tải trang */
        window.addEventListener("load", this._handleRouteChange.bind(this));
    }

    /* Thêm route mới vào danh sách
        - path: Đường dẫn (VD: '/playlist/:id')
        - handler: Hàm được gọi khi route khớp
    */
    add(path, handler) {
        this.routes.push({ path, handler });
    }

    /* Điều hướng đến một path mới
        - path: Đường dẫn để điều hướng đến
    */
    navigate(path) {
        window.location.hash = path;
    }

    /* Xử lý thay đổi route
        - Tìm route khớp với hash hiện tại
        - Gọi handler tương ứng
    */
    _handleRouteChange() {
        // Lấy path hiện tại (không chứa dấu #)
        const currentPath = window.location.hash.slice(1) || "/";
        let found = false; // Kiểm tra xem có khớp không?

        for (const route of this.routes) {
            /* 
            path -> regex: Xử lý tham số động (:id)
            VD: [ /playlist/:id ] sẽ khớp [ /playlist/123 ]
            */
            const regex = new RegExp(
                `^${route.path.replace(/:[^\s/]+/g, "([\\w-]+)")}$`
            );
            /* 
            👉 VD: ["/user/123", "123"]
                - match[0]: Chuỗi khớp toàn bộ ("/playlist/123")
                - match[1]: Nhóm 1 trong regex ("123")
                - match[2]: Nhóm 2, nếu có (ví dụ /user/:id/:post)
            */
            const match = currentPath.match(regex);

            if (match) {
                // Nếu khớp, lấy ra tham số từ URL
                const params = match.slice(1);

                // Gọi callback với tham số là params
                route.handler(...params);

                // Thông báo khớp
                found = true;
                break;
            }
        }

        // Hiển thị lỗi nếu không tìm thấy route nào khớp
        if (!found) {
            console.error(`No route found for path: ${currentPath}`);
        }

        // Scroll về đầu trang mỗi khi chuyển trang
        this.mainContent
            .querySelector(".content-wrapper")
            .scrollTo({ top: 0, behavior: "smooth" });
    }
}

const router = new Router();
export default router;
