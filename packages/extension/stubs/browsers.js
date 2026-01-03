export const Browser = {}
export const BrowserPlatform = {}
export const ChromeReleaseChannel = {}
export const Cache = {}
export const detectBrowserPlatform = () => null
export const install = () => Promise.resolve()
export const canDownload = () => Promise.resolve(false)
export const launch = () =>
  Promise.reject(new Error('Not supported in browser'))
export const computeExecutablePath = () => ''
export const resolveBuildId = () => Promise.resolve('')
export default {}
