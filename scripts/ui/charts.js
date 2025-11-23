
// Simple bar chart with absence handling
export function buildBarChart(points, opts) {
    const width = (opts && opts.width) || 360;
    const height = (opts && opts.height) || 160;
    const padTop = 8;
    const padRight = 10;
    const padBottom = 22;
    const padLeft = 34;
    const fill = (opts && opts.fill) || 'var(--accent)';
    const fillTop = (opts && opts.fillTop) || '#f59e0b';
    const labels = (opts && opts.labels) || null;
    const absences = (opts && opts.absences) || null;
    const tops = (opts && opts.tops) || null; // boolean[]: highest score of the session
    const n = Array.isArray(points) ? points.length : 0;
    if (!n) { return null; }
    const maxVal = Math.max(0, ...points);
    const minVal = 0;
    const innerW = Math.max(1, width - padLeft - padRight);
    const innerH = Math.max(1, height - padTop - padBottom);
    // Use equal slots so bars never overlap the y-axis
    const slotW = innerW / n;
    const range = Math.max(1e-6, maxVal - minVal);
    function xCenterAt(i) { return padLeft + slotW * (i + 0.5); }
    function yAt(v) { return padTop + (1 - (v - minVal) / range) * innerH; }
    // Bar width: bounded fraction of slot and absolute cap
    const barW = Math.max(2, Math.min(slotW * 0.7, 18));

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Points by session (bar)');

    // Y-axis + grid
    function computeYTicks(minV, maxV) {
        if (maxV <= minV) return [minV, maxV];
        let span = maxV - minV;
        let step = 1;
        if (span > 20) step = 5; else if (span > 10) step = 2; else step = 1;
        const out = [];
        let start = Math.ceil(minV / step) * step;
        if (start > minV) start = minV;
        for (let v = start; v <= maxV; v += step) { out.push(v); }
        if (out[0] !== minV) out.unshift(minV);
        if (out[out.length - 1] !== maxV) out.push(maxV);
        return Array.from(new Set(out));
    }
    const yTicks = computeYTicks(minVal, maxVal);
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', String(padLeft)); yAxis.setAttribute('x2', String(padLeft));
    yAxis.setAttribute('y1', String(padTop)); yAxis.setAttribute('y2', String(padTop + innerH));
    yAxis.setAttribute('stroke', 'var(--border)'); yAxis.setAttribute('stroke-width', '1');
    svg.appendChild(yAxis);
    yTicks.forEach(v => {
        const y = yAt(v);
        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        grid.setAttribute('x1', String(padLeft)); grid.setAttribute('x2', String(padLeft + innerW));
        grid.setAttribute('y1', String(y)); grid.setAttribute('y2', String(y));
        grid.setAttribute('stroke', 'var(--border)'); grid.setAttribute('stroke-width', '1'); grid.setAttribute('opacity', '0.7');
        svg.appendChild(grid);
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', String(padLeft - 6));
        txt.setAttribute('y', String(y + 3));
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('font-size', '10');
        txt.setAttribute('fill', 'var(--muted)');
        txt.textContent = String(v);
        svg.appendChild(txt);
    });
    const baseY = yAt(0);
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', String(padLeft)); xAxis.setAttribute('x2', String(padLeft + innerW));
    xAxis.setAttribute('y1', String(baseY)); xAxis.setAttribute('y2', String(baseY));
    xAxis.setAttribute('stroke', 'var(--border)'); xAxis.setAttribute('stroke-width', '1');
    svg.appendChild(xAxis);

    // X ticks/labels
    if (n >= 1) {
        const maxTicks = Math.min(6, n);
        const step = Math.max(1, Math.ceil((n - 1) / (maxTicks - 1)));
        for (let i = 0; i < n; i += step) {
            const x = xCenterAt(i);
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(baseY + 14));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', 'var(--muted)');
            let text = String(i + 1);
            if (labels && labels[i]) text = (opts && opts.formatDate) ? opts.formatDate(labels[i]) : labels[i];
            label.textContent = text;
            svg.appendChild(label);
        }
    }

    // Bars
    for (let i = 0; i < n; i++) {
        const isAbsent = !!(absences && absences[i]);
        const xCenterSlot = xCenterAt(i);
        // Ensure we don't draw over the y-axis line: leave a 1px gap
        const slotLeft = padLeft + slotW * i;
        let x = slotLeft + (slotW - barW) / 2 + 1;
        const v = points[i] || 0;
        if (isAbsent) {
            // Draw an X to mark absence
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(xCenterSlot));
            t.setAttribute('y', String(baseY - 1));
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'alphabetic');
            t.setAttribute('font-size', '12');
            t.setAttribute('fill', '#9ca3af');
            t.textContent = '×';
            svg.appendChild(t);
            continue;
        }
        const y = v > 0 ? yAt(v) : (baseY - 2);
        const h = Math.max(2, baseY - y);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', String(x));
        rect.setAttribute('y', String(y));
        rect.setAttribute('width', String(barW));
        rect.setAttribute('height', String(h));
        // Color top-of-day bars gold
        const isTop = !!(tops && tops[i]);
        rect.setAttribute('fill', isTop ? fillTop : fill);
        rect.setAttribute('opacity', v > 0 ? '0.95' : '0.7');
        svg.appendChild(rect);
        // Label points: inside the bar when tall enough; otherwise above
        if (v > 0) {
            const xCenter = x + barW / 2; // center labels exactly over the bar
            // Value label
            const val = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            val.setAttribute('x', String(xCenter));
            val.setAttribute('text-anchor', 'middle');
            val.setAttribute('font-size', '10');
            let valY;
            if (h >= 16) {
                const basePos = y + Math.min(h - 3, 12);
                valY = basePos;
                val.setAttribute('fill', '#ffffff');
            } else {
                const basePos = Math.max(padTop + 10, y - 2);
                valY = basePos;
                val.setAttribute('fill', 'var(--muted)');
            }
            val.setAttribute('y', String(valY));
            val.textContent = String(v);
            svg.appendChild(val);
        }
    }

    return svg;
}

