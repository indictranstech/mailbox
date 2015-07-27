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
				{label:__("CC"), fieldtype:"Data", reqd: 1, fieldname:"cc"},
				{label:__("BCC"), fieldtype:"Data", reqd: 1, fieldname:"bcc"},

				{fieldtype: "Section Break"},
				{label:__("Subject"), fieldtype:"Data", reqd: 1,
					fieldname:"subject"},

				{fieldtype: "Section Break"},
				{label:__("Customer"), fieldtype:"Data", reqd: 1, fieldname:"customer"},
				{fieldtype: "Column Break"},
				{label:__("Supplier"), fieldtype:"Data", reqd: 1, fieldname:"supplier"},
						
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
	send_action: function() {
		var me = this,
		form_values = me.dialog.get_values(),
		btn = me.dialog.get_primary_btn();
		if(!form_values) return;
		me.send_email(btn, form_values);
		//}
	},
	send_email: function(btn, form_values, selected_attachments, print_html, print_format) {
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
	}
});
