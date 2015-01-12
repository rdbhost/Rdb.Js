/*
 *  Rdbhost database access module, Version 2
 *
 *
 *
 *  This version relies on web-sockets, and should only be used where you are confident your user base has
 *    html5 browsers.
 *
 *
 *  It has two dependencies, the Bluebird promise library, and the Jvent library
 *
 *
 *    class Connection({connOps})
 *
 *      execute({opts}) -> promise
 *
 *        request_xhr({opts}) -> promise
 *
 *        request_ws({opts}) -> promise
 *
 *
 *      onError(errorName, func(d)) -> t
 *
 *      offError(errorName, [func]) -> t|f
 *
 *      onInbound(func(m)) -> t
 *
 *      offInbound(func) -> t|f
 *
 *
 *
 *    class Login({loginOpts})
 *
 *      loginOpenId(id) -> id, code
 *
 *      login(email, passwd) -> str (authcode)
 *
 *
 *   ----------------------------------------------------------------
 *
 *     connOpts {
 *       accountId    (required)
 *       roleType     (required)
 *       host
 *       authcode
 *     }
 *
 *     loginOpts {
 *       accountId    (required)
 *       host
 *     }
 *
 *     opts {
 *       q            (required)
 *       authcode
 *       args
 *       namedParams
 *       form         form-element | FormData
 *       format       json | json-easy
 *       mode
 *     }
 */


