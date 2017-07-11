const Promise = require('bluebird');
const request = Promise.promisify(require('request'));
const Xray = require('x-ray');
const makeDriver = require('request-x-ray');
const x = Xray();

module.exports = class Uptobox {
    constructor(user, password) {
        this.user = user;
        this.password = password;
        this.cookieJar = request.jar();
    }

    isLogged() {
        return this.cookieJar.getCookies('http://uptobox.com').length > 0;
    }

    login() {
        return request(
            {
                url: 'https://login.uptobox.com/logarithme',
                method: 'POST',
                jar: this.cookieJar,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 6.2; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/32.0.1667.0 Safari/537.36',
                    'referer': 'https://login.uptobox.com/'
                },
                form: { op: 'login', login: this.user, password: this.password }
            })
            .catch(error => {
                return new Error('Couldn\'t login: ' + error);
            });
    }

    ensureLogin() {
        return this.isLogged() ? Promise.resolve() : this.login();
    }

    getDownloadLink(url) {
        return this.ensureLogin().then(() => {
            return Promise.fromCallback(x(url,
                {
                    op: 'input[name="op"]@value',
                    id: 'input[name="id"]@value',
                    fname: 'input[name="fname"]@value',
                    file_size_real: 'input[name="file_size_real"]@value',
                    rand: 'input[name="rand"]@value',
                    referer: 'input[name="referer"]@value',
                    method_free: 'input[name="method_free"]@value',
                    method_premium: 'input[name="method_premium"]@value',
                })).then(result => {
                    x.driver(makeDriver({
                        jar: this.cookieJar,
                        method: 'POST',
                        form: result
                    }));
                    return Promise.fromCallback(x(url, 'a:contains(Click here to start your download)@href'));
                });
        });
    }
}
