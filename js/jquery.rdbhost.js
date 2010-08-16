/*
 
    jquery.rdbhost.js
    
    A jquery plugin to access PostgreSQL databases on Rdbhost.com
  
    requires a (free) account at www.rdbhost.com to be useful.
    
    this module includes a class 'SQLEngine' for the database connection, and
      that class can be used by itself, aside from the plugins.  jQuery 1.4+
      is required, even when using the connection class without the plugin.
      
       
    the module adds four functions and two methods to the jQuery namespace.
    
    The four functions are $.rdbHostConfig, $.withResults, $.eachRecord, and
      $.postFormData.  The two methods are $.fn.populate, and $.fn.datadump.
      
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
      
    Form fields
      The form *must* include either a 'q' or a 'kw' field.  It may also include
      'arg###', or 'argtype###' fields.  Argument fields are numbered like
      'arg000', 'arg001'... in order.  Argument type fields, 'argtype000'..
      must correspond to arg fields.
      
	  The 'kw' field value allows you to invoke a query that is stored in the
	  'lookup.queries' table on the  server.  See website documentation for
	  details.
      
    $.fn.populate sends a query to the server, receives the data, and populates
      an html table with it.  If the element provided is not a table, a new
      table is inserted in it; if the element is an empty table, it is expanded
      with new rows, one per record, and if the table has a prototype row, that
      row is duplicated once per record, and the record data is placed in
      td elements based on class name matches. (a field named 'firstName' would
      put its value in a table cell like '<td class="firstName">').  A cell
      can have multiple classes, so adding field-name classes should not interfere
      with styling.
      
    $.fn.datadump is a diagnostic-aid that puts a formatted json-string of
      the data into the selected html elements.  It allows you to verify the
      data retrieval functionality before doing (much) html work.
      
*/

