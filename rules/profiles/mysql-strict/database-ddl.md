# 数据库 DDL 设计硬规则

**触发场景：** 方案涉及任何建表 / 改表 / 加索引时必须遵守。`state.md` 的冻结
契约、相关 Execution Unit 与后续实施都要满足，任何阶段都不允许放过任一条。

## 1. 五项硬规则

1. **三个必填公共字段**：每张表必须包含以下三列，且定义**完全一致**——
   ```sql
   id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
   create_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT '创建时间',
   update_time DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3) COMMENT '更新时间'
   ```
2. **禁止显式声明字符集**：DDL 中**不允许**出现 `DEFAULT CHARSET=utf8mb4`、`CHARACTER SET ...`、`COLLATE ...` 等字符集 / 排序规则声明，统一由库级默认配置兜底。
3. **索引命名规范**：普通索引前缀必须是 `idx_`，唯一索引前缀必须是 `uniq_`；联合索引按字段顺序命名（如 `idx_user_id_status`）。
4. **索引数量上限**：单表索引总数（含主键、唯一索引、普通索引、联合索引等所有索引）**不得超过 5 个**；超过则必须在 `state.md` Decisions 中给出取舍并削减。
5. **注释完整**：DDL 中**每一个字段**都必须带 `COMMENT '...'`，**每张表**都必须带表级 `COMMENT='...'`；没有注释的 DDL 一律视为不合格。

## 2. 自检 checklist（state 冻结 / 规划 / 实施每个阶段都要跑一遍）

- [ ] 三公共字段是否完整、定义与上文一字不差？
- [ ] 是否误带了 `CHARSET` / `CHARACTER SET` / `COLLATE` 声明？
- [ ] 所有普通索引前缀 `idx_`、所有唯一索引前缀 `uniq_`？
- [ ] 单表索引总数 ≤ 5（含主键）？如超出，是否在 state 中写明削减理由？
- [ ] 每个字段是否都有 `COMMENT`？每张表是否都有表级 `COMMENT`？

任何一条不通过都必须**修到通过**才能进入下一步；结论与适用 Contract /
Acceptance ID 写入 `state.md`，原始检查证据按需进入 `evidence/`。

## 3. 反例（不要这么写）

```sql
-- ❌ 缺 create_time / update_time，索引无前缀，无注释，带字符集
CREATE TABLE user (
  id BIGINT PRIMARY KEY,
  name VARCHAR(64),
  INDEX user_name(name)
) DEFAULT CHARSET=utf8mb4;
```
