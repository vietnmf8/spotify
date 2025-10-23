import httpRequest from "../../utils/httpRequest.js";
import {
    isValidEmail,
    validatePassword,
    isNotEmpty,
} from "../../utils/validation.js";
import storage from "../../utils/storage.js";
import Toast from "../../components/Toast.js";

/**
 * Quản lý toàn bộ quy trình xác thực người dùng (Authentication)!
 * 1. Hiển thị và quản lý Modal Đăng nhập / Đăng ký.
 * 2. Chuyển đổi giữa hai form (Login, Signup).
 * 3. Validate (kiểm tra lỗi) real-time cho các trường input.
 * 4. Xử lý submit form, gọi API (login, register, logout).
 * 5. Cập nhật UI của ứng dụng (ẩn/hiện nút login, hiển thị avatar user).
 * 6. Kiểm tra trạng thái đăng nhập khi tải trang (checkAuthOnload).
 * - Case:
 *  1. Khi nhấn "Sign up" hoặc "Log in" ở header, modal sẽ mở.
 *  2. Lỗi validation (VD: email sai định dạng) sẽ hiển thị ngay khi người dùng gõ.
 *  3. Nút "Sign Up" / "Log In" bị vô hiệu hóa (disabled) nếu form chưa hợp lệ.
 *  4. Khi submit:
 *      - Gọi đúng API (vd: /auth/register).
 *      - Hiển thị spinner (loading) trên nút.
 *      -  Xử lý lỗi từ API (VD: "Email đã tồn tại") và hiển thị lỗi đúng trường.
 *  5. Khi Đăng nhập / Đăng ký thành công:
 *      - Lưu `access_token`, `refresh_token`, `user` vào `storage`.
 *      -  Đóng modal.
 *      - Cập nhật UI (ẩn nút "Log in", hiện avatar user).
 *      - Phát sự kiện "auth:state-changed" để các module khác (như Library) biết.
 *  6. Khi tải trang (`_checkAuthOnload`), nếu có token, sẽ tự động gọi API "users/me" để lấy thông tin user.
 *  7. Khi Đăng xuất (`logout`):
 *      - Gọi API /auth/logout (nếu có thể).
 *      - Xóa toàn bộ dữ liệu (tokens, user) khỏi `storage`.
 *      - Cập nhật UI về trạng thái "chưa đăng nhập".
 *      - Chuyển hướng về trang chủ "/".
 */

class Auth {
    constructor(router) {
        // Dùng để điều hướng (về home khi logout)
        this.router = router;

        /* Cờ  để kiểm tra xem modal có đang đóng hay không */
        this.isClosing = false;

        /*  Key để lưu trạng thái form đăng ký vào localStorage */
        this.signupFormStateKey = "signupFormState";

        /* Get DOM Element */
        this.authModal = document.getElementById("authModal");
        this.modalCloseBtn = document.getElementById("modalClose");
        this.signupHeaderBtn = document.querySelector(".signup-btn");
        this.loginHeaderBtn = document.querySelector(".main-header .login-btn");

        this.appContainer = document.querySelector(".app-container");

        /* Form */
        this.signupForm = document.getElementById("signupForm");
        this.loginForm = document.getElementById("loginForm");
        this.showLoginLink = document.getElementById("showLogin");
        this.showSignupLink = document.getElementById("showSignup");

        /* Các trường trong Form Đăng ký */
        this.signupEmailInput = document.getElementById("signupEmail");
        this.signupUsernameInput = document.getElementById("signupUsername");
        this.signupDisplayNameInput =
            document.getElementById("signupDisplayName");
        this.signupPasswordInput = document.getElementById("signupPassword");
        this.signupPasswordToggle = document.getElementById(
            "signupPasswordToggle"
        );
        this.signupSubmitBtn =
            this.signupForm.querySelector(".auth-submit-btn");
        this.signupInputs = this.signupForm.querySelectorAll(".form-input");

        /* Các trường trong Form Đăng nhập */
        this.loginEmailInput = document.getElementById("loginEmail");
        this.loginPasswordInput = document.getElementById("loginPassword");
        this.loginPasswordToggle = document.getElementById(
            "loginPasswordToggle"
        );
        this.loginSubmitBtn = this.loginForm.querySelector(".auth-submit-btn");
        this.loginInputs = this.loginForm.querySelectorAll(".form-input");

        /* Thông tin User trên Header */
        this.authButtonsContainer = document.querySelector(".auth-buttons");
        this.userInfoContainer = document.querySelector(".user-info");
        this.userNameElement = document.getElementById("user-name");
        this.userAvatarImg = document.getElementById("user-avatar");
    }

