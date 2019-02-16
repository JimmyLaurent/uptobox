const path = require('path');
const requestPromise = require('request-promise');

const baseUrl = 'https://uptobox.com';

/* Core */

let token;
function setToken(userToken) {
  token = userToken;
}

const cookieJar = requestPromise.jar();

async function login(username, password) {
  await requestPromise.post({
    url: `${baseUrl}/?op=login&referer=homepage`,
    jar: cookieJar,
    simple: false,
    form: { login: username, password }
  });
}

async function getToken(username, password, initModuleToken = true) {
  try {
    await login(username, password);

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
    throw new Error(response.message);
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

function getPathAndName(param) {
  if (typeof param === 'string') {
    const { dir, base } = path.parse(param);
    return { path: dir, name: base };
  }
  return param;
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

function getUrl(fileIdOrUrl) {
  const urlRegExp = /^http[s]?:\/\/(uptobox|uptostream)\.com\/([0-9a-zA-Z]{12})$/gm;
  const idRegExp = /^([0-9a-zA-Z]{12})$/gm;

  if (urlRegExp.test(fileIdOrUrl)) {
    if (fileIdOrUrl.startsWith('http:')) {
      return fileIdOrUrl.replace('http:', 'https:');
    }
    return fileIdOrUrl;
  } else if (idRegExp.test(fileIdOrUrl)) {
    return `${baseUrl}/${fileIdOrUrl}`;
  }
  throw new Error('Incorrect url or file id');
}

function arrangePath(path) {
  let resultPath = path;
  if (resultPath.startsWith('//')) {
    resultPath = path;
  } else if (resultPath.startsWith('/')) {
    resultPath = '/' + path;
  }
  if (resultPath !== '//' && resultPath.endsWith('/')) {
    return resultPath.replace(/\/$/, '');
  }
  return resultPath;
}

async function getLinkInfo(urlOrFileId, throwOnError = false) {
  const url = getUrl(urlOrFileId);
  const response = await requestPromise({
    method: 'GET',
    url
  });
  const fileRegExp = /<h1 class='file-title'>(.+)\((.+)\)</gm;
  const uptostreamRegExp = /uptostream\.com\/(.+)">/gm;

  const fileMatch = fileRegExp.exec(response);
  if (fileMatch) {
    const linkInfo = {
      url,
      name: fileMatch[1].trim(),
      size: fileMatch[2]
    };
    const uptostreamMatch = uptostreamRegExp.exec(response);
    if (uptostreamMatch) {
      linkInfo.utptostreamLink = `https://uptostream.com/${uptostreamMatch[1]}`;
    }
    return linkInfo;
  }
  if(throwOnError) {
    throw new Error('File not found');
  }
}

async function addToAccount(urlOrFileId, options = {}) {
  const { folderPath, createFolderIfNotExisting, public } = Object.assign(
    {
      createFolderIfNotExisting: true,
      public: false
    },
    options
  );
  const addToAccountUrl = `${getUrl(urlOrFileId)}?add-to-account`;
  let folder;

  if (folderPath) {
    const doGetFolder = createFolderIfNotExisting
      ? createFolderOrGetExistingOne
      : getFolder;
    folder = await doGetFolder(folderPath);
    if (!folder) {
      throw new Error("Could't find the destination folder");
    }
  }

  let result = await requestPromise({
    method: 'POST',
    jar: cookieJar,
    url: addToAccountUrl
  });
  if (result !== '"ok"') {
    throw new Error(result);
  }

  result = await getFilesOrFolders({
    limit: 1,
    offset: 0,
    orderBy: 'file_created',
    dir: 'desc'
  });
  if (result.files.length) {
    const file = result.files[0];
    if (folder) {
      await moveFiles({
        fileCodes: file.file_code,
        destinationFolderId: folder.fld_id
      });
    }
    if (!public) {
      await updateFile({ fileCode: file.file_code, public: false });
    }
    return file;
  }
  throw new Error("Could't find the added file");
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

async function getFilesOrFolders({
  path = '//',
  limit = 10,
  offset = 0,
  orderBy = 'file_created',
  dir = 'desc',
  search = null,
  searchField = null
} = {}) {
  checkToken();
  let url = `${baseUrl}/api/user/files?token=${token}&path=${arrangePath(
    path
  )}&limit=${limit}&offset=${offset}&orderBy=${orderBy}&dir=${dir}`;
  if (search) {
    url += `&search=${search}`;
  }
  if (searchField) {
    url += `&searchField=${searchField}`;
  }

  const response = await requestPromise({
    method: 'GET',
    url,
    json: true
  });
  return response.data;
}

async function getFolder(param) {
  let { path, name } = getPathAndName(param);
  path = arrangePath(path);
  const filesAndFolders = await getFilesOrFolders({
    path
  });

  let folder = filesAndFolders.folders.find(f => f.name === name);
  return folder;
}

async function createFolderOrGetExistingOne(param) {
  const { path, name } = getPathAndName(param);
  try {
    await createFolder({ path, name });
    return await getFolder({ path, name });
  } catch (e) {
    return await getFolder({ path, name });
  }
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
    action: 'move',
    fld_id: folderId,
    destination_fld_id: destinationFolderId
  });
}

function moveFiles({ fileCodes, destinationFolderId }) {
  return patchRequest('/api/user/files', {
    action: 'move',
    file_codes: Array.isArray(fileCodes) ? fileCodes.join(',') : fileCodes,
    destination_fld_id: destinationFolderId
  });
}

function copyFiles({ fileCodes, destinationFolderId }) {
  return patchRequest('/api/user/files', {
    action: 'copy',
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

function createFolder(param) {
  const { path, name } = getPathAndName(param);
  return putRequest('/api/user/files', {
    path: arrangePath(path),
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
  deleteFolder,
  getUptoboxFileId,
  getLinkInfo,
  addToAccount,
  login,
  getFilesOrFolders,
  createFolderOrGetExistingOne,
  getFolder
};
