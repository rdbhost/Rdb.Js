/*
 *  Plugin for Rdbhost, providing friendly functions for common utils
 *
 *
 */


(function ($, window) {

    var R = window.Rdbhost;

    R.emailWebmaster = function(opts) {

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

        return R.preauthPostData({

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
    R.emailAllUsers = function(opts) {

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


        return R.preauthPostData({

            userName:   'preauth',

            q:          emailAUQuery,
            kw:         'emailAllUsers',
            mode:       'email',

            namedParams:  {
                emailid: opts.emailid
            }

        });
    };


    R.setupEmail = function(opts) {

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

            return R.superPostData({

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

            var uName = R.role().replace('s','p');
            var q = qGrantAuthSchemaPrivs.replace('%s',uName);
            return R.superPostData({

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

            return R.superPostData({

                userName: opts.userName,
                q:        qCreateAPITable
            })
        }

        function qInsertFunc() {

            return R.superPostData({

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



    R.chargeCard = function(opts) {

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


        return R.preauthPostData({

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


      var p = R.superPostData({

        userName: opts.userName,
        q:        qCreateAPITable
      });

      return p.finally(function() {

          var p1 = R.superPostData({

            userName:    opts.userName,
            q:           qInsert,

            namedParams: {
              service: opts.service,
              apikey: opts.apikey,
              webmaster: '',
              acctemail: opts.accountEmail
            }
          });

          var p2 = R.superPostData({

            userName:    opts.userName,
            q:           qCreateChargeResultsTables
          })
      });

    };

}(window.jQuery || window.Zepto, window));

