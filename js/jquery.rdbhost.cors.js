/*

    jquery.rdbhost.cors.js

    A jquery plugin to access PostgreSQL databases on Rdbhost.com

    requires a (free) account at www.rdbhost.com to be useful.

    this module includes a class 'SQLEngine' for the database connection, and
      that class can be used by itself, aside from the plugins.  jQuery 1.4+
      is required, even when using the connection class without the plugin.

    the module adds four functions and three methods to the jQuery namespace.

    The four functions are $.rdbHostConfig, $.withResults, $.eachRecord, and
      $.postFormData.  The three methods are $.fn.populateTable,
      $.fn.populateForm, and $.fn.datadump.

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
      The form fields must conform to the rdbhost protocol, that is, they
      must have the names listed on the http:www.rdbhost.com/protocol.html page.

    Form fields
      The form *must* include either a 'q' or a 'kw' field.  It may also include
      'arg###', or 'argtype###' fields.  Argument fields are numbered like
      'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'..
      must correspond to arg fields.  Argument fields may NOT be file fields.
      Use jquery.rdbhost.js if you need file fields or binary.

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
      first field, and populates a form with it.  It attempts to match each field
      name to an input field with matching id, and then attempts to match an input
      field with matching class-name.

    $.fn.datadump is a diagnostic-aid that puts a formatted json-string of
      the data into the selected html elements.  It allows you to verify the
      data retrieval functionality before doing (much) html work.

*/

