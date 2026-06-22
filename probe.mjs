import WebSocket from 'ws';
import http from 'http';

function getJson(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        }).on('error', reject);
    });
}

const port = process.env.PORT || 9000;
const list = await getJson(`http://127.0.0.1:${port}/json/list`);
const target = list.find(t => t.url?.includes('workbench.html') && !t.url.includes('jetski'))
    || list.find(t => t.url?.includes('workbench.html'))
    || list.find(t => t.type === 'page');

console.log('TARGET url:', target.url);
console.log('TARGET title:', target.title);

const ws = new WebSocket(target.webSocketDebuggerUrl);
let id = 1;
const pending = new Map();
const capturedContexts = [];

ws.on('message', (raw) => {
    try {
        const d = JSON.parse(raw.toString());
        if (d.method === 'Runtime.executionContextCreated') {
            capturedContexts.push(d.params.context);
        }
        if (d.id !== undefined && pending.has(d.id)) {
            const p = pending.get(d.id);
            pending.delete(d.id);
            if (d.error) p.rej(d.error); else p.res(d.result);
        }
    } catch {}
});
await new Promise(r => ws.on('open', r));
console.log('WS open');

const call = (method, params) => new Promise((res, rej) => {
    const i = id++;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
});

// enable Runtime first so contexts come in
await call('Runtime.enable', {});
// give context events time
await new Promise(r => setTimeout(r, 1500));
console.log('Captured contexts:', capturedContexts.length, capturedContexts.map(c => c.id));

const PROBE = `(function probe(){
    try {
        const conv = document.getElementById('conversation');
        const chat = document.getElementById('chat');
        const cascade = document.getElementById('cascade');

        const tooltips = new Set();
        document.querySelectorAll('*').forEach(el => {
            const t = el.getAttribute('data-tooltip-id');
            if (t) tooltips.add(t);
            const ar = el.getAttribute && el.getAttribute('aria-label');
        });

        let arr = [];
        document.querySelectorAll('div, main, section, article').forEach(el => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 200 || rect.height < 200) return;
            const t = (el.innerText || '').trim();
            if (t.length < 200) return;
            if (rect.height > 1500) return;
            const childrenWithLongText = Array.from(el.children).filter(c => (c.innerText || '').length > 200).length;
            if (childrenWithLongText > 0) return;
            arr.push({
                tag: el.tagName.toLowerCase(),
                id: el.id,
                cls: typeof el.className === 'string' ? el.className.substring(0, 80) : '',
                role: el.getAttribute('role'),
                aria: el.getAttribute('aria-label'),
                textLen: t.length,
                first80: t.substring(0, 80),
                rect: { w: Math.round(rect.width), h: Math.round(rect.height) }
            });
        });

        return JSON.stringify({
            url: location.href,
            has: { conversation: !!conv, chat: !!chat, cascade: !!cascade },
            convTextLen: conv ? (conv.innerText||'').length : null,
            convOuterLen: conv ? conv.outerHTML.length : null,
            convOuterStart: conv ? conv.outerHTML.substring(0,300) : null,
            tooltipsFound: Array.from(tooltips).slice(0,120),
            likelyContainers: arr.slice(0,30)
        });
    } catch (e) { return JSON.stringify({ error: e.toString() }); }
})()`;

for (const ctx of capturedContexts) {
    try {
        const r = await call('Runtime.evaluate', { expression: PROBE, returnByValue: true, contextId: ctx.id });
        const v = r.result && r.result.value;
        console.log(`\n===== Context ${ctx.id} (${ctx.name || ''} origin=${ctx.origin || ''}) =====`);
        if (!v) { console.log('(no value)'); continue; }
        try { console.log(JSON.stringify(JSON.parse(v), null, 2)); } catch { console.log(v); }
    } catch (e) {
        console.log(`ctx ${ctx.id} err:`, e && e.message);
    }
}

ws.close();
process.exit(0);
