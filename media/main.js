(function () {
	const vscode = acquireVsCodeApi();

	function getVisibleItems() {
		return Array.from(document.querySelectorAll('li[data-path]'))
			.filter(item => item.style.display !== 'none');
	}

	const list = getVisibleItems();

	window.addEventListener('message', (event) => {
		const { command, html, index } = event.data;
		const list = getVisibleItems();
		if (command === 'renderExpand') {
			const li = list[index];
			const nested = li.querySelector('.nested');
			if (nested) {
				const isVisible = nested.style.display === 'block';
				if (isVisible) {
					nested.innerHTML = '';
					nested.style.display = 'none';
				} else {
					nested.innerHTML = html;
					nested.style.display = 'block';
				}
			}
		}
	});

	let index = 0;
	const { focusedFile } = window.initialState;
	if (focusedFile) {
		for (let i = 0; i < list.length; i++) {
			if (list[i].dataset.path === focusedFile) {
				index = i;
				break;
			}
		}
	}

	list?.[index].focus();
	list?.[index].blur();

	function focusItem(i) {
		const list = getVisibleItems();
		list.forEach((el) => el.classList.remove('active'));
		list?.[i].classList.add('active');
	}

	focusItem(index);

	function openPath(path) {
		vscode.postMessage({ command: 'open', path, cursorIndex: index });
	}

	function fuzzyMatch(query, text) {
		query = query.toLowerCase();
		text = text.toLowerCase();

		let qIndex = 0;
		for (let t of text) {
			if (t === query[qIndex]) { qIndex++; }
			if (qIndex === query.length) { return true; }
		}
		return false;
	}

	const searchBar = document.getElementById('search-bar');
	const searchInput = document.getElementById('search-input');

	document.addEventListener('keydown', (e) => {
		const isInSearch = document.activeElement === document.getElementById('search-input');
		const list = getVisibleItems();

		if (isInSearch) {
			if (e.ctrlKey && (e.key === 'n' || e.key === 'p')) {
				e.preventDefault();
				if (e.key === 'n') {
					index = (index + 1) % list.length;
				} else if (e.key === 'p') {
					index = (index - 1 + list.length) % list.length;
				}
				focusItem(index);
				return;
			}
			if (e.key === 'Enter') {
				openPath(getVisibleItems()?.[index].dataset.path);
				searchBar.style.display = 'none';
				searchInput.value = '';
				filter('');
				document.activeElement.blur();
				return;
			}
			// While search is active, only handle ESC
			if (e.key === 'Escape') {
				searchBar.style.display = 'none';
				searchInput.value = '';
				filter('');
				document.activeElement.blur();
			}
			return;
		}

		const active = list[index];
		const path = active?.dataset.link || active?.dataset.path;
		const type = active?.dataset.type;

		const moveDown = () => {
			index = (index + 1) % list.length;
			focusItem(index);
		};

		const moveUp = () => {
			index = (index - 1 + list.length) % list.length;
			focusItem(index);
		};

		switch (e.key) {
			case 'j':
				e.preventDefault();
				moveDown();
				break;
			case 'k':
				e.preventDefault();
				moveUp();
				break;
			case 'n':
			case 'N':
				if (e.ctrlKey) {
					e.preventDefault();
					moveDown();
				}
				break;
			case 'p':
			case 'P':
				if (e.ctrlKey) {
					e.preventDefault();
					moveUp();
				}
				break;
			case 'Delete':
			case 'Backspace':
				vscode.postMessage({ command: 'confirmDelete', path });
				break;
			case 'r':
				vscode.postMessage({ command: 'requestRename', path });
				break;
			case 'Enter':
				openPath(path);
				break;
			case 'g':
				vscode.postMessage({ command: 'reload' });
				break;
			case '-':
				openPath('..');
				break;
			case '+':
				vscode.postMessage({ command: 'createNewFile', path, type });
				break;
			case ' ':
				if (type === "directory") {
					vscode.postMessage({ command: 'expand', path, index });
				}
				break;
			case 'd':
				vscode.postMessage({ command: 'createNewDir', path, type });
				break;
			case '/':
				e.preventDefault();
				searchBar.style.display = 'block';
				searchInput.focus();
				break;
			case 'Escape':
				if (searchBar.style.display === 'block') {
					searchBar.style.display = 'none';
					searchInput.value = '';
					filter('');
				}
				break;
		}
	});

	searchInput.addEventListener('input', (e) => {
		const query = searchInput.value.trim();
		filter(query);
	});

	function filter(query) {
		const items = document.querySelectorAll('li[data-path]');
		items.forEach((item) => {
			const name = item.dataset.path;
			item.style.display = (!query || fuzzyMatch(query, name)) ? '' : 'none';
		});

		index = 0;
		focusItem(index);
	}
}());
