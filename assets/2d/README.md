# 2D 美术资源

## 程序像素纹理

第三十四轮新增 `road_guardrail`（96×40）、`road_lane`（96×16）与 `skid_marks`（96×80），布置事故现场的连续护栏、磨损标线和车后痕迹；均为本地 fillRect 配方，无外部素材。护栏断口移至车头前，原 `car_wrecked` 加入实际碰撞；去路为西侧门口与东侧山路，纹理本身不标结局好坏。原车门划痕、断口编号/飞机与全部正文保持。用 `tools/preview_pixel_textures.ps1 -CrashScene` 可输出 [事故布局预览](../../docs/previews/crash-scene-v1.png)，没有游戏光照或真实碰撞画面。

房间地面与道具纹理由 `src/systems/ManorPresentation.js` 绘制，运行时不请求图片。第六轮新增旧砖、石地、学校木地、医院地砖与湿路面，以及文书页、成束香、叠纸钱和系红绳的钥匙。门牌与像素家具沿用已有代码。病历、湿纸和普通文书不再与地面装饰共用小纸屑；处方封套等已有专用纹理继续保留。

第七轮新增 `offering_rice` 和 `offering_ash`；供桌上的香复用 `incense_bundle`。它们由 `ManorPresentation` 创建为纯表现物件，不加入碰撞或独立调查目标。`syncRitual()` 按步骤显示供物、管理两点烛光，第二步点灯、第三步留灰；仪式是否完成仍由剧情状态决定。

第八轮将 `safe` 改为四轮机械锁的旧铁箱，并新增 `safe_open` 空箱纹理。两者均为 48×48，开箱切换不改变碰撞体积。是否打开由背包里有无地下室钥匙决定，换房后仍能看见打开状态。

第九轮补充 `height_marks` 门柱纹理（20×64），并将 `car` 与新 `car_wrecked`（均为 64×128）区分为停放和事故状态。两张车图保留同位置的浅色月牙划痕，事故态有锈迹和损坏，不绘制血腥。来信复用 `document_page`。车辆的尺寸契约和原有碰撞不变，门柱仅参与调查，不阻挡玩家。

`floorTexture()` 按房间用途选择地面；`floorDebris()` 根据房间和格子位置确定暗色磨痕，避开物件与门口，包括记忆回返后出现的封套。纯装饰不再绘成可读纸张，回房也不会随机重排。该逻辑不修改地图、碰撞或调查内容。

在项目根目录的 PowerShell 会话运行 `& .\tools\preview_pixel_textures.ps1` 可导出 [像素纹理预览](../../docs/previews/pixel-textures-v1.png)，制作方法与限制见 [预览说明](../../docs/previews/README.md)。它从实际绘制指令生成，便于检查轮廓；没有游戏光照，不能当作实玩截图。

第十七轮新增 `boarded_window`（40×40），呈现走廊窗框、外侧横木、拨开的内侧窗扣、钉尖与下沿抓痕。替代原透明矩形，同尺寸同位置，仍沿用原控制类物证；阅读正文来自 Maps，素材联系表已加入该键。没有外部资产或图片生成任务。

第十八轮新增 `kitchen_cabinet_rice` / `kitchen_cabinet_empty`（48×64）与 `workbench_matches` / `workbench_empty`（64×48），分别展示供饭/碗印和火柴盒/浅方印。沿用当前衣柜与桌子的尺寸、位置和底部碰撞，通过原供品标记在创建时恢复，主动取走当场换图。普通衣柜与其他书桌不变，四张纹理均已加入联系表；没有外部资产或图片生成任务。

第二十一轮将 `coffin` 扩展为八种 64×128 外形，原键对应三圈全紧，`coffin_1` 至 `coffin_7` 的位 1/2/4 分别表示学校、守灯、医院对应的红线松开。夹纸与独立金属锁保留，结和下垂线绘在纸面上方以免被挡住。`coffinTexture()` 从原状态派生，`syncCoffin()` 更新当前图，地图工厂负责重入恢复；尺寸、位置和原碰撞不变。八种均加入联系表，没有新增外部资产或图片生成任务。

第二十二轮新增 `mountain_path`（96×64，路标与湿石阶）和 `manor_threshold`（80×64，门楣、灯光门缝、门槛与红线）。由事故记忆的 final_leave / final_return 引用，去掉旧地砖的补救染色，坐标与选择流程保留。两者仍走通用交互工厂，不进入家具碰撞；外形同时提供调查边界。已加入联系表，没有外部资产或图片生成任务。

## 记忆物证外形

第十五轮新增 `school_board`（112×56，粉笔排名与名单）、`school_report`（32×40，红笔与破痕）、`clinic_window`（96×64，玻璃窗口与递单口）、`hospital_bed`（48×80，空床与被划掉的留床单）、`guardrail_marker`（96×56，断口、编号牌与外侧纸飞机）。均为现有 fillRect 像素配方，没有外部素材或图片生成任务。

