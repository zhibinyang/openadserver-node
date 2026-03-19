# 事件管道部署文档：Kafka → Flink → Kafka → ClickHouse

## 架构概述

本项目采用 **Kafka → Flink (Protobuf 消费 +  temporal JOIN) → Kafka (JSON 输出) → ClickHouse (Kafka Engine + 物化视图 → MergeTree)** 的架构处理广告事件数据流。

```
┌──────────────┐
│  openadserver│
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  Raw Kafka   │  (6 topics: REQUEST, AD, IMPRESSION, CLICK, CONVERSION, VIDEO_VTR)
│  Protobuf    │
└──────────────┘
       │
       ▼
┌──────────────┐
│    Flink     │  流处理 +  temporal join
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Processed    │  (7 topics: FLINK_REQUEST, FLINK_AD, FLINK_AD_IMPRESSION,
│   Kafka      │   FLINK_AD_CLICK, FLINK_AD_CONVERSION, FLINK_VIDEO_VTR, FLINK_AD_VIDEO_VTR)
│    JSON      │
└──────┬───────┘
       │
       ▼
┌──────────────┐  ┌────────────────┐  ┌───────────────┐
│ Kafka Engine │─▶│ Materialized   │─▶│   MergeTree   │
│  (virtual)   │  │      View      │  │ (final storage)│
└──────────────┘  └────────────────┘  └───────────────┘
```

## 为什么选择这个架构？

对比之前 **Flink 直连 ClickHouse** 方案的优势：

| 对比项 | Flink → Kafka → ClickHouse | Flink 直连 ClickHouse |
|--------|---------------------------|----------------------|
| 稳定性 | ✅ 只用 Flink 官方自带 Kafka 连接器，最稳定 | ⚠️ 需要第三方 ClickHouse 连接器，依赖维护 |
| 容错性 | ✅ ClickHouse 停机时 Kafka 缓存数据，恢复后自动追赶 | ⚠️ Flink checkpoint 失败可能导致数据丢失 |
| 流量控制 | ✅ ClickHouse 根据自身负载控制消费速率 | ⚠️ Flink 写入速度可能超过 ClickHouse 承受能力 |
| 调试难度 | ✅ 可以先看 Kafka 输出验证 Flink 结果，再查 ClickHouse | ⚠️ 需要同时排查 Flink 和 ClickHouse 两边问题 |
| 运维成本 | ✅ 架构解耦，易于扩容和监控 | ⚠️ Flink 和 ClickHouse 耦合在一起 |

## 前置条件

1. Docker 容器已启动：`kafka`, `flink-jobmanager`, `flink-taskmanager`, `clickhouse`
2. 宿主机已安装：`protobuf-compiler`, `openjdk-17-jdk` (用于编译 Protobuf)
3. 所有容器在同一个 Docker network 中，互相可以访问
4. Flink 已经挂载 volume: `./flink/protobuf:/opt/flink/protobuf`

## 文件说明

| 文件 | 作用 |
|------|------|
| `events.proto` | Protobuf 消息定义（所有事件类型）|
| `build.sh` | 编译脚本：将 Protobuf 编译为 Java 类并打包成 `events.jar` |
| `event-pipeline.sql` | Flink SQL 作业定义：source tables, sink tables, streaming jobs |
| `clickhouse-init.sql` | ClickHouse 初始化 DDL：创建 Kafka Engine 表、MergeTree 表、物化视图 |
| `deploy.sh` | **一键部署脚本**：自动完成编译→部署→初始化全过程 |
| `events.jar` | 编译产物：Protobuf 生成的 Java 类，Fink 需要这个来反序列化 Protobuf 消息 |

## 关键设计要点

### 1. Protobuf 与 Flink 集成

- Flink 的 Protobuf format 需要提前将 Protobuf 定义编译为 Java 类
- 必须打包成 JAR 并让 Flink 加载
- 必须**目标 Java 11**，因为 Flink 1.18 运行在 Java 11 上
- 如果用 Java 17+ 编译不加 `-target 11` 会产生不兼容的字节码版本（错误：`UnsupportedClassVersionError`）

### 2. Temporal Join （时态连接）

- 用于把后续事件（Impression/Click/Conversion）和广告事件（AdEvent）关联起来
- Flink **强制要求** `FOR SYSTEM_TIME AS OF` 后面必须跟左表的**时间属性字段**
- 不能用 Kafka 元数据的 `timestamp`，必须从 `event_time` (epoch 毫秒) 生成计算列：
  ```sql
  event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3)
  ```
- 然后 JOIN 语句要用这个计算列：
  ```sql
  INNER JOIN impression_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS i
  ```

**错误模式**（会验证失败）：
```sql
-- 错误：不能用 a.`timestamp` (Kafka 元数据)
INNER JOIN impression_events_kafka FOR SYSTEM_TIME AS OF a.`timestamp` AS i
```

### 3. ClickHouse 消费架构

- **Kafka Engine**：虚拟表，直接连接 Kafka，不存储数据
- **MergeTree**：最终持久化表，按时间排序存储
- **Materialized View**：自动监听 Kafka Engine，把数据异步写入 MergeTree