    init() {
        // Lắng nghe các sự kiện
        this._addEventListeners();

        // Kiểm tra xem người dùng đã đăng nhập từ phiên trước hay chưa khi ứng dụng vừa tải xong.
        this._checkAuthOnload();

        // Validate form Đăng ký ngay khi khởi tạo
        // Vô hiệu hoá nút Submit ban đầu
        this._validateSignupForm();

        // Validate form Đăng nhập ngay khi khởi tạo
        this._validateLoginForm();
    }

    /* Lắng nghe các sự kiện */
    _addEventListeners() {
        /* Sự kiện Mở Modal */
        // Nút "Sign up" trên header
        this.signupHeaderBtn.addEventListener("click", () =>
            this._openModal("signup")
        );
        // Nút "Log in" trên header
        if (this.loginHeaderBtn) {
            this.loginHeaderBtn.addEventListener("click", () =>
                this._openModal("login")
            );
        }

        // Nút đăng nhập tại Library
        const libraryLoginBtn = document.querySelector(
            ".library-empty-state .login-btn"
        );
        if (libraryLoginBtn) {
            libraryLoginBtn.addEventListener("click", () =>
                this._openModal("login")
            );
        }

        /* Sự kiện đóng Modal */
        // Đóng Modal: Nhấn vào nút (x)
        this.modalCloseBtn.addEventListener("click", () => this._closeModal());

        // Đóng Modal: Click vào overlay
        this.authModal.addEventListener("click", (e) => {
            if (e.target === this.authModal) {
                this._closeModal();
            }
        });
        // Đóng Modal: Nhấn Escape
        document.addEventListener("keydown", (e) => {
            if (
                e.key === "Escape" &&
                this.authModal.classList.contains("show")
            ) {
                this._closeModal();
            }
        });

        /* Chuyển đổi giữa các form */
        // Link "Log in here" (từ form Signup)
        this.showLoginLink.addEventListener("click", () => {
            this._clearAllFormErrors(this.signupForm);
            this._switchForm("login");
        });

        // Link "Sign up here" (từ form Login)
        this.showSignupLink.addEventListener("click", () => {
            this._clearAllFormErrors(this.loginForm); // Xóa lỗi form cũ
            // Xoá message lỗi chung của form Đăng nhập
            this._showFormError(this.loginForm, "", false);
            this._switchForm("signup");
        });

        /* Form Đăng ký (Signup) */
        if (this.signupForm) {
            // Xử lý khi submit
            this.signupForm.addEventListener("submit", (e) =>
                this._handleSignUpSubmit(e)
            );

            // Gắn sự kiện validate real-time cho TẤT CẢ các input của form signup
            this.signupInputs.forEach((input) => {
                input.addEventListener("input", () => {
                    this._validateField(input);
                });
                input.addEventListener("blur", () =>
                    setTimeout(() => {
                        this._validateField(input);
                    }, 100)
                );
            });

            // Nút ẩn/hiện mật khẩu (icon con mắt)
            this.signupPasswordToggle.addEventListener("click", () => {
                this._togglePassword(
                    this.signupPasswordInput,
                    this.signupPasswordToggle
                );
            });
        }

        /* Form Đăng nhập (Login) */
        if (this.loginForm) {
            // Xử lý khi submit
            this.loginForm.addEventListener("submit", (e) =>
                this._handleLoginSubmit(e)
            );

            // Gắn sự kiện validate cho TẤT CẢ các input của form login
            this.loginInputs.forEach((input) => {
                // `input`: Validate ngay khi gõ
                input.addEventListener("input", () => {
                    this._clearError(input); // Xóa lỗi của trường này
                    this._showFormError(this.loginForm, "", false); // Xóa lỗi chung (vd: "Sai mật khẩu")
                    this._validateLoginForm(); // Kiểm tra lại toàn form (để bật/tắt nút Submit)
                });

                // `blur`: Validate khi rời khỏi
                input.addEventListener("blur", () => {
                    setTimeout(() => {
                        this._validateLoginField(input);
                    }, 100);
                });
            });

            // Nút ẩn/hiện mật khẩu
            this.loginPasswordToggle.addEventListener("click", () =>
                this._togglePassword(
                    this.loginPasswordInput,
                    this.loginPasswordToggle
                )
            );
        }
    }

