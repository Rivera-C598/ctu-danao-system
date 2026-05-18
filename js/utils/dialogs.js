/* ============================================
   CTU Room Management System - Dialog Utilities
   Replaces browser alert/confirm/prompt
   ============================================ */

function _dlgBase(html) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:14px;padding:24px;max-width:380px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,0.25);font-family:inherit;">${html}</div>`;
    document.body.appendChild(overlay);
    return overlay;
}

function showConfirm(message, { title = 'Confirm', confirmText = 'Confirm', confirmStyle = 'background:#c0392b;color:white;', cancelText = 'Cancel' } = {}) {
    return new Promise(resolve => {
        const overlay = _dlgBase(`
            ${title ? `<div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:var(--text,#1a1a1a);">${title}</div>` : ''}
            <div style="font-size:0.88rem;color:var(--text-sub,#555);line-height:1.6;margin-bottom:20px;">${message}</div>
            <div style="display:flex;gap:10px;">
                <button id="_dlgCancel" style="flex:1;padding:10px;border:1.5px solid #ddd;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;color:var(--text-sub,#555);">${cancelText}</button>
                <button id="_dlgOk" style="flex:1;padding:10px;border:none;${confirmStyle}border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;">${confirmText}</button>
            </div>`);
        overlay.querySelector('#_dlgOk').onclick    = () => { overlay.remove(); resolve(true); };
        overlay.querySelector('#_dlgCancel').onclick = () => { overlay.remove(); resolve(false); };
    });
}

function showPromptDialog(message, { placeholder = '', title = '', initialValue = '' } = {}) {
    return new Promise(resolve => {
        const overlay = _dlgBase(`
            ${title ? `<div style="font-weight:700;font-size:1rem;margin-bottom:8px;color:var(--text,#1a1a1a);">${title}</div>` : ''}
            <div style="font-size:0.88rem;color:var(--text-sub,#555);margin-bottom:12px;">${message}</div>
            <input id="_dlgInput" type="text" value="${initialValue}" placeholder="${placeholder}"
                style="width:100%;padding:10px;border:1.5px solid #ddd;border-radius:8px;font-size:0.9rem;font-family:inherit;box-sizing:border-box;margin-bottom:16px;outline:none;">
            <div style="display:flex;gap:10px;">
                <button id="_dlgCancel" style="flex:1;padding:10px;border:1.5px solid #ddd;background:transparent;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;">Cancel</button>
                <button id="_dlgOk" style="flex:1;padding:10px;border:none;background:#c0392b;color:white;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;">OK</button>
            </div>`);
        const input = overlay.querySelector('#_dlgInput');
        input.focus();
        input.select();
        const ok     = () => { const v = input.value.trim(); overlay.remove(); resolve(v || null); };
        const cancel = () => { overlay.remove(); resolve(null); };
        overlay.querySelector('#_dlgOk').onclick     = ok;
        overlay.querySelector('#_dlgCancel').onclick  = cancel;
        input.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') cancel(); });
    });
}

function showToast(message, type = 'info', duration = 4000) {
    if (typeof showNotification === 'function') {
        const titles = { success: 'Done', error: 'Error', info: 'Notice', warning: 'Warning' };
        showNotification(titles[type] || '', message, type, duration);
    }
}
