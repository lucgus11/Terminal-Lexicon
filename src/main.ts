// --- TYPES & INTERFACES ---
interface Word {
    id: string;
    word: string;
    translation: string;
}

interface Folder {
    id: string;
    name: string;
    parentId: string | null; // null = Dossier Racine (Langue)
}

interface AppState {
    folders: Folder[];
    words: Record<string, Word[]>; // Key: folderId -> Value: Word[]
    currentFolderId: string | null;
    maskAll: boolean;
    selectedWordIds: Set<string>;
    revealedWordIds: Set<string>; // Mots temporairement dévoilés au clic
}

// --- STATE INITIALIZATION ---
const STORAGE_KEY = 'terminal_lexicon_data';

const state: AppState = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || {
    folders: [],
    words: {},
    currentFolderId: null,
    maskAll: false,
    selectedWordIds: new Set<string>(),
    revealedWordIds: new Set<string>()
};

// Re-instancier les Sets après parsing du JSON
state.selectedWordIds = new Set<string>();
state.revealedWordIds = new Set<string>();

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        folders: state.folders,
        words: state.words,
        currentFolderId: state.currentFolderId,
        maskAll: state.maskAll
    }));
}

// --- DOM ELEMENTS ---
const folderListEl = document.getElementById('folder-list')!;
const lexiconBodyEl = document.getElementById('lexicon-body')!;
const breadcrumbsEl = document.getElementById('breadcrumbs')!;
const btnNewFolder = document.getElementById('btn-new-folder')!;
const btnNewWord = document.getElementById('btn-new-word')!;
const btnToggleMask = document.getElementById('btn-toggle-mask')!;
const btnExport = document.getElementById('btn-export')!;
const btnDeleteSelected = document.getElementById('btn-delete-selected')!;
const importCsvInput = document.getElementById('import-csv') as HTMLInputElement;
const selectAllCheckbox = document.getElementById('select-all') as HTMLInputElement;

// --- RENDERING FUNCTIONS ---

function render() {
    renderFolders();
    renderBreadcrumbs();
    renderLexicon();
}

function renderBreadcrumbs() {
    if (!state.currentFolderId) {
        breadcrumbsEl.textContent = 'ROOT /';
        return;
    }
    const path: string[] = [];
    let current = state.folders.find(f => f.id === state.currentFolderId);
    while (current) {
        path.unshift(current.name);
        current = state.folders.find(f => f.id === current?.parentId);
    }
    breadcrumbsEl.textContent = `ROOT / ${path.join(' / ')} /`;
}

function renderFolders() {
    folderListEl.innerHTML = '';
    
    // Si on est dans un sous-dossier, ajouter un bouton de retour
    if (state.currentFolderId) {
        const backLi = document.createElement('li');
        backLi.textContent = '[ .. RETOUR ]';
        backLi.onclick = () => {
            const current = state.folders.find(f => f.id === state.currentFolderId);
            state.currentFolderId = current ? current.parentId : null;
            state.selectedWordIds.clear();
            render();
        };
        folderListEl.appendChild(backLi);
    }

    const currentSubFolders = state.folders.filter(f => f.parentId === state.currentFolderId);

    currentSubFolders.forEach(folder => {
        const li = document.createElement('li');
        li.innerHTML = `<span>📂 ${folder.name}</span> <span class="del-folder" style="color:#ff3333;">[X]</span>`;
        
        // Navigation au clic
        li.querySelector('span:first-child')!.addEventListener('click', () => {
            state.currentFolderId = folder.id;
            state.selectedWordIds.clear();
            render();
        });

        // Suppression de dossier
        li.querySelector('.del-folder')!.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm(`Supprimer le dossier "${folder.name}" et son contenu ?`)) {
                state.folders = state.folders.filter(f => f.id !== folder.id && f.parentId !== folder.id);
                delete state.words[folder.id];
                saveState();
                render();
            }
        });

        folderListEl.appendChild(li);
    });
}

function renderLexicon() {
    lexiconBodyEl.innerHTML = '';
    selectAllCheckbox.checked = false;

    if (!state.currentFolderId) {
        lexiconBodyEl.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-dim);"><- SÉLECTIONNEZ UN DOSSIER POUR AFFICHER LES MOTS</td></tr>`;
        return;
    }

    const words = state.words[state.currentFolderId] || [];
    if (words.length === 0) {
        lexiconBodyEl.innerHTML = `<tr><td colspan="3" style="text-align:center; color:var(--text-dim);">AUCUN MOT DANS CE DOSSIER</td></tr>`;
        return;
    }

    words.forEach(word => {
        const tr = document.createElement('tr');
        
        // Checkbox
        const tdCheck = document.createElement('td');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = state.selectedWordIds.has(word.id);
        chk.onclick = (e) => e.stopPropagation();
        chk.onchange = () => {
            if (chk.checked) state.selectedWordIds.add(word.id);
            else state.selectedWordIds.delete(word.id);
        };
        tdCheck.appendChild(chk);

        // Mot
        const tdWord = document.createElement('td');
        tdWord.textContent = word.word;

        // Traduction (Masquable)
        const tdTrad = document.createElement('td');
        tdTrad.classList.add('masked-cell');
        
        const isMasked = state.maskAll && !state.revealedWordIds.has(word.id);
        tdTrad.textContent = isMasked ? '████████' : word.translation;
        
        // Clic pour toggle temporaire si masquage global actif
        tr.addEventListener('click', () => {
            if (state.maskAll) {
                if (state.revealedWordIds.has(word.id)) {
                    state.revealedWordIds.delete(word.id);
                } else {
                    state.revealedWordIds.add(word.id);
                }
                renderLexicon();
            }
        });

        tr.appendChild(tdCheck);
        tr.appendChild(tdWord);
        tr.appendChild(tdTrad);
        lexiconBodyEl.appendChild(tr);
    });
}

