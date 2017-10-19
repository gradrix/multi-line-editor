'use babel';

import MultiLineEditorView from './multi-line-editor-view';
import { CompositeDisposable } from 'atom';

export default {

  multiLineEditorView: null,
  modalPanel: null,
  subscriptions: null,
  skipCount: 0,

  activate(state) {
    this.multiLineEditorView = new MultiLineEditorView(state.multiLineEditorViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.multiLineEditorView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'multi-line-editor:expandDown': () => this.expandDown(),
      'multi-line-editor:expandUp': () => this.expandUp(),
      'multi-line-editor:moveToLeftWord': () => this.moveToLeftWord(),
      'multi-line-editor:moveToRightWord': () => this.moveToRightWord(),
      'multi-line-editor:pasteMultiLine': () => this.pasteMultiLine(),
      'multi-line-editor:pasteMultiUp': () => this.pasteMultiUp(),
      'multi-line-editor:pasteMultiDown': () => this.pasteMultiDown(),
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.multiLineEditorView.destroy();
  },

  serialize() {
    return {
      multiLineEditorViewState: this.multiLineEditorView.serialize()
    };
  },

  expandDown() {
    this.expandInDirection(1)
  },

  expandUp() {
    this.expandInDirection(-1)
  },

  expandInDirection(dir) {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;
    let lastCursor = editor.getLastCursor();
    if (!lastCursor) return;

    let cursors = editor.getCursors();
    let coords = lastCursor.getBufferPosition();
    let newCoords = {
      column: lastCursor.goalColumn || coords.column,
      row: coords.row + dir + this.skipCount
    }
    if (newCoords.row < 0 || newCoords.row > editor.getLastBufferRow())
      return;

    let newCursor = editor.addCursorAtBufferPosition(newCoords)
    newCursor.goalColumn = lastCursor.goalColumn || coords.column

    if (cursors.length === editor.getCursors().length)
      // no cursor was added so we tried to add a cursor where there is one already
      if (editor.hasMultipleCursors())
        lastCursor.destroy();

    this.skipCount = 0;
  },

  pasteMultiLine() {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    editor.buffer.transact(function() {
      let editor = atom.workspace.getActiveTextEditor();
      let selections = editor.getSelectionsOrderedByBufferPosition();
      if (!selections) return;

      let clipboardText = atom.clipboard.read();
      let copiedLines = clipboardText.split("\n");

      for (let i = 0; i <= copiedLines.length - 1; i++) {
        if (typeof(selections[i]) !== "undefined") {
          selections[i].insertText(copiedLines[i].trim(), {
            select: true,
            autoIndent: false,
            autoIndentNewline: false,
            autoDecreaseIndent: false,
            normalizeLineEndings: false,
          });
        }
      }
    });
  },

  pasteMultiDown() {
    this.pasteMultiDirection(1);
  },

  pasteMultiUp() {
    this.pasteMultiDirection(-1);
  },

  pasteMultiDirection(dir) {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    let buffer = editor.getBuffer();
    if (!buffer) return;

    buffer.transact(function() {
      let editor = atom.workspace.getActiveTextEditor();
      let buffer = editor.getBuffer();

      let currentPosition = editor.getCursorBufferPosition();
      if (!currentPosition) return;

      let clipboardText = atom.clipboard.read();
      let copiedLines = clipboardText.split("\n");
      let endPosition = buffer.getEndPosition();
      let initialColumnPosition = currentPosition.column;
      let currentClipboardIndex = 0;

      while(currentPosition.row >= 0 && currentPosition.row <= endPosition.row) {
        if (typeof(copiedLines[currentClipboardIndex]) === "undefined") {
          return;
        }
        let rowText = buffer.lineForRow(currentPosition.row);
        if(rowText.length < initialColumnPosition) {
          currentPosition.column = 0;
        }

        buffer.insert(currentPosition, copiedLines[currentClipboardIndex].trim(), {
          select: false,
          autoIndent: false,
          autoIndentNewline: false,
          autoDecreaseIndent: false,
          normalizeLineEndings: false
        });

        currentPosition = {
          row: currentPosition.row + dir,
          column: initialColumnPosition
        };
        currentClipboardIndex++;
      }
    });
  },

  moveToLeftWord() {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    let cursors = editor.getCursors();
    for (let i = 0; i <= cursors.length - 1; i++) {
      if (!cursors[i].isAtBeginningOfLine())
        cursors[i].moveToBeginningOfWord();
    }
  },

  moveToRightWord() {
    let editor = atom.workspace.getActiveTextEditor();
    if (!editor) return;

    let cursors = editor.getCursors();
    for (let i = 0; i <= cursors.length - 1; i++) {
      if (!cursors[i].isAtEndOfLine())
        cursors[i].moveToEndOfWord();
    }
  }
};
