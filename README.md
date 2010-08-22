
## The Javascript Module for Accessing Rdbhost ##  
## jQuery.rdbhost.js ##

### Dependencies ###
This module requires jQuery.  Version 1.4 or greater is recommended.

### Overview ###
The module includes a class, *SQLEngine*, that encapsulates the interactions with the server, and a 
jQuery plugin.  The class can be used directly, without the plugin, but the plugin is intended to be easier. 

### The Plugin ###
Included are four _functions_ (called on the jQuery object) and three _methods_ (called on selection sets).  All of them take option objects as their only or second parameter. 

### Options ###
Before we discuss the functions and methods themselves, let's go over the options.  Some are required, some optional (a _required_ _option_ ? yep).  A default can be set for each, via the $.rdbHostConfig function, or included in each function or method call.

* *userName:* PostgreSQL rolename used for the connection; rolename is 10 digit account number, preceded by 's', 'a', 'p', or 'r'. *required*

* *authcode:* 'authentication code' for role.  50 base-64 digits. *required*

* *q:* the query, in SQL.  Some roles can not execute free-form queries. Either _q_ or _kw_ is *required*.

* *kw:* a lookup keyword, used to lookup a query pre-stored on the server. All roles can execute queries via _kw_.  Either _q_ or _kw_ is *required*.

* *args:* an array with arguments to replace substitution tokens in the query string.  The number of _args_ elements should match the number of substitution tokens in the query string.  Can be used with _kw_s also, in which case the args interpolate into the query string on the server, indexed by the _kw_ value.

* *argtypes:* an array with types for the arguments. 
If provided, the length should be the same as the args array. The values are Python DB API types, such as 'NUMERIC', 'STRING', 'BINARY'...

* *format:* either _jsond_ or _jsond-easy_. default = _jsond-easy_. 

* *subdomain:* if your domain pointer to our server does not use the subdomain _rdbhost_, provide the actual subdomain here. default = _rdbhost_.

* *callback:* a function that gets called with the data, once data is received.  Used by functions, not by methods. 
Not required, but the default is a basic _*JSON*_ dump and probably not what you want.

* *errback:* a function that gets called when there is an error in the data retrieval.  Default raises an exception.

* *eachrec:* the $.eachRecord function calls this, for each record, in lieu of _callback_.

### Functions ###
* *$.rdbHostConfig:* Stores its options as the default for all subsequent functions. It can accept *any* or *all* of the options.

* *$.withResults:* sends query to server, gets results, calls callback with single result object as the parameter.
Requires _callback_ and _q_ or _kw_.

* *$.eachRecord:* sends query to server, gets results, calls _errback_ if status is 'error', otherwise, calls _eachrec_ callback with each record.  By default, the _jsond-easy_ format is used, and each record is an object with named attribute for each record field.

* *$.postData:* used to submit data to server, similar to an $.ajax call. 

        $.ready(function () { 
            $.postData( { kw : 'logthispage',
                          args : [ 'test page loaded' ],
                          callback : function(){} }); 
        }); 

    The above example assumes that _userName_, and _authcode_ have been set as defaults. 
The _q_ query string (or the on-server query string referenced by _kw_) may include '%s' substition tokens, and an _args_ options must then be provided, with an element for each such token.  
[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_post.html)

* *$.postFormData:* used to submit data to server. Call this function from a *submit* or *click* handler on the form, like:  

        $('#demo-form').submit(function () { 
            $.postFormData(this,
                           {'kw':'updater',
                            'callback':redisplay}); 
        }); 
 
    The above example assumes that _userName_, and _authcode_ have been set as defaults. _kw_ could have been provided as a field value in the form.  _redisplay_ is a function that does some appropriate followup action.
The form *must* include a unique _id_.  Form fields can include _q_, _kw_, _format_, _arg###_ (where ### is a 3 digit number, '0' padded, starting with '000'), and _argtype###_.  
The _q_ query string (or the on-server query string referenced by _kw_) may include '%s' substition tokens, and an _arg###_ field should be provided for each such token.  
The _argtype###_ fields are optional, but (if provided) should be numbered to match _arg###_ fields, and each value should be a Python DB API type string ('STRING', 'NUMBER', 'BINARY', ...). These are used by the server to typecast the argument values before passing them to PostgreSQL.
[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_postbyform.html)

### Methods ###

* *$.fn.populateTable:* sends query to server, gets results, and populates an html table with the data, one row per record. 
If called on an empty _table_, it will create rows to match the records.  
If called on a _div_, it will create a new _table_ in that _div_, and proceed as above.  
If called on a table with pre-defined rows, it puts the data into cells based on matching the field name to the _td_ cell's _class_ value. If any class in the cell matches the field name, that is a match.
[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_table.html)

* *$.fn.populateForm:* sends query to server, gets results, and populates an html form with the data in the first record.  
It attempts to match each field name to an input field with matching _id_, and then attempts to match an input field with matching _class_-name.
[see demo here](http://www.paginaswww.com/rdb/examples/jq_rdbhost_formpop.html)

* *$.fn.datadump:* sends query, gets results, formats the data as a pretty-printed JSON string, and inserts it into each item in the selection set.  Intended as a diagnostic aid.
