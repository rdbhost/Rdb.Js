/*

 jquery.rdbhost.js

 A jquery plugin to access PostgreSQL databases on Rdbhost.com

 requires a (free) account at www.rdbhost.com to be useful.

 this module includes a class 'SQLEngine' for the database connection, and
 that class can be used by itself, aside from the plugins.  jQuery 1.4+
 is required, even when using the connection class without the plugin.


 the module adds four functions and three methods to the jQuery namespace.

 The four functions are $.rdbHostConfig, $.postData, $.eachRecord, and
 $.postFormData.  The three methods are $.fn.populateTable,
 $.fn.populateForm, and $.fn.datadump.  There is also a $.postData alias
 to $.withResults

 $.rdbHostConfig takes an options object, and makes those options default for
 all subsequent functions and methods.

 $.postData sends a query to the server, receives the data, and calls
 a callback with the received data.  Similar to jQuery's $.ajax()

 $.eachRecord is like $.postData, in that it gets data from the server,
 but it extracts the rows from the data structure, and calls an eachrec
 callback for each record.  Each record is a javascript object, with a
 named attribute for each field.

 $.postFormData takes a form as input, submits that form to the server,
 receives the data returned, and provides it to the callback.
 The form fields must be named arg000, arg001, etc

 R.loginOpenID provides various services related to OpenID logins.  It will
 prep the form prior to submission, and handles hash values and cookies
 upon return from login process.  Call it in both the openId submit form,
 and in the follow up form.

 Form fields
 The form *must* include either a 'q' or a 'kw' field.  It may also include
 'arg###', or 'argtype###' fields.  Argument fields are numbered like
 'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'.. ,
 if provided, must correspond to arg fields. Argument fields may be file
 fields.

 The 'kw' field value allows you to invoke a query that is stored in the
 'lookup.queries' table on the  server.  See website documentation for
 details.

 $.fn.populateTable sends a query to the server, receives the data, and populates
 an html table with it.  If the element provided is not a table, a new
 table is inserted in it; if the element is an empty table, it is expanded
 with new rows, one per record, and if the table has a prototype row, that
 row is duplicated once per record, and the record data is placed in
 td elements based on class name matches. (a field named 'firstName' would
 put its value in a table cell like '<td class="firstName">').  A cell
 can have multiple classes, so adding field-name classes should not interfere
 with styling.

 $.fn.populateForm sends a query to the server, receives the data, selects the
 first record, and populates a form with it.  It attempts to match each field
 name to an input field with matching id, and then attempts to match an input
 field with matching class-name.

 $.fn.datadump is a diagnostic-aid that puts a formatted json-string of
 the data into the selected html elements.  It allows you to verify the
 data retrieval functionality before doing (much) html work.

 */

/*
/*
 logging
 */
function consoleLog(msg) {
  window.console.log(msg);
}

window.easyXDM = window.easyXDM || null;

// namespace for Rdbhost functions
window.Rdbhost = {};


