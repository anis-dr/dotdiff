/**
 * App component - main TUI with unified state management
 */
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react";
import { useTerminalDimensions } from "@opentui/react";
import { useCallback, useEffect, useMemo } from "react";
import {
  useAppMode,
  useEditMode,
  useFiles,
  useFileWatcher,
  useKeyBindings,
  useLayout,
  useMessage,
  useModal,
  usePendingChanges,
  useSearch,
  useSelection,
} from "../hooks/index.js";
import { useEditActions } from "../hooks/useEditActions.js";
import {
  currentRowAtom,
  effectiveDiffRowsAtom,
  filteredRowIndicesAtom,
  pendingListAtom,
  rowCountAtom,
  statsAtom,
} from "../state/appState.js";
import { saveChangesAtom } from "../state/runtime.js";
import type { EnvFile } from "../types.js";
import { AppMode, Colors } from "../types.js";
import { EnvRow } from "./EnvRow.js";
import { Footer } from "./Footer.js";
import { Header } from "./Header.js";
import { HelpOverlay } from "./HelpOverlay.js";
import { Inspector } from "./Inspector.js";
import { QuitConfirmModal } from "./QuitConfirmModal.js";
import { SavePreviewModal } from "./SavePreviewModal.js";
import { SearchOverlay } from "./SearchOverlay.js";

interface AppProps {
  readonly initialFiles: ReadonlyArray<EnvFile>;
  readonly onQuit: () => void;
}

export function App({ initialFiles, onQuit }: AppProps) {
  const { width: terminalWidth } = useTerminalDimensions();

  // App mode for rendering decisions
  const appMode = useAppMode();

  // Derived atoms
  const diffRows = useAtomValue(effectiveDiffRowsAtom);
  const currentRow = useAtomValue(currentRowAtom);
  const stats = useAtomValue(statsAtom);
  const pendingList = useAtomValue(pendingListAtom);
  const filteredRowIndices = useAtomValue(filteredRowIndicesAtom);
  const rowCount = useAtomValue(rowCountAtom);

  // Focused hooks
  const { fileCount, files, setFiles } = useFiles();
  const { closeSearch, search, setSearchQuery } = useSearch();
  const { closeModal } = useModal();
  const { editMode } = useEditMode();
  const { showMessage } = useMessage();
  const { setColWidths } = useLayout();
  const { clearChanges } = usePendingChanges();
  const { nextMatch } = useSelection();

  // Subscribe to file watcher events via PubSub
  useFileWatcher();

  // Effectful save action from the runtime - use "promise" mode to await result
  const saveChanges = useAtomSet(saveChangesAtom, { mode: "promise" });

  // Action hooks
  const { handleEditInput, handleSaveEdit } = useEditActions();

  // Initialize files on mount
  useEffect(() => {
    setFiles(initialFiles);
  }, [initialFiles, setFiles]);

  // Calculate column widths (2-file optimized layout)
  const colWidths = useMemo(() => {
    const separators = 2;
    const available = Math.max(0, terminalWidth - separators);
    const keyColWidth = Math.max(20, Math.floor(available * 0.35));
    const valueWidth = Math.max(
      15,
      Math.floor((available - keyColWidth) / Math.max(1, fileCount)),
    );
    const used = keyColWidth + valueWidth * fileCount;
    const remainder = Math.max(0, available - used);

    return [
      keyColWidth,
      ...Array.from({ length: fileCount }, (_, i) => i === fileCount - 1 ? valueWidth + remainder : valueWidth),
    ];
  }, [terminalWidth, fileCount]);

  useEffect(() => {
    setColWidths(colWidths);
  }, [colWidths, setColWidths]);

  // Actually perform the save using the effectful saveChangesAtom
  const doSave = useCallback(async () => {
    try {
      // saveChanges is an Atom.fn with promise mode - returns the updated files
      const updatedFiles = await saveChanges({ files, changes: pendingList });
      setFiles(updatedFiles);
      clearChanges();
      closeModal();
      showMessage("💾 Saved!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      showMessage(`⚠ Save failed: ${msg}`);
    }
  }, [files, pendingList, saveChanges, setFiles, clearChanges, closeModal, showMessage]);

  // Search handlers
  const handleSearchInput = useCallback(
    (value: string) => setSearchQuery(value),
    [setSearchQuery],
  );

  const handleSearchSubmit = useCallback(() => {
    nextMatch();
    closeSearch();
  }, [nextMatch, closeSearch]);

  // Keyboard bindings - now uses simplified callback interface
  useKeyBindings({
    onConfirmSave: doSave,
    onQuit,
  });

  // Derive isScrollFocused from appMode
  const isScrollFocused = appMode._tag === "Normal";

  // Derive modal type for rendering
  const modalType = AppMode.$is("Modal")(appMode) ? appMode.modalType : null;

  return (
    <box
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={Colors.background}
    >
      {/* Title bar */}
      <box
        height={1}
        backgroundColor={Colors.surface}
        paddingLeft={1}
        flexDirection="row"
        justifyContent="space-between"
        paddingRight={1}
      >
        <text>
          <b>
            <span fg={Colors.selectedBg}>dotdiff</span>
          </b>
          <span fg={Colors.dimText}>| {fileCount} files</span>
          {search.active && search.query && (
            <>
              <span fg={Colors.dimText}>|</span>
              <span fg={Colors.selectedBg}>/{search.query}</span>
              <span fg={Colors.dimText}>({filteredRowIndices.length})</span>
            </>
          )}
        </text>
        <text>
          <span fg={Colors.identical}>{"● " + stats.identical}</span>
          <span fg={Colors.dimText}>{"  "}</span>
          <span fg={Colors.different}>{"◐ " + stats.different}</span>
          <span fg={Colors.dimText}>{"  "}</span>
          <span fg={Colors.missing}>{"○ " + stats.missing}</span>
        </text>
      </box>

      {/* Search overlay */}
      {search.active && (
        <SearchOverlay
          query={search.query}
          matchCount={filteredRowIndices.length}
          totalCount={rowCount}
          onInput={handleSearchInput}
          onSubmit={handleSearchSubmit}
          onCancel={closeSearch}
        />
      )}

      {/* Header with file names */}
      <Header />

      {/* Main diff view */}
      <box flexDirection="column" flexGrow={1} overflow="hidden">
        <scrollbox focused={isScrollFocused} style={{ flexGrow: 1 }}>
          {diffRows.map((row, index) => (
            <EnvRow
              key={row.key || `new-${index}`}
              row={row}
              rowIndex={index}
              onEditInput={handleEditInput}
              onEditSubmit={handleSaveEdit}
            />
          ))}
        </scrollbox>
      </box>

      {/* Inspector */}
      <Inspector row={currentRow} />

      {/* Footer */}
      <Footer />

      {/* Modals */}
      {modalType === "help" && <HelpOverlay onClose={closeModal} />}
      {modalType === "quit" && (
        <QuitConfirmModal
          pendingCount={pendingList.length}
          onConfirm={onQuit}
          onCancel={closeModal}
        />
      )}
      {modalType === "save" && (
        <SavePreviewModal
          files={files}
          changes={pendingList}
          onConfirm={doSave}
          onCancel={closeModal}
        />
      )}
    </box>
  );
}