    /* Chuyển đổi hiển thị giữa form Đăng ký và Đăng nhập
        - Ẩn form này, hiện form kia, và focus vào input đầu tiên
    */
    _switchForm(typeForm) {
        if (typeForm === "signup") {
            this.signupForm.style.display = "block";
            this.loginForm.style.display = "none";
            this.signupEmailInput.focus();
        } else {
            this.signupForm.style.display = "none";
            this.loginForm.style.display = "block";
            this.loginEmailInput.focus();
        }
    }

    /* Đóng Modal
        - Đặt cờ `isClosing` = true, xóa class 'show', và reset lỗi
    */
    _closeModal() {
        this.isClosing = true; // Báo hiệu modal đang đóng (để ngăn `_validateField` chạy)
        this.authModal.classList.remove("show"); // Đóng Modal
        document.body.style.overflow = "auto"; // Trả lại thanh cuộn cho trang

        // Dọn dẹp lỗi của cả 2 form để lần mở sau sạch sẽ
        this._clearAllFormErrors(this.signupForm);
        this._clearAllFormErrors(this.loginForm);

        // Xoá thông báo lỗi chung (vd: "Sai mật khẩu") của form Đăng nhập
        this._showFormError(this.loginForm, "", false);
    }

    /* Mở Modal và hiển thị form được chỉ định */
    _openModal(typeForm) {
        this.isClosing = false; // Reset cờ (vì đang mở)

        // Hiển thị modal và khóa thanh cuộn của body
        this.authModal.classList.add("show");
        document.body.style.overflow = "hidden";

        // Chọn form để hiển thị ("signup" hoặc "login")
        this._switchForm(typeForm);

        // Focus vào trường đầu tiên trong form Đăng ký
        if (typeForm === "signup") {
            this.signupEmailInput.focus();
        } else {
            this.loginEmailInput.focus();
        }
    }

