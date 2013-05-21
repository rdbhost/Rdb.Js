/*

 jquery.rdbhost.subdomain.js

 A jquery plugin to access PostgreSQL databases on Rdbhost.com

 requires a (free) account at www.rdbhost.com to be useful.

 this module includes a class 'SQLEngine' for the database connection, and
 that class can be used by itself, aside from the plugins.  jQuery 1.4+
 is required, even when using the connection class without the plugin.


 the module adds four functions and three methods to the jQuery namespace.

 The four functions are $.rdbHostConfig, $.withResults, $.eachRecord, and
 $.postFormData.  The three methods are $.fn.populateTable,
 $.fn.populateForm, and $.fn.datadump.  There is also a $.postData alias
 to $.withResults

 $.rdbHostConfig takes an options object, and makes those options default for
 all subsequent functions and methods.

 $.withResults sends a query to the server, receives the data, and calls
 a callback with the received data.

 $.eachRecord is like $.withResults, in that it gets data from the server,
 but it extracts the rows from the data structure, and calls an eachrec
 callback for each record.  Each record is a javascript object, with a
 named attribute for each field.

 $.postFormData takes a form as input, submits that form to the server,
 receives the data returned, and provides it to the callback.
 The form fields must conform to the rdbhost protocol.

 $.postData posts to the server, receives the data returned, and provides it
 to the callback.  Similar to jQuery's $.ajax()

 $.loginOpenId provides various services related to OpenID logins.  It will
 prep the form prior to submission, and handles hash values and cookies
 upon return from login process.  Call it in both the openId submit form,
 and in the follow up form.

 Form fields
 The form *must* include either a 'q' or a 'kw' field.  It may also include
 'arg###', or 'argtype###' fields.  Argument fields are numbered like
 'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'..,
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
 logging
 */
//function consoleLog(msg) {
//  window.console.log(msg);
//}


