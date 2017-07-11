# Uptobox

Simple node library to get uptobox premium link

## Install

```bash
npm install uptobox
```

## Quick Example

### Get a premium link
```js
const Uptobox = require('uptobox');
const uptobox = new Uptobox('username', 'password');
uptobox.getDownloadLink('http://uptobox.com/xxxxxxxx').then(premiumLink => {
    console.log(premiumLink);
})
```

## License

MIT © 2017 [Jimmy Laurent](https://github.com/JimmyLaurent)