ClickHouse 自动处理：
- 消费失败重试
- 流量背压
- 重新平衡

## 一键部署

```bash
cd flink/protobuf
./deploy.sh
```

脚本会自动执行：
1. 重新编译 Protobuf → `events.jar`
2. 复制 `events.jar` 到两个 Flink 容器
3. 复制 `event-pipeline.sql` 到 Flink jobmanager
4. 在 Flink SQL Client 中执行 SQL，创建所有表和启动流作业
5. 在 ClickHouse 中执行初始化 DDL，创建所有表和物化视图

## 手动部署步骤（参考）

如果一键脚本失败，可以手动分步执行：

### 步骤 1：编译 Protobuf

```bash
cd flink/protobuf
./build.sh
```

输出：`./events.jar`

### 步骤 2：复制文件到容器

```bash
docker cp ./events.jar flink-jobmanager:/opt/flink/protobuf/events.jar
docker cp ./events.jar flink-taskmanager:/opt/flink/protobuf/events.jar
docker cp ./event-pipeline.sql flink-jobmanager:/opt/flink/protobuf/event-pipeline.sql
```

### 步骤 3：提交 Flink SQL

```bash
docker exec flink-jobmanager ./bin/sql-client.sh -f /opt/flink/protobuf/event-pipeline.sql
```

> 注意：Flink 流作业提交后不会退出，会一直运行。所以 SQL Client 执行完所有 DDL 后会被中断，这是正常的。只要前面所有语句都显示 `[INFO] Execute statement succeed.` 就成功了。

### 步骤 4：初始化 ClickHouse

```bash
docker cp ./clickhouse-init.sql clickhouse:/tmp/clickhouse-init.sql
docker exec -i clickhouse clickhouse-client -n < /tmp/clickhouse-init.sql
```

## 验证部署

### 1. 检查 Flink

访问 Flink Web UI: http://localhost:8081

可以看到：
- 7 个运行中的流作业（可能因为资源限制只有部分运行，其余重启中，这在单机开发环境正常）
- 没有异常错误（检查 Job 日志）

### 2. 检查 ClickHouse 表

```bash
echo "SHOW TABLES;" | docker exec -i clickhouse clickhouse-client
```

应该看到 21 张表：
- 7 张 `*_kafka` (Kafka Engine)
- 7 张不带后缀 (MergeTree)
- 7 张 `*_mv` (Materialized View)

### 3. 检查数据流动

启动 openadserver 产生测试事件：
```bash
npm run start:dev
```

一段时间后在 ClickHouse 查询：
```sql
SELECT COUNT(*) FROM request_events;
SELECT COUNT(*) FROM ad_events;
```

计数应该大于 0，表示数据正常流动。

## 常见问题与解决方案

### 问题 1: `./build.sh: line 17: protoc: command not found`

**原因**: 宿主机没安装 Protobuf 编译器

**解决**:
```bash
sudo apt-get update && sudo apt-get install -y protobuf-compiler
```

---

### 问题 2: `./build.sh: line 36: javac: command not found`

**原因**: 宿主机没安装 Java JDK

**解决**:
```bash
sudo apt-get update && sudo apt-get install -y openjdk-17-jdk
```

---

### 问题 3: `java.lang.UnsupportedClassVersionError: events/Events$RequestEvent has been compiled by a more recent version of the Java Runtime`

**原因**: 编译时没有指定 target Java 版本，生成的字节码版本太高（Flink 1.18 只支持到 Java 11，字节码版本 55.0）

**解决**: `build.sh` 已经添加 `-target 11 -source 11`，重新编译即可：
```bash
./build.sh
./deploy.sh
```

---

### 问题 4: `org.apache.flink.table.api.ValidationException: Temporal table join currently only supports 'FOR SYSTEM_TIME AS OF' left table's time attribute field`

**原因**: JOIN 使用了 `a.timestamp` (Kafka 元数据)，不是左表定义的时间属性

**解决**: 必须在 AdEvents 表添加计算列，然后 JOIN 使用这个计算列：
```sql
-- 在 ad_events_kafka 表定义中添加
event_time_ts AS TO_TIMESTAMP_LTZ(event_time, 3),

-- 然后 JOIN 语句改为
INNER JOIN impression_events_kafka FOR SYSTEM_TIME AS OF a.event_time_ts AS i
```

---

### 问题 5: Flink 报错 `Could not acquire the minimum required resources`

**原因**: 单机开发环境只有一个 task slot，但是有 7 个作业需要运行，资源不够

**解决**: 这在开发环境是正常现象。Flink 会自动重试，有空闲槽就会运行。如果需要全部同时运行，增加 taskmanager 的 `taskmanager.numberOfTaskSlots` 配置或者启动多个 taskmanager。

---

### 问题 6: ClickHouse 报 `Syntax error (Multi-statements are not allowed)`

**原因**: ClickHouse 客户端默认不允许多语句，必须加 `-n` 参数

