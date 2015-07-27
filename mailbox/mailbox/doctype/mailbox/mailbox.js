frappe.provide("mailbox")
frappe.ui.form.on("Mailbox", "refresh", function(frm) {
	if (frm.doc.docstatus===0 && parseInt(frm.doc.__islocal)!=1){
		frm.add_custom_button(__("Forward"), function() { new mailbox.Composer({
				doc: frm.doc,
				frm: frm,
				action: "forward",
				title:"",
			}) 
		});
		frm.add_custom_button(__("Reply"), function() { new mailbox.Composer({
				doc: frm.doc,
				frm: frm,
				action: "reply",
			}) 
		});
	};
	if (frm.doc.docstatus===0){
		frappe.call({
			method:"mailbox.mailbox.doctype.inbox.inbox.check_contact",
			args:{"contact":frm.doc.sender},
			callback: function(r) {
				if (r.message){
					msgprint(r.message)
				}
				
			}
		});
	};	
	frm.add_custom_button(__("Compose New"), function() { new mailbox.Composer({
			doc: frm.doc,
			frm: frm,
			action:"compose",
			ref_no:Math.floor(Date.now() / 1000)
		}) 
	});
});
frappe.ui.form.on("Mailbox", "customer", function(frm) {
	if (frm.doc.supplier){
		msgprint('You Can Either Select Customer or Supplier')
		frm.set_value('customer','')
	}
})
frappe.ui.form.on("Mailbox", "supplier", function(frm) {
	if (frm.doc.customer){
		msgprint('You Can Either Select Customer or Supplier')
		frm.set_value('supplier','')
	}
})

