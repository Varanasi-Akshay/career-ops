const FILE_NAME = 'career-ops-dashboard-progress.json';

function doGet(event) {
  const payload = readProgress_();
  const callback = event && event.parameter && event.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResponse(payload);
}

function doPost(event) {
  const payload = event && event.postData && event.postData.contents
    ? JSON.parse(event.postData.contents)
    : {};
  writeProgress_(payload);
  return jsonResponse({ ok: true, updatedAt: new Date().toISOString() });
}

function readProgress_() {
  const file = findProgressFile_();
  if (!file) return { jobs: {}, skills: {}, updatedAt: null };
  try {
    return JSON.parse(file.getBlob().getDataAsString());
  } catch (error) {
    return { jobs: {}, skills: {}, updatedAt: null, error: String(error) };
  }
}

function writeProgress_(payload) {
  const content = JSON.stringify({
    jobs: payload.jobs || {},
    skills: payload.skills || {},
    updatedAt: new Date().toISOString(),
  }, null, 2);
  const file = findProgressFile_();
  if (file) {
    file.setContent(content);
  } else {
    DriveApp.createFile(FILE_NAME, content, MimeType.PLAIN_TEXT);
  }
}

function findProgressFile_() {
  const files = DriveApp.getFilesByName(FILE_NAME);
  return files.hasNext() ? files.next() : null;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
