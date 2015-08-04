{% include 'mailbox/mailbox/doctype/mailbox/composer.js' %};
frappe.ui.form.on("Mailbox", "refresh", function(frm) {
	if (frm.doc.docstatus===0 && parseInt(frm.doc.__islocal)!=1 && frm.doc.action != 'Trash'){
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
		frm.add_custom_button(__("Reply All"), function() { new mailbox.Composer({
				doc: frm.doc,
				frm: frm,
				action: "reply_all",
			}) 
		});
		frm.add_custom_button(__("Trash"), function() { 
			var remove_btn = this;
			frappe.confirm(__("Are you sure you want to trash the document?"),
				function() {
					frm.set_value("action","Trash")
					frm.save()
					frappe.set_route("List", "Mailbox");
				}
			);
		});
	};
	if (frm.doc.docstatus===0){
		frappe.call({
			method:"mailbox.mailbox.doctype.mailbox.mailbox.check_contact",
			args:{"contact":frm.doc.sender,"action":frm.doc.action},
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

