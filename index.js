const requestPromise = require('request-promise');

const baseUrl = 'https://uptobox.com';

/* Core */

let token;
function setToken(userToken) {
  token = userToken;
}

async function getToken(login, password, initModuleToken = true) {
  let cookieJar = requestPromise.jar();
  try {
    await requestPromise.post({
      url: `${baseUrl}/?op=login&referer=homepage`,
      jar: cookieJar,
      simple: false,
      form: { login, password }
    });

    const result = await requestPromise({
      url: `${baseUrl}/?op=my_account`,
      jar: cookieJar
    });

    const tokenRegex = /<span class='none'>([a-z0-9]+)<\/span><\/span>/gm;
    const match = tokenRegex.exec(result);
    if (match) {
      if (initModuleToken) {
        token = match[1];
      }
      return match[1];
    }
    throw new Error('No token found');
  } catch (error) {
    throw new Error(`Couldn't get the token, reason : ${error.message}`);
  }
}

function checkToken() {
  if (!token) {
    throw new Error(
      'Token is missing, you must call setToken or getToken before doing this operation'
    );
  }
}

function handleApiResult(response) {
  {
    if (response.statusCode === 0 || response.statusCode === 16) {
      return response.data;
    }
    throw response;
  }
}

function request(method, endpoint, body = {}) {
  checkToken();
  return requestPromise({
    method,
    url: `${baseUrl}${endpoint}`,
    body: { ...body, token },
    json: true
  }).then(handleApiResult);
}

function patchRequest(endpoint, body) {
  return request('PATCH', endpoint, body);
}

function putRequest(endpoint, body) {
  return request('PUT', endpoint, body);
}

function deleteRequest(endpoint, body) {
  return request('DELETE', endpoint, body);
}

function putRequest(endpoint, body = {}) {
  checkToken();
  return request
    .put({
      url: `${baseUrl}${endpoint}`,
      body: { ...body, token },
      json: true
    })
    .then(handleApiResult);
}

function getUptoboxFileId(link) {
  const linkIdRegex = /^[a-zA-Z0-9]+$/gm;
  if (linkIdRegex.test(link)) {
    return link;
  }

  const linkRegex = /https?:\/\/uptobox.com\/([a-zA-Z0-9]+)\/?/gm;
  const match = linkRegex.exec(link);
  if (match) {
    return match[1];
  }

  throw new Error("Couldn't get uptobox file id from the given link");
}

/* Api */

function getUser() {
  checkToken();
  return requestPromise({
    url: `${baseUrl}/api/user/me?token=${token}`,
    json: true
  }).then(handleApiResult);
}

function enableOnlySecureDownload() {
  return patchRequest('/api/user/settings', { ssl: 1 });
}

function disableOnlySecureDownload() {
  return patchRequest('/api/user/settings', { ssl: 0 });
}

function enableDirectDownload() {
  return patchRequest('/api/user/settings', { directDownload: 1 });
}

function disableDirectDownload() {
  return patchRequest('/api/user/settings', { directDownload: 0 });
}

function enableSecurityLock() {
  return patchRequest('/api/user/securityLock', { securityLock: 1 });
}

function disableSecurityLock() {
  return patchRequest('/api/user/securityLock', { securityLock: 0 });
}

function convertPoints(points) {
  return patchRequest('/api/user/requestPremium', { points });
}

function getLink(linkOrFileId, waitingToken = '') {
  const fileId = getUptoboxFileId(linkOrFileId);

  checkToken();
  return requestPromise({
    url: `${baseUrl}/api/link?token=${token}&id=${fileId}&waitingToken=${waitingToken}`,
    json: true
  })
    .then(handleApiResult)
    .then(async r => {
      if (r.dlLink) {
        return r.dlLink;
      }
      if (r.waitingToken) {
        await new Promise(resolve => setTimeout(resolve, 30500));
        return getLink(fileId, r.waitingToken);
      }
      throw new Error("Could't get the link");
    });
}

function getFiles({
  path = '',
  limit = '',
  offset = '',
  orderBy = '',
  dir = ''
}) {
  checkToken();
  return requestPromise({
    url: `${baseUrl}/api/link?token=${token}&path=${path}&limit=${limit}&offset=${offset}&orderBy=${orderBy}&dir=${dir}`,
    json: true
  });
}

function updateFile({ fileCode, newName, description, password, public }) {
  return patchRequest('/api/user/files', {
    file_code: fileCode,
    new_name: newName,
    description,
    password,
    public: public ? 1 : 0
  });
}

function updateFilesPublicOption({ fileCodes, public }) {
  return patchRequest('/api/user/files', {
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes,
    public: public ? 1 : 0
  });
}

function moveFolder({ folderId, destinationFolderId }) {
  return patchRequest('/api/user/files', {
    fld_id: folderId,
    destination_fld_id: destinationFolderId
  });
}

function moveFiles({ fileCodes, destinationFolderId }) {
  return patchRequest('/api/user/files', {
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes,
    destination_fld_id: destinationFolderId
  });
}

function copyFiles({ fileCodes, destinationFolderId }) {
  return patchRequest('/api/user/files', {
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes,
    fld_id: destinationFolderId
  });
}

function renameFolder({ folderId, newName }) {
  return patchRequest('/api/user/files', {
    fld_id: folderId,
    new_name: newName
  });
}

function createFolder({ path, name }) {
  return putRequest('/api/user/files', {
    path,
    name
  });
}

function deleteFiles({ fileCodes }) {
  return deleteRequest('/api/user/files', {
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes
  });
}

function deleteFolder({ fileCodes }) {
  return deleteRequest('/api/user/files', {
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes
  });
}

module.exports = {
  getToken,
  setToken,
  getLink,
  getUser,
  enableOnlySecureDownload,
  disableOnlySecureDownload,
  enableDirectDownload,
  disableDirectDownload,
  enableSecurityLock,
  disableSecurityLock,
  convertPoints,
  updateFile,
  updateFilesPublicOption,
  moveFolder,
  moveFiles,
  copyFiles,
  renameFolder,
  createFolder,
  deleteFiles,
  getFiles,
  deleteFolder
};
