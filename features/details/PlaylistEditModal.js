import playlistService from "../playlist/playlistService.js";
import Toast from "../../components/Toast.js";

class PlaylistEditModal {
    constructor() {
        /* State */
        this.modalElement = null;
        this.formElement = null;
        this.currentPlaylist = null;
        this.initialData = {};
        this.coverFile = null;

        /* Xử lý các hành động trên modal */
        this._handleFormSubmit = this._handleFormSubmit.bind(this);
        this._handleCoverClick = this._handleCoverClick.bind(this);
        this._handleFileChange = this._handleFileChange.bind(this);
        this._handleInputChange = this._handleInputChange.bind(this);
    }

    /* Khởi tạo */
    init() {
        const template = document.getElementById(
            "playlist-edit-modal-template"
        );
        if (!template) return;

        // Clone template Modal
        const clone = template.content.cloneNode(true);
        this.modalElement = clone.querySelector(".playlist-edit-modal");

        // Lấy các element con
        this.formElement = this.modalElement.querySelector(
            ".playlist-edit-form"
        );
        this.closeBtn = this.modalElement.querySelector(".modal-close");
        this.coverWrapper = this.modalElement.querySelector(
            ".form-cover-wrapper"
        );
        this.coverPreview = this.modalElement.querySelector(
            ".modal-cover-preview"
        );
        this.coverInput = this.modalElement.querySelector(".modal-cover-input");
        this.nameInput = this.modalElement.querySelector("#playlistNameInput");
        this.descriptionInput = this.modalElement.querySelector(
            "#playlistDescriptionInput"
        );
        this.saveBtn = this.modalElement.querySelector(".save-btn");
        this.spinner = this.saveBtn.querySelector(".spinner");
        this.btnText = this.saveBtn.querySelector(".btn-text");

        // Gắn sự kiện
        this.closeBtn.addEventListener("click", () => this.close());
        this.modalElement.addEventListener("click", (e) => {
            if (e.target === this.modalElement) this.close();
        });

        this.formElement.addEventListener("submit", this._handleFormSubmit);
        this.coverWrapper.addEventListener("click", this._handleCoverClick);
        this.coverInput.addEventListener("change", this._handleFileChange);
        this.nameInput.addEventListener("input", this._handleInputChange);
        this.descriptionInput.addEventListener(
            "input",
            this._handleInputChange
        );

        document.body.appendChild(this.modalElement);
    }

    /* Mở modal */
    open(playlist, focusTarget = null) {
        // Lấy ra thông tin Playlist hiện tại
        this.currentPlaylist = playlist;
        this.initialData = {
            name: playlist.name,
            description: playlist.description || "",
            image_url: playlist.image_url,
        };
        this.coverFile = null;

        // Fill dữ liệu vào form từ thông tin Playlist đó
        this.nameInput.value = this.initialData.name;
        this.descriptionInput.value = this.initialData.description;
        this.coverPreview.src = this.initialData.image_url || "placeholder.svg";

        // Check bật/tắt nút Save & mở Modal
        this._toggleSaveButtonState();
        this.modalElement.classList.add("show");

        // Xử lý UX
        setTimeout(() => {
            switch (focusTarget) {
                case "image":
                    this.coverInput.click();
                    break;
                case "title":
                    this.nameInput.focus();
                    // this.nameInput.select();
                    break;
                case "description":
                    this.descriptionInput.focus();
                    // this.descriptionInput.select();
                    break;
                default:
                    break;
            }
        }, 150);
    }

    /* Đóng Modal & Reset dữ liệu */
    close() {
        this.modalElement.classList.remove("show");
        this.formElement.reset();
        this.coverFile = null;
    }

    /* Phát sự kiện click vào ảnh */
    _handleCoverClick() {
        this.coverInput.click();
    }

    /* Hành động thay đổi ảnh */
    _handleFileChange(e) {
        const file = e.target.files[0];
        if (file) {
            this.coverFile = file;
            const reader = new FileReader();
            reader.onload = (event) => {
                this.coverPreview.src = event.target.result;
            };
            reader.readAsDataURL(file);

            // Check bật/tắt nút Save & mở Modal
            this._toggleSaveButtonState();
        }
    }

    /* Xử lý khi Input thay đổi */
    _handleInputChange() {
        // Check bật/tắt nút Save & mở Modal
        this._toggleSaveButtonState();
    }

    /* Check bật/tắt nút Save & mở Modal */
    _toggleSaveButtonState() {
        const nameChanged =
            this.nameInput.value.trim() !== this.initialData.name;
        const descriptionChanged =
            this.descriptionInput.value !== this.initialData.description;
        const imageChanged = !!this.coverFile;

        // Hiển thị nút Save khi chỉ cần thay đổi 1 trong các trường
        const hasChanges = nameChanged || descriptionChanged || imageChanged;
        this.saveBtn.disabled = !hasChanges;
    }

    /* Loading */
    _setLoading(isLoading) {
        if (isLoading) {
            this.saveBtn.classList.add("loading");
            this.saveBtn.disabled = true;
            this.spinner.style.display = "block";
            this.btnText.style.display = "none";
        } else {
            this.saveBtn.classList.remove("loading");
            this.saveBtn.disabled = false;
            this.spinner.style.display = "none";
            this.btnText.style.display = "block";
        }
    }

    /* Xử lý submit form */
    async _handleFormSubmit(e) {
        e.preventDefault();
        this._setLoading(true);

        try {
            let newImageUrl = this.initialData.image_url;

            // Upload ảnh
            if (this.coverFile) {
                const formData = new FormData();
                formData.append("cover", this.coverFile);
                const uploadResponse =
                    await playlistService.uploadPlaylistCover(
                        this.currentPlaylist.id,
                        formData
                    );
                // API trả về URL tương đối, cần ghép với base URL
                newImageUrl =
                    "https://spotify.f8team.dev" + uploadResponse.file.url;
                Toast.success("Cover image uploaded.");
            }

            // Cập nhật trường thông tin playlist trong form
            const updatedData = {
                name: this.nameInput.value.trim(),
                description: this.descriptionInput.value,
                image_url: newImageUrl,
            };

            // Lấy response update
            const updateResponse = await playlistService.updatePlaylist(
                this.currentPlaylist.id,
                updatedData
            );

            // Phát sự kiện update playlist
            document.dispatchEvent(
                new CustomEvent("playlist:updated", {
                    detail: updateResponse.playlist,
                })
            );

            // Hiện Toast và đóng Modal
            Toast.success("Details updated.");
            this.close();
        } catch (error) {
            console.error("Lỗi khi lưu playlist:", error);
            Toast.error("Could not save details. Please try again.");
        } finally {
            this._setLoading(false);
        }
    }
}

export default PlaylistEditModal;