// SQL Engine that uses AJAX, and functions on browsers that support the
//   CORS extension to HTTP
//
function SQLEngine(uName,authcode,domain)
{

	// store engine config info
	this.format = 'json';
	this.userName = uName;
	this.authcode = authcode;
	this.domain = domain || 'www.rdbhost.com';

	this.getQueryUrl = function(altPath) {

		var proto = window.location.protocol;
		if (!altPath) { altPath = '/db/'+this.userName; }
		return proto+'//'+this.domain+altPath;
	};

	this.getLoginUrl = function() {

		return this.getQueryUrl('/mbr/jslogin');
	};

    /* parms is object containing various options
     callback : function to call with data from successful query
     errback : function to call with error object from query failure
     q : the query string itself
     args : array of arguments (optional), must correspond with %s tokens
     in query
     argtypes : array of python DB API types, one per argument
     plainTextJson : true if JSON parsing to be skipped, in lieu of
     returning the JSON plaintext
     format : 'json' or 'json-easy'
     */
	this.query = function(parms)
	{
		var callback = parms.callback;
		var errback = parms.errback;
		var query = parms.q;
		var kw = parms.kw;
		var args = parms.args || [];
		var argtypes = parms.argtypes || [];
		var plainText = parms.plainTextJson;
		var format = parms.format || this.format;

		var that = this;

		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

		// super callback that checks for server side errors, calls errback
		//  where appropriate
		function qCallback(json) {

			if ( json.status[0] === 'error' ) {
				errback(json.status[1],json.error.toString());
			}
			else {
				callback(json);
			}
		}

		// create data record
		var data = { 'format' : format,
			           'q' : query };
        if ( kw !== undefined && kw !== null )
	    	data['kw'] = kw;

		// iterate over arg and argtype lists, and add
		//  arg### values to data
		var argn = '', argntype, istr;

        for ( var i=0; i<args.length; i++ ) {

			istr = '00'+i;
			argn = 'arg'+istr.substring(istr.length-3);
			data[argn] = args[i];

			if ( i<argtypes.length && argtypes[i] !== undefined ) {

				argntype = 'argtype'+istr.substring(istr.length-3);
				data[argntype] = argtypes[i];
			}
		}

		// use jQuery ajax call to submit to server
        $.ajax({
            type: "POST",
            url: this.getQueryUrl(),
            data: data,
            dataType: 'json',
            success: qCallback,
            error: errback
        });

	};


    /* parms is just like for query method, but callback gets row array and
     header array, not whole data structure.
     an additional param is 'incomplete', a function that is called
     (with rows and header) when data set is truncated by 100 record limit
     */
	this.queryRows = function(parms)
	{
		var callback = parms.callback;
		var incomplete_callback = parms.incomplete || callback;

		function cb(json) {

			var rows = json.records.rows || [];
			var status = json.status[0];
			var header = json.records.header || [];

			if (status === 'complete') {
				callback(rows,header);
			}
			else if (status === 'incomplete') {
				incomplete_callback(rows,header);
			}
		}

		parms.callback = cb;
		this.query(parms);
	};


    /* parms is object containing various options
     formId : the id of the form with the data
     callback : function to call with data from successfull query
     errback : function to call with error object from query failure
     plainTextJson : true if JSON parsing to be skipped, in lieu of
     returning the JSON plaintext
     */
	this.queryByForm = function(parms)
	{
		var callback = parms.callback;
		var errback = parms.errback;
		var formId = parms.formId;
		var plainTextJson = parms.plainTextJson;
		var format = parms.format || this.format;

		var that = this;

		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			//alert('form '+formId+' not found');
			return false;
		}

		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

		// super callback that checks for server side errors, calls errback
		//  where appropriate
		function qCallback(json) {

			if ( json.status[0] === 'error' ) {
                errback(json.status[1],json.error.toString());
			}
			else {
				callback(json);
			}
		}

		// iterate over arg and argtype lists, and add
		//  arg### values to data
		var argn = '', argntype, istr, data = {}, fldnm;
		var labels = ['q','kw','format'];

		for (var i in labels) {

          fldnm = labels[i];
          if ($form.find('#'+fldnm).length) {
            data[fldnm] = $form.find('#'+fldnm).val();
          }
		}

		for ( var i=0; i<1000; i++ ) {

			istr = '00'+i;
			argn = 'arg'+istr.substring(istr.length-3);
			fld = $form.find('#'+argn);

			if (fld.length>0) {
				data[argn] = fld.val();
			}
			else {
				break;
			}

			argntyp = 'argtype'+istr.substring(istr.length-3);
			fldtyp = $form.find('#'+argntyp);

			if (fldtyp.length > 0) {
				data[argntyp] = fldtyp.val();
			}
		}
		// ensure data type requests
		if (!data['format']) {
			data['format'] = 'json';
		}

		// use jQuery ajax call to submit to server
		var url = this.getQueryUrl();

        $.ajax({
            type: "POST",
            url: url,
            data: data,
            dataType: 'json',
            success: qCallback,
            error: errback
        });

		return false;
	};

	/* loginAjax
	   logs in with email and password.  If on www.rdbhost.com and user logged
	   in to rdbhost account, email/password are optional.

	   only works on rdbhost.com, at this point
	*/
	this.loginAjax = function(email,passwd)
	{
		var stat;
		var jsloginUrl = this.getLoginUrl();
		alert('jsLogin url: '+jsloginUrl);

		$.ajax({

      type: "POST",
			url: jsloginUrl,
			async: false,

			data: {'password' : passwd,
				     'email' : email },

			dataType: "json",

			success: function(d) {

        if (d === null || d === '' || d === undefined) {
					alert('login failed: timeout');
					stat = false;
				}
				else if (d.status[0] === 'error') {
					alert('login db failed: '+d.status[1]);
					stat = false;
				}
				else if (d.status[0] === 'complete') {
					stat = d.roles;
				}
				else {
					alert('wonkers! status: '+d.status[0]);
					stat = false;
				}
			},

			error: function(xhr,errtype,exc)
			{
				// set page location elsewhere
				alert('login connect failed: '+errtype);
				stat = false;
			}
		});

		return stat;
	};

} // end of SQLEngine class
SQLEngine.formnamectr = 0;


/*
  following section defines some jQuery plugins

*/

