import { flexRender, type Table as TanstackTable } from '@tanstack/react-table'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

/** Use on manual `Table` blocks (e.g. dashboard widgets) so they match `DataTable` styling. */
export const DATA_TABLE_HEADER_ROW_CLASS =
  'bg-surface-container-high/30 border-0 hover:bg-surface-container-high/30'
export const DATA_TABLE_HEADER_CELL_CLASS =
  'px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-on-surface-variant'
export const DATA_TABLE_BODY_ROW_CLASS =
  'border-surface-container/50 hover:bg-surface-container-high/20 group'
export const DATA_TABLE_BODY_CELL_CLASS = 'px-6 py-5'

type DataTableProps<TData> = {
  table: TanstackTable<TData>
  emptyMessage?: string
  loading?: boolean
  loadingMessage?: string
  /** When set, empty state uses this colspan (e.g. total columns including select) */
  emptyColSpan?: number
  headerRowClassName?: string
  bodyRowClassName?: string
}

export function DataTable<TData>({
  table,
  emptyMessage = 'Tidak ada data.',
  loading = false,
  loadingMessage = 'Memuat...',
  emptyColSpan,
  headerRowClassName = DATA_TABLE_HEADER_ROW_CLASS,
  bodyRowClassName = DATA_TABLE_BODY_ROW_CLASS,
}: DataTableProps<TData>) {
  const cols = table.getAllColumns().length
  const span = emptyColSpan ?? cols

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id} className={headerRowClassName}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={cn(
                  DATA_TABLE_HEADER_CELL_CLASS,
                  header.column.id === 'select' && 'w-12 rounded-tl-3xl'
                )}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading ? (
          <TableRow>
            <TableCell
              colSpan={span}
              className="px-6 py-12 text-center text-on-surface-variant"
            >
              {loadingMessage}
            </TableCell>
          </TableRow>
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={span}
              className="px-6 py-12 text-center text-on-surface-variant"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && 'selected'}
              className={bodyRowClassName}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id} className={cn(DATA_TABLE_BODY_CELL_CLASS, 'align-middle')}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
