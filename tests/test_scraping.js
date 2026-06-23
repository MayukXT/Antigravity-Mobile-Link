import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTest() {
    console.log('🧪 Starting Scraping Heuristics Test...');

    const htmlPath = path.join(__dirname, 'mock_cascade.html');
    const mockHtml = fs.readFileSync(htmlPath, 'utf8');

    // Create a virtual browser environment with JSDOM
    const dom = new JSDOM(mockHtml, {
        url: 'http://localhost',
        runScripts: 'dangerously'
    });

    const { window } = dom;
    const { document } = window;

    // Define mock window.getComputedStyle because JSDOM doesn't support full layout computed styles out of the box
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = (el) => {
        const style = originalGetComputedStyle(el);
        // Add mock behaviors to simulate layout
        style.cursor = el.tagName === 'BUTTON' || el.className.includes('cursor-pointer') ? 'pointer' : 'default';
        style.position = el.style.position || 'static';
        return style;
    };

    // The core scraping script extracted from server.js
    const captureSnapshotTest = async () => {
        let cascade = document.getElementById('conversation') || document.getElementById('chat') || document.getElementById('cascade');
        if (!cascade) {
            cascade = document.querySelector('.interactive-session') || document.querySelector('.chat-body') || document.querySelector('.chat-container') || document.querySelector('.vscode-chat-view');
        }
        if (!cascade) {
            return { error: 'chat container not found' };
        }
        
        const cascadeStyles = window.getComputedStyle(cascade);
        
        const scrollContainer = cascade.querySelector('.overflow-y-auto, [data-scroll-area]') || cascade;
        const scrollInfo = {
            scrollTop: scrollContainer.scrollTop,
            scrollHeight: scrollContainer.scrollHeight,
            clientHeight: scrollContainer.clientHeight,
            scrollPercent: scrollContainer.scrollTop / (scrollContainer.scrollHeight - scrollContainer.clientHeight) || 0
        };
        
        const candidates = cascade.querySelectorAll('*');
        candidates.forEach(el => {
            try {
                const pos = window.getComputedStyle(el).position;
                if (pos === 'fixed' || pos === 'absolute') {
                    el.setAttribute('data-ag-rem', 'true');
                }
            } catch(e) {}
        });

        const clone = cascade.cloneNode(true);
        candidates.forEach(el => el.removeAttribute('data-ag-rem'));
        
        try {
            const interactionSelectors = [
                'div[class*="interaction-area"]',
                '.p-1.bg-gray-500\\\\/10',
                '.outline-solid.justify-between',
                '[contenteditable="true"]',
                '[data-lexical-editor]',
                '[id="antigravity.agentSidePanelInputBox"]',
                '[aria-label="Message input"]',
                'form',
                '.fixed.bottom-0',
                '.absolute.bottom-0'
            ];

            interactionSelectors.forEach(selector => {
                let matched = [];
                try {
                    matched = Array.from(clone.querySelectorAll(selector));
                } catch(e) {
                    matched = [];
                }
                matched.forEach(el => {
                    try {
                        const text = (el.innerText || '').toLowerCase();
                        const isActionArea = text.includes('allow') || text.includes('deny') || 
                                           text.includes('review') || text.includes('run') ||
                                           text.includes('confirm');
                        
                        const isEditor = el.getAttribute('contenteditable') === 'true' || 
                                       el.hasAttribute('data-lexical-editor') ||
                                       text.includes('ask anything') ||
                                       text.includes('to mention');
                        if (!isEditor && isActionArea && selector !== '[contenteditable="true"]') {
                            return; 
                        }

                        let targetToRemove = el;
                        if (isEditor || selector.includes('bottom-0')) {
                             let parent = el.parentElement;
                             for (let i = 0; i < 4; i++) {
                                 if (!parent || parent === clone) break;
                                 const pCls = (parent.className || '').toString();
                                 if (pCls.includes('message') || pCls.includes('bubble') || pCls.includes('conversation')) break;
                                 if (pCls.includes('mx-') || pCls.includes('mb-') || pCls.includes('bg-') || pCls.includes('rounded')) {
                                     targetToRemove = parent;
                                 }
                                 parent = parent.parentElement;
                             }
                        }
                        
                        if (targetToRemove && targetToRemove !== clone) {
                            targetToRemove.remove();
                        } else {
                            el.remove();
                        }
                    } catch(e) {}
                });
            });

            const allElements = clone.querySelectorAll('*');
            allElements.forEach(el => {
                try {
                    const text = (el.innerText || '').toLowerCase();
                    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
                    const isInputPlaceholder = text.includes('ask anything') || 
                                              text.includes('to mention') || 
                                              placeholder.includes('ask anything');
                    
                    if (isInputPlaceholder) {
                        let container = el;
                        for (let i = 0; i < 5; i++) {
                            if (!container.parentElement || container.parentElement === clone) break;
                            const cls = (container.className || '').toString();
                            if (cls.includes('flex-col') || cls.includes('input') || cls.includes('area')) {
                                container.remove();
                                return;
                            }
                            container = container.parentElement;
                        }
                        el.remove();
                        return;
                    }
                } catch(e) {}
            });

            const redundantElements = clone.querySelectorAll('[contenteditable="true"], [data-lexical-editor], [role="textbox"], form, .mx-8.mb-8, .mx-4.mb-4');
            redundantElements.forEach(el => {
                try {
                    let branch = el;
                    while (branch.parentElement && branch.parentElement !== clone) {
                        const p = branch.parentElement;
                        const pCls = (p.className || '').toString().toLowerCase();
                        if (pCls.includes('message') || pCls.includes('bubble') || pCls.includes('conversation')) break;
                        branch = p;
                    }
                    if (branch && branch !== clone) branch.remove();
                    else el.remove();
                } catch(e) {}
            });

            clone.querySelectorAll('[data-ag-rem]').forEach(el => {
                try {
                    const text = (el.innerText || '').toLowerCase();
                    if (text.includes('allow') || text.includes('deny') || text.includes('review')) {
                        el.removeAttribute('data-ag-rem');
                        return;
                    }
                    el.remove();
                } catch(e) {}
            });
        } catch (globalErr) {
            console.error('Capture script inner error:', globalErr);
        }

        try {
            clone.querySelectorAll('[id="antigravity.agentSidePanelInputBox"], [aria-label="Message input"], [contenteditable="true"][role="combobox"]').forEach(el => {
                const composer = el.closest('[id="antigravity.agentSidePanelInputBox"]');
                if (composer && composer !== clone) composer.remove();
                else el.remove();
            });
        } catch(e) {}

        const html = clone.outerHTML;
        return {
            html: html,
            stats: {
                nodes: clone.getElementsByTagName('*').length,
                htmlSize: html.length
            }
        };
    };

    const result = await captureSnapshotTest();

    // --- ASSERTIONS ---
    console.log('🔍 Running assertions...');

    // 1. Verify JSDOM successfully parsed conversation
    if (!result || result.error) {
        console.error('❌ Failed: Scraping script returned error:', result?.error);
        process.exit(1);
    }
    console.log('✅ Found chat container, processed successfully.');

    // Create a DOM wrapper of the result to inspect output
    const outputDom = new JSDOM(result.html);
    const doc = outputDom.window.document;

    // 2. Check if the contenteditable editor box was removed
    const editor = doc.querySelector('[contenteditable="true"]');
    if (editor) {
        console.error('❌ Failed: [contenteditable="true"] editor block was not removed!');
        process.exit(1);
    }
    console.log('✅ Verified [contenteditable="true"] input successfully removed.');

    const currentComposer = doc.querySelector('[id="antigravity.agentSidePanelInputBox"]');
    if (currentComposer) {
        console.error('❌ Failed: current Antigravity side-panel composer was not removed!');
        process.exit(1);
    }
    console.log('✅ Verified current Antigravity side-panel composer removed.');

    // 3. Check if the bottom input panel container (.absolute.bottom-0) was removed
    const bottomPanel = doc.querySelector('.absolute.bottom-0');
    if (bottomPanel) {
        console.error('❌ Failed: bottom input panel container was not removed!');
        process.exit(1);
    }
    console.log('✅ Verified bottom input panel successfully removed.');

    // 4. Verify that action buttons inside conversation were preserved
    const buttons = doc.querySelectorAll('button');
    if (buttons.length === 0) {
        console.error('❌ Failed: Action buttons inside conversation were deleted!');
        process.exit(1);
    }
    console.log(`✅ Verified action buttons preserved (Found: ${buttons.length}).`);

    // 5. Verify that thinking/thought blocks were preserved
    const thoughts = doc.querySelectorAll('.thought, .thinking');
    if (thoughts.length === 0) {
        console.error('❌ Failed: Thinking/thought blocks were deleted!');
        process.exit(1);
    }
    console.log(`✅ Verified thinking/thought blocks preserved (Found: ${thoughts.length}).`);

    console.log('\n🎉 ALL SCRAPING HEURISTIC TESTS PASSED SUCCESSFULLY!');
}

runTest().catch(err => {
    console.error('❌ Test execution failed with exception:', err);
    process.exit(1);
});