(function ($,window) {

	// default generic callbacks
	//
	function errback(err,msg) {

		alert('<pre>'+err.toString()+': '+msg+'</pre>');
	}

    function dumper(json) {

		var str = JSON.stringify(json,null,4);
		alert(str);
	}

	//  configuration setting function
	//  saves defaults as attribute on the config function
	//
	var opts = {
        errback : errback,
        callback : dumper,
        eachrec : undefined,
        format : 'json-easy',
        userName : '',
        authcode : ''   };

	var rdbHostConfig = function (parms) {

      rdbHostConfig.opts = $.extend( {}, opts, parms||{} );
	};

    $.rdbHostConfig = rdbHostConfig;  // makes it a plugin

	/*
	    withResults - calls callback with json result object
	      or errback with error object

	    param q : query to get data
	    param callback : function to call with json data
	    param errback : function to call in case of error
	*/
	var withResults = function(parms) {

		assert(arguments.length<=1, 'too many parms to withResults');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode;
		sqlEngine.query(inp);
	};

	$.withResults = withResults;

	/*
	    eachRecord - calls 'eachrec' callback with each record,
	      or errback with error object

	    param q : query to get data
	    param eachrec : function to call with each record
	    param errback : function to call in case of error
	*/
	var eachRecord = function(parms) {

		assert(arguments.length<=1, 'too many parms to eachRecord');
		var eachrec = parms.eachrec;
		delete parms.eachrec;
		assert(eachrec, 'eachrec not provided');

		function cback (json) {
			for (var r in json.records.rows) {
				eachrec(json.records.rows[r]);
			}
		}

		parms.callback = cback;
		$.withResults(parms);
	};

	$.eachRecord = eachRecord;

	/*
	    postFormData should be used as a submit handler for a data entry form.

	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postFormData = function(that,parms) {

		assert(arguments.length<=2, 'too many parms to postFormData');
		var $form = $(that).closest('form');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		inp.formId = $form.attr('id');
		assert(inp.formId,'form must have a unique id attribute');

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

		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode;
		sqlEngine.queryByForm(inp);

		return false;
	};

	$.postFormData = postFormData;

	/*
	    postData submits some data (in the options object) to the server
	      and provides the response to callback.

	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postData = function(parms) {

		assert(arguments.length<2, 'too many parms to postData');
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.domain);
		delete inp.userName; delete inp.authcode;
		sqlEngine.query(inp);

		return true;
	};

	$.postData = postData;

	/*
	    populateTable creates an html table and inserts into  page

	    param q : query to get data
	*/
	var populateTable = function(parms) {

		assert(arguments.length<=1, 'too many parms to populateTable');
		var $selset = this;

		if (typeof(parms) === 'string') {

			parms = { 'q' : parms };
		}

        function populate_html_table($table,$row,recs) {

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

                $newrow.find('td.'+fname).html(rec[fname]);
                ctr += $newrow.find('td.'+fname).length;
                flds.push(fname);
              }

              assert(ctr,'no td elements found with field names! '+flds.join(', '));
              $table.append($newrow);
            }
          }
        }

		function generate_html_table($table,recs) {

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

		function cback (json) {

			var recs = json.records.rows;

			$selset.each( function () {

				var $table = $(this);
				assert( !$table.is('form'), 'use .populateForm for forms' );

				if (!$table.is('table')) {

					$table.empty().append('<table><tbody></tbody></table>');
					$table = $table.find('table');
					generate_html_table($table,recs);
				}
				else if ( $table.find('tbody tr:first').length ) {

					var $row = $table.find('tbody tr:first').hide();
					populate_html_table($table,$row,recs);
				}
				else {

					generate_html_table($table,recs);
				}
			});
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.populateTable = populateTable;

	/*
	    populateForm populates a form with a single record

	    param q : query to get data
	*/
	var populateForm = function(parms) {

		assert(arguments.length<=1, 'too many parms to populateForm');
		var $selset = this;

		if (typeof(parms) === 'string') {

			parms = { 'q' : parms };
		}

		function populate_form($form,rec) {

			for (var f in rec) {

				var $inp = $form.find('input#'+f);

				if ($inp.length) {

					$inp.val(rec[f]);
				}
				else {

					$inp = $form.find('input.'+f);
					$inp.val(rec[f]);
				}
			}
		}

		function cback (json) {

			if (json.records.rows.length) {

				var rec = json.records.rows[0];

				$selset.each( function () {

					var $form = $(this);
					assert( $form.is('form'), 'use .populateForm on a form' );
					populate_form($form,rec);
				});
			}
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.populateForm = populateForm;

	/*
	    datadump puts a <pre>-formatted json dump into the html

	    param q : query to get data
	    param kw : query-keyword to get data
	*/
	var datadump = function(parms) {

		var $selset = this;

		if (typeof(parms) === 'string') {

			parms = { 'q' : parms };
		}

		function cback (json) {

			$selset.each( function () {
				$(this).html(JSON.stringify(json,null,4)); // 4 space indent
			});
		}

		parms.callback = cback;
		$.withResults(parms);

		return $selset;
	};

	$.fn.datadump = datadump;

}(jQuery,this));


/* create assert function
  example : assert( obj === null, 'object was not null!' );
  error message appears in javascript console, if any.
  credit to: Ayman Hourieh http://aymanh.com/
*/
function AssertException(message) { this.message = message; }
AssertException.prototype.toString = function () {
  return 'AssertException: ' + this.message;
};
function assert(exp, message) {
  if (!exp) {
    throw new AssertException(message);
  }
}

