document.addEventListener("DOMContentLoaded", (event) => {
  let recorder;
  let data = [];
  let startButton = document.getElementById("startButton");
  let stopButton = document.getElementById("stopButton");
  let timerElement = document.getElementById("timer");
  let qualitySelector = document.getElementById("qualitySelector");
  let startTime;

  startButton.addEventListener("click", function () {
    navigator.mediaDevices
      .getDisplayMedia({
        video: {
          width: { ideal: qualitySelector.value === "4k" ? 3840 : 1920 },
          height: { ideal: qualitySelector.value === "4k" ? 2160 : 1080 },
        },
      })
      .then((stream) => {
        startButton.disabled = true;
        stopButton.disabled = false;
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          data.push(e.data);
          if (recorder.state == "inactive") {
            let blob = new Blob(data, { type: "video/webm" });
            let url = URL.createObjectURL(blob);
            let a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = "videorecord.webm";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }, 100);
          }
        };
        recorder.start();
        startTime = Date.now();
        updateTimer();
      })
      .catch((err) => {
        if (err.name === "NotAllowedError") {
          console.log("Permission to access screen was denied by the user.");
        } else {
          console.log("An error occurred: " + err);
        }
      });
  });

  stopButton.addEventListener("click", function () {
    if (recorder) {
      recorder.onstop = () => {
        let blob = new Blob(data, { type: "video/webm" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.style.display = "none";
        a.href = url;
        a.download = "videorecord.webm";
        document.body.appendChild(a);
        a.addEventListener("download", function () {
          // Reset the recorder and the data array
          recorder = null;
          data = [];
          startButton.disabled = false;
          stopButton.disabled = true;
        });
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
      };
      recorder.stop();
    }
  });

  function updateTimer() {
    let now = Date.now();
    let difference = now - startTime;
    let seconds = Math.floor(difference / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);
    seconds = seconds % 60;
    minutes = minutes % 60;
    timerElement.textContent = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    if (recorder && recorder.state == "recording") {
      setTimeout(updateTimer, 1000);
    }
  }
});
