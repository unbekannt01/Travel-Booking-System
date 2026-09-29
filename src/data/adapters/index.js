import * as restAdapter from "./rest"
import * as sqliteAdapter from "./sqlite"

export const isDesktop = typeof window !== "undefined" && Boolean(window.electron)
export const adapter = isDesktop ? sqliteAdapter : restAdapter

export { restAdapter, sqliteAdapter }
export default adapter
