-- 1. 创建专用的 Datastream 用户
CREATE USER datastream_user WITH REPLICATION PASSWORD 'datastream_password';

-- 2. 授予对业务数据库的连接权限
GRANT CONNECT ON DATABASE oas TO datastream_user;
GRANT USAGE ON SCHEMA public TO datastream_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO datastream_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO datastream_user;

-- 3. 创建发布（Publication），包含所有表
-- Datastream 会监听这个发布来获取变更
CREATE PUBLICATION ds_publication FOR ALL TABLES;