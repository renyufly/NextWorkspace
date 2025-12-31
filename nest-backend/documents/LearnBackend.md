npm run start



# Database

```sh
npm i -D prisma
npm install @prisma/client

npx prisma init

npm install pg
```

## PostgreSQL

```sql
psql -U postgres -d workspacedb  # 连接超级管理员用户：postgres  并连接database

CREATE DATABASE workspacedb;     # 注意结尾分号
```

## Prisma 连接数据库

如果Pg未启动，去系统服务手动启动。

首先去backend大文件夹里的 `.env` 配置中设置：

`DATABASE_URL="postgresql://postgres:你的密码@localhost:5432/mydb?schema=public"`

```sh
#prisma/schema.prisma中
model User {
  id    Int     @id @default(autoincrement())
  name  String
  email String  @unique
}

# 每次在prisma/schema.prisma中新增表或修改表字段时
npx prisma migrate dev --name init
# 会读取 PrismaService 中的 DATABASE_URL；创建 User 表

npx prisma studio  # 可视化查看表
```

所有后端需要的数据库表都在 `prisma/schema.prisma` 定义。
每一个 model 对应数据库里的表。

当你需要新增表或修改表字段时：

```sh
1.在 schema.prisma 里写好新的 model 或修改字段
2.执行迁移命令，生成并应用到数据库:
npx prisma migrate dev --name 自定义_迁移名称

# 对于生产环境，可以使用：
npx prisma migrate deploy
```

> Prisma 会生成 SQL 并在数据库里创建/修改表；
>
> 每次修改 schema.prisma 都需要执行一次迁移
>
> 不要直接在数据库里手动创建表或修改表结构，否则 Prisma 的迁移历史会和数据库不同步

总结流程：

1. 在 `schema.prisma` 写/改模型

2. 执行 `npx prisma migrate dev --name 描述`

3. Prisma 自动生成 SQL 并修改数据库

4. NestJS 后端通过 PrismaService 使用新表

5. 每次有新表或修改字段，就重复这个流程，不用手动写 SQL。