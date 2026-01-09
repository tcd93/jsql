import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { sql } from "@codemirror/lang-sql";
import { linter } from "@codemirror/lint";
import { Prec } from "@codemirror/state";
import { keymap, EditorView } from "@codemirror/view";
import {
  ColumnInfo,
  detectSqlContextAction,
  findQueryAtCursor,
  flattenSchema,
  SQLNamespace,
} from "@src/utils";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { useCodeMirror } from "@uiw/react-codemirror";
import React, { useRef, useCallback } from "react";
import { useDocumentSync } from "../../hooks/useDocumentSync";
import { useQuery } from "../../hooks/useQuery";
import { useEditorStore } from "../../store/editorStore";
import { useSchemaStore } from "../../store/schemaStore";
import styles from "./QueryEditor.module.css";
import { sqlHintExtension } from "./sqlHintExtension";
import "./completion-icons.css";

const QueryEditor: React.FC<{
  className?: string;
}> = ({ className }) => {
  const activeEditorRef = useRef<EditorView | null>(null);

  const { executeQuery } = useQuery();

  // Get diagnostics from store
  const getDiagnostics = useEditorStore((state) => state.getDiagnostics);

  const handleQueryExecution = (): void => {
    const editor = activeEditorRef.current;
    if (!editor) {
      return;
    }

    const selection = editor.state.selection;
    const selectedText = editor.state.sliceDoc(
      selection.main.from,
      selection.main.to
    );

    if (selectedText.trim()) {
      executeQuery(selectedText.trim());
    } else {
      const cursorPosition = editor.state.selection.main.head;
      const fullText = editor.state.doc.toString();
      const queryAtCursor = findQueryAtCursor(fullText, cursorPosition);

      executeQuery(queryAtCursor);
    }
  };

  const executeQueryKeymap = Prec.highest(
    keymap.of([
      {
        key: "Ctrl-Enter",
        run: (): boolean => {
          handleQueryExecution();
          return true;
        },
        preventDefault: true,
        stopPropagation: true,
      },
      {
        key: "Cmd-Enter",
        run: (): boolean => {
          handleQueryExecution();
          return true;
        },
        preventDefault: true,
        stopPropagation: true,
      },
      {
        key: "F5",
        run: (): boolean => {
          handleQueryExecution();
          return true;
        },
        preventDefault: true,
        stopPropagation: true,
      },
    ])
  );

  // Get current schema data based on provider
  const schemaData = useSchemaStore((state) => state.schemaData);
  const profile = useSchemaStore((state) => state.currentProfile);
  const schema = profile?.name ? schemaData[profile.name] : undefined;
  let override: [CompletionSource] | undefined;
  if (profile && schema) {
    override = [createSqlAutocompleteSource(schema)];
  }

  const { setContainer } = useCodeMirror({
    container: null,
    height: "100%",
    theme: vscodeDark,
    extensions: [
      executeQueryKeymap,
      sqlHintExtension(),
      linter(() => getDiagnostics()), // Add diagnostic linting
      autocompletion({
        override,
        activateOnTyping: true,
      }),
      sql({
        upperCaseKeywords: true,
      }),
    ],
    onChange: (value, viewUpdate) => {
      const delta = calculateDeltaFromChangeSet(viewUpdate.changes);
      updateContent(value);
      syncContentChange(delta);
    },
    onCreateEditor: (editor) => {
      activeEditorRef.current = editor;
    },
    basicSetup: {
      lineNumbers: true,
      highlightActiveLineGutter: true,
      highlightSpecialChars: true,
      history: true,
      foldGutter: true,
      drawSelection: true,
      dropCursor: true,
      allowMultipleSelections: true,
      indentOnInput: true,
      syntaxHighlighting: true,
      bracketMatching: true,
      autocompletion: true,
      rectangularSelection: true,
      crosshairCursor: true,
      highlightActiveLine: true,
      highlightSelectionMatches: true,
      closeBrackets: true,
      searchKeymap: true,
      foldKeymap: true,
      completionKeymap: true,
      lintKeymap: true,
      historyKeymap: true,
      defaultKeymap: true,
    },
  });

  const setEditorContent = useCallback((content: string) => {
    const editor = activeEditorRef.current;
    if (editor) {
      editor.dispatch({
        changes: {
          from: 0,
          to: editor.state.doc.length,
          insert: content,
        },
      });
    }
  }, []);
  // Set the method to update editor content in the store
  useEditorStore.setState({ setEditorContent });

  const { calculateDeltaFromChangeSet, syncContentChange } = useDocumentSync();
  const updateContent = useEditorStore((state) => state.updateContent);

  return (
    <div className={`${styles.queryEditor} ${className ?? ""}`}>
      <div ref={setContainer} style={{ height: "100%" }} />
    </div>
  );
};

function onApply(
  view: EditorView,
  completion: Completion,
  from: number,
  to: number
): void {
  // `from` is the `from` return value of `createSqlAutocompleteSource`, which should be the start of cursor's pointed at word
  // `to` is the cursor position
  const remainingText = view.state.sliceDoc(to).match(/^[^\s;,]+/)?.[0]; // remaining text after cursor (until next ";" or space, or end of line)

  view.dispatch({
    changes: {
      from,
      to: to + (remainingText?.length ?? 0),
      insert: completion.label,
    },
    selection: {
      anchor: from + completion.label.length,
      head: from + completion.label.length,
    },
  });
}

function createSqlAutocompleteSource(
  schemaData: SQLNamespace
): CompletionSource {
  // Pre-flatten schema for performance
  const allTables = flattenSchema(schemaData);
  const getColumns = (tableName: string): ColumnInfo[] =>
    allTables.find((t) => t.fqName?.includes(tableName))?.columns ?? [];

  return (cctx: CompletionContext): CompletionResult | null => {
    const sqlContext = detectSqlContextAction(
      cctx.state.doc.toString(),
      cctx.pos
    );
    if (!sqlContext) {
      return null;
    }
    const word = cctx.matchBefore(/(\w|\.)*$/);
    // console.debug("word", word);
    // if (word && word.from === word.to) return null;

    // Table suggestions
    if (sqlContext.actionType === "list_table") {
      const options: Completion[] = allTables.map((t) => ({
        label: t.fqName ?? t.name,
        type: t.type,
        detail: t.detail,
        apply: onApply,
      }));
      return {
        from: word ? word.from : cctx.pos,
        options,
        validFor: /(\w|\.)*$/,
      };
    }

    // Column suggestions
    if (sqlContext.actionType === "list_column") {
      const { tablesInContext } = sqlContext;
      // update tablesInContext with columns
      tablesInContext.forEach((t) => {
        t.columns = getColumns(t.fqName ?? t.name);
      });

      const options: Completion[] = tablesInContext.flatMap(
        (t) =>
          t.columns?.map((c) => ({
            label: t.alias ? `${t.alias}.${c.label}` : c.label,
            type: c.type,
            detail: c.detail,
            apply: onApply,
          })) ?? []
      );

      return {
        from: word ? word.from : cctx.pos,
        options,
        validFor: /(\w|\.)*$/,
      };
    }
    return null;
  };
}

export default QueryEditor;