Maps 的五个原有物证引用这些键，保持 id、坐标和完整原文；病床的阅读标题改为“空病床的留床单”。去掉为旧素材设置的临时染色，使用自身配色；仍走文书工厂，不加入玩家移动碰撞。轮廓中的符号只是痕迹提示，不能替代界面里的完整中文原文。

## 第三十三轮：学校与医院布置

新增 `classroom_desk`（64×64，含椅子）、`teacher_desk`（104×48）、`classroom_window`（40×72）、`exam_stack`（32×24）、`waiting_bench`（104×48）、`privacy_screen`（72×96）、`bedside_cabinet`（40×48）、`forms_table`（64×40）、`payment_slip`（24×28）。均为原 fillRect 配方系统的代码资产，无外部图片或生成任务。学校最后试卷和医院缴费单使用新的纸张外形，原物证与坐标保持。

Maps.furnishings 配置布置与相对图像左上角的碰撞矩形；窗户仅绘制，桌椅/屏风等进入原家具静态组。医院原 hospital_bed 调查物同时加入家具碰撞，区别于第十五轮仅替换外形时的行为。纸张保持在桌面上层。素材表已更新，`tools/preview_pixel_textures.ps1 -MemoryRooms` 可用同份配方和地图坐标输出布局研究图，见预览索引；没有游戏光照与真实碰撞画面。

## 井边钥匙状态

第十一轮在 `ManorPresentation.generateTextures()` 增加 `well` / `well_empty` 两张 64×64 程序纹理：井口石板、符纸、外侧铁钩和向外亮痕保持一致，取走时去掉红绳钥匙。复用原尺寸和碰撞，按 hasRedKey 在当前房间与重入时选择；已加入像素联系表。没有新增外部素材或图片生成任务。

## 相框揭布状态

第十二轮在现有像素配方新增 `portrait_covered` / `portrait_father`，同为 30×38，对应黑布露出纸角和揭开后的父亲遗像。地图工厂按 doorSlammed 恢复外形，玩家操作时即时切换；维持原黑布对象的尺寸与位置，无外部资产或生成图片任务。预览已加入联系表。

## 标题插画

`title-manor-v1.png` 是 2D 标题页的雨夜老宅插画，2026-11-15 使用 imagegen 技能的内置 `image_gen` 工具生成，无参考图，非透明背景。尺寸 1448 × 1086（4:3），2,494,125 bytes。SHA256：`8973e48d6bae2d0567f6161489390dfe34fda68d4040c3d018186539cca1cac6`。

原始生成文件复制入本目录，未做图片编辑。左侧留白供独立渲染的标题和按钮使用，右侧画门框、供桌和棺角；不在图中绘制文字。游戏按比例铺满 800 × 600 画布。标题失败回退为原有程序简绘，不阻断开始游戏。

资源清单在 `src/data/ArtAssets.js`。修改清单或资源后运行 `node tools/build_standalone_entry.mjs`，将原图嵌入 `index.html`；单文件入口无需另外请求图片。Boot 使用原生 Image 解码并加入 Phaser 纹理，完成或失败后才进入标题。入口校验比较源图片与内嵌字节，并检查等待与失败路径；它不能代替真实 WebGL 验收。新增画面应使用版本文件名，保留既有资源。

## 最终生成提示词

工具模式：内置 image_gen；新图生成；无参考图；`transparent_background: false`。

```text
Use case: illustration-story. Asset type: production background art for the title screen of a Chinese folklore horror investigation game, to be displayed behind separately rendered Chinese menu text in a 800 by 600 2D canvas. Create one finished landscape illustration, composed for 4:3. It must look hand-painted in ink and opaque watercolor on subtly rough paper, a restrained, atmospheric 2D illustration, not a 3D render or a photograph. Scene: an abandoned Chinese family manor on a rainy night. Keep the entire left 43 percent as quiet dark blue-green negative space with very little detail, for the game title and menu; do not paint text there. In the right half, a weathered dark wooden doorway opens into an ancestral hall. Inside are a small household altar, a portrait covered in black cloth, an unlettered old envelope, an incense bowl, and two small warm candle flames. The corner of a closed wooden coffin bound with a dull red cord is visible low in the right foreground. Wet flagstones and a few thin rain streaks outside the threshold. The red cord and worn wood should carry the unease; no monsters, jump scares, people, skulls, blood or gore. Muted ink teal, old ochre, dusty vermilion and warm candlelight, preserving readable midtones and distinct forms. The hall should feel like an ordinary family home made unsettling by absence. Frame the doorway so its full silhouette fits within the right 55 percent; keep important shapes away from all outer edges to tolerate slight crop. No lettering, no Chinese characters, no logos, no watermark, no UI, no title, no modern neon. Draw the actual illustration only.
```
