export type InlineAutocompleteTrigger = "automatic" | "explicit" | "cycle";

export interface InlineAutocompleteRange {
  readonly from: number;
  readonly to: number;
}

export interface InlineAutocompletePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}

export interface InlineAutocompleteSelection {
  readonly from: number;
  readonly to: number;
  readonly text: string;
  readonly empty: boolean;
}

export interface InlineAutocompleteContext {
  readonly requestId: string;
  readonly trigger: InlineAutocompleteTrigger;
  readonly path?: string | undefined;
  readonly languageId?: string | undefined;
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
  readonly position: InlineAutocompletePosition;
  readonly selection: InlineAutocompleteSelection;
  readonly currentLine: string;
  readonly textBeforeCursor: string;
  readonly textAfterCursor: string;
  readonly prefix: string;
  readonly suffix: string;
}

export interface InlineCompletionItem {
  readonly insertText: string;
  readonly range?: InlineAutocompleteRange | undefined;
  readonly displayText?: string | undefined;
  readonly filterText?: string | undefined;
  readonly id?: string | undefined;
}

export interface InlineCompletionList {
  readonly items: readonly InlineCompletionItem[];
  readonly source?: string | undefined;
}

export interface InlineEditContext {
  readonly requestId: string;
  readonly path?: string | undefined;
  readonly languageId?: string | undefined;
  readonly providerId?: string | undefined;
  readonly modelId?: string | undefined;
  readonly instruction: string;
  readonly range: InlineAutocompleteRange;
  readonly position: InlineAutocompletePosition;
  readonly selectedText: string;
  readonly codeBefore: string;
  readonly codeAfter: string;
}

export interface InlineEditResult {
  readonly replacement: string;
  readonly range?: InlineAutocompleteRange | undefined;
}

export interface InlineAutocompleteProvider {
  readonly id?: string | undefined;
  provideInlineCompletions(
    context: InlineAutocompleteContext,
    signal: AbortSignal,
  ): Promise<InlineCompletionList | readonly InlineCompletionItem[] | InlineCompletionItem | string | null>;
  provideInlineEdit?(
    context: InlineEditContext,
    signal: AbortSignal,
  ): Promise<InlineEditResult | string | null>;
}

export interface InlineAutocompleteEvent {
  readonly completion: InlineCompletionItem;
  readonly context: InlineAutocompleteContext;
}

export interface InlineAutocompleteLifecycle {
  readonly onRequestStart?: (context: InlineAutocompleteContext) => void;
  readonly onRequestEnd?: (
    context: InlineAutocompleteContext,
    result: InlineCompletionList | null,
  ) => void;
  readonly onShown?: (event: InlineAutocompleteEvent) => void;
  readonly onAccepted?: (event: InlineAutocompleteEvent) => void;
  readonly onRejected?: (event: InlineAutocompleteEvent) => void;
  readonly onError?: (error: unknown, context: InlineAutocompleteContext | InlineEditContext) => void;
}
