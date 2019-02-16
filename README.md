# Uptobox

Node library to use uptobox api

## Install

```bash
yarn add uptobox
```

## Quick Example

### Get a premium link
```js
const { setToken, getLink } = require('uptobox');

(async () => {
  setToken('{YOU_TOKEN}');
  const premiumLink = await getLink('{YOUR_URL_OR_FILE_CODE}');
  console.log(premiumLink);
})();
```

## API Reference

All the following methods are avalaible.

> Feel free to consult the uptobox api [documentation](https://docs.uptobox.com) and look the code to get more informations.

### getToken
### setToken
### getLink
### getUser
### enableOnlySecureDownload
### disableOnlySecureDownload
### enableDirectDownload
### disableDirectDownload
### enableSecurityLock
### disableSecurityLock
### convertPoints
### updateFile
### updateFilesPublicOption
### moveFolder
### moveFiles
### copyFiles
### renameFolder
### createFolder
### deleteFiles
### getFilesOrFolders
### deleteFolder
### getUptoboxFileId
### getLinkInfo
### addToAccount
### login
### getFilesOrFolders
### createFolderOrGetExistingOne
### getFolder

## License

MIT © 2019 [Jimmy Laurent](https://github.com/JimmyLaurent)