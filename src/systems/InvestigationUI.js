import { CASES, deduce, ensureInvestigation, getObjective, getVisibleCases, getEvidence, getJournalEntries, rememberDocument, getCaseDraft, rememberCaseDraft, getMemoryReturn, requestHint, saveCheckpoint } from './Investigation.js';
import { Maps } from '../data/Maps.js';
import { ensureExploration, ROOM_LAYOUT, knownConnections, knownRoute, nextDoorDescription } from './Exploration.js';
import { pursuitCue, isPursuitSpace } from './HorrorPacing.js';
import { ManorPresentation } from './ManorPresentation.js';

export class InvestigationUI {
    constructor(scene) {
        this.scene = scene;
        this.state = scene.gameState;
        this.data = ensureInvestigation(this.state);
        this.root = document.createElement('div');
        this.root.id = 'investigation-ui';
        this.root.innerHTML = `<style>
            #investigation-ui{position:fixed;inset:0;pointer-events:none;color:#dfd3ba;font:14px "Microsoft YaHei",sans-serif;z-index:450}
            #case-hud{position:absolute;top:20px;left:24px;width:min(360px,calc(100vw - 140px));padding:14px 18px;border-left:2px solid #ad644a;background:linear-gradient(90deg,#141719ed,#14171944);box-sizing:border-box}
            #case-chapter{font:17px "SimSun",serif;letter-spacing:2px;margin:0 0 8px;color:#e0c393}
            #case-objective{font-size:12px;line-height:1.8;margin:0;color:#c4bcaa}
            #case-tools{position:absolute;right:24px;top:20px;display:flex;gap:8px;pointer-events:auto}
            #investigation-ui button{font:inherit;color:#dbc9a6;border:1px solid #807059;background:#1d2225;padding:10px 14px;cursor:pointer}
            #investigation-ui button:hover,#investigation-ui button:focus-visible{border-color:#ddb980;background:#35332b;outline:2px solid #c6a771;outline-offset:2px}
            #investigation-ui button:disabled{opacity:.55;cursor:default;outline:none;background:#1d2225;border-color:#57594b}
            #case-status{position:absolute;bottom:28px;left:24px;font-size:12px;color:#d2b78e;text-shadow:0 2px 3px #000;max-width:65vw}
            #case-sprint{position:absolute;right:30px;bottom:166px;pointer-events:auto;touch-action:none;display:none}
            @media(pointer:coarse){#case-sprint{display:block}}
            #case-modal{position:absolute;inset:0;background:#050809c9;display:flex;align-items:center;justify-content:center;pointer-events:auto;padding:18px;box-sizing:border-box}
            #case-modal[hidden]{display:none}
            .case-sheet{width:min(720px,100%);max-height:82vh;overflow:auto;background:#191e20;border:1px solid #6e6553;padding:28px;box-sizing:border-box;box-shadow:0 20px 90px #000}
            .case-sheet h2{font:28px "SimSun",serif;color:#e1c191;margin:0 0 10px;letter-spacing:4px}.case-sheet h3{font:18px "SimSun",serif;color:#d0aa77;margin:22px 0 10px}
            .case-sheet p{line-height:1.9;white-space:pre-wrap}.case-caption{color:#9d9d8d;font-size:12px}
            .case-actions{display:flex;flex-wrap:wrap;gap:9px;margin-top:20px}.case-actions button{flex:1;min-width:160px;line-height:1.7}
            .case-note{border-top:1px solid #3a3e39;padding:10px 0}.case-note summary{cursor:pointer;color:#d6c5a3;padding:5px 0}.case-note p{font-size:13px;color:#b5b6a7}
            #investigation-ui .case-note>button{font-size:12px;padding:7px 10px;margin:0 0 8px}
            .case-record-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin:14px 0}.case-record-filters label{display:grid;gap:6px;flex:1;min-width:180px;font-size:12px;color:#b5b6a7}.case-record-filters input,.case-record-filters select{box-sizing:border-box;width:100%;min-height:44px;padding:10px;background:#151d1f;color:#dfd3ba;border:1px solid #6e6553;font:inherit;font-size:14px}.case-record-filters input:focus-visible,.case-record-filters select:focus-visible{outline:2px solid #d6b778;outline-offset:2px}
            .case-pool>summary{cursor:pointer;color:#d6c5a3;padding:12px 0;border-bottom:1px solid #53584d}
            .case-evidence{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.case-card{border:1px solid #53584d;padding:12px;background:#22292a}.case-card p{font-size:13px;margin:6px 0 12px}.case-card button{width:100%}.case-card:has([aria-pressed=true]){border-color:#d5b47c;background:#32342c}
            .case-comparison{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.case-comparison article{border-left:2px solid #b79b6c;background:#222c2b;padding:12px}.case-comparison h4{font-size:14px;color:#dfcda8;margin:0 0 8px}.case-comparison p{font-size:13px;color:#c9c7b3;margin:0 0 12px}#investigation-ui .case-comparison button{font-size:12px}
            .case-options{display:grid;gap:8px}.case-options button{text-align:left;line-height:1.7}#investigation-ui button[aria-pressed=true]{border-color:#d5b47c;color:#f0ddb5;background:#414034}
            .case-safe-display{font:32px monospace;letter-spacing:12px;text-align:center;padding:16px;background:#101919;color:#e1c191;border:1px solid #697364;margin:16px 0}.case-keypad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-width:360px;margin:0 auto}.case-keypad button{min-height:44px}
            .case-map-wrap{overflow:auto;border:1px solid #515647;background:#151c1d;padding:8px}.case-map{display:block;width:100%;max-height:480px}.case-map-wide{min-width:640px}.case-destinations{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-top:12px}.case-route{border-left:2px solid #b89b69;padding:8px 12px;background:#242b29}
            #case-feedback{color:#d9a57b;min-height:20px}.case-hint{position:absolute;bottom:9px;right:24px;font-size:11px;color:#8f978f}
            @media(max-width:600px){#case-hud{left:10px;top:10px;padding:10px;width:calc(100vw - 104px)}#case-tools{right:10px;top:10px;flex-direction:column}#case-tools button{padding:8px;font-size:12px}#case-chapter{font-size:14px;letter-spacing:1px}#case-objective{font-size:11px}#case-status{left:12px;bottom:164px}.case-sheet{padding:20px;max-height:85vh}.case-sheet h2{font-size:23px}.case-hint{display:none}}
        </style><section id="case-hud"><h2 id="case-chapter"></h2><p id="case-objective"></p></section>
        <nav id="case-tools"><button id="case-journal" type="button">手记 J</button><button id="case-help" type="button">提示</button><button id="case-pause" type="button">暂停</button></nav>
        <div id="case-status" aria-live="polite"></div><div class="case-hint">WASD 移动 / E 调查 / Shift 奔跑 / J 手记 / M 路线</div>
        <button type="button" id="case-sprint">按住奔跑</button>
        <section id="case-modal" hidden role="dialog" aria-modal="true" aria-labelledby="case-modal-title"><div class="case-sheet" id="case-sheet"><h2 id="case-modal-title" tabindex="-1"></h2><div id="case-body"></div><p id="case-feedback" aria-live="polite"></p><div class="case-actions" id="case-actions"></div></div></section>`;
        document.body.appendChild(this.root);
        this.el = id => this.root.querySelector(`#${id}`);
        this.el('case-journal').onclick = () => this.journal();
        this.el('case-pause').onclick = () => this.pause();
        this.el('case-help').onclick = () => this.hint();
        this.el('case-sprint').onpointerdown = event => { event.preventDefault(); scene.joystick.sprint = true; };
        this.endSprint = () => { scene.joystick.sprint = false; };
        window.addEventListener('pointerup', this.endSprint);
        window.addEventListener('pointercancel', this.endSprint);
        this.onKey = event => this.handleKey(event);
        document.addEventListener('keydown', this.onKey);
        this.originalDocument = window.showDocument;
        this.documentWrapper = (title, content) => {
            rememberDocument(this.state, this.scene.currentMapId, title, content);
            this.originalDocument(title, content);
        };
        window.showDocument = this.documentWrapper;
        this.timer = scene.time.addEvent({ delay: 250, loop: true, callback: () => this.update() });
        scene.events.once('shutdown', () => this.dispose());
        this.update();
    }