(function ($, window) {

  // SQL Engine that uses form for input, and hidden iframe for response
  //   handles file fields
  //
  function SQLEngine(userName, authcode, domain) {

    this.version = 'jquery.rdbhost.subdomain.js 0.9.0';

    // store engine config info
    var proto = window.document.location.protocol,
        remote = proto + '//' + domain;

    // for setting auth info later
    this.setUserAuthentication = function(uName, aCode) {

      userName = uName;
      authcode = aCode;
    };

    this.hasUserAuthentication = function() {

      return userName && userName.length && authcode && authcode.length;
    };

    this.userName = function() {
      return userName;
    };

    // to add hidden field to form
    function add_hidden_field($form, nm, val) {

      var fld = $('<input type="hidden" class="hidden-field-auto" />');
      fld.attr('name', nm).val(val);
      $form.append(fld);
    }

    // delay before removing iframe, workaround for ff 'busy' bug.
    function remove_iframe(ttag) {

      setTimeout(function () {
        $('#' + ttag).remove();
      }, 1);
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
          else
            return 'STRING';
        case 'undefined':
          return 'NONE';

        default:
          return 'STRING'
      }
    }


    // return appropriate /db/ url for action attribute in form
    this.getQueryUrl = function (altPath) {
      if (altPath === undefined) {
        assert(userName,'no username in sqlEngine');
        assert(userName.length,'username is null in sqlEngine');
        altPath = '/db/' + userName;
      }
      return remote + altPath;
    };

    // return appropriate /accountlogin/ url for action attribute in form
    this.getLoginUrl = function () {
      assert(userName,'no username in sqlEngine');
      assert(userName.length > 1,'username is too short in sqlEngine');
      return this.getQueryUrl('/accountlogin/'+userName.substring(1));
    };


    this.getCommonDomain = function () {

      var hparts = window.location.hostname.split('.').slice(-2);

      return hparts.join('.');
    };


    /*
     parms is object containing various options

     callback : function to call with data from successful query
     errback : function to call with error object from query failure
     q : the query string itself
     args : array of arguments (optional), must correspond with %s tokens
     in query
     namedParams : object with names values
     plainTextJson : true if JSON parsing to be skipped, in lieu of
     returning the JSON plaintext
     format : 'jsond' or 'jsond-easy'
     */
    this.query = function (parms) {

      var that = this;
      return this._query(parms, function () {
        return that.getQueryUrl();
      });
    };

    this._query = function (parms, urlFunc) {

      parms.args = parms.args || [];
      parms.namedParams = parms.namedParams || {};

      var errback = parms.errback,
          iframe_requested = false,
          that = this,
          formId = 'rdb_hidden_form_' + (SQLEngine.formnamectr += 1),
          defer = $.Deferred();

      // define default errback
      if (errback === undefined) {
        errback = function () {
          var arg2 = Array.apply(null, arguments);
          alert(arg2.join(', '));
        };
      }

      // attach success and fail handlers to promise
      parms.callback = parms.callback || null;

      var deferOut = defer.then(parms.callback, errback);


      // local callbacks to do cleanup prior to 'real' callback
      function qErrback(err, msg) {

        // if frame loaded by 'back button', skip over it
        if (!iframe_requested) {
          parent.history.back();
        }

        iframe_requested = false;
        $hiddenform.remove();
        defer.reject(err, msg);
      }

      function qCallback(json) {

        // if frame loaded by 'back button', skip over it
        if (!iframe_requested) {
          parent.history.back();
        }

        iframe_requested = false;
        $hiddenform.remove();
        defer.resolve(json);
      }

      // create hidden form if necessary
      var $hiddenform = $('#' + formId);

      if ($hiddenform.length < 1) {

        var $newform = $(('<form method="post" name="~~id~~" id="~~id~~"' +
            ' enctype="multipart/form-data" style="display:none">' +
            ' </form>').replace(/~~id~~/g, formId));
        $('body').append($newform);
        $hiddenform = $('#' + formId);
      }

      // if params are provided, convert to named form 'arg000', 'arg001'...
      var num, nm, typNm;
      if (parms.args !== undefined) {

        for (var i = 0; i < parms.args.length; i += 1) {

          num = '000' + i;
          nm = 'arg' + num.substr(num.length - 3);
          add_hidden_field($hiddenform, nm, parms.args[i]);
          typNm = 'argtype' + num.substr(num.length - 3);
          add_hidden_field($hiddenform, typNm, apiType(parms.args[i]));
        }
      }

      // if cookie tokens found in sql, convert to namedParams
      var ckTestRe = /%\{([^\}]+)\}/;
      if (parms.namedParams === undefined)
        parms.namedParams = {};

      while (ckTestRe.test(parms.q)) {

        var ckArray = ckTestRe.exec(parms.q),
            ck = ckArray[0],
            ckV = ckArray[1],
            newNm = '_ck_' + ckV,
            ckValue = $.cookie(ckV);
        parms.q = parms.q.replace(ck, '%(' + newNm + ')');
        parms.namedParams[newNm] = ckValue;
      }

      if (parms.namedParams !== undefined) {

        // if named params provided
        $.each(parms.namedParams, function (k, v) {

          nm = 'arg:' + k;
          add_hidden_field($hiddenform, nm, v);
          typNm = 'argtype:' + k;
          add_hidden_field($hiddenform, typNm, apiType(v));
        });
      }

      // put query in hidden form
      add_hidden_field($hiddenform, 'q', parms.q);

      if (parms.kw)
        add_hidden_field($hiddenform, 'kw', parms.kw);

      // remove submit handler, if one already, and bind new handler
      $hiddenform.unbind('submit');

      $hiddenform.submit(function (ev) {

        ev.stopPropagation();
        iframe_requested = true;

        var defr = that._queryByForm({
          'formId': formId,
          'callback': qCallback,
          'errback': qErrback,
          'format': parms.format,
          'plainTextJson': parms.plainTextJson
        }, urlFunc);

        defr.done(defer.resolve);
        defr.fail(defer.fail);
      });

      // submit the hidden form
      $hiddenform.submit();

      return deferOut.promise();
    };


    /*
     parms is just like for query method, but callback gets row array and
     header array, not whole data structure.
     an additional param is 'incomplete', a function that is called
     (with rows and header) when data set is truncated by 100 record limit
     */
    this.queryRows = function (parms) {
      var callback = parms.callback,
          incomplete_callback = parms.incomplete || callback;

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

      parms.callback = cb;

      return this.query(parms);
    };


    /*
     parms is object containing various options

     formId : the id of the form with the data
     callback : function to call with data from successfull query
     errback : function to call with error object from query failure
     plainTextJson : true if JSON parsing to be skipped, instead
     returning the JSON plaintext
     */
    this.queryByForm = function (parms) {

      var that = this;
      return this._queryByForm(parms, that.getQueryUrl);
    };


    this._queryByForm = function (parms, urlFunc) {

      var formatType = 'jsond',
          fmt = parms.format || '',
          errback = parms.errback,
          targetTag = 'upload_target_' + parms.formId + '_' + (SQLEngine.formnamectr += 1),
          target, action,
          defer = $.Deferred();
      parms.format = ~fmt.toLowerCase().indexOf('easy') ? formatType+'-easy' : formatType;

      // get form, return if not found
      var $form = $('#' + parms.formId);
      if ($form.length < 1)
        return false;

      // define default errback
      if (errback === undefined) {
        errback = function () {
          var arg2 = Array.apply(null, arguments);
          alert(arg2.join(', '));
        };
      }

      // add handlers to deferred
      parms.callback = parms.callback || null;

      var deferOut = defer.then(parms.callback, errback);

      // inner errback
      function results_bad(err, msg) {

        //cleanup_submit(parms.formId);
        defer.reject(err, msg);
      }

      function results_good(json) {

        //cleanup_submit(parms.formId);
        defer.resolve(json);
      }

      // function to handle json when loaded
      function results_loaded(targetTag) {

        var $fr = $(frames[targetTag].document);
        if ($fr.length === 0)
          results_bad('err', 'target "~" iframe document not found'.replace('~', targetTag));

        var cont = $.trim($fr.find('body script').html()),
            json_result;

        if (cont) {
          if (cont.substr(0, 1) === '{') {

            if (parms.plainTextJson) {
              results_good(cont);
            }
            else {

              try {
                json_result = JSON.parse(cont);
              }
              catch (err) {
                results_bad('json.parse', 'json err: ' + err.toString());
                return;
              }
              if (json_result.status[0] === 'error') {
                results_bad(json_result.error[0], json_result.error[1]);
              }
              else {
                results_good(json_result);
              }
            }
          }
          else {
            results_bad('not-json', 'not json ' + cont.substr(0, 3));
          }
        }
        else {
          results_bad('err', 'no content');
        }
      }

      // function to cleanup after data received
      function cleanup_submit(formtag) {

        var $form = $('#' + formtag);
        $form.find('.hidden-field-auto').remove();
        $form.attr('target', target);  // restore saved target,action
        $form.attr('action', action);
        remove_iframe(targetTag)
      }

      // save prior values for target and action
      target = $form.attr('target');
      action = $form.attr('action');

      // put password into form
      add_hidden_field($form, 'authcode', authcode);

      // set format, action, and target
      var url = urlFunc();
      add_hidden_field($form, 'format', parms.format);
      $form.attr('target', targetTag);
      $form.attr('action', url);

      // add hidden iframe to end of body
      var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';

      if ($('#' + targetTag).length === 0) {

        // put tagname into iframe txt, and append iframe to body
        iframeTxt = iframeTxt.replace(/~tt~/g, targetTag);
        $('body').append($(iframeTxt));

        // bind action functions to hidden iframe
        $('#' + targetTag).load(function () {

          results_loaded(targetTag);
          cleanup_submit(parms.formId);
        });
      }
      else {
        alert('tag ' + targetTag + ' iframe already present');
      }

      // change window domain to common-rightmost part of domain
      var winDomain = window.document.domain;
      window.document.domain = this.getCommonDomain();

      return deferOut.promise();
    };


    /*
     parms is object containing various options

     formId : the id of the form with the data
     callback : function to call with data from successfull query
     errback : function to call with error object from query failure
     plainTextJson : true if JSON parsing to be skipped, in lieu of
     returning the JSON plaintext
     */
    this.loginAjax = function (parms) {

      var email = parms.email,
          password = parms.password,
          that = this;
      delete parms.email; delete parms.password;
      parms.namedParams = { email: email,  password: password };
      parms.format = 'jsond-easy';

      return this._query(parms, function () {
        return that.getLoginUrl();
      });
    }

  } // end of SQLEngine class
  SQLEngine.formnamectr = 0;

  window.SQLEngine = SQLEngine;

  /*
   following section defines some jQuery plugins

   */

  // default generic callbacks
  //
  function errback(err, msg) {
    var errCode = '-';

    try { errCode = err.toString() }
    catch (e) {}

    alert('<pre>' + errCode + ': ' + msg + '</pre>');
  }

  function dumper(json) {
    var str = JSON.stringify(json, null, 4);
    alert(str);
  }

  //  configuration setting function
  //  saves defaults as attribute on the config function
  //
  var opts = {
    errback: errback,
    callback: dumper,
    eachrec: undefined,
    format: 'json-easy',
    userName: '',
    authcode: ''        };

  $.rdbHostConfig = function (parms) {

    var options = $.extend({}, opts, parms || {});
    $.rdbHostConfig.opts = options;
  };


  /*
   withResults - calls callback with json result object
   or errback with error object

   param q : query to get data
   param callback : function to call with json data
   param errback : function to call in case of error
   */
  $.withResults = function (parms) {

    assert(arguments.length <= 1, 'too many parms to withResults');
    var inp = $.extend({}, $.rdbHostConfig.opts, parms || {});

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.query(inp);
  };


  /*
   eachRecord - calls 'eachrec' callback with each record,
   or errback with error object

   param q : query to get data
   param eachrec : function to call with each record
   param errback : function to call in case of error
   */
  $.eachRecord = function (parms) {

    assert(arguments.length <= 1, 'too many parms to eachRecord');
    var eachrec = parms.eachrec;
    delete parms.eachrec;
    assert(eachrec, 'eachrec not provided');

    function cback(json) {

      for (var r in json.records.rows) {
        eachrec(json.records.rows[r]);
      }
    }

    parms.callback = cback;
    return $.withResults(parms);
  };


  /*
   postFormData should be used as a submit handler for a data entry form.

   param q : query to post data
   param kw : query-keyword to post data
   */
  $.postFormData = function (that, parms) {

    assert(arguments.length <= 2, 'too many parms to postFormData');
    var $form = $(that).closest('form');
    var inp = $.extend({}, $.rdbHostConfig.opts, parms || {});
    inp.formId = $form.attr('id');
    assert(inp.formId, 'form must have a unique id attribute');

    $form.find('#q').remove();
    if (inp.q)
      $form.append($('<input type="hidden" id="q" name="q" >').val(inp.q));

    $form.find('#kw').remove();
    if (inp.kw !== undefined && inp.kw !== null)
      $form.append($('<input type="hidden" id="kw" name="kw" >').val(inp.kw));

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.queryByForm(inp);
  };


  /*
   postData submits some data (in the options object) to the server
   and provides the response to callback.

   param q : query to post data
   param kw : query-keyword to post data
   */
  $.postData = $.withResults;

