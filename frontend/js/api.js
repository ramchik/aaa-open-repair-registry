const API_BASE = '/api';

const api = {
    async get(path, params = {}) {
        const url = new URL(API_BASE + '/' + path, window.location.origin);
        Object.keys(params).forEach(k => params[k] != null && url.searchParams.append(k, params[k]));
        const r = await fetch(url);
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async post(path, body) {
        const r = await fetch(API_BASE + '/' + path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async put(path, body) {
        const r = await fetch(API_BASE + '/' + path, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    },
    async delete(path) {
        const r = await fetch(API_BASE + '/' + path, { method: 'DELETE' });
        if (!r.ok) throw new Error(await r.text());
        return r.json();
    }
};

// Utility: get URL query param
function qp(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// Utility: format date for display
function fmtDate(d) {
    if (!d) return '–';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Utility: calc age from dob
function calcAge(dob) {
    if (!dob) return '–';
    const diff = Date.now() - new Date(dob).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

// Utility: set form field values from an object
function populateForm(formId, data) {
    const form = document.getElementById(formId);
    if (!form) return;
    Object.keys(data).forEach(key => {
        const el = form.elements[key];
        if (!el) return;
        if (el.type === 'checkbox') el.checked = !!data[key];
        else if (el.type === 'date' && data[key]) el.value = data[key].substring(0, 10);
        else el.value = data[key] ?? '';
    });
}

// Utility: collect form data as object, converting checkboxes and numbers
function collectForm(formId) {
    const form = document.getElementById(formId);
    const data = {};
    Array.from(form.elements).forEach(el => {
        if (!el.name) return;
        if (el.type === 'checkbox') data[el.name] = el.checked;
        else if (el.type === 'number') data[el.name] = el.value !== '' ? Number(el.value) : null;
        else data[el.name] = el.value || null;
    });
    return data;
}
