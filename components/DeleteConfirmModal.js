class DeleteConfirmModal {
    constructor() {
        /* Thuộc tính & phương thức cho instance */
        this.modalElement = null; // DOM Modal
        this.playlist = null; // Lấy thông tin của Playlist cần xoá
        this.onDeleteCallback = null; // Hàm callback để xác nhận xoá
        this.isLoading = false;

        this._handleConfirm = this._handleConfirm.bind(this);
        this._handleCancel = this._handleCancel.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }

    /* Khởi tạo */
    init() {
        // Clone Modal
        const template = document.getElementById(
            "delete-confirmation-modal-template"
        );
        if (!template) {
            console.error("Delete confirmation modal template not found!");
            return;
        }
        const clone = template.content.cloneNode(true);
        this.modalElement = clone.querySelector(".modal-overlay");
        document.body.appendChild(this.modalElement);

        // Truy cập các phần tử trong Modal
        this.titleElement = this.modalElement.querySelector(".modal-heading");
        this.descriptionElement =
            this.modalElement.querySelector(".modal-description");
        this.cancelButton = this.modalElement.querySelector(".cancel-btn");
        this.deleteButton = this.modalElement.querySelector(".delete-btn");
        this.spinner = this.deleteButton.querySelector(".spinner");

        // Lắng nghe các sự kiện
        this._addEventListeners();
    }

    /* Mở modal */
    open(playlist, onDeleteCallback) {
        // Truyền playlist cần xoá và hành động
        this.playlist = playlist;
        this.onDeleteCallback = onDeleteCallback;
        this.isLoading = false;

        // Lấy tiêu đề và & mô tả của Modal xoá
        this.titleElement.textContent = `Delete ${this.playlist.name}?`;
        this.descriptionElement.textContent = `This will permanently delete ${this.playlist.name}. This action cannot be undone.`;

        // Mở Modal & focus
        this.modalElement.classList.add("show");
        this.deleteButton.focus(); // Tự động focus vào nút Delete
        document.addEventListener("keydown", this._handleKeyDown); // Xác nhận bằng phím 'Escape'
    }

    /* Đóng Modal */
    close() {
        // Gỡ bỏ listener 'Escape'
        this.modalElement.classList.remove("show");
        document.removeEventListener("keydown", this._handleKeyDown);

        // Reset state
        this.playlist = null;
        this.onDeleteCallback = null;
        this._setLoading(false);
    }

    /* Các sự kiện lắng nghe */
    _addEventListeners() {
        // Nhấn nút Xoá
        this.deleteButton.addEventListener("click", this._handleConfirm);

        // Nhấn nút Huỷ
        this.cancelButton.addEventListener("click", this._handleCancel);

        // Nhấn vào overlay
        this.modalElement.addEventListener("click", (e) => {
            if (e.target === this.modalElement) {
                this._handleCancel();
            }
        });
    }

    /* Xác nhận xoá */
    async _handleConfirm() {
        if (this.isLoading) return;
        this._setLoading(true);

        // Gọi callback để xoá sau khi nhấn đồng ý xoá
        if (this.onDeleteCallback) {
            try {
                await this.onDeleteCallback(this.playlist.id);
            } catch (error) {
                this._setLoading(false);
            }
        }
    }

    /* Xác nhận Huỷ */
    _handleCancel() {
        // Đóng Modal
        if (this.isLoading) return;
        this.close();
    }

    /* Huỷ bằng Escape */
    _handleKeyDown(e) {
        if (e.key === "Escape") {
            this._handleCancel();
        }
    }

    /* Trạng thái đang xoá */
    _setLoading(isLoading) {
        this.isLoading = isLoading;
        this.deleteButton.disabled = isLoading;
        if (isLoading) {
            this.deleteButton.querySelector(".btn-text").style.display = "none";
            this.spinner.style.display = "block";
        } else {
            this.deleteButton.querySelector(".btn-text").style.display =
                "inline";
            this.spinner.style.display = "none";
        }
    }
}

export default DeleteConfirmModal;
