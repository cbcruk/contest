export {
  connect,
  getEndpoint,
  type ConnectOptions,
  type Browser,
  type Page,
  type ElementHandle,
} from './connect'

export { withPage, type WithPageOptions, type PageTestFn } from './with-page'

export {
  guardPage,
  isMutationAllowed,
  hostOf,
  DEFAULT_ALLOWED,
  type GuardOptions,
  type OriginMatcher,
} from './guard'
