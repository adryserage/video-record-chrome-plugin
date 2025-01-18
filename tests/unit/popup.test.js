import '@testing-library/jest-dom';
import { screen, fireEvent } from '@testing-library/dom';
import { chrome } from 'jest-chrome';

describe('Popup UI', () => {
  let messageListener;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <button id="startBtn">Start Recording</button>
      <button id="stopBtn">Stop Recording</button>
      <button id="pauseBtn">Pause Recording</button>
      <div id="timer">00:00</div>
      <select id="qualitySelect">
        <option value="1080p">1080p</option>
        <option value="4k">4K</option>
      </select>
    `;

    // Clear all mocks
    jest.clearAllMocks();

    // Mock chrome APIs
    chrome.runtime.onMessage.addListener = jest.fn((callback) => {
      messageListener = callback;
    });

    chrome.runtime.sendMessage = jest.fn(() => Promise.resolve({ success: true }));

    chrome.storage.local.get = jest.fn((key, callback) => {
      callback({ settings: { quality: '1080p', audioEnabled: true } });
      return Promise.resolve({ settings: { quality: '1080p', audioEnabled: true } });
    });

    chrome.storage.local.set = jest.fn((data, callback) => {
      if (callback) callback();
      return Promise.resolve();
    });

    // Load popup script
    jest.isolateModules(() => {
      require('../../popup.js');
    });

    // Simulate DOMContentLoaded
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  test('initializes with correct default state', async () => {
    expect(document.getElementById('startBtn')).not.toBeDisabled();
    expect(document.getElementById('stopBtn')).toBeDisabled();
    expect(document.getElementById('pauseBtn')).toBeDisabled();
    expect(document.getElementById('timer').textContent).toBe('00:00');
    expect(document.getElementById('qualitySelect').value).toBe('1080p');
  });

  test('updates UI when recording starts', async () => {
    const startBtn = document.getElementById('startBtn');
    fireEvent.click(startBtn);

    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'START_RECORDING',
      options: {
        quality: '1080p',
        audioEnabled: true
      }
    });

    // Simulate response
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: false,
        duration: 0
      }
    });

    expect(startBtn.disabled).toBe(true);
    expect(document.getElementById('stopBtn').disabled).toBe(false);
    expect(document.getElementById('pauseBtn').disabled).toBe(false);
  });

  test('handles recording stop correctly', async () => {
    const stopBtn = document.getElementById('stopBtn');
    fireEvent.click(stopBtn);

    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'STOP_RECORDING'
    });

    // Simulate response
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: false,
        isPaused: false,
        duration: 0
      }
    });

    expect(document.getElementById('startBtn').disabled).toBe(false);
    expect(stopBtn.disabled).toBe(true);
    expect(document.getElementById('pauseBtn').disabled).toBe(true);
  });

  test('updates quality settings', async () => {
    const qualitySelect = document.getElementById('qualitySelect');
    fireEvent.change(qualitySelect, { target: { value: '4k' } });

    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      settings: {
        quality: '4k',
        audioEnabled: true
      }
    });
  });

  test('handles pause/resume correctly', async () => {
    const pauseBtn = document.getElementById('pauseBtn');
    fireEvent.click(pauseBtn);

    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      action: 'TOGGLE_PAUSE'
    });

    // Simulate paused state
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: true,
        duration: 0
      }
    });

    expect(pauseBtn.textContent).toBe('Resume');
  });

  test('updates timer display', async () => {
    // Update with 1 minute elapsed
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: false,
        duration: 60000
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    const timer = document.getElementById('timer');
    expect(timer.textContent).toBe('01:00');
    
    // Update with 1 hour and 30 minutes elapsed
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: false,
        duration: 5400000
      }
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(timer.textContent).toBe('01:30:00');
  });

  test('handles status updates correctly', async () => {
    // Simulate status update
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: false,
        duration: 5000
      }
    });

    // Check UI updates
    expect(document.getElementById('startBtn').disabled).toBe(true);
    expect(document.getElementById('stopBtn').disabled).toBe(false);
    expect(document.getElementById('pauseBtn').disabled).toBe(false);
    expect(document.getElementById('timer').textContent).toBe('00:05');

    // Simulate paused status
    messageListener({
      action: 'STATUS_UPDATE',
      status: {
        isRecording: true,
        isPaused: true,
        duration: 10000
      }
    });

    // Check paused state
    expect(document.getElementById('pauseBtn').textContent).toBe('Resume');
    expect(document.getElementById('timer').textContent).toBe('00:10');
  });
});