// SQL Engine that uses form for input, and hidden iframe for response
//   handles file fields 
//
function SQLEngine(uName,authcode,subdomain)
{
	// store engine config info
	this.format = 'jsond';
	this.userName = uName;
	this.authcode = authcode;
	this.subdomain = subdomain || 'rdbhost';
	this.formnamectr = 0;
	
	// to add hidden field to form
	function add_hidden_field($form,nm,val) {
		var fld = $('<input type="hidden" class="to-remove-later" />');
		fld.attr('name',nm).val(val);
		$form.append(fld);
	}

	this.getQueryUrl = function(altPath) {
		var proto = window.location.protocol;
		var hparts = window.location.hostname.split('.').slice(-2);
		hparts.unshift(this.subdomain);
		if (!altPath) { altPath = '/db/'+this.userName; }
		return proto+'//'+hparts.join('.')+altPath;
	};
	this.getLoginUrl = function() {
		return this.getQueryUrl('/mbr/jslogin');
	};
	this.getCommonDomain = function() {
		var hparts = window.location.hostname.split('.').slice(-2);
		return hparts.join('.');
	};

	this.query = function(parms) 
	/* parms is object containing various options
		callback : function to call with data from successfull query
		errback : function to call with error object from query failure
		q : the query string itself
		args : array of arguments (optional), must correspond with %s tokens
			  in query
		argtypes : array of python DB API types, one per argument
		plainTextJson : true if JSON parsing to be skipped, in lieu of
				 returning the JSON plaintext
		format : 'jsond' or 'jsond-easy'
	*/
	{
		var callback = parms.callback;
		var errback = parms.errback;
		var query = parms.q;
		var kw = parms.kw;
		var args = parms.args || [];
		var argtypes = parms.argtypes || [];
		var plainText = parms.plainTextJson;
		var format = parms.format || this.format;
		
		var iframe_requested = false;
		var that = this;
		var formId = 'rdb_hidden_form_rdb_hidden_form_rdb'+(that.formnamectr+=1);
		var $hiddenform = $('#'+formId);
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}
		// local callbacks to do cleanup prior to 'real' callback
		function qErrback(err,msg) {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested) {
				parent.history.back();
			}
			iframe_requested = false;
			$hiddenform.remove();
			errback(err,msg);
		}
		function qCallback(json) {
			// if frame loaded by 'back button', skip over it
			if (!iframe_requested) {
				parent.history.back();
			}
			iframe_requested = false;
			$hiddenform.remove();
			callback(json);
		}
		// create hidden form if necessary
		if ( $hiddenform.length < 1 ) {
			var $newform = $(('<form method="post" name="~~id~~" id="~~id~~"'+
							  ' enctype="multipart/form-data" style="display:none">'+
							  ' </form>').replace(/~~id~~/g,formId));
			$('body').append($newform);
			$hiddenform = $('#'+formId);
		}
		// put query in hidden form
		add_hidden_field($hiddenform,'q',query);
		add_hidden_field($hiddenform,'kw',kw);
		// if params are provided, convert to named form 'arg000', 'arg001'...
		if (args !== undefined) {
			for ( var i=0; i<args.length; i+=1 ) {
				var num = '000'+i;
				var nm = 'arg'+num.substr(num.length-3);
				add_hidden_field($hiddenform,nm,args[i]);
			}
		}
		// remove submit handler, if one already, and bind new handler
		$hiddenform.unbind('submit');
		$hiddenform.submit(function () {
			iframe_requested = true;
			var res = that.queryByForm({ 'formId' : formId,
										  'callback' : qCallback,
										  'errback' : qErrback,
										  'format' : format,
										  'plainTextJson' : plainText });
			return res;
		});
		// submit the hidden form
		$hiddenform.submit();
	};
	
	
	this.queryRows = function(parms)
	/* parms is just like for query method, but callback gets row array and
	   header array, not whole data structure.
	   an additional param is 'incomplete', a function that is called
		 (with rows and header) when data set is truncated by 100 record limit
	*/
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
	
	
	this.queryByForm = function(parms)
	/* parms is object containing various options
		formId : the id of the form with the data
		callback : function to call with data from successfull query
		errback : function to call with error object from query failure
		plainTextJson : true if JSON parsing to be skipped, in lieu of
				 returning the JSON plaintext
	*/
	{
		var callback = parms.callback;
		var errback = parms.errback;
		var formId = parms.formId;
		var plainTextJson = parms.plainTextJson;
		var format = parms.format || this.format;
		
		var that = this;
		var targettag = 'upload_target'+formId;
		var target, action;
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		}
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}

		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
			if ($fr.length === 0) {
				alert('target "~" iframe document not found'.replace('~',targettag));
			}
			var cont = $.trim($fr.find('body script').html());
			var json_result, stat;
			if ( cont ) {
				//cont = cont.replace(/^\s*<pr[^>]+>/i,''); // remove opening pre
				//cont = cont.replace(/<[/]pr[^>]+\s*>$/i,''); // remove end pre
				if (cont.substr(0,1)==='{') {
					if ( plainTextJson ) {
						callback(cont);
					}
					else {
						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							errback('json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							errback(json_result.status[1],json_result.error[1]);
						}
						else {
							callback(json_result);
						}
					}
				}
				else {
					errback('not json '+cont.substr(0,3));
				}
			}
			else {
				errback('no content');
			}
		}
		// function to cleanup after data recieved
		function cleanup_submit(formtag) {
			var $form = $('#'+formtag);
			$form.find('.to-remove-later').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			$('#'+targettag).remove();
		}
		// init vars
		var dbUrl =  this.getQueryUrl(); 
		//dbUrl = "http://rdbhost.paginaswww.com/helloalert.html";
		target = $form.attr('target'); // save vals
		action = $form.attr('action');
		// put password into form
		add_hidden_field($form,'authcode', this.authcode);
		// set format, action, and target
		add_hidden_field($form,'format',format);
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);
		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';
		if ( $('#'+targettag).length === 0 ) {
			iframeTxt = iframeTxt.replace(/~tt~/g,targettag);
			$('body').append($(iframeTxt));
			// bind action functions to hidden iframe
			$('#'+targettag).load(function() {
				results_loaded(callback,errback);
				cleanup_submit(formId);
			});
		}
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();
		//alert('new windocdom: '+window.document.domain);
		return true;
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

		$.ajax({type: "POST",
				url: jsloginUrl,
				async: false,
				data: {'password' : passwd,
					   'email' : email },
				dataType: "json",
				success: function(d)
				{
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

	this.loginByForm = function(parms)
	/* parms is object containing various options
		formId : the id of the form with the data
		callback : function to call with data from successfull query
		errback : function to call with error object from query failure
		plainTextJson : true if JSON parsing to be skipped, in lieu of
				 returning the JSON plaintext
	*/
	{
		var callback = parms.callback;
		var errback = parms.errback;
		var formId = parms.formId;
		var plainTextJson = parms.plainTextJson;
		
		var that = this;
		// get form, return if not found
		var $form = $('#'+formId);
		if ($form.length<1) {
			alert('form '+formId+' not found');
			return false;
		}
		var target = $form.attr('target'); // save vals
		var action = $form.attr('action');
		var targettag = 'upload_target'+formId;
		// define default errback
		if (errback === undefined) {
			errback = function () {
				var arg2 = Array.apply(null,arguments);
				alert(arg2.join(', '));
			};
		}
		// function to handle json when loaded		
		function results_loaded(callback,errback) {
			//
			var $fr = $(frames[targettag].document);
			if ($fr.length === 0) {
				alert('target "~" iframe document not found'.replace('~',targettag));
			}
			var cont = $.trim($fr.find('body script').html());
			var json_result, stat;
			if ( cont ) {
				if (cont.substr(0,1)==='{') {
					if ( plainTextJson ) {
						callback(cont);
					}
					else {
						try {
							json_result = JSON.parse(cont);
						}
						catch(err) {
							errback('json err: '+err.toString());
							return;
						}
						if (json_result.status[0] === 'error') {
							errback(json_result.status[1],json_result.error[1]);
						}
						else {
							callback(json_result);
						}
					}
				}
				else {
					errback('not json '+cont.substr(0,3));
				}
			}
			else {
				errback('no content');
			}
		}
		// function to cleanup after data recieved
		function cleanup_submit(formtag) {
			var $form = $('#'+formtag);
			$form.find('.to-remove-later').remove();
			$form.attr('target',target);  // restore saved target,action
			$form.attr('action',action);
			$('#'+targettag).remove();
		}
		// init vars
		var dbUrl =  this.getLoginUrl(); 
		// set format, action, and target
		add_hidden_field($form,'format',this.format);
		$form.attr('target',targettag);
		$form.attr('action',dbUrl);
		// add hidden iframe to end of body
		var iframeTxt = '<iframe id="~tt~" name="~tt~" src="" style="display:none;" ></iframe>';
		if ( $('#'+targettag).length === 0 ) {
			iframeTxt = iframeTxt.replace(/~tt~/g,targettag);
			$('body').append($(iframeTxt));
			// bind action functions to hidden iframe
			$('#'+targettag).load(function() {
				results_loaded(callback,errback);
				cleanup_submit(formId);
			});
		}
		var winDomain = window.document.domain;
		window.document.domain = this.getCommonDomain();
		return true;
	};
	
} // end of SQLEngine class


/*
  following section defines some jQuery plugins
  
*/

(function ($) {
	
	// default generic callbacks
	//
	function errback(err,msg) {
		alert('<pre>'+err.toString()+': '+msg+'</pre>');
	}
	function dumper(json) {
		var str = JSON.stringify(json);
		alert(str);
	}
	
	//  configuration setting function
	//  saves defaults as attribute on the config function
	//
	var opts = { errback : errback,
		         callback : dumper,
				 eachrec : undefined,
				 subdomain : 'rdbhost',
				 format : 'jsond-easy',
				 userName : '',
				 authcode : ''        };
	var rdbHostConfig= function (parms) {
		var options = $.extend({}, opts, parms||{});
		rdbHostConfig.opts = options;
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
		var inp = $.extend({}, $.rdbHostConfig.opts, parms||{});
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.subdomain);
		delete inp.userName; delete inp.authcode; delete inp.subdomain;
		sqlEngine.query(inp);
	}
	$.withResults = withResults;
	
	/*
	    eachRecord - calls 'eachrec' callback with each record,
	      or errback with error object
	  
	    param q : query to get data
	    param eachrec : function to call with each record
	    param errback : function to call in case of error
	*/
	var eachRecord = function(parms) {
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
	}
	$.eachRecord = eachRecord;

	/*
	    postFormData should be used as a submit handler for a data entry form.
	
	    param q : query to post data
	    param kw : query-keyword to post data
	*/
	var postFormData = function(that,parms) {
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
		var sqlEngine = new SQLEngine(inp.userName, inp.authcode, inp.subdomain);
		delete inp.userName; delete inp.authcode; delete inp.subdomain;
		sqlEngine.queryByForm(inp);
		return true;
	};
	$.postFormData = postFormData;

	/*
	    populate creates an html table and inserts into  page
	    
	    param q : query to get data
	*/
	var populate = function(parms) {
		var $selset = this;
		function populate_html_table($table,$row,recs) {
			var rec, $newrow;
			$table.find('tbody').empty();
			for (var r in recs) {
				rec = recs[r];
				$newrow = $row.clone().show();
				var ctr = 0, flds = [];
				for (var fname in rec) {
					$newrow.find('td.'+fname).html(rec[fname]);
					ctr += $newrow.find('td.'+fname).length;
					flds.push(fname);
				};
				assert(ctr,'no td elements found with field names! '+flds.join(', '));
				$table.append($newrow);
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
				if (!$table.is('table')) {
					$table.empty().append('<table></table>');
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
		};
		parms.callback = cback;
		$.withResults(parms);
		return $selset;
	};
	$.fn.populate = populate;
	
	/*
	    datadump puts a <pre>-formatted json dump into the html
	
	    param q : query to get data
	    param kw : query-keyword to get data
	*/
	var datadump = function(parms) {
		var $selset = this;
		function cback (json) {
			$selset.each( function () {
				$(this).html(JSON.stringify(json,null,4)); // 4 space indent
			});
		};
		parms.callback = cback;
		$.withResults(parms);
		return $selset;
	};
	$.fn.datadump = datadump;
		
}(jQuery));


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

