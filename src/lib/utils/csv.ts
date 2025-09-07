type Header = { key: string, label: string }

const esc = (v: unknown) => {
  if (v === undefined || v === null) return '""'
  const s = String(v).replace(/"/g, '""')
  return `"${s}"`
}

export const toCSV = (rows: Record<string, unknown>[], headers: Header[]) => {
  const head = headers.map(h => esc(h.label)).join(',')
  const body = rows.map(r => headers.map(h => esc(r[h.key])).join(',')).join('\n')
  return `${head}\n${body}`
}

export const downloadCSV = (filename: string, csv: string) => {
  // BOM för Excel-kompat
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}