/*
 *  Plugin for Rdbhost, providing friendly functions for common utils
 *
 *
 */


(function ($, window) {


    $.emailWebmaster = function(opts) {

        /*
         *  to,
         *  from,
         *  subject,
         *  body,
         *  htmlBody,
         *  attachmentName,
         *  attachmentBody
         */

        var emailWMQuery =
            "SELECT %(body) AS body,                                    \n"+
            "       %(htmlbody) AS htmlbody,                            \n"+
            "       api.webmaster_email AS \"To:\",                     \n"+
            "       api.account_email AS \"From:\",                     \n"+
            "       %(from) AS \"Reply-to:\",                           \n"+
            "       %(subject) AS \"Subject:\",                         \n"+
            "       api.apikey AS apikey,                               \n"+
            "       'postmark' AS service,                              \n"+
            "       1 AS idx                                            \n"+
            "  FROM auth.apis AS api WHERE service = 'postmark'         \n"+
            "LIMIT 1                                                      ";

        return $.preauthPostData({

            userName:   'preauth',

            q:          emailWMQuery,
            kw:         'emailWebmaster',
            mode:       'email',

            namedParams:  {
                body: opts.bodyString || '',
                htmlbody: opts.htmlBodyString || '',
                from: opts.from,
                subject: opts.subject
            }
        });
    };


    /*
     * Email group of users, content from
     */
    $.emailAllUsers = function(opts) {

      /*
       *
       */
        var emailAUQuery =
            "SELECT replace(emails.body,'~recip',oid.identifier) AS body,  \n"+  // interpolate email addy
            "       replace(emails.htmlbody,'~recip',                      \n"+  // into bodies
            "                           oid.identifier)  AS htmlbody,      \n"+
            "       oid.identifier AS \"To:\",                             \n"+
            "       api.account_email AS \"From:\",                        \n"+
            "       emails.subject AS \"Subject:\",                        \n"+
            "       api.apikey AS apikey,                                  \n"+
            "       'postmark' AS service,                                 \n"+
            "       1 AS idx                                               \n"+
            "  FROM auth.apis AS api,                                      \n"+
            "       auth.openid_accounts AS oid,                           \n"+
            "       emails                                                 \n"+
            " WHERE api.service = 'postmark'                               \n"+
            "   AND emails.id = %(emailid)                                 \n"+
            "   AND oid.identifier LIKE \'%%@%%\'                          \n";  // exclude non-email identifiers


        return $.postData({

            userName:   'preauth',

            q:          emailAUQuery,
            kw:         'emailAllUsers',
            mode:       'email',

            namedParams:  {
                emailid: opts.emailid
            }

/*
            callback: function(resp) {
                return resp;
            },

            errback: function(err, errmsg) {
                return arguments;
            }
*/
        });
    };


    $.setupEmail = function(opts) {

        /*
         * service,
         * apikey,
         * webmasterEmail,
         * accountEmail,
         * callback
         * errback
         *
         */

        var qCreateAuthSchema =
             'CREATE SCHEMA "auth";                                     ',

            qGrantAuthSchemaPrivs =
             'GRANT USAGE ON SCHEMA "auth" TO %s                        ',

            qCreateAPITable =
             'CREATE TABLE "auth"."apis" (                            \n'+
             '  service VARCHAR(10) NOT NULL,                         \n'+
             '  apikey VARCHAR(100) NOT NULL,                         \n'+
             '  webmaster_email VARCHAR(150) NULL,                    \n'+
             '  account_email VARCHAR(150) NOT NULL                   \n'+
             ');                                                        ',

            qCreateEmailBodyTable =
             'CREATE TABLE "emails" (                                 \n'+
             '  id VARCHAR(75),                                       \n'+
             '  subject VARCHAR(150),                                 \n'+
             '  body TEXT,                                            \n'+
             '  htmlbody TEXT                                         \n'+
             ');                                                      \n',

            qInsert =
             'INSERT INTO "auth"."apis"                               \n'+
             '  ( service, apikey, webmaster_email, account_email )   \n'+
             'VALUES(%(service),%(apikey),%(webmaster),%(acctemail));   ';


        function createAuthSchema() {

            return $.superPostData({

                userName:    opts.userName,
                q:           qCreateAuthSchema
            }).fail(function(errArray) {

                console.log('createAuthSchema fail '+errArray);
                return errArray;
            }).done(function(resp) {

                console.log('createAuthSchema success ');
                return resp;
            });

        }

        function grantSchemaPrivs() {

            var uName = $.role().replace('s','p');
            var q = qGrantAuthSchemaPrivs.replace('%s',uName);
            return $.superPostData({

                userName: opts.userName,
                q: q
            }).fail(function(errArray) {

                console.log('grantAuth error '+errArray+' '+q);
                return errArray;
            }).done(function(resp) {

                console.log('grantAuth success '+q);
                return resp;
            })
        }

        function createAPITable() {

            return $.superPostData({

                userName: opts.userName,
                q:        qCreateAPITable
            })
        }

        function qInsertFunc() {

            return $.superPostData({

                userName:    opts.userName,
                q:           qInsert,

                namedParams: {
                    service: opts.service,
                    apikey: opts.apikey,
                    webmaster: opts.webmaster,
                    acctemail: opts.acctemail
                }
            })
        }

        var p = $.Deferred();
        function casStep() {
            console.log('begin: createAuthSchema');
            return createAuthSchema()
                .fail(function(err) {
                    console.log('createAuthSchema err '+err);
                    return err;
                }).done(function(resp) {
                    console.log('createAuthSchema done');
                    return resp;
                });
        }
        function gspStep() {

            console.log('begin: grantSchemaPrivs');
            return grantSchemaPrivs()
                .fail(function(err) {
                    console.log('grantSchemaPrivs err '+err);
                    return err;
                }).done(function(resp) {
                    console.log('grantSchemaPrivs done');
                    return resp;
                });
        }
        function catStep() {
            console.log('begin: createAPITable');
            return createAPITable()
                .fail(function(err) {
                    console.log('createAPITable err '+err);
                    return err;
                }).done(function(resp) {
                    console.log('createAPITable done');
                    return resp;
                });
        }
        function qifStep() {
           console.log('begin: qInsertFunc');
           return qInsertFunc()
               .fail(function(err) {
                   console.log('qInsertFunc err '+err);
                   return err;
               }).done(function(resp) {
                   console.log('qInsertFunc done');
                   return resp;
               });
        }
        var p2 = p.then(casStep, casStep)
            .then(gspStep, gspStep)
            .then(catStep, catStep)
            .then(qifStep, qifStep);
        p.resolve();

        return p2;
    };



    $.chargeCard = function(opts) {

        /*
         *  cardNum,
         *  ccv,
         *  Name,
         *  Amount,
         *  acctId,
         *
         *  callback
         *  errback
         */

        var chargeQuery =
            "SELECT apis.apikey AS apikey,                                          \n"+
            "    'stripe' AS service,                                               \n"+
            "    'charge' AS action,                                                \n"+
            "    %(amount) AS amount,                                               \n"+
            "    %(ccnum) AS cc_num,                                                \n"+
            "    %(cvc) AS cc_cvc,                                                  \n"+
            "    %(expmon) AS cc_exp_mon,                                           \n"+
            "    %(name) AS name,                                                   \n" +
            "    %(expyr) AS cc_exp_yr,                                             \n"+
            "    'usd' AS currency,                                                 \n"+
            "    %(identifier) AS idx,                                              \n"+
            "    'INSERT INTO \"charges\" (payer, amount, transid)                  \n"+
            "         VALUES({idx},{amount},{id})'       AS postcall,               \n"+
            "    'INSERT INTO \"badcharges\" (payer, amount, error)                 \n"+
            "         VALUES({idx},{amount},{error})'     AS errcall                \n"+
            " FROM auth.apis AS apis                                                \n"+
            "WHERE apis.service = 'stripe'                                            ";


        return $.postData({

          userName:   'preauth',

          q:          chargeQuery,
          kw:         'chargeCard',
          mode:       'charge',

          namedParams:  {
            amount: Math.round(opts.amount*100), // cents
            ccnum: opts.cc_num,
            cvc: opts.cc_cvc,
            expmon: opts.exp_mon,
            expyr: opts.exp_yr,
            name: opts.cardholder,
            identifier: 'me@here',
            note: 'note'
          }

/*
          callback: function(resp) {
            return resp;
          },

          errback: function(err, errmsg) {
            return arguments;
          }
*/
        });
    };



    $.setupCharge = function(opts) {

        /*
         *  service,
         *  apikey,
         *
         *  callback,
         *  errback
         *
         */

      var qCreateAPITable =
              'CREATE TABLE "auth"."apis" (                            \n'+
              '  service VARCHAR(10) NOT NULL,                         \n'+
              '  apikey VARCHAR(100) NOT NULL,                         \n'+
              '  webmaster_email VARCHAR(150) NULL,                    \n'+
              '  account_email VARCHAR(150) NOT NULL                   \n'+
              ');                                                        ',

          qCreateChargeResultsTables =
              'CREATE TABLE "charges" (                                \n'+
              '  id VARCHAR(75),                                       \n'+
              '  amount NUMERIC(6,2),                                  \n'+
              '  payer TEXT,                                           \n'+
              '  note TEXT                                             \n'+
              ');                                                      \n'+
              'CREATE TABLE "badcharges" (                             \n'+
              '  id VARCHAR(75),                                       \n'+
              '  amount NUMERIC(6,2),                                  \n'+
              '  error TEXT,                                           \n'+
              '  payer TEXT,                                           \n'+
              '  note TEXT                                             \n'+
              ');                                                      \n',

          qInsert =
              'INSERT INTO "auth"."apis"                               \n'+
              '  ( service, apikey, webmaster_email, account_email )   \n'+
              'VALUES(%(service),%(apikey),%(webmaster),%(acctemail));   ';


      var p = $.superPostData({

        userName: opts.userName,
        q:        qCreateAPITable
      });

      return p.finally(function() {

          var p1 = $.superPostData({

            userName:    opts.userName,
            q:           qInsert,

            namedParams: {
              service: opts.service,
              apikey: opts.apikey,
              webmaster: '',
              acctemail: opts.accountEmail
            }
          });

          var p2 = $.superPostData({

            userName:    opts.userName,
            q:           qCreateChargeResultsTables
          })
      });

    };


    /*
     * superLogin - logs into server using email and password; returns object like:
     *    { 'preauth': [ 'p0000000002', '' ], 'super': [ 's0000000002', '?????..??' ] }
     */
    $.superLogin = function(opts) {

        /*
         * email,
         * password,
         * acctId,
         *
         * callback,
         * errback
         */

        function _callback (json) {

            var rType = { 'r': 'read', 's': 'super', 'p': 'preauth', 'a': 'auth' };

            var hash = {},
                rowCt = json.row_count[0],
                rows = rowCt ? json.records.rows : [];

            for ( var r in rows ) {

                if ( rows.hasOwnProperty(r) ) {
                    var row = rows[r],
                        roleType = rType[row['role'].substring(0,1).toLowerCase()];
                    hash[roleType] = [ row['role'], row['authcode'] === '-'? '' : row['authcode'] ];
                }
            }

            if ( savedCallback )
                return savedCallback(hash);
            else
                return hash;
        }

        if ( ! opts.password || opts.password.length < 3 ) {

          var def = $.Deferred(),
              d2 = def.then(function(h) {

                // login with password
                opts.email = h.email;
                opts.password = h.password;
                return $.superLogin(opts);
              });

          drawLoginDialog('Login for Super Role', opts.email, function(h) {

            // pass email and password from form to handler
            def.resolve(h)
          });

          return d2.promise();

        }
        else {

          var savedCallback = opts.callback;
          opts.callback = _callback;

          return $.loginAjax(opts);
        }
    };

    var superAuthcode = null,
        superAuthcodeTimer = null,
        acctEmail = null;

    $._authcodeStored = function() { return !!superAuthcode; };

    $.superPostData = function(opts) {

        /*
         * same as postData
         *   if no authcode, logs in to get super authcode
         *   sets timeout to clear authcode
         */

        function _callback(res) {

          clearTimeout(superAuthcodeTimer);
          superAuthcode = res.super[1];
          superAuthcodeTimer = setTimeout(function() { superAuthcode = null; }, 8000);
          opts['callback'] = savedCallback;
          return $.superPostData(opts);
        }

        if ( superAuthcode ) {

          opts['authcode'] = superAuthcode;
          opts['userName'] = 'super';
          return $.postData(opts);
        }
        else {

          var savedCallback = opts['callback'];
          opts['callback'] = _callback;

          return $.superLogin(opts);
        }
    };


    $.superPostFormData = function(formId, opts) {

        /*
         * opts same as postFormData
         */

      function _callback(res) {

        clearTimeout(superAuthcodeTimer);
        superAuthcode = res.super[1];
        superAuthcodeTimer = setTimeout(function() {
          superAuthcode = null;
        }, 8000);

        opts['callback'] = savedCallback;
        return $.superPostFormData(formId, opts);
      }

      if ( superAuthcode ) {

        opts['authcode'] = superAuthcode;
        opts['userName'] = 'super';
        return $.postFormData(formId, opts);
      }
      else {

        var savedCallback = opts['callback'];
        opts['callback'] = _callback;

        return $.superLogin(opts);
      }
    };


    $.preauthPostData = function(opts) {

        /*
         * same as postData
         *   if get error...
         */

        opts['userName'] = 'preauth';
        var savedErrback = opts['errback'];
        delete opts['errback'];

        // promise 'p' waits for final resolution
        // promise pD handles first try
        var p = $.Deferred(),
            pD = $.postData(opts);

        pD.done(function(args) {

            p.resolve(args);
        });

        pD.fail(function(err) {

            var errCode = err[0], errMsg = err[1];

            if ( errCode === 'rdb10' ) {

                // alert('preauth collision');

                function doIt(h) {

                    return $.trainAjax({

                        email: h.email,
                        password: h.password,
                        userName: opts.userName,

                        callback: function(res) {

                            // training mode has been inited, good for 8 seconds

                            // promise pD2 handles retry of postData
                            var pD2 = $.postData(opts);

                            pD2.done(function(resp) {

                                p.resolve(resp);
                            });
                            pD2.fail(function(err) {

                                p.reject(err);
                            })
                        },

                        errback: function (e) {

                            // training mode not inited, for some reason
                            if (savedErrback)
                                return savedErrback(e);
                            else
                                return e;
                        }
                    })
                }

                // show login dialog
                drawLoginDialog('Preauth Login', opts.email,

                    function(h) { doIt(h) },
                    function(err) { p.reject(err) }
                );
            }
            else {

                // initial postData failed for reason other than white-list failure
                p.reject(err);
            }
        });

        // return promise that waits for final resolution
        return p.promise();
    };


    $.preauthPostFormData = function(that, opts) {

        /*
         * same as postData
         *   if get error...
         */

        opts['userName'] = 'preauth';
        var p = $.Deferred(),
            pFD = $.postFormData(that, opts),
            savedErrback = opts['errback'];
        delete opts['errback'];

        pFD.done(function(resp) {

            p.resolve(resp);
        });

        pFD.fail(function(err) {

            var errCode = err[0], errMsg = err[1];

            if (errCode === 'rdb10') {

                function doIt(h) {

                    return $.trainAjax({

                        email: h.email,
                        password: h.password,
                        userName: opts.userName,

                        callback: function(res) {

                            // training mode has been inited, good for 8 seconds

                            // resubmit form
                            var pD2 = $.postFormData(that, opts);
                            $(that).submit();

                            pD2.done(function(resp) {

                                p.resolve(resp);
                            });
                            pD2.fail(function(err) {

                                p.reject(err);
                            })
                        },

                        errback: function (e) {

                            // training mode not inited, for some reason
                            if (savedErrback)
                                return savedErrback(e);
                            else
                                return e;
                        }
                    })
                }

                // show login dialog
                drawLoginDialog('Preauth Login', opts.email,

                    function(h) { doIt(h) },
                    function(err) { p.reject(err) }
                );
            }
            else {

                p.reject(err);
            }
        });

        return p.promise();
    };


    function drawLoginDialog(title, email, onSubmit, onCancel) {

        var $liDialog, hgt = 100, width = 200,
            idVal = 'rdbhost-super-login-form';

        $liDialog = $('<div id="xxxx"><form>                                                ' +
                      '  <span id="title">t </span> <a href="" class="cancel">x</a>         ' +
                      '    <br />                                                           ' +
                      '    <input name="email" type="text" placeholder="email"/>            ' +
                      '    <input name="password" type="password" placeholder="password" /> ' +
                      '    <input type="submit" />                                          ' +
                      '</form></div>                                                        ');

        $liDialog.attr('id',idVal);
        $liDialog.css({

            'position': 'absolute',
            'width': width + 'px',
            'height': hgt + 'px',
            'margin-top': Math.round(hgt/-2) + 'px',
            'margin-right': '0',
            'margin-bottom': '0',
            'margin-left': Math.round(width/-2) + 'px',
            'left': '50%',
            'top': '50%',
            'display': 'none',
            'z-index': 10,
            'background': '#dacba2',
            'padding': '12px',
            'border': 'solid #850e45 8px'
        });
        $liDialog.find('span').css({

            'font-size': 'larger',
            'color': '#850e45'
        });
        $liDialog.find('input').css({

            'color': '#850e45'
        });

        $liDialog.find('a').css('float', 'right');
        $liDialog.find('#title').text(title);

        if ( $('#'+idVal).length === 0 )
            $('body').append($liDialog);
        else
            $liDialog = $('#'+idVal);
        $liDialog.show();

        $liDialog.on('submit', function(ev) {

            var h = {};
            h.email = $('input[name="email"]').val();
            h.password = $('input[name="password"]').val();

            $liDialog.hide();
            onSubmit(h);
            return false;
        });

        $liDialog.find('a').on('click', function(ev) {

            var h = {};
            h.email = $('#email').val();
            h.password = $('#password').val();

            $liDialog.hide();
            if ( onCancel )
                onCancel(h);
            return false;
        })
    }

    $.drawLoginDialog = drawLoginDialog;

}(jQuery, window));

