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
 *      getGet({opts}) -> str
 *
 *      getPost({opts}) -> str, obj
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
 *    class Util({utilOpts})
 *
 *      loginOpenId(id) -> id, code
 *
 *      login(email, passwd) -> str (authcode)
 *
 *   ----------------------------------------------------------------
 *
 *     connOpts {
 *       accountId  (required)
 *       roleType   (required)
 *       host
 *       authcode
 *     }
 *
 *     utilOpts {
 *       accountId   (required)
 *       host
 *     }
 *
 *     opts {
 *       q           (required)
 *       authcode
 *       args
 *       namedParams
 *       form         form-element|FormData
 *       format       json|json-easy
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

    function handleResponseData(msg, resolve, reject) {

        if ( msg['status'][0] === 'error' ) {

            // check for whitelist errors
            if (msg['error'][0] === '') {

                var p2 = getLoginEmailAndPassword()
                        .then(function(EmlNPw) {
                            var eml = emlNPw[0], pw = emlNPw[1];
                        // todo - login here, get authcode, continue chain
                        });
                resolve(p2)
            }
            else {
                reject(msg['error']);
                // todo - add code to emit on errorHandler also
            }
        }
        // 'incomplete' and 'complete' result-sets are handled as success
        //  perhaps 'incomplete' should be an error
        else {
            resolve(msg);
        }
    }

    function xhrPostAsync(url, formData) {

        return new Promise(function (resolve, reject) {

            function onHttpSuccess() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    handleResponseData(data, resolve, reject);
                }
                catch(e) {}
            }
            function onHttpFail(err) {
                reject(err);
            }

            // var xhr = new XMLHttpRequest;
            var xhr = getRequestObject();
            xhr.addEventListener("error", onHttpFail);
            xhr.addEventListener("load", onHttpSuccess);
            xhr.open("POST", url);
            xhr.send(formData);
        });
    }

    function _login(url, formData) {

        return new Promise(function (resolve, reject) {

            function onHttpSuccess() {
                try {
                    var data = JSON.parse(xhr.responseText);
                    if ( data.status[0] === 'error' )
                        reject(data.status);
                    else
                        resolve(data.roles.s);
                }
                catch(e) {}
            }
            function onHttpFail(err) {
                reject(err);
            }

            // var xhr = new XMLHttpRequest;
            var xhr = getRequestObject();
            xhr.addEventListener("error", onHttpFail);
            xhr.addEventListener("load", onHttpSuccess);
            xhr.open("POST", url);
            xhr.send(formData);
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
        fD.append('email', eml);
        fD.append('password', passwd);
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
                var div = document.createElement('div');
                div.innerHTML = xhr.responseText;
                document.body.appendChild(div);
                resolve(true);
            }
            function onHttpFail(err) {
                reject(err);
            }

            // var xhr = new XMLHttpRequest;
            var xhr = getRequestObject();
            xhr.addEventListener("error", onHttpFail);
            xhr.addEventListener("load", onHttpSuccess);
            xhr.open("GET", url);
            xhr.send(null);
        });
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
                    rId, _r, resolve, reject;

                // filter for requested data, handle per-request
                if ( msg['request-id'] ) {
                    rId = msg['request-id'];
                    if ( rId in requestHandlers ) {
                        _r = requestHandlers[rId];
                        resolve = _r[0]; reject = _r[1];
                        delete requestHandlers[rId];

                        handleResponseData(msg, resolve, reject);
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


        function request_ws(opts) {

            return new Promise(function(resolve, reject) {

                if ( opts.form )
                    return reject('-', 'forms not permitted in request_ws');

                requestIdCtr += 1;
                opts['request-id'] = requestIdCtr;
                var body = JSON.stringify(opts);

                requestHandlers[requestIdCtr] = [resolve, reject];

                if (sendQueue !== false) {
                    sendQueue.push(body);
                }
                else {
                    conn.send(body);
                }
            });
        }


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
            'onError': errorHandler.on,
            'offError': errorHandler.off,
            'onInbound': inboundHandler.on,
            'offInbound': inboundHandler.off,

            // expose some websocket properties
            //
            'readyState': function() {
                return conn.readyState
            },
            'close': function() {
                return conn.close.apply(conn, arguments);
            },

            // login
            //
            'login': function(eml, pw) {
                return login(liurl, eml, pw);
            }
        };
    }

    window.RdbhostConnection = Connection;


})(window);

