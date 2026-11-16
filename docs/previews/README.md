# 美术预览索引

第三十四轮新增 [crash-scene-v1.png](crash-scene-v1.png)，展示来源地图中的车头/护栏断口、路面标线/刹车痕、西侧门口和东侧石阶。用 `& .\tools\preview_pixel_textures.ps1 -CrashScene` 重建；-CrashScene 与 -MemoryRooms 互斥，不带参数仍重建素材表。新模式复用同份像素与布局绘制，并遵循单个物件的 tint。图中墙体为简绘，无动态光照、镜头、角色或游戏中的移动，是布局研究图，不是实玩截图。

第三十三轮新增 [memory-rooms-v1.png](memory-rooms-v1.png)，并为原素材联系表补入九张学校/医院布置纹理。布局图由真实 Maps 坐标与 ManorPresentation 像素配方组成，包含地面材质 tint；墙体简绘，标出默认入口，不含动态光照、角色、镜头、遮挡运行或触屏界面，不是游戏截图。可用它核对器物位置、桌面纸张和大致空隙，不能用它证明实际碰撞与游戏听感已验收。

在项目根 PowerShell 运行 `& .\tools\preview_pixel_textures.ps1 -MemoryRooms` 可重建布局图；不带参数仍重建原素材联系表，可用 `-OutputPath` 指定另一输出路径。二者共用同份配方读取与绘制逻辑，没有新增运行依赖。

`pixel-textures-v1.png` 为 2026-11-15 创建、11 月 16 日核对的程序纹理联系表，展示六类地面、文书、香、纸钱、钥匙、供桌、衣柜、守灯供物、关闭/打开的保险箱、停放/事故车辆、刻痕门柱、取钥匙前后的水井、盖布/揭开的遗像，以及学校黑板/成绩单、诊室窗口/空病床、事故护栏和走廊封窗等专用物证外形。第十八轮加入厨房橱柜与暗室工作台取饭/火柴前后的四张纹理。它不是游戏截图，不含 Phaser 光照、镜头缩放、角色或界面，不能证明场景可读性已完成浏览器验收。

在项目根目录的 PowerShell 会话运行 `& .\tools\preview_pixel_textures.ps1` 可重建。工具通过 Node 调用实际 `ManorPresentation.generateTextures()`，收集其矩形绘制指令，再用 Windows System.Drawing 按整数倍绘制 PNG，无新增 npm 依赖。它只支持本项目目前使用的 fillRect 像素绘制；将来引入其他绘制方式时需同步扩展。

第二十一轮加入 `coffin` 与 `coffin_1` 至 `coffin_7`，展示三圈红线松紧的全部组合；同为 64×128，仍处于锁未打开的阶段。预览核对后将线结绘制顺序移到纸面上方，使中圈松紧可见。

第二十二轮加入 `mountain_path` 与 `manor_threshold`，分别呈现终章山路和旧宅入口；预览只核对路标、石阶和亮门缝的轮廓，不代表游戏内比例与光照已验收。

此预览用于目视检查素材的色彩与轮廓，并未启动浏览器或游戏。素材定义与玩法接入仍以 `src/systems/ManorPresentation.js` 和 `src/systems/MapManager.js` 为准。