    handleKey(event) {
        if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
        // Tab repeats must remain contained; browser tab-switch shortcuts stay native.
        if (this.open && event.code === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) { this.containFocus(event); return; }
        if (event.repeat) return;
        if (event.code === 'Escape' && this.open) { event.preventDefault(); this.close(); }
        else if (this.open && this.modalKeyHandler && !event.ctrlKey && !event.altKey && !event.metaKey) this.modalKeyHandler(event);
        else if (event.target?.matches('input,textarea')) return;
        else if (event.code === 'KeyJ' && !window.dialogActive) { event.preventDefault(); this.journal(); }
        else if (event.code === 'KeyM' && !window.dialogActive) { event.preventDefault(); this.sketch(); }
    }

    containFocus(event) {
        const modal = this.el('case-modal');
        const controls = [...modal.querySelectorAll('button:not(:disabled),summary,a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')]
            .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
        const index = controls.indexOf(document.activeElement);
        if (!controls.length) {
            event.preventDefault();
            this.el('case-modal-title').focus({ preventScroll: true });
        } else if (index === -1 || (event.shiftKey ? index === 0 : index === controls.length - 1)) {
            event.preventDefault();
            controls[event.shiftKey ? controls.length - 1 : 0].focus();
        }
    }

    modal(title, message, actions) {
        if (this.scene.isManipulating || (window.dialogActive && !this.open)) return false;
        this.modalKeyHandler = null;
        if (!this.open) {
            this.previousFocus = document.activeElement;
            const keyboard = this.scene.input?.keyboard;
            if (keyboard?.manager) {
                this.keyboardState = { keyboard, manager: keyboard.manager, enabled: keyboard.enabled, capture: keyboard.manager.preventDefault };
                keyboard.enabled = false;
                keyboard.disableGlobalCapture();
                keyboard.resetKeys();
            }
        }
        this.open = true;
        window.dialogActive = true;
        this.scene.player.sprite.setVelocity(0);
        this.scene.physics.pause();
        this.el('case-modal-title').textContent = title;
        this.el('case-body').replaceChildren();
        const paragraph = document.createElement('p');
        paragraph.textContent = message;
        this.el('case-body').appendChild(paragraph);
        this.el('case-feedback').textContent = '';
        this.el('case-actions').replaceChildren();
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = action.label;
            button.disabled = !!action.disabled;
            button.onclick = action.run;
            this.el('case-actions').appendChild(button);
        });
        this.el('case-modal').hidden = false;
        this.el('case-sheet').scrollTop = 0;
        this.el('case-modal-title').focus({ preventScroll: true });
        return true;
    }

    close() {
        if (!this.open) return;
        this.modalKeyHandler = null;
        this.open = false;
        this.el('case-modal').hidden = true;
        window.dialogActive = false;
        window.lastDialogCloseTime = Date.now();
        const keyboardState = this.keyboardState;
        this.keyboardState = null;
        if (keyboardState) {
            const { keyboard, manager, enabled, capture } = keyboardState;
            keyboard.resetKeys();
            if (keyboard.manager === manager) {
                if (capture) keyboard.enableGlobalCapture(); else keyboard.disableGlobalCapture();
                keyboard.enabled = enabled;
            } else manager.preventDefault = capture;
        }
        this.scene.physics.resume();
        if (this.previousFocus?.isConnected) this.previousFocus.focus?.();
        else this.el('case-journal')?.focus();
        this.previousFocus = null;
    }

    journal() {
        if (!this.modal('雨夜手记', '找到的物证会留在这里。把互相矛盾的说法放在一起，试着形成自己的判断。\n展开记录可回看原文；记下地点后，还能回想走过的路线。', [{ label: '走过的路 M', run: () => this.sketch() }, { label: '合上手记', run: () => this.close() }])) return;
        const body = this.el('case-body');
        const visible = getVisibleCases(this.state);
        if (!visible.length) {
            const empty = document.createElement('p');
            empty.textContent = this.data.notes.length || this.state.storyFlags.collectedClues.length ? '已发现的文字记在下方。问题还没有拼出轮廓，可以继续观察。' : '手记还是空的。先看看屋里留下了什么，问题会从找到的记录里浮现。';
            body.appendChild(empty);
        }
        visible.forEach(([id, puzzle]) => {
            const draft = getCaseDraft(this.state, id);
            const hasDraft = draft.evidenceIds.length > 0 || draft.answer !== null;
            const heading = document.createElement('h3');
            heading.textContent = `${this.data.deductions[id] ? '已拼合 · ' : '待拼合 · '}${puzzle.title}`;
            const text = document.createElement('p');
            text.className = 'case-caption';
            text.textContent = this.data.deductions[id] ? puzzle.conclusion : '已经有一段经过值得追问。可以先用已读记录提出解释，也可以回现场继续观察。能互相支持的原文，才是判断的依据。';
            if (hasDraft) text.textContent += '\n有一份未提交的草稿，先前的选证与解释仍在。';
            body.append(heading, text);
            if (!this.data.deductions[id]) {
                const button = document.createElement('button');
                button.textContent = hasDraft ? '继续整理这段经过' : '尝试还原这段经过';
                button.onclick = () => this.solve(id, () => this.journal());
                body.appendChild(button);
            }
        });
        const heading = document.createElement('h3');
        heading.textContent = `物证与文书 · ${this.state.storyFlags.collectedClues.length} 条物证`;
        body.appendChild(heading);
        this.recordBrowser(body, getJournalEntries(this.state), (list, cards) => cards.forEach(card => this.evidenceNote(list, card, true)));
    }

    recordBrowser(body, records, paint, listClass = 'case-record-list') {
        if (!records.length) return;
        const controls = document.createElement('div');
        controls.className = 'case-record-filters';
        const searchLabel = document.createElement('label');
        searchLabel.textContent = '查找已读文字';
        const input = document.createElement('input');
        input.type = 'search'; input.className = 'case-record-search'; input.placeholder = '标题、地点或原文';
        searchLabel.appendChild(input);
        const sourceLabel = document.createElement('label');
        sourceLabel.textContent = '发现地点';
        const source = document.createElement('select');
        source.className = 'case-source-filter';
        for (const name of ['', ...new Set(records.map(card => card.source))]) {
            const option = document.createElement('option');
            option.value = name; option.textContent = name || '全部地点'; source.appendChild(option);
        }
        source.value = '';
        sourceLabel.appendChild(source);
        const clear = document.createElement('button');
        clear.type = 'button'; clear.textContent = '清除筛选';
        controls.append(searchLabel, sourceLabel, clear);
        const count = document.createElement('p');
        count.className = 'case-record-count case-caption'; count.setAttribute('role', 'status');
        const list = document.createElement('div');
        list.className = listClass;
        const normalise = text => String(text).normalize('NFKC').toLocaleLowerCase('zh-CN');
        const show = () => {
            const query = normalise(input.value).trim();
            const matches = records.filter(card => (!source.value || card.source === source.value) && normalise([card.name, card.source, card.text].join('\n')).includes(query));
            count.textContent = `显示 ${matches.length}/${records.length} 条已读记录。`;
            list.replaceChildren();
            paint(list, matches);
            if (!matches.length) {
                const empty = document.createElement('p'); empty.className = 'case-caption';
                empty.textContent = records.length ? '没有匹配的已读记录。可以换个词，或清除筛选。' : '还没有记下记录。';
                list.appendChild(empty);
            }
        };
        input.oninput = show; source.onchange = show;
        clear.onclick = () => { input.value = source.value = ''; show(); input.focus?.(); };
        body.append(controls, count, list);
        show();
        return { input, source, list };
    }

    evidenceNote(body, card, showRoute = false) {
        const details = document.createElement('details');
        details.className = 'case-note';
        const title = document.createElement('summary');
        title.textContent = `${card.name} · ${card.source}`;
        const content = document.createElement('p');
        content.textContent = card.text;
        details.append(title, content);
        if (showRoute && ROOM_LAYOUT[card.sourceMapId] && ensureExploration(this.state).visitedRooms.includes(card.sourceMapId)) {
            const route = document.createElement('button');
            route.type = 'button';
            route.textContent = `回想去${card.source}的路`;
            route.onclick = () => this.sketch(card.sourceMapId);
            details.appendChild(route);
        }
        body.appendChild(details);
        return details;
    }

    sketch(destination = this.scene.currentMapId) {
        if (!this.modal('走过的路', '只画亲自到过的房间和走过的通路。选择一个房间，可以回想当前还走得通的路线，并回查在那里记下的发现。', [{ label: '物证手记 J', run: () => this.journal() }, { label: '收起路线图', run: () => this.close() }])) return;
        const data = ensureExploration(this.state);
        if (!data.visitedRooms.includes(destination)) destination = this.scene.currentMapId;
        const rooms = data.visitedRooms.filter(id => Maps[id] && ROOM_LAYOUT[id]);
        const body = this.el('case-body');
        const caption = document.createElement('p');
        caption.className = 'case-caption';
        caption.textContent = `当前位置：${Maps[this.scene.currentMapId]?.name || '雨夜'}。示意图不按比例；虚线表示某个方向目前无法通过。`;
        body.appendChild(caption);
        const route = knownRoute(this.state, this.scene.currentMapId, destination);
        const svgNode = (tag, attributes, text) => {
            const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
            Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)));
            if (text) node.textContent = text;
            return node;
        };
        if (rooms.length) {
            const xs = rooms.map(id => ROOM_LAYOUT[id][0]), ys = rooms.map(id => ROOM_LAYOUT[id][1]);
            const x = Math.min(...xs) - 90, y = Math.min(...ys) - 50;
            const svg = svgNode('svg', { viewBox: `${x} ${y} ${Math.max(...xs) - x + 90} ${Math.max(...ys) - y + 50}`, role: 'img', 'aria-label': '已探索房间与通路', class: `case-map${rooms.length > 5 ? ' case-map-wide' : ''}` });
            svg.appendChild(svgNode('title', {}, `已到过：${rooms.map(id => Maps[id].name).join('、')}`));
            knownConnections(this.state).forEach(link => {
                if (!rooms.includes(link.from) || !rooms.includes(link.to)) return;
                const [x1, y1] = ROOM_LAYOUT[link.from], [x2, y2] = ROOM_LAYOUT[link.to];
                const selected = route?.some((id, index) => index > 0 && [id, route[index - 1]].sort().join('|') === [link.from, link.to].sort().join('|'));
                const open = link.directions.every(edge => edge.open);
                svg.appendChild(svgNode('line', { x1, y1, x2, y2, stroke: selected ? '#e2bc7b' : '#68766c', 'stroke-width': selected ? 4 : 2, 'stroke-dasharray': open ? 'none' : '7 6' }));
            });
            rooms.forEach(id => {
                const [cx, cy] = ROOM_LAYOUT[id];
                const current = id === this.scene.currentMapId;
                svg.appendChild(svgNode('rect', { x: cx - 76, y: cy - 23, width: 152, height: 46, rx: 3, fill: current ? '#4a4430' : '#222d2b', stroke: current ? '#e2bc7b' : '#89927d', 'stroke-width': current ? 3 : 1 }));
                svg.appendChild(svgNode('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', fill: '#e0d0ae', 'font-size': 18, 'font-family': 'Microsoft YaHei,sans-serif' }, `${current ? '此处 · ' : ''}${Maps[id].name}`));
            });
            const wrap = document.createElement('div');
            wrap.className = 'case-map-wrap';
            wrap.appendChild(svg);
            body.appendChild(wrap);
        }
        const description = document.createElement('p');
        description.className = 'case-route';
        description.setAttribute('aria-live', 'polite');
        description.textContent = destination === this.scene.currentMapId ? '你就在这里。路线图不会替你移动。' : route ? `${route.map(id => Maps[id].name).join(' → ')}\n下一段：${nextDoorDescription(route[0], route[1])}` : '目前没有记下可直接走通的路线。封门需要现场处理，记忆需要从原来的物件回返。';
        body.appendChild(description);
        const destinations = document.createElement('div');
        destinations.className = 'case-destinations';
        rooms.forEach(id => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = Maps[id].name;
            button.setAttribute('aria-pressed', String(id === destination));
            button.onclick = () => this.sketch(id);
            destinations.appendChild(button);
        });
        body.appendChild(destinations);
        if (rooms.includes(destination)) {
            const heading = document.createElement('h3');
            heading.textContent = `在${Maps[destination].name}记下的发现`;
            body.appendChild(heading);
            const records = getJournalEntries(this.state).filter(card => card.sourceMapId === destination);
            records.forEach(card => this.evidenceNote(body, card));
            if (!records.length) {
                const empty = document.createElement('p');
                empty.className = 'case-caption';
                empty.textContent = '还没有记下这里的文书与观察。走过一个房间，不代表已经查遍。';
                body.appendChild(empty);
            }
        }
        const memories = data.visitedRooms.filter(id => Maps[id] && !ROOM_LAYOUT[id]);
        if (memories.length) {
            const note = document.createElement('p');
            note.className = 'case-caption';
            note.textContent = `走入过的记忆：${memories.map(id => Maps[id].name).join('、')}。它们不在老宅的平面上。`;
            body.appendChild(note);
        }
    }

    memoryClue(obj) {
        const id = obj.memoryComplete;
        if (!CASES[id]) return;
        const solved = !!this.data.deductions[id];
        const returnAction = this.memoryReturnAction();
        this.modal(obj.documentTitle || CASES[id].title, `${obj.documentText || (typeof obj.dialog === 'string' ? obj.dialog : '旧物还在原处。')}\n\n${solved ? '这段经过已经拼合，判断留在手记里。可以继续观察，也可以回到旧宅。' : '这份记录已经留在手记。可以先整理自己的解释，也可以继续观察或暂回旧宅；未提交的判断仍是草稿。'}`, [
            solved ? { label: '回看手记中的判断', run: () => this.journal() } : { label: '对照已读物证', run: () => this.solve(id, () => this.memoryClue(obj)) },
            ...(returnAction ? [{ ...returnAction, label: solved ? returnAction.label.replace('暂回', '回到') : returnAction.label }] : []),
            { label: '继续观察这里', run: () => this.close() }
        ]);
    }

    solve(id, onSolved) {
        if (this.data.deductions[id]) { onSolved?.(); return; }
        const puzzle = CASES[id];
        if (!puzzle) return;
        const returnAction = this.memoryReturnAction();
        if (!getVisibleCases(this.state).some(([caseId]) => caseId === id)) {
            this.modal('还有一处矛盾', `这份记录还不足以还原经过。继续观察房间，找到能相互对照的物证；需要时可主动打开提示。${returnAction ? '\n也可以暂回旧宅，已读物证会保留，记忆仍待拼合。' : ''}`, [{ label: '继续调查', run: () => this.close() }, { label: '查看提示', run: () => this.hint() }, ...(returnAction ? [returnAction] : [])]);
            return;
        }
        const draft = getCaseDraft(this.state, id);
        const selected = new Set(draft.evidenceIds);
        let answer = draft.answer === null ? null : puzzle.answers.indexOf(draft.answer), submitted = false;
        if (!this.modal(puzzle.title, `${puzzle.question}\n选出两份能互相印证的记录，再提出解释。现在就可以尝试；如果依据不足，可以合上手记继续调查。选证和解释会留作未提交草稿，回来后可以接着整理。${returnAction ? '\n可以暂回旧宅；已读物证保留，未提交的判断不会算作完成。' : ''}`, [
            { label: '提交判断', run: () => {
                if (submitted) return;
                if (selected.size !== 2 || answer === null) { this.el('case-feedback').textContent = '先选两份物证，再选一个解释。'; return; }
                if (!deduce(this.state, id, answer, [...selected])) { this.el('case-feedback').textContent = `这些记录还不能共同支持这个解释。回看正在对照的原文：${puzzle.comparison}`; return; }
                submitted = true;
                this.scene.mapManager?.refreshMemoryEchoes();
                this.close();
                window.showDialog('手记', puzzle.conclusion, onSolved);
            } },
            { label: '清空这份草稿', run: () => {
                if (submitted) return;
                selected.clear(); answer = null;
                pool.open = true;
                for (const card of evidence) {
                    const button = buttons.get(card.id);
                    if (!button) continue;
                    button.setAttribute('aria-pressed', 'false');
                    button.textContent = `选用：${card.name}`;
                }
                for (const option of options.children) option.setAttribute('aria-pressed', 'false');
                paintComparison(); progress();
            } },
            ...(returnAction ? [returnAction] : []),
            { label: '留作草稿，继续调查', run: () => this.close() }
        ])) return;
        const body = this.el('case-body');
        const evidence = getEvidence(this.state);
        const pool = document.createElement('details');
        pool.className = 'case-pool'; pool.open = selected.size < 2;
        const poolTitle = document.createElement('summary');
        poolTitle.textContent = `已读物证库 · ${evidence.length} 条（展开可筛选、换证）`;
        pool.appendChild(poolTitle); body.appendChild(pool);
        const buttons = new Map();
        const comparison = document.createElement('div');
        comparison.className = 'case-comparison';
        const progress = () => {
            rememberCaseDraft(this.state, id, [...selected], answer === null ? null : puzzle.answers[answer]);
            this.el('case-feedback').textContent = `已选 ${selected.size}/2 份物证${answer === null ? '，尚未选择解释。' : '，已提出解释。提交前可对照原文。'}`;
        };
        const paintComparison = () => {
            comparison.replaceChildren();
            for (const clueId of selected) {
                const card = evidence.find(item => item.id === clueId);
                const article = document.createElement('article');
                const title = document.createElement('h4');
                title.textContent = `${card.name} · ${card.source}`;
                const text = document.createElement('p');
                text.textContent = card.text;
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.textContent = `换掉：${card.name}`;
                remove.onclick = () => { pool.open = true; toggle(card.id); (buttons.get(card.id) || browser.input).focus?.(); };
                article.append(title, text, remove);
                comparison.appendChild(article);
            }
            if (!selected.size) {
                const empty = document.createElement('p');
                empty.className = 'case-caption';
                empty.textContent = '选用物证后，两份原文会放在这里，可以来回对照。';
                comparison.appendChild(empty);
            }
        };
        const toggle = clueId => {
            if (submitted) return;
            if (selected.has(clueId)) selected.delete(clueId);
            else if (selected.size < 2) selected.add(clueId);
            else { this.el('case-feedback').textContent = '已经选了两份记录，可在对照区换掉其中一份。'; return; }
            const card = evidence.find(item => item.id === clueId);
            const button = buttons.get(clueId);
            if (button) {
                button.setAttribute('aria-pressed', String(selected.has(clueId)));
                button.textContent = `${selected.has(clueId) ? '已选' : '选用'}：${card.name}`;
            }
            paintComparison();
            progress();
        };
        const browser = this.recordBrowser(pool, evidence, (list, matches) => {
          buttons.clear();
          matches.forEach(card => {
            const article = document.createElement('article');
            article.className = 'case-card';
            this.evidenceNote(article, card);
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = `${selected.has(card.id) ? '已选' : '选用'}：${card.name}`;
            button.setAttribute('aria-pressed', String(selected.has(card.id)));
            buttons.set(card.id, button);
            button.onclick = () => toggle(card.id);
            article.appendChild(button);
            list.appendChild(article);
          });
        }, 'case-evidence');
        const compareHeading = document.createElement('h3');
        compareHeading.textContent = '正在对照的原文';
        const guide = document.createElement('p');
        guide.className = 'case-caption';
        guide.textContent = puzzle.comparison;
        body.append(compareHeading, guide, comparison);
        paintComparison();
        const heading = document.createElement('h3');
        heading.textContent = '我的解释';
        body.appendChild(heading);
        const options = document.createElement('div');
        options.className = 'case-options';
        puzzle.answers.forEach((label, index) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.setAttribute('aria-pressed', String(index === answer));
            button.onclick = () => {
                if (submitted) return;
                answer = index;
                for (const option of options.children) option.setAttribute('aria-pressed', String(option === button));
                progress();
            };
            options.appendChild(button);
        });
        body.appendChild(options);
        progress();
    }

    hint() {
        if (this.scene.isManipulating || (window.dialogActive && !this.open)) return;
        const hint = requestHint(this.state, this.scene.currentMapId);
        this.modal(`调查提示 · ${hint.level}/${hint.total}`, hint.text, [
            ...(hint.level < hint.total ? [{ label: '再具体一点', run: () => this.hint() }] : []),
            { label: '回去试试', run: () => this.close() },
            { label: '查看已发现的记录', run: () => this.journal() }
        ]);
    }

    unlockSafe(onComplete) {
        const safe = Maps[this.scene.currentMapId]?.objects.safe;
        if (!safe) return;
        let code = '', finished = false;
        const submit = () => {
            if (finished) return;
            if (code.length !== safe.code.length) { this.el('case-feedback').textContent = '先将四只数字轮拨好，再转动锁钮。'; return; }
            if (code !== safe.code) { this.el('case-feedback').textContent = '锁钮没有松开。可以退一位修改，再对照刻字和记下的年份。'; return; }
            finished = true;
            this.close();
            onComplete();
        };
        if (!this.modal('父亲的保险箱', `${safe.inscription}\n可以用键盘数字或下方按键输入，Enter 转动锁钮，Esc 离开。`, [
            { label: '转动锁钮 [Enter]', run: submit },
            { label: '暂时离开', run: () => { finished = true; this.close(); } }
        ])) return;
        const body = this.el('case-body');
        const display = document.createElement('div');
        display.className = 'case-safe-display';
        display.setAttribute('role', 'status');
        display.setAttribute('aria-live', 'polite');
        const paint = () => {
            display.textContent = code.padEnd(safe.code.length, '—').split('').join(' ');
            display.setAttribute('aria-label', `已输入 ${code.length} 位：${code.split('').join('、') || '空'}`);
        };
        const press = key => {
            if (finished) return;
            if (key === '清空') code = '';
            else if (key === '退一位') code = code.slice(0, -1);
            else if (code.length < safe.code.length) code += key;
            paint();
            this.el('case-feedback').textContent = '';
        };
        paint();
        body.appendChild(display);
        const keypad = document.createElement('div');
        keypad.className = 'case-keypad';
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '退一位'].forEach(key => {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = key;
            button.onclick = () => press(key);
            keypad.appendChild(button);
        });
        body.appendChild(keypad);
        const heading = document.createElement('h3');
        heading.textContent = '手记里记下的相关文字';
        body.appendChild(heading);
        const records = getJournalEntries(this.state).filter(card => card.id === 'family_rules'
            || card.name === Maps.room_bedroom_parents.objects.family_rules.documentTitle
            || card.name === Maps.room_bathroom.objects.wet_paper.documentTitle);
        const comparison = document.createElement('div');
        comparison.className = 'case-evidence';
        records.forEach(card => { this.evidenceNote(comparison, card).open = true; });
        body.appendChild(comparison);
        if (!records.length) {
            const empty = document.createElement('p');
            empty.className = 'case-caption';
            empty.textContent = '还没有记下能解释刻字的记录。可以先离开，看看家里留下的文字。';
            body.appendChild(empty);
        }
        this.modalKeyHandler = event => {
            if (event.key === 'Enter') { event.preventDefault(); submit(); }
            else if (/^[0-9]$/.test(event.key)) { event.preventDefault(); press(event.key); }
            else if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); press(event.key === 'Backspace' ? '退一位' : '清空'); }
        };
        keypad.querySelector?.('button')?.focus();
    }

    ritual(onComplete) {
        const steps = ['摆上倒头饭', '点燃香与烛', '焚纸引路'];
        const materials = [
            { flag: 'hasRice', name: '倒头饭' }, { flag: 'hasMatches', name: '火柴' },
            { flag: 'hasIncense', name: '香' }, { flag: 'hasSpiritMoney', name: '纸钱' }
        ];
        const requirements = [[materials[0]], [materials[1], materials[2]], [materials[3]]];
        const responses = ['饭碗的位置留着一圈浅印，香炉没有烟，纸盆里也没有灰。', '饭碗落在桌上。碗边写着我的名字；香炉和纸盆还空着。', '两点烛火稳住了，香烟向门边飘，还差送行的纸。'];
        let progress = this.data.ritualStep;
        let finished = false;
        if (progress === steps.length) { onComplete(); return; }
        const apply = step => {
            this.data.ritualStep = progress = step;
            ManorPresentation.syncRitual(this.scene, step);
        };
        const show = () => {
            const available = materials.filter(item => this.state[item.flag]).map(item => item.name);
            if (!this.modal('守灯 · 供桌仪式', `${responses[progress]}\n${this.state.doorSlammed ? '南门的门闩仍扣着。' : '南门还开着。'}\n${progress ? `已完成：${steps.slice(0, progress).join(' → ')}` : '供桌旁夹着一张守灯纸条，可以留意上面的说法。'}\n手边${available.length ? `有：${available.join('、')}` : '还没有可用的供品'}。\n可以先做手边能做的事，再离开找材料；已摆好的东西会留在供桌上。`, [
                // Keep the action list independent of the solution order.
                ...[1, 0, 2].map(index => ({ label: index < progress ? `已完成 · ${steps[index]}` : steps[index], disabled: index < progress, run: () => {
                    if (finished || index < progress) return;
                    const missing = requirements[index].filter(item => !this.state[item.flag]);
                    if (missing.length) {
                        this.el('case-feedback').textContent = `手边还没有${missing.map(item => item.name).join('和')}，这一步没有动手。已摆好的供物仍在，可以先去找材料。`;
                        return;
                    }
                    if (index !== progress) {
                        apply(0);
                        show();
                        this.el('case-feedback').textContent = '火苗熄了，供品收回手边。顺序要从“留名”开始；供品仍在，可以重试。';
                        return;
                    }
                    apply(progress + 1);
                    this.scene.playSound(300 + progress * 120, 'sine', 0.2);
                    if (progress === steps.length) { finished = true; this.close(); onComplete(); } else show();
                } })),
                { label: '先查看手记', run: () => this.journal() },
                { label: '暂时离开供桌', run: () => this.close() }
            ])) return;
            const rule = Maps.room_main.objects.interactables.find(item => item.id === 'ritual_note');
            const knownRule = getJournalEntries(this.state).find(card => card.name === rule.documentTitle);
            if (knownRule) this.evidenceNote(this.el('case-body'), knownRule).open = true;
        };
        show();
    }

    confirm(title, text, label, callback) {
        this.modal(title, text, [{ label, run: () => { this.close(); callback(); } }, { label: '我还想再看看', run: () => this.close() }]);
    }

    memoryReturnAction() {
        const target = getMemoryReturn(this.scene.currentMapId);
        if (!target) return null;
        return {
            label: `暂回${Maps[target.mapId].name}${this.state.isChasing ? '（追逐将恢复）' : '（保留线索）'}`,
            run: () => {
                this.close();
                this.scene.switchScene(target.mapId, target.x, target.y);
            }
        };
    }

    pause() {
        const returnAction = this.memoryReturnAction();
        this.modal('雨暂未停', `在安全房间自动留下存档。重新进入时，可在标题页继续。${returnAction ? '\n可以暂时放下这段记忆。已读物证保留，尚未提交的判断不算完成；之后可从原来的旧物再次进入。' : ''}`, [
            { label: '继续探索', run: () => this.close() },
            ...(returnAction ? [returnAction] : []),
            { label: this.scene.soundManager.micStream ? '关闭声控躲藏' : '开启声控躲藏（可选）', run: async () => {
                const sound = this.scene.soundManager;
                if (sound.micStream) { sound.stopMic(); this.pause(); }
                else {
                    const page = this.el('case-body').firstChild;
                    const enabled = await sound.initMic();
                    if (!this.root.isConnected || !this.open || this.el('case-body').firstChild !== page) return;
                    if (enabled) this.pause();
                    else this.el('case-feedback').textContent = '麦克风未开启，仍然可以正常躲藏和通关。';
                }
            } },
            { label: this.state.isHidden || (this.state.isChasing && isPursuitSpace(this.scene.currentMapId)) ? '返回标题（使用上次安全记录）' : '保存并返回标题', run: () => {
                const start = this.scene.safeStart;
                saveCheckpoint(this.state, this.scene.currentMapId, start.x, start.y);
                this.close();
                this.scene.scene.start('TitleScene');
            } }
        ]);
    }

    update() {
        const [chapter, objective] = getObjective(this.state, this.scene.currentMapId);
        this.el('case-chapter').textContent = chapter;
        this.el('case-objective').textContent = objective;
        const player = this.scene.player;
        const status = this.state.isHidden ? (this.state.isChasing ? `脚步正在远去 · 保持安静 ${Math.max(0, Math.ceil((6000 - (this.scene.hiddenElapsed || 0)) / 1000))} 秒` : '脚步停了 · 按 E 离开') : pursuitCue(this.scene) || (player.isRunning ? `奔跑 · 体力 ${Math.round(player.stamina)}%` : player.exhausted ? '气息未稳 · 慢行恢复体力' : this.scene.eventManager?.caption || '');
        if (this.el('case-status').textContent !== status) this.el('case-status').textContent = status;
        const fingerprint = JSON.stringify(this.state);
        if (fingerprint !== this.savedFingerprint && !window.dialogActive && !this.scene.isManipulating && this.scene.time.now >= (this.nextSaveAt || 0)) {
            this.savedFingerprint = fingerprint;
            this.nextSaveAt = this.scene.time.now + 1500;
            const start = this.scene.safeStart;
            saveCheckpoint(this.state, this.scene.currentMapId, start.x, start.y);
        }
    }

    dispose() {
        if (this.open) this.close();
        this.timer.remove();
        document.removeEventListener('keydown', this.onKey);
        window.removeEventListener('pointerup', this.endSprint);
        window.removeEventListener('pointercancel', this.endSprint);
        if (window.showDocument === this.documentWrapper) window.showDocument = this.originalDocument;
        this.root.remove();
    }
}
