/*
 *  Rdbhost database access module, Version 2
 *
 *
 *
 *  This version relies on web-sockets, and should only be used where you are confident your user base has
 *    html5 browsers.
 *
 *
 *  It has one dependency, on Bluebird promise library.
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

    // create a connection object
    //
    function Connection(connOpts) {

        var accountId = connOpts.accountId,
            roleType = connOpts.roleType.substr(0, 1),
            host = connOpts.host || 'www.rdbhost.com',
            authcode = connOpts.authcode,
            url = 'wss://' + host + '/wsdb/' + roleName(accountId, roleType),
            sendQueue = [],
            requestHandlers = {},
            requestIdCtr = 0,
            errorHandler = new Jvent(),
            inboundHandler = new Jvent(),
            undefined, conn;

        // _connect opens websocket connection and installs handlers on it
        //
        function _connect(url) {

            try {
                conn = new WebSocket(url);
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

                        if ( msg['status'][0] === 'error' ) {
                            reject(msg);
                        }
                        // 'incomplete' and 'complete' result-sets are handled as success
                        //  perhaps 'incomplete' should be an error
                        else {
                            resolve(msg);
                        }
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
        _connect(url);

        function request_ws(opts) {

            return new Promise(function(resolve, reject) {

                if ( opts.form )
                    throw new Error('forms not permitted in request_ws');

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


        // return an object bearing properties for connection functionality
        //
        return {

            'execute': function (opts) {
                // todo - add test and request_xhr
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
            'readyState': function() { return conn.readyState },
            'close': function() { return conn.close.apply(conn, arguments) }
        };
    }

    window.RdbhostConnection = Connection;


})(window);

