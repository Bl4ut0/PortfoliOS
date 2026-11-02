// Window drag integration for PortfoliOS browser window
(function () {
	let isDragging = false;

	document.addEventListener('pointerdown', (e) => {
		if (e.button !== 0) return;
		const tabstrip = e.target.closest('#tabstrip');
		if (!tabstrip) return;
		if (e.target.closest('button, a, input, [role="tab"], .tab, .pinned-tabs, #hovercard, [class*="tab-"]')) return;
		isDragging = true;
		try {
			window.parent?.postMessage({
				source: 'portfolios-browserjs',
				type: 'window-drag-start',
				screenX: e.screenX,
				screenY: e.screenY
			}, '*');
		} catch (_) {}
	});

	document.addEventListener('pointermove', (e) => {
		if (!isDragging) return;
		try {
			window.parent?.postMessage({
				source: 'portfolios-browserjs',
				type: 'window-drag-move',
				screenX: e.screenX,
				screenY: e.screenY
			}, '*');
		} catch (_) {}
	});

	const endDrag = () => {
		if (!isDragging) return;
		isDragging = false;
		try {
			window.parent?.postMessage({
				source: 'portfolios-browserjs',
				type: 'window-drag-end'
			}, '*');
		} catch (_) {}
	};

	document.addEventListener('pointerup', endDrag);
	document.addEventListener('pointercancel', endDrag);

	document.addEventListener('dblclick', (e) => {
		if (e.button !== 0) return;
		const tabstrip = e.target.closest('#tabstrip');
		if (!tabstrip) return;
		if (e.target.closest('button, a, input, [role="tab"], .tab, .pinned-tabs, #hovercard')) return;
		try {
			window.parent?.postMessage({
				source: 'portfolios-browserjs',
				type: 'window-dblclick'
			}, '*');
		} catch (_) {}
	});
})();
