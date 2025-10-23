/* Kiểm tra input có rỗng hay không? */
export function isNotEmpty(value) {
    return value.trim() !== "";
}

/* Kiểm tra định dạng email có hợp lệ không? */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/* Kiểm tra độ phức tạp của mật khẩu */
export function validatePassword(password) {
    // Mật khẩu nhỏ hơn 8 ký tự
    if (password.length < 8) {
        return {
            isValid: false,
            message: "Password must be at least 8 characters.",
        };
    }
    // Mật khẩu không chứa chữ thường
    if (!/[a-z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one lowercase letter.",
        };
    }

    // Mật khẩu không chứa chữ IN HOA
    if (!/[A-Z]/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one uppercase letter.",
        };
    }

    // Mật khẩu không chứa 1 số
    if (!/\d/.test(password)) {
        return {
            isValid: false,
            message: "Password must contain at least one number.",
        };
    }

    return { isValid: true, message: "" };
}