/*
  function (parms) {

    assert(arguments.length < 2, 'too many parms to postData');
    var inp = $.extend({}, $.rdbHostConfig.opts, parms || {});

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.query(inp);
  };
*/

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
   *
   */
  $.loginOpenId = function (inp) {

    // minimal functions for success and failure handlers
    var onSuccess = function () {
      alert('success!');
    };

    var onFailure = function () {
      // default is to fail silently
    };

    /*
     * default values for each attribute
     *
     *   each can be overridden, only mandatory item is acctNum
     */
    var parms = {

      loginForm: 'null',
      returnPath: false,

      callback: onSuccess,
      errback: onFailure,

      cookieName: 'LOGIN_KEY',
      ignoreHash: false,

      offsiteHosting: false
    };

    parms = $.extend({}, $.rdbHostConfig.opts, parms, inp);

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

      if (window.location.hash) {
        var hash = window.location.hash;
        window.location.hash = '';
        hash = decodeURIComponent(hash);
        var hp = hash.split('&', 2);
        if (hp.length >= 2) {
          ident = hp[0];
          key = hp[1];
          if (ident.indexOf('#') === 0)
            ident = ident.substr(1);
          $.cookie(parms.cookieName, key);
          return true;
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
    var loggedInSuccess = false;
    if (!parms.ignoreHash) {

      var ckSuccess;
      var hashSuccess = useHash();
      if (!hashSuccess) {
        ckSuccess = useCookie();
        if (!ckSuccess)
          parms.errback(ident);
        else {
          parms.callback(key, ident);
          loggedInSuccess = true;
        }
      }
      else {
        parms.callback(key, ident);
        loggedInSuccess = true;
      }
    }
    else {
      ckSuccess = useCookie();
      if (!ckSuccess)
        parms.errback(ident);
      else {
        parms.callback(key, ident);
        loggedInSuccess = true;
      }
    }

    // prepare form for login try
    var $inputForm = $('#' + parms.loginForm);

    if ($inputForm.length) {
      prepareForm($inputForm, parms.offsiteHosting);
    }
  };


  /*
   loginAjax submits your login data

   */
  $.loginAjax = function (parms) {

    var inp = $.extend({}, $.rdbHostConfig.opts, parms || {});

    var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
    delete inp.userName;
    delete inp.authcode;
    delete inp.domain;

    return sqlEngine.loginAjax(inp);
  };


  /*
   rdbhostSubmit is .submit() but waits for cross-domain socket to be ready

   Use in lieu of $('#formid').submit(), where form has been prepared with
   $.postFormData or $.loginByForm

   not necessary for this version of library, but included for completeness
   */
  $.fn.rdbhostSubmit = function () {

    this.submit();
  };


  /*
   populateTable creates an html table and inserts into  page

   param q : query to get data
   */
  $.fn.populateTable = function (parms) {

    assert(arguments.length <= 1, 'too many parms to populateTable');
    var $selset = this;

    if (typeof(parms) === 'string')
      parms = { 'q': parms };

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
    $.withResults(parms);

    return $selset;
  };


  /*
   populateForm populates a form with a single record

   param q : query to get data
   */
  $.fn.populateForm = function (parms) {

    assert(arguments.length <= 1, 'too many parms to populateForm');
    var $selset = this;

    if (typeof(parms) === 'string')
      parms = { 'q': parms };

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
    $.withResults(parms);

    return $selset;
  };


  /*
   datadump puts a <pre>-formatted json dump into the html

   param q : query to get data
   param kw : query-keyword to get data
   */
  $.fn.datadump = function (parms) {

    var $selset = this;

    if (typeof(parms) === 'string')
      parms = { 'q': parms };

    function cback(json) {

      $selset.each(function () {

        $(this).html(JSON.stringify(json, null, 4)); // 4 space indent
      });
    }

    parms.callback = cback;
    $.withResults(parms);

    return $selset;
  };


}(jQuery, this));


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

