import storage from "./storage.js";

class HttpRequest {
    constructor() {
        this.baseUrl = "https://spotify.f8team.dev/api/";
    }
    /* GHI CHÚ PHƯƠNG THỨC _send()
        - Tạo phương thức _send => gửi request 
        - "_" => biến private
        - Các tham số:
            + path   : Đường dẫn cụ thể gửi đi
            + method : Phương thức gửi đi
            + data   : Dữ liệu gửi đi
            + options: Các tuỳ chọn gửi đi
    */
    async _send(path, method, data, options = {}) {
        try {
            // Payload gửi đi khi dùng phương thức POST, PUT, PATCH
            const _options = {
                ...options,
                method,
                headers: {
                    ...options.headers,
                },
            };

            // Nếu có dữ liệu gửi đi => thêm vào body (payload)
            // Nếu data là FormData, trình duyệt sẽ tự đặt Content-Type
            // Nếu không, ta mặc định là application/json
            if (data) {
                if (data instanceof FormData) {
                    _options.body = data;
                } else {
                    _options.headers["Content-Type"] = "application/json";
                    _options.body = JSON.stringify(data);
                }
            }

            // Lấy accessToken để làm 'chìa khoá vào nhà'
            const accessToken = storage.get("access_token");
            if (accessToken) {
                _options.headers.Authorization = `Bearer ${accessToken}`;
            }

            const res = await fetch(`${this.baseUrl}${path}`, _options);

            // Nhận về dữ liệu
            const response = await res.json();

            // Bắt lỗi response
            if (!res.ok) {
                const error = new Error(`HTTP error: ${res.status}`);
                error.response = response; // Đính kèm response
                error.status = res.status; // Đính kèm status
                throw error;
            }

            // Trả về dữ liệu
            return response;
        } catch (error) {
            throw error;
        }
    }

    /* Phương thức GET */
    async get(path, options) {
        return await this._send(path, "GET", null, options);
    }

    /* Phương thức POST */
    async post(path, data, options) {
        return await this._send(path, "POST", data, options);
    }

    /* Phương thức PUT */
    async put(path, data, options) {
        return await this._send(path, "PUT", data, options);
    }

    /* Phương thức PATCH */
    async patch(path, data, options) {
        return await this._send(path, "PATCH", data, options);
    }

    /* Phương thức DELETE */
    async del(path, options) {
        return await this._send(path, "DELETE", null, options);
    }
}

/* Tạo object HttpRequest từ constructor */
const httpRequest = new HttpRequest();

export default httpRequest;
