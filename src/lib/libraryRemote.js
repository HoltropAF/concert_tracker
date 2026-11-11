import { applyFields, changedFields } from './offlineLibrary.js'

const request = query => query.abortSignal(AbortSignal.timeout(8000))

export function createLibraryRemote(client, userId, domain, normalize) {
  const settings = domain === 'settings'
  const scope = (query, entity) => {
    const owned = query.eq('user_id', userId)
    return settings ? owned : owned.eq('id', entity)
  }

  const load = async () => {
    if (settings) {
      const { data, error } = await request(scope(client.from(domain).select('data'))).maybeSingle()
      if (error) throw error
      return normalize(data?.data)
    }
    const concerts = []
    const pageSize = 500
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await request(client.from(domain).select('id,data').eq('user_id', userId)
        .order('id').range(offset, offset + pageSize - 1))
      if (error) throw error
      concerts.push(...data.map(row => normalize(row.data, row.id)))
      if (data.length < pageSize) return concerts
    }
  }

  const save = async operation => {
    const { entity, changes, remove, initial } = operation
    for (let attempt = 0; attempt < 3; attempt++) {
      const table = client.from(domain)
      const { data: row, error } = await request(scope(table.select('data,updated_at'), entity)).maybeSingle()
      if (error) throw error
      if (remove && !row) return null
      const updated = remove ? null : applyFields(row ? normalize(row.data, entity) : initial, changes)
      if (row && !remove && !changedFields(normalize(row.data, entity), updated).length) return updated
      const version = Math.max(Date.now(), (Date.parse(row?.updated_at) || 0) + 1)
      const envelope = { data: updated, updated_at: new Date(version).toISOString() }
      if (!row) {
        const { error: insertError } = await request(table.insert({
          ...envelope, user_id: userId, ...(settings ? {} : { id: entity }),
        }))
        if (!insertError) return updated
        if (insertError.code === '23505') continue
        throw insertError
      }
      const write = scope(remove ? table.delete() : table.update(envelope), entity)
      const checked = row.updated_at ? write.eq('updated_at', row.updated_at) : write.is('updated_at', null)
      const result = await request(checked.select('user_id'))
      if (result.error) throw result.error
      if (result.data.length) return updated
    }
    throw new Error('This item changed during sync. Try again.')
  }

  return { load, save }
}
