import { useEffect, useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import type { QueryResult, SqlValue } from '@/db'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Row = SqlValue[]
const EMPTY_ROWS: Row[] = []
const PAGE_SIZES = [10, 25, 50, 100]

function isNumeric(value: SqlValue): boolean {
  return typeof value === 'number' || typeof value === 'bigint'
}

function formatCell(value: SqlValue): string {
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return `‹blob ${value.length}B›`
  return String(value)
}

export interface ResultsTableProps {
  result: QueryResult | null
  isFetching?: boolean
}

export function ResultsTable({ result, isFetching }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  })

  const columns = useMemo<ColumnDef<Row>[]>(() => {
    if (!result) return []
    return result.columns.map((name, i) => ({
      id: `${i}:${name}`,
      header: name,
      accessorFn: (row) => row[i] as SqlValue,
      cell: (ctx) => {
        const value = ctx.getValue() as SqlValue
        return (
          <span
            className={cn(
              'block max-w-[460px] truncate',
              isNumeric(value) && 'text-right tabular-nums',
              value === null && 'italic text-muted-foreground/50',
            )}
            title={formatCell(value)}
          >
            {formatCell(value)}
          </span>
        )
      },
    }))
  }, [result])

  // New result set → back to the first page.
  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }))
  }, [result])

  const table = useReactTable({
    data: result?.rows ?? EMPTY_ROWS,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  if (!result) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Run a query to see results.
      </div>
    )
  }

  if (result.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border text-sm text-muted-foreground">
        Statement executed — {result.changes} row{result.changes === 1 ? '' : 's'} affected.
      </div>
    )
  }

  const pageRows = table.getRowModel().rows
  const pageCount = table.getPageCount()
  const { pageIndex } = table.getState().pagination

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-md border">
      <div className={cn('min-h-0 flex-1 overflow-auto', isFetching && 'opacity-60')}>
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      className="border-b px-3 py-1.5 text-left font-medium"
                    >
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="font-mono">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sorted === 'asc' ? (
                          <ChevronUp className="size-3" />
                        ) : sorted === 'desc' ? (
                          <ChevronDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 text-muted-foreground/40" />
                        )}
                      </button>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={result.columns.length}
                  className="px-3 py-8 text-center text-muted-foreground"
                >
                  No rows.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1 font-mono">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            <span className="font-medium text-foreground">
              {result.rowCount.toLocaleString()}
            </span>{' '}
            row{result.rowCount === 1 ? '' : 's'}
          </span>
          <span>·</span>
          <span>{result.elapsedMs.toFixed(1)} ms</span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v))}
          >
            <SelectTrigger size="sm" className="h-7 w-[88px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size} / page
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="tabular-nums">
            Page {pageCount === 0 ? 0 : pageIndex + 1} of {pageCount}
          </span>
          <div className="flex items-center gap-0.5">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