(function ($, window) {

  var R = window.Rdbhost; // convenient 1 letter namespace name

  // function to load easyXDM on-demand during run-time
  //
  var easyXDMPath = 'https://www.rdbhost.com/js/easyxdm/easyXDM.min.js';
  function lateLoadEasyXDM(fn) {

    var yn = window.yepnope || (window.modernizr && window.modernizr.load) || null;
    if (yn) {
      yn({
        load: easyXDMPath,
        // callback: fn,
        complete: fn
      })
    }
    else {

      console.warn('easyXDM library not loaded.');
      throw new Error('easyXDM library not loaded');
    }
  }

  function hasCORS() {
    return !!(window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest())
  }

  // isolate each easyXDM in its own namespace
  var CONNECTIONS = {};

  function createConnection(username, domain) {

    var indexName = easyXDM.Debug ? 'index.debug.html' : 'index.html',
        receiverName = easyXDM.Debug ? 'receiver_debug.html' : 'receiver.html';

    var uid = username.substring(1),
        REMOTE = 'https://' + domain;

    assert(!CONNECTIONS[uid], 'repeated namespace creation');
    CONNECTIONS[uid] = {};

    // ajaxRpc object is created one time, used by .SQLEngine.query() method
    CONNECTIONS[uid].ajaxRpc = new easyXDM.Rpc({
      local: "/static/~/easyxdm/name.html".replace('~', uid),
      swf: "/js/easyxdm/easyxdm.swf",
      remote: REMOTE + ("/static/~1/easyxdm/cors/~2".replace('~1', uid).replace('~2', indexName)),
      remoteHelper: REMOTE + ("/static/~/easyxdm/name.html".replace('~', uid)),
      onReady: function () {
        CONNECTIONS[uid].ajaxRpcReady = true;
      }
    }, {
      remote: {
        request: {}
      }
    }
    );

    // remote rpc created for use by .queryByForm() method
    CONNECTIONS[uid].remoteRpc = new easyXDM.Rpc({
      remote: REMOTE + "/static/~1/~2".replace('~1', uid).replace('~2', receiverName),
      swf: REMOTE + "/js/easyxdm/easyxdm.swf",
      remoteHelper: REMOTE + "/static/~/easyxdm/name.html".replace('~', uid),
      onReady: function () {
        CONNECTIONS[uid].remoteRpcReady = true;
      }
    }, {
      local: {
        returnResponse: function (response) {
          CONNECTIONS[uid].handler(response);
        }
      },
      remote: {
        createTargetIframe: {}
      }
    }
    );

    return uid;
  }

  // create function to make request using previously prepared eastXDM connection
  //
  var easyxdm_ajaxer_creator = function (easyXDMAjaxHandle) {

    return function (url, data, defer, plainTextJson) {

      CONNECTIONS[easyXDMAjaxHandle].ajaxRpc.request({
        url: url,
        method: "POST",
        data: data
      },

          function (resp) {
            // success handler
            if (!plainTextJson) {
              try {
                resp.data = JSON.parse(resp.data);
              }
              catch (e) {
                defer.reject(['json-parse', resp.data]);
                return;
              }
              if (resp.data.status[0] == 'error') {
                defer.reject([resp.data.error[0], resp.data.error[1]]);
              }
              else {
                defer.resolve(resp.data);
              }
            }
            else {
              defer.resolve(resp);
            }
          },

          function (errObj) {
            // error handler
            defer.reject([errObj.message, errObj.data]);
          }
      );
    }
  };

  // make request using jQuery's ajax function
  //
  var cors_ajaxer = function (url, data, defer, plainTextJson) {

      // remove undefined elements from data object
      $.each(['mode', 'kw', 'q'], function(i, v) {
          if ( typeof(data[v]) == 'undefined' )
              delete data[v];
      });

    // super callback that checks for server side errors, calls errback
    //  where appropriate
    function qCallback(json) {

      if (json.status[0] === 'error') {
        defer.reject([json.error[0], json.error[1]]);
      }
      else {
        defer.resolve(json);
      }
    }

    function qErrback(xhr, stat, exc) {

      defer.reject(['ajax', stat]);
    }

    // use jQuery ajax call to submit to server
    //
    $.ajax({
      type: "POST",
      url: url,
      data: data,
      dataType: plainTextJson ? 'text' : 'json',
      success: qCallback,
      error: qErrback
    });
  };

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

  /*
   *  consolidates positional args, cookies, and namedParams all into one params object
   *
   *    args are added as 'arg###', named params as 'arg:xxx', and cookies become named params
   *
   *    @param params: object receives all consolidated data
   *    @param args: list of positional arguments
   *    @param namedParams: object of names and values
   *
   *    @return: nothing
   */
  function consolidateParams(params, args, namedParams) {

    var nm, typNm, num;

    // if params are provided, convert to named form 'arg000', 'arg001'...
    for (var i = 0; i < args.length; i += 1) {

      num = '000' + i;
      nm = 'arg' + num.substr(num.length - 3);
      params[nm] = args[i];
      typNm = 'argtype' + num.substr(num.length - 3);
      params[typNm] = apiType(args[i]);
    }

    // if cookie tokens found in sql, convert to namedParams
    var ckTestRe = /%\{([^\}]+)\}/;

    while (ckTestRe.test(params.q)) {

      var ckArray = ckTestRe.exec(params.q),
          ck = ckArray[0],
          ckV = ckArray[1],
          newNm = '_ck_' + ckV,
          ckValue = $.cookie(ckV);
      params.q = params.q.replace(ck, '%(' + newNm + ')');
      namedParams[newNm] = ckValue;
    }

    // if keyword params are provided, convert to named form 'arg:name'.
    for (var kw in namedParams) {
      if (namedParams.hasOwnProperty(kw)) {

        nm = 'arg:' + kw;
        params[nm] = namedParams[kw];
        typNm = 'argtype:' + kw;
        params[typNm] = apiType(namedParams[kw]);
      }
    }
  }


  /*
   *  SQL Engine that uses form for input, and hidden iframe for response
   *   handles file fields
   */
  function SQLEngine(dbRole, authcode, domain) {

    this.prototype = this.prototype || {};
    this.version = this.prototype.version = 'jquery.rdbhost.js 1.2';

    // store engine config info
    var remote = 'https://' + domain,
        easyXDMAjaxHandle;

    if (!domain) {
      domain = 'www.rdbhost.com';
    }

    // for setting auth info later
    this.setUserAuthentication = function (roleName, aCode) {

      dbRole = roleName;
      authcode = aCode;
      var that = this;

      if (!hasCORS()) {

        if (easyXDM) {

          easyXDMAjaxHandle = dbRole.substring(1);
          if (CONNECTIONS[easyXDMAjaxHandle] === undefined) {
            createConnection(dbRole, domain);
          }
        }
        else {

          lateLoadEasyXDM(function () {
            that.setUserAuthentication(roleName, aCode);
          });
        }
      }
    };

    this.hasUserAuthentication = function () {

      return dbRole && dbRole.length && authcode && authcode.length;
    };

    this.userName = function () {
      return dbRole;
    };

    if (dbRole && dbRole.length > 2) {
      this.setUserAuthentication(dbRole, authcode);
    }

    // return appropriate /db/ url for action attribute in form
    this.getQueryUrl = function (altPath) {
      if (altPath === undefined) {
        assert(dbRole, 'no username in sqlEngine');
        assert(dbRole.length, 'username is null in sqlEngine');
        altPath = '/db/' + dbRole;
      }
      return remote + altPath;
    };

    // return appropriate /accountlogin/ url for action attribute in form
    this.getLoginUrl = function () {

      assert(dbRole, 'no username in sqlEngine');
      assert(dbRole.length > 1, 'username is too short in sqlEngine');
      return this.getQueryUrl('/accountlogin/' + dbRole.substring(1));
    };

    // return appropriate /accountlogin/train/ url for action attribute in form
    this.getTrainingUrl = function () {

      assert(dbRole, 'no username in sqlEngine');
      assert(dbRole.length > 1, 'username is too short in sqlEngine');
      return this.getQueryUrl('/accountlogin/train/' + dbRole.substring(1));
    };

    /*
     parms is object containing various options

     callback : function to call with data from successful query
     errback : function to call with error object from query failure

     q : the query string itself

     args : array of arguments (optional), must correspond with %s tokens
       in query
     namedParams : an object containing arguments, by name. Reference
       in query with tokens like %(name)

     format : 'json' or 'json-easy'
     plainTextJson : true if JSON parsing to be skipped, instead
       returning the JSON plaintext

     repeat: how many repetitions of query to submit

     */
    this.query = function (parms) {

      var that = this;
      return _query(parms, function () {
        return that.getQueryUrl()
      });
    };

    function _query(parms, urlFunc) {

      var args = parms.args || [],
          namedParams = parms.namedParams || {},
          defer = $.Deferred(),
          formatType = 'json',
          fmt = parms.format || '',
          that = this;

      var data = {
        q: parms.q,
        kw: parms.kw,
        format: ~fmt.toLowerCase().indexOf('easy') ? formatType + '-easy' : formatType,
        mode: parms.mode,
        authcode: parms.authcode || authcode
      };
      if (parms['super-authcode'])
        data['super-authcode'] = parms['super-authcode'];

      // attach provided handlers (if any) to deferred
      //
      var deferOut = defer.then(parms.callback || null, parms.errback || null);

      // consolidate args and namedparams, and cookies, into data
      consolidateParams(data, args, namedParams);

      // if repeat value provided, add
      if (parms.repeat)
        data.repeat = parms.repeat;

      // calculate url
      var url = urlFunc(),
          ajaxer;

      // set ajaxer function to jQuery $.ajax based func if CORS ability present
      //  else set to the easyXDM version
      //
      if (hasCORS()) {

        ajaxer = cors_ajaxer;
      }
      else {
        if (easyXDM) {

          ajaxer = easyxdm_ajaxer_creator(easyXDMAjaxHandle);
        }
        else {

          lateLoadEasyXDM(function () {

            ajaxer = easyxdm_ajaxer_creator(easyXDMAjaxHandle);
          });
        }
      }

      ajaxer(url, data, defer);

      // return promise object from deferred, so client can add additional handlers
      //  as necessary
      return deferOut.promise();
    }

    /*
     parms is just like for query method, but callback gets row array and
       header array, not whole data structure.

     an additional param is 'incomplete', a function that is called
       (with rows and header) when data set is truncated by 100 record limit
     */
    this.queryRows = function (parms) {

      var opts = $.extend({}, parms),
          callback = parms.callback,
          incomplete_callback = parms.incomplete || callback;
      delete opts.callback;
      delete opts.incomplete;

      function cb(json) {
        var rows = json.records.rows || [],
            status = json.status[0],
            header = json.records.header || [];
        if (status === 'complete') {
          callback(rows, header);
        }
        else if (status === 'incomplete') {
          incomplete_callback(rows, header);
        }
      }

      opts.callback = cb;
      return this.query(opts);
    };


    // function to clean up entry forms - used by .queryByForm method
    function cleanup_form($form, target, action) {

      $form.find('.to-remove-later').remove();
      $form.attr('target', target);
      $form.attr('action', action);
    }

    // to add hidden field to form - used by .queryByForm method
    function add_hidden_field($form, nm, val) {

      var fld = $('<input type="hidden" class="to-remove-later" />');
      fld.attr('name', nm).val(val);
      $form.append(fld);
    }

    /* parms is object containing various options

     formId : the id of the form with the data

     callback : function to call with data from successful query
     errback : function to call with error object from query failure

     plainTextJson : true if JSON parsing to be skipped, instead
     returning the JSON plaintext

     call this prior to form click, not from click handler.
     */
    this.queryByForm = function (parms0) {

      var parms = $.extend({}, parms0),
          formId = parms.formId,
          plainTextJson = parms.plainTextJson,
          defer = $.Deferred(),
          formatType = 'json-exdm',
          authCode = parms.authcode || authcode,
          that = this;

      if (!easyXDM) {

        var dfr2 = $.Deferred();
        lateLoadEasyXDM(function () {
          var dfr3 = that.queryByForm(parms);
          dfr3.then(function (resp) {
            dfr2.resolve(resp);
          },
          function (err) {
            dfr2.reject(err);
          })
        });
        return dfr2.promise();
      }

      easyXDMAjaxHandle = dbRole.substring(1);
      if (CONNECTIONS[easyXDMAjaxHandle] === undefined) {
        createConnection(dbRole, domain);
      }
      if (!CONNECTIONS[easyXDMAjaxHandle].remoteRpcReady) {

        setTimeout(function () {
          var dfr3 = that.queryByForm(parms);
          dfr3.then(function (resp) {
            defer.resolve(resp);
          },
              function (err) {
                defer.reject(err);
              }
          )
        }, 25);

        return defer.promise();
      }

      // internal callback function
      function cBack(response) {

        if (!plainTextJson) {

          try {
            response = JSON.parse(response);
          }
          catch (e) {
            delete CONNECTIONS[easyXDMAjaxHandle].handler;
            defer.reject(['json parse', response]);
            return;
          }

          if (response.status[0] === 'error') {
            delete CONNECTIONS[easyXDMAjaxHandle].handler;
            defer.reject(response.error);
          }
          else {
            delete CONNECTIONS[easyXDMAjaxHandle].handler;
            defer.resolve(response);
          }
        }

        else {
          delete CONNECTIONS[easyXDMAjaxHandle].handler;
          // plaintext response
          defer.resolve(response);
        }
      }

      CONNECTIONS[easyXDMAjaxHandle].handler = cBack;

      var fmt = parms.format || '';
      parms.format = ~fmt.toLowerCase().indexOf('easy') ? formatType + '-easy' : formatType;
      assert(~parms.format.indexOf('xdm'), 'bad format ' + parms.format);

      // get form, return if not found
      var $form = $('#' + formId);
      if ($form.length < 1) {
        return false;
      }

      $form.attr('target', '');
      CONNECTIONS[easyXDMAjaxHandle].remoteRpc.createTargetIframe(

          function (targettag) {

            // init vars
            var dbUrl = that.getQueryUrl();

            // save vals
            var target = $form.attr('target'),
                action = $form.attr('action');

            // put password into form
            add_hidden_field($form, 'authcode', authCode);
            // set format, action, and target
            add_hidden_field($form, 'format', parms.format);

            $form.attr('target', targettag);
            $form.attr('action', dbUrl);

            // set super-authcode for preauth whitelist
            if ( parms['super-authcode'] )
                add_hidden_field($form, 'super-authcode', parms['super-authcode']);
          }
      );

      // set errback on deferred
      var deferOut = defer.then(parms.callback || null, parms.errback || null);

      // return promise, so client can add callbacks/errbacks as required
      //
      return deferOut.promise();
    };


    /*
     parms is object containing various options

     email :
     password :

     callback : function to call with data from successfull query
     errback : function to call with error object from query failure

     plainTextJson : true if JSON parsing to be skipped, instead
     returning the JSON plaintext

     returns: promise
     */
    this.loginAjax = function (_parms) {

      var parms = $.extend(true, {}, _parms),
          email = parms.email,
          password = parms.password,
          that = this;

      delete parms.email;
      delete parms.password;
      parms.namedParams = { email: email, password: password };
      parms.format = 'json-easy';

      return _query(parms, function () {
        return that.getLoginUrl();
      });
    };

    /*
      !!!!!! deprecated - do not use.              opts['dialog_title'] = 'Enter Account Login to Whitelist';
     var pSL = R.superLogin(opts);
     pSL.done(_rePost);
     pSL.fail(function(m) {
     p.reject(m);
     });

     */
    this.trainAjax = function (_parms) {

      var parms = $.extend(true, {}, _parms),
          email = parms.email,
          password = parms.password,
          that = this;

      delete parms.email;
      delete parms.password;
      parms.namedParams = { email: email, password: password };
      parms.format = 'json-easy';

      return _query(parms, function () {
        return that.getTrainingUrl();
      });
    }

  } // end of SQLEngine class

  // export SQLEgnine
  window.SQLEngine = SQLEngine;


  // default generic callbacks
  //
  function errback(err, msg) {
    var errCode = '-';

    try {
      errCode = err.toString()
    }
    catch (e) {
    }

    alert('<pre>' + errCode + ': ' + msg + '</pre>');
  }

  function dumper(json) {
    var str = JSON.stringify(json, null, 4);
    alert(str);
  }


  /*
   following section defines some jQuery plugins

   */

  //  configuration setting function
  //  saves defaults as attribute on the config function
  //
  var opts = {
    domain: 'www.rdbhost.com',
    mode: undefined,
    format: 'json-easy',
    userName: '',
    authcode: '',
    accountNumber: ''
  };

  var roleNameTest = /[sapr]\d{10}/;

  function roleName(acct, role) {
    return role.substring(0, 1).toLowerCase() + ("000000000" + acct).slice(-10);
  }
  R.role = function () {
    return roleName($.rdbHostConfig.opts.accountNumber, $.rdbHostConfig.opts.userName)
  };
  $.role = R.role;

  R.rdbHostConfig = function (parms) {

    var inp = $.extend({}, opts, parms || {});
    if (!inp.accountNumber && roleNameTest.test(inp.userName))
      inp.accountNumber = parseInt(inp.userName.substr(1), 10);

    $.rdbHostConfig.opts = inp;
  };

  $.rdbHostConfig = R.rdbHostConfig;

  function myExtend() {

    var args = Array.prototype.slice.call(arguments, 0),
        inp = args.reduce(function (prev, curr) {
          return $.extend(prev, curr);
        });

    if (roleNameTest.test(inp.userName))
      inp.accountNumber = parseInt(inp.userName.substr(1), 10);

    else
      inp.userName = roleName(inp.accountNumber, inp.userName);

    return inp;
  }

  /*
   postData - calls callback with json result object
     or errback with error object

   param q : query to get data

   param callback : function to call with json data
   param errback : function to call in case of error
   */
  R.postData = function (parms) {

    assert(arguments.length <= 1, 'too many parms to postData');
    var inp = myExtend({}, $.rdbHostConfig.opts, parms || {});

    try {

      var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
      var promise = sqlEngine.query(inp);
    }
    catch (e) {

      errback(e.name, e.message);
    }

    return promise; // return promise
  };

  $.postData = R.postData;

  /*
   eachRecord - calls 'eachrec' callback with each record,
     or errback with error object

   param q : query to get data

   param eachrec : function to call with each record
   param errback : function to call in case of error
   */
  R.eachRecord = function (parms) {

    assert(arguments.length <= 1, 'too many parms to eachRecord');
    assert(parms.eachrec, 'eachrec not provided');

    var eachrec = parms.eachrec;
    delete parms.eachrec;

    function cback(json) {

      for (var r in json.records.rows) {
        eachrec(json.records.rows[r]);
      }
    }

    parms.callback = cback;
    var promise = $.postData(parms);

    return promise;
  };

  $.eachRecord = R.eachRecord;


  /*
   postFormData should be called on a form BEFORE form is submitted.

   that: id of form, or id of form element
   param q : query to post data
   param kw : query-keyword to post data
   */
  R.postFormData = function (that, parms) {

    assert(arguments.length <= 2, 'too many parms to postFormData');
    var $form = $(that).closest('form'),
        inp = myExtend({}, $.rdbHostConfig.opts, parms || {});

    inp.formId = $form.attr('id');
    assert(inp.formId, 'form must have a unique id attribute');

    if (inp.q) {

      $form.find('#kw').remove();
      $form.find('#q').remove();
      $form.append($('<input type="hidden" id="q" name="q" >').val(inp.q));
    }

    if (inp.kw) {

      $form.find('#kw').remove();
      $form.find('#q').remove();
      $form.append($('<input type="hidden" id="kw" name="kw" >').val(inp.kw));
    }

    try {

      var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
      //delete inp.userName; delete inp.authcode; delete inp.domain;
      var promise = sqlEngine.queryByForm(inp);
    }
    catch (e) {

      errback(e.name, e.message);
    }

    return promise;
  };

  $.postFormData = R.postFormData;


  /*
   postData submits some data (in the options object) to the server
     and provides the response to callback.

   param q : query to post data
   param kw : query-keyword to post data
   */
  $.withResults = $.postData = R.postData;


  /*
   * getGET - creates URL for query that can be retrieved with ajax GET
   *
   * param options: usual options
   * return: string-url
   */
  R.getGET = function (inp) {

    assert(arguments.length <= 1, 'too many parms to getGET');
    var parms = myExtend({}, $.rdbHostConfig.opts, inp || {});

    // validate input
    if (parms.authcode === '-')
      delete parms.authcode;
    if (parms.authcode)
      throw new Error('authcode not permitted in GET');
    if (!parms.kw && !parms.q)
      throw new Error('need q or kw');

    // arguments for GET string
    var data = {
      format: ~(parms.format || '').toLowerCase().indexOf('easy') ? 'json-easy' : 'json'
    };

    // add additional data, as provided
    $.each(['kw', 'mode', 'q', 'repeat'], function (idx, el) {

      if (parms.hasOwnProperty(el) && parms[el])
        data[el] = parms[el];
    });

    // interpolate positional args and named params into 'data'
    consolidateParams(data, parms.args || [], parms.namedParams || {});

    // GET string parts
    var remote = 'https://' + parms.domain,
        path = '/db/' + parms.userName,
        argsList = $.param(data, false);

    return remote + path + '?' + argsList;
  };


  /*
   * getPOST - creates URL and params hash for query that can be retrieved with ajax POST
   *
   * param options: usual options
   * return: 2-element array [string-url, params-object]
   */
  R.getPOST = function (inp) {

    assert(arguments.length <= 1, 'too many parms to getPOST');
    var parms = myExtend({}, $.rdbHostConfig.opts, inp || {});

    // validate input
    if (parms.authcode === '-')
      delete parms.authcode;
    if (parms.userName.charAt(0) === 's' && !parms.authcode)
      throw new Error('super role needs authcode');
    if (!parms.kw && !parms.q)
      throw new Error('need q or kw');

    // arguments for GET string
    var data = {
      format: ~(parms.format || '').toLowerCase().indexOf('easy') ? 'json-easy' : 'json'
    };

    // add additional data, as provided
    $.each(['kw', 'mode', 'q', 'repeat', 'authcode'], function (idx, el) {

      if (parms.hasOwnProperty(el) && parms[el])
        data[el] = parms[el];
    });

    // interpolate positional args and named params into 'data'
    consolidateParams(data, parms.args || [], parms.namedParams || {});

    // POST string parts
    var remote = 'https://' + parms.domain,
        path = '/db/' + parms.userName;

    return {
      url: remote + path,
      data: data
    };
  };


  /*
   * getBin - creates URL that can be retrieved using src attribute (in img tag, say)
   *
   * param options: usual options
   * return: 2-element array [string-url, params-object]
   */
  R.getBin = function (inp) {

    assert(arguments.length <= 1, 'too many parms to getBin');
    var parms = myExtend({}, $.rdbHostConfig.opts, inp || {});

    // todo - implement this
  };


  /*
   * loginOpenId - handles login functionality, including processing auth info passed in
   *   the hash string, or auth info in cookie named 'OPENID_KEY'.
   *
   *   Creates login cookie of client chosen name, with auth key returned from rdbhost server.
   *   Calls the success function with (key, identifier), or failure function with (identifier).
   *   The identifier and key are a pair in the table auth.openid, and the key can be submitted
   *     with queries that join the auth.openid table for authentication of the query.
   *
   *   If provided a form#id, will prepare form with appropriate action line.
   *     bases url on www.rdbhost.com if on localhost, else uses same domain
   *
   *   The function takes an options object with the following options:
   *
   *   acctNum: account number of Rdbhost account - MANDATORY
   *
   *   callback: function of sig funct(key, identifier) -- default uses alert
   *   errback: function with sig funct(identifier)  -- default uses alert
   *
   *   cookieName: name of new cookie to receive key value  -- default LOGIN_KEY
   *   ignoreHash: set true to ignore url#hash value, and rely only on OPENID_KEY cookie  -- default false
   *
   *   loginForm: id of form to prepare -- default 'openidForm'
   *   returnPath: complete url or absolute path of page to end process at  -- default current page
   *
   *   offsiteHosting: indicate to library that static pages not on rdbhost. Uses 'www.rdbhost.com' for openid
   *      negotiation
   *
   */
  R.loginOpenId = function (inp) {

    /*
     * default values for each attribute
     *
     *   each can be overridden, only mandatory item is acctNum
     */
    var parms = {

      loginForm: 'null',
      returnPath: false,

      // default is to fail silently
      errback: function () {
      },

      cookieName: 'LOGIN_KEY',
      ignoreHash: false,
      userName: 'preauth',

      offsiteHosting: false
    };

    parms = myExtend({}, $.rdbHostConfig.opts, parms, inp);

    // get cookie, if available
    var loginCookie = $.cookie('OPENID_KEY');

    var ident, key;

    /*
     * function prepare form, creating action attribute
     */
    function prepareForm($inputForm, offsite) {

      if (parms.returnPath === false) {
        parms.returnPath = window.location.pathname;
        if (parms.returnPath.substr(0, 1) !== '/')
          parms.returnPath = '/' + parms.returnPath;
        var _hash = window.location.hash;
        if (_hash.substr(0, 1) === '#')
          _hash = _hash.substr(1);
        if (window.location.hash)
          parms.returnPath = parms.returnPath + '!!!' + _hash;
      }

      if (/localhost/i.test(window.location.hostname) || offsite) {

        parms.hostname = parms.domain;
        parms.returnPath = window.location.origin + parms.returnPath;
      }
      else {
        parms.hostname = window.location.hostname;
      }

      var acctNum = ('0000000000' + parms.userName);
      acctNum = acctNum.substr(acctNum.length - 10, 10);

      var action = 'https:' + '//' + parms.hostname + '/auth/openid/' + acctNum + '/one?' + parms.returnPath;
      $inputForm.attr('action', action);

      /*
       * add click handlers to host specific buttons
       */
      var $inputFld = $('[name="openidurl"]', $inputForm);
      $('#google', $inputForm).click(function (ev) {

        ev.stopPropagation();
        $inputFld.val('https://www.google.com/accounts/o8/id');
        $inputForm.submit();
      });

      $('#yahoo', $inputForm).click(function (ev) {

        ev.stopPropagation();
        $inputFld.val('https://me.yahoo.com');
        $inputForm.submit();
      });
    }

    /*
     *  function to extract ident and key from hash
     */
    function useHash() {

      var hashRe0 = new RegExp('#http[^#]{32,}'),
          hashRe1 = new RegExp('#[^/\! ]*%26[^/\! ]{32,}');

      if (window.location.hash) {

        var t0 = hashRe0.exec(window.location.hash),
            t1 = hashRe1.exec(window.location.hash),
            t = t0 || t1;

        if (t && t[0]) {

          var hash = decodeURIComponent(t[0]),
              hp = hash.split('&', 2);

          if (hp.length >= 2) {

            ident = hp[0];
            key = hp[1];

            if (ident.indexOf('#') === 0)
              ident = ident.substr(1);

            // sometimes changing has causes framework to re-init, so save login in cookie
            $.cookie(parms.cookieName, key);
            $.cookie('OPENID_KEY', ident + '&' + key);

            window.location.hash = window.location.hash.replace(t[0], '');

            return true;
          }
          else
            return false;
        }
        else
          return false;
      }
      else
        return false;
    }

    /*
     * function to extract ident and key from temporary auth cookie
     */
    function useCookie() {

      if (loginCookie) {
        var kp = loginCookie.split('&', 2);
        if (kp.length >= 2) {
          ident = kp[0];
          key = kp[1];
          $.cookie(parms.cookieName, key);
          return true;
        }
        else {
          return false;
        }
      }
      else
        return false;
    }

    /*
     *   start processing of available inputs
     */
    if (!parms.ignoreHash) {

      var hashSuccess = useHash(),
          errH = parms.errback || function (id) {
            alert(id)
          },
          ckSuccess;
      if (!hashSuccess) {
        ckSuccess = useCookie();
        if (!ckSuccess) {

          errH(ident);
        }
        else {
          parms.callback(key, ident);
        }
      }
      else {
        parms.callback(key, ident);
      }
    }
    else {
      ckSuccess = useCookie();
      errH = parms.errback || function (id) {
        alert(id)
      };
      if (!ckSuccess) {

        errH(ident);
      }
      else {
        parms.callback(key, ident);
      }
    }

    // prepare form for login try
    var $inputForm = $('#' + parms.loginForm);

    if ($inputForm.length) {
      prepareForm($inputForm, parms.offsiteHosting);
    }
  };

  $.loginOpenID = R.loginOpenId;


  /*
   loginAjax submits login info, gets list of roles / authcodes

   */
  R.loginAjax = function (parms) {

    var inp = myExtend({}, $.rdbHostConfig.opts, parms || {});

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.loginAjax(inp);
  };

  $.loginAjax = R.loginAjax; // backward compat

  /*
   trainAjax submits login info, establishes training mode for 8 seconds

   !!!!! deprecated. do not use.
   Instead, use preauthPostData

   */
  R.trainAjax = function (parms) {

    var inp = myExtend({}, $.rdbHostConfig.opts, parms || {});

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.trainAjax(inp);
  };


  /*
   * superLogin - logs into server using email and password; returns object like:
   *    { 'preauth': [ 'p0000000002', '' ], 'super': [ 's0000000002', '?????..??' ] }
   */
  R.superLogin = function (parms) {

    /*
     * email,
     * password,
     * acctId,
     *
     * callback,
     * errback
     */

    function _callback(json) {

      var rType = { 'r': 'read', 's': 'super', 'p': 'preauth', 'a': 'auth' };

      var hash = {},
        rowCt = json.row_count[0],
        rows = rowCt ? json.records.rows : [];

      for (var r in rows) {

        if (rows.hasOwnProperty(r)) {
          var row = rows[r],
            roleType = rType[row['role'].substring(0, 1).toLowerCase()];
          hash[roleType] = [row['role'], row['authcode'] === '-' ? '' : row['authcode']];
        }
      }

      if (savedCallback)
        return savedCallback(hash);
      else
        return hash;
    }

    var opts = $.extend({}, parms);

    if (!opts.password || opts.password.length < 3) {

      var def = $.Deferred(),
        d2 = def.then(function (h) {

          // login with password
          opts.email = h.email;
          opts.password = h.password;
          return R.superLogin(opts);
        });

      var dialog_title = opts.dialog_title || 'Login for Super Role';
      drawLoginDialog(dialog_title, opts.email,
          function (h) {
            // pass email and password from form to handler
            def.resolve(h)
          },
          function (h) {
              var err = ['cancel', 'dialog box closed by user'];
              def.reject(err)
          }
      );

      return d2.promise();

    }
    else {

      var savedCallback = opts.callback,
          savedErrback = opts.errback;
      opts.callback = _callback;
      opts.errback = function(e) {
        console.log('login failed ', e[0], e[1]);
        if (savedErrback)
            savedErrback(e);
      };

      return $.loginAjax(opts);
    }
  };

  var superAuthcode = null,
      superAuthcodeTimer = null;

  R._authcodeStored = function () { return !!superAuthcode; };
  R._clearAuthcode = function() { superAuthcode = null; };

  /*
   * stores authcode to private variable, and sets timeout to clear authcode later
   */
  function storeAuthcodeToCache(aCode) {

      clearTimeout(superAuthcodeTimer);
      superAuthcode = aCode;
      superAuthcodeTimer = setTimeout(function() { superAuthcode = null; }, 8000);
  }

  R.superPostData = function (parms) {

    /*
     * same as postData
     *   if no authcode, logs in to get super authcode
     *   sets timeout to clear authcode
     */

    function _callback(res) {

      storeAuthcodeToCache(res.super[1]);
      opts['callback'] = savedCallback;
      return R.superPostData(opts);
    }

    var opts = $.extend({}, parms);

    if (superAuthcode) {

      opts['authcode'] = superAuthcode;
      opts['userName'] = 'super';
      return $.postData(opts);
    }
    else {

      var liOpts = { email: $.rdbHostConfig.opts.acctEmail };
      var savedCallback = opts['callback'];
      liOpts['callback'] = _callback;
      if ( opts['errback'] )
        liOpts['errback'] = opts['errback'];

      return R.superLogin(liOpts);
    }
  };


  R.superPostFormData = function (formId, parms) {

    /*
     * opts same as postFormData
     */

    function _callback(res) {

      storeAuthcodeToCache(res.super[1]);
      opts['callback'] = savedCallback;
      return R.superPostFormData(formId, opts);
    }

    var opts = $.extend({}, parms);

    if (superAuthcode) {

      opts['authcode'] = superAuthcode;
      opts['userName'] = 'super';
      return $.postFormData(formId, opts);
    }
    else {

      var liOpts = { email: $.rdbHostConfig.opts.acctEmail };
      var savedCallback = opts['callback'];
      liOpts['callback'] = _callback;

      return R.superLogin(liOpts);
    }
  };

  var preauthAuthcode = null,
      preauthAuthcodeTimer = null;

  /*
   * stores authcode to private variable, and sets timeout to clear authcode later
   */
  function storePreauthcodeToCache(aCode) {

      clearTimeout(preauthAuthcodeTimer);
      preauthAuthcode = aCode;
      preauthAuthcodeTimer = setTimeout(function() { preauthAuthcode = null; }, 8000);
  }

  R.preauthPostData = function (parms) {

    /*
     * same as postData
     *   if get error...
     */

    var opts = $.extend({}, parms);

    opts['userName'] = 'preauth';
    opts['authcode'] = '-';

    // promise 'p' waits for final resolution
    // promise pD handles first try
    var p = $.Deferred(),
        savedCallback = opts['callback'],
        savedErrback = opts['errback'];

    delete opts['callback'];
    delete opts['errback'];

    var pD = $.postData(opts);

    pD.done(function (args) {

      p.resolve(args);
    });

    pD.fail(function (err) {

      var errCode = err[0], errMsg = err[1];

      if (errCode === 'rdb10') {

          if ( preauthAuthcode ) {

              opts['super-authcode'] = preauthAuthcode;

              var psA = R.postData(opts);
              psA.done(function(m) {
                  p.resolve(m);
              });
              psA.fail(function(m) {
                  p.reject(m);
              });
          }
          else {

              function _rePost(json) {

                  storePreauthcodeToCache(json.super[1]);
                  opts['super-authcode'] = preauthAuthcode;

                  var pRP = R.postData(opts);
                  pRP.done(function(m) {
                      p.resolve(m);
                  });
                  pRP.fail(function(m) {
                      p.reject(m);
                  });
              }

              opts['dialog_title'] = 'Enter Account Login to Whitelist';
              var pSL = R.superLogin(opts);
              pSL.done(_rePost);
              pSL.fail(function(m) {
                  p.reject(m);
              });
          }
      }
      else {

        // initial postData failed for reason other than white-list failure
        p.reject(err);
      }
    });

    // return promise that waits for final resolution
    if (savedCallback || savedErrback) {

      return p.then(savedCallback, savedErrback).promise();
    }
    else {

      return p.promise();
    }
  };


  R.preauthPostFormData = function (that, parms) {

    /*
     * same as postData
     *   if get error...
     */

    var opts = $.extend({}, parms);

    opts['userName'] = 'preauth';
    opts['authcode'] = '-';

    var p = $.Deferred(),
        savedErrback = opts['errback'],
        savedCallback = opts['callback'];

    delete opts['errback'];
    delete opts['callback'];

    var pFD = $.postFormData(that, opts);

    pFD.done(function (resp) {

      p.resolve(resp);
    });

    pFD.fail(function (err) {

      var errCode = err[0], errMsg = err[1];

      if (errCode === 'rdb10') {

          if ( preauthAuthcode ) {

              opts['super-authcode'] = preauthAuthcode;

              var psA = R.postFormData(that, opts);
              psA.done(function(m) {
                  p.resolve(m);
              });
              psA.fail(function(m) {
                  p.reject(m);
              });

              that.rdbhostSubmit();
          }
          else {

              function _rePost(json) {

                  storePreauthcodeToCache(json.super[1]);
                  opts['super-authcode'] = preauthAuthcode;

                  var pRP = R.postFormData(that, opts);
                  pRP.done(function(m) {
                      p.resolve(m);
                  });
                  pRP.fail(function(m) {
                      p.reject(m);
                  });

                  that.rdbhostSubmit();
              }

              opts['dialog_title'] = 'Enter Account Login to Whitelist';
              var pSL = R.superLogin(opts);
              pSL.done(_rePost);
              pSL.fail(function(m) {
                  p.reject(m);
              });
          }
      }
      else {

        p.reject(err);
      }
    });

    // return promise that waits for final resolution
    if (savedCallback || savedErrback) {

      return p.then(savedCallback, savedErrback).promise();
    }
    else {

      return p.promise();
    }
  };


  R.provideSuperPOST = function (opts, f) {

    var dfr = $.Deferred();

    if (!opts.userName || opts.userName.charAt(0) !== 's')
      opts.userName = 'super';

    if (!opts.authcode) {

      if (superAuthcode) {

        opts['authcode'] = superAuthcode;
        return R.provideSuperPOST.apply($, arguments);
      }
      else {

        function _cBack(res) {

          storeAuthcodeToCache(res.super[1]);
          opts['authcode'] = superAuthcode;
          var pd = R.getPOST(opts);
          dfr.resolve(pd);
        }

        function _eBack(err) {

          dfr.reject(err);
        }

        var liOpts = { email: $.rdbHostConfig.opts.acctEmail };
        liOpts['callback'] = _cBack;
        liOpts['errback'] = _eBack;

        R.superLogin(liOpts);
      }
    }
    else {
      // have authcode
      var pd = R.getPOST(opts);
      dfr.resolve(pd);
    }

    if (f)
      return dfr.then(f).promise();
    else
      return dfr.promise();
  };


    function drawLoginDialog(title, email, onSubmit, onCancel) {

        var $liDialog, hgt = 150, width = 250,
            idVal = 'rdbhost-super-login-form';

        $liDialog = $(
            '<div id="xxxx"><form>                                                ' +
                '  <span id="title">t </span> <a href="" class="cancel">x</a>         ' +
                '    <br />                                                           ' +
                '    <input name="email" type="text" placeholder="email"/>            ' +
                '    <input name="password" type="password" placeholder="password" /> ' +
                '    <input id="submit" type="submit" />                              ' +
                '</form></div>                                                        ');

        $liDialog.attr('id', idVal);
        $liDialog.css({
            'position': 'fixed',
            'width': width + 'px',
            'height': hgt + 'px',
            'margin-top': Math.round(hgt / -2) + 'px',
            'margin-right': '0',
            'margin-bottom': '0',
            'margin-left': Math.round(width / -2) + 'px',
            'left': '50%',
            'top': '50%',
            'display': 'none',
            'z-index': 10,
            'background': '#dacba2',
            'padding': '12px',
            'border': 'solid #850e45 8px',
            'font-size': '12pt'
        });
        $liDialog.find('span').css({
            'font-size': 'larger',
            'color': '#850e45'
        });
        $liDialog.find('input').css({
            'color': '#850e45',
            'border': '1px solid #ccc',
            'margin-bottom': '6px',
            'padding': '5px',
            'font-size': '14px',
            'width': '90%'
        });
        $liDialog.find('#submit').css({
            'border': '1px solid #ccc',
            'color': '#000',
            'padding': '7px 10px',
            'font-size': '14px',
            'width': 'auto'
        });

        $liDialog.find('a').css('float', 'right');

        if ($('#' + idVal).length === 0)
            $('body').append($liDialog);
        else
            $liDialog = $('#' + idVal);

        $liDialog.show();
        $liDialog.find('#title').text(title || '');
        $liDialog.find('input[name="email"]').val(email || '');

        $liDialog.on('submit', function (ev) {

            var h = {};
            h.email = $('input[name="email"]').val();
            h.password = $('input[name="password"]').val();

            $liDialog.hide();
            onSubmit(h);
            return false;
        });

        $liDialog.find('a').on('click', function (ev) {

            var h = {};
            h.email = $('#email').val();
            h.password = $('#password').val();

            $liDialog.hide();
            if (onCancel)
                onCancel(h);
            return false;
        })
    }

    R.drawLoginDialog = drawLoginDialog;

    /**
   *  the following methods act on jQuery selections.
   *
   */


  /*
   rdbhostSubmit is .submit() but waits for cross-domain socket to be ready

   Use in lieu of $('#formid').submit(), where form has been prepared with
   $.postFormData
   */
  $.fn.rdbhostSubmit = function () {

    var $that = this,
        targetName = $that.attr('target'),
        reqPrefix = 'request_target_';

    if (targetName && targetName.substr(0, reqPrefix.length) === reqPrefix) {

      var uid = targetName.substr(targetName.length - 10);

      if (CONNECTIONS[uid].remoteRpcReady) {
        $that.submit();
      }
      else {
        setTimeout(function () {
          $that.rdbhostSubmit();
        }, 50);
      }
    }
    else {
      setTimeout(function () {
        $that.rdbhostSubmit();
      }, 50);
    }

  };


  /*
   populateTable creates an html table and inserts into  page

   param q : query to get data
   */
  $.fn.populateTable = function (parms) {

    assert(arguments.length <= 1, 'too many parms to populateTable');
    var $selset = this;

    if (typeof (parms) === 'string') {
      parms = { 'q': parms };
    }

    function populate_html_table($table, $row, recs) {

      var rec, $newrow;
      $table.find('tbody').empty();

      if (recs === undefined || recs.length === 0) {

        $newrow = $row.clone();
        $table.append($newrow);
      }
      else {

        for (var r in recs) {

          rec = recs[r];
          $newrow = $row.clone().show();
          var ctr = 0, flds = [];

          for (var fname in rec) {

            $newrow.find('td.' + fname).html(rec[fname]);
            ctr += $newrow.find('td.' + fname).length;
            flds.push(fname);
          }

          assert(ctr, 'no td elements found with field names! ' + flds.join(', '));
          $table.append($newrow);
        }
      }
    }

    function generate_html_table($table, recs) {

      var rec, $row, $td, fld;
      for (var r in recs) {

        rec = recs[r];
        $row = $('<tr>');
        for (var o in rec) {

          fld = rec[o];
          $td = $('<td>').html(fld);
          $row.append($td);
        }

        $table.append($row);
      }
    }

    function cback(json) {

      var recs = json.records.rows;

      $selset.each(function () {

        var $table = $(this);
        assert(!$table.is('form'), 'use .populateForm for forms');

        if (!$table.is('table')) {

          $table.empty().append('<table><tbody></tbody></table>');
          $table = $table.find('table');
          generate_html_table($table, recs);
        }

        else if ($table.find('tbody tr:first').length) {

          var $row = $table.find('tbody tr:first').hide();
          populate_html_table($table, $row, recs);
        }
        else {

          generate_html_table($table, recs);
        }
      });
    }

    parms.callback = cback;
    $.postData(parms);

    return $selset;
  };


  /*
   populateForm populates a form with a single record

   param q : query to get data
   */
  $.fn.populateForm = function (parms) {

    assert(arguments.length <= 1, 'too many parms to populateForm');
    var $selset = this;

    if (typeof (parms) === 'string') {
      parms = { 'q': parms };
    }

    function populate_form($form, rec) {
      for (var f in rec) {
        var $inp = $form.find('input#' + f);
        if ($inp.length) {
          $inp.val(rec[f]);
        }
        else {
          $inp = $form.find('input.' + f);
          $inp.val(rec[f]);
        }
      }
    }

    function cback(json) {
      if (json.records.rows.length) {
        var rec = json.records.rows[0];
        $selset.each(function () {
          var $form = $(this);
          assert($form.is('form'), 'use .populateForm on a form');
          populate_form($form, rec);
        });
      }
    }

    parms.callback = cback;
    $.postData(parms);
    return $selset;
  };


  /*
   datadump puts a <pre>-formatted json dump into the html

   param q : query to get data
   param kw : query-keyword to get data
   */
  $.fn.datadump = function (parms) {

    var $selset = this;

    if (typeof (parms) === 'string') {
      parms = { 'q': parms };
    }

    function cback(json) {

      $selset.each(function () {
        $(this).html(JSON.stringify(json, null, 4)); // 4 space indent
      });
    }

    parms.callback = cback;
    $.postData(parms);
    return $selset;
  };

  /* create assert function
   example : assert( obj === null, 'object was not null!' );
   error message appears in javascript console, if any.
   credit to: Ayman Hourieh http://aymanh.com/
   */
  function AssertException(message) {
    this.message = message;
  }

  AssertException.prototype.toString = function () {
    return 'AssertException: ' + this.message;
  };
  function assert(exp, message) {
    if (!exp) {
      throw new AssertException(message);
    }
  }

}(window.jQuery || window.Zepto, window));