// --- LOGIQUE CORE ACTIONS ---

// Nouveau dossier
btnNewFolder.addEventListener('click', () => {
    const name = prompt('NOM DU NOUVEAU DOSSIER / LANGUE :');
    if (!name) return;
    const newFolder: Folder = {
        id: crypto.randomUUID(),
        name: name.trim().toUpperCase(),
        parentId: state.currentFolderId
    };
    state.folders.push(newFolder);
    saveState();
    render();
});

// Nouveau mot
btnNewWord.addEventListener('click', () => {
    if (!state.currentFolderId) return alert('Veuillez d\'abord ouvrir un dossier.');
    const wordText = prompt('ENTREZ LE MOT (Ex: Window) :');
    const tradText = prompt('ENTREZ LA TRADUCTION (Ex: Fenêtre) :');
    if (!wordText || !tradText) return;

    if (!state.words[state.currentFolderId]) state.words[state.currentFolderId] = [];
    
    state.words[state.currentFolderId].push({
        id: crypto.randomUUID(),
        word: wordText.trim(),
        translation: tradText.trim()
    });

    saveState();
    renderLexicon();
});

// Bouton Masquage Global
function toggleMaskGlobal() {
    state.maskAll = !state.maskAll;
    state.revealedWordIds.clear();
    btnToggleMask.textContent = state.maskAll ? 'MASK [ON]' : 'MASK [OFF]';
    btnToggleMask.classList.toggle('danger', state.maskAll);
    saveState();
    renderLexicon();
}
btnToggleMask.addEventListener('click', toggleMaskGlobal);

// Sélectionner Tout
selectAllCheckbox.addEventListener('change', () => {
    if (!state.currentFolderId) return;
    const words = state.words[state.currentFolderId] || [];
    if (selectAllCheckbox.checked) {
        words.forEach(w => state.selectedWordIds.add(w.id));
    } else {
        state.selectedWordIds.clear();
    }
    renderLexicon();
});

// Suppression groupée
btnDeleteSelected.addEventListener('click', () => {
    if (!state.currentFolderId || state.selectedWordIds.size === 0) return alert('Aucun mot sélectionné.');
    if (confirm(`Supprimer les ${state.selectedWordIds.size} mots sélectionnés ?`)) {
        state.words[state.currentFolderId] = (state.words[state.currentFolderId] || []).filter(
            w => !state.selectedWordIds.has(w.id)
        );
        state.selectedWordIds.clear();
        saveState();
        renderLexicon();
    }
});

// --- IMPORT & EXPORT CSV ---

btnExport.addEventListener('click', () => {
    if (!state.currentFolderId) return alert('Ouvrez un dossier à exporter.');
    const words = state.words[state.currentFolderId] || [];
    if (words.length === 0) return alert('Dossier vide.');

    // Exporter la sélection filtrée, ou tout le dossier si aucune sélection
    const targets = state.selectedWordIds.size > 0 
        ? words.filter(w => state.selectedWordIds.has(w.id))
        : words;

    let csvContent = "data:text/csv;charset=utf-8,MOT,TRADUCTION\n";
    targets.forEach(w => {
        csvContent += `"${w.word.replace(/"/g, '""')}","${w.translation.replace(/"/g, '""')}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `lexicon_export_${state.currentFolderId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

importCsvInput.addEventListener('change', (e) => {
    if (!state.currentFolderId) {
        alert('Ouvrez d\'abord un dossier cible pour l\'importation.');
        return;
    }
    const file = importCsvInput.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        
        if (!state.words[state.currentFolderId!]) state.words[state.currentFolderId!] = [];
        
        let importedCount = 0;
        // Skip header index 0
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parsing CSV simple basique prenant en compte les guillemets éventuels
            const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
            if (matches && matches.length >= 2) {
                const word = matches[0].replace(/^"|"$/g, '').trim();
                const translation = matches[1].replace(/^"|"$/g, '').trim();
                
                state.words[state.currentFolderId!].push({
                    id: crypto.randomUUID(),
                    word,
                    translation
                });
                importedCount++;
            }
        }
        
        saveState();
        renderLexicon();
        alert(`${importedCount} mots importés avec succès sans écrasement.`);
        importCsvInput.value = ''; // Reset input
    };
    reader.readAsText(file);
});

// --- RACCOURCIS CLAVIER ---
window.addEventListener('keydown', (e) => {
    // Éviter de déclencher si l'utilisateur tape dans un prompt
    if (document.activeElement?.tagName === 'INPUT') return;

    // Ctrl + M ou M seul : Mode Masque
    if ((e.ctrlKey && e.key.toLowerCase() === 'm') || (e.key.toLowerCase() === 'm' && !e.ctrlKey)) {
        e.preventDefault();
        toggleMaskGlobal();
    }
    // Touche N : Nouveau mot
    if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        btnNewWord.click();
    }
});

// --- SERVICE WORKER REGISTRATION ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW registration failed:', err));
    });
}

// Initial Boot
render();