(function (window) {

    // create properly formatted role name from account number and role-type
    //
    function roleName(accountId, roleType) {
        var numStr = '000000000' + accountId;
        return roleType.substr(0, 1) + numStr.substr(numStr.length - 10, 10);
    }

    /*
     Return API type for data item.

     return value is one of STRING, NUMBER, DATE, NONE, DATETIME, TIME
     */
    function apiType(d) {

        switch (typeof d) {

            case 'number':
                return 'NUMBER';
            case 'object':
                if ($.type(d) == 'date')
                    return 'DATETIME';
                else if ($.type(d) == 'null')
                    return 'NONE';
                else
                    return 'STRING';
            case 'undefined':
                return 'NONE';

            default:
                return 'STRING'
        }
    }

    // create xmlHttpRequest object
    //
    function getRequestObject() {
        for(var a=0; a<4; a++) {
            try {                  // try
                return a               // returning
                    ? new ActiveXObject([ , "Msxml2", "Msxml3", "Microsoft" ][a] + ".XMLHTTP")
                    : new XMLHttpRequest
            }
            catch(e){}           // ignore each when it fails.
        }
    }

    // send request via XmlHttpRequest object, give response to callback
    //
    function doXhrRequest(url, data, callback, errback) {

        var xhr = getRequestObject();
        xhr.addEventListener("error", errback);
        xhr.addEventListener("load", callback);
        xhr.open(data ? "POST" : "GET", url);
        xhr.send(data ? data : null);
        return xhr;
    }

    // create a connection object
    //
    function Connection(connOpts) {

        var accountId = connOpts.accountId,
            roleType = connOpts.roleType.substr(0, 1),
            host = connOpts.host || 'www.rdbhost.com',
            authcode = connOpts.authcode,
            wsurl = 'wss://' + host + '/wsdb/' + roleName(accountId, roleType),
            xhrurl = 'https://' + host + '/db/' + roleName(accountId, roleType),
            liurl = 'https://' + host + '/accountlogin/00' + accountId,
            requestHandlers = {},
            requestIdCtr = 0,
            errorHandler = new Jvent(),
            inboundHandler = new Jvent(),
            loginMgr = Login({'accountId': accountId, host: host}),
            undefined, conn, sendQueue;

        // _connect opens websocket connection and installs handlers on it
        //
        function _connect(url) {

            sendQueue = [];
            try {
                conn = new WebSocket(url);
                if (authcode) {
                    var wsInitializer = {'format': 'json-easy', 'authcode': authcode},
                        wsInit = JSON.stringify(wsInitializer);
                    sendQueue.push(wsInit);
                }
            }
            catch (e) {
                return undefined;
            }
            conn.onmessage = function (event) {

                var msg = JSON.parse(event.data),
                    rId, _r, resolve, reject, retryWithAuthcode;

                // filter for requested data, handle per-request
                if ( msg['request-id'] ) {
                    rId = msg['request-id'];
                    if ( rId in requestHandlers ) {
                        _r = requestHandlers[rId];
                        resolve = _r[0]; reject = _r[1]; retryWithAuthcode = _r[2];
                        delete requestHandlers[rId];

                        handleResponseData(msg, resolve, reject, retryWithAuthcode);
                    }
                    else
                        console.log('request-handler not found for '+rId);
                }
                else {
                    // send non-requested data to onInbound
                    inboundHandler.emit(msg);
                }
            };
            conn.onopen = function (event) {
                while (sendQueue.length) {
                    conn.send(sendQueue.pop())
                }
                sendQueue = false;
            };
            conn.onclose = function (event) {
                sendQueue = [];
                _connect(url);
            }
        }
        _connect(wsurl);

        // handle processing of response data, including calling of promise.resolve or promise.reject
        //
        function handleResponseData(msg, resolve, reject, retryWithAuthcode) {

            if ( msg['status'][0] === 'error' ) {

                // check for whitelist errors
                if (msg['error'][0] === 'rdb02') {

                    var p2 = loginMgr.loginByForm()
                        .then(function(roleObj) {
                            retryWithAuthcode(roleObj.authcode)
                        })
                        .catch(function(err) {
                            reject(err);
                            errorHandler.emit('all', msg);
                        });
                }
                else {
                    reject(msg['error']);
                    errorHandler.emit('all', msg);
                }
            }
            // 'incomplete' and 'complete' result-sets are handled as success
            //  perhaps 'incomplete' should be an error
            else {
                resolve(msg);
            }
        }

        // send request to server via XmlHttpRequest object, and url
        //
        function xhrPostAsync(url, formData) {

            return new Promise(function (resolve, reject) {

                function retryWithAuth(authcode) {
                    formData.append('authcode', authcode);
                    doXhrRequest(url, formData, onHttpSuccess, onHttpFail);
                }

                function onHttpSuccess() {
                    try {
                        var data = JSON.parse(this.responseText);
                        handleResponseData(data, resolve, reject, retryWithAuth);
                    }
                    catch(e) {}
                }
                function onHttpFail(err) {
                    reject(err);
                    errorHandler.emit('all', err);
                }

                doXhrRequest(url, formData, onHttpSuccess, onHttpFail);
            });
        }

        // handle a server request via the websocket connection
        //
        function request_ws(opts) {

            return new Promise(function(resolve, reject) {

                function retry(authcode) {
                    opts['authcode'] = authcode;
                    var body = JSON.stringify(opts);

                    requestHandlers[requestIdCtr] = [resolve, reject, function(){}];
                    if (sendQueue !== false) {
                        sendQueue.push(body);
                    }
                    else {
                        conn.send(body);
                    }
                }

                if ( opts.form )
                    return reject('-', 'forms not permitted in request_ws');

                requestIdCtr += 1;
                opts['request-id'] = requestIdCtr;
                var body = JSON.stringify(opts);

                requestHandlers[requestIdCtr] = [resolve, reject, retry];

                if (sendQueue !== false) {
                    sendQueue.push(body);
                }
                else {
                    conn.send(body);
                }
            });
        }


        // handle a server request via direct http request
        //
        function request_xhr(opts) {

            try {

                var formData = opts.form,
                    num, argNm, typName, typ;

                // ensure we have a FormData object, capturing form if provided
                if ( ! formData )
                    formData = new FormData();
                else if ( ! formData.append )
                    formData = new FormData(formData);

                // add provided args list to formData, naming as necessary
                if ( opts.args ) {
                    for (var i=0; i<opts.args.length; i+=1) {

                        num = '00'+ i; num = num.substr(num.length-3,3);
                        argNm = 'arg'+num;
                        formData.append(argNm, opts.args[i]);
                        typ = apiType(opts.args[i]);
                        typName = 'argtype'+num;
                        formData.append(typName, typ);
                    }
                }

                // copy provided namedParams to formData
                if ( opts.namedParams ) {
                    for ( var k in opts.namedParams ) {
                        if ( opts.namedParams.hasOwnProperty(k) ) {

                            argNm = 'arg:'+k;
                            formData.append(argNm, opts.namedParams[k]);
                            typ = apiType(opts.namedParams[k]);
                            typName = 'argtype:'+k;
                            formData.append(typName, typ);
                        }
                    }
                }

                // copy various other options to formData
                if ( opts.authcode || connOpts.authcode ) {
                    formData.append('authcode', opts.authcode || connOpts.authcode);
                }
                if ( opts.q ) {
                    formData.append('q', opts.q);
                }
                if ( opts.mode ) {
                    formData.append('mode', opts.mode);
                }
                formData.append('format', opts.format || connOpts.format || 'json-easy');
            }
            catch(e) {
                console.log('error preparing ajax' + e);
            }

            // make request, return promise
            return xhrPostAsync(xhrurl, formData);
        }


        // return an object bearing properties for connection functionality
        //
        return {

            'execute': function (opts) {
                if ( opts.form )
                    return request_xhr(opts);
                else
                    return request_ws(opts);
            },

            // event handlers are just pass-through
            //
            'onError': errorHandler.on.bind(errorHandler),
            'offError': errorHandler.off.bind(errorHandler),
            'onInbound': inboundHandler.on.bind(inboundHandler),
            'offInbound': inboundHandler.off.bind(inboundHandler),

            // expose some websocket properties
            //
            'readyState': function() {
                return conn.readyState
            },
            'close': function() {
                return conn.close.apply(conn, arguments);
            }
        };
    }

    window.RdbhostConnection = Connection;

    function _login(url, formData) {

        return new Promise(function (resolve, reject) {

            function onHttpSuccess() {
                try {
                    var data = JSON.parse(this.responseText);
                    if ( data.status[0] === 'error' )
                        reject(data.error);
                    else {
                        data.records.rows.some(function(v, i) {
                            if (v.role.substr(0, 1).toLowerCase() === 's') {
                                resolve(v);
                                return true;
                            }
                            return false;
                        });
                    }
                }
                catch(e) {}
            }
            function onHttpFail(err) {
                reject(err);
            }

            doXhrRequest(url, formData, onHttpSuccess, onHttpFail);
        });
    }

    // loginFromForm - login, taking data from form
    //
    function loginFromForm(url, form) {

        var formData = new FormData(form);
        return _login(url, formData);
    }

    // login - login using provided parameters.
    //
    function login(url, eml, passwd) {
        var fD = new FormData();
        fD.append('arg:email', eml);
        fD.append('arg:password', passwd);
        return _login(url, fD);
    }

    // loadLoginForm - reads login-dialog template file from disk, appends
    //   it to the DOM, and hides it.
    //   returns Promise only for sequencing, no content is provided to chain.
    //
    function loadLoginForm() {

        var url = 'login_form.tpl.html';

        return new Promise(function (resolve, reject) {

            function onHttpSuccess() {
                resolve(this.responseText);
            }
            function onHttpFail(err) {
                reject(err);
            }

            doXhrRequest(url, null, onHttpSuccess, onHttpFail);
        });
    }

    function Login(loginOpts) {

        var accountId = loginOpts.accountId,
            host = loginOpts.host || 'www.rdbhost.com',
            liurl = 'https://' + host + '/accountlogin/00' + accountId,

            TIMEOUT = 8000,
            authcode, toHandle, loginFormFragment, emailCached;

        function emailPasswordForm(opts) {

            if (!opts) opts = {};
            var formProvider;
            if (loginFormFragment) {
                formProvider = Promise.resolve(loginFormFragment.cloneNode(true));
            }
            else {
                formProvider = loadLoginForm().then(function(html) {

                    var div = document.createElement('div');
                    div.innerHTML = html;
                    var frag = document.createDocumentFragment();
                    frag.appendChild(div.firstElementChild);
                    loginFormFragment = frag;
                    return loginFormFragment.cloneNode(true);
                })
            }

            return formProvider
                .then(function(frag) {
                    document.body.appendChild(frag.cloneNode(true));
                    var div = document.getElementById('rdbhost-super-login-form');
                    if (emailCached || opts.email)
                        div.getElementsByTagName('input').email.value = emailCached || opts.email;
                    return div;
                })
                .then(function(div) {
                    return new Promise(function(resolve, reject) {

                        function forHandler(evt) {
                            evt.stopPropagation();
                            evt.preventDefault();
                            sub.onclick = x.onclick = null;
                            document.body.removeChild(div);
                        }

                        var sub = document.getElementById('rslf-submit');
                        sub.onclick = function(evt) {
                            forHandler(evt);
                            var inputs = div.getElementsByTagName('input');
                            emailCached = inputs.email.value;
                            resolve([inputs.email.value, inputs.password.value]);
                        };

                        var x = div.getElementsByClassName('cancel')[0];
                        x.onclick = function(evt) {
                            forHandler(evt);
                            reject(['-', 'cancelled']);
                        }
                    })
                })
        }

        function rawLogin(eml, pw) {
            return login(liurl, eml, pw)
                .then(function(roleItem) {
                    authCode(roleItem.authcode);
                    return roleItem;
                });
        }

        function authCode() {
            if (arguments.length > 0) {
                authcode = arguments[0];
                if (toHandle)
                    toHandle.cancel();
                toHandle = setTimeout(function() {
                    authcode = undefined;
                    toHandle = undefined;
                }, TIMEOUT)
            }
            return authcode;
        }

        return {

            // login
            //
            'login': rawLogin,

            // get email and password through presentation of form
            //
            'emailPasswdForm': emailPasswordForm,

            // get authcode from server using email and password from form presentation.
            //
            'loginByForm':  function(opts) {

                if ( !opts ) opts = {};
                return emailPasswordForm(opts)
                    .then(function(emlPw) {
                        var email = emlPw[0], passwd = emlPw[1];
                        return rawLogin(email, passwd)
                    })
            },

            // get or set authcode
            'authcode': authCode

        }
    }
    window.RdbhostLogin = Login;

})(window);

