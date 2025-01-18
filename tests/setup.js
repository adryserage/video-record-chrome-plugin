import '@testing-library/jest-dom';
import { chrome } from 'jest-chrome';

// Create event emitter for Chrome message events
class ChromeEventEmitter {
  constructor() {
    this.listeners = [];
  }

  addListener(callback) {
    this.listeners.push(callback);
    return callback;
  }

  removeListener(callback) {
    this.listeners = this.listeners.filter(listener => listener !== callback);
  }

  hasListeners() {
    return this.listeners.length > 0;
  }

  emit(...args) {
    this.listeners.forEach(listener => listener(...args));
  }
}

// Mock Chrome APIs
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn((key, callback) => {
        const data = { settings: { quality: '1080p', audioEnabled: true } };
        if (callback) {
          callback(data);
        }
        return Promise.resolve(data);
      }),
      set: jest.fn((data, callback) => {
        if (callback) {
          callback();
        }
        return Promise.resolve();
      })
    }
  },
  downloads: {
    download: jest.fn(() => Promise.resolve(1))
  },
  commands: {
    onCommand: {
      addListener: jest.fn()
    }
  }
};

// Mock MediaRecorder
global.MediaRecorder = jest.fn().mockImplementation(() => ({
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: jest.fn(),
  onstop: jest.fn(),
  state: 'inactive'
}));

// Mock navigator.mediaDevices
global.navigator.mediaDevices = {
  getDisplayMedia: jest.fn(() => Promise.resolve({
    getTracks: () => [{
      stop: jest.fn()
    }]
  }))
};

// Mock Blob
global.Blob = jest.fn().mockImplementation((content, options) => ({
  content,
  options,
  size: content.length
}));

// Mock URL
global.URL = {
  createObjectURL: jest.fn(blob => `blob:${blob.content}`),
  revokeObjectURL: jest.fn()
};

// Mock document.createElement
document.createElement = jest.fn().mockImplementation(tag => {
  if (tag === 'a') {
    return {
      click: jest.fn(),
      href: '',
      download: ''
    };
  }
  return {};
});

// Mock console methods to reduce noise in tests
global.console = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};