    /* Kiểm tra và hiển thị thông báo lỗi cho MỘT trường (input) */
    _validateField(input) {
        // Nếu modal đang đóng, không làm gì cả
        if (this.isClosing) return;

        // Xoá lỗi cũ (nếu có) trước khi kiểm tra lỗi mới
        this._clearError(input);

        // Khởi tạo object chứa thông tin của Validation gồm:
        // isValid: Validate Thành công hay không?
        // message: Nội dung lỗi nếu có
        let validationResult = { isValid: true, message: "" };

        // Lấy giá trị của input (đã trim)
        const value = input.value.trim();

        // Kiểm tra dựa trên ID của input
        switch (input.id) {
            // Trường Email
            case "signupEmail":
                if (!isNotEmpty(value) || !isValidEmail(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter a valid email address.",
                    };
                break;

            // Trường Username
            case "signupUsername":
                if (!isNotEmpty(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter a username.",
                    };
                break;

            // Trường Display name
            case "signupDisplayName":
                if (!isNotEmpty(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter a display name.",
                    };
                break;

            // Trường Mật khẩu
            case "signupPassword":
                // `validatePassword` trả về { isValid, message }
                validationResult = validatePassword(value);
                break;
        }

        // Nếu validate Thất bại -> hiển thị message lỗi
        if (!validationResult.isValid)
            this._showError(input, validationResult.message);

        // Sau khi kiểm tra 1 trường, kiểm tra lại TOÀN BỘ form
        // => quyết định bật/tắt nút Submit.
        this._validateSignupForm();
    }

    /* 
        - Kiểm tra trạng thái hợp lệ của toàn bộ form
        -> Từ đó cập nhật trạng thái nút Submit
        -> Bật/tắt (enable/disable) nút Submit
    */
    _validateSignupForm() {
        // Kiểm tra Email
        const isEmailValid =
            isNotEmpty(this.signupEmailInput.value) &&
            isValidEmail(this.signupEmailInput.value);

        // Kiểm tra Username
        const isUsernameValid = isNotEmpty(this.signupUsernameInput.value);

        // Kiểm tra Display name
        const isDisplayNameValid = isNotEmpty(
            this.signupDisplayNameInput.value
        );

        // Kiểm tra Password
        const isPasswordValid = validatePassword(
            this.signupPasswordInput.value
        ).isValid;

        // Tổng hợp kết quả
        const isFormValid =
            isEmailValid &&
            isUsernameValid &&
            isDisplayNameValid &&
            isPasswordValid;

        // Vô hiệu hóa nút Submit nếu form không hợp lệ.
        this.signupSubmitBtn.disabled = !isFormValid;
        return isFormValid;
    }

    /* Kiểm tra và hiển thị thông báo lỗi cho MỘT trường (input)*/
    _validateLoginField(input) {
        if (this.isClosing) return;

        // Xoá message lỗi cũ
        this._clearError(input);

        // Tạo object chứa message lỗi
        let validationResult = { isValid: true, message: "" };
        const value = input.value.trim();

        switch (input.id) {
            // Trường Email
            case "loginEmail":
                if (!isNotEmpty(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter your email.",
                    };
                else if (!isValidEmail(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter a valid email address.",
                    };
                break;

            // Trường Password
            case "loginPassword":
                if (!isNotEmpty(value))
                    validationResult = {
                        isValid: false,
                        message: "Please enter your password.",
                    };
                break;
        }

        // Nếu validate thất bại => hiển thị lỗi
        if (!validationResult.isValid)
            this._showError(input, validationResult.message);

        // Validate toàn form Đăng nhập
        // Cập nhật trạng thái nút Submit
        this._validateLoginForm();
    }

    /* Kiểm tra trạng thái hợp lệ của TOÀN BỘ form */
    _validateLoginForm() {
        // Kiểm tra Email
        const isEmailValid =
            isNotEmpty(this.loginEmailInput.value) &&
            isValidEmail(this.loginEmailInput.value);

        // Kiểm tra mật khẩu
        const isPasswordValid = isNotEmpty(this.loginPasswordInput.value);

        // Kiểm tra toàn form
        const isFormValid = isEmailValid && isPasswordValid;

        // Vô hiệu hóa nút Submit
        this.loginSubmitBtn.disabled = !isFormValid;
        return isFormValid;
    }

    /* Hiển thị thông báo lỗi cho mỗi trường */
    _showError(input, message) {
        // Lấy ra DOM của message & hiển thị message
        const formGroup = input.closest(".form-group");
        const errorElement = formGroup.querySelector(".error-message span");
        if (formGroup && errorElement) {
            formGroup.classList.add("invalid");
            errorElement.textContent = message;
        }
    }

    /* Xoá thông báo lỗi của mỗi trường */
    _clearError(input) {
        const formGroup = input.closest(".form-group");
        if (formGroup) formGroup.classList.remove("invalid");
    }

    /* Xoá tất cả thông báo lỗi trên form */
    _clearAllFormErrors(formElement) {
        // Lấy tất cả trường đang hiển thị lỗi
        const invalidFields = formElement.querySelectorAll(
            ".form-group.invalid"
        );

        // Gỡ message lỗi
        invalidFields.forEach((field) => field.classList.remove("invalid"));
    }

    /* Hiển thị lỗi chung cho Form Đăng nhập (Email hoặc mật khẩu không đúng) */
    _showFormError(formElement, message, show = true) {
        // Lấy ra DOM chứa message
        const errorContainer = formElement.querySelector(".form-error-message");
        if (!errorContainer) return;
        const errorText = errorContainer.querySelector("span");
        if (show) {
            errorText.textContent = message;
            errorContainer.classList.add("show");
        } else {
            errorContainer.classList.remove("show");
        }
    }

    /* Bật/tắt hiển thị mật khẩu cho trường Password */
    _togglePassword(inputElement, toggleElement) {
        // Kiểm tra xem type có phải là "password" (đang ẩn) không.
        const isPassword = inputElement.type === "password";

        // Chuyển đổi: "password" -> "text" (hiện) | "text" -> "password" (ẩn)
        inputElement.type = isPassword ? "text" : "password";

        // Cập nhật icon con mắt
        toggleElement.innerHTML = isPassword
            ? '<i class="fas fa-eye-slash"></i>' // Đang hiện (mắt gạch)
            : '<i class="fas fa-eye"></i>'; // Đang ẩn (mắt thường)
    }

    /* Cập nhật trạng thái Loading (spinner) cho nút Submit. */
    _setLoading(button, isLoading, loadingText, defaultText) {
        if (isLoading) {
            button.disabled = true; // Vô hiệu hóa nút khi đang tải
            button.classList.add("loading");

            // Thay thế nội dung nút bằng spinner
            button.innerHTML = `
                <div class="spinner"></div>
                <span>${loadingText}</span>
            `;
        } else {
            button.disabled = false; // Bật lại nút
            button.classList.remove("loading");
            button.innerHTML = defaultText;
        }
    }

    /* Xử lý lỗi được trả về từ API */
    _showErrorResponse(errorResponse) {
        if (!errorResponse || !errorResponse.error) return;
        const { code, message, details } = errorResponse.error;

        // Nếu có details
        if (code === "VALIDATION_ERROR" && details) {
            details.forEach((detail) => {
                let input;
                switch (detail.field) {
                    case "email":
                        input = this.signupEmailInput;
                        break;
                    case "username":
                        input = this.signupUsernameInput;
                        break;
                    case "password":
                        input = this.signupPasswordInput;
                        break;
                    case "display_name":
                        input = this.signupDisplayNameInput;
                        break;
                }
                if (input) this._showError(input, detail.message);
            });
        }

        // Lỗi 409 (Conflict) - Email đã tồn tại
        else if (code === "EMAIL_EXISTS") {
            this._showError(this.signupEmailInput, message);
        }

        // Lỗi 409 (Conflict) - Username đã tồn tại
        else if (code === "USERNAME_EXISTS") {
            this._showError(this.signupUsernameInput, message);
        }

        // Các lỗi khác (500, ...)
        else {
            Toast.error(message || "An unexpected error occurred.");
        }
    }

    /* Xử lý sự kiện submit trong form đăng ký */
    async _handleSignUpSubmit(e) {
        e.preventDefault();

        // Dọn lỗi cũ và validate lại lần cuối trước khi submit
        this._clearAllFormErrors(this.signupForm);
        const isFormValid = this._validateSignupForm();
        if (!isFormValid) return; // Dừng nếu form không hợp lệ

        // Bật trạng thái Loading
        this._setLoading(
            this.signupSubmitBtn,
            true,
            "Signing Up...",
            "Sign Up"
        );

        // Chuẩn bị dữ liệu (payload) để gửi đi
        const credentials = {
            email: this.signupEmailInput.value,
            password: this.signupPasswordInput.value,
            username: this.signupUsernameInput.value,
            display_name: this.signupDisplayNameInput.value,
        };

        try {
            // Gọi API /auth/register
            const data = await httpRequest.post("auth/register", credentials);

            /* Đăng ký thành công! */
            // Lưu trữ thông tin
            storage.set("access_token", data.access_token);
            storage.set("refresh_token", data.refresh_token);
            storage.set("user", data.user);

            // Đóng Modal & Thông báo thành công
            this._closeModal();
            Toast.success("Sign up successful!");

           // Cập nhật UI (hiện avatar, ẩn nút "Sign up")
            this._updateAuthUI(data.user);
        } catch (error) {
            // Xử lý lỗi được trả về
            this._showErrorResponse(error.response);
        } finally {
            // Tắt Loading
            this._setLoading(
                this.signupSubmitBtn,
                false,
                "Signing Up...",
                "Sign Up"
            );
        }
    }

    /* Xử lý sự kiện submit trong form Đăng nhập */
    async _handleLoginSubmit(e) {
        // Xoá toàn bộ lỗi và kiểm tra validate
        e.preventDefault();
        this._clearAllFormErrors(this.loginForm);
        this._showFormError(this.loginForm, "", false);
        if (!this._validateLoginForm()) return;

        // Bật trạng thái Loading
        this._setLoading(this.loginSubmitBtn, true, "Logging In...", "Log In");

        // Thông tin xác thực gửi đi
        const credentials = {
            email: this.loginEmailInput.value,
            password: this.loginPasswordInput.value,
        };

        try {
            const data = await httpRequest.post("auth/login", credentials);

            // Lưu trữ thông tin user
            storage.set("access_token", data.access_token);
            storage.set("refresh_token", data.refresh_token);
            storage.set("user", data.user);

            // Đóng Modal & hiện Toast
            this._closeModal();
            Toast.success("Login successful!");

            // Cập nhật lại giao diện khi có user
            this._updateAuthUI(data.user);
        } catch (error) {
            // Xử lý lỗi được trả về  từ API
            if (error.status === 401) {
                this._showFormError(
                    this.loginForm,
                    error?.response?.error?.message
                );
            } else {
                Toast.error("An unexpected error occurred. Please try again.");
            }
        } finally {
            // Tắt loading
            this._setLoading(
                this.loginSubmitBtn,
                false,
                "Logging In...",
                "Log In"
            );
        }
    }

    /* Cập nhật giao diện dựa trên trạng thái đăng nhập */
    _updateAuthUI(user) {
        if (user) {
            // Đánh dấu là đã đăng nhập
            this.appContainer.classList.add("logged-in");
            this.appContainer.classList.remove("logged-out");

            // Đã đăng nhập
            this.authButtonsContainer.style.display = "none";
            this.userInfoContainer.style.display = "flex";
            this.userNameElement.textContent =
                user.display_name || user.username;
            this.userAvatarImg.src =
                user.avatar_url || "placeholder.svg?height=32&width=32";
        } else {
            // Đánh dấu là chưa đăng nhập
            this.appContainer.classList.add("logged-out");
            this.appContainer.classList.remove("logged-in");

            // Chưa đăng nhập
            this.authButtonsContainer.style.display = "flex";
            this.userInfoContainer.style.display = "none";
        }

        // Phát sự kiện thay đổi trạng thái xác thực
        document.dispatchEvent(
            new CustomEvent("auth:state-changed", {
                detail: { isLoggedIn: !!user },
            })
        );
    }

    /* Kiểm tra trạng thái đăng nhập ban đầu khi tải trang. */
    async _checkAuthOnload() {
        const accessToken = storage.get("access_token");
        if (accessToken) {
            try {
                // Lấy thông tin user từ localStorage hoặc gọi API/me mới
                const user = storage.get("user");
                if (user) {
                    // Cập nhật giao diện khi có thông tin user
                    this._updateAuthUI(user);
                } else {
                    // Gọi API mới nếu chưa có user được lưu
                    const data = await httpRequest.get("users/me");
                    storage.set("user", data.user);
                    this._updateAuthUI(data.user);
                }
            } catch (error) {
                // Nếu token lỗi hoặc hết hạn, xoá toàn bộ thông tin cũ
                // Đồng thời cập nhật giao diện khi không có user
                storage.remove("access_token");
                storage.remove("refresh_token");
                storage.remove("user");
                this._updateAuthUI(null);
            }
        } else {
            // Cập nhật lại giao diện dựa khi không có thông tin user
            this._updateAuthUI(null);
        }
    }

    /* Xử lý chức năng đăng xuất */
    async logout() {
        // Lấy refresh_token từ localStorage
        const refreshToken = storage.get("refresh_token");

        try {
            if (refreshToken) {
                await httpRequest.post("auth/logout", {
                    refresh_token: refreshToken,
                });
            }
        } catch (error) {
            console.log(error);
        } finally {
            // Xoá dữ liệu ở localStorage
            storage.remove("access_token");
            storage.remove("refresh_token");
            storage.remove("user");

            // Cập nhật giao diện khi chưa đăng nhập
            this._updateAuthUI(null);

            // Hiển thị thông báo đăng xuất thành công
            Toast.success("Logout successful!");

            if (this.router) {
                this.router.navigate("/");
            }
        }
    }
}

export default Auth;
