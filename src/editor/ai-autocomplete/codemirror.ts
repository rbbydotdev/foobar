import {
  Annotation,
  EditorSelection,
  EditorState,
  Facet,
  Prec,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
  type Transaction,
  type TransactionSpec,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type KeyBinding,
  keymap,
  type Command,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { InlineCompletionCache } from "./cache";
import type {
  InlineAutocompleteContext,
  InlineAutocompleteLifecycle,
  InlineAutocompletePosition,
  InlineAutocompleteProvider,
  InlineAutocompleteRange,
  InlineAutocompleteSelection,
  InlineAutocompleteTrigger,
  InlineCompletionItem,
  InlineCompletionList,
  InlineEditContext,
  InlineEditResult,
} from "./types";

export interface AiAutocompleteExtensionOptions extends InlineAutocompleteLifecycle {
  readonly provider: InlineAutocompleteProvider;
  readonly enabled?: boolean;
  readonly path?: string;
  readonly languageId?: string;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly debounceMs?: number;
  readonly maxPrefixChars?: number;
  readonly maxSuffixChars?: number;
  readonly cacheTtlMs?: number;
  readonly cacheMaxEntries?: number;
  readonly includeKeymap?: boolean;
  readonly manualEditKey?: string;
  readonly explicitCompletionKey?: string;
}

interface AiAutocompleteConfig extends AiAutocompleteExtensionOptions {
  readonly enabled: boolean;
  readonly debounceMs: number;
  readonly maxPrefixChars: number;
  readonly maxSuffixChars: number;
  readonly cacheTtlMs: number;
  readonly cacheMaxEntries: number;
  readonly includeKeymap: boolean;
  readonly manualEditKey: string;
  readonly explicitCompletionKey: string;
}

interface ActiveInlineCompletion {
  readonly item: InlineCompletionItem;
  readonly context: InlineAutocompleteContext;
  readonly range: InlineAutocompleteRange;
  readonly displayText: string;
}

interface InlineState {
  readonly completion: ActiveInlineCompletion | null;
  readonly manualEdit: ManualEditState | null;
  readonly requestSerial: number;
}

interface ManualEditState {
  readonly from: number;
  readonly to: number;
  readonly anchor: number;
  readonly requestSerial: number;
}

const DEFAULT_DEBOUNCE_MS = 350;
const DEFAULT_MAX_PREFIX_CHARS = 8_000;
const DEFAULT_MAX_SUFFIX_CHARS = 2_000;

const disabledProvider: InlineAutocompleteProvider = {
  id: "disabled-ai-autocomplete",
  async provideInlineCompletions() {
    return null;
  },
  async provideInlineEdit() {
    return null;
  },
};

const disabledConfig: AiAutocompleteConfig = {
  provider: disabledProvider,
  enabled: false,
  debounceMs: DEFAULT_DEBOUNCE_MS,
  maxPrefixChars: DEFAULT_MAX_PREFIX_CHARS,
  maxSuffixChars: DEFAULT_MAX_SUFFIX_CHARS,
  cacheTtlMs: 10_000,
  cacheMaxEntries: 100,
  includeKeymap: true,
  manualEditKey: "Mod-i",
  explicitCompletionKey: "Mod-Shift-Space",
};

export const aiAutocompleteAccepted = Annotation.define<boolean>();

const requestInlineCompletionEffect = StateEffect.define<InlineAutocompleteTrigger>();
const setInlineCompletionEffect = StateEffect.define<ActiveInlineCompletion | null>();
const showManualEditEffect = StateEffect.define<ManualEditState | null>();
const bumpRequestSerialEffect = StateEffect.define<number>();

const aiAutocompleteConfig = Facet.define<AiAutocompleteExtensionOptions, AiAutocompleteConfig>({
  combine(values) {
    const latest = values.at(-1);
    if (!latest) return disabledConfig;
    return {
      ...latest,
      enabled: latest.enabled ?? true,
      debounceMs: latest.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxPrefixChars: latest.maxPrefixChars ?? DEFAULT_MAX_PREFIX_CHARS,
      maxSuffixChars: latest.maxSuffixChars ?? DEFAULT_MAX_SUFFIX_CHARS,
      cacheTtlMs: latest.cacheTtlMs ?? 10_000,
      cacheMaxEntries: latest.cacheMaxEntries ?? 100,
      includeKeymap: latest.includeKeymap ?? true,
      manualEditKey: latest.manualEditKey ?? "Mod-i",
      explicitCompletionKey: latest.explicitCompletionKey ?? "Mod-Shift-Space",
    };
  },
});

const inlineStateField = StateField.define<InlineState>({
  create() {
    return { completion: null, manualEdit: null, requestSerial: 0 };
  },
  update(value, tr) {
    let next = value;
    for (const effect of tr.effects) {
      if (effect.is(setInlineCompletionEffect)) {
        next = { ...next, completion: effect.value };
      } else if (effect.is(showManualEditEffect)) {
        next = { ...next, manualEdit: effect.value, completion: null };
      } else if (effect.is(bumpRequestSerialEffect)) {
        next = { ...next, requestSerial: effect.value };
      }
    }

    if (tr.docChanged || tr.selection) {
      const manualEdit = next.manualEdit ? mapManualEdit(next.manualEdit, tr) : null;
      const keepCompletion = tr.annotation(aiAutocompleteAccepted)
        ? null
        : keepCompletionForTransaction(next.completion, tr);
      return { ...next, completion: keepCompletion, manualEdit };
    }

    return next;
  },
  provide: (field) => EditorView.decorations.from(field, buildDecorations),
});

function mapManualEdit(edit: ManualEditState, tr: Transaction): ManualEditState | null {
  if (!tr.docChanged) return edit;
  const from = tr.changes.mapPos(edit.from, 1);
  const to = tr.changes.mapPos(edit.to, -1);
  const anchor = tr.changes.mapPos(edit.anchor, 1);
  if (from > to) return null;
  return { ...edit, from, to, anchor };
}

function keepCompletionForTransaction(
  completion: ActiveInlineCompletion | null,
  tr: Transaction,
): ActiveInlineCompletion | null {
  if (!completion) return null;
  if (!tr.docChanged && !tr.selection) return completion;
  return null;
}

function buildDecorations(value: InlineState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  if (value.completion) {
    decorations.push(
      Decoration.widget({
        widget: new GhostTextWidget(value.completion.displayText),
        side: 1,
      }).range(value.completion.range.to),
    );
  }
  if (value.manualEdit) {
    decorations.push(
      Decoration.widget({
        widget: new ManualEditWidget(value.manualEdit),
        block: true,
        side: 1,
      }).range(value.manualEdit.anchor),
    );
  }
  return Decoration.set(decorations, true);
}

class GhostTextWidget extends WidgetType {
  private readonly text: string;

  constructor(text: string) {
    super();
    this.text = text;
  }

  eq(other: GhostTextWidget): boolean {
    return other.text === this.text;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-ai-autocomplete-ghost";
    span.textContent = this.text;
    span.setAttribute("aria-label", `AI suggestion: ${this.text}`);
    return span;
  }

  get lineBreaks(): number {
    return countLineBreaks(this.text);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

class ManualEditWidget extends WidgetType {
  #abortController: AbortController | null = null;
  private readonly edit: ManualEditState;

  constructor(edit: ManualEditState) {
    super();
    this.edit = edit;
  }

  eq(other: ManualEditWidget): boolean {
    return (
      other.edit.from === this.edit.from &&
      other.edit.to === this.edit.to &&
      other.edit.anchor === this.edit.anchor &&
      other.edit.requestSerial === this.edit.requestSerial
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const shell = document.createElement("form");
    shell.className = "cm-ai-edit-popover";
    shell.setAttribute("aria-label", "Ask AI to edit this code");

    const input = document.createElement("input");
    input.className = "cm-ai-edit-input";
    input.placeholder = this.edit.from === this.edit.to
      ? "Ask AI to insert code here..."
      : "Ask AI to update the selection...";
    input.autocomplete = "off";
    input.spellcheck = true;

    const actions = document.createElement("div");
    actions.className = "cm-ai-edit-actions";

    const hint = document.createElement("span");
    hint.className = "cm-ai-edit-hint";
    hint.textContent = "Enter to apply · Esc to close";

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "cm-ai-edit-submit";
    submit.textContent = "Generate";

    actions.append(hint, submit);
    shell.append(input, actions);

    const setLoading = (loading: boolean) => {
      input.disabled = loading;
      submit.disabled = loading;
      submit.textContent = loading ? "Generating..." : "Generate";
    };

    const close = () => {
      this.#abortController?.abort();
      view.dispatch({ effects: showManualEditEffect.of(null) });
      view.focus();
    };

    shell.addEventListener("submit", (event) => {
      event.preventDefault();
      const instruction = input.value.trim();
      if (!instruction) return;
      const config = view.state.facet(aiAutocompleteConfig);
      const context = buildInlineEditContext(view.state, config, instruction, this.edit);
      this.#abortController?.abort();
      this.#abortController = new AbortController();
      setLoading(true);
      void requestInlineEdit(view, config, context, this.#abortController.signal).finally(() => {
        setLoading(false);
      });
    });

    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    });

    requestAnimationFrame(() => input.focus());
    return shell;
  }

  destroy(): void {
    this.#abortController?.abort();
  }

  ignoreEvent(): boolean {
    return true;
  }
}

async function requestInlineEdit(
  view: EditorView,
  config: AiAutocompleteConfig,
  context: InlineEditContext,
  signal: AbortSignal,
): Promise<void> {
  try {
    const raw = config.provider.provideInlineEdit
      ? await config.provider.provideInlineEdit(context, signal)
      : null;
    if (signal.aborted || raw === null) return;
    const result = normalizeInlineEdit(raw, context);
    if (!result.replacement) return;
    const range = result.range ?? context.range;
    view.dispatch({
      changes: { from: range.from, to: range.to, insert: result.replacement },
      selection: EditorSelection.cursor(range.from + result.replacement.length),
      annotations: aiAutocompleteAccepted.of(true),
      effects: showManualEditEffect.of(null),
      userEvent: "input.complete",
    });
    view.focus();
  } catch (error) {
    if (!signal.aborted) config.onError?.(error, context);
  }
}

function normalizeInlineEdit(raw: InlineEditResult | string, context: InlineEditContext): InlineEditResult {
  if (typeof raw === "string") return { replacement: raw, range: context.range };
  return raw;
}

function countLineBreaks(text: string): number {
  let count = 0;
  for (const char of text) {
    if (char === "\n") count++;
  }
  return count;
}

function normalizeCompletionResult(
  raw: InlineCompletionList | readonly InlineCompletionItem[] | InlineCompletionItem | string | null,
): InlineCompletionList | null {
  if (raw === null) return null;
  if (typeof raw === "string") return { items: raw ? [{ insertText: raw }] : [] };
  if (isCompletionItemArray(raw)) return { items: raw };
  if ("items" in raw) return raw;
  return { items: [raw] };
}

function isCompletionItemArray(
  raw: InlineCompletionList | readonly InlineCompletionItem[] | InlineCompletionItem,
): raw is readonly InlineCompletionItem[] {
  return Array.isArray(raw);
}

function normalizeCompletionItem(
  item: InlineCompletionItem,
  state: EditorState,
): ActiveInlineCompletion | null {
  const selection = state.selection.main;
  if (!selection.empty) return null;
  const range = item.range ?? { from: selection.head, to: selection.head };
  if (!isValidRange(range, state.doc)) return null;
  if (range.from > selection.head || range.to < selection.head) return null;
  const replacedBeforeCursor = state.sliceDoc(range.from, selection.head);
  const filterText = item.filterText ?? item.insertText;
  if (replacedBeforeCursor && !filterText.startsWith(replacedBeforeCursor)) {
    return null;
  }
  const displayText = item.displayText ?? item.insertText.slice(replacedBeforeCursor.length);
  if (!displayText) return null;
  return {
    item,
    context: emptyContext,
    range,
    displayText,
  };
}

function isValidRange(range: InlineAutocompleteRange, doc: Text): boolean {
  return range.from >= 0 && range.to >= range.from && range.to <= doc.length;
}

const emptyContext: InlineAutocompleteContext = {
  requestId: "",
  trigger: "automatic",
  position: { offset: 0, line: 1, column: 0 },
  selection: { from: 0, to: 0, text: "", empty: true },
  currentLine: "",
  textBeforeCursor: "",
  textAfterCursor: "",
  prefix: "",
  suffix: "",
};

function withContext(
  completion: ActiveInlineCompletion,
  context: InlineAutocompleteContext,
): ActiveInlineCompletion {
  return { ...completion, context };
}

function firstVisibleCompletion(
  list: InlineCompletionList | null,
  state: EditorState,
  context: InlineAutocompleteContext,
): ActiveInlineCompletion | null {
  if (!list) return null;
  for (const item of list.items) {
    const normalized = normalizeCompletionItem(item, state);
    if (normalized) return withContext(normalized, context);
  }
  return null;
}

function buildPosition(state: EditorState, offset: number): InlineAutocompletePosition {
  const line = state.doc.lineAt(offset);
  return { offset, line: line.number, column: offset - line.from };
}

function buildSelection(state: EditorState): InlineAutocompleteSelection {
  const selection = state.selection.main;
  return {
    from: selection.from,
    to: selection.to,
    text: state.sliceDoc(selection.from, selection.to),
    empty: selection.empty,
  };
}

function buildInlineCompletionContext(
  state: EditorState,
  config: AiAutocompleteConfig,
  trigger: InlineAutocompleteTrigger,
  serial: number,
): InlineAutocompleteContext {
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const prefixFrom = Math.max(0, head - config.maxPrefixChars);
  const suffixTo = Math.min(state.doc.length, head + config.maxSuffixChars);
  return {
    requestId: String(serial),
    trigger,
    path: config.path,
    languageId: config.languageId,
    providerId: config.providerId ?? config.provider.id,
    modelId: config.modelId,
    position: buildPosition(state, head),
    selection: buildSelection(state),
    currentLine: line.text,
    textBeforeCursor: state.sliceDoc(line.from, head),
    textAfterCursor: state.sliceDoc(head, line.to),
    prefix: state.sliceDoc(prefixFrom, head),
    suffix: state.sliceDoc(head, suffixTo),
  };
}

function buildInlineEditContext(
  state: EditorState,
  config: AiAutocompleteConfig,
  instruction: string,
  edit: ManualEditState,
): InlineEditContext {
  const codeBeforeFrom = Math.max(0, edit.from - config.maxPrefixChars);
  const codeAfterTo = Math.min(state.doc.length, edit.to + config.maxSuffixChars);
  return {
    requestId: String(edit.requestSerial),
    path: config.path,
    languageId: config.languageId,
    providerId: config.providerId ?? config.provider.id,
    modelId: config.modelId,
    instruction,
    range: { from: edit.from, to: edit.to },
    position: buildPosition(state, edit.anchor),
    selectedText: state.sliceDoc(edit.from, edit.to),
    codeBefore: state.sliceDoc(codeBeforeFrom, edit.from),
    codeAfter: state.sliceDoc(edit.to, codeAfterTo),
  };
}

function shouldTriggerAutomatic(update: ViewUpdate): boolean {
  if (!update.docChanged) return false;
  if (update.transactions.some((tr) => tr.annotation(aiAutocompleteAccepted))) return false;
  if (update.transactions.some((tr) => tr.isUserEvent("input.complete"))) return false;
  return true;
}

function canRequest(state: EditorState, view: EditorView, config: AiAutocompleteConfig): boolean {
  if (!config.enabled) return false;
  if (state.facet(EditorState.readOnly)) return false;
  if (!state.selection.main.empty) return false;
  if (!view.hasFocus) return false;
  return true;
}

const aiAutocompletePlugin = ViewPlugin.fromClass(
  class AiAutocompletePlugin {
    #timer: ReturnType<typeof setTimeout> | null = null;
    #abortController: AbortController | null = null;
    #serial = 0;
    #cache: InlineCompletionCache;

    private readonly view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      const config = view.state.facet(aiAutocompleteConfig);
      this.#cache = new InlineCompletionCache({
        maxEntries: config.cacheMaxEntries,
        ttlMs: config.cacheTtlMs,
      });
    }

    update(update: ViewUpdate): void {
      const explicit = update.transactions
        .flatMap((tr) => tr.effects)
        .find((effect) => effect.is(requestInlineCompletionEffect));
      if (explicit) {
        this.#schedule(explicit.value, 0);
        return;
      }
      if (update.selectionSet || update.docChanged) {
        this.#abortController?.abort();
      }
      if (shouldTriggerAutomatic(update)) {
        const config = update.state.facet(aiAutocompleteConfig);
        this.#schedule("automatic", config.debounceMs);
      }
    }

    #schedule(trigger: InlineAutocompleteTrigger, delay: number): void {
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = setTimeout(() => {
        this.#timer = null;
        void this.#request(trigger);
      }, delay);
    }

    async #request(trigger: InlineAutocompleteTrigger): Promise<void> {
      const { view } = this;
      const config = view.state.facet(aiAutocompleteConfig);
      if (!canRequest(view.state, view, config)) return;
      this.#abortController?.abort();
      const abortController = new AbortController();
      this.#abortController = abortController;
      const serial = ++this.#serial;
      const context = buildInlineCompletionContext(view.state, config, trigger, serial);
      view.dispatch({
        effects: [bumpRequestSerialEffect.of(serial), setInlineCompletionEffect.of(null)],
      });

      const cached = this.#cache.get(context);
      if (cached) {
        const list = { items: [cached], source: "cache" };
        const completion = firstVisibleCompletion(list, view.state, context);
        if (completion) this.#showCompletion(serial, completion, context);
        return;
      }

      config.onRequestStart?.(context);
      try {
        const raw = await config.provider.provideInlineCompletions(context, abortController.signal);
        if (abortController.signal.aborted || serial !== this.#serial) return;
        const list = normalizeCompletionResult(raw);
        config.onRequestEnd?.(context, list);
        const completion = firstVisibleCompletion(list, view.state, context);
        if (!completion) {
          view.dispatch({ effects: setInlineCompletionEffect.of(null) });
          return;
        }
        this.#cache.set(context, completion.item);
        this.#showCompletion(serial, completion, context);
      } catch (error) {
        if (!abortController.signal.aborted) config.onError?.(error, context);
      }
    }

    #showCompletion(
      serial: number,
      completion: ActiveInlineCompletion,
      context: InlineAutocompleteContext,
    ): void {
      if (serial !== this.#serial) return;
      const active = this.view.state.field(inlineStateField).requestSerial;
      if (active !== serial) return;
      this.view.dispatch({ effects: setInlineCompletionEffect.of(completion) });
      this.view.state.facet(aiAutocompleteConfig).onShown?.({ completion: completion.item, context });
    }

    destroy(): void {
      if (this.#timer) clearTimeout(this.#timer);
      this.#abortController?.abort();
    }
  },
);