**解决**: 执行初始化必须用：
```bash
docker exec -i clickhouse clickhouse-client -n < /tmp/clickhouse-init.sql
```

## 修改 Protobuf 定义

如果需要修改 `events.proto` 添加新字段：

1. 修改 `events.proto`
2. 重新运行 `./deploy.sh`
3. 重启 Flink 作业（或者在 SQL Client 中 DROP TABLE 然后重新执行 SQL）

## 数据模型

### 输入 Topic (Protobuf)

| Topic | Message Type | 说明 |
|-------|--------------|------|
| `REQUEST` | RequestEvent | 广告请求事件 |
| `AD` | AdEvent | 广告返回事件（每个请求返回的每个广告）|
| `IMPRESSION` | ImpressionEvent | 展示回调 |
| `CLICK` | ClickEvent | 点击回调 |
| `CONVERSION` | ConversionEvent | 转化回调 |
| `VIDEO_VTR` | VideoVTREvent | 视频播放进度事件 |

### 输出 Topic (JSON → ClickHouse)

| Topic | ClickHouse Table | 说明 |
|-------|-----------------|------|
| `FLINK_REQUEST` | `request_events` | 扁平化后的请求事件 |
| `FLINK_AD` | `ad_events` | 扁平化后的广告事件 |
| `FLINK_AD_IMPRESSION` | `ad_impression_joined` | 广告 + 展示 JOIN 结果 |
| `FLINK_AD_CLICK` | `ad_click_joined` | 广告 + 点击 JOIN 结果 |
| `FLINK_AD_CONVERSION` | `ad_conversion_joined` | 广告 + 转化 JOIN 结果 |
| `FLINK_VIDEO_VTR` | `video_vtr_events` | 视频进度事件 |
| `FLINK_AD_VIDEO_VTR` | `ad_video_vtr_joined` | 广告 + 视频进度 JOIN 结果 |

## 维护

- `events.jar` 不需要放到 git，因为每次部署会重新编译
- 如果需要重新全量部署，直接运行 `./deploy.sh` 即可
- ClickHouse 表创建支持 `IF NOT EXISTS`，重复执行不会报错

## 回退到原架构（Flink 直连 ClickHouse）

如果需要切回原来直连方案：
```bash
git checkout flink/event-pipeline.sql
```

---

## 校准因子计算 Pipeline (Calibration Pipeline)

### 概述
新增独立的 Flink SQL 作业用于全局统一计算 CTR/CVR 校准因子，替代原有的 AdServer 直连 Redis 计算模式，解决多实例写入冲突、分散计算等问题。

### 架构
```
┌──────────────────────┐        ┌───────────┐        ┌───────────────────────────┐
│ AdServer 产生事件     │────────►   Kafka   │────────► Flink 24h 滑动窗口聚合     │
│ (自动发送到Kafka)     │        │  事件流   │        │  - 多流JOIN关联所有事件    │
└──────────────────────┘        └───────────┘        │  - 自动计算校准因子        │
                                                     └─────────────┬─────────────┘
                                                                   │
                                                                   ▼
                                                     ┌───────────────────────────┐
                                                     │ Redis 全局缓存             │
                                                     │ Key: calib:global:{campaignId}:{slotId} │
                                                     │ Value: JSON包含ctr_factor/cvr_factor/update_time │
                                                     └───────────────────────────┘
```

### 文件说明
| 文件 | 作用 |
|------|------|
| `calibration-pipeline.sql` | 校准因子计算 Flink SQL 作业定义 |

### 部署步骤
1. 确保 Redis 连接器已在 Flink 集群中安装：
   ```bash
   # 下载 Redis 连接器
   wget https://repo1.maven.org/maven2/org/apache/flink/flink-connector-redis_2.12/1.17.1/flink-connector-redis_2.12-1.17.1.jar
   # 复制到 Flink 容器
   docker cp flink-connector-redis_2.12-1.17.1.jar flink-jobmanager:/opt/flink/lib/
   docker cp flink-connector-redis_2.12-1.17.1.jar flink-taskmanager:/opt/flink/lib/
   # 重启 Flink 集群加载新连接器
   docker restart flink-jobmanager flink-taskmanager
   ```

2. 提交校准作业：
   ```bash
   docker cp ./calibration-pipeline.sql flink-jobmanager:/opt/flink/protobuf/calibration-pipeline.sql
   docker exec flink-jobmanager ./bin/sql-client.sh -f /opt/flink/protobuf/calibration-pipeline.sql
   ```

### 双模式切换
AdServer 支持两种模式通过环境变量切换：
- `CALIBRATION_MODE=direct`（默认）：原有直连 Redis 模式，AdServer 自行计算并写入 Redis
- `CALIBRATION_MODE=global`：全局 Flink 模式，AdServer 只读取全局 Redis Key，写入逻辑由 Flink 统一处理

### 降级方案
如果 Flink 作业出现故障：
1. 将 AdServer 环境变量 `CALIBRATION_MODE` 改回 `direct`
2. 重启 AdServer 实例即可自动切换回原有模式
3. 业务无中断，校准因子会由 AdServer 自动重新计算

