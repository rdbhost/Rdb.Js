
## The Javascript Module for Accessing Rdbhost (easyXDM version)
## jquery.rdbhost.exdm.js ##

### Dependencies ###
This module requires jQuery.  Version 1.9 or greater is recommended.
Use with Internet Explorer 7 requires json2.js also.

### Overview ###
The module includes a class, *SQLEngine*, that encapsulates the interactions with the server, and a
jQuery plugin.  The class can be used directly, without the plugin, but the plugin is intended to be easier. This document describes the plugin.  For help in using the SQLEngine object directly, there is decent commenting in the source.

There are two sister modules, _jquery.rdbhost.cors.js_ and _jquery.rdbhost.js_, in the /js library.  The former is an #ajax#-only module that relies on the client's browse supporting the cors http extension.  It functions only on modern CORS-compliant browsers, so its business applicability is more limited than the full module.  (CORS = Cross Origin Resource Sharing)  The second relies on you setting up a domain pointer to our server for a subdomain of your hosting domain.
[CORS readme](README.CORS.md)

The _jquery.rdbhost.exdm.js_ is the preferred module to use, as it works for the greatest range of browsers, and requires the least amount of preparatory work.

This document attempts to provide an overview of the module, and tell you enough to do useful things with the library.  There is much more to know about the service,
documented on the site:

[Table of Contents](http://www.rdbhost.com/contents.html)
Some features of the service:

* binary uploads
* raw binary downloads
* json or xml
* deferred queries with higher time limits


### The Plugin ###
Included are five _functions_ (called on the jQuery object) and four _methods_ (called on selection sets).  Most of them take option objects as their only or second parameter.

### Options ###
Before we discuss the functions and methods themselves, let's go over the options.  Some are required, some optional (a _required_ _option_ ? yep).  A default can be set for each, via the $.rdbHostConfig function, or included in each function or method call.

* *userName:* PostgreSQL rolename used for the connection; rolename is 10 digit account number, preceded by 's', 'a', 'p', or 'r'. *required*

* *authcode:* 'authentication code' for role.  50 base-64 digits. *required*

* *q:* the query, in SQL.  Some roles can not execute free-form queries. Either _q_ or _kw_ is *required*.

* *kw:* a lookup keyword, used to lookup a query pre-stored on the server. All roles can execute queries via _kw_.  Either _q_ or _kw_ is *required*.

* *args:* an array with arguments to replace substitution tokens in the query string.  The number of _args_ elements should match the number of substitution tokens in the query string.  Can be used with _kw_ s also, in which case the args interpolate into the query string on the server, indexed by the _kw_ value.

* *namedParams:* an object with named attributes.  The params are referenced in the query string with tokens like _%(paramName)_.

* *format:* either _jsond_ or _jsond-easy_. default = _jsond-easy_.

* *domain:* what rdbhost server are you using?  default www.rdbhost.com

* *callback:* a function that gets called with the data, once data is received.  Used by functions, not by methods.
Not required, but the default is a basic _*JSON*_ dump and probably not what you want.

* *errback:* a function that gets called when there is an error in the data retrieval.  Default raises an exception.

* *eachrec:* the $.eachRecord function calls this, for each record, in lieu of _callback_.

### Data Format ###

See [json response format](http://www.rdbhost.com/result-formats.html), for details, but here is a quick overview:

* the records will be Javascript objects as a Javascript array in data.records.rows, where data is the parameter
name your callback function used to receive the result data.
* data.status[0] will be either 'incomplete' or 'complete', depending
on whether the Rdbhost records-per-request limit was exceeded.  The data.status[0] will never be 'error', since errors result in calling errback in lieu of callback.

### Functions ###
* *$.rdbHostConfig:* Stores its options as the default for all subsequent functions. It can accept *any* or *all* of the options.

* *$.postData:* used to submit data to server, similar to an $.ajax call.  This method ends query to server, gets results, calls callback with single result object as the parameter.
Requires _callback_ and _q_ or _kw_.

        $.ready(function () {
            $.postData( { kw : 'logthispage',
                          args : [ 'test page loaded' ],
                          callback : function(){} });
        });

    The above example assumes that _userName_, and _authcode_ have been set as defaults.
The _q_ query string (or the on-server query string referenced by _kw_) may include '%s' substition tokens, and an _args_ options must then be provided, with an element for each such token. Any response data from the server will be passed to the callback.


[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_exdm_post.html)

* *$.postFormData:* used to submit data to server, where the data is in an html form. Call this function before the form gets submitted, not from a *submit* or *click* handler on the form:

            $.postFormData($('#demo-form'),
                           {'kw':'updater',
                            'callback':redisplay});

    The above example assumes that _userName_, and _authcode_ have been set as defaults. _kw_ could have been provided as a field value in the form.  _redisplay_ is a function that does some appropriate followup action.
The form *must* include a unique _id_.  Form fields can include _q_, _kw_, _format_, _arg###_ (where ### is a 3 digit number, '0' padded, starting with '000'), and _argtype###_.
The _q_ query string (or the on-server query string referenced by _kw_) may include '%s' substition tokens, and an _arg###_ field should be provided for each such token.
_arg###_ fields may be *file* fields, and this is the surest way to submit binary data with the query.
The _argtype###_ fields are optional, but (if provided) should be numbered to match _arg###_ fields, and each value should be a Python DB API type string ('STRING', 'NUMBER', 'BINARY', ...). These are used by the server to typecast the argument values before passing them to PostgreSQL.
Any response data from the server will be passed to the callback.
Remember to avoid the use of '.preventDefault()' and 'return false', as the form itself does get submitted.
It is also recommended to explicitly set 'enctype' and 'method' attributes on the form.

[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_exdm_postbyform.html)

* *$.withResults:* functionally identical to $.postData.

* *$.eachRecord:* sends query to server, gets results, calls _errback_ if status is 'error', otherwise, calls _eachrec_ callback with each record.  By default, the _jsond-easy_ format is used, and each record is an object with named attribute for each record field.

* *$.loginAjax:* sends email and password to server, gets list of roles and authcodes

* *$.loginOpenId enables logging users in via OpenID logins.  This handles your users logging in to your app, not you
  logging in to your account.


[see demo here](http://www.paginaswww.com/rdb/examples/openid-login.html)


### Methods ###

* *$.fn.rdbhostSubmit:* waits for Connection to be ready, and submits form.
Only meaningful on submittable selection items such as forms, and should be used in preference to .submit() where the form has been prepared by $.postFormData, for submitting form data to Rdbhost.com.
Has no .rdbhostSubmit( function () {..} ) variant.

* *$.fn.populateTable:* sends query to server, gets results, and populates an html table with the data, one row per record.
If called on an empty _table_, it will create rows to match the records.
If called on a _div_, it will create a new _table_ in that _div_, and proceed as above.
If called on a table with pre-defined rows, it puts the data into cells based on matching the field name to the _td_ cell's _class_ value. If any class in the cell matches the field name, that is a match.

[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_exdm_table.html)

* *$.fn.populateForm:* sends query to server, gets results, and populates an html form with the data in the first record.
It attempts to match each field name to an input field with matching _id_, and then attempts to match an input field with matching _class_-name.

[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_exdm_formpop.html)

* *$.fn.datadump:* sends query, gets results, formats the data as a pretty-printed JSON string, and inserts it into each item in the selection set.  Intended as a diagnostic aid.

[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_exdm_dump.html)

=====

### SQLEngine ###
Documentation for the engine itself is in the source code.  Examples can be found in the 'examples' directory.  The datatables* examples all use the plain SQLEngine, rather than the plugin.
