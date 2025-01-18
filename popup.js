// UI Elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const pauseButton = document.getElementById('pauseButton');
const timerElement = document.getElementById('timer');
const statusElement = document.getElementById('status');
const qualitySelector = document.getElementById('qualitySelector');
const audioToggle = document.getElementById('audioToggle');

// State
let isRecording = false;
let isPaused = false;
let updateInterval = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  // Load saved settings
  const { settings } = await chrome.storage.local.get('settings');
  qualitySelector.value = settings.quality;
  audioToggle.checked = settings.audioEnabled;

  // Get current recording status
  updateRecordingStatus();

  // Add event listeners
  startButton.addEventListener('click', startRecording);
  stopButton.addEventListener('click', stopRecording);
  pauseButton.addEventListener('click', togglePause);
  qualitySelector.addEventListener('change', updateSettings);
  audioToggle.addEventListener('change', updateSettings);

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'STATUS_UPDATE') {
      updateUI(message.status);
    }
  });
});

// Recording controls
async function startRecording() {
  try {
    await chrome.runtime.sendMessage({
      action: 'START_RECORDING',
      options: {
        quality: qualitySelector.value,
        audioEnabled: audioToggle.checked
      }
    });
    
    updateButtonStates(true, false);
    updateStatus('Recording started');
  } catch (error) {
    console.error('Failed to start recording:', error);
    updateStatus('Failed to start recording');
  }
}

async function stopRecording() {
  try {
    await chrome.runtime.sendMessage({ action: 'STOP_RECORDING' });
    updateButtonStates(false, true);
    updateStatus('Recording saved');
  } catch (error) {
    console.error('Failed to stop recording:', error);
    updateStatus('Failed to stop recording');
  }
}

async function togglePause() {
  try {
    await chrome.runtime.sendMessage({ action: 'TOGGLE_PAUSE' });
    isPaused = !isPaused;
    updatePauseButton();
    updateStatus(isPaused ? 'Recording paused' : 'Recording resumed');
  } catch (error) {
    console.error('Failed to toggle pause:', error);
  }
}

// Settings management
async function updateSettings() {
  const settings = {
    quality: qualitySelector.value,
    audioEnabled: audioToggle.checked
  };
  
  await chrome.storage.local.set({ settings });
}

// UI updates
function updateButtonStates(recording, stopped = false) {
  startButton.disabled = recording;
  stopButton.disabled = !recording;
  pauseButton.disabled = !recording || stopped;
  qualitySelector.disabled = recording;
  audioToggle.disabled = recording;
  
  if (stopped) {
    pauseButton.textContent = '⏸ Pause';
    isPaused = false;
  }
}

function updatePauseButton() {
  pauseButton.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
}

function updateStatus(message) {
  statusElement.textContent = message;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  
  return [hh, mm, ss]
    .map(num => num.toString().padStart(2, '0'))
    .join(':');
}

function updateTimer(duration) {
  timerElement.textContent = formatTime(duration);
}

function updateUI(status) {
  isRecording = status.isRecording;
  isPaused = status.isPaused;
  
  updateButtonStates(isRecording);
  updatePauseButton();
  updateTimer(status.duration);
  
  if (!isRecording) {
    updateStatus('Ready to record');
  }
}

// Status polling
async function updateRecordingStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
    updateUI(response);
  } catch (error) {
    console.error('Failed to get recording status:', error);
  }
}

// Error handling
window.onerror = function(message, source, line, column, error) {
  console.error('Error:', { message, source, line, column, error });
  updateStatus('An error occurred');
  return false;
};
