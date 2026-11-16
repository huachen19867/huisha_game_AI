# 参考资料索引

第二十九轮于 2026-11-16 通过 GitHub 连接下载 [MDN exponentialRampToValueAtTime 文档](https://github.com/mdn/content/blob/main/files/en-us/web/api/audioparam/exponentialramptovalueattime/index.md)，保存为 [mdn-exponential-ramp.md](mdn-exponential-ramp.md)。作者为 MDN contributors，许可原文见 [mdn-LICENSE.md](mdn-LICENSE.md)：正文使用 CC BY-SA 2.5，示例另有代码许可说明。下载原文未改写，不进入游戏运行包；仅参考指数渐变目标值必须大于零的 API 约束，没有复制示例代码或引入依赖。官方阅读页为 [AudioParam: exponentialRampToValueAtTime()](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/exponentialRampToValueAtTime)。

第二十五轮于 2026-11-16 通过 GitHub 连接下载 [w3c/aria-practices 的模态对话框模式](https://github.com/w3c/aria-practices/blob/main/content/patterns/dialog-modal/dialog-modal-pattern.html)，保存为 [apg-dialog-modal-pattern.html](apg-dialog-modal-pattern.html)，源页面返回的修改时间为 2025-09-02。仓库许可保存为 [apg-LICENSE.md](apg-LICENSE.md)，指向 [W3C Software and Document License](https://www.w3.org/Consortium/Legal/copyright-software)。这是参考用的模式原文，不是完整离线演示，也不进入游戏运行包。主要核对长内容初始标题焦点、Tab/Shift+Tab 循环，以及关闭后返回触发者或合理替代控件；没有下载演示依赖或复制演示脚本。官方阅读页为 [Dialog (Modal) Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)。

`WritingWithInk.md` 下载自 [inkle/ink 写作指南](https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md)，对应许可保存在 `ink-LICENSE.txt`，于 2026-11-15 获取。主要参考条件选项、状态跟踪与分支汇流的设计方式。本游戏运行时继续使用原有 Phaser，不引入 Ink 编译器或运行库。

第三十轮复读已下载指南的 Conditional Choices 小节，参考按已见内容/状态调整选项与文字的方式，改进守灯的分段操作、材料限制与已读纸条回查。沿用原 Phaser 状态与供物表现，没有重复下载或复制 Ink 示例代码。

第三十一轮继续复用同一条件选项参考与已有事实对照研究，区分“已见线索可以提问”和“证据足够完成判断”。没有新增下载或运行依赖，完成条件仍由本项目原推理规则判断。

第三十二轮复读同一指南的 Global Variables 小节，参考将跨场景信息留在持久状态中的思路，为未提交推理保留选证与解释。使用原游戏的调查状态、安全存档和恢复流程，没有重复下载、复制示例或引入 Ink 运行库。

第二十七轮复用上述 W3C 模式关于难撤销操作默认聚焦较安全动作的建议，用于标题重新开始确认；没有重复下载或引入演示依赖。

原游戏仓库为 [huachen19867/huisha_game_AI](https://github.com/huachen19867/huisha_game_AI)，本轮直接基于它的地图、状态系统和纹理生成器修改。没有下载或采用第三方 3D 模型；老板已明确停止 3D 方向。

第二轮下载 [Yarn Spinner](https://github.com/YarnSpinnerTool/YarnSpinner)，固定 commit `0f3812ad5e0853fb0127559a7ec66defa2e24843`。本地 `YarnSpinner/` 是忽略入库的 sparse checkout，包含 README、MIT 许可 `LICENSE.md` 与 `YarnSpinner/` 运行库源文件。参考台词、选项和命令分离的接口方式，未给游戏新增依赖。复查可运行 `git -C docs/references/YarnSpinner rev-parse HEAD`。

第三十五轮复读本地 `YarnSpinner/Dialogue.cs` 的台词/选项接口说明，继续将记忆最后物件的阅读、整理和回返拆成自主操作。复用已有 checkout，没有重复下载、复制其 C# 实现或增加运行依赖。

《星际拓荒》《奥伯拉丁的回归》《返校》的一手来源链接、设计取舍和对应实装见 [2D_DESIGN_REFERENCES.md](../2D_DESIGN_REFERENCES.md)。这些商业作品仅作设计研究，没有复制代码或美术资源。

第四轮查阅 Frictional Games 官方恐怖设计文章，本地自己的短摘记见 [horror-pacing-notes.md](horror-pacing-notes.md)，不再分发原文与商业素材。追逐及环境声仍使用本地生成的纹理和 Web Audio 合成。

第五轮下载项目所用 Phaser v3.60.0 的官方 [ImageFile.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/loader/filetypes/ImageFile.js)，本地保存为 [phaser-ImageFile.js](phaser-ImageFile.js)，MIT 许可见 [phaser-LICENSE.md](phaser-LICENSE.md)。仅用于核对内嵌图的加载行为，不加入运行依赖。该版本 HTMLImageElement 加载分支明确拒绝 data URI，因此 Boot 直接通过原生 Image 解码内嵌图片，再加入纹理。新画的来源、提示词与维护方法见 [2D 美术资源](../../assets/2d/README.md)。

第十轮下载同版本官方 [StaticBody.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/physics/arcade/StaticBody.js)，本地保存为 [phaser-StaticBody.js](phaser-StaticBody.js)，使用同一份 [MIT 许可](phaser-LICENSE.md)。核对 updateFromGameObject、setOffset 和 setSize 的尺寸与位置语义，指导移动衣柜的碰撞同步；不进入游戏运行包，不替换现有 Phaser。

第三十三轮于 2026-11-16 通过 GitHub 连接下载同版本官方 [Body.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/physics/arcade/Body.js) 与 [StaticPhysicsGroup.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/physics/arcade/StaticPhysicsGroup.js)，分别保存为 [phaser-Body.js](phaser-Body.js) 和 [phaser-StaticPhysicsGroup.js](phaser-StaticPhysicsGroup.js)，沿用上述 Phaser MIT 许可。核对动态 body.reset 会同步角色显示位置/物理状态，以及带 body 的对象加入静态组不会再新建 body；结合已有 StaticBody 参考用于学校/医院家具碰撞和旧存档落点恢复。只作官方实现参考，不加入游戏运行包，也不升级引擎。

第三十四轮将同一物理实现与场所叙事研究用于事故图，复用已下载材料及上轮 furnishings/落点恢复；没有重复下载、复制商业素材或新增运行依赖。

第三十七轮于 2026-11-16 通过 GitHub 连接下载 Phaser v3.60.0 的 [KeyboardManager.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/input/keyboard/KeyboardManager.js) 与 [KeyboardPlugin.js](https://github.com/phaserjs/phaser/blob/v3.60.0/src/input/keyboard/KeyboardPlugin.js)，保存为 [phaser-KeyboardManager.js](phaser-KeyboardManager.js) 和 [phaser-KeyboardPlugin.js](phaser-KeyboardPlugin.js)，沿用同份 [MIT 许可](phaser-LICENSE.md)。核对窗口层 captures/preventDefault、场景 enabled、临时 DOM 输入的 disableGlobalCapture、resetKeys 及销毁后的 manager 生命周期，指导阅读层释放/恢复输入。原文仅作参考，不打入游戏包、不升级 Phaser。
