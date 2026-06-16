import '@testing-library/jest-dom'

const createLocalStorageMock = () => {
  const store = new Map()
  return {
    getItem: vi.fn((key) => {
      const v = store.get(key)
      return v === undefined ? null : v
    }),
    setItem: vi.fn((key, value) => {
      store.set(String(key), String(value))
    }),
    removeItem: vi.fn((key) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    key: vi.fn((index) => {
      return Array.from(store.keys())[index] || null
    }),
    get length() {
      return store.size
    },
    _store: store
  }
}

Object.defineProperty(window, 'localStorage', {
  value: createLocalStorageMock()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
})

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
