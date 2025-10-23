class Toast {
    // Thuộc tính tĩnh cho class
    static _baseOptions = {
        duration: 1000,
        gravity: "top", // Hiển thị ở dưới
        position: "center", // Hiển thị ở giữa
        stopOnFocus: true, // Dừng khi focus vào
        className: "spotify-toast",
    };

    /* Thành công */
    static success(text) {
        Toastify({
            ...this._baseOptions,
            text,
            backgroundColor: "var(--accent-primary)",
        }).showToast();
    }

    /* Thông báo */
    static info(text) {
        Toastify({
            ...this._baseOptions,
            text,
            backgroundColor: "#535353",
        }).showToast();
    }

    /* Thất bại */
    static error(text) {
        Toastify({
            ...this._baseOptions,
            text,
            backgroundColor: "#f87171",
        }).showToast();
    }
}

export default Toast;
