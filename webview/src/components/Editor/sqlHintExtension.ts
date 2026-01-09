import { StateField, StateEffect, Range } from "@codemirror/state";
import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  ViewUpdate,
  EditorView,
  WidgetType,
  PluginValue,
} from "@codemirror/view";
import { findQueryRangeAtCursor } from "@src/utils";

// Widget for the inline hint
class SQLHintWidget extends WidgetType {
  constructor(private readonly hint: string) {
    super();
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "sql-hint";
    span.textContent = this.hint;
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// State effect for updating decorations
const setHintDecorations = StateEffect.define<DecorationSet>();

// Function to build decorations
function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const doc = view.state.doc;
  const selection = view.state.selection.main;

  // Only show hint if there's no selection (just cursor)
  if (selection.empty) {
    const cursorPos = selection.head;
    const docText = doc.toString();
    const queryRange = findQueryRangeAtCursor(docText, cursorPos);

    if (queryRange) {
      // Add highlighting for the SQL block
      const highlightMark = Decoration.mark({
        class: "sql-block-highlight",
      });

      decorations.push(highlightMark.range(queryRange.from, queryRange.to));

      // Add inline hint at the cursor line
      const cursorLine = doc.lineAt(cursorPos);
      const hint = " Ctrl+⏎";
      const hintWidget = Decoration.widget({
        widget: new SQLHintWidget(hint),
        side: 1,
      });

      decorations.push(hintWidget.range(cursorLine.to));
    }
  }

  return Decoration.set(decorations);
}

// State field to manage decorations
const hintDecorations = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    decorations = decorations.map(tr.changes);
    for (const effect of tr.effects) {
      if (effect.is(setHintDecorations)) {
        decorations = effect.value;
      }
    }
    return decorations;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// View plugin to handle the SQL hints and highlighting
const sqlHintPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      // Schedule initial decoration update for next tick
      setTimeout(() => {
        const decorations = buildDecorations(view);
        view.dispatch({
          effects: setHintDecorations.of(decorations),
        });
      }, 0);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged || update.selectionSet) {
        // Schedule decoration update for next tick to avoid update conflicts
        setTimeout(() => {
          const decorations = buildDecorations(update.view);
          update.view.dispatch({
            effects: setHintDecorations.of(decorations),
          });
        }, 0);
      }
    }
  }
);

// Export the extension
export function sqlHintExtension(): [
  StateField<DecorationSet>,
  ViewPlugin<PluginValue>
] {
  return [hintDecorations, sqlHintPlugin];
}
