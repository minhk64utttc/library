# thu-vien

Hệ thống quản lý thư viện dưới dạng monorepo npm workspaces: một backend NestJS, một frontend Vue 3 và một gói dùng chung.

## Cấu trúc

- `apps/api` — NestJS; module nghiệp vụ dưới `src/modules/`; Prisma + PostgreSQL.
- `apps/web` — Vue 3 + Vite; feature dưới `src/features/`; gọi API qua `src/shared/api/client.ts`.
- `packages/shared` — Zod schema, enum, khai báo vai trò/quyền dùng chung.
- `docs` — quy tắc nghiệp vụ, rules, prototype đối chiếu, UML và ADR.

Vai trò quyết định quyền và menu, không quyết định nơi chứa mã chức năng. Một backend và một frontend; chưa cần microservices.

## Yêu cầu

- Node 20 trở lên
- Docker (PostgreSQL và Mailpit qua `docker-compose.yml`)

## Bắt đầu

```bash
npm install
docker compose up -d
npm run dev:api
npm run dev:web
```

## Kiểm thử

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

Các lệnh trên là hợp đồng dự kiến; xác nhận sau khi cài dependency và bootstrap Prisma.
