from __future__ import unicode_literals
from frappe import _

def get_data():
	return [
		{
			"label": _("Documents"),
			"icon": "icon-star",
			"items": [
				{
					"type": "doctype",
					"name": "Mailbox",
					"description": _("Mailbox For configured mails")
				},
			]
		},
		{
			"label": _("Setup"),
			"icon": "icon-cog",
			"items": [
				{
					"type": "doctype",
					"name": "Email Account Config",
					"description": _("POP3 and SMTP Configuration")
				},
				{
					"type": "doctype",
					"name": "Tag",
					"description": _("Tagging for Incoming mails")
				}
			]
		}
	]
