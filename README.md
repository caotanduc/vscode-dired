### 🔍 Search

- **Trigger search**: Press `/`
- **Navigate in search**:
  - `Ctrl+n` → next result
  - `Ctrl+p` → previous result
- **Open selected**: `Enter`
- **Exit search**: `Escape`
- **Fuzzy matching**: Supports partial letter match (e.g., `abc` matches `alphabetic`)

---

### ⌨️ Keyboard Navigation

Outside of search, the following shortcuts are supported:

| Key          | Action                                      |
|--------------|---------------------------------------------|
| `j` / `Ctrl+n` | Move down                                  |
| `k` / `Ctrl+p` | Move up                                    |
| `Enter`      | Open file or folder                         |
| `Space`      | Expand/collapse folder (if type === 2)      |
| `-`          | Navigate to parent (`..`)                   |
| `+`          | Create new file in current folder           |
| `d`          | Create new directory                        |
| `Delete` / `Backspace` | Request file/folder deletion      |
| `r`          | Request file/folder rename                  |
| `g`          | Reload panel                                |
| `Escape`     | Close search (if open)                      |

---

### 🧠 Features

- **Focus management**: Initially focuses a file (`focusedFileName`) if provided.
- **Directory expand/render**: Listens to `renderExpand` message from backend and toggles child elements.
- **State tracking**: Maintains `index` of currently selected item.
- **Fuzzy Search**: Implements fuzzy matching that checks characters in sequence (not substring).
