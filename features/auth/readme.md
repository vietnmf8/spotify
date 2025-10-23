**Khi khởi tạo**:

-   ĐÓNG_MODAL = true
-   Tạo các hành động:

*   **Khi click**
    -   Mở Modal từ đầu:
        -   Chuyển [ĐÓNG_MODAL] = false; (Vì đang mở modal)
        -   Khoá cuộn trang
        -   Quyết định là mở form đăng ký/đăng nhập: (Khi mở modal/ khi chuyển đổi giữa 2 modal đăng ký và đăng nhập)
            -   Nếu là đăng ký => Tải lại giá trị các trường được lưu ở đăng ký
        -   Tải lại giá trị các trường trong đăng ký
        -   Focus vào trường đầu tiên
    -   Đóng Modal:
        -   Chuyển [ĐÓNG_MODAL] = true
        -   Đóng modal
        -   Mở lại cuộn
        -   Xoá tất cả message lỗi (Không reset giá trị trong input)
    -   Chuyển đổi giữa 2 form:
        -   Xoá tất cả message lỗi
        -   Quyết định mở form Đăng ký/Đăng nhập
    -   Mở/đóng con mắt password:
        -   Xử lý mật khẩu có type là [text] hay [password]
*   **Lặp qua các input vào thêm 2 sự kiện là [input] và [blur]**
    -   Khi nhập [input]:
        -   Thực hiện validate mỗi trường:
            -   Xoá lỗi khi người dùng nhập lại
            -   Hiển thị lỗi nếu valid thất bại
            -   Cập nhật toàn form => trạng thái nút submit
        -   Lưu giá trị được nhập theo trường dữ liệu vào localStorage
        -   (Có thể xoá lỗi và cập nhật toàn form)
    -   Khi bị thoát focus khỏi ô input [blur]:
        -   Xoá lỗi khi người dùng nhập lại
        -   Hiển thị lỗi nếu valid thất bại
        -   Cập nhật toàn form => trạng thái nút submit
        -   Thực hiện validate
*   **Tạo hành động submit cho [form]**

    -   Nhấn vào nút [submit]

        -   Xoá toàn bộ message lỗi
        -   Kiểm tra valid toàn form
        -   Bật loading
        -   Tạo trường thông tin gửi đi
        -   Thực hiện call API
        -   Thành công:

            -   Lưu thông tin được trả về vào localStorage
            -   Đóng modal và hiện Toast
            -   Cập nhật giao diện header khi có thông tin:
                -   Nếu có thông tin => ẩn 2 nút Sign up / Login => hiện avatar
                -   Nếu không có thông tin => ngược lại
            -   Xoá giá trị được lưu tại các trường trong localStorage:
                -   Xoá tất cả message trong form
                -   Validate lại toàn form => disabled nút submit

        -   Thất bại:
            -   Hiện lỗi từ server
        -   Cuối cùng:
            -   Tắt loading

-   Cập nhật trạng thái ban đầu
-   Kiểm tra toàn form và cập nhật trạng thái DISABLED nút SUBMIT