function insertCompletionText(
  state: EditorState,
  text: string,
  range: InlineAutocompleteRange,
): TransactionSpec {
  return {
    ...state.changeByRange((selectionRange) => {
      if (selectionRange === state.selection.main) {
        return {
          changes: { from: range.from, to: range.to, insert: text },
          range: EditorSelection.cursor(range.from + text.length),
        };
      }
      return { range: selectionRange };
    }),
    annotations: aiAutocompleteAccepted.of(true),
    effects: setInlineCompletionEffect.of(null),
    userEvent: "input.complete",
  };
}

export const acceptInlineAutocomplete: Command = (view) => {
  const completion = view.state.field(inlineStateField).completion;
  if (!completion) return false;
  const spec = insertCompletionText(view.state, completion.item.insertText, completion.range);
  view.dispatch(spec);
  view.state.facet(aiAutocompleteConfig).onAccepted?.({
    completion: completion.item,
    context: completion.context,
  });
  return true;
};

export const rejectInlineAutocomplete: Command = (view) => {
  const completion = view.state.field(inlineStateField).completion;
  if (!completion) return false;
  view.dispatch({ effects: setInlineCompletionEffect.of(null) });
  view.state.facet(aiAutocompleteConfig).onRejected?.({
    completion: completion.item,
    context: completion.context,
  });
  return true;
};

