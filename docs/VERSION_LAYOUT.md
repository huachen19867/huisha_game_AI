# 2D / 3D 版本与仓库

2026-11-16，老板决定“停止 2D 版本研发，做 3D 版本，上传 GitHub 时区分两个仓库”，随后明确“重新做 3D，之前效果不接受”。这是当前执行方向，覆盖旧日志、旧计划中“停止 3D”或“在 2D 标题旁附加原型”的指令。

| 版本 | 本地位置 | GitHub | 状态 |
| --- | --- | --- | --- |
| 2D | 本工作区根目录 | [huisha_game_AI](https://github.com/huachen19867/huisha_game_AI) | 第三十七轮成果封存，停止研发 |
| 3D | `huisha-3d/`，独立 `.git` | [huisha_game_3d](https://github.com/huachen19867/huisha_game_3d) | 默认《回煞》，雨夜归宅主线 |

根仓库忽略 `huisha-3d/`，不能把它作为子模块或普通子目录上传到 2D 仓库。3D 内不携带 Phaser、2D 入口、2D 源码或 2D 存档。《回煞》主入口使用原老宅存档 `huisha.3d.homecoming.v1`，原地址 `guimen.html` 也通往主入口。《借影》仅作为独立实验保存。

旧 `prototype3d.html`、`src/3d/`、`vendor/three.min.js`、`美术/` 和两份旧 3D 检查仅从根 Git 的追踪范围移出，本地文件保留。新版本没有继续用旧布局/家具贴片；可用原始木材另复制到新项目，原件不覆盖。旧提交历史依然完整，不强推、不改写历史。

2D 保留原 `StartGame.bat` / `index.html`，3D 从独立目录的 `StartGame.bat` 启动，默认访问 `http://127.0.0.1:8133`。3D 通过本地服务加载模块和真实模型，不能沿用 2D 的单 HTML 双击假设。新章设计、验证边界和进度在 3D 自己的 README、DEV_LOG 和 ROADMAP 中维护。

2026-11-18 的 3D 发布是《回煞》0.17.0。Chromium WebGL 已验证老宅正厅、守夜灯、雨庭与厨房安全落点，原四结局规则回归通过。2D 封存版的独立入口检查通过。实体手机的帧率和触控手感仍待体验。
