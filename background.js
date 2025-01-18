// Constants for recording settings
const DEFAULT_SETTINGS = {
  quality: '1080p',
  audioEnabled: true,
  fileFormat: 'webm',
};

const QUALITY_PRESETS = {
  '720p': { width: 1280, height: 720, bitrate: 2500000 },
  '1080p': { width: 1920, height: 1080, bitrate: 5000000 },
  '4k': { width: 3840, height: 2160, bitrate: 15000000 },
};

// State management
let activeRecording = null;
let recordingStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let startTime = 0;
let pauseTime = 0;
let isPaused = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
});

// Handle commands (keyboard shortcuts)
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case 'start-stop-recording':
      if (activeRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      break;
    case 'pause-resume-recording':
      if (activeRecording) {
        togglePause();
      }
      break;
  }
});

// Message handling from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'START_RECORDING':
      startRecording(message.options);
      sendResponse({ success: true });
      break;
    case 'STOP_RECORDING':
      stopRecording();
      sendResponse({ success: true });
      break;
    case 'TOGGLE_PAUSE':
      togglePause();
      sendResponse({ success: true });
      break;
    case 'GET_STATUS':
      sendResponse({
        isRecording: !!activeRecording,
        isPaused,
        duration: getRecordingDuration(),
      });
      break;
  }
  return true;
});

// Recording functions
async function startRecording(options = {}) {
  try {
    const settings = await chrome.storage.local.get('settings');
    const quality = QUALITY_PRESETS[settings.settings.quality || '1080p'];
    
    const streamConstraints = {
      audio: settings.settings.audioEnabled,
      video: {
        ...quality,
        displaySurface: 'monitor',
      }
    };

    const stream = await navigator.mediaDevices.getDisplayMedia(streamConstraints);
    recordingStream = stream;

    const mimeType = 'video/webm;codecs=vp9';
    mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: quality.bitrate
    });

    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleRecordingStop;

    recordedChunks = [];
    startTime = Date.now();
    pauseTime = 0;
    isPaused = false;
    activeRecording = true;

    mediaRecorder.start(1000); // Capture chunks every second
    broadcastStatus();
  } catch (error) {
    console.error('Error starting recording:', error);
    cleanup();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    recordingStream.getTracks().forEach(track => track.stop());
  }
}

function togglePause() {
  if (!mediaRecorder) return;

  if (mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    pauseTime = Date.now();
    isPaused = true;
  } else if (mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
    startTime += (Date.now() - pauseTime);
    isPaused = false;
  }
  broadcastStatus();
}

function handleDataAvailable(event) {
  if (event.data.size > 0) {
    recordedChunks.push(event.data);
  }
}

async function handleRecordingStop() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `screen-recording-${timestamp}.webm`;

  try {
    const downloadId = await chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    });
    console.log('Download started:', downloadId);
  } catch (error) {
    console.error('Download failed:', error);
  }

  cleanup();
}

function cleanup() {
  activeRecording = null;
  recordingStream = null;
  mediaRecorder = null;
  recordedChunks = [];
  startTime = 0;
  pauseTime = 0;
  isPaused = false;
  broadcastStatus();
}

function getRecordingDuration() {
  if (!startTime) return 0;
  const pauseDuration = pauseTime ? (Date.now() - pauseTime) : 0;
  return isPaused ? (pauseTime - startTime) : (Date.now() - startTime - pauseDuration);
}

function broadcastStatus() {
  const status = {
    action: 'STATUS_UPDATE',
    status: {
      isRecording: !!activeRecording,
      isPaused,
      duration: getRecordingDuration()
    }
  };

  try {
    chrome.runtime.sendMessage(status).catch(() => {
      // Ignore errors when popup is closed
      console.debug('Failed to broadcast status - popup might be closed');
    });
  } catch (error) {
    // Handle any synchronous errors
    console.debug('Failed to broadcast status:', error);
  }
}
