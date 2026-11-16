# 2D / 3D 版本与仓库

2026-11-16，老板决定“停止 2D 版本研发，做 3D 版本，上传 GitHub 时区分两个仓库”，随后明确“重新做 3D，之前效果不接受”。这是当前执行方向，覆盖旧日志、旧计划中“停止 3D”或“在 2D 标题旁附加原型”的指令。

| 版本 | 本地位置 | GitHub | 状态 |
| --- | --- | --- | --- |
| 2D | 本工作区根目录 | [huisha_game_AI](https://github.com/huachen19867/huisha_game_AI) | 第三十七轮成果封存，停止研发 |
| 3D | `huisha-3d/`，独立 `.git` | [huisha_game_3d](https://github.com/huachen19867/huisha_game_3d) | 独立重新制作，第一章“归门” |

根仓库忽略 `huisha-3d/`，不能把它作为子模块或普通子目录上传到 2D 仓库。3D 内不携带 Phaser、2D 入口、2D 源码或 2D 存档。新章的浏览器存档键为 `huisha.3d.homecoming.v1`，不读取 2D 进度。

旧 `prototype3d.html`、`src/3d/`、`vendor/three.min.js`、`美术/` 和两份旧 3D 检查仅从根 Git 的追踪范围移出，本地文件保留。新版本没有继续用旧布局/家具贴片；可用原始木材另复制到新项目，原件不覆盖。旧提交历史依然完整，不强推、不改写历史。

2D 保留原 `StartGame.bat` / `index.html`，3D 从独立目录的 `StartGame.bat` 启动，默认访问 `http://127.0.0.1:8133`。3D 通过本地服务加载模块和真实模型，不能沿用 2D 的单 HTML 双击假设。新章设计、验证边界和进度在 3D 自己的 README、DEV_LOG 和 ROADMAP 中维护。

此前浏览器启动被自动审批拦截，本次没有重新发起或换工具绕过。模型解析、几何射线、机关状态与静态 HTTP 检查不等于 WebGL 画面、手机或完整实机验收。