export const requestInlineAutocomplete: Command = (view) => {
  view.dispatch({ effects: requestInlineCompletionEffect.of("explicit") });
  return true;
};

export const showInlineAiEdit: Command = (view) => {
  const config = view.state.facet(aiAutocompleteConfig);
  if (!config.enabled) return false;
  if (view.state.facet(EditorState.readOnly)) return false;
  const selection = view.state.selection.main;
  const serial = Date.now();
  view.dispatch({
    effects: showManualEditEffect.of({
      from: selection.from,
      to: selection.to,
      anchor: selection.empty ? selection.head : selection.from,
      requestSerial: serial,
    }),
  });
  return true;
};

export const closeInlineAiEdit: Command = (view) => {
  const state = view.state.field(inlineStateField);
  if (!state.manualEdit) return false;
  view.dispatch({ effects: showManualEditEffect.of(null) });
  return true;
};

function buildKeymap(config: AiAutocompleteConfig): readonly KeyBinding[] {
  const bindings: KeyBinding[] = [
    { key: "Tab", run: acceptInlineAutocomplete },
    { key: "Escape", run: rejectInlineAutocomplete },
    { key: "Escape", run: closeInlineAiEdit },
    { key: config.explicitCompletionKey, run: requestInlineAutocomplete },
    { key: config.manualEditKey, run: showInlineAiEdit },
  ];
  if (config.manualEditKey !== "Ctrl-i") {
    bindings.push({ key: "Ctrl-i", run: showInlineAiEdit });
  }
  return bindings;
}