mailbox.Composer = Class.extend({
	init: function(opts) {
		$.extend(this, opts);
		this.make()
	},
	make: function() {
		var me = this;
		this.dialog = new frappe.ui.Dialog({
			title: __("Compose"),
			no_submit_on_enter: true,
			fields: [
				{label:__("From"), fieldtype:"Data", reqd: 1, fieldname:"sender"},
				{fieldtype: "Column Break"},
				{label:__("To"), fieldtype:"Data", reqd: 1, fieldname:"recipient"},
				{fieldtype: "Section Break"},
				{label:__("CC"), fieldtype:"Data", fieldname:"cc"},
				{label:__("BCC"), fieldtype:"Data", fieldname:"bcc"},

				{fieldtype: "Section Break"},
				{label:__("Subject"), fieldtype:"Data", reqd: 1,
					fieldname:"subject"},

				{fieldtype: "Section Break"},
				{label:__("Customer"), fieldtype:"Data", fieldname:"customer"},
				{fieldtype: "Column Break"},
				{label:__("Supplier"), fieldtype:"Data", fieldname:"supplier"},
						
				{fieldtype: "Section Break"},
				{label:__("Message"), fieldtype:"Text Editor", reqd: 1,
					fieldname:"content"},

				{fieldtype: "Section Break"},
				{fieldtype: "Column Break"},
				{label:__("Send As Email"), fieldtype:"Check",
					fieldname:"send_email","default":1},
					
				{fieldtype: "Column Break"},
				{label:__("Select Attachments"), fieldtype:"HTML",
					fieldname:"select_attachments"}
				
			],
			primary_action_label: "Send",
			primary_action: function() {
				me.send_action();
			}
		});

		this.prepare();
		this.dialog.show();
	},
	prepare: function() {
		var me = this;
		if (this.action != 'compose'){
			this.setup_subject_and_recipients();
			this.setup_attach();
			this.setup_email();
			this.setup_earlier_reply();
		}
		else if (this.action == 'compose'){
			this.attachments_for_compose();
		}	
		this.setup_autosuggest();
		$(this.dialog.fields_dict.recipient.input).val(this.recipient || "").change();
		$(this.dialog.fields_dict.subject.input).val(this.subject || "").change();
	},
	attachments_for_compose:function(){
		var me = this;
		var fields = this.dialog.fields_dict;
		var attach = $(fields.select_attachments.wrapper);
		$('<ul class="list-unstyled sidebar-menu form-attachments">\
			<li class="divider"></li> <li class="h6 attachments-label">Attachments</li>\
			<li class="divider"></li> <li><a class="strong add-attachment">Attach File \
			<i class="octicon octicon-plus" style="margin-left: 2px;"></i></a></li></ul>').appendTo(attach)

		this.attachments = new frappe.ui.form.Attachment({
			parent : attach,
			frm : this.dialog,
			ref_no : me.ref_no
		});
	},
	setup_subject_and_recipients = function() {
        
		this.subject = "";
		this.recipients = "";

		if(this.action_p == 'reply') {
			$(this.dialog.fields_dict.recipients.input).attr('disabled',true)
			this.recipients = this.doc.sender
		}
		
		if(!this.subject && frm) {
			// get subject from last communication
			if(this.action == 'reply') {
				this.subject = this.doc.subject;
				if(!this.recipients) {
					this.recipients = this.doc.sender;
				}
				// prepend "Re:"
				if(strip(this.subject.toLowerCase().split(":")[0])!="re") {
					this.subject = "Re: " + this.subject;
				}
			}
			if(this.action == 'forward') {
				this.subject = this.doc.subject;
				// prepend "Fwd:"
				if(strip(this.subject.toLowerCase().split(":")[0])!="fwd") {
					this.subject = "Fwd: " + this.subject;
				}
			}

			if (!this.subject) {
				this.subject = __(this.frm.doctype) + ': ' + this.frm.docname;
			}
		}
	},
	setup_attach = function() {
		if (!frm) return;

		var fields = this.dialog.fields_dict;
		var attach = $(fields.select_attachments.wrapper);

		var files = frm.get_files();
		if(files.length) {
			$("<h6 class='text-muted' style='margin-top: 12px;'>"
				+__("Add Attachments")+"</h6>").appendTo(attach.empty());
			$.each(files, function(i, f) {
				if (!f.file_name) return;
				f.file_url = frappe.urllib.get_full_url(f.file_url);

				$(repl('<p class="checkbox">'
					+	'<label><span><input type="checkbox" data-file-name="%(name)s"></input></span>'
					+		'<span class="small">%(file_name)s</span>'
					+	' <a href="%(file_url)s" target="_blank" class="text-muted small">'
					+		'<i class="icon-share" style="vertical-align: middle; margin-left: 3px;"></i>'
					+ '</label></p>', f))
					.appendTo(attach)
			});
		}
	},
	send_action: function() {
		var me = this,
		form_values = me.dialog.get_values(),
		btn = me.dialog.get_primary_btn();
		if(!form_values) return;
		if (this.action == 'compose'){
			me.send_new_email(btn, form_values);
		}
		else{
			var selected_attachments = $.map($(me.dialog.wrapper)
			.find("[data-file-name]:checked"), function(element) {
				return $(element).attr("data-file-name");
			})
			me.send_email(btn, form_values, selected_attachments);	
		}
		//}
	},
	send_new_email: function(btn, form_values, selected_attachments) {
		var me = this;
		return frappe.call({
			method:"mailbox.mailbox.doctype.compose.compose.make",
			args: {
				recipients: form_values.recipient,
				subject: form_values.subject,
				content: form_values.content,
				send_email: form_values.send_email,
				ref_no:this.ref_no
			},
			btn: btn,
			callback: function(r) {
				if(!r.exc) {
					if (!r.message.not_valid){
						if(form_values.send_email && r.message["recipients"])
							msgprint(__("Email sent to {0}", [r.message["recipients"]]));
						me.dialog.hide();
					}
					else{
						msgprint(__("Recipients Not Valid"));	
					}	
				} else {
					msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	},
	send_email = function(btn, form_values, selected_attachments) {
		var me = this;

		return frappe.call({
			method:"mailbox.mailbox.doctype.inbox.inbox.make",
			args: {
				recipients: form_values.recipients,
				subject: form_values.subject,
				content: form_values.content,
				doctype: me.doc.doctype,
				name: me.doc.name,
				send_email: form_values.send_email,
				attachments: selected_attachments,
				email_account:me.doc.email_account,
				doc:me.doc,
				forward_or_reply:me.action
			},
			btn: btn,
			callback: function(r) {
				if(!r.exc) {
					if(form_values.send_email && r.message["recipients"])
						msgprint(__("Email sent to {0}", [r.message["recipients"]]));
					me.dialog.hide();
					refresh_field("tag")
				} else {
					msgprint(__("There were errors while sending email. Please try again."));
				}
			}
		});
	},
	setup_autosuggest : function() {
		var me = this;

		function split( val ) {
			return val.split( /,\s*/ );
		}
		function extractLast( term ) {
			return split(term).pop();
		}

		$(this.dialog.fields_dict.recipient.input)
			.bind( "keydown", function(event) {
				if (event.keyCode === $.ui.keyCode.TAB &&
						$(this).data( "autocomplete" ) &&
						$(this).data( "autocomplete" ).menu.active ) {
					event.preventDefault();
				}
			})
			.autocomplete({
				source: function(request, response) {
					return frappe.call({
						method:'frappe.email.get_contact_list',
						args: {
							'select': "email_id",
							'from': "Contact",
							'where': "email_id",
							'txt': extractLast(request.term).value || '%'
						},
						quiet: true,
						callback: function(r) {
							response($.ui.autocomplete.filter(
								r.cl || [], extractLast(request.term)));
						}
					});
				},
				appendTo: this.dialog.$wrapper,
				focus: function() {
					// prevent value inserted on focus
					return false;
				},
				select: function( event, ui ) {
					var terms = split( this.value );
					// remove the current input
					terms.pop();
					// add the selected item
					terms.push( ui.item.value );
					// add placeholder to get the comma-and-space at the end
					terms.push( "" );
					this.value = terms.join( ", " );
					return false;
				}
			});
	},
	setup_earlier_reply = function() {
		var fields = this.dialog.fields_dict,
		signature = frappe.boot.user.email_signature || "";
		

		if(!frappe.utils.is_html(signature)) {
			signature = signature.replace(/\n/g, "<br>");
		}

		if(this.txt) {
			this.message = this.txt + (this.message ? ("<br><br>" + this.message) : "");
		}

		if(this.real_name) {
			this.message = '<p>'+__('Dear') +' '
				+ this.real_name + ",</p>" + (this.message || "");
		}

		var reply = (this.message || "")
			+ (signature ? ("<br>" + signature) : "");

		if(this.action == 'reply') {
			//var last_email_content = last_email.original_comment || last_email.comment;
			var last_email_content = this.doc.content;
			fields.content.set_input(reply
				+ "<br><!-- original-reply --><br>"
				+ '<blockquote>' +
					'<p>' + __("On {0}, {1} wrote:",
					[frappe.datetime.global_date_format(this.doc.creation) , this.doc.user]) + '</p>' +
					last_email_content +
				'<blockquote>');
		}
		if(this.action == 'forward') {
			//var last_email_content = last_email.original_comment || last_email.comment;
			var last_email_content = this.doc.content;
			fields.content.set_input(reply
				+ "<br>------ Forwarded message--------<br>"
				+ '<p>' + __("From: {0} \< {1} \><br>Date:{2}<br>Subject:{3}<br>To:{4}",
					[this.doc.sender_full_name,this.doc.sender,frappe.datetime.global_date_format(this.doc.creation),this.doc.subject,this.doc.recipients]) + '</p>' +
					last_email_content);
		} 
	}
});
