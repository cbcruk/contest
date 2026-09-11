import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { Decoration, keymap, type DecorationSet } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'

const setErrorLine = StateEffect.define<number | null>()

const errorLineMark = Decoration.line({ class: 'cm-errorLine' })

/** Highlights the buffer line a failed run reported, cleared on the next edit. */
const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    for (const effect of tr.effects) {
      if (!effect.is(setErrorLine)) continue
      const line = effect.value
      if (line === null || line < 1 || line > tr.state.doc.lines) return Decoration.none
      return Decoration.set([errorLineMark.range(tr.state.doc.line(line).from)])
    }
    return tr.docChanged ? Decoration.none : deco.map(tr.changes)
  },
  provide: (f) => EditorView.decorations.from(f),
})

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '12px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
  '.cm-errorLine': { backgroundColor: 'rgba(255, 90, 90, 0.18)' },
})

export interface Editor {
  getValue(): string
  setValue(code: string): void
  markError(line: number | null): void
  focus(): void
}

export function createEditor(
  parent: HTMLElement,
  opts: { onRun: () => void; onChange: (code: string) => void }
): Editor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: '',
      extensions: [
        basicSetup,
        javascript(),
        oneDark,
        theme,
        errorLineField,
        keymap.of([{ key: 'Mod-Enter', preventDefault: true, run: () => { opts.onRun(); return true } }]),
        EditorView.updateListener.of((u) => { if (u.docChanged) opts.onChange(view.state.doc.toString()) }),
      ],
    }),
  })

  return {
    getValue: () => view.state.doc.toString(),
    setValue(code) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: code },
        effects: setErrorLine.of(null),
      })
    },
    markError(line) {
      view.dispatch({ effects: setErrorLine.of(line) })
    },
    focus: () => view.focus(),
  }
}
