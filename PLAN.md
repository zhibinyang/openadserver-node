# 用户画像与人群包系统 Redis 重构计划

## 目标
将当前基于 PostgreSQL 的用户管理方案迁移到完全基于 Redis 的架构，满足广告引擎（DSP）对极低延迟的要求。

## 当前架构分析

### 现有数据结构
- `user_profiles` 表：存储用户画像（age, gender, interests, tags, custom_attributes）
- `segments` 表：人群包元数据
- `segment_users` 表：用户与人群包的多对多关系
- `user_identities` 表：多ID映射（device_id, idfa, gaid等）

### 现有服务
- `UserProfileService`：用户画像CRUD
- `SegmentService`：人群包管理
- `UserIdentityService`：身份解析

---

## 重构方案

### 第一阶段：Redis Key 设计

#### 1. 身份解析层 (Identity Map)
```
Key:   alias:{id_type}:{id_value}
Value: internal_uid (系统生成的唯一ID)
TTL:   30天（活跃用户自动续期）

示例:
alias:device_id:abc123 -> "iu_7f8a9b2c"
alias:idfa:XXXX-XXXX-XXXX -> "iu_7f8a9b2c"
alias:email_hash:sha256... -> "iu_7f8a9b2c"
```

#### 2. 用户画像层 (User Profile)
```
Key:   u:p:{internal_uid}
Type:  Hash
Fields:
  - age: "25"
  - gender: "male"
  - interests: '["tech","sports"]'  (JSON压缩)
  - tags: '["premium","active"]'
  - custom: '{"ltv":100}'  (JSON压缩)
TTL:   30天（活跃用户自动续期）
```

#### 3. 人群包层 (User Segments)
```
Key:   u:s:{internal_uid}
Type:  Set
Members: segment_id 列表
TTL:   根据人群包时效性动态设置

示例:
u:s:iu_7f8a9b2c -> {1, 5, 12, 30}
```

#### 4. 人群包反向索引 (可选，用于批量操作)
```
Key:   s:u:{segment_id}
Type:  Set
Members: internal_uid 列表
TTL:   与人群包生命周期一致
```

---

### 第二阶段：服务重构

#### 1. RedisUserService (新建)
核心服务，替代 PostgreSQL 的用户数据存储

```typescript
class RedisUserService {
  // 身份解析
  async resolveIdentity(idType: string, idValue: string): Promise<string>
  async linkIdentity(internalUid: string, idType: string, idValue: string): Promise<void>
  async createNewUser(idType: string, idValue: string): Promise<string>

  // 画像操作
  async getProfile(internalUid: string): Promise<UserProfile | null>
  async updateProfile(internalUid: string, data: Partial<UserProfile>): Promise<void>
  async updateProfileField(internalUid: string, field: string, value: any): Promise<void>

  // 人群包操作
  async getSegmentIds(internalUid: string): Promise<number[]>
  async addToSegment(internalUid: string, segmentId: number, ttl?: number): Promise<void>
  async removeFromSegment(internalUid: string, segmentId: number): Promise<void>
  async isInSegment(internalUid: string, segmentId: number): Promise<boolean>

  // TTL管理
  async refreshTTL(internalUid: string): Promise<void>
}
```

#### 2. RedisSegmentService (新建)
人群包管理服务

```typescript
class RedisSegmentService {
  // 人群包元数据（仍保留PostgreSQL）
  async createSegment(data: CreateSegmentDto): Promise<Segment>
  async getSegment(segmentId: number): Promise<Segment | null>

  // 用户批量操作
  async addUsersToSegment(segmentId: number, identities: IdentityItem[]): Promise<number>
  async removeUsersFromSegment(segmentId: number, identities: IdentityItem[]): Promise<number>

  // 统计
  async getSegmentUserCount(segmentId: number): Promise<number>
}
```

#### 3. RedisService 扩展
添加 Hash 和 Set 操作方法

```typescript
// 新增方法
async hset(key: string, field: string, value: string): Promise<void>
async hget(key: string, field: string): Promise<string | null>
async hgetall(key: string): Promise<Record<string, string>>
async hdel(key: string, ...fields: string[]): Promise<void>

async sadd(key: string, ...members: string[]): Promise<number>
async srem(key: string, ...members: string[]): Promise<number>
async sismember(key: string, member: string): Promise<boolean>
async smembers(key: string): Promise<string[]>
async scard(key: string): Promise<number>
```

---

### 第三阶段：竞价流程集成

#### 修改 TargetingMatcher
```typescript
// 原流程
1. 从请求获取 user_id
2. 查询 PostgreSQL user_profiles
3. 查询 PostgreSQL segment_users
4. 匹配定向规则

// 新流程
1. 从请求获取任意 ID (device_id/idfa/gaid等)
2. 查询 Redis alias:{id_type}:{id_value} -> internal_uid
3. 并行查询:
   - Redis u:p:{internal_uid} -> 画像
   - Redis u:s:{internal_uid} -> 人群包集合
4. 匹配定向规则
```

---

### 第四阶段：数据生命周期管理

#### TTL 策略
- 身份层 & 画像层：30天默认TTL
- 人群包层：根据人群包类型动态设置
  - 行为人群：7-30天
  - Lookalike人群：30天
  - 自定义人群：无过期或手动管理

#### 活跃用户续期
- 每次广告请求或行为上报时自动续期
- 使用 Redis pipeline 批量续期

#### 数据持久化
- 依赖 Redis AOF 持久化
- 可选：定期快照备份到对象存储

---

## 实施步骤

### Step 1: 扩展 RedisService
- 添加 Hash 操作方法 (hset, hget, hgetall, hdel)
- 添加 Set 操作方法 (sadd, srem, sismember, smembers, scard)
- 添加 pipeline 支持用于批量操作

### Step 2: 创建 RedisUserService
- 实现身份解析逻辑
- 实现画像 Hash 存储
- 实现人群包 Set 存储
- 实现 TTL 管理

### Step 3: 创建 RedisSegmentService
- 实现人群包用户管理
- 保留 segments 表用于元数据
- 实现批量用户操作

### Step 4: 重构竞价流程
- 修改 BidRequest 处理逻辑
- 集成新的身份解析
- 并行获取画像和人群包数据

### Step 5: 添加数据迁移工具
- PostgreSQL -> Redis 数据迁移脚本
- 支持增量同步

### Step 6: 测试与验证
- 单元测试
- 性能测试（延迟对比）
- 数据一致性验证

---

## 文件变更清单

### 新建文件
- `src/modules/engine/services/redis-user.service.ts`
- `src/modules/engine/services/redis-segment.service.ts`
- `src/modules/engine/services/identity-resolver.service.ts`

### 修改文件
- `src/shared/redis/redis.service.ts` - 添加 Hash/Set 方法
- `src/modules/engine/services/targeting-matcher.service.ts` - 集成新服务
- `src/modules/engine/engine.module.ts` - 注册新服务
- `src/database/schema.ts` - 保留但标记废弃

### 可选删除（迁移完成后）
- `user_profiles` 表相关代码
- `segment_users` 表相关代码
- `user_identities` 表相关代码
