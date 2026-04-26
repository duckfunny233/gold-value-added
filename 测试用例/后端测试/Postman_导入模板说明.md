# Postman 导入模板说明

本目录新增了 3 个可直接用于 Postman 的模板文件：

1. `postman_collection_template.json`
2. `postman_environment_template.json`
3. `postman_testcases_template.csv`

## 一、导入顺序

1. 打开 Postman
2. 导入 `postman_collection_template.json`
3. 导入 `postman_environment_template.json`
4. 选中环境 `金影子-后端测试环境模板`
5. 在 Collection Runner 中选择 `postman_testcases_template.csv` 作为数据源

## 二、用例字段规范（已内置在 CSV）

用例字段满足你要求的格式，并加了可执行断言字段：

- `编号`
- `测试点`
- `测试设计方法`（等价类/边界值/场景法/错误推测）
- `前置条件`
- `步骤`
- `数据`
- `预期结果`
- `username`
- `password`
- `预期HTTP状态`
- `预期业务码`
- `预期message关键字`

## 三、四种测试方法如何写

1. 等价类
- 有效等价类：正确账号 + 正确密码
- 无效等价类：不存在账号、错误密码

2. 边界值
- 密码长度边界：`min-1`、`min`、`min+1`
- 用户名长度边界：`min-1`、`min`、`min+1`

3. 场景法
- 主场景：注册 -> 登录 -> 获取资料
- 备选场景：注册资料不完整 -> 修正后再注册
- 异常场景：账号冻结后登录

4. 错误推测
- 缺少必填字段
- 错误 Content-Type
- 过期 token
- 重复提交

## 四、落地建议

1. 每个接口单独一份 CSV，字段一致，便于复用脚本。
2. 先覆盖 `auth/fund/trade/risk` 的 P0 接口。
3. 断言至少包含：HTTP 状态、`code`、`message`、`data`。