export function buildLineChart(points, opts) {
    const width = (opts && opts.width) || 360;
    const height = (opts && opts.height) || 140;
    const padTop = 8;
    const padRight = 10;
    const padBottom = 22; // room for x labels
    const padLeft = 34;   // room for y labels
    const stroke = (opts && opts.stroke) || 'var(--accent)';
    const strokeWidth = (opts && opts.strokeWidth) || 2;
    const dot = (opts && opts.dotRadius) || 2;
    const labels = (opts && opts.labels) || null; // optional x labels (dates)
    const absences = (opts && opts.absences) || null; // optional boolean[] whether player was absent that session
    const arr = Array.isArray(points) ? points.map(v => (typeof v === 'number' && Number.isFinite(v)) ? v : null) : [];
    const n = arr.length;
    const numericVals = arr.filter(v => v !== null);
    if (!n || numericVals.length === 0) { return null; }
    const maxVal = Math.max(0, ...numericVals);
    const minVal = (opts && typeof opts.min === 'number') ? opts.min : 0; // allow custom baseline (e.g., rank starts at 1)
    const innerW = Math.max(1, width - padLeft - padRight);
    const innerH = Math.max(1, height - padTop - padBottom);
    const dx = n > 1 ? (innerW / (n - 1)) : 0;
    const range = Math.max(1e-6, maxVal - minVal);
    function xAt(i) { return padLeft + i * dx; }
    function yAt(v) { return padTop + (1 - (v - minVal) / range) * innerH; }

    // Build path
    // Build a path that connects only between non-absent consecutive points.
    let d = '';
    let segmentOpen = false;
    for (let i = 0; i < n; i++) {
        const isAbsent = !!(absences && absences[i]);
        const val = arr[i];
        if (isAbsent || val === null) { segmentOpen = false; continue; }
        const x = xAt(i); const y = yAt(val);
        if (!segmentOpen) { d += 'M' + x + ' ' + y + ' '; segmentOpen = true; }
        else { d += 'L' + x + ' ' + y + ' '; }
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.style.width = '100%';
    svg.style.height = 'auto';
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Points by session');

    // Y-axis and grid ticks
    function computeYTicks(minV, maxV) {
        if (maxV <= minV) return [minV, maxV];
        // choose a step targeting ~5 ticks
        let span = maxV - minV;
        let step = 1;
        if (span > 20) step = 5; else if (span > 10) step = 2; else step = 1;
        const out = [];
        // start at minV rounded to step
        let start = Math.ceil(minV / step) * step;
        if (start > minV) start = minV;
        for (let v = start; v <= maxV; v += step) { out.push(v); }
        if (out[0] !== minV) out.unshift(minV);
        if (out[out.length - 1] !== maxV) out.push(maxV);
        return Array.from(new Set(out));
    }
    const yTicks = computeYTicks(minVal, maxVal);
    // y-axis line
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', String(padLeft)); yAxis.setAttribute('x2', String(padLeft));
    yAxis.setAttribute('y1', String(padTop)); yAxis.setAttribute('y2', String(padTop + innerH));
    yAxis.setAttribute('stroke', 'var(--border)'); yAxis.setAttribute('stroke-width', '1');
    svg.appendChild(yAxis);
    // grid + labels
    yTicks.forEach(v => {
        const y = yAt(v);
        const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        grid.setAttribute('x1', String(padLeft)); grid.setAttribute('x2', String(padLeft + innerW));
        grid.setAttribute('y1', String(y)); grid.setAttribute('y2', String(y));
        grid.setAttribute('stroke', 'var(--border)'); grid.setAttribute('stroke-width', '1'); grid.setAttribute('opacity', '0.7');
        svg.appendChild(grid);
        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', String(padLeft - 6));
        txt.setAttribute('y', String(y + 3));
        txt.setAttribute('text-anchor', 'end');
        txt.setAttribute('font-size', '10');
        txt.setAttribute('fill', 'var(--muted)');
        txt.textContent = String(v);
        svg.appendChild(txt);
    });
    const baseY = yAt(minVal);
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', String(padLeft)); xAxis.setAttribute('x2', String(padLeft + innerW));
    xAxis.setAttribute('y1', String(baseY)); xAxis.setAttribute('y2', String(baseY));
    xAxis.setAttribute('stroke', 'var(--border)'); xAxis.setAttribute('stroke-width', '1');
    svg.appendChild(xAxis);

    // X ticks and labels (sparse)
    if (n >= 1) {
        const maxTicks = Math.min(6, n);
        const step = Math.max(1, Math.ceil((n - 1) / (maxTicks - 1)));
        for (let i = 0; i < n; i += step) {
            const x = xAt(i);
            const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            tick.setAttribute('x1', String(x)); tick.setAttribute('x2', String(x));
            tick.setAttribute('y1', String(baseY)); tick.setAttribute('y2', String(baseY + 4));
            tick.setAttribute('stroke', 'var(--border)'); tick.setAttribute('stroke-width', '1');
            svg.appendChild(tick);
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(baseY + 14));
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', 'var(--muted)');
            let text = String(i + 1);
            if (labels && labels[i]) {
                text = (opts && opts.formatDate) ? opts.formatDate(labels[i]) : labels[i];
            }
            label.textContent = text;
            svg.appendChild(label);
        }
        // Ensure last label shows
        if ((n - 1) % step !== 0) {
            const i = n - 1; const x = xAt(i);
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', String(x));
            label.setAttribute('y', String(baseY + 14));
            label.setAttribute('text-anchor', 'end');
            label.setAttribute('font-size', '10');
            label.setAttribute('fill', 'var(--muted)');
            const text = labels && labels[i] ? ((opts && opts.formatDate) ? opts.formatDate(labels[i]) : labels[i]) : String(i + 1);
            label.textContent = text;
            svg.appendChild(label);
        }
    }

    // Line path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d.trim());
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', String(strokeWidth));
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(path);

    // Dots
    for (let i = 0; i < n; i++) {
        const x = xAt(i);
        const val = arr[i];
        const isAbsent = !!(absences && absences[i]);
        if (isAbsent) {
            const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            t.setAttribute('x', String(x));
            t.setAttribute('y', String(yAt(minVal)));
            t.setAttribute('text-anchor', 'middle');
            t.setAttribute('dominant-baseline', 'central');
            t.setAttribute('font-size', '12');
            t.setAttribute('fill', '#9ca3af');
            t.textContent = '×';
            svg.appendChild(t);
        } else if (val !== null) {
            const y = yAt(val);
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', String(x)); c.setAttribute('cy', String(y));
            c.setAttribute('r', String(dot));
            c.setAttribute('fill', stroke);
            c.setAttribute('opacity', '0.9');
            svg.appendChild(c);
        }
    }
    return svg;
}
