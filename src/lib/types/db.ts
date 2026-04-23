type DbExportPayload = {
  exportedAt: string
  version: number
  tables: Record<string, unknown[]>
  syncState: Record<string, string>
}


