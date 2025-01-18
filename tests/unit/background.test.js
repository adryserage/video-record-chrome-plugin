import { chrome } from 'jest-chrome';

describe('Background Service Worker', () => {
  let listener;
  let mockMediaRecorder;
  let mockStream;
  let sendResponse;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock MediaRecorder
    mockMediaRecorder = {
      start: jest.fn(),
      stop: jest.fn(),
      pause: jest.fn(),
      resume: jest.fn(),
      ondataavailable: null,
      onstop: null,
      state: 'inactive'
    };

    global.MediaRecorder = jest.fn(() => mockMediaRecorder);
    global.MediaRecorder.isTypeSupported = jest.fn(() => true);

    // Mock navigator.mediaDevices
    mockStream = {
      getTracks: jest.fn(() => [{
        stop: jest.fn()
      }])
    };

    global.navigator.mediaDevices = {
      getDisplayMedia: jest.fn(() => Promise.resolve(mockStream))
    };

    // Mock Blob
    global.Blob = jest.fn((content, options) => ({
      content,
      options,
      size: content.length
    }));

    // Mock URL
    global.URL = {
      createObjectURL: jest.fn(blob => `blob:${blob.content}`),
      revokeObjectURL: jest.fn()
    };

    // Mock chrome APIs
    chrome.runtime.onMessage.addListener = jest.fn((callback) => {
      listener = callback;
    });

    chrome.downloads = {
      download: jest.fn(() => Promise.resolve(1))
    };

    // Setup response mock
    sendResponse = jest.fn();

    // Import background.js fresh for each test
    jest.isolateModules(() => {
      require('../../background.js');
    });
  });

  test('handles start recording message', async () => {
    await listener(
      { action: 'START_RECORDING', options: { quality: '1080p', audioEnabled: true } },
      {},
      sendResponse
    );

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalled();
    expect(MediaRecorder).toHaveBeenCalled();
    expect(mockMediaRecorder.start).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('handles stop recording message', async () => {
    // First start recording
    await listener(
      { action: 'START_RECORDING', options: { quality: '1080p', audioEnabled: true } },
      {},
      sendResponse
    );

    // Then stop recording
    await listener(
      { action: 'STOP_RECORDING' },
      {},
      sendResponse
    );

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
    expect(mockStream.getTracks()[0].stop).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true });
  });

  test('handles recording errors gracefully', async () => {
    // Mock getDisplayMedia to throw error
    navigator.mediaDevices.getDisplayMedia.mockImplementation(() => {
      throw new Error('Permission denied');
    });

    await listener(
      { action: 'START_RECORDING', options: { quality: '1080p', audioEnabled: true } },
      {},
      sendResponse
    );

    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Failed to start recording: Permission denied'
    });
  });

  test('creates download when recording stops', async () => {
    // Start recording
    await listener(
      { action: 'START_RECORDING', options: { quality: '1080p', audioEnabled: true } },
      {},
      sendResponse
    );

    // Simulate recording data
    const blob = new Blob(['test data'], { type: 'video/webm' });
    mockMediaRecorder.ondataavailable({ data: blob });

    // Stop recording
    await listener(
      { action: 'STOP_RECORDING' },
      {},
      sendResponse
    );

    // Trigger onstop
    mockMediaRecorder.onstop();

    expect(chrome.downloads.download).toHaveBeenCalledWith({
      url: expect.stringContaining('blob:test data'),
      filename: expect.stringMatching(/^recording-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.webm$/),
      saveAs: true
    });
  });

  test('handles pause/resume correctly', async () => {
    // Start recording
    await listener(
      { action: 'START_RECORDING', options: { quality: '1080p', audioEnabled: true } },
      {},
      sendResponse
    );

    // Pause recording
    await listener(
      { action: 'TOGGLE_PAUSE' },
      {},
      sendResponse
    );

    expect(mockMediaRecorder.pause).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      status: { isRecording: true, isPaused: true }
    });

    // Resume recording
    await listener(
      { action: 'TOGGLE_PAUSE' },
      {},
      sendResponse
    );

    expect(mockMediaRecorder.resume).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      status: { isRecording: true, isPaused: false }
    });
  });
});
