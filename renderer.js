const { ipcRenderer, desktopCapturer } = require("electron");
const qs = require("querystring");

const params = qs.parse(window.location.search.replace("?", ""));
const displayCount = Number(params.displayCount);
const primaryDisplayId = params.primaryDisplayId;
const sharedDisplayId = params.sharedDisplayId || primaryDisplayId;

let cam, desktop, mediaRecorder, tmpCanvas, tmpCtx, canvasStream, urlObject;
let rootEl = document.getElementById("root");
let controlButton = document.getElementById("start-stop");
let previewDesktopEl = document.getElementById("desktop");
let previewCamEl = document.getElementById("cam");
let debugOutputEl = document.getElementById("debug");

let chunks = [];

if (sharedDisplayId !== primaryDisplayId) {
  rootEl.classList.add("offscreen");
}

if (displayCount > 1) {
  ipcRenderer.on("off-screen", (e, isOnScreen) => {
    if (!isOnScreen) {
      rootEl.classList.add("offscreen");
    } else {
      rootEl.classList.remove("offscreen");
    }
  });
}

async function getMediaStreams() {
  const sources = await desktopCapturer.getSources({
    types: ["screen"],
  });
  console.log(sources, sharedDisplayId, primaryDisplayId);

  try {
    const chromeMediaSourceId = sources.find(
      (s) => s.display_id === sharedDisplayId
    ).id;
    // const chromeMediaSourceId = sharedSource ? sharedSource.id : sources[0].id;

    desktop = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId,
          maxFrameRate: 30,
        },
      },
    });
    debugOutputEl.innerText += `\nUsing display: ${chromeMediaSourceId}`;
  } catch (error) {
    desktop = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: "desktop",
          chromeMediaSourceId: sources[0].id,
        },
      },
    });

    debugOutputEl.innerText += `\n Fall back to: ${sources[0].id}`;
  }
  cam = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });

  return { desktop, camera: cam };
}

function getMediaRecorder(inputStream) {
  if (mediaRecorder) {
    return mediaRecorder;
  }
  mediaRecorder = new MediaRecorder(inputStream, {
    mimeType: "video/webm;codecs=h264",
  });

  mediaRecorder.ondataavailable = ({ data }) => {
    if (data && data.size) {
      chunks.push(data);
    }
  };

  mediaRecorder.onstart = () => {
    controlButton.innerText = "Stop!";
    controlButton.disabled = false;

    if (chunks.length > 0) {
      console.info("There were chunks, clearing");
      chunks = [];
      document.querySelectorAll("a").forEach((aTag) => aTag.remove());
    }
    if (urlObject) {
      URL.revokeObjectURL(urlObject);
    }
  };

  mediaRecorder.onstop = () => {
    console.log("stopped");
    localDownload(chunks);
    controlButton.disabled = false;
    controlButton.innerText = "Start Again";
  };

  return mediaRecorder;
}
function localDownload(chunks) {
  const blob = new Blob(chunks, { type: "video/webm;codecs=h264" });
  const urlObject = URL.createObjectURL(blob);
  const anchorTag = document.createElement("a");

  anchorTag.href = urlObject;
  anchorTag.download = "screen-recording.webm";
  document.getElementById("controls").appendChild(anchorTag);
  anchorTag.innerText = "Download!";
}

function onClickButton() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  } else {
    mediaRecorder.start(1000);
  }
}

getMediaStreams().then((streamsObj) => {
  streamsObj.camera.getAudioTracks().forEach((track) => {
    streamsObj.desktop.addTrack(track);
  });

  previewCamEl.srcObject = streamsObj.camera;
  previewCamEl.play();

  if (displayCount > 1) {
    // shhow preview of desktop stream only if multi window
    previewDesktopEl.srcObject = streamsObj.desktop;
    previewDesktopEl.play();
  } else {
  }

  mediaRecorder = getMediaRecorder(desktop);

  controlButton.onclick = onClickButton;
  controlButton.classList.remove("loading");
});
