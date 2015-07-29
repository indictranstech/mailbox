{% include 'mailbox/mailbox/doctype/mailbox/composer.js' %};
frappe.listview_settings["Mailbox"] = {
	onload: function(listview) {
		listview.page.add_inner_button(__("Compose"), function() { 
			new mailbox.Composer({
				action:"compose",
				ref_no:Math.floor(Date.now() / 1000)
			})
		});
		listview.page.add_inner_button(__("sync"), function() { 
			frappe.call({
				method:"mailbox.mailbox.doctype.mailbox.mailbox.sync_for_current_user",
				callback: function(r) {
					msgprint(__("Email Synced, Please Refresh page."))
				}
			});
		});
		listview.page.add_inner_button(__("trash"), function() { 
			var me = this;
			
			dl = $.map($(document).find('.list-delete:checked'), function(e) {
					return $(e).parents(".list-row:first").data('data');
				});
			
			if(!dl.length)
				return;

			frappe.confirm(__('Are you sure you want to trash the document(s)?'),
				function() {
					return frappe.call({
						method: 'mailbox.mailbox.doctype.mailbox.mailbox.trash_items',
						freeze: true,
						args: {
							items: $.map(dl, function(d, i) { return d.name }),
						},
						callback: function() {
							listview.set_working(false);
							listview.dirty = true;
							listview.refresh();
						}
					})
				}
			);
		});
		$(document).on("click",".list-select-all",function(){
			if ($(document).find(".list-delete:checked").length) {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).removeClass('hide')
			} else {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).addClass('hide')
			}
			
		})
		$(document).on("click", ".list-delete", function(event) {
			if ($(document).find(".list-delete:checked").length) {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).removeClass('hide')
			} else {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).addClass('hide')
			}
			// multi-select using shift key
			var $this = $(this);
			if (event.shiftKey && $this.prop("checked")) {
				var $end_row = $this.parents(".list-row");
				var $start_row = $end_row.prevAll(".list-row")
					.find(".list-delete:checked").last().parents(".list-row");
				if ($start_row) {
					$start_row.nextUntil($end_row).find(".list-delete").prop("checked", true);
				}
			}
		});

			// after delete, hide delete button
		$(document).on("render-complete", function() {
			if ($(document).find(".list-delete:checked").length) {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).removeClass('hide')
			} else {
				$($(listview.page.inner_toolbar).last().find('.btn-xs')[2]).addClass('hide')	
			}
		});
		
	},
	refresh: function(listview) {
		listview.page.add_inner_button(__("Compose"), function() { 
			new mailbox.Composer({})
		});
		listview.page.add_inner_button(__("sync"), function() { 
			frappe.call({
				method:"mailbox.mailbox.doctype.inbox.inbox.sync_for_current_user",
				callback: function(r) {
					msgprint(__("Email Synced, Please Refresh page."))	
				}
			});
			
	});
	
		

			
	},
	add_fields: ["read","action"],
	title:"tag",
	colwidths: {"subject":3,"indicator":3,"recipients":3},
	get_indicator: function(doc) {
		if(doc.tag) {
			return [__(doc.tag),"green", "doc.tag,!=,''"]
		}
		else {
			return [__(doc.tag),"red", "doc.tag,!=,''"]
		}
	}
}

