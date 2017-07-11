# Uptobox

Simple node library to get uptobox premium link

## Install

```bash
npm install uptobox
```

## Quick Example

```js
const uptobox = new Uptobox('username', 'password');
uptobox.getDownloadLink('http://uptobox.com/xxxxxxxx').then(link => {
    console.log(link);
})
```

## License

MIT © 2017 [Jimmy Laurent](https://github.com/JimmyLaurent)