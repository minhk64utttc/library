# Quy tắc Web — apps/web/src/features/**

- Dùng Vue SFC với script setup lang="ts"; logic theo features, UI dùng chung trong src/shared/components.
- Chỉ gọi mạng qua src/shared/api/client.ts dùng fetch: xử lý !response.ok, 401/403, 204, AbortSignal và lỗi mạng.
- Không lưu session token trong localStorage. Không tự suy ra quyền từ menu hoặc role người dùng chọn.
- Router guard cải thiện trải nghiệm; API vẫn là nơi kiểm soát quyền và dữ liệu.
- Hiển thị văn bản bằng {{ value }} hoặc v-text. Không tự esc trước nội suy Vue; tránh double-escape.
- Không dùng v-html, innerHTML hoặc template động cho dữ liệu người dùng. Rich text nếu có phải dùng sanitizer được duyệt và test XSS.
- URL và tệp phải validate riêng; escape văn bản không làm một URL javascript: trở nên an toàn.
- Mỗi màn có loading, empty, error và success; khóa submit khi pending, tránh request trùng.
- Bộ lọc khớp đúng thuộc tính; đồng bộ query params cho tìm/lọc/sort/page, không chỉ ẩn hàng DOM.
- Lưu trạng thái cần thiết khi quay lại danh sách; thay filter thì reset page; đăng xuất phải xóa state riêng của tài khoản.
- Table dùng API pagination; aria-sort cho cột sắp xếp, nhãn rõ cho nút điều hướng trang.
- Menu có aria-current; tab/nút chọn có trạng thái ARIA phù hợp. Dialog quản lý focus, Escape và trả focus về nút mở.
- Mobile có menu thu gọn với aria-expanded; form có label, thông báo lỗi liên kết trường; không dùng màu làm tín hiệu duy nhất.
- Hồ sơ cá nhân gom liên hệ, ảnh và đổi mật khẩu. Thẻ chỉ hiện khi có liên kết; người dùng không tự sửa vai trò/hiệu lực thẻ.
- Không hiển thị hồ sơ Minh Anh mặc định cho mọi người đăng nhập; lấy /me và dữ liệu theo phiên.
- Preview ảnh có giới hạn và thu hồi object URL; kiểm tra phía client không thay kiểm tra server.
- Giữ tiếng Việt thống nhất. Không giả thông báo thành công khi API lỗi hoặc chưa có backend.
- Kiểm thử Vue component bằng công cụ phù hợp (đề xuất Vitest + Vue Test Utils); Playwright cho hành trình nghiệp vụ quan trọng.
