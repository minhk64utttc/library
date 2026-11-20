# Quy tắc shared — packages/shared/**

- Chỉ chứa contracts, Zod schema, enum/constants và kiểu dữ liệu không phụ thuộc runtime.
- Không import Vue, NestJS, Prisma Client, Node fs, biến môi trường hoặc secrets.
- Không export Prisma entities trực tiếp cho frontend; tách Input và Response schemas rõ ràng.
- Suy kiểu từ Zod bằng z.infer khi có schema, tránh khai báo cùng cấu trúc hai lần.
- src/auth/roles.ts và src/auth/permissions.ts khai báo vai trò/quyền; API thực thi quyền, frontend dùng để hiển thị.
- Tách schemas theo contracts/auth, catalog, circulation, profile, pagination...; enums/ cho trạng thái dùng chung.
- Không dùng shared như thùng chứa mọi tiện ích; nghiệp vụ cần database ở service API.
- Build shared trước hoặc cấu hình workspace resolution thống nhất; không import xuyên ../../apps/.
- Kiểm thử schema với dữ liệu hợp lệ, sai kiểu, thiếu trường và giá trị biên.
- Không tạo một types.ts chứa mọi kiểu của hệ thống.
