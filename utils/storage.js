class Storage {
    constructor(storage = localStorage) {
        this.storage = storage;
    }

    /* Get */
    get(key) {
        try {
            const value = this.storage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.error(`Lỗi khi lấy dữ liệu '${key}' từ storage`, error);
            return null;
        }
    }

    /* Set */
    set(key, value) {
        try {
            this.storage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Lỗi khi lưu dữ liệu '${key}' vào storage`, error);
        }
    }

    /* Xoá */
    remove(key) {
        this.storage.removeItem(key);
    }
}

const storage = new Storage();

export default storage;