const aiAutocompleteTheme = EditorView.baseTheme({
  ".cm-ai-autocomplete-ghost": {
    color: "var(--muted-foreground)",
    opacity: "0.52",
    filter: "saturate(0.65)",
    whiteSpace: "pre-wrap",
    pointerEvents: "none",
  },
  ".cm-ai-edit-popover": {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    maxWidth: "min(32rem, calc(100% - 1rem))",
    margin: "0.35rem 0 0.45rem",
    padding: "0.65rem",
    border: "1px solid var(--border)",
    borderRadius: "calc(var(--radius) + 0.25rem)",
    background: "var(--popover)",
    color: "var(--popover-foreground)",
    boxShadow: "0 1rem 3rem color-mix(in oklch, var(--foreground) 16%, transparent)",
  },
  ".cm-ai-edit-input": {
    width: "100%",
    border: "1px solid var(--input)",
    borderRadius: "var(--radius)",
    background: "var(--background)",
    color: "var(--foreground)",
    padding: "0.45rem 0.55rem",
    font: "inherit",
    outline: "none",
  },
  ".cm-ai-edit-input:focus": {
    borderColor: "var(--ring)",
    boxShadow: "0 0 0 2px color-mix(in oklch, var(--ring) 24%, transparent)",
  },
  ".cm-ai-edit-actions": {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
  },
  ".cm-ai-edit-hint": {
    color: "var(--muted-foreground)",
    fontSize: "0.72rem",
  },
  ".cm-ai-edit-submit": {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    background: "var(--primary)",
    color: "var(--primary-foreground)",
    cursor: "pointer",
    font: "inherit",
    fontSize: "0.75rem",
    padding: "0.35rem 0.6rem",
  },
  ".cm-ai-edit-submit:disabled": {
    cursor: "not-allowed",
    opacity: "0.7",
  },
});

export function aiAutocomplete(options: AiAutocompleteExtensionOptions): Extension[] {
  const baseConfig = aiAutocompleteConfig.of(options);
  const keymapExtension = Prec.highest(
    keymap.of(buildKeymap({
      ...options,
      enabled: options.enabled ?? true,
      debounceMs: options.debounceMs ?? DEFAULT_DEBOUNCE_MS,
      maxPrefixChars: options.maxPrefixChars ?? DEFAULT_MAX_PREFIX_CHARS,
      maxSuffixChars: options.maxSuffixChars ?? DEFAULT_MAX_SUFFIX_CHARS,
      cacheTtlMs: options.cacheTtlMs ?? 10_000,
      cacheMaxEntries: options.cacheMaxEntries ?? 100,
      includeKeymap: options.includeKeymap ?? true,
      manualEditKey: options.manualEditKey ?? "Mod-i",
      explicitCompletionKey: options.explicitCompletionKey ?? "Mod-Shift-Space",
    })),
  );
  return [
    baseConfig,
    inlineStateField,
    aiAutocompletePlugin,
    aiAutocompleteTheme,
    options.includeKeymap === false ? [] : keymapExtension,
  ];
